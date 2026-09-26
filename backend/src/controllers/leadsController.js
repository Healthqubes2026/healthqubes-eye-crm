const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { sendEmail, formatLeadSource } = require('../utils/emailService');

// ── POST /api/v1/leads/add ────────────────────────────────────────────────────
exports.addLead = async (req, res, next) => {
  try {
    const {
      patient_name, phone, whatsapp, email, country, city, state,
      relationship_to_patient, language, nationality, preferred_country,
      eye_condition, treatment, hospital, doctor_id,
      follow_up_date, priority, source, notes,
      // New fields
      utm_source, utm_medium, utm_campaign, referral_source, landing_page,
      medical_category, diagnosis, severity, budget, estimated_revenue, timeline_days
    } = req.body;

    if (!patient_name) {
      return res.status(400).json({ success: false, message: 'patient_name required.' });
    }

    const reports = req.files ? req.files.map(f => `/uploads/reports/${f.filename}`) : [];

    const [result] = await db.query(
      `INSERT INTO leads
       (uuid, patient_name, phone, whatsapp, email, country, city, state,
        relationship_to_patient, language, nationality, preferred_country,
        eye_condition, treatment, hospital, doctor_id,
        assigned_to, follow_up_date, priority, source, notes, reports,
        utm_source, utm_medium, utm_campaign, referral_source, landing_page,
        medical_category, diagnosis, severity, budget, estimated_revenue, timeline_days)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(), patient_name, phone, whatsapp, email,
        country || 'India', city, state,
        relationship_to_patient || null,
        language || null,
        nationality || null,
        preferred_country || null,
        eye_condition, treatment, hospital, doctor_id || null,
        req.employee.id,
        follow_up_date || null,
        priority || 'medium',
        source || 'field',
        notes || null,
        JSON.stringify(reports),
        utm_source, utm_medium, utm_campaign, referral_source, landing_page,
        medical_category, diagnosis, severity || 'moderate', budget, estimated_revenue, timeline_days
      ]
    );

    // Log activity
    await db.query(
      'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
      [result.insertId, req.employee.id, 'lead_created', `Lead created by ${req.employee.name}`]
    );

    // Log to generalized activity_logs
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['lead', result.insertId, req.employee.id, 'created', `Lead created by ${req.employee.name}`]
    );

    // Send confirmation email if email provided
    if (email) {
      try {
        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Healthqubes Eye</h2>
            <p>Dear ${patient_name},</p>
            <p>Thank you for your interest in our eye care services. We have received your inquiry and our team will contact you soon.</p>
            <p><strong>Lead Source:</strong> ${formatLeadSource(source)}</p>
            <p><strong>Eye Condition:</strong> ${eye_condition || 'Not specified'}</p>
            <p><strong>Treatment:</strong> ${treatment || 'Not specified'}</p>
            <p>If you have any questions, please contact us at ${process.env.SUPPORT_EMAIL || 'support@healthqubes-eye.com'}.</p>
            <p>Best regards,<br>Healthqubes Eye Team</p>
          </div>
        `;

        await sendEmail({
          to: email,
          subject: 'Thank you for your inquiry - Healthqubes Eye',
          html: emailBody
        });

        // Log email activity
        await db.query(
          'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
          [result.insertId, req.employee.id, 'email_sent', `Confirmation email sent to ${email}`]
        );
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send notification email to assigned employee
    try {
      const [employeeRows] = await db.query('SELECT email FROM employees WHERE id = ?', [req.employee.id]);
      if (employeeRows.length > 0 && employeeRows[0].email) {
        const employeeEmailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Lead Assigned</h2>
            <p>Dear ${req.employee.name},</p>
            <p>A new lead has been assigned to you:</p>
            <p><strong>Name:</strong> ${patient_name}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Email:</strong> ${email || 'N/A'}</p>
            <p><strong>Source:</strong> ${formatLeadSource(source)}</p>
            <p><strong>Eye Condition:</strong> ${eye_condition || 'N/A'}</p>
            <p><strong>Priority:</strong> ${priority}</p>
            <p><strong>Follow-up Date:</strong> ${follow_up_date || 'N/A'}</p>
            <p>Please contact the lead as soon as possible.</p>
            <p>Best regards,<br>Healthqubes Eye System</p>
          </div>
        `;

        await sendEmail({
          to: employeeRows[0].email,
          subject: `New Lead Assigned: ${patient_name}`,
          html: employeeEmailBody
        });

        // Log email activity
        await db.query(
          'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
          [result.insertId, req.employee.id, 'email_sent', `Notification email sent to ${employeeRows[0].email}`]
        );
      }
    } catch (emailError) {
      console.error('Error sending employee notification email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Lead added successfully.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/leads/list ────────────────────────────────────────────────────
exports.listLeads = async (req, res, next) => {
  try {
    const { status, priority, from, to, search, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (req.employee.role === 'field_agent') {
      where += ' AND l.assigned_to = ?';
      params.push(req.employee.id);
    }

    if (status)   { where += ' AND l.status = ?';            params.push(status); }
    if (priority) { where += ' AND l.priority = ?';          params.push(priority); }
    if (from)     { where += ' AND l.created_at >= ?';       params.push(from); }
    if (to)       { where += ' AND l.created_at <= ?';       params.push(to + ' 23:59:59'); }
    if (search)   {
      where += ' AND (l.patient_name LIKE ? OR l.phone LIKE ? OR l.eye_condition LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT l.*,
              d.name AS doctor_name,
              e.name AS assigned_to_name
       FROM leads l
       LEFT JOIN doctors d   ON l.doctor_id   = d.id
       LEFT JOIN employees e ON l.assigned_to = e.id
       ${where}
       ORDER BY l.follow_up_date ASC, l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads l ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/leads/:id ─────────────────────────────────────────────────────
exports.getLead = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT l.*, d.name AS doctor_name, e.name AS assigned_to_name
       FROM leads l
       LEFT JOIN doctors d ON l.doctor_id = d.id
       LEFT JOIN employees e ON l.assigned_to = e.id
       WHERE l.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const [activities] = await db.query(
      `SELECT la.*, e.name AS employee_name
       FROM lead_activities la JOIN employees e ON la.employee_id = e.id
       WHERE la.lead_id = ? ORDER BY la.created_at DESC`,
      [req.params.id]
    );

    const [stageHistory] = await db.query(
      `SELECT h.*, e.name AS employee_name
       FROM lead_stage_history h JOIN employees e ON h.changed_by = e.id
       WHERE h.lead_id = ? ORDER BY h.changed_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], activities, stage_history: stageHistory } });
  } catch (err) { next(err); }
};

