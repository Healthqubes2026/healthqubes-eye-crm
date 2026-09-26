const path = require('path');
const db = require('../config/database');
const { sendPatientEmail, sendHospitalEmail, sendDoctorEmail, normalizeAttachments } = require('../utils/emailService');

// ── POST /api/v1/emails/send-patient-summary ────────────────────────────────
exports.sendPatientSummary = async (req, res, next) => {
  try {
    const { patientId, recipientEmail, subject, additionalMessage, attachReports = true } = req.body;

    if (!patientId || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and recipient email are required.'
      });
    }

    // Get patient details
    const [patientRows] = await db.query(
      `SELECT p.*,
              l.patient_name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
              l.source AS source,
              e.name AS case_manager_name
       FROM patients p
       JOIN leads l ON p.lead_id = l.id
       LEFT JOIN employees e ON p.case_manager_id = e.id
       WHERE p.id = ?`,
      [patientId]
    );

    if (!patientRows.length) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const patient = patientRows[0];

    // Get treatment requirements (if available)
    let treatmentRows = [];
    try {
      [treatmentRows] = await db.query(
        `SELECT tc.name, tc.description
         FROM treatment_categories tc
         WHERE tc.id IN (
           SELECT DISTINCT pt.treatment_category_id
           FROM patient_treatments pt
           WHERE pt.patient_id = ?
         )`,
        [patientId]
      );
    } catch (error) {
      // If patient_treatments table doesn't exist, try to get from lead data
      console.log('patient_treatments table not found, using lead treatment data');
      [treatmentRows] = await db.query(
        `SELECT l.treatment AS name, l.eye_condition AS description
         FROM leads l
         WHERE l.id = ? AND l.treatment IS NOT NULL`,
        [patient.lead_id]
      );
    }

    // Get patient documents for attachment
    const [documents] = await db.query(
      `SELECT pd.file_path, pd.file_name, pd.document_type
       FROM patient_documents pd
       WHERE pd.patient_id = ? AND pd.verified = 1`,
      [patientId]
    );

    const attachments = [];
    if (attachReports && documents.length > 0) {
      documents.forEach(doc => {
        if (!doc.file_path) return;

        attachments.push({
          filename: doc.file_name || path.basename(doc.file_path) || 'document.pdf',
          path: doc.file_path
        });
      });
    }

    // Add uploaded files if any
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.originalname,
          path: file.path
        });
      });
    }

    const normalizedAttachments = normalizeAttachments(attachments);

    const emailResult = await sendPatientEmail({
      patient,
      treatments: treatmentRows,
      attachments: normalizedAttachments,
      recipientEmail,
      subject: subject || `Patient Summary - ${patient.patient_name || patient.lead_name}`,
      additionalMessage,
      footerText: `This email was sent from Healthqubes Eye Management System. Case Manager: ${patient.case_manager_name || 'Not assigned'}`,
    });

    // Log the email activity
    await db.query(
      `INSERT INTO email_logs (patient_id, recipient_email, subject, sent_by, sent_at, status)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [patientId, recipientEmail, subject || `Patient Summary - ${patient.patient_name || patient.lead_name}`, req.user.id, 'sent']
    );

    res.json({
      success: true,
      message: 'Email sent successfully.',
      data: {
        messageId: emailResult.messageId,
        recipient: recipientEmail,
        attachmentsCount: attachments.length
      }
    });

  } catch (error) {
    console.error('Send patient summary email error:', error);

    // Log failed email attempt
    if (req.body.patientId && req.body.recipientEmail) {
      await db.query(
        `INSERT INTO email_logs (patient_id, recipient_email, subject, sent_by, sent_at, status, error_message)
         VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
        [req.body.patientId, req.body.recipientEmail, req.body.subject || 'Patient Summary', req.user.id, 'failed', error.message]
      );
    }

    next(error);
  }
};

// ── GET /api/v1/emails/logs ──────────────────────────────────────────────────
exports.getEmailLogs = async (req, res, next) => {
  try {
    const { patientId, page = 1, limit = 20 } = req.query;

    let where = '';
    const params = [];

    if (patientId) {
      where = 'WHERE el.patient_id = ?';
      params.push(patientId);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT el.*,
              p.patient_name,
              e.name AS sent_by_name
       FROM email_logs el
       LEFT JOIN patients p ON el.patient_id = p.id
       LEFT JOIN employees e ON el.sent_by = e.id
       ${where}
       ORDER BY el.sent_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM email_logs el ${where}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit) }
    });

  } catch (error) {
    next(error);
  }
};

