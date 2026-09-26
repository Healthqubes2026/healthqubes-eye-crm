const db = require('../config/database');
const axios = require('axios');

// ── POST /api/v1/ad-integrations/connect-facebook ──────────────────────────
exports.connectFacebook = async (req, res, next) => {
  try {
    const { businessId, accessToken } = req.body;

    if (!businessId || !accessToken) {
      return res.status(400).json({ success: false, message: 'businessId and accessToken required' });
    }

    // Verify token with Facebook API
    try {
      await axios.get('https://graph.facebook.com/me', {
        params: { access_token: accessToken }
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid Facebook token' });
    }

    const [result] = await db.query(
      `INSERT INTO ad_integrations (type, platform_id, business_id, access_token,  is_active, created_by)
       VALUES (?, ?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token), is_active = TRUE, updated_at = NOW()`,
      ['facebook', businessId, businessId, accessToken, req.employee.id]
    );

    res.status(201).json({
      success: true,
      message: 'Facebook integrated successfully',
      data: {
        integrationId: result.insertId || result.id,
        platform: 'facebook',
        businessId
      }
    });
  } catch (err) {
    console.error('Facebook integration error:', err.message);
    next(err);
  }
};

// ── POST /api/v1/ad-integrations/connect-google ───────────────────────────
exports.connectGoogle = async (req, res, next) => {
  try {
    const { customerId, accessToken, refreshToken } = req.body;

    if (!customerId || !accessToken) {
      return res.status(400).json({ success: false, message: 'customerId and accessToken required' });
    }

    // Verify token with Google API
    try {
      await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }

    const config = {
      customer_id: customerId,
      refresh_token: refreshToken
    };

    const [result] = await db.query(
      `INSERT INTO ad_integrations (type, platform_id, access_token, config, is_active, created_by)
       VALUES (?, ?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token), config = VALUES(config), is_active = TRUE, updated_at = NOW()`,
      ['google_ads', customerId, accessToken, JSON.stringify(config), req.employee.id]
    );

    res.status(201).json({
      success: true,
      message: 'Google Ads integrated successfully',
      data: {
        integrationId: result.insertId || result.id,
        platform: 'google_ads',
        customerId
      }
    });
  } catch (err) {
    console.error('Google integration error:', err.message);
    next(err);
  }
};

// ── GET /api/v1/ad-integrations ───────────────────────────────────────────
exports.listIntegrations = async (req, res, next) => {
  try {
    const [integrations] = await db.query(
      `SELECT id, type, platform_id, business_id, is_active, last_sync, created_at, updated_at
       FROM ad_integrations
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: integrations
    });
  } catch (err) {
    console.error('Error fetching integrations:', err.message);
    next(err);
  }
};

// ── GET /api/v1/ad-integrations/:id ──────────────────────────────────────
exports.getIntegration = async (req, res, next) => {
  try {
    const [integrations] = await db.query(
      `SELECT id, type, platform_id, business_id, is_active, last_sync, created_at, updated_at
       FROM ad_integrations
       WHERE id = ?`,
      [req.params.id]
    );

    if (!integrations.length) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    res.json({
      success: true,
      data: integrations[0]
    });
  } catch (err) {
    console.error('Error fetching integration:', err.message);
    next(err);
  }
};

// ── DELETE /api/v1/ad-integrations/:id ───────────────────────────────────
exports.disconnectIntegration = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE ad_integrations SET is_active = FALSE WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Integration disconnected'
    });
  } catch (err) {
    console.error('Error disconnecting integration:', err.message);
    next(err);
  }
};

// ── GET /api/v1/ad-leads/stats ───────────────────────────────────────────
exports.getLeadStats = async (req, res, next) => {
  try {
    const { from_date, to_date, platform } = req.query;

    let where = 'WHERE source = "ad"';
    const params = [];

    if (from_date) {
      where += ' AND DATE(created_at) >= ?';
      params.push(from_date);
    }

    if (to_date) {
      where += ' AND DATE(created_at) <= ?';
      params.push(to_date);
    }

    if (platform) {
      where += ' AND ad_source = ?';
      params.push(platform);
    }

    // Total leads by source
    const [sourceStats] = await db.query(
      `SELECT ad_source, COUNT(*) as count
       FROM leads
       ${where}
       GROUP BY ad_source`,
      params
    );

    // Total leads by campaign
    const [campaignStats] = await db.query(
      `SELECT ac.campaign_name, ac.platform, COUNT(l.id) as count
       FROM ad_campaigns ac
       LEFT JOIN leads l ON ac.lead_id = l.id
       WHERE l.source = "ad"
       ${from_date ? 'AND DATE(l.created_at) >= ?' : ''}
       ${to_date ? 'AND DATE(l.created_at) <= ?' : ''}
       GROUP BY ac.campaign_id, ac.platform`,
      params
    );

    // Total leads by status
    const [statusStats] = await db.query(
      `SELECT stage, COUNT(*) as count
       FROM leads
       ${where}
       GROUP BY stage`,
      params
    );

    // Summary
    const [summaryData] = await db.query(
      `SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN stage = 'converted_to_patient' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN stage = 'qualified' THEN 1 ELSE 0 END) as qualified
       FROM leads
       ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalLeads: summaryData[0]?.total_leads || 0,
          converted: summaryData[0]?.converted || 0,
          qualified: summaryData[0]?.qualified || 0,
          conversionRate: summaryData[0]?.total_leads
            ? ((summaryData[0]?.converted / summaryData[0]?.total_leads) * 100).toFixed(2) + '%'
            : '0%'
        },
        bySource: sourceStats,
        byCampaign: campaignStats,
        byStatus: statusStats
      }
    });
  } catch (err) {
    console.error('Error fetching lead stats:', err.message);
    next(err);
  }
};

