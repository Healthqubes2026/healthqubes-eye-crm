const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { sendWhatsAppMessage } = require('../utils/whatsappService');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

// ── POST /api/v1/quotations/add ───────────────────────────────────────────────
exports.addQuotation = async (req, res, next) => {
  try {
    const {
      lead_id, hospital_id, doctor_id, treatment_category_id,
      quotation_date, valid_until, base_cost, accommodation_cost,
      transport_cost, visa_support_cost, miscellaneous_cost, currency
    } = req.body;

    if (!lead_id || !quotation_date) {
      return res.status(400).json({ success: false, message: 'lead_id and quotation_date are required.' });
    }

    const total_cost = (parseFloat(base_cost || 0) + parseFloat(accommodation_cost || 0) +
                       parseFloat(transport_cost || 0) + parseFloat(visa_support_cost || 0) +
                       parseFloat(miscellaneous_cost || 0));

    const [result] = await db.query(
      `INSERT INTO quotations
       (uuid, lead_id, hospital_id, doctor_id, treatment_category_id,
        quotation_date, valid_until, base_cost, accommodation_cost,
        transport_cost, visa_support_cost, miscellaneous_cost, total_cost, currency, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(), lead_id, hospital_id || null, doctor_id || null, treatment_category_id || null,
        quotation_date, valid_until || null, base_cost || 0, accommodation_cost || 0,
        transport_cost || 0, visa_support_cost || 0, miscellaneous_cost || 0, total_cost, currency || 'INR', req.employee.id
      ]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['quotation', result.insertId, req.employee.id, 'created', `Quotation created for lead ${lead_id}`]
    );

    res.status(201).json({
      success: true,
      message: 'Quotation added successfully.',
      data: { id: result.insertId, total_cost },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/quotations/list ───────────────────────────────────────────────
exports.listQuotations = async (req, res, next) => {
  try {
    const { lead_id, status, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (lead_id) { where += ' AND q.lead_id = ?'; params.push(lead_id); }
    if (status) { where += ' AND q.status = ?'; params.push(status); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT q.*,
              l.patient_name,
              h.name AS hospital_name,
              d.name AS doctor_name,
              tc.name AS treatment_name,
              e.name AS created_by_name
       FROM quotations q
       JOIN leads l ON q.lead_id = l.id
       LEFT JOIN hospitals h ON q.hospital_id = h.id
       LEFT JOIN doctors d ON q.doctor_id = d.id
       LEFT JOIN treatment_categories tc ON q.treatment_category_id = tc.id
       JOIN employees e ON q.created_by = e.id
       ${where}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM quotations q ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND QUOTATION TO PATIENT VIA MULTIPLE CHANNELS
// ─────────────────────────────────────────────────────────────────────────────
const sendQuotationToPatient = async (quotation) => {
  const results = { successful: [], failed: [] };

  // Format currency
  const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Quotation details
  const quotationDetails = `
Treatment: ${quotation.treatment_name || 'Medical Treatment'}
Hospital: ${quotation.hospital_name || 'Partner Hospital'}
Doctor: ${quotation.doctor_name || 'Assigned Doctor'}

Cost Breakdown:
• Base Treatment Cost: ${formatCurrency(quotation.base_cost, quotation.currency)}
• Accommodation: ${formatCurrency(quotation.accommodation_cost, quotation.currency)}
• Transportation: ${formatCurrency(quotation.transport_cost, quotation.currency)}
• Visa Support: ${formatCurrency(quotation.visa_support_cost, quotation.currency)}
• Miscellaneous: ${formatCurrency(quotation.miscellaneous_cost, quotation.currency)}

Total Cost: ${formatCurrency(quotation.total_cost, quotation.currency)}
Valid Until: ${new Date(quotation.valid_until).toLocaleDateString('en-IN')}

For more details, please contact us at +91-XXXXXXXXXX
  `.trim();

  // 1. Send WhatsApp Message
  if (quotation.whatsapp) {
    try {
      const whatsappMessage = `🩺 *Healthqubes Eye Care Quotation*

Dear ${quotation.patient_name},

We are pleased to provide you with a quotation for your medical treatment:

${quotationDetails}

Please reply to this message or contact our coordinator for any questions.

Thank you for choosing Healthqubes Eye Care! 👁️✨`;

      const whatsappResult = await sendWhatsAppMessage(quotation.whatsapp, whatsappMessage);
      if (whatsappResult.success) {
        results.successful.push('WhatsApp');
      } else {
        results.failed.push(`WhatsApp: ${whatsappResult.error}`);
      }
    } catch (error) {
      results.failed.push(`WhatsApp: ${error.message}`);
    }
  }

  // 2. Send Email
  if (quotation.email) {
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🩺 Healthqubes Eye Care</h1>
            <p style="color: #e8e8e8; margin: 10px 0 0 0; font-size: 16px;">Your Health, Our Priority</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Medical Treatment Quotation</h2>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-top: 0;">Patient Details</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${quotation.patient_name}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> ${quotation.city}, ${quotation.state}, ${quotation.country}</p>
            </div>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-top: 0;">Treatment Details</h3>
              <p style="margin: 5px 0;"><strong>Treatment:</strong> ${quotation.treatment_name || 'Medical Treatment'}</p>
              <p style="margin: 5px 0;"><strong>Hospital:</strong> ${quotation.hospital_name || 'Partner Hospital'}</p>
              <p style="margin: 5px 0;"><strong>Doctor:</strong> ${quotation.doctor_name || 'Assigned Doctor'}</p>
            </div>

            <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4299e1;">
              <h3 style="color: #2d3748; margin-top: 0;">Cost Breakdown</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Base Treatment Cost:</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatCurrency(quotation.base_cost, quotation.currency)}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Accommodation:</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatCurrency(quotation.accommodation_cost, quotation.currency)}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Transportation:</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatCurrency(quotation.transport_cost, quotation.currency)}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Visa Support:</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatCurrency(quotation.visa_support_cost, quotation.currency)}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Miscellaneous:</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatCurrency(quotation.miscellaneous_cost, quotation.currency)}</td></tr>
                <tr style="background: #bee3f8;"><td style="padding: 12px 0; font-weight: bold;">Total Cost:</td><td style="text-align: right; padding: 12px 0; font-weight: bold; font-size: 18px;">${formatCurrency(quotation.total_cost, quotation.currency)}</td></tr>
              </table>
            </div>

            <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e;">
              <h3 style="color: #2d3748; margin-top: 0;">Important Information</h3>
              <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${new Date(quotation.valid_until).toLocaleDateString('en-IN')}</p>
              <p style="margin: 5px 0;">This quotation is valid for the specified period and may be subject to change based on medical requirements.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="tel:+91XXXXXXXXXX" style="background: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Call Us for Questions</a>
            </div>

            <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
              Thank you for choosing Healthqubes Eye Care. We are committed to providing you with the best medical care. 👁️✨
            </p>
          </div>
        </div>
      `;

      const emailResult = await sendEmail({
        to: quotation.email,
        subject: `Medical Treatment Quotation - ${quotation.patient_name}`,
        html: emailHtml,
      });

      if (emailResult.success) {
        results.successful.push('Email');
      } else {
        results.failed.push(`Email: ${emailResult.error}`);
      }
    } catch (error) {
      results.failed.push(`Email: ${error.message}`);
    }
  }

  // 3. Send SMS
  if (quotation.phone) {
    try {
      const smsMessage = `Healthqubes Eye Care: Quotation sent for ${quotation.patient_name}. Total: ${formatCurrency(quotation.total_cost, quotation.currency)}. Valid till ${new Date(quotation.valid_until).toLocaleDateString('en-IN')}. Contact: +91-XXXXXXXXXX`;

      const smsResult = await sendSMS(quotation.phone, smsMessage);
      if (smsResult.success) {
        results.successful.push('SMS');
      } else {
        results.failed.push(`SMS: ${smsResult.error}`);
      }
    } catch (error) {
      results.failed.push(`SMS: ${error.message}`);
    }
  }

  return results;
};

