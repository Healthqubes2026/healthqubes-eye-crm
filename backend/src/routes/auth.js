// routes/auth.js
const router = require('express').Router();
const ctrl   = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login',          ctrl.login);
router.post('/otp',            ctrl.sendOtp);
router.post('/verify',         ctrl.verifyOtp);
router.post('/refresh',        ctrl.refreshToken);
router.post('/logout',         authenticate, ctrl.logout);
router.post('/reset-password', ctrl.resetPassword);

module.exports = router;
