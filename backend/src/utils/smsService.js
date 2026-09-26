const twilio = require('twilio');
const db = require('../config/database');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─────────────────────────────────────────────────────────────────────────────
// SEND SMS MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
exports.sendSMS = async (to, message) => {
  try {
    // Ensure phone number has country code (India: +91)
    const phoneNumber = to.startsWith('+') ? to : `+91${to}`;

    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    // Log the message
    await db.query(
      `INSERT INTO sms_messages (message_sid, phone, message, status, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [msg.sid, phoneNumber, message, 'sent']
    );

    return { success: true, sid: msg.sid };
  } catch (error) {
    console.error('SMS send error:', error.message);

    // Log the error
    await db.query(
      `INSERT INTO sms_messages (phone, message, status, error_message, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [to, message, 'failed', error.message]
    );

    return { success: false, error: error.message };
  }
};