const router = require('express').Router();
const ctrl   = require('../controllers/emailController');
const { authenticate, isAdmin, isManagement, isSalesCoordinator, isCaseManager } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);

router.post('/send-patient-summary', upload.array('attachments', 10), isCaseManager, ctrl.sendPatientSummary);
router.post('/send-to-hospital', upload.array('attachments', 10), isManagement, ctrl.sendToHospital);
router.post('/send-to-doctor', upload.array('attachments', 10), isManagement, ctrl.sendToDoctor);
router.get('/logs',                   isCaseManager, ctrl.getEmailLogs);

module.exports = router;