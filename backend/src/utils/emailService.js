const path = require('path');
const nodemailer = require('nodemailer');

// Create transporter
const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
  }
});

const isRemoteUrl = (value) => typeof value === 'string' && /^(https?:\/\/|mailto:|ftp:\/\/)/i.test(value);

// ── Format Lead Source for Display ──────────────────────────────────────────
const formatLeadSource = (source) => {
  const sourceMap = {
    'field': 'Field Visit',
    'referral': 'Referral',
    'online': 'Online',
    'camp': 'Medical Camp',
    'other': 'Other',
    'google_leads': 'Google Leads',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'linkedin': 'LinkedIn',
    'twitter': 'Twitter',
    'whatsapp': 'WhatsApp'
  };
  return sourceMap[source] || source;
};

// ── Send Email Function ──────────────────────────────────────────────────────
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Healthqubes Eye'}" <${process.env.SMTP_USER || process.env.EMAIL_FROM || 'no-reply@healthqubes-eye.com'}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// ── Generate Patient Summary HTML ────────────────────────────────────────────
const generatePatientSummaryHTML = (patient) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Patient Summary</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Name:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.patient_name || patient.lead_name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Phone:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.phone || patient.lead_phone}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Email:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.email || patient.lead_email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Lead Source:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatLeadSource(patient.source)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Date of Birth:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.date_of_birth || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Medical History:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.medical_history || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Allergies:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.allergies || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Current Medications:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.current_medications || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Blood Group:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.blood_group || 'N/A'}</td>
        </tr>
      </table>
    </div>
  `;
};

// ── Generate Treatment Requirements HTML ─────────────────────────────────────
const generateTreatmentRequirementsHTML = (treatments) => {
  if (!treatments || treatments.length === 0) {
    return '<p>No treatment requirements specified.</p>';
  }

  let html = '<h3>Treatment Requirements</h3><ul>';
  treatments.forEach(treatment => {
    html += `<li><strong>${treatment.name}:</strong> ${treatment.description || 'No description'}</li>`;
  });
  html += '</ul>';

  return html;
};

// ── Normalize attachments for file system delivery ─────────────────────────
const normalizeAttachments = (attachments = []) => ([]).concat(attachments)
  .filter(Boolean)
  .map((attachment) => {
    if (typeof attachment === 'string') {
      const sourcePath = attachment;
      if (isRemoteUrl(sourcePath)) {
        return {
          filename: path.basename(sourcePath.split('?')[0]) || 'attachment',
          href: sourcePath
        };
      }

      const normalizedPath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(__dirname, '../../', String(sourcePath).replace(/^\//, ''));

      return {
        filename: path.basename(normalizedPath) || 'attachment',
        path: normalizedPath
      };
    }

    if (attachment.content) {
      return {
        filename: attachment.filename || attachment.file_name || 'attachment',
        content: attachment.content,
        contentType: attachment.contentType || attachment.content_type
      };
    }

    const sourcePath = attachment.path || attachment.file_path || attachment.url || attachment.href;
    if (!sourcePath) return null;

    if (isRemoteUrl(sourcePath)) {
      return {
        filename: attachment.filename || attachment.file_name || path.basename(sourcePath.split('?')[0]) || 'attachment',
        href: sourcePath
      };
    }

    const normalizedPath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.join(__dirname, '../../', String(sourcePath).replace(/^\//, ''));

    return {
      filename: attachment.filename || attachment.file_name || path.basename(normalizedPath) || 'attachment',
      path: normalizedPath,
    };
  })
  .filter(Boolean);

// ── Send Patient Email with Summary and Attachments ────────────────────────
const sendPatientEmail = async (options = {}) => {
  const {
    patient,
    treatments = [],
    attachments = [],
    recipientEmail,
    subject,
    additionalMessage,
    footerText,
  } = typeof options === 'object' && !Array.isArray(options) ? options : {
    patient: options[0],
    treatments: options[1],
    attachments: options[2],
    recipientEmail: options[3],
    subject: options[4],
  };

  try {
    const patientSummaryHTML = generatePatientSummaryHTML(patient);
    const treatmentHTML = generateTreatmentRequirementsHTML(treatments);
    const normalizedAttachments = normalizeAttachments(attachments);

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Patient Treatment Update</h1>
        ${additionalMessage ? `<p>${additionalMessage}</p>` : ''}
        ${patientSummaryHTML}
        ${treatmentHTML}
        <p>Best regards,<br>Healthqubes Eye Team</p>
        ${footerText ? `<p style="color: #666; font-size: 12px;">${footerText}</p>` : ''}
      </div>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject: subject || `Patient Treatment Summary - ${patient.patient_name || patient.lead_name}`,
      html: emailBody,
      attachments: normalizedAttachments,
    });

    console.log(`Email sent to ${recipientEmail} for patient ${patient.patient_name || patient.lead_name}`);
    return result;
  } catch (error) {
    console.error('Error sending patient email:', error);
    throw error;
  }
};

// ── Generate Hospital Email HTML ───────────────────────────────────────────
const generateHospitalEmailHTML = (hospital, message) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Hospital Communication</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Hospital Name:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${hospital.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Address:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${hospital.address || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>City:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${hospital.city || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Phone:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${hospital.phone || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Email:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${hospital.email || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Category:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${hospital.category || 'N/A'}</td>
        </tr>
      </table>
      <div style="margin-top: 20px;">
        ${message ? `<p>${message}</p>` : ''}
      </div>
    </div>
  `;
};

