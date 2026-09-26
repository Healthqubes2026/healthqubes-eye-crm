const db = require('../config/database');

// Helper: compute status from hours
const computeStatus = (checkin, checkout) => {
  if (!checkin || !checkout) return 'absent';
  const hours = (new Date(checkout) - new Date(checkin)) / 3600000;
  if (hours < 4) return 'half_day';
  return 'present';
};

// Helper: compute working_hours
const computeHours = (checkin, checkout) => {
  if (!checkin || !checkout) return null;
  return ((new Date(checkout) - new Date(checkin)) / 3600000).toFixed(2);
};

// Helper: log a change
const logChange = async (attendanceId, employeeId, date, changedBy, changeType, oldVal, newVal, reason) => {
  await db.query(
    `INSERT INTO attendance_logs
     (attendance_id, employee_id, date, changed_by, change_type, old_value, new_value, reason)
     VALUES (?,?,?,?,?,?,?,?)`,
    [attendanceId, employeeId, date, changedBy, changeType,
     JSON.stringify(oldVal), JSON.stringify(newVal), reason]
  );
};

// ── GET /api/v1/attendance/manual/employees ───────────────────────────────────
// Returns employee list for dropdown (admin = all, manager = their team)
exports.getEmployeeList = async (req, res, next) => {
  try {
    const { search } = req.query;
    let where = 'WHERE is_active = 1';
    const params = [];

    if (req.employee.role === 'manager') {
      where += ' AND manager_id = ?';
      params.push(req.employee.id);
    }
    if (search) {
      where += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT id, name, phone, zone, role FROM employees ${where} ORDER BY name LIMIT 100`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/v1/attendance/manual ────────────────────────────────────────────
// Add manual attendance entry
exports.addManual = async (req, res, next) => {
  try {
    const { employee_id, date, checkin_time, checkout_time, location, zone, status, notes } = req.body;

    if (!employee_id || !date) {
      return res.status(400).json({ success: false, message: 'employee_id and date are required.' });
    }

    // Role check: manager can only add for their team
    if (req.employee.role === 'manager') {
      const [emp] = await db.query('SELECT manager_id FROM employees WHERE id = ?', [employee_id]);
      if (!emp.length || emp[0].manager_id !== req.employee.id) {
        return res.status(403).json({ success: false, message: 'You can only add attendance for your team.' });
      }
    }

    // Check for approved leave on this date
    const [leaveCheck] = await db.query(
      `SELECT id FROM leave_requests
       WHERE employee_id = ? AND status = 'approved' AND from_date <= ? AND to_date >= ?`,
      [employee_id, date, date]
    );
    if (leaveCheck.length && status !== 'on_leave') {
      return res.status(409).json({
        success: false,
        message: 'Employee has approved leave on this date. Set status to On Leave.'
      });
    }

    // Prevent duplicate
    const [existing] = await db.query(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
      [employee_id, date]
    );
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: 'Attendance record already exists for this date. Use Edit/Override instead.'
      });
    }

    const checkin  = checkin_time  ? new Date(`${date}T${checkin_time}`)  : null;
    const checkout = checkout_time ? new Date(`${date}T${checkout_time}`) : null;
    const hours    = computeHours(checkin, checkout);
    const finalStatus = status || computeStatus(checkin, checkout);
    const isLate   = checkin ? checkin.getHours() > 9 || (checkin.getHours() === 9 && checkin.getMinutes() > 30) : false;

    const [result] = await db.query(
      `INSERT INTO attendance
       (employee_id, date, checkin_time, checkout_time, checkin_address, working_hours,
        status, is_late, notes, is_manual, modified_by, modified_by_role)
       VALUES (?,?,?,?,?,?,?,?,?,TRUE,?,?)`,
      [employee_id, date, checkin, checkout, location || null, hours,
       finalStatus, isLate, notes || null, req.employee.id, req.employee.role]
    );

    await logChange(result.insertId, employee_id, date, req.employee.id, 'manual_add',
      null, { status: finalStatus, checkin_time, checkout_time, location, notes }, 'Manual entry by admin/manager');

    res.status(201).json({ success: true, message: 'Attendance added successfully.', data: { id: result.insertId } });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/attendance/manual/:id ─────────────────────────────────────────
// Override / edit existing attendance
exports.overrideManual = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { checkin_time, checkout_time, location, status, notes, reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'A reason for change is required.' });
    }

    const [existing] = await db.query(
      `SELECT a.*, e.manager_id FROM attendance a
       JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`,
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const rec = existing[0];

    // Manager can only edit their team
    if (req.employee.role === 'manager' && rec.manager_id !== req.employee.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your team\'s attendance.' });
    }

    const dateStr  = rec.date instanceof Date ? rec.date.toISOString().split('T')[0] : rec.date;
    const checkin  = checkin_time  ? new Date(`${dateStr}T${checkin_time}`)  : rec.checkin_time;
    const checkout = checkout_time ? new Date(`${dateStr}T${checkout_time}`) : rec.checkout_time;
    const hours    = computeHours(checkin, checkout);
    const finalStatus = status || computeStatus(checkin, checkout);
    const isLate   = checkin ? (new Date(checkin)).getHours() > 9 || ((new Date(checkin)).getHours() === 9 && (new Date(checkin)).getMinutes() > 30) : rec.is_late;

    const oldVal = {
      checkin_time: rec.checkin_time, checkout_time: rec.checkout_time,
      status: rec.status, notes: rec.notes, checkin_address: rec.checkin_address
    };

    await db.query(
      `UPDATE attendance SET
        checkin_time = ?, checkout_time = ?, checkin_address = COALESCE(?, checkin_address),
        working_hours = ?, status = ?, is_late = ?, notes = COALESCE(?, notes),
        is_manual = TRUE, modified_by = ?, modified_by_role = ?, updated_at = NOW()
       WHERE id = ?`,
      [checkin, checkout, location || null, hours, finalStatus, isLate,
       notes || null, req.employee.id, req.employee.role, id]
    );

    await logChange(id, rec.employee_id, dateStr, req.employee.id, 'override',
      oldVal, { status: finalStatus, checkin_time, checkout_time, location, notes }, reason);

    res.json({ success: true, message: 'Attendance updated successfully.' });
  } catch (err) { next(err); }
};

// ── GET /api/v1/attendance/manual/logs ────────────────────────────────────────
// Get audit log of manual changes
exports.getLogs = async (req, res, next) => {
  try {
    const { date, employee_id, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (date)        { where += ' AND al.date = ?';        params.push(date); }
    if (employee_id) { where += ' AND al.employee_id = ?'; params.push(employee_id); }

    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(
      `SELECT al.*, e.name AS employee_name, cb.name AS changed_by_name, cb.role AS changed_by_role
       FROM attendance_logs al
       JOIN employees e  ON e.id  = al.employee_id
       JOIN employees cb ON cb.id = al.changed_by
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/v1/attendance/manual/bulk ───────────────────────────────────────
// Bulk upload via CSV data (admin only)
exports.bulkUpload = async (req, res, next) => {
  try {
    const { rows } = req.body; // array of {employee_id, date, check_in, check_out}
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: 'No rows provided.' });
    }

    const results = { success: 0, failed: [], skipped: 0 };

    for (const row of rows) {
      const { employee_id, date, check_in, check_out } = row;
      if (!employee_id || !date) {
        results.failed.push({ row, reason: 'Missing employee_id or date' });
        continue;
      }

      try {
        const [existing] = await db.query(
          'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
          [employee_id, date]
        );
        if (existing.length) {
          results.skipped++;
          continue;
        }

        const checkin  = check_in  ? new Date(`${date}T${check_in}`)  : null;
        const checkout = check_out ? new Date(`${date}T${check_out}`) : null;
        const hours    = computeHours(checkin, checkout);
        const status   = computeStatus(checkin, checkout);

        const [ins] = await db.query(
          `INSERT INTO attendance (employee_id, date, checkin_time, checkout_time, working_hours, status, is_manual, modified_by, modified_by_role)
           VALUES (?,?,?,?,?,?,TRUE,?,?)`,
          [employee_id, date, checkin, checkout, hours, status, req.employee.id, req.employee.role]
        );

        await logChange(ins.insertId, employee_id, date, req.employee.id, 'bulk_upload',
          null, { checkin_time: check_in, checkout_time: check_out, status }, 'Bulk upload');

        results.success++;
      } catch (e) {
        results.failed.push({ row, reason: e.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};
