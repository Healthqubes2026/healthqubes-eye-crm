const db = require('../config/database');

// ── POST /api/v1/treatment-categories/add ─────────────────────────────────────
exports.addTreatmentCategory = async (req, res, next) => {
  try {
    const { name, description, estimated_days, category_type } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }

    const [result] = await db.query(
      `INSERT INTO treatment_categories (name, description, estimated_days, category_type)
       VALUES (?,?,?,?)`,
      [name, description || null, estimated_days || null, category_type || 'treatment']
    );

    res.status(201).json({
      success: true,
      message: 'Treatment category added successfully.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/treatment-categories/list ─────────────────────────────────────
exports.listTreatmentCategories = async (req, res, next) => {
  try {
    const { category_type, is_active = true } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (category_type) { where += ' AND category_type = ?'; params.push(category_type); }
    where += ' AND is_active = ?'; params.push(is_active);

    const [rows] = await db.query(
      `SELECT * FROM treatment_categories ${where} ORDER BY name ASC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/treatment-categories/:id ──────────────────────────────────────
exports.updateTreatmentCategory = async (req, res, next) => {
  try {
    const { name, description, estimated_days, category_type, is_active } = req.body;

    const updates = [];
    const vals = [];

    const fields = { name, description, estimated_days, category_type, is_active };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        vals.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    vals.push(req.params.id);

    await db.query(`UPDATE treatment_categories SET ${updates.join(', ')} WHERE id = ?`, vals);

    res.json({ success: true, message: 'Treatment category updated successfully.' });
  } catch (err) { next(err); }
};