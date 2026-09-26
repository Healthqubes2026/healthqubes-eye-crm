const router = require('express').Router();
const ctrl   = require('../controllers/patientsController');
const { authenticate, isAdmin, isManagement, isSalesCoordinator, isCaseManager, isAgent } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);

router.get('/list',                      isAgent, ctrl.listPatients);
router.get('/:id',                       isAgent, ctrl.getPatient);
router.post('/add',                      isCaseManager, ctrl.addPatient);
router.put('/:id',                       isCaseManager, ctrl.updatePatient);
router.post('/:id/documents',            isCaseManager, upload.single('document'), ctrl.uploadDocument);
router.put('/documents/:id/verify',      isCaseManager, ctrl.verifyDocument);
router.put('/:id/assign-hospital',       isCaseManager, ctrl.assignHospital);
router.put('/:id/assign-doctor',         isCaseManager, ctrl.assignDoctor);
router.put('/:id/assign',                isCaseManager, ctrl.assignBoth);
router.post('/bulk-assign',              isCaseManager, ctrl.bulkAssign);
router.post('/:id/notify-assignment',    isCaseManager, ctrl.notifyAssignment);

module.exports = router;