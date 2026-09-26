const twilio = require('twilio');
const db = require('../config/database');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─────────────────────────────────────────────────────────────────────────────
// SEND WHATSAPP MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendWhatsAppMessage = async (to, message, mediaUrl = null) => {
  try {
    // Ensure phone number has country code (India: +91)
    const phoneNumber = to.startsWith('+') ? to : `+91${to}`;

    const options = {
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phoneNumber}`,
    };

    if (mediaUrl) {
      options.mediaUrl = [mediaUrl];
    }

    const msg = await client.messages.create(options);

    // Log the message
    await db.query(
      `INSERT INTO whatsapp_messages (message_sid, phone, message, media_url, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [msg.sid, phoneNumber, message, mediaUrl || null, 'sent']
    );

    return { success: true, sid: msg.sid };
  } catch (error) {
    console.error('WhatsApp send error:', error.message);
    
    // Log the error
    await db.query(
      `INSERT INTO whatsapp_messages (phone, message, media_url, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [to, message, mediaUrl || null, 'failed', error.message]
    );

    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND LEAD WELCOME MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendLeadWelcome = async (leadId, phone, patientName) => {
  const message = `Hi ${patientName}! 👋\n\nWelcome to Healthqube Eyes. We're excited to help you with your eye care journey. Our team will be in touch shortly to understand your needs and provide personalized treatment options.\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `UPDATE leads SET whatsapp_message_sent = 1 WHERE id = ?`,
      [leadId]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND FOLLOW-UP REMINDER
// ─────────────────────────────────────────────────────────────────────────────
exports.sendFollowupReminder = async (leadId, phone, patientName, followUpDate) => {
  const message = `Hi ${patientName},\n\nJust a reminder that we have a scheduled follow-up on ${followUpDate}. Please confirm your availability.\n\nIf you have any questions, feel free to reach out!\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `UPDATE leads SET last_followup_reminder_sent = NOW() WHERE id = ?`,
      [leadId]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND QUOTATION LINK
// ─────────────────────────────────────────────────────────────────────────────
exports.sendQuotationLink = async (quotationId, phone, patientName, quotationUrl) => {
  const message = `Hi ${patientName},\n\nYour personalized quotation for eye treatment is ready! 📋\n\nView your quotation: ${quotationUrl}\n\nPlease review and let us know if you have any questions.\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `UPDATE quotations SET whatsapp_sent = 1, whatsapp_sent_at = NOW() WHERE id = ?`,
      [quotationId]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND HOSPITAL ASSIGNMENT NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
exports.sendHospitalAssignment = async (patientId, phone, patientName, hospitalName, doctorName) => {
  const message = `Hi ${patientName},\n\nGreat news! 🎉\n\nYour treatment has been assigned to:\n🏥 Hospital: ${hospitalName}\n👨‍⚕️ Doctor: ${doctorName}\n\nOur team will contact you shortly with next steps.\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `INSERT INTO whatsapp_notifications (patient_id, phone, type, message, status, created_at)
       VALUES (?, ?, 'hospital_assignment', ?, 'sent', NOW())`,
      [patientId, phone, message]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND VISA ASSISTANCE UPDATE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendVisaUpdate = async (patientId, phone, patientName, visaStatus, updateMessage) => {
  const message = `Hi ${patientName},\n\n📄 Visa Status Update\n\nStatus: ${visaStatus}\n${updateMessage}\n\nOur visa team is working hard to get everything ready for your arrival.\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `INSERT INTO whatsapp_notifications (patient_id, phone, type, message, status, created_at)
       VALUES (?, ?, 'visa_update', ?, 'sent', NOW())`,
      [patientId, phone, message]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND ADMISSION CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
exports.sendAdmissionConfirmation = async (patientId, phone, patientName, admissionDate, roomDetails) => {
  const message = `Hi ${patientName},\n\n✅ Admission Confirmed\n\nDate: ${admissionDate}\n${roomDetails}\n\nPlease arrive 30 minutes early.\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `INSERT INTO whatsapp_notifications (patient_id, phone, type, message, status, created_at)
       VALUES (?, ?, 'admission_confirmation', ?, 'sent', NOW())`,
      [patientId, phone, message]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND POST-DISCHARGE CARE INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────
exports.sendDischargeCareInstructions = async (patientId, phone, patientName, instructions) => {
  const message = `Hi ${patientName},\n\n✨ Welcome Home!\n\nPost-Discharge Care Instructions:\n${instructions}\n\nPlease follow these carefully for the best recovery.\n\nWe're here if you have any questions!\n\nBest regards,\nHealthqube Eyes Team`;

  const result = await exports.sendWhatsAppMessage(phone, message);
  
  if (result.success) {
    await db.query(
      `INSERT INTO whatsapp_notifications (patient_id, phone, type, message, status, created_at)
       VALUES (?, ?, 'discharge_care', ?, 'sent', NOW())`,
      [patientId, phone, message]
    );
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MESSAGE STATUS
// ─────────────────────────────────────────────────────────────────────────────
exports.getMessageStatus = async (messageSid) => {
  try {
    const msg = await client.messages(messageSid).fetch();
    
    await db.query(
      `UPDATE whatsapp_messages SET status = ? WHERE message_sid = ?`,
      [msg.status, messageSid]
    );

    return { success: true, status: msg.status };
  } catch (error) {
    console.error('Error fetching message status:', error.message);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND BULK MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
exports.sendBulkMessages = async (recipients, message) => {
  const results = [];

  for (const recipient of recipients) {
    const result = await exports.sendWhatsAppMessage(recipient.phone, message);
    results.push({
      phone: recipient.phone,
      name: recipient.name,
      ...result
    });

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// HANDLE INCOMING WHATSAPP MESSAGE (WEBHOOK)
// ─────────────────────────────────────────────────────────────────────────────
exports.handleIncomingMessage = async (webhookData) => {
  try {
    const { From: fromPhone, Body: message, MessageSid: messageSid, To: toPhone } = webhookData;

    // Clean phone number (remove whatsapp: prefix if present)
    const cleanPhone = fromPhone.replace('whatsapp:', '');

    console.log(`📱 Incoming WhatsApp from ${cleanPhone}: ${message}`);

    // Log the incoming message
    await db.query(
      `INSERT INTO whatsapp_messages
       (message_sid, phone, message, direction, status, created_at)
       VALUES (?, ?, ?, 'incoming', 'received', NOW())`,
      [messageSid, cleanPhone, message]
    );

    // Check if this phone number exists in leads or patients
    const [existingLead] = await db.query(
      'SELECT id, patient_name, status FROM leads WHERE phone = ? OR whatsapp = ? LIMIT 1',
      [cleanPhone, cleanPhone]
    );

    const [existingPatient] = await db.query(
      'SELECT id, patient_name FROM patients WHERE phone = ? OR whatsapp = ? LIMIT 1',
      [cleanPhone, cleanPhone]
    );

    if (existingLead.length > 0) {
      // Update existing lead with new message
      await db.query(
        'UPDATE leads SET notes = CONCAT(COALESCE(notes, ""), "\n\nWhatsApp Message (", NOW(), "): ", ?), updated_at = NOW() WHERE id = ?',
        [message, existingLead[0].id]
      );

      // Link the message to the lead
      await db.query(
        'UPDATE whatsapp_messages SET lead_id = ? WHERE message_sid = ?',
        [existingLead[0].id, messageSid]
      );

      console.log(`✅ Updated existing lead: ${existingLead[0].patient_name} (${existingLead[0].id})`);

      // Send auto-reply if configured
      const autoReplyMessage = `Thank you for your message, ${existingLead[0].patient_name}! Our team will get back to you shortly.`;
      await exports.sendWhatsAppMessage(cleanPhone, autoReplyMessage);

    } else if (existingPatient.length > 0) {
      // Update existing patient with new message
      await db.query(
        'UPDATE patients SET notes = CONCAT(COALESCE(notes, ""), "\n\nWhatsApp Message (", NOW(), "): ", ?), updated_at = NOW() WHERE id = ?',
        [message, existingPatient[0].id]
      );

      // Link the message to the patient
      await db.query(
        'UPDATE whatsapp_messages SET patient_id = ? WHERE message_sid = ?',
        [existingPatient[0].id, messageSid]
      );

      console.log(`✅ Updated existing patient: ${existingPatient[0].patient_name} (${existingPatient[0].id})`);

      // Send auto-reply
      const autoReplyMessage = `Thank you for your message, ${existingPatient[0].patient_name}! Our team will get back to you shortly.`;
      await exports.sendWhatsAppMessage(cleanPhone, autoReplyMessage);

    } else {
      // Create new lead from WhatsApp inquiry
      const leadName = `WhatsApp Inquiry - ${cleanPhone}`;
      const leadNotes = `Initial WhatsApp Message: ${message}\n\nAuto-created from WhatsApp inquiry on ${new Date().toISOString()}`;

      const [result] = await db.query(
        `INSERT INTO leads
         (uuid, patient_name, phone, whatsapp, source, notes, priority, status, created_at, updated_at)
         VALUES (UUID(), ?, ?, ?, 'whatsapp', ?, 'high', 'new_lead', NOW(), NOW())`,
        [leadName, cleanPhone, cleanPhone, leadNotes]
      );

      // Link the message to the new lead
      await db.query(
        'UPDATE whatsapp_messages SET lead_id = ? WHERE message_sid = ?',
        [result.insertId, messageSid]
      );

      console.log(`🆕 Created new lead from WhatsApp: ${leadName} (ID: ${result.insertId})`);

      // Send welcome message to new lead
      const welcomeMessage = `Hello! 👋\n\nThank you for reaching out to Healthqube Eyes. We've received your inquiry and our team will contact you shortly to discuss your eye care needs.\n\nIn the meantime, please let us know:\n• Your name\n• Your location\n• The eye condition you're seeking treatment for\n\nBest regards,\nHealthqube Eyes Team`;
      await exports.sendWhatsAppMessage(cleanPhone, welcomeMessage);
    }

    return { success: true, message: 'Incoming message processed successfully' };

  } catch (error) {
    console.error('Error processing incoming WhatsApp message:', error);

    // Log error
    await db.query(
      `INSERT INTO whatsapp_messages
       (phone, message, direction, status, error_message, created_at)
       VALUES (?, ?, 'incoming', 'failed', ?, NOW())`,
      [webhookData.From?.replace('whatsapp:', '') || 'unknown', webhookData.Body || 'No message', error.message]
    );

    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE TWILIO WEBHOOK SIGNATURE
// ─────────────────────────────────────────────────────────────────────────────
exports.validateWebhookSignature = (requestBody, signature, authToken) => {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(requestBody, 'utf8')
    .digest('base64');

  return signature === expectedSignature;
};
