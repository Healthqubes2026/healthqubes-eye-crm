const axios = require('axios');
const db = require('../config/database');

const FACEBOOK_API_VERSION = 'v18.0';
const FACEBOOK_BASE_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

/**
 * Fetch leads from Facebook Lead Ad Form
 * @param {string} formId - Facebook Lead Form ID
 * @param {string} accessToken - Facebook Access Token
 * @returns {Promise<Array>} Array of leads
 */
exports.fetchLeadsFromFacebook = async (formId, accessToken) => {
  try {
    console.log(`📲 Fetching leads from Facebook form: ${formId}`);

    const response = await axios.get(
      `${FACEBOOK_BASE_URL}/${formId}/leads`,
      {
        params: { access_token: accessToken },
        headers: { 'User-Agent': 'HealthQubes-CRM/1.0' }
      }
    );

    const leads = response.data.data || [];
    console.log(`✅ Fetched ${leads.length} leads from Facebook`);
    return leads;
  } catch (err) {
    console.error('❌ Facebook API Error:', err.message);
    throw new Error(`Facebook API Error: ${err.message}`);
  }
};

/**
 * Fetch lead details from Facebook Lead Ad
 * @param {string} leadgenId - Facebook Lead Gen ID
 * @param {string} accessToken - Facebook Access Token
 * @returns {Promise<Object>} Lead details
 */
exports.fetchLeadDetails = async (leadgenId, accessToken) => {
  try {
    console.log(`📲 Fetching lead details for: ${leadgenId}`);

    const response = await axios.get(
      `${FACEBOOK_API_VERSION}/${leadgenId}`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,created_time,field_data'
        },
        headers: { 'User-Agent': 'HealthQubes-CRM/1.0' }
      }
    );

    console.log(`✅ Fetched lead details for: ${leadgenId}`);
    return response.data;
  } catch (err) {
    console.error('❌ Facebook API Error fetching lead details:', err.message);
    throw new Error(`Facebook API Error: ${err.message}`);
  }
};

/**
 * Validate Facebook webhook signature
 * @param {string} payload - Request body as string
 * @param {string} signature - X-Hub-Signature header
 * @param {string} secret - App secret
 * @returns {boolean} True if valid
 */
exports.validateWebhookSignature = (payload, signature, secret) => {
  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedSignature = `sha256=${hash}`;
    return signature === expectedSignature;
  } catch (err) {
    console.error('Signature validation error:', err.message);
    return false;
  }
};

/**
 * Parse Facebook lead webhook data
 * @param {Object} webhookData - Webhook payload
 * @returns {Object} Parsed lead data
 */
exports.parseLeadWebhookData = (webhookData) => {
  try {
    const lead = {
      name: null,
      phone: null,
      email: null,
      country: null,
      treatment_requirement: null,
      medical_category: null,
      utm_source: 'facebook',
      utm_medium: 'lead_form'
    };

    const fieldData = webhookData.field_data || [];

    fieldData.forEach(field => {
      const name = field.name?.toLowerCase();
      const value = field.value;

      if (name?.includes('name')) lead.name = value;
      if (name?.includes('phone') || name?.includes('mobile')) lead.phone = value;
      if (name?.includes('email')) lead.email = value;
      if (name?.includes('country')) lead.country = value;
      if (name?.includes('treatment') || name?.includes('service')) lead.treatment_requirement = value;
    });

    return lead;
  } catch (err) {
    console.error('Error parsing webhook data:', err.message);
    return null;
  }
};

/**
 * Check if lead already exists (duplicate detection)
 * @param {string} phone - Phone number
 * @param {string} email - Email address
 * @returns {Promise<Object|null>} Existing lead or null
 */
exports.checkDuplicateLead = async (phone, email) => {
  try {
    let query = 'SELECT id, patient_name, phone, email FROM leads WHERE is_duplicate = FALSE AND (1=0';

    if (phone) {
      query += ' OR phone = ?';
    }
    if (email) {
      query += ' OR email = ?';
    }
    query += ')';

    const params = [];
    if (phone) params.push(phone);
    if (email) params.push(email);

    const [rows] = await db.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('Error checking duplicate:', err.message);
    throw err;
  }
};

