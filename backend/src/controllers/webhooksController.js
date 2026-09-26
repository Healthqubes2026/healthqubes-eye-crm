const facebookService = require('../services/facebookLeadsService');
const googleService = require('../services/googleLeadsService');
const db = require('../config/database');

// ── GET /api/v1/webhooks/facebook/leads (Verification) ─────────────────────
exports.facebookWebhookVerify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log('✅ Facebook webhook verified');
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
};

// ── POST /api/v1/webhooks/facebook/leads ───────────────────────────────────
exports.facebookWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.rawBody; // Must be raw body string, not parsed JSON

    // Verify webhook signature
    const secret = process.env.FACEBOOK_APP_SECRET;
    if (!facebookService.validateWebhookSignature(payload, signature, secret)) {
      console.warn('⚠️  Invalid Facebook webhook signature');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;

    // Handle leadgen events
    if (event.object === 'page' && event.entry) {
      for (const entry of event.entry) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            await handleFacebookLeadGenEvent(change.value, entry);
          }
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Facebook webhook error:', err.message);
    next(err);
  }
};

// ── Get Facebook Lead Form data (manual sync) ───────────────────────────────
exports.syncFacebookLeads = async (req, res, next) => {
  try {
    const { integrationId, formId } = req.body;

    if (!integrationId || !formId) {
      return res.status(400).json({ success: false, message: 'integrationId and formId required' });
    }

    // Get integration
    const [integrations] = await db.query(
      'SELECT * FROM ad_integrations WHERE id = ? AND type = "facebook"',
      [integrationId]
    );

    if (!integrations.length) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const integration = integrations[0];

    // Fetch leads from Facebook
    const leads = await facebookService.fetchLeadsFromFacebook(formId, integration.access_token);
    let successCount = 0;
    let duplicateCount = 0;

    for (const lead of leads) {
      try {
        // Parse lead data
        const leadData = facebookService.parseLeadWebhookData(lead);

        if (!leadData.name && !leadData.email && !leadData.phone) {
          console.log('⏭️  Skipping lead with no contact info');
          continue;
        }

        // Create lead
        const result = await facebookService.createLeadFromAd(leadData, {
          integration_id: integrationId,
          platform: 'facebook',
          form_id: formId,
          campaign_name: `Facebook Lead Form: ${formId}`,
          utm_source: 'facebook',
          utm_medium: 'lead_form'
        });

        if (result.isDuplicate) {
          duplicateCount++;
          await facebookService.logWebhookEvent(integrationId, 'lead_gen', lead, 'duplicate');
        } else {
          successCount++;
          await facebookService.logWebhookEvent(integrationId, 'lead_gen', lead, 'success', null, result.leadId);
          // Send notification
          await notifyNewLead(result.leadId, result.coordinatorId);
        }
      } catch (err) {
        console.error('Error processing lead:', err.message);
        await facebookService.logWebhookEvent(integrationId, 'lead_gen', lead, 'failed', err.message);
      }
    }

    // Update last sync
    await db.query('UPDATE ad_integrations SET last_sync = NOW() WHERE id = ?', [integrationId]);

    res.json({
      success: true,
      data: {
        total: leads.length,
        created: successCount,
        duplicates: duplicateCount
      }
    });
  } catch (err) {
    console.error('Sync error:', err.message);
    next(err);
  }
};

// ── POST /api/v1/webhooks/google/leads ─────────────────────────────────────
exports.googleWebhook = async (req, res, next) => {
  try {
    // Google Lead Forms typically send data directly without JWT
    // They may use a secret key in the URL or headers for verification
    const secret = req.query.secret || req.headers['x-google-secret'];

    if (process.env.GOOGLE_WEBHOOK_SECRET && secret !== process.env.GOOGLE_WEBHOOK_SECRET) {
      console.warn('⚠️  Invalid Google webhook secret');
      return res.status(401).json({ success: false, message: 'Invalid secret' });
    }

    const leadData = req.body;

    // Handle lead submission
    await handleGoogleLeadEvent(leadData);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Google webhook error:', err.message);
    next(err);
  }
};

// ── POST /api/v1/webhooks/google/leads/sync ────────────────────────────────
exports.syncGoogleLeads = async (req, res, next) => {
  try {
    const { integrationId, customerId } = req.body;

    if (!integrationId || !customerId) {
      return res.status(400).json({ success: false, message: 'integrationId and customerId required' });
    }

    // Get integration
    const [integrations] = await db.query(
      'SELECT * FROM ad_integrations WHERE id = ? AND type = "google_ads"',
      [integrationId]
    );

    if (!integrations.length) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    // Note: Actual Google Ads API sync would require proper OAuth setup
    // This is a placeholder for the integration point
    console.log('Google Ads sync initiated for customer:', customerId);

    res.json({
      success: true,
      message: 'Google Ads sync initiated. Check webhook logs for updates.',
      data: {
        integrationId,
        status: 'queued'
      }
    });
  } catch (err) {
    console.error('Google sync error:', err.message);
    next(err);
  }
};