// ── PUT /api/v1/quotations/:id/send ───────────────────────────────────────────
exports.sendQuotation = async (req, res, next) => {
  try {
    const { notes } = req.body;

    // Get quotation with lead details
    const [quotationRows] = await db.query(`
      SELECT q.*, l.patient_name, l.phone, l.whatsapp, l.email, l.country, l.city, l.state,
             h.name as hospital_name, d.name as doctor_name, tc.name as treatment_name
      FROM quotations q
      JOIN leads l ON q.lead_id = l.id
      LEFT JOIN hospitals h ON q.hospital_id = h.id
      LEFT JOIN doctors d ON q.doctor_id = d.id
      LEFT JOIN treatment_categories tc ON q.treatment_category_id = tc.id
      WHERE q.id = ?
    `, [req.params.id]);

    if (!quotationRows.length) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const quotation = quotationRows[0];

    // Update quotation status
    await db.query(
      'UPDATE quotations SET status = ?, email_sent = TRUE, email_sent_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['sent', req.params.id]
    );

    // Send via all channels
    const sendResults = await sendQuotationToPatient(quotation);

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['quotation', req.params.id, req.employee.id, 'sent', notes || `Quotation sent to patient via ${sendResults.successful.join(', ')}`]
    );

    res.json({
      success: true,
      message: 'Quotation sent successfully.',
      sent_via: sendResults.successful,
      failed: sendResults.failed
    });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/quotations/:id/status ─────────────────────────────────────────
exports.updateQuotationStatus = async (req, res, next) => {
  try {
    const { status, response_date, response_notes } = req.body;
    const validStatuses = ['draft','sent','awaiting_response','received','follow_up','accepted','rejected','closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}.` });
    }

    const [existing] = await db.query('SELECT id, status FROM quotations WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const oldStatus = existing[0].status;
    const updates = ['status = ?'];
    const vals = [status];

    if (response_date) { updates.push('response_date = ?'); vals.push(response_date); }
    if (response_notes) { updates.push('response_notes = ?'); vals.push(response_notes); }
    updates.push('updated_at = NOW()');
    vals.push(req.params.id);

    await db.query(`UPDATE quotations SET ${updates.join(', ')} WHERE id = ?`, vals);

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, old_value, new_value, notes) VALUES (?,?,?,?,?,?,?)',
      ['quotation', req.params.id, req.employee.id, 'status_changed', JSON.stringify({ status: oldStatus }), JSON.stringify({ status }), response_notes]
    );

    res.json({ success: true, message: `Quotation status updated to ${status}.` });
  } catch (err) { next(err); }
};