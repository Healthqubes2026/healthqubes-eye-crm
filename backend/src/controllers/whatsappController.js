const db = require('../config/database');
const { 
  sendWhatsAppMessage, 
  sendLeadWelcome, 
  sendFollowupReminder,
  sendQuotationLink,
  sendHospitalAssignment,
  sendVisaUpdate,
  sendAdmissionConfirmation,
  sendDischargeCareInstructions,
  getMessageStatus,
  sendBulkMessages,
  handleIncomingMessage,
  validateWebhookSignature
} = require('../utils/whatsappService');

// ─────────────────────────────────────────────────────────────────────────────
// SEND CUSTOM MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { phone, message, type } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone and message required.' 
      });
    }

    const result = await sendWhatsAppMessage(phone, message);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Message sent successfully.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send message.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND BULK MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
exports.sendBulkMessages = async (req, res, next) => {
  try {
    const { recipients, message } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipients array required.' 
      });
    }

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message required.' 
      });
    }

    const results = await sendBulkMessages(recipients, message);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return res.status(200).json({
      success: true,
      message: `Bulk messages sent. ${successful} successful, ${failed} failed.`,
      data: {
        total: results.length,
        successful,
        failed,
        results
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND LEAD WELCOME MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendLeadWelcome = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[lead]] = await db.query(
      `SELECT id, patient_name, whatsapp, phone FROM leads WHERE id = ?`,
      [id]
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const phone = lead.whatsapp || lead.phone;
    const result = await sendLeadWelcome(id, phone, lead.patient_name);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Welcome message sent via WhatsApp.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send welcome message.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND FOLLOW-UP REMINDER
// ─────────────────────────────────────────────────────────────────────────────
exports.sendFollowupReminder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[lead]] = await db.query(
      `SELECT id, patient_name, whatsapp, phone, follow_up_date FROM leads WHERE id = ?`,
      [id]
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const phone = lead.whatsapp || lead.phone;
    const followUpDate = new Date(lead.follow_up_date).toLocaleDateString('en-IN');
    
    const result = await sendFollowupReminder(id, phone, lead.patient_name, followUpDate);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Follow-up reminder sent via WhatsApp.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send follow-up reminder.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND QUOTATION LINK
// ─────────────────────────────────────────────────────────────────────────────
exports.sendQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quotationUrl } = req.body;

    if (!quotationUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quotation URL required.' 
      });
    }

    const [[quotation]] = await db.query(
      `SELECT q.id, l.patient_name, l.whatsapp, l.phone 
       FROM quotations q 
       JOIN leads l ON q.lead_id = l.id 
       WHERE q.id = ?`,
      [id]
    );

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const phone = quotation.whatsapp || quotation.phone;
    const result = await sendQuotationLink(id, phone, quotation.patient_name, quotationUrl);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Quotation sent via WhatsApp.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send quotation.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND HOSPITAL ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────
exports.sendHospitalAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[patient]] = await db.query(
      `SELECT p.id, p.patient_name, p.phone, 
              h.name as hospital_name, d.name as doctor_name
       FROM patients p
       LEFT JOIN hospitals h ON p.hospital_id = h.id
       LEFT JOIN doctors d ON p.doctor_id = d.id
       WHERE p.id = ?`,
      [id]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const result = await sendHospitalAssignment(
      id, 
      patient.phone, 
      patient.patient_name,
      patient.hospital_name || 'TBD',
      patient.doctor_name || 'TBD'
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Hospital assignment notification sent.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send notification.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND VISA UPDATE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendVisaUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visaStatus, updateMessage } = req.body;

    if (!visaStatus || !updateMessage) {
      return res.status(400).json({ 
        success: false, 
        message: 'Visa status and update message required.' 
      });
    }

    const [[patient]] = await db.query(
      `SELECT id, patient_name, phone FROM patients WHERE id = ?`,
      [id]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const result = await sendVisaUpdate(
      id,
      patient.phone,
      patient.patient_name,
      visaStatus,
      updateMessage
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Visa update sent.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send visa update.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND ADMISSION CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
exports.sendAdmissionConfirmation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { admissionDate, roomDetails } = req.body;

    if (!admissionDate || !roomDetails) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admission date and room details required.' 
      });
    }

    const [[patient]] = await db.query(
      `SELECT id, patient_name, phone FROM patients WHERE id = ?`,
      [id]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const result = await sendAdmissionConfirmation(
      id,
      patient.phone,
      patient.patient_name,
      admissionDate,
      roomDetails
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Admission confirmation sent.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send admission confirmation.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND DISCHARGE CARE INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────
exports.sendDischargeCareInstructions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { instructions } = req.body;

    if (!instructions) {
      return res.status(400).json({ 
        success: false, 
        message: 'Care instructions required.' 
      });
    }

    const [[patient]] = await db.query(
      `SELECT id, patient_name, phone FROM patients WHERE id = ?`,
      [id]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const result = await sendDischargeCareInstructions(
      id,
      patient.phone,
      patient.patient_name,
      instructions
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Discharge care instructions sent.',
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send discharge care instructions.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MESSAGE LOGS
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessageLogs = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    let query = 'SELECT * FROM whatsapp_messages WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [messages] = await db.query(query, params);

    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM whatsapp_messages');

    return res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET INDIVIDUAL MESSAGE LOG
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessageLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[message]] = await db.query(
      `SELECT * FROM whatsapp_messages WHERE id = ?`,
      [id]
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    return res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MESSAGE STATUS
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessageStatus = async (req, res, next) => {
  try {
    const { sid } = req.params;

    const result = await getMessageStatus(sid);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch message status.',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
exports.getSettings = async (req, res, next) => {
  try {
    const [[settings]] = await db.query(
      `SELECT * FROM whatsapp_settings LIMIT 1`
    );

    return res.status(200).json({
      success: true,
      data: settings || {
        auto_welcome: false,
        auto_followup: false,
        followup_days_before: 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
exports.updateSettings = async (req, res, next) => {
  try {
    const { auto_welcome, auto_followup, followup_days_before } = req.body;

    const [[existing]] = await db.query(
      `SELECT id FROM whatsapp_settings LIMIT 1`
    );

    if (existing) {
      await db.query(
        `UPDATE whatsapp_settings SET auto_welcome = ?, auto_followup = ?, followup_days_before = ?`,
        [auto_welcome, auto_followup, followup_days_before]
      );
    } else {
      await db.query(
        `INSERT INTO whatsapp_settings (auto_welcome, auto_followup, followup_days_before)
         VALUES (?, ?, ?)`,
        [auto_welcome, auto_followup, followup_days_before]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HANDLE INCOMING WHATSAPP WEBHOOK (NO AUTH REQUIRED)
// ─────────────────────────────────────────────────────────────────────────────
exports.handleIncomingMessage = async (req, res, next) => {
  try {
    const webhookData = req.body;

    // Validate Twilio signature if auth token is available
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.headers['x-twilio-signature'];

    if (authToken && signature) {
      const isValid = validateWebhookSignature(
        JSON.stringify(webhookData),
        signature,
        authToken
      );

      if (!isValid) {
        console.warn('Invalid Twilio webhook signature');
        return res.status(403).json({ success: false, message: 'Invalid signature' });
      }
    }

    // Process the incoming message
    const result = await handleIncomingMessage(webhookData);

    if (result.success) {
      // Return empty response for Twilio (200 OK)
      return res.status(200).send('');
    } else {
      console.error('Failed to process incoming WhatsApp message:', result.error);
      return res.status(500).send('');
    }

  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to Twilio to avoid retries
    return res.status(200).send('');
  }
};