// ── Internal handler for Facebook lead gen events ─────────────────────────────
async function handleFacebookLeadGenEvent(leadValue, entry) {
  try {
    const leadgenId = leadValue.leadgen_id;
    const formId = leadValue.form_id;
    const adId = leadValue.ad_id;

    console.log(`📲 Facebook Lead Gen Event - Lead: ${leadgenId}, Form: ${formId}`);

    // Get integration by form ID or active Facebook integration
    const integration = await facebookService.getIntegrationByPlatformId(formId) ||
                        (await db.query('SELECT * FROM ad_integrations WHERE type = "facebook" AND is_active = TRUE LIMIT 1'))[0]?.[0];

    if (!integration) {
      console.warn('⚠️  No active Facebook integration found');
      return;
    }

    // Fetch lead details from Facebook API
    const leadDetails = await facebookService.fetchLeadDetails(leadgenId, integration.access_token);

    if (!leadDetails) {
      console.warn('⚠️  Could not fetch lead details from Facebook');
      await facebookService.logWebhookEvent(integration.id, 'lead_gen', leadValue, 'failed', 'Could not fetch lead details');
      return;
    }

    // Parse lead data
    const leadData = facebookService.parseLeadWebhookData(leadDetails);

    if (!leadData.name && !leadData.email && !leadData.phone) {
      console.log('⏭️  Skipping lead with no contact info');
      await facebookService.logWebhookEvent(integration.id, 'lead_gen', leadValue, 'skipped', 'No contact info');
      return;
    }

    // Create lead
    const result = await facebookService.createLeadFromAd(leadData, {
      integration_id: integration.id,
      platform: 'facebook',
      form_id: formId,
      campaign_name: `Facebook Lead Form: ${formId}`,
      ad_id: adId,
      leadgen_id: leadgenId
    });

    if (result.success) {
      await facebookService.logWebhookEvent(integration.id, 'lead_gen', leadValue, 'success', null, result.leadId);
      await notifyNewLead(result.leadId, result.coordinatorId);
    } else if (result.isDuplicate) {
      await facebookService.logWebhookEvent(integration.id, 'lead_gen', leadValue, 'duplicate');
    }
  } catch (err) {
    console.error('Error handling Facebook lead event:', err.message);
  }
}

// ── Internal handler for Google lead events ──────────────────────────────────
async function handleGoogleLeadEvent(webhookData) {
  try {
    const formId = webhookData.form_id || webhookData.lead_id;
    const campaignId = webhookData.campaign_id;

    console.log(`🔍 Google Lead Event - Form: ${formId}, Campaign: ${campaignId}`);

    // Get integration by form ID or active Google integration
    const integration = await googleService.getIntegrationByPlatformId(formId) ||
                        (await db.query('SELECT * FROM ad_integrations WHERE type = "google_ads" AND is_active = TRUE LIMIT 1'))[0]?.[0];

    if (!integration) {
      console.warn('⚠️  No active Google integration found');
      return;
    }

    // Parse lead data
    const leadData = googleService.parseLeadWebhookData(webhookData);

    if (!leadData.name && !leadData.email && !leadData.phone) {
      console.log('⏭️  Skipping Google lead with no contact info');
      await googleService.logWebhookEvent(integration.id, 'lead_gen', webhookData, 'skipped', 'No contact info');
      return;
    }

    // Create lead
    const result = await googleService.createLeadFromAd(leadData, {
      integration_id: integration.id,
      platform: 'google_leads',
      campaign_id: campaignId,
      campaign_name: `Google Lead Form: ${formId}`,
      form_id: formId,
      gclid: leadData.gclid
    });

    if (result.success) {
      await googleService.logWebhookEvent(integration.id, 'lead_gen', webhookData, 'success', null, result.leadId);
      await notifyNewLead(result.leadId, result.coordinatorId);
    } else if (result.isDuplicate) {
      await googleService.logWebhookEvent(integration.id, 'lead_gen', webhookData, 'duplicate');
    }
  } catch (err) {
    console.error('Error handling Google lead event:', err.message);
  }
}

// ── Send real-time notification for new lead ──────────────────────────────────
async function notifyNewLead(leadId, coordinatorId) {
  try {
    // Get lead details
    const [leads] = await db.query(
      'SELECT id, patient_name, phone, email, ad_source FROM leads WHERE id = ?',
      [leadId]
    );

    if (!leads.length) return;

    const lead = leads[0];

    // Send in-app notification
    await db.query(
      `INSERT INTO notifications (employee_id, title, message, type, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        coordinatorId,
        'New Lead from Ad',
        `${lead.patient_name} (${lead.ad_source}) - ${lead.phone || lead.email}`,
        'lead_created',
        leadId,
        'lead'
      ]
    );

    // TODO: Send email notification to coordinator
    console.log(`✅ Notification sent to coordinator ${coordinatorId} for lead ${leadId}`);
  } catch (err) {
    console.error('Error sending notification:', err.message);
  }
}

// ── GET /api/v1/ad-integrations/logs ─────────────────────────────────────────
exports.getWebhookLogs = async (req, res, next) => {
  try {
    const { status, integration_id, page = 1, limit = 50 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (integration_id) {
      where += ' AND integration_id = ?';
      params.push(integration_id);
    }

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [logs] = await db.query(
      `SELECT wl.*, ai.type as platform FROM webhook_logs wl
       LEFT JOIN ad_integrations ai ON wl.integration_id = ai.id
       ${where}
       ORDER BY wl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM webhook_logs ${where}`,
      params
    );

    res.json({
      success: true,
      data: logs,
      meta: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    console.error('Error fetching webhook logs:', err.message);
    next(err);
  }
};