// ── POST /api/v1/leads/:id/activities ───────────────────────────────────────────
exports.addLeadActivity = async (req, res, next) => {
  try {
    const { notes, channel, tags, action } = req.body;
    if (!notes) {
      return res.status(400).json({ success: false, message: 'notes are required.' });
    }

    const [existing] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const activityAction = action || 'conversation_note';
    await db.query(
      'INSERT INTO lead_activities (lead_id, employee_id, action, notes, channel, tags) VALUES (?,?,?,?,?,?)',
      [req.params.id, req.employee.id, activityAction, notes, channel || null, tags || null]
    );

    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['lead', req.params.id, req.employee.id, 'activity_added', `Added activity note${channel ? ` via ${channel}` : ''}`]
    );

    res.status(201).json({ success: true, message: 'Activity logged successfully.' });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/leads/:id ─────────────────────────────────────────────────────
exports.updateLead = async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const fields = [
      'patient_name','phone','whatsapp','email','country','city','state',
      'relationship_to_patient','language','nationality','preferred_country',
      'eye_condition','treatment','hospital','doctor_id','follow_up_date',
      'priority','source','notes','utm_source','utm_medium','utm_campaign',
      'referral_source','landing_page','medical_category','diagnosis','severity',
      'budget','estimated_revenue','timeline_days'
    ];

    const numericFields = ['doctor_id','budget','estimated_revenue','timeline_days'];
    const updates = [];
    const vals = [];

    fields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) return;

      let value = req.body[field];
      if (value === '') value = null;
      if (numericFields.includes(field) && value !== null) {
        value = Number(value);
        if (Number.isNaN(value)) value = null;
      }

      updates.push(`${field} = ?`);
      vals.push(value);
    });

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No lead fields provided to update.' });
    }

    updates.push('updated_at = NOW()');
    vals.push(req.params.id);

    await db.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, vals);

    await db.query(
      'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
      [req.params.id, req.employee.id, 'lead_updated', `Lead updated by ${req.employee.name}`]
    );

    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['lead', req.params.id, req.employee.id, 'updated', `Lead updated by ${req.employee.name}`]
    );

    res.json({ success: true, message: 'Lead updated successfully.' });
  } catch (err) { next(err); }
};

