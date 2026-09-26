const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// ── POST /api/v1/meetings/add ─────────────────────────────────────────────────
exports.addMeeting = async (req, res, next) => {
  try {
    const {
      doctor_id, visit_date, checkin_lat, checkin_lng,
      products_discussed, meeting_notes, follow_up_date,
      prescription_support, outcome,
    } = req.body;

    if (!doctor_id) {
      return res.status(400).json({ success: false, message: 'doctor_id required.' });
    }

    // Verify doctor exists
    const [doc] = await db.query('SELECT id, name, hospital FROM doctors WHERE id = ?', [doctor_id]);
    if (!doc.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const photos = req.files ? req.files.map(f => `/uploads/meetings/${f.filename}`) : [];

    const [result] = await db.query(
      `INSERT INTO meetings
       (uuid, employee_id, doctor_id, visit_date, checkin_time, checkin_lat, checkin_lng,
        products_discussed, meeting_notes, follow_up_date, prescription_support, outcome, photos)
       VALUES (?,?,?,?,NOW(),?,?,?,?,?,?,?,?)`,
      [
        uuidv4(),
        req.employee.id,
        doctor_id,
        visit_date || new Date().toISOString().split('T')[0],
        checkin_lat || null,
        checkin_lng || null,
        products_discussed ? JSON.stringify(
          Array.isArray(products_discussed) ? products_discussed : [products_discussed]
        ) : '[]',
        meeting_notes || null,
        follow_up_date || null,
        prescription_support ? 1 : 0,
        outcome || 'neutral',
        JSON.stringify(photos),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Meeting recorded successfully.',
      data: { id: result.insertId, doctor: doc[0] },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/meetings/:id/checkout ────────────────────────────────────────
exports.checkoutMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { checkout_lat, checkout_lng, meeting_notes, outcome } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM meetings WHERE id = ? AND employee_id = ?',
      [id, req.employee.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (rows[0].checkout_time) {
      return res.status(409).json({ success: false, message: 'Already checked out from this meeting.' });
    }

    const checkin  = new Date(rows[0].checkin_time);
    const checkout = new Date();
    const duration = Math.round((checkout - checkin) / 60000);

    await db.query(
      `UPDATE meetings SET checkout_time=NOW(), checkout_lat=?, checkout_lng=?,
       duration_minutes=?, meeting_notes=COALESCE(?, meeting_notes), outcome=COALESCE(?, outcome)
       WHERE id=?`,
      [checkout_lat || null, checkout_lng || null, duration, meeting_notes, outcome, id]
    );

    res.json({
      success: true,
      message: 'Checked out from meeting.',
      data: { duration_minutes: duration, checkout_time: checkout },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/meetings/list ─────────────────────────────────────────────────
exports.listMeetings = async (req, res, next) => {
  try {
    const { from, to, doctor_id, employee_id, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    // Field agents only see their own meetings
    if (req.employee.role === 'field_agent') {
      where += ' AND m.employee_id = ?';
      params.push(req.employee.id);
    } else if (employee_id) {
      where += ' AND m.employee_id = ?';
      params.push(employee_id);
    }

    if (doctor_id) { where += ' AND m.doctor_id = ?';   params.push(doctor_id); }
    if (from)      { where += ' AND m.visit_date >= ?';  params.push(from); }
    if (to)        { where += ' AND m.visit_date <= ?';  params.push(to); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT m.*, d.name AS doctor_name, d.hospital, d.city,
              e.name AS employee_name
       FROM meetings m
       JOIN doctors d   ON m.doctor_id   = d.id
       JOIN employees e ON m.employee_id = e.id
       ${where}
       ORDER BY m.checkin_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM meetings m ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/meetings/:id ──────────────────────────────────────────────────
exports.getMeeting = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, d.name AS doctor_name, d.hospital, d.city, d.phone AS doctor_phone,
              e.name AS employee_name, e.phone AS employee_phone
       FROM meetings m
       JOIN doctors d ON m.doctor_id = d.id
       JOIN employees e ON m.employee_id = e.id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// ── GET /api/v1/meetings/followups ───────────────────────────────────────────
exports.getFollowUps = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const empId = req.employee.id;

    let where = `WHERE m.follow_up_date <= ? AND m.follow_up_done = 0`;
    const params = [today];

    if (req.employee.role === 'field_agent') {
      where += ' AND m.employee_id = ?';
      params.push(empId);
    }

    const [rows] = await db.query(
      `SELECT m.id, m.follow_up_date, m.meeting_notes,
              d.name AS doctor_name, d.hospital, d.phone AS doctor_phone,
              e.name AS employee_name,
              DATEDIFF(?, m.follow_up_date) AS days_overdue
       FROM meetings m
       JOIN doctors d ON m.doctor_id = d.id
       JOIN employees e ON m.employee_id = e.id
       ${where}
       ORDER BY m.follow_up_date ASC`,
      [today, ...params]
    );

    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/meetings/doctors ─────────────────────────────────────────────
exports.listDoctors = async (req, res, next) => {
  try {
    const { search, city, page = 1, limit = 30 } = req.query;

    let where = 'WHERE d.is_active = 1';
    const params = [];

    if (city)   { where += ' AND d.city = ?';     params.push(city); }
    if (search) { where += ' AND d.name LIKE ?';  params.push(`%${search}%`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT d.*,
              COUNT(m.id) AS total_visits,
              MAX(m.visit_date) AS last_visit
       FROM doctors d
       LEFT JOIN meetings m ON d.id = m.doctor_id
       ${where}
       GROUP BY d.id
       ORDER BY d.name
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── POST /api/v1/meetings/doctors ────────────────────────────────────────────
exports.addDoctor = async (req, res, next) => {
  try {
    const { name, specialization, hospital, address, city, state, phone, email, lat, lng, category } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Doctor name required.' });

    const [result] = await db.query(
      `INSERT INTO doctors (name, specialization, hospital, address, city, state, phone, email, lat, lng, category, added_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, specialization, hospital, address, city, state, phone, email, lat, lng, category || 'B', req.employee.id]
    );

    res.status(201).json({
      success: true,
      message: 'Doctor added.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/meetings/doctors/:id ──────────────────────────────────────────
exports.updateDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, specialization, hospital, address, city, state, phone, email, lat, lng, category } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Doctor ID required.' });

    // Check if doctor exists
    const [existing] = await db.query('SELECT id FROM doctors WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    await db.query(
      `UPDATE doctors SET
       name = ?, specialization = ?, hospital = ?, address = ?, city = ?, state = ?,
       phone = ?, email = ?, lat = ?, lng = ?, category = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, specialization, hospital, address, city, state, phone, email, lat, lng, category, id]
    );

    res.json({
      success: true,
      message: 'Doctor updated successfully.',
    });
  } catch (err) { next(err); }
};
