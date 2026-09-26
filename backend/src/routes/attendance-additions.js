const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { authenticate, isManagement, isAdmin } = require('../middleware/auth');

// ─── GET /api/v1/attendance/admin/team  (admin/manager: see all or own team) ───
router.get('/admin/team', authenticate, isManagement, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let employeeFilter = '';
    const params = [targetDate];

    if (req.employee.role === 'management') {
      employeeFilter = 'AND e.manager_id = ?';
      params.push(req.employee.id);
    }

    const [rows] = await db.query(
      `SELECT e.id, e.name, e.phone, e.zone, e.role,
              m.name AS manager_name,
              a.status, a.checkin_time, a.checkout_time, a.working_hours,
              a.notes, a.overridden_by, a.overridden_at,
              ov.name AS overridden_by_name
       FROM employees e
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
       LEFT JOIN employees m  ON m.id = e.manager_id
       LEFT JOIN employees ov ON ov.id = a.overridden_by
       WHERE e.is_active = 1 AND e.role IN ('sales_coordinator', 'case_manager')
       ${employeeFilter}
       ORDER BY e.name`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/v1/attendance/override ────────────────────────────────────────
router.post('/override', authenticate, isManagement, async (req, res) => {
  try {
    const { employee_id, date, status, notes } = req.body;

    if (!employee_id || !date || !status) {
      return res.status(400).json({ success: false, message: 'employee_id, date and status are required.' });
    }

    // Manager can only override their own team members
    if (req.employee.role === 'management') {
      const [emp] = await db.query(
        'SELECT id FROM employees WHERE id = ? AND manager_id = ?',
        [employee_id, req.employee.id]
      );
      if (!emp.length) {
        return res.status(403).json({ success: false, message: 'Employee is not in your team.' });
      }
    }

    const [existing] = await db.query(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
      [employee_id, date]
    );

    if (existing.length) {
      await db.query(
        `UPDATE attendance
         SET status = ?, notes = ?, override_status = ?, override_remarks = ?,
             overridden_by = ?, overridden_at = NOW(), updated_at = NOW()
         WHERE employee_id = ? AND date = ?`,
        [status, notes || null, status, notes || null, req.employee.id, employee_id, date]
      );
    } else {
      await db.query(
        `INSERT INTO attendance
         (employee_id, date, status, notes, override_status, override_remarks, overridden_by, overridden_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [employee_id, date, status, notes || null, status, notes || null, req.employee.id]
      );
    }

    res.json({ success: true, message: `Attendance marked as ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/v1/attendance/admin/leaves  (role-filtered leave requests) ─────
router.get('/admin/leaves', authenticate, isManagement, async (req, res) => {
  try {
    const { status } = req.query;

    let conditions = ['1=1'];
    const params = [];

    if (req.employee.role === 'management') {
      conditions.push('e.manager_id = ?');
      params.push(req.employee.id);
    }
    if (status && status !== 'all') {
      conditions.push('lr.status = ?');
      params.push(status);
    }

    const [rows] = await db.query(
      `SELECT lr.*, e.name AS employee_name, e.phone, e.zone,
              r.name AS reviewed_by_name
       FROM leave_requests lr
       JOIN employees e  ON e.id = lr.employee_id
       LEFT JOIN employees r ON r.id = lr.actioned_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY lr.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/v1/attendance/leaves/:id/review ───────────────────────────────
router.patch('/leaves/:id/review', authenticate, isManagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks, approved_from, approved_to } = req.body;

    if (!['approve', 'reject', 'partial'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve, reject, or partial.' });
    }

    // Manager can only action their own team's leaves
    if (req.employee.role === 'manager') {
      const [lr] = await db.query(
        `SELECT lr.id FROM leave_requests lr
         JOIN employees e ON e.id = lr.employee_id
         WHERE lr.id = ? AND e.manager_id = ?`,
        [id, req.employee.id]
      );
      if (!lr.length) {
        return res.status(403).json({ success: false, message: 'This leave request is not from your team.' });
      }
    }

    const newStatus = action === 'approve' ? 'approved'
                    : action === 'reject'  ? 'rejected'
                    : 'partial';

    if (action === 'partial' && approved_from && approved_to) {
      await db.query(
        `UPDATE leave_requests
         SET status = ?, actioned_by = ?, actioned_at = NOW(), rejection_reason = ?,
             approved_from = ?, approved_to = ?
         WHERE id = ?`,
        [newStatus, req.employee.id, remarks || null, approved_from, approved_to, id]
      );
    } else {
      await db.query(
        `UPDATE leave_requests
         SET status = ?, actioned_by = ?, actioned_at = NOW(), rejection_reason = ?
         WHERE id = ?`,
        [newStatus, req.employee.id, remarks || null, id]
      );
    }

    // If approved or partial — mark attendance as on_leave for approved date range
    if (action === 'approve' || action === 'partial') {
      const [lr] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
      if (lr.length) {
        const fromDate = action === 'partial' ? approved_from : lr[0].from_date;
        const toDate   = action === 'partial' ? approved_to   : lr[0].to_date;
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
          [lr[0].employee_id, fromDate, fromDate, toDate]
        );
      }
    }

    res.json({ success: true, message: `Leave ${newStatus} successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;