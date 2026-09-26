const router = require('express').Router();
const ctrl   = require('../controllers/attendanceController');
const { authenticate, isManagement } = require('../middleware/auth');
const { upload, uploadSelfie }    = require('../middleware/upload');

router.use(authenticate);

router.post('/checkin',  uploadSelfie, upload.single('selfie'), ctrl.checkIn);
router.put('/checkout',  ctrl.checkOut);
router.get('/today',     ctrl.getToday);
router.get('/history',   ctrl.getHistory);
router.get('/team',      isManagement, ctrl.getTeamAttendance);
router.post('/leave',    ctrl.applyLeave);
router.get('/leaves',    isManagement, ctrl.getLeaves);
router.put('/leaves/:id/approve', isManagement, ctrl.approveLeave);
router.put('/leaves/:id/reject',  isManagement, ctrl.rejectLeave);

const additions = require('./attendance-additions');
router.use('/', additions);


module.exports = router;

