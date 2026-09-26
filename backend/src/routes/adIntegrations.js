const router = require('express').Router();
const adIntegrations = require('../controllers/adIntegrationsController');
const webhooks = require('../controllers/webhooksController');
const { authenticate } = require('../middleware/auth');
const bodyParser = require('body-parser');

// Store raw body for webhook signature verification
const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

// ── AD INTEGRATIONS ROUTES (Authenticated) ───────────────────────────────
router.post('/integrations/connect-facebook', authenticate, adIntegrations.connectFacebook);
router.post('/integrations/connect-google', authenticate, adIntegrations.connectGoogle);
router.get('/integrations', authenticate, adIntegrations.listIntegrations);
router.get('/integrations/:id', authenticate, adIntegrations.getIntegration);
router.delete('/integrations/:id', authenticate, adIntegrations.disconnectIntegration);
router.get('/integrations/:id/webhook-url', authenticate, adIntegrations.getWebhookUrl);

// ── AD LEADS ROUTES ──────────────────────────────────────────────────────
router.get('/leads', authenticate, adIntegrations.listAdLeads);
router.get('/leads/:id', authenticate, adIntegrations.getAdLeadDetail);
router.get('/leads/stats', authenticate, adIntegrations.getLeadStats);

// ── WEBHOOK ROUTES (No authentication - signed verification instead) ────────
// Facebook Lead Ads webhook
router.get('/webhooks/facebook/leads', webhooks.facebookWebhookVerify);
router.post(
  '/webhooks/facebook/leads',
  bodyParser.json({ verify: rawBodySaver }),
  webhooks.facebookWebhook
);

// Manual Facebook sync endpoint (authenticated)
router.post('/webhooks/facebook/sync', authenticate, webhooks.syncFacebookLeads);

// Google Lead Forms webhook
router.post(
  '/webhooks/google/leads',
  bodyParser.json({ verify: rawBodySaver }),
  webhooks.googleWebhook
);

// Manual Google sync endpoint (authenticated)
router.post('/webhooks/google/sync', authenticate, webhooks.syncGoogleLeads);

// Get webhook logs (authenticated, admin only)
router.get('/webhooks/logs', authenticate, webhooks.getWebhookLogs);

module.exports = router;
