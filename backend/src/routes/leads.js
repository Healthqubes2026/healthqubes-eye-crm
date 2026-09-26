const router = require('express').Router();
const ctrl   = require('../controllers/leadsController');
const { authenticate, isAdmin, isManagement, isSalesCoordinator, isCaseManager, isAgent } = require('../middleware/auth');
const { upload, uploadReports } = require('../middleware/upload');

router.use(authenticate);

router.get('/pipeline',      isManagement, ctrl.getPipeline);
router.get('/followups-due', isManagement, ctrl.getFollowUpsDue);
router.get('/eligible',      isCaseManager, ctrl.listEligibleLeads);
router.post('/add',          isSalesCoordinator, uploadReports, upload.array('reports', 5), ctrl.addLead);
router.get('/list',          isAgent, ctrl.listLeads);
router.get('/:id',           isAgent, ctrl.getLead);
router.put('/:id',           isSalesCoordinator, ctrl.updateLead);
router.post('/:id/activities', isAgent, ctrl.addLeadActivity);
router.put('/:id/status',    isSalesCoordinator, ctrl.updateStatus);
router.post('/:id/convert',  isSalesCoordinator, ctrl.convertLead);
router.post('/send-followup-reminders', isManagement, ctrl.sendFollowUpReminders);

module.exports = router;
