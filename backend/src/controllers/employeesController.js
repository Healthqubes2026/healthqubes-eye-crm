const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// ── GET /api/v1/employees/list ────────────────────────────────────────────────
exports.listEmployees = async (req, res, next) => {
  try {
    const { role, zone, is_active = 1, page = 1, limit = 50 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (role)      { where += ' AND e.role = ?';      params.push(role); }
    if (zone)      { where += ' AND e.zone = ?';      params.push(zone); }
    if (is_active !== undefined) {
      where += ' AND e.is_active = ?';
      params.push(parseInt(is_active));
    }

    // Managers see only their team
    if (req.employee.role === 'manager') {
      where += ' AND (e.manager_id = ? OR e.id = ?)';
      params.push(req.employee.id, req.employee.id);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT e.id, e.uuid, e.name, e.email, e.phone, e.role, e.zone,
              e.profile_photo, e.is_active, e.last_login, e.created_at,
              m.name AS manager_name
       FROM employees e
       LEFT JOIN employees m ON e.manager_id = m.id
       ${where}
       ORDER BY e.name
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM employees e ${where}`, params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/employees/:id ─────────────────────────────────────────────────
exports.getEmployee = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.id, e.uuid, e.name, e.email, e.phone, e.role, e.zone,
              e.profile_photo, e.is_active, e.last_login, e.created_at,
              m.name AS manager_name
       FROM employees e
       LEFT JOIN employees m ON e.manager_id = m.id
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// ── POST /api/v1/employees/add (Admin only) ───────────────────────────────────
exports.addEmployee = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, zone, manager_id } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'name, email, phone and password required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      `INSERT INTO employees (uuid, name, email, phone, password_hash, role, zone, manager_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuidv4(), name, email.toLowerCase(), phone, hash, role || 'field_agent', zone, manager_id || null]
    );

    res.status(201).json({
      success: true,
      message: 'Employee created.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/employees/:id ─────────────────────────────────────────────────
exports.updateEmployee = async (req, res, next) => {
  try {
    const { name, email, phone, role, zone, manager_id, is_active } = req.body;

    // Agents can only update their own profile (no role changes)
    if (req.employee.role === 'field_agent' && req.employee.id !== parseInt(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const fields = [];
    const vals   = [];

    if (name       !== undefined) { fields.push('name = ?');       vals.push(name); }
    if (email      !== undefined) { fields.push('email = ?');      vals.push(email.toLowerCase()); }
    if (phone      !== undefined) { fields.push('phone = ?');      vals.push(phone); }
    if (zone       !== undefined) { fields.push('zone = ?');       vals.push(zone); }
    // Only admin/manager can change role or active status
    if (req.employee.role !== 'field_agent') {
      if (role       !== undefined) { fields.push('role = ?');       vals.push(role); }
      if (manager_id !== undefined) { fields.push('manager_id = ?'); vals.push(manager_id); }
      if (is_active  !== undefined) { fields.push('is_active = ?');  vals.push(is_active); }
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    vals.push(req.params.id);
    await db.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`, vals);

    res.json({ success: true, message: 'Employee updated.' });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/employees/:id/fcm-token ───────────────────────────────────────
exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) return res.status(400).json({ success: false, message: 'fcm_token required.' });

    await db.query('UPDATE employees SET fcm_token = ? WHERE id = ?', [fcm_token, req.employee.id]);
    res.json({ success: true, message: 'FCM token updated.' });
  } catch (err) { next(err); }
};

// ── GET /api/v1/employees/me ──────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.id, e.uuid, e.name, e.email, e.phone, e.role, e.zone,
              e.profile_photo, e.last_login, m.name AS manager_name
       FROM employees e
       LEFT JOIN employees m ON e.manager_id = m.id
       WHERE e.id = ?`,
      [req.employee.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};
