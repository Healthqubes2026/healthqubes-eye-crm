require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const db = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const meetingRoutes = require('./routes/meetings');
const locationRoutes = require('./routes/location');
const leadRoutes = require('./routes/leads');
const salesRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const employeeRoutes = require('./routes/employees');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const manualAttendanceRoutes = require('./routes/manualAttendance');
const taskRoutes = require('./routes/tasks');
const quotationRoutes = require('./routes/quotations');
const patientRoutes = require('./routes/patients');
const hospitalRoutes = require('./routes/hospitals');
const treatmentCategoryRoutes = require('./routes/treatment-categories');
const emailRoutes = require('./routes/email');
const adIntegrationsRoutes = require('./routes/adIntegrations');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const PORT = process.env.PORT || 5000;
const API = `/api/${process.env.API_VERSION || 'v1'}`;

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.ADMIN_PANEL_URL].filter(Boolean),
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/v1/products', require('./routes/products'));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
// Apply rate limiting to all API routes except webhooks
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1/ads/webhooks/')) {
    return next();
  }
  limiter(req, res, next);
});

// Auth endpoints get stricter limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      app: 'Healthqube Eyes API',
      version: process.env.API_VERSION || 'v1',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/attendance`, attendanceRoutes);
app.use(`${API}/meetings`, meetingRoutes);
app.use(`${API}/location`, locationRoutes);
app.use(`${API}/leads`, leadRoutes);
app.use(`${API}/sales`, salesRoutes);
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/employees`, employeeRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/attendance/manual`, manualAttendanceRoutes);
app.use(`${API}/tasks`, taskRoutes);
app.use(`${API}/quotations`, quotationRoutes);
app.use(`${API}/patients`, patientRoutes);
app.use(`${API}/hospitals`, hospitalRoutes);
app.use(`${API}/treatment-categories`, treatmentCategoryRoutes);
app.use(`${API}/emails`, emailRoutes);
app.use(`${API}/ads`, adIntegrationsRoutes);
app.use(`${API}/whatsapp`, whatsappRoutes);

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     🏥  Healthqube Eyes API Server      ║
  ║     Port    : ${PORT}                        ║
  ║     Env     : ${(process.env.NODE_ENV || 'development').padEnd(12)}            ║
  ║     API     : ${API.padEnd(18)}        ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
