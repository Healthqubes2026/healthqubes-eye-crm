const db = require('../config/database');

// ── POST /api/v1/location/update  (called every 3 min from mobile) ────────────
exports.updateLocation = async (req, res, next) => {
  try {
    const { lat, lng, accuracy, speed, heading, address, battery } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng required.' });
    }

    await db.query(
      `INSERT INTO location_tracking (employee_id, lat, lng, accuracy, speed, heading, address, battery)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.employee.id, lat, lng, accuracy || null, speed || null, heading || null, address || null, battery || null]
    );

    res.json({ success: true, message: 'Location recorded.' });
  } catch (err) { next(err); }
};

// ── GET /api/v1/location/live  (Admin dashboard live map) ─────────────────────
exports.getLiveLocations = async (req, res, next) => {
  try {
    // Latest ping per active employee in last 15 minutes
    const [rows] = await db.query(
      `SELECT
         e.id, e.name, e.phone, e.zone,
         l.lat, l.lng, l.address, l.battery, l.speed,
         l.recorded_at,
         TIMESTAMPDIFF(MINUTE, l.recorded_at, NOW()) AS minutes_ago
       FROM employees e
       JOIN location_tracking l ON l.id = (
         SELECT id FROM location_tracking
         WHERE employee_id = e.id
         ORDER BY recorded_at DESC LIMIT 1
       )
       WHERE e.is_active = 1
         AND e.role = 'field_agent'
         AND l.recorded_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
       ORDER BY l.recorded_at DESC`
    );

    res.json({ success: true, data: rows, meta: { active_count: rows.length } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/location/route/:employeeId  (Today's route for one employee) ──
exports.getEmployeeRoute = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Agents can only see their own route
    if (req.employee.role === 'field_agent' && req.employee.id !== parseInt(employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rows] = await db.query(
      `SELECT lat, lng, address, speed, battery, recorded_at
       FROM location_tracking
       WHERE employee_id = ? AND DATE(recorded_at) = ?
       ORDER BY recorded_at ASC`,
      [employeeId, date]
    );

    // Calculate total distance (Haversine formula in JS)
    let totalKm = 0;
    for (let i = 1; i < rows.length; i++) {
      totalKm += haversine(rows[i - 1].lat, rows[i - 1].lng, rows[i].lat, rows[i].lng);
    }

    res.json({
      success: true,
      data: rows,
      meta: {
        total_pings: rows.length,
        total_distance_km: parseFloat(totalKm.toFixed(2)),
        date,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/location/summary  (Distance per employee per day) ─────────────
exports.getDailySummary = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    let where = 'WHERE DATE(l.recorded_at) = ?';
    const params = [date];

    if (req.employee.role === 'manager') {
      where += ' AND e.manager_id = ?';
      params.push(req.employee.id);
    }

    const [rows] = await db.query(
      `SELECT
         e.id, e.name, e.zone,
         COUNT(l.id) AS total_pings,
         MIN(l.recorded_at) AS first_ping,
         MAX(l.recorded_at) AS last_ping
       FROM employees e
       JOIN location_tracking l ON l.employee_id = e.id
       ${where}
       GROUP BY e.id
       ORDER BY e.name`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── Haversine distance (km) ──────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad(deg) { return (deg * Math.PI) / 180; }
