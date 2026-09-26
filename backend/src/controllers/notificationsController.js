const db       = require('../config/database');
const { sendToDevice, sendToDevices } = require('../utils/firebase');

// ── POST /api/v1/notifications/send  (Admin → one or all employees) ───────────
exports.send = async (req, res, next) => {
  try {
    const { employee_id, title, body, type, data } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title and body required.' });
    }

    if (employee_id) {
      // Single employee
      const [rows] = await db.query(
        'SELECT id, fcm_token FROM employees WHERE id = ? AND is_active = 1',
        [employee_id]
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      await db.query(
        'INSERT INTO notifications (employee_id, title, body, type, data) VALUES (?,?,?,?,?)',
        [employee_id, title, body, type || 'system', data ? JSON.stringify(data) : null]
      );

      if (rows[0].fcm_token) {
        await sendToDevice(rows[0].fcm_token, title, body, data || {});
        await db.query(
          'UPDATE notifications SET sent = 1 WHERE employee_id = ? ORDER BY id DESC LIMIT 1',
          [employee_id]
        );
      }
    } else {
      // Broadcast to all active field agents
      const [employees] = await db.query(
        'SELECT id, fcm_token FROM employees WHERE is_active = 1 AND fcm_token IS NOT NULL'
      );

      const inserts = employees.map(e => [e.id, title, body, type || 'system', data ? JSON.stringify(data) : null]);
      if (inserts.length) {
        await db.query(
          'INSERT INTO notifications (employee_id, title, body, type, data) VALUES ?',
          [inserts]
        );
      }

      const tokens = employees.map(e => e.fcm_token).filter(Boolean);
      if (tokens.length) {
        await sendToDevices(tokens, title, body, data || {});
      }
    }

    res.json({ success: true, message: 'Notification sent.' });
  } catch (err) { next(err); }
};

// ── GET /api/v1/notifications/my  (Employee fetches their notifications) ──────
exports.getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT id, title, body, type, data, read_at, created_at
       FROM notifications
       WHERE employee_id = ? OR employee_id IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.employee.id, parseInt(limit), offset]
    );

    const [[{ unread }]] = await db.query(
      `SELECT COUNT(*) AS unread FROM notifications
       WHERE (employee_id = ? OR employee_id IS NULL) AND read_at IS NULL`,
      [req.employee.id]
    );

    res.json({ success: true, data: rows, meta: { unread } });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/notifications/:id/read ───────────────────────────────────────
exports.markRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET read_at = NOW() WHERE id = ? AND employee_id = ?',
      [req.params.id, req.employee.id]
    );
    res.json({ success: true, message: 'Marked as read.' });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/notifications/read-all ───────────────────────────────────────
exports.markAllRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET read_at = NOW() WHERE employee_id = ? AND read_at IS NULL',
      [req.employee.id]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
};