/**
 * Create lead from ad webhook data
 * @param {Object} leadData - Lead data from webhook
 * @param {Object} campaignData - Campaign metadata
 * @returns {Promise<Object>} Created lead
 */
exports.createLeadFromAd = async (leadData, campaignData) => {
  try {
    const {
      name,
      phone,
      email,
      country,
      treatment_requirement,
      utm_source,
      utm_medium,
      utm_campaign
    } = leadData;

    // Check for duplicates
    const existing = await this.checkDuplicateLead(phone, email);
    if (existing) {
      console.log(`⚠️  Duplicate lead found: ${existing.id}`);
      return { isDuplicate: true, existingLeadId: existing.id };
    }

    // Get coordinator ID (round-robin or random)
    const [coordinators] = await db.query(
      `SELECT id FROM employees WHERE role = 'sales_coordinator' LIMIT 1`
    );

    if (!coordinators.length) {
      throw new Error('No sales coordinator available for assignment');
    }

    const coordinatorId = coordinators[0].id;

    // Create lead
    const [result] = await db.query(
      `INSERT INTO leads (
        patient_name, phone, email, country, medical_category,
        stage, source, assigned_to, created_by,
        ad_source, ad_campaign, utm_source, utm_medium, utm_campaign
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name || 'Unnamed Lead',
        phone || null,
        email || null,
        country || null,
        treatment_requirement || null,
        'new_lead',
        'ad',
        coordinatorId,
        coordinatorId,
        campaignData.platform || 'unknown',
        campaignData.campaign_name || null,
        utm_source || null,
        utm_medium || null,
        utm_campaign || null
      ]
    );

    // Create ad campaign record
    if (campaignData.integration_id) {
      await db.query(
        `INSERT INTO ad_campaigns (
          lead_id, integration_id, platform, campaign_id, campaign_name,
          ad_set_id, ad_set_name, ad_id, ad_name, form_id, form_name,
          utm_source, utm_medium, utm_campaign
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          campaignData.integration_id,
          campaignData.platform,
          campaignData.campaign_id,
          campaignData.campaign_name,
          campaignData.ad_set_id || null,
          campaignData.ad_set_name || null,
          campaignData.ad_id || null,
          campaignData.ad_name || null,
          campaignData.form_id || null,
          campaignData.form_name || null,
          utm_source,
          utm_medium,
          utm_campaign
        ]
      );
    }

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      [
        'lead',
        result.insertId,
        coordinatorId,
        'created_from_ad',
        `Lead created from ${campaignData.platform} ad: ${campaignData.campaign_name}`
      ]
    );

    console.log(`✅ Lead created: ${result.insertId}`);
    return { success: true, leadId: result.insertId, coordinatorId };
  } catch (err) {
    console.error('Error creating lead from ad:', err.message);
    throw err;
  }
};

/**
 * Log webhook event
 * @param {number} integrationId
 * @param {string} eventType
 * @param {Object} payload
 * @param {string} status
 * @param {string} errorMessage
 * @param {number} leadId
 */
exports.logWebhookEvent = async (integrationId, eventType, payload, status = 'success', errorMessage = null, leadId = null) => {
  try {
    await db.query(
      `INSERT INTO webhook_logs (integration_id, event_type, payload, status, error_message, lead_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        integrationId,
        eventType,
        JSON.stringify(payload),
        status,
        errorMessage,
        leadId
      ]
    );
  } catch (err) {
    console.error('Error logging webhook:', err.message);
  }
};

/**
 * Get integration by platform ID
 * @param {string} platformId
 * @returns {Promise<Object|null>}
 */
exports.getIntegrationByPlatformId = async (platformId) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ad_integrations WHERE platform_id = ? AND is_active = TRUE',
      [platformId]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('Error fetching integration:', err.message);
    return null;
  }
};
