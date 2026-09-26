const router = require('express').Router();
const ctrl   = require('../controllers/manualAttendanceController');
const { authenticate, isAdmin, isManagement } = require('../middleware/auth');

router.use(authenticate);

router.get('/employees',   isManagement, ctrl.getEmployeeList);
router.post('/',           isManagement, ctrl.addManual);
router.put('/:id',         isManagement, ctrl.overrideManual);
router.get('/logs',        isManagement, ctrl.getLogs);
router.post('/bulk',       isAdmin,   ctrl.bulkUpload);

module.exports = router;
