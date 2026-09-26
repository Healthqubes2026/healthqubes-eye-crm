const router = require('express').Router();
const db     = require('../config/database');
const { authenticate, isAdmin, isManagement } = require('../middleware/auth');

router.use(authenticate);

// ── GET /api/v1/products/list ─────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const { category, treatment_category_id, hospital, active = '1' } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (active !== 'all') { where += ' AND p.is_active = ?'; params.push(parseInt(active)); }
    if (category)         { where += ' AND p.category = ?';  params.push(category); }
    if (treatment_category_id) { where += ' AND p.treatment_category_id = ?'; params.push(parseInt(treatment_category_id)); }
    if (hospital)         { where += ' AND p.hospital = ?'; params.push(hospital); }

    const [rows] = await db.query(
      `SELECT p.*, tc.name as treatment_category_name 
       FROM products p 
       LEFT JOIN treatment_categories tc ON p.treatment_category_id = tc.id
       ${where} ORDER BY p.category, p.name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/v1/products/categories ──────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
    );
    res.json({ success: true, data: rows.map(r => r.category) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/v1/products/treatment-categories ────────────────────────────────
router.get('/treatment-categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, hospital_type FROM treatment_categories 
       WHERE is_active = TRUE ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/v1/products/add  (admin only) ───────────────────────────────────
router.post('/add', isAdmin, async (req, res) => {
  try {
    const { name, category, unit_price, unit, treatment_category_id, hospital } = req.body;
    if (!name || !unit_price) {
      return res.status(400).json({ success: false, message: 'name and unit_price are required.' });
    }
    const [result] = await db.query(
      'INSERT INTO products (name, category, unit_price, unit, treatment_category_id, hospital) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), category || null, parseFloat(unit_price), unit || 'piece', treatment_category_id || null, hospital || null]
    );
    res.status(201).json({ success: true, message: 'Product added.', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/v1/products/:id  (admin only) ────────────────────────────────────
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { name, category, unit_price, unit, is_active, treatment_category_id, hospital } = req.body;
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Product not found.' });

    await db.query(
      `UPDATE products SET name = ?, category = ?, unit_price = ?, unit = ?, is_active = ?, treatment_category_id = ?, hospital = ? WHERE id = ?`,
      [name.trim(), category || null, parseFloat(unit_price), unit || 'piece', is_active ? 1 : 0, treatment_category_id || null, hospital || null, id]
    );
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/v1/products/:id  (admin only — soft delete) ──────────────────
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Product not found.' });

    // Check if product is used in any sale
    const [used] = await db.query('SELECT id FROM sale_items WHERE product_id = ? LIMIT 1', [id]);
    if (used.length) {
      // Soft delete — keep history intact
      await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Product deactivated (has sales history).' });
    }

    // Hard delete if never used
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