// ── GET /api/v1/leads/eligible ─────────────────────────────────────────────────
exports.listEligibleLeads = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id, l.patient_name, l.phone, l.email, l.eye_condition, l.treatment, l.city, l.hospital
       FROM leads l
       LEFT JOIN patients p ON p.lead_id = l.id
       WHERE p.id IS NULL AND l.status != 'converted'
       ORDER BY l.created_at DESC
       LIMIT 100`
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/leads/:id/status ──────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, notes, follow_up_date, loss_reason } = req.body;
    const validStatuses = ['new_lead','attempted','connected','requirement_captured','docs_requested','docs_received','hospital_shortlisted','quotation_requested','quotation_received','treatment_plan_shared','negotiation','decision_pending','converted','lost','closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}.` });
    }

    // If status is 'lost', loss_reason is mandatory
    if (status === 'lost' && !loss_reason) {
      return res.status(400).json({ success: false, message: 'loss_reason is required when status is lost.' });
    }

    const [existing] = await db.query('SELECT id, status, estimated_revenue FROM leads WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const oldStatus = existing[0].status;

    // Don't allow status change if already converted (unless changing to lost)
    if (oldStatus === 'converted' && status !== 'lost') {
      return res.status(400).json({ success: false, message: 'Cannot change status of converted lead.' });
    }

    const updates = ['status = ?', 'stage_changed_at = NOW()'];
    const vals = [status];

    if (follow_up_date) { updates.push('follow_up_date = ?'); vals.push(follow_up_date); }
    if (status === 'converted') {
      updates.push('converted_at = NOW()');
      // If converted and has estimated_revenue, capture it
      if (existing[0].estimated_revenue) {
        // Could add to some revenue tracking table here
      }
    }
    if (status === 'lost') {
      updates.push('loss_reason = ?'); vals.push(loss_reason);
    }
    updates.push('updated_at = NOW()');
    vals.push(req.params.id);

    await db.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, vals);

    // Log stage change history
    await db.query(
      'INSERT INTO lead_stage_history (lead_id, from_stage, to_stage, changed_by, change_reason) VALUES (?,?,?,?,?)',
      [req.params.id, oldStatus, status, req.employee.id, notes || null]
    );

    // Log activity
    await db.query(
      'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
      [req.params.id, req.employee.id, `status_changed_to_${status}`, notes || `Status changed from ${oldStatus} to ${status}`]
    );

    // Log to generalized activity_logs
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, old_value, new_value, notes) VALUES (?,?,?,?,?,?,?)',
      ['lead', req.params.id, req.employee.id, 'status_changed', JSON.stringify({ status: oldStatus }), JSON.stringify({ status }), notes]
    );

    // If converted, create patient record
    if (status === 'converted') {
      await db.query(
        'INSERT INTO patients (lead_id, patient_name, phone, whatsapp, email) SELECT id, patient_name, phone, whatsapp, email FROM leads WHERE id = ?',
        [req.params.id]
      );

      // Send welcome email to new patient
      const [leadData] = await db.query('SELECT patient_name, email, source FROM leads WHERE id = ?', [req.params.id]);
      if (leadData.length > 0 && leadData[0].email) {
        try {
          const welcomeBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to Healthqubes Eye Care</h2>
              <p>Dear ${leadData[0].patient_name},</p>
              <p>Congratulations! Your lead has been converted to a patient. We are excited to assist you with your eye care needs.</p>
              <p><strong>Lead Source:</strong> ${formatLeadSource(leadData[0].source)}</p>
              <p>Our team will be in touch soon with next steps for your treatment.</p>
              <p>If you have any questions, please contact us.</p>
              <p>Best regards,<br>Healthqubes Eye Team</p>
            </div>
          `;

          await sendEmail({
            to: leadData[0].email,
            subject: 'Welcome to Healthqubes Eye - Your Journey Begins',
            html: welcomeBody
          });

          // Log email activity
          await db.query(
            'INSERT INTO lead_activities (lead_id, employee_id, action, notes, channel) VALUES (?,?,?,?,?)',
            [req.params.id, req.employee.id, 'email_sent', `Welcome email sent to ${leadData[0].email}`, 'email']
          );
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
        }
      }
    }

    res.json({ success: true, message: `Lead status updated to ${status}.` });
  } catch (err) { next(err); }
};

// ── POST /api/v1/leads/send-followup-reminders ────────────────────────────────
exports.sendFollowUpReminders = async (req, res, next) => {
  try {
    // Get leads with follow_up_date tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const [leads] = await db.query(
      `SELECT l.id, l.patient_name, l.phone, l.email, l.follow_up_date, l.source, l.eye_condition, l.priority,
              e.name as employee_name, e.email as employee_email
       FROM leads l
       JOIN employees e ON l.assigned_to = e.id
       WHERE l.follow_up_date = ? AND l.status NOT IN ('converted','lost')`,
      [tomorrowStr]
    );

    let sentCount = 0;
    for (const lead of leads) {
      try {
        const reminderBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Follow-up Reminder</h2>
            <p>Dear ${lead.employee_name},</p>
            <p>This is a reminder for your scheduled follow-up with:</p>
            <p><strong>Lead Name:</strong> ${lead.patient_name}</p>
            <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
            <p><strong>Email:</strong> ${lead.email || 'N/A'}</p>
            <p><strong>Source:</strong> ${formatLeadSource(lead.source)}</p>
            <p><strong>Eye Condition:</strong> ${lead.eye_condition || 'N/A'}</p>
            <p><strong>Priority:</strong> ${lead.priority}</p>
            <p><strong>Follow-up Date:</strong> ${lead.follow_up_date}</p>
            <p>Please contact the lead today to maintain engagement.</p>
            <p>Best regards,<br>Healthqubes Eye System</p>
          </div>
        `;

        await sendEmail({
          to: lead.employee_email,
          subject: `Follow-up Reminder: ${lead.patient_name} - ${lead.follow_up_date}`,
          html: reminderBody
        });

        // Log email activity
        await db.query(
          'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
          [lead.id, req.employee ? req.employee.id : 1, 'followup_reminder_sent', `Reminder email sent to ${lead.employee_email}`]
        );

        sentCount++;
      } catch (emailError) {
        console.error(`Error sending reminder for lead ${lead.id}:`, emailError);
      }
    }

    res.json({ success: true, message: `Follow-up reminders sent to ${sentCount} employees.` });
  } catch (err) { next(err); }
};