// ── Generate Doctor Email HTML ──────────────────────────────────────────────
const generateDoctorEmailHTML = (doctor, message) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Doctor Communication</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Doctor Name:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Specialization:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.specialization || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Hospital:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.hospital || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Address:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.address || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Phone:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.phone || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Email:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.email || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Category:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${doctor.category || 'N/A'}</td>
        </tr>
      </table>
      <div style="margin-top: 20px;">
        ${message ? `<p>${message}</p>` : ''}
      </div>
    </div>
  `;
};

// ── Send Hospital Email ─────────────────────────────────────────────────────
const sendHospitalEmail = async (options = {}) => {
  const {
    hospital,
    patient,
    recipientEmail,
    subject,
    message,
    attachments = [],
  } = options;

  try {
    const hospitalHTML = generateHospitalEmailHTML(hospital, null);
    const patientHTML = patient ? generatePatientSummaryHTML(patient) : '';
    const normalizedAttachments = normalizeAttachments(attachments);

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">${patient ? 'Patient Referral' : 'Hospital Communication'}</h1>
        ${message ? `<p>${message}</p>` : ''}
        ${patient ? `<h2>Patient Details</h2>${patientHTML}` : ''}
        <h2>Hospital Information</h2>
        ${hospitalHTML}
        <p>Best regards,<br>Healthqubes Eye Team</p>
      </div>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject: subject || (patient ? `Patient Referral - ${patient.patient_name || patient.lead_name}` : `Communication from Healthqubes Eye - ${hospital.name}`),
      html: emailBody,
      attachments: normalizedAttachments,
    });

    console.log(`Email sent to hospital ${hospital.name} at ${recipientEmail}${patient ? ` for patient ${patient.patient_name || patient.lead_name}` : ''}`);
    return result;
  } catch (error) {
    console.error('Error sending hospital email:', error);
    throw error;
  }
};

// ── Send Doctor Email ───────────────────────────────────────────────────────
const sendDoctorEmail = async (options = {}) => {
  const {
    doctor,
    recipientEmail,
    subject,
    message,
    attachments = [],
  } = options;

  try {
    const doctorHTML = generateDoctorEmailHTML(doctor, message);
    const normalizedAttachments = normalizeAttachments(attachments);

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Doctor Communication</h1>
        ${doctorHTML}
        <p>Best regards,<br>Healthqubes Eye Team</p>
      </div>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject: subject || `Communication from Healthqubes Eye - Dr. ${doctor.name}`,
      html: emailBody,
      attachments: normalizedAttachments,
    });

    console.log(`Email sent to doctor ${doctor.name} at ${recipientEmail}`);
    return result;
  } catch (error) {
    console.error('Error sending doctor email:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  generatePatientSummaryHTML,
  generateTreatmentRequirementsHTML,
  sendPatientEmail,
  normalizeAttachments,
  formatLeadSource,
  generateHospitalEmailHTML,
  generateDoctorEmailHTML,
  sendHospitalEmail,
  sendDoctorEmail
};