const db = require('../config/database');

// ── POST /api/v1/hospitals/add ────────────────────────────────────────────────
exports.addHospital = async (req, res, next) => {
  try {
    const {
      name, address, city, state, country, phone, email, website,
      lat, lng, specialties, category, accreditation, emergency_services, international_patient_services
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }

    const [result] = await db.query(
      `INSERT INTO hospitals
       (name, address, city, state, country, phone, email, website,
        lat, lng, specialties, category, accreditation, emergency_services, international_patient_services, added_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, address || null, city || null, state || null, country || 'India', phone || null, email || null, website || null,
        lat || null, lng || null, JSON.stringify(specialties || []), category || 'secondary', accreditation || null,
        emergency_services !== undefined ? emergency_services : true,
        international_patient_services !== undefined ? international_patient_services : false,
        req.employee.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Hospital added successfully.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/hospitals/list ────────────────────────────────────────────────
exports.listHospitals = async (req, res, next) => {
  try {
    const { search, category, city, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (name LIKE ? OR city LIKE ? OR state LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { where += ' AND category = ?'; params.push(category); }
    if (city) { where += ' AND city = ?'; params.push(city); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT h.*, e.name AS added_by_name
       FROM hospitals h
       LEFT JOIN employees e ON h.added_by = e.id
       ${where}
       ORDER BY h.name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM hospitals h ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/hospitals/:id ─────────────────────────────────────────────────
exports.updateHospital = async (req, res, next) => {
  try {
    const {
      name, address, city, state, country, phone, email, website,
      lat, lng, specialties, category, accreditation, emergency_services, international_patient_services, is_active
    } = req.body;

    const updates = [];
    const vals = [];

    const fields = {
      name, address, city, state, country, phone, email, website,
      lat, lng, category, accreditation, emergency_services, international_patient_services, is_active
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        vals.push(value);
      }
    });

    if (specialties !== undefined) {
      updates.push('specialties = ?');
      vals.push(JSON.stringify(specialties));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    updates.push('updated_at = NOW()');
    vals.push(req.params.id);

    await db.query(`UPDATE hospitals SET ${updates.join(', ')} WHERE id = ?`, vals);

    res.json({ success: true, message: 'Hospital updated successfully.' });
  } catch (err) { next(err); }
};