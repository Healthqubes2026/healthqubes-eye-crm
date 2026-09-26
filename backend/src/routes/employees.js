const router = require('express').Router();
const ctrl   = require('../controllers/employeesController');
const { authenticate, isAdmin, isManagement } = require('../middleware/auth');
const { upload, uploadSelfie } = require('../middleware/upload');

router.use(authenticate);

router.get('/me',              ctrl.getMe);
router.put('/me/fcm-token',    ctrl.updateFcmToken);
router.get('/list',            isManagement, ctrl.listEmployees);
router.post('/add',            isAdmin, ctrl.addEmployee);
router.get('/:id',             isManagement, ctrl.getEmployee);
router.put('/:id',             ctrl.updateEmployee);

module.exports = router;
