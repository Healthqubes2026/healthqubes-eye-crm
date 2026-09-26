const router = require('express').Router();
const ctrl = require('../controllers/whatsappController');
const { authenticate, isManagement, isSalesCoordinator, isCaseManager } = require('../middleware/auth');

router.use(authenticate);

// ── Webhook (NO AUTH - called by Twilio) ────────────────────────────────────
router.post('/webhook', ctrl.handleIncomingMessage);

// ── Send messages ────────────────────────────────────────────────────────────
router.post('/send', isManagement, ctrl.sendMessage);
router.post('/send-bulk', isManagement, ctrl.sendBulkMessages);

// ── Lead communication ─────────────────────────────────────────────────────
router.post('/leads/:id/welcome', isSalesCoordinator, ctrl.sendLeadWelcome);
router.post('/leads/:id/followup-reminder', isSalesCoordinator, ctrl.sendFollowupReminder);

// ── Quotation communication ────────────────────────────────────────────────
router.post('/quotations/:id/send', isSalesCoordinator, ctrl.sendQuotation);

// ── Patient communication ──────────────────────────────────────────────────
router.post('/patients/:id/hospital-assignment', isCaseManager, ctrl.sendHospitalAssignment);
router.post('/patients/:id/visa-update', isCaseManager, ctrl.sendVisaUpdate);
router.post('/patients/:id/admission-confirmation', isCaseManager, ctrl.sendAdmissionConfirmation);
router.post('/patients/:id/discharge-care', isCaseManager, ctrl.sendDischargeCareInstructions);

// ── Message logs ───────────────────────────────────────────────────────────
router.get('/logs', isManagement, ctrl.getMessageLogs);
router.get('/logs/:id', isManagement, ctrl.getMessageLog);
router.get('/status/:sid', isManagement, ctrl.getMessageStatus);

// ── Settings ───────────────────────────────────────────────────────────────
router.get('/settings', isManagement, ctrl.getSettings);
router.put('/settings', isManagement, ctrl.updateSettings);

module.exports = router;
