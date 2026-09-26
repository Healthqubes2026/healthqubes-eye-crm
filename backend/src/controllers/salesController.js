const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// ── POST /api/v1/sales/add ────────────────────────────────────────────────────
exports.addSale = async (req, res, next) => {
  try {
    const {
      doctor_id, hospital, sale_date, lat, lng, location_name,
      items, notes, invoice_no, payment_mode,
    } = req.body;

    if (!items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'At least one sale item required.' });
    }

    // Validate products and compute totals
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.product_id || !item.quantity) {
        return res.status(400).json({ success: false, message: 'Each item needs product_id and quantity.' });
      }
      const [prod] = await db.query(
        'SELECT id, name, unit_price FROM products WHERE id = ? AND is_active = 1',
        [item.product_id]
      );
      if (!prod.length) {
        return res.status(404).json({ success: false, message: `Product id ${item.product_id} not found.` });
      }
      const unitPrice = item.override_price || prod[0].unit_price;
      const total     = unitPrice * item.quantity;
      totalAmount    += total;
      validatedItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, total });
    }

    const conn = await (await import('../config/database.js')).default.getConnection();
    try {
      await conn.beginTransaction();

      const [saleResult] = await conn.query(
        `INSERT INTO sales
         (uuid, employee_id, doctor_id, hospital, sale_date, lat, lng, location_name,
          total_amount, notes, invoice_no, payment_mode)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuidv4(), req.employee.id, doctor_id || null, hospital,
          sale_date || new Date().toISOString().split('T')[0],
          lat || null, lng || null, location_name,
          totalAmount, notes, invoice_no, payment_mode || 'cash',
        ]
      );

      const saleId = saleResult.insertId;
      for (const item of validatedItems) {
        await conn.query(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) VALUES (?,?,?,?,?)',
          [saleId, item.product_id, item.quantity, item.unit_price, item.total]
        );
      }

      await conn.commit();
      res.status(201).json({
        success: true,
        message: 'Sale recorded.',
        data: { id: saleId, total_amount: totalAmount },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) { next(err); }
};

// ── GET /api/v1/sales/list ────────────────────────────────────────────────────
exports.listSales = async (req, res, next) => {
  try {
    const { from, to, doctor_id, employee_id, product_id, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (req.employee.role === 'field_agent') {
      where += ' AND s.employee_id = ?';
      params.push(req.employee.id);
    } else if (employee_id) {
      where += ' AND s.employee_id = ?';
      params.push(employee_id);
    }

    if (doctor_id) { where += ' AND s.doctor_id = ?';    params.push(doctor_id); }
    if (from)      { where += ' AND s.sale_date >= ?';   params.push(from); }
    if (to)        { where += ' AND s.sale_date <= ?';   params.push(to); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT s.*,
              d.name AS doctor_name,
              e.name AS employee_name,
              e.zone
       FROM sales s
       LEFT JOIN doctors d   ON s.doctor_id   = d.id
       LEFT JOIN employees e ON s.employee_id = e.id
       ${where}
       ORDER BY s.sale_date DESC, s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Attach line items
    for (const sale of rows) {
      const [items] = await db.query(
        `SELECT si.*, p.name AS product_name, p.category
         FROM sale_items si JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = ?`,
        [sale.id]
      );
      sale.items = items;
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM sales s ${where}`, params
    );
    const [[{ grand_total }]] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS grand_total FROM sales s ${where}`, params
    );

    res.json({
      success: true,
      data: rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit), grand_total: parseFloat(grand_total) },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/sales/summary ─────────────────────────────────────────────────
exports.getSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m   = month || (now.getMonth() + 1);
    const y   = year  || now.getFullYear();

    let where = `WHERE MONTH(s.sale_date) = ? AND YEAR(s.sale_date) = ?`;
    const params = [m, y];

    if (req.employee.role === 'field_agent') {
      where += ' AND s.employee_id = ?';
      params.push(req.employee.id);
    }

    const [[summary]] = await db.query(
      `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_revenue
       FROM sales s ${where}`,
      params
    );

    const [byProduct] = await db.query(
      `SELECT p.name, p.category, SUM(si.quantity) AS qty, SUM(si.total) AS revenue
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       ${where}
       GROUP BY p.id ORDER BY revenue DESC LIMIT 10`,
      params
    );

    const [byEmployee] = await db.query(
      `SELECT e.name, SUM(s.total_amount) AS revenue, COUNT(s.id) AS orders
       FROM sales s JOIN employees e ON s.employee_id = e.id
       ${where}
       GROUP BY e.id ORDER BY revenue DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        ...summary,
        total_revenue: parseFloat(summary.total_revenue),
        top_products: byProduct,
        by_employee: byEmployee,
        month: m, year: y,
      },
    });
  } catch (err) { next(err); }
};
