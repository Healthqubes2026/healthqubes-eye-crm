const db = require('../config/database');

// ── POST /api/v1/tasks/add ────────────────────────────────────────────────────
exports.addTask = async (req, res, next) => {
  try {
    const {
      lead_id, title, description, assigned_to, priority, due_date
    } = req.body;

    if (!lead_id || !title || !assigned_to) {
      return res.status(400).json({ success: false, message: 'lead_id, title, and assigned_to are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO tasks (lead_id, title, description, assigned_to, created_by, priority, due_date)
       VALUES (?,?,?,?,?,?,?)`,
      [lead_id, title, description || null, assigned_to, req.employee.id, priority || 'medium', due_date || null]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['task', result.insertId, req.employee.id, 'created', `Task created: ${title}`]
    );

    res.status(201).json({
      success: true,
      message: 'Task added successfully.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/tasks/list ────────────────────────────────────────────────────
exports.listTasks = async (req, res, next) => {
  try {
    const { lead_id, status, assigned_to, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (lead_id) { where += ' AND t.lead_id = ?'; params.push(lead_id); }
    if (status) { where += ' AND t.status = ?'; params.push(status); }
    if (assigned_to) { where += ' AND t.assigned_to = ?'; params.push(assigned_to); }

    // Field agents see only tasks assigned to them or created by them
    if (req.employee.role === 'field_agent') {
      where += ' AND (t.assigned_to = ? OR t.created_by = ?)';
      params.push(req.employee.id, req.employee.id);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT t.*,
              l.patient_name,
              e_assigned.name AS assigned_to_name,
              e_created.name AS created_by_name
       FROM tasks t
       JOIN leads l ON t.lead_id = l.id
       JOIN employees e_assigned ON t.assigned_to = e_assigned.id
       JOIN employees e_created ON t.created_by = e_created.id
       ${where}
       ORDER BY t.due_date ASC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM tasks t ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/tasks/:id/status ──────────────────────────────────────────────
exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}.` });
    }

    const [existing] = await db.query('SELECT id, status, title FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const oldStatus = existing[0].status;
    const updates = ['status = ?'];
    const vals = [status];

    if (status === 'completed') {
      updates.push('completed_at = NOW()');
    }
    updates.push('updated_at = NOW()');
    vals.push(req.params.id);

    await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, vals);

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, old_value, new_value, notes) VALUES (?,?,?,?,?,?,?)',
      ['task', req.params.id, req.employee.id, 'status_changed', JSON.stringify({ status: oldStatus }), JSON.stringify({ status }), notes]
    );

    res.json({ success: true, message: `Task status updated to ${status}.` });
  } catch (err) { next(err); }
};

// ── GET /api/v1/tasks/overdue ─────────────────────────────────────────────────
exports.getOverdueTasks = async (req, res, next) => {
  try {
    let where = 'WHERE t.status IN ("pending", "in_progress") AND t.due_date < CURDATE()';
    const params = [];

    if (req.employee.role === 'field_agent') {
      where += ' AND t.assigned_to = ?';
      params.push(req.employee.id);
    }

    const [rows] = await db.query(
      `SELECT t.*,
              l.patient_name,
              e_assigned.name AS assigned_to_name,
              DATEDIFF(CURDATE(), t.due_date) AS days_overdue
       FROM tasks t
       JOIN leads l ON t.lead_id = l.id
       JOIN employees e_assigned ON t.assigned_to = e_assigned.id
       ${where}
       ORDER BY t.due_date ASC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};