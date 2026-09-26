const db   = require('../config/database');
const path = require('path');

// ── POST /api/v1/attendance/checkin ──────────────────────────────────────────
exports.checkIn = async (req, res, next) => {
  try {
    const empId = req.employee.id;
    const today = new Date().toISOString().split('T')[0];

    // Prevent double check-in
    const [existing] = await db.query(
      'SELECT id, checkin_time FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );
    if (existing.length && existing[0].checkin_time) {
      return res.status(409).json({
        success: false,
        message: `Already checked in at ${existing[0].checkin_time}.`,
      });
    }

    const { lat, lng, address, notes } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'GPS coordinates required.' });
    }

    const selfie = req.file ? `/uploads/selfies/${req.file.filename}` : null;
    const now    = new Date();

    // Late check if after 09:30 IST
    const cutoff = new Date(now);
    cutoff.setHours(9, 30, 0, 0);
    const isLate = now > cutoff;

    const status = isLate ? 'late' : 'present';

    if (existing.length) {
      // Row exists (maybe created from leave), update it
      await db.query(
        `UPDATE attendance SET checkin_time=?, checkin_lat=?, checkin_lng=?,
         checkin_address=?, checkin_selfie=?, status=?, is_late=?, notes=?
         WHERE employee_id=? AND date=?`,
        [now, lat, lng, address, selfie, status, isLate, notes, empId, today]
      );
    } else {
      await db.query(
        `INSERT INTO attendance
         (employee_id, date, checkin_time, checkin_lat, checkin_lng, checkin_address, checkin_selfie, status, is_late, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [empId, today, now, lat, lng, address, selfie, status, isLate, notes]
      );
    }

    res.status(201).json({
      success: true,
      message: isLate ? 'Checked in (late).' : 'Checked in successfully.',
      data: { checkin_time: now, is_late: isLate, status, selfie },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/attendance/checkout ──────────────────────────────────────────
exports.checkOut = async (req, res, next) => {
  try {
    const empId = req.employee.id;
    const today = new Date().toISOString().split('T')[0];

    const [rows] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );
    if (!rows.length || !rows[0].checkin_time) {
      return res.status(400).json({ success: false, message: 'No check-in found for today.' });
    }
    if (rows[0].checkout_time) {
      return res.status(409).json({ success: false, message: 'Already checked out today.' });
    }

    const { lat, lng, address } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'GPS coordinates required.' });
    }

    const checkIn  = new Date(rows[0].checkin_time);
    const checkOut = new Date();
    const hours    = ((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2);

    // Half-day if less than 4 hours
    const status = parseFloat(hours) < 4 ? 'half_day' : rows[0].status;

    await db.query(
      `UPDATE attendance SET checkout_time=?, checkout_lat=?, checkout_lng=?,
       checkout_address=?, working_hours=?, status=? WHERE employee_id=? AND date=?`,
      [checkOut, lat, lng, address, hours, status, empId, today]
    );

    res.json({
      success: true,
      message: 'Checked out successfully.',
      data: { checkout_time: checkOut, working_hours: parseFloat(hours), status },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/attendance/today ─────────────────────────────────────────────
exports.getToday = async (req, res, next) => {
  try {
    const empId = req.employee.id;
    const today = new Date().toISOString().split('T')[0];

    const [rows] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );

    res.json({
      success: true,
      data: rows[0] || null,
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/attendance/history ───────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const empId = req.employee.id;
    const { from, to, page = 1, limit = 30 } = req.query;

    let where = 'WHERE a.employee_id = ?';
    const params = [empId];

    if (from) { where += ' AND a.date >= ?'; params.push(from); }
    if (to)   { where += ' AND a.date <= ?'; params.push(to); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(
      `SELECT a.*, e.name AS employee_name FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       ${where} ORDER BY a.date DESC LIMIT ? OFFSET ?`,
      params
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM attendance a ${where.split('LIMIT')[0]}`,
      params.slice(0, -2)
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/attendance/team  (Manager/Admin: see all) ─────────────────────
exports.getTeamAttendance = async (req, res, next) => {
  try {
    const { date, status, page = 1, limit = 50 } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let where = 'WHERE a.date = ?';
    const params = [targetDate];

    if (req.employee.role === 'manager') {
      where += ' AND e.manager_id = ?';
      params.push(req.employee.id);
    }
    if (status) { where += ' AND a.status = ?'; params.push(status); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT a.*, e.name, e.phone, e.zone
       FROM attendance a
       RIGHT JOIN employees e ON a.employee_id = e.id AND a.date = ?
       ${where.replace('WHERE a.date = ?', 'WHERE e.is_active = 1')}
       ORDER BY e.name
       LIMIT ? OFFSET ?`,
      [targetDate, ...params.slice(1), parseInt(limit), offset]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/v1/attendance/leave ─────────────────────────────────────────────
exports.applyLeave = async (req, res, next) => {
  try {
    const { from_date, to_date, leave_type, reason } = req.body;
    if (!from_date || !to_date || !reason) {
      return res.status(400).json({ success: false, message: 'from_date, to_date and reason required.' });
    }

    const startDate = new Date(from_date);
    const endDate = new Date(to_date);
    if (startDate > endDate) {
      return res.status(400).json({ success: false, message: 'from_date must be before or equal to to_date.' });
    }

    const sanitizedReason = String(reason).trim();
    const validatedType = ['sick', 'casual', 'earned', 'unpaid'].includes(leave_type) ? leave_type : 'casual';

    const [result] = await db.query(
      'INSERT INTO leave_requests (employee_id, from_date, to_date, leave_type, reason) VALUES (?,?,?,?,?)',
      [req.employee.id, from_date, to_date, validatedType, sanitizedReason]
    );

    res.status(201).json({
      success: true,
      message: 'Leave request submitted.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/attendance/leaves ─────────────────────────────────────────────
exports.getLeaves = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = '';
    const params = [];
    if (status) { where = 'WHERE lr.status = ?'; params.push(status); }
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(
      `SELECT lr.*, e.name AS employee_name, e.phone, e.zone, e.role
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leave_requests lr ${where}`,
      status ? [status] : []
    );
    res.json({ success: true, data: rows, pagination: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/attendance/leaves/:id/approve ─────────────────────────────────
exports.approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const [existing] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Leave request not found.' });

    await db.query(
      'UPDATE leave_requests SET status = ?, approved_by = ?, remarks = ?, updated_at = NOW() WHERE id = ?',
      ['approved', req.employee.id, remarks || null, id]
    );

    // Mark attendance rows as on_leave for the date range
    const leave = existing[0];
    await db.query(
      `INSERT INTO attendance (employee_id, date, status)
       SELECT ?, d, 'on_leave'
       FROM (
         SELECT DATE_ADD(?, INTERVAL seq DAY) AS d
         FROM (SELECT 0 seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
               UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
               UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14) n
         WHERE DATE_ADD(?, INTERVAL seq DAY) <= ?
       ) dates
       ON DUPLICATE KEY UPDATE status = 'on_leave'`,
      [leave.employee_id, leave.from_date, leave.from_date, leave.to_date]
    );

    res.json({ success: true, message: 'Leave approved.' });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/attendance/leaves/:id/reject ──────────────────────────────────
exports.rejectLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const [existing] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Leave request not found.' });

    await db.query(
      'UPDATE leave_requests SET status = ?, approved_by = ?, remarks = ?, updated_at = NOW() WHERE id = ?',
      ['rejected', req.employee.id, remarks || null, id]
    );
    res.json({ success: true, message: 'Leave rejected.' });
  } catch (err) { next(err); }
};