// ── GET /api/v1/ad-leads ──────────────────────────────────────────────────
exports.listAdLeads = async (req, res, next) => {
  try {
    const { source, campaign, stage, page = 1, limit = 20 } = req.query;

    let where = 'WHERE l.source = "ad"';
    const params = [];

    if (source) {
      where += ' AND l.ad_source = ?';
      params.push(source);
    }

    if (campaign) {
      where += ' AND ac.campaign_name LIKE ?';
      params.push(`%${campaign}%`);
    }

    if (stage) {
      where += ' AND l.stage = ?';
      params.push(stage);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [leads] = await db.query(
      `SELECT
        l.id, l.patient_name, l.phone, l.email, l.stage, l.created_at,
        l.ad_source, ac.campaign_name, ac.platform,
        e.name as assigned_to_name
       FROM leads l
       LEFT JOIN ad_campaigns ac ON l.id = ac.lead_id
       LEFT JOIN employees e ON l.assigned_to = e.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT l.id) AS total FROM leads l
       LEFT JOIN ad_campaigns ac ON l.id = ac.lead_id
       ${where}`,
      params
    );

    res.json({
      success: true,
      data: leads,
      meta: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    console.error('Error listing ad leads:', err.message);
    next(err);
  }
};

// ── GET /api/v1/ad-leads/:id ──────────────────────────────────────────────
exports.getAdLeadDetail = async (req, res, next) => {
  try {
    const [leads] = await db.query(
      `SELECT l.*, ac.*, e.name as assigned_to_name
       FROM leads l
       LEFT JOIN ad_campaigns ac ON l.id = ac.lead_id
       LEFT JOIN employees e ON l.assigned_to = e.id
       WHERE l.id = ? AND l.source = "ad"`,
      [req.params.id]
    );

    if (!leads.length) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({
      success: true,
      data: leads[0]
    });
  } catch (err) {
    console.error('Error fetching lead detail:', err.message);
    next(err);
  }
};

// ── GET /api/v1/ad-integrations/:id/webhook-url ──────────────────────────
exports.getWebhookUrl = async (req, res, next) => {
  try {
    const [integrations] = await db.query(
      'SELECT type FROM ad_integrations WHERE id = ?',
      [req.params.id]
    );

    if (!integrations.length) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const baseUrl = process.env.APP_URL || 'https://api.healthqubes.com';
    const platform = integrations[0].type;

    const webhookUrl = `${baseUrl}/webhooks/${platform}/leads`;

    res.json({
      success: true,
      data: {
        webhookUrl,
        platform,
        instructions: getWebhookInstructions(platform, req.params.id)
      }
    });
  } catch (err) {
    console.error('Error generating webhook URL:', err.message);
    next(err);
  }
};

function getWebhookInstructions(platform, integrationId) {
  if (platform === 'facebook') {
    return {
      provider: 'Facebook',
      steps: [
        '1. Go to Facebook Developer Console → Your App',
        '2. Navigate to Webhooks under Messenger',
        '3. Set Call back URL: [webhookUrl]',
        '4. Verify Token: Set any secure random token',
        '5. Subscribe to webhook_event fields: lead_gen',
        '6. For Lead Forms: Page subscription required with lead_gen permission'
      ]
    };
  } else if (platform === 'google_ads') {
    return {
      provider: 'Google Ads',
      steps: [
        '1. Set up Google Lead Form with webhook',
        '2. Configure notification URL: [webhookUrl]',
        '3. Add Bearer token in request headers',
        '4. Test webhook connectivity',
        '5. Enable real-time lead notifications in campaign settings'
      ]
    };
  }
  return null;
}
