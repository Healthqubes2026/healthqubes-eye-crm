const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../config/database');

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateOTP = () => {
  const len = parseInt(process.env.OTP_LENGTH) || 6;
  return Math.floor(10 ** (len - 1) + Math.random() * 9 * 10 ** (len - 1)).toString();
};

const signTokens = (employee) => {
  const payload = { id: employee.id, uuid: employee.uuid, role: employee.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
};

const safeEmployee = (e) => ({
  id: e.id, uuid: e.uuid, name: e.name, email: e.email,
  phone: e.phone, role: e.role, zone: e.zone,
  profile_photo: e.profile_photo,
});

// ── POST /api/v1/auth/login  (Email + Password) ───────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const [rows] = await db.query(
      'SELECT * FROM employees WHERE email = ? AND is_active = 1', [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const emp = rows[0];
    const valid = await bcrypt.compare(password, emp.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const { accessToken, refreshToken } = signTokens(emp);

    // Persist refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (employee_id, token, expires_at) VALUES (?,?,?)',
      [emp.id, refreshToken, expiresAt]
    );

    // Update last login
    await db.query('UPDATE employees SET last_login = NOW() WHERE id = ?', [emp.id]);

    res.json({
      success: true,
      message: 'Login successful.',
      data: { employee: safeEmployee(emp), accessToken, refreshToken },
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/auth/otp  (Send OTP to mobile) ───────────────────────────────
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number required.' });

    const [rows] = await db.query(
      'SELECT id FROM employees WHERE phone = ? AND is_active = 1', [phone]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Phone number not registered.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);

    // Invalidate any existing OTPs for this phone
    await db.query('UPDATE otp_store SET used = 1 WHERE phone = ? AND used = 0', [phone]);

    await db.query(
      'INSERT INTO otp_store (phone, otp, expires_at) VALUES (?,?,?)',
      [phone, otp, expiresAt]
    );

    // TODO: Integrate SMS provider here
    // await sendSMS(phone, `Your Healthqube Eyes OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES} mins.`);
    console.log(`[OTP] ${phone} → ${otp}`); // Remove in production

    res.json({
      success: true,
      message: `OTP sent to ${phone.slice(0, 3)}****${phone.slice(-3)}.`,
      ...(process.env.NODE_ENV === 'development' && { debug_otp: otp }),
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/auth/verify  (Verify OTP) ────────────────────────────────────
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP required.' });
    }

    const [otpRows] = await db.query(
      'SELECT * FROM otp_store WHERE phone = ? AND otp = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [phone, otp]
    );
    if (!otpRows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await db.query('UPDATE otp_store SET used = 1 WHERE id = ?', [otpRows[0].id]);

    const [empRows] = await db.query(
      'SELECT * FROM employees WHERE phone = ? AND is_active = 1', [phone]
    );
    if (!empRows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const emp = empRows[0];
    const { accessToken, refreshToken } = signTokens(emp);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (employee_id, token, expires_at) VALUES (?,?,?)',
      [emp.id, refreshToken, expiresAt]
    );
    await db.query('UPDATE employees SET last_login = NOW() WHERE id = ?', [emp.id]);

    res.json({
      success: true,
      message: 'OTP verified. Login successful.',
      data: { employee: safeEmployee(emp), accessToken, refreshToken },
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0 AND expires_at > NOW()',
      [refreshToken]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const [empRows] = await db.query(
      'SELECT * FROM employees WHERE id = ? AND is_active = 1', [decoded.id]
    );
    if (!empRows.length) {
      return res.status(401).json({ success: false, message: 'Employee not found.' });
    }

    // Rotate: revoke old, issue new
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [rows[0].id]);
    const { accessToken, refreshToken: newRefresh } = signTokens(empRows[0]);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (employee_id, token, expires_at) VALUES (?,?,?)',
      [empRows[0].id, newRefresh, expiresAt]
    );

    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }
    next(err);
  }
};

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', [refreshToken]);
    }
    // Clear FCM token
    if (req.employee) {
      await db.query('UPDATE employees SET fcm_token = NULL WHERE id = ?', [req.employee.id]);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
};

// ── POST /api/v1/auth/reset-password ─────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { phone, otp, new_password } = req.body;
    if (!phone || !otp || !new_password) {
      return res.status(400).json({ success: false, message: 'Phone, OTP and new password required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const [otpRows] = await db.query(
      'SELECT * FROM otp_store WHERE phone = ? AND otp = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [phone, otp]
    );
    if (!otpRows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE employees SET password_hash = ? WHERE phone = ?', [hash, phone]);
    await db.query('UPDATE otp_store SET used = 1 WHERE id = ?', [otpRows[0].id]);
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE employee_id = (SELECT id FROM employees WHERE phone = ?)', [phone]);

    res.json({ success: true, message: 'Password reset successful. Please login again.' });
  } catch (err) { next(err); }
};
