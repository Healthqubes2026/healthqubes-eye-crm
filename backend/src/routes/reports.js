const router = require('express').Router();
const ctrl   = require('../controllers/reportsController');
const { authenticate, isManagement } = require('../middleware/auth');

router.use(authenticate);

router.get('/attendance',  ctrl.attendanceReport);
router.get('/sales',       ctrl.salesReport);
router.get('/leads',       ctrl.leadsReport);
router.get('/performance', isManagement, ctrl.performanceReport);
router.get('/tasks',       ctrl.tasksReport);
router.get('/quotations',  ctrl.quotationsReport);
router.get('/patients',    ctrl.patientsReport);

module.exports = router;
