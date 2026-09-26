const axios = require('axios');
const db = require('../config/database');

const GOOGLE_ADS_API_VERSION = 'v14';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

/**
 * Store Google OAuth credentials
 * @param {string} customerId - Google Ads Customer ID
 * @param {string} accessToken - OAuth Access Token
 * @param {string} refreshToken - OAuth Refresh Token
 * @returns {Promise<Object>} Stored integration
 */
exports.storeGoogleCredentials = async (customerId, accessToken, refreshToken) => {
  try {
    const config = {
      customer_id: customerId,
      access_token: accessToken,
      refresh_token: refreshToken
    };

    const [result] = await db.query(
      `INSERT INTO ad_integrations (type, platform_id, access_token, config, is_active)
       VALUES (?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token), config = VALUES(config), updated_at = NOW()`,
      [
        'google_ads',
        customerId,
        accessToken,
        JSON.stringify(config)
      ]
    );

    return { success: true, integrationId: result.insertId };
  } catch (err) {
    console.error('Error storing Google credentials:', err.message);
    throw err;
  }
};

/**
 * Parse Google Lead Form webhook data
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
      utm_source: 'google',
      utm_medium: 'lead_form',
      utm_campaign: null,
      gclid: null
    };

    // Google Lead Forms send data in user_column_data array
    const userData = webhookData.user_column_data || [];

    userData.forEach(column => {
      const columnName = column.column_name?.toLowerCase();
      const value = column.string_value || column.numeric_value || column.boolean_value;

      if (columnName?.includes('first name') || columnName?.includes('name')) {
        lead.name = value;
      } else if (columnName?.includes('last name')) {
        lead.name = lead.name ? `${lead.name} ${value}` : value;
      } else if (columnName?.includes('full name')) {
        lead.name = value;
      } else if (columnName?.includes('phone') || columnName?.includes('mobile') || columnName?.includes('contact')) {
        lead.phone = value;
      } else if (columnName?.includes('email')) {
        lead.email = value;
      } else if (columnName?.includes('country')) {
        lead.country = value;
      } else if (columnName?.includes('treatment') || columnName?.includes('service') || columnName?.includes('interest')) {
        lead.treatment_requirement = value;
      }
    });

    // Extract campaign data
    lead.gclid = webhookData.gclid;
    lead.utm_campaign = webhookData.campaign_id || webhookData.campaign_name;

    return lead;
  } catch (err) {
    console.error('Error parsing Google webhook data:', err.message);
    return null;
  }
};

/**
 * Validate Google webhook signature using JWT
 * @param {string} token - JWT token from webhook
 * @returns {Object|null} Verified payload or null
 */
exports.validateWebhookSignature = (token) => {
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token, { complete: true });

    // Verify timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const tokenTime = decoded.payload.iat;

    if (Math.abs(now - tokenTime) > 300) {
      console.warn('⚠️  Webhook token timestamp outside acceptable range');
      return null;
    }

    return decoded.payload;
  } catch (err) {
    console.error('Google webhook validation error:', err.message);
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
 * Create lead from Google Ads webhook data
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
        campaignData.platform || 'google_ads',
        campaignData.campaign_name || null,
        utm_source || 'google',
        utm_medium || 'search',
        utm_campaign
      ]
    );

    // Create ad campaign record
    if (campaignData.integration_id) {
      await db.query(
        `INSERT INTO ad_campaigns (
          lead_id, integration_id, platform, campaign_id, campaign_name,
          utm_source, utm_medium, utm_campaign
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          campaignData.integration_id,
          'google_ads',
          campaignData.campaign_id,
          campaignData.campaign_name,
          'google',
          'search',
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
        `Lead created from Google Ads: ${campaignData.campaign_name}`
      ]
    );

    console.log(`✅ Lead created from Google: ${result.insertId}`);
    return { success: true, leadId: result.insertId, coordinatorId };
  } catch (err) {
    console.error('Error creating lead from Google ad:', err.message);
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
    console.error('Error logging Google webhook:', err.message);
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
      'SELECT * FROM ad_integrations WHERE platform_id = ? AND type = ? AND is_active = TRUE',
      [platformId, 'google_ads']
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('Error fetching Google integration:', err.message);
    return null;
  }
};

/**
 * Update last sync timestamp
 * @param {number} integrationId
 */
exports.updateLastSync = async (integrationId) => {
  try {
    await db.query(
      'UPDATE ad_integrations SET last_sync = NOW() WHERE id = ?',
      [integrationId]
    );
  } catch (err) {
    console.error('Error updating last sync:', err.message);
  }
};