// ── GET /api/v1/leads/pipeline ────────────────────────────────────────────────
exports.getPipeline = async (req, res, next) => {
  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (req.employee.role === 'field_agent') {
      where += ' AND assigned_to = ?';
      params.push(req.employee.id);
    }

    const [rows] = await db.query(
      `SELECT CASE
          WHEN status = 'new' THEN 'new_lead'
          WHEN status = 'contacted' THEN 'connected'
          WHEN status = 'follow_up' THEN 'requirement_captured'
          WHEN status = 'closed' THEN 'lost'
          ELSE status
        END AS status,
        COUNT(*) AS count
       FROM leads ${where}
       GROUP BY status`,
      params
    );

    const pipeline = {
      new_lead: 0,
      attempted: 0,
      connected: 0,
      requirement_captured: 0,
      docs_requested: 0,
      docs_received: 0,
      hospital_shortlisted: 0,
      quotation_requested: 0,
      quotation_received: 0,
      treatment_plan_shared: 0,
      negotiation: 0,
      decision_pending: 0,
      converted: 0,
      lost: 0
    };
    rows.forEach(r => { pipeline[r.status] = r.count; });

    res.json({ success: true, data: pipeline });
  } catch (err) { next(err); }
};

// ── POST /api/v1/leads/:id/convert ────────────────────────────────────────────
exports.convertLead = async (req, res, next) => {
  try {
    const {
      date_of_birth, gender, passport_no, passport_expiry, address,
      emergency_contact_name, emergency_contact_phone, medical_history,
      allergies, current_medications, blood_group, visa_status,
      visa_number, visa_expiry, arrival_date, departure_date,
      accommodation, transport, case_manager_id, package_value,
      payment_status, payment_amount, feedback, completion_status
    } = req.body;

    const [lead] = await db.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead.length) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    if (lead[0].status === 'converted') {
      return res.status(400).json({ success: false, message: 'Lead is already converted.' });
    }

    // Create patient record
    const [patientResult] = await db.query(
      `INSERT INTO patients
       (lead_id, patient_name, phone, whatsapp, email, date_of_birth, gender, nationality,
        passport_no, passport_expiry, address, emergency_contact_name,
        emergency_contact_phone, medical_history, allergies, current_medications,
        blood_group, visa_status, visa_number, visa_expiry, arrival_date,
        departure_date, accommodation, transport, case_manager_id, package_value,
        payment_status, payment_amount, feedback, completion_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.params.id, lead[0].patient_name, lead[0].phone, lead[0].whatsapp, lead[0].email,
        date_of_birth, gender, lead[0].nationality || 'Indian',
        passport_no, passport_expiry, address, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, current_medications, blood_group,
        visa_status || 'not_applied', visa_number, visa_expiry, arrival_date, departure_date,
        accommodation, transport, case_manager_id, package_value,
        payment_status || 'pending', payment_amount, feedback, completion_status || 'confirmation'
      ]
    );

    // Update lead status to converted
    await db.query(
      'UPDATE leads SET status = ?, converted_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['converted', req.params.id]
    );

    // Log activities
    await db.query(
      'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
      [req.params.id, req.employee.id, 'converted_to_patient', `Converted to patient ID ${patientResult.insertId}`]
    );

    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['lead', req.params.id, req.employee.id, 'converted', `Converted to patient ${patientResult.insertId}`]
    );

    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', patientResult.insertId, req.employee.id, 'created', `Created from lead ${req.params.id}`]
    );

    res.json({
      success: true,
      message: 'Lead converted to patient successfully.',
      data: { patient_id: patientResult.insertId }
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/leads/followups-due ───────────────────────────────────────────
exports.getFollowUpsDue = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let where   = `WHERE l.follow_up_date <= ? AND l.status NOT IN ('converted','lost')`;
    const params = [today];

    if (req.employee.role === 'field_agent') {
      where += ' AND l.assigned_to = ?';
      params.push(req.employee.id);
    }

    const [rows] = await db.query(
      `SELECT l.id, l.patient_name, l.phone, l.eye_condition, l.follow_up_date, l.status, l.priority,
              DATEDIFF(?, l.follow_up_date) AS days_overdue,
              e.name AS assigned_to_name
       FROM leads l JOIN employees e ON l.assigned_to = e.id
       ${where}
       ORDER BY l.follow_up_date ASC`,
      [today, ...params]
    );

    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch (err) { next(err); }
};
