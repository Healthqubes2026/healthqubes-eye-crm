const jwt = require('jsonwebtoken');
const db  = require('../config/database');

// ── Verify JWT Token ──────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh employee data (catches deactivated accounts)
    const [rows] = await db.query(
      'SELECT id, uuid, name, email, phone, role, zone, manager_id, fcm_token, is_active FROM employees WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });
    }

    req.employee = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please refresh.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// ── Role-Based Access Guards ──────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.employee.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}.`,
    });
  }
  next();
};

const isAdmin          = requireRole('admin');
const isManagement     = requireRole('admin', 'management', 'manager');
const isSalesCoordinator = requireRole('admin', 'management', 'manager', 'sales_coordinator');
const isCaseManager    = requireRole('admin', 'management', 'manager', 'case_manager');
const isAgent          = requireRole('admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent');

// ── Ownership guard: agent can only access their own records ─────────────────
const ownOrManager = (paramKey = 'employeeId') => (req, res, next) => {
  const targetId = parseInt(req.params[paramKey] || req.body[paramKey]);
  if (['sales_coordinator', 'case_manager'].includes(req.employee.role) && req.employee.id !== targetId) {
    return res.status(403).json({ success: false, message: 'You can only access your own records.' });
  }
  next();
};

module.exports = { authenticate, requireRole, isAdmin, isManagement, isSalesCoordinator, isCaseManager, isAgent, ownOrManager };