// ── POST /api/v1/emails/send-to-hospital ─────────────────────────────────────
exports.sendToHospital = async (req, res, next) => {
  try {
    const { hospitalId, patientId, recipientEmail, subject, message } = req.body;

    if (!hospitalId || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID and recipient email are required.'
      });
    }

    // Get hospital details
    const [hospitalRows] = await db.query(
      'SELECT * FROM hospitals WHERE id = ? AND is_active = 1',
      [hospitalId]
    );

    if (!hospitalRows.length) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    const hospital = hospitalRows[0];
    let patient = null;

    // If patientId is provided, get patient details
    if (patientId) {
      const [patientRows] = await db.query(
        `SELECT p.*,
                l.patient_name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
                l.source AS source,
                e.name AS case_manager_name
         FROM patients p
         JOIN leads l ON p.lead_id = l.id
         LEFT JOIN employees e ON p.case_manager_id = e.id
         WHERE p.id = ?`,
        [patientId]
      );

      if (patientRows.length) {
        patient = patientRows[0];
      }
    }

    // Process uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.originalname,
          path: file.path
        });
      });
    }

    const normalizedAttachments = normalizeAttachments(attachments);

    const emailResult = await sendHospitalEmail({
      hospital,
      patient,
      recipientEmail,
      subject: subject || (patient ? `Patient Referral - ${patient.patient_name || patient.lead_name}` : `Communication from Healthqubes Eye - ${hospital.name}`),
      message,
      attachments: normalizedAttachments,
    });

    // Log the email activity
    await db.query(
      `INSERT INTO email_logs (patient_id, recipient_email, subject, sent_by, sent_at, status, message_id)
       VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
      [patientId || null, recipientEmail, subject || (patient ? `Patient Referral - ${patient.patient_name || patient.lead_name}` : `Communication from Healthqubes Eye - ${hospital.name}`), req.user.id, 'sent', emailResult.messageId]
    );

    res.json({
      success: true,
      message: patient ? 'Patient details sent successfully to hospital.' : 'Email sent successfully to hospital.',
      data: {
        messageId: emailResult.messageId,
        recipient: recipientEmail,
        hospitalName: hospital.name,
        patientName: patient?.patient_name || patient?.lead_name,
        attachmentsCount: attachments.length
      }
    });

  } catch (error) {
    console.error('Send hospital email error:', error);

    // Log failed email attempt
    if (req.body.hospitalId && req.body.recipientEmail) {
      await db.query(
        `INSERT INTO email_logs (recipient_email, subject, sent_by, sent_at, status, error_message)
         VALUES (?, ?, ?, NOW(), ?, ?)`,
        [req.body.recipientEmail, req.body.subject || 'Hospital Communication', req.user.id, 'failed', error.message]
      );
    }

    next(error);
  }
};

// ── POST /api/v1/emails/send-to-doctor ───────────────────────────────────────
exports.sendToDoctor = async (req, res, next) => {
  try {
    const { doctorId, recipientEmail, subject, message } = req.body;

    if (!doctorId || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID and recipient email are required.'
      });
    }

    // Get doctor details
    const [doctorRows] = await db.query(
      'SELECT * FROM doctors WHERE id = ? AND is_active = 1',
      [doctorId]
    );

    if (!doctorRows.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const doctor = doctorRows[0];

    // Process uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.originalname,
          path: file.path
        });
      });
    }

    const normalizedAttachments = normalizeAttachments(attachments);

    const emailResult = await sendDoctorEmail({
      doctor,
      recipientEmail,
      subject: subject || `Communication from Healthqubes Eye - Dr. ${doctor.name}`,
      message,
      attachments: normalizedAttachments,
    });

    // Log the email activity
    await db.query(
      `INSERT INTO email_logs (recipient_email, subject, sent_by, sent_at, status, message_id)
       VALUES (?, ?, ?, NOW(), ?, ?)`,
      [recipientEmail, subject || `Communication from Healthqubes Eye - Dr. ${doctor.name}`, req.user.id, 'sent', emailResult.messageId]
    );

    res.json({
      success: true,
      message: 'Email sent successfully to doctor.',
      data: {
        messageId: emailResult.messageId,
        recipient: recipientEmail,
        doctorName: doctor.name,
        attachmentsCount: attachments.length
      }
    });

  } catch (error) {
    console.error('Send doctor email error:', error);

    // Log failed email attempt
    if (req.body.doctorId && req.body.recipientEmail) {
      await db.query(
        `INSERT INTO email_logs (recipient_email, subject, sent_by, sent_at, status, error_message)
         VALUES (?, ?, ?, NOW(), ?, ?)`,
        [req.body.recipientEmail, req.body.subject || 'Doctor Communication', req.user.id, 'failed', error.message]
      );
    }

    next(error);
  }
};