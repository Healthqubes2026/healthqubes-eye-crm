const db = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const [[attendance]] = await db.query(
      `SELECT
         SUM(status IN ('present','late')) AS present,
         SUM(status = 'absent') AS absent,
         SUM(status = 'late') AS late,
         COUNT(*) AS total
       FROM attendance WHERE date = ?`,
      [today]
    );

    const [[meetings]] = await db.query(
      `SELECT COUNT(*) AS today_visits,
              SUM(follow_up_date = ? AND follow_up_done = 0) AS followups_due
       FROM meetings WHERE DATE(checkin_time) = ? OR follow_up_date = ?`,
      [today, today, today]
    );

    const [[leads]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(status IN ('new_lead','attempted','connected','requirement_captured')) AS new_leads,
              SUM(status = 'converted') AS converted,
              SUM(status = 'lost') AS lost,
              SUM(follow_up_date <= ? AND status NOT IN ('converted','lost')) AS followups_overdue
       FROM leads WHERE created_at >= ?`,
      [today, monthStart]
    );

    const [leadSources] = await db.query(
      `SELECT source, COUNT(*) AS count FROM leads
       WHERE created_at >= ?
       GROUP BY source
       ORDER BY count DESC`,
      [monthStart]
    );

    const [[sales]] = await db.query(
      `SELECT COALESCE(SUM(total_amount),0) AS mtd_revenue, COUNT(*) AS mtd_orders
       FROM sales WHERE sale_date >= ?`,
      [monthStart]
    );

    const [[tasks]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'pending') AS pending,
              SUM(status = 'in_progress') AS in_progress,
              SUM(status = 'completed') AS completed,
              SUM(due_date < CURDATE() AND status IN ('pending','in_progress')) AS overdue
       FROM tasks WHERE created_at >= ?`,
      [monthStart]
    );

    const [[quotations]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'sent') AS sent,
              SUM(status = 'awaiting_response') AS awaiting_response,
              SUM(status = 'received') AS received,
              SUM(status = 'accepted') AS accepted
       FROM quotations WHERE created_at >= ?`,
      [monthStart]
    );

    const [[patients]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(completion_status = 'completed') AS completed,
              SUM(completion_status IN ('confirmation','onboarding','docs_complete','travel_planning','appointment','treatment','recovery')) AS active,
              SUM(completion_status = 'cancelled') AS cancelled,
              COALESCE(SUM(package_value),0) AS total_revenue
       FROM patients WHERE created_at >= ?`,
      [monthStart]
    );

    const [[activeField]] = await db.query(
      `SELECT COUNT(DISTINCT employee_id) AS active_now
       FROM location_tracking WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)`
    );

    res.json({
      success: true,
      data: {
        attendance: {
          present: attendance.present || 0,
          absent: attendance.absent || 0,
          late: attendance.late || 0,
          rate: attendance.total ? Math.round((attendance.present / attendance.total) * 100) : 0,
        },
        meetings: {
          today_visits: meetings.today_visits || 0,
          followups_due: meetings.followups_due || 0,
        },
        leads: {
          total: leads.total || 0,
          new_leads: leads.new_leads || 0,
          converted: leads.converted || 0,
          lost: leads.lost || 0,
          followups_overdue: leads.followups_overdue || 0,
          conversion_rate: leads.total
            ? Math.round((leads.converted / leads.total) * 100)
            : 0,
          sources: leadSources || [],
        },
        sales: {
          mtd_revenue: parseFloat(sales.mtd_revenue) || 0,
          mtd_orders: sales.mtd_orders || 0,
        },
        tasks: {
          total: tasks.total || 0,
          pending: tasks.pending || 0,
          in_progress: tasks.in_progress || 0,
          completed: tasks.completed || 0,
          overdue: tasks.overdue || 0,
        },
        quotations: {
          total: quotations.total || 0,
          sent: quotations.sent || 0,
          awaiting_response: quotations.awaiting_response || 0,
          received: quotations.received || 0,
          accepted: quotations.accepted || 0,
        },
        patients: {
          total: patients.total || 0,
          active: patients.active || 0,
          completed: patients.completed || 0,
          cancelled: patients.cancelled || 0,
          total_revenue: parseFloat(patients.total_revenue) || 0,
        },
        field: {
          active_now: activeField.active_now || 0,
        },
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/reports/attendance
exports.attendanceReport = async (req, res, next) => {
  try {
    const { from, to, employee_id } = req.query;
    const start = from || new Date().toISOString().slice(0, 7) + '-01';
    const end   = to   || new Date().toISOString().split('T')[0];

    let where = 'WHERE a.date BETWEEN ? AND ?';
    const params = [start, end];

    if (employee_id) { where += ' AND a.employee_id = ?'; params.push(employee_id); }
    if (req.employee.role === 'field_agent') {
      where += ' AND a.employee_id = ?';
      params.push(req.employee.id);
    }

    const [rows] = await db.query(
      `SELECT
         e.id, e.name, e.zone,
         COUNT(*) AS total_days,
         SUM(a.status IN ('present','late')) AS present_days,
         SUM(a.status = 'absent') AS absent_days,
         SUM(a.status = 'late') AS late_days,
         SUM(a.status = 'half_day') AS half_days,
         ROUND(AVG(a.working_hours), 2) AS avg_hours,
         ROUND(SUM(a.working_hours), 2) AS total_hours
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       ${where}
       GROUP BY e.id
       ORDER BY present_days DESC`,
      params
    );

    res.json({ success: true, data: rows, meta: { from: start, to: end } });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/sales
exports.salesReport = async (req, res, next) => {
  try {
    const { from, to, group_by = 'day' } = req.query;
    const start = from || new Date().toISOString().slice(0, 7) + '-01';
    const end   = to   || new Date().toISOString().split('T')[0];

    const groupFormats = { day: '%Y-%m-%d', week: '%Y-%u', month: '%Y-%m' };
    const fmt = groupFormats[group_by] || groupFormats.day;

    let where = 'WHERE s.sale_date BETWEEN ? AND ?';
    const params = [start, end];

    if (req.employee.role === 'field_agent') {
      where += ' AND s.employee_id = ?';
      params.push(req.employee.id);
    }

    const [trend] = await db.query(
      `SELECT DATE_FORMAT(sale_date, '${fmt}') AS period,
              COUNT(*) AS orders,
              SUM(total_amount) AS revenue
       FROM sales s ${where}
       GROUP BY period ORDER BY period`,
      params
    );

    const [byProduct] = await db.query(
      `SELECT p.name, p.category, SUM(si.quantity) AS qty, SUM(si.total) AS revenue
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       ${where}
       GROUP BY p.id ORDER BY revenue DESC`,
      params
    );

    const [[totals]] = await db.query(
      `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount),0) AS total_revenue
       FROM sales s ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        trend,
        by_product: byProduct,
        totals: { ...totals, total_revenue: parseFloat(totals.total_revenue) },
      },
      meta: { from: start, to: end, group_by },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/leads
exports.leadsReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const start = from || new Date().toISOString().slice(0, 7) + '-01';
    const end   = to   || new Date().toISOString().split('T')[0];

    let where = 'WHERE l.created_at BETWEEN ? AND ?';
    const params = [start, end + ' 23:59:59'];

    const [pipeline] = await db.query(
      `SELECT status, COUNT(*) AS count FROM leads l ${where} GROUP BY status`,
      params
    );

    const [byCondition] = await db.query(
      `SELECT eye_condition, COUNT(*) AS count FROM leads l
       ${where} AND eye_condition IS NOT NULL
       GROUP BY eye_condition ORDER BY count DESC LIMIT 10`,
      params
    );

    const [bySource] = await db.query(
      `SELECT source, COUNT(*) AS count FROM leads l
       ${where}
       GROUP BY source ORDER BY count DESC`,
      params
    );

    const [byEmployee] = await db.query(
      `SELECT e.name, COUNT(l.id) AS total,
              SUM(l.status = 'converted') AS converted,
              ROUND(SUM(l.status = 'converted') / COUNT(l.id) * 100, 1) AS conversion_rate
       FROM leads l JOIN employees e ON l.assigned_to = e.id
       ${where}
       GROUP BY e.id ORDER BY total DESC`,
      params
    );

    res.json({
      success: true,
      data: { pipeline, by_condition: byCondition, by_source: bySource, by_employee: byEmployee },
      meta: { from: start, to: end },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/performance
exports.performanceReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m   = month || (now.getMonth() + 1);
    const y   = year  || now.getFullYear();
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const monthEnd   = new Date(y, m, 0).toISOString().split('T')[0];

    const [rows] = await db.query(
      `SELECT
         e.id, e.name, e.zone,
         COALESCE(att.present_days, 0) AS present_days,
         COALESCE(vis.visit_count, 0) AS doctor_visits,
         COALESCE(ld.lead_count, 0) AS leads_added,
         COALESCE(ld.converted, 0) AS leads_converted,
         COALESCE(sal.revenue, 0) AS sales_revenue,
         COALESCE(sal.orders, 0) AS sales_orders
       FROM employees e
       LEFT JOIN (
         SELECT employee_id, SUM(status IN ('present','late')) AS present_days
         FROM attendance WHERE date BETWEEN ? AND ?
         GROUP BY employee_id
       ) att ON att.employee_id = e.id
       LEFT JOIN (
         SELECT employee_id, COUNT(*) AS visit_count
         FROM meetings WHERE visit_date BETWEEN ? AND ?
         GROUP BY employee_id
       ) vis ON vis.employee_id = e.id
       LEFT JOIN (
         SELECT assigned_to, COUNT(*) AS lead_count, SUM(status='converted') AS converted
         FROM leads WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY assigned_to
       ) ld ON ld.assigned_to = e.id
       LEFT JOIN (
         SELECT employee_id, SUM(total_amount) AS revenue, COUNT(*) AS orders
         FROM sales WHERE sale_date BETWEEN ? AND ?
         GROUP BY employee_id
       ) sal ON sal.employee_id = e.id
       WHERE e.role = 'field_agent' AND e.is_active = 1
       ORDER BY sal.revenue DESC`,
      [monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd]
    );

    res.json({
      success: true,
      data: rows,
      meta: { month: m, year: y },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/tasks
exports.tasksReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const start = from || new Date().toISOString().slice(0, 7) + '-01';
    const end   = to   || new Date().toISOString().split('T')[0];

    let where = 'WHERE t.created_at >= ? AND t.created_at <= ?';
    const params = [start + ' 00:00:00', end + ' 23:59:59'];

    if (req.employee.role === 'field_agent') {
      where += ' AND (t.assigned_to = ? OR t.created_by = ?)';
      params.push(req.employee.id, req.employee.id);
    }

    const [summary] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'pending') AS pending,
         SUM(status = 'in_progress') AS in_progress,
         SUM(status = 'completed') AS completed,
         SUM(status = 'cancelled') AS cancelled,
         SUM(due_date < CURDATE() AND status IN ('pending','in_progress')) AS overdue
       FROM tasks t ${where}`,
      params
    );

    const [byEmployee] = await db.query(
      `SELECT e.name,
              COUNT(t.id) AS total,
              SUM(t.status = 'completed') AS completed,
              SUM(t.due_date < CURDATE() AND t.status IN ('pending','in_progress')) AS overdue
       FROM tasks t
       JOIN employees e ON t.assigned_to = e.id
       ${where}
       GROUP BY t.assigned_to ORDER BY total DESC`,
      params
    );

    res.json({
      success: true,
      data: { summary: summary[0], by_employee: byEmployee },
      meta: { from: start, to: end },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/quotations
exports.quotationsReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const start = from || new Date().toISOString().slice(0, 7) + '-01';
    const end   = to   || new Date().toISOString().split('T')[0];

    let where = 'WHERE q.created_at >= ? AND q.created_at <= ?';
    const params = [start + ' 00:00:00', end + ' 23:59:59'];

    const [summary] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'draft') AS draft,
         SUM(status = 'sent') AS sent,
         SUM(status = 'awaiting_response') AS awaiting_response,
         SUM(status = 'received') AS received,
         SUM(status = 'follow_up') AS follow_up,
         SUM(status = 'accepted') AS accepted,
         SUM(status = 'rejected') AS rejected,
         SUM(status = 'closed') AS closed,
         AVG(total_cost) AS avg_cost,
         SUM(total_cost) AS total_value
       FROM quotations q ${where}`,
      params
    );

    const [byHospital] = await db.query(
      `SELECT h.name AS hospital_name,
              COUNT(q.id) AS quotations,
              SUM(q.status = 'accepted') AS accepted,
              SUM(q.total_cost) AS total_value
       FROM quotations q
       LEFT JOIN hospitals h ON q.hospital_id = h.id
       ${where}
       GROUP BY q.hospital_id ORDER BY quotations DESC LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: { summary: summary[0], by_hospital: byHospital },
      meta: { from: start, to: end },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/patients
exports.patientsReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const start = from || new Date().toISOString().slice(0, 7) + '-01';
    const end   = to   || new Date().toISOString().split('T')[0];

    let where = 'WHERE p.created_at >= ? AND p.created_at <= ?';
    const params = [start + ' 00:00:00', end + ' 23:59:59'];

    const [summary] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(completion_status = 'confirmation') AS confirmation,
         SUM(completion_status = 'onboarding') AS onboarding,
         SUM(completion_status = 'docs_complete') AS docs_complete,
         SUM(completion_status = 'travel_planning') AS travel_planning,
         SUM(completion_status = 'appointment') AS appointment,
         SUM(completion_status = 'treatment') AS treatment,
         SUM(completion_status = 'recovery') AS recovery,
         SUM(completion_status = 'completed') AS completed,
         SUM(completion_status = 'on_hold') AS on_hold,
         SUM(completion_status = 'cancelled') AS cancelled,
         AVG(package_value) AS avg_package,
         SUM(package_value) AS total_revenue
       FROM patients p ${where}`,
      params
    );

    const [byCountry] = await db.query(
      `SELECT l.country,
              COUNT(p.id) AS patients,
              SUM(p.completion_status = 'completed') AS completed,
              SUM(p.package_value) AS revenue
       FROM patients p
       JOIN leads l ON p.lead_id = l.id
       ${where}
       GROUP BY l.country ORDER BY patients DESC LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: { summary: summary[0], by_country: byCountry },
      meta: { from: start, to: end },
    });
  } catch (err) { next(err); }
};
