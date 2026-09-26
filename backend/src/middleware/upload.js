const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.uploadFolder || 'misc';
    const dir = path.join(process.env.UPLOAD_PATH || './uploads', folder);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain').split(',');
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
});

// Middleware factories
const uploadSelfie  = (req, res, next) => { req.uploadFolder = 'selfies';  next(); };
const uploadReports = (req, res, next) => { req.uploadFolder = 'reports';  next(); };
const uploadPhotos  = (req, res, next) => { req.uploadFolder = 'meetings'; next(); };

module.exports = { upload, uploadSelfie, uploadReports, uploadPhotos };
