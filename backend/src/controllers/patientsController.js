const db = require('../config/database');

// ── GET /api/v1/patients/list ─────────────────────────────────────────────────
exports.listPatients = async (req, res, next) => {
  try {
    const { completion_status, page = 1, limit = 20 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (completion_status) { where += ' AND p.completion_status = ?'; params.push(completion_status); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT p.*,
              l.patient_name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
              e.name AS case_manager_name
       FROM patients p
       JOIN leads l ON p.lead_id = l.id
       LEFT JOIN employees e ON p.case_manager_id = e.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM patients p ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/patients/:id ──────────────────────────────────────────────────
exports.getPatient = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*,
              l.patient_name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
              e.name AS case_manager_name
       FROM patients p
       JOIN leads l ON p.lead_id = l.id
       LEFT JOIN employees e ON p.case_manager_id = e.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // Get patient documents
    const [documents] = await db.query(
      `SELECT pd.*,
              e.name AS uploaded_by_name,
              v.name AS verified_by_name
       FROM patient_documents pd
       LEFT JOIN employees e ON pd.uploaded_by = e.id
       LEFT JOIN employees v ON pd.verified_by = v.id
       WHERE pd.patient_id = ? ORDER BY pd.created_at DESC`,
      [req.params.id]
    );

    // Get assignment history
    const [assignments] = await db.query(
      `SELECT pa.*,
              h.name AS hospital_name, h.city AS hospital_city,
              d.name AS doctor_name, d.specialization,
              e.name AS assigned_by_name
       FROM patient_assignments pa
       LEFT JOIN hospitals h ON pa.hospital_id = h.id
       LEFT JOIN doctors d ON pa.doctor_id = d.id
       LEFT JOIN employees e ON pa.assigned_by = e.id
       WHERE pa.patient_id = ? ORDER BY pa.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], documents, assignments } });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/patients/:id ──────────────────────────────────────────────────
exports.updatePatient = async (req, res, next) => {
  try {
    const {
      patient_name, phone, whatsapp, email, date_of_birth, gender, nationality,
      passport_no, passport_expiry, address, emergency_contact_name, emergency_contact_phone,
      medical_history, allergies, current_medications, blood_group,
      visa_status, visa_number, visa_expiry, arrival_date, departure_date,
      accommodation, transport, case_manager_id, package_value, payment_status,
      payment_amount, feedback, completion_status
    } = req.body;

    const updates = [];
    const vals = [];

    // Build dynamic update query
    const fields = {
      patient_name, phone, whatsapp, email, date_of_birth, gender, nationality,
      passport_no, passport_expiry, address, emergency_contact_name, emergency_contact_phone,
      medical_history, allergies, current_medications, blood_group,
      visa_status, visa_number, visa_expiry, arrival_date, departure_date,
      accommodation, transport, case_manager_id, package_value, payment_status,
      payment_amount, feedback, completion_status
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        vals.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    updates.push('updated_at = NOW()');
    vals.push(req.params.id);

    await db.query(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, vals);

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', req.params.id, req.employee.id, 'updated', 'Patient details updated']
    );

    res.json({ success: true, message: 'Patient updated successfully.' });
  } catch (err) { next(err); }
};

// ── POST /api/v1/patients/add ─────────────────────────────────────────────────
exports.addPatient = async (req, res, next) => {
  try {
    const {
      lead_id, patient_name, phone, whatsapp, email, date_of_birth, gender,
      nationality, passport_no, passport_expiry, address, emergency_contact_name,
      emergency_contact_phone, medical_history, allergies, current_medications,
      blood_group, visa_status, visa_number, visa_expiry, arrival_date, departure_date,
      accommodation, transport, case_manager_id, package_value, payment_status,
      payment_amount, feedback, completion_status
    } = req.body;

    if (!lead_id || !patient_name) {
      return res.status(400).json({ success: false, message: 'Lead ID and patient name are required.' });
    }

    const [existingPatient] = await db.query('SELECT id FROM patients WHERE lead_id = ?', [lead_id]);
    if (existingPatient.length) {
      return res.status(400).json({ success: false, message: 'This lead is already mapped to a patient.' });
    }

    const [result] = await db.query(
      `INSERT INTO patients
       (lead_id, patient_name, phone, whatsapp, email, date_of_birth, gender, nationality,
        passport_no, passport_expiry, address, emergency_contact_name,
        emergency_contact_phone, medical_history, allergies, current_medications,
        blood_group, visa_status, visa_number, visa_expiry, arrival_date,
        departure_date, accommodation, transport, case_manager_id, package_value,
        payment_status, payment_amount, feedback, completion_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        lead_id, patient_name, phone, whatsapp, email, date_of_birth, gender, nationality,
        passport_no, passport_expiry, address, emergency_contact_name,
        emergency_contact_phone, medical_history, allergies, current_medications,
        blood_group, visa_status, visa_number, visa_expiry, arrival_date,
        departure_date, accommodation, transport, case_manager_id, package_value,
        payment_status, payment_amount, feedback, completion_status
      ]
    );

    await db.query('UPDATE leads SET status = ?, converted_at = NOW(), updated_at = NOW() WHERE id = ?', ['converted', lead_id]);
    await db.query(
      'INSERT INTO lead_activities (lead_id, employee_id, action, notes) VALUES (?,?,?,?)',
      [lead_id, req.employee.id, 'lead_converted', 'Lead converted into patient']
    );
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', result.insertId, req.employee.id, 'created', 'Patient record created from lead']
    );

    res.status(201).json({ success: true, message: 'Patient created successfully and mapped to lead.', data: { id: result.insertId } });
  } catch (err) { next(err); }
};

// ── POST /api/v1/patients/:id/documents ───────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
  try {
    const { document_type, document_name, expiry_date } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Document file is required.' });
    }

    const file_path = `/uploads/patient-docs/${req.file.filename}`;

    const [result] = await db.query(
      `INSERT INTO patient_documents
       (patient_id, document_type, document_name, file_path, expiry_date, uploaded_by)
       VALUES (?,?,?,?,?,?)`,
      [req.params.id, document_type, document_name || req.file.originalname, file_path, expiry_date || null, req.employee.id]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', req.params.id, req.employee.id, 'document_uploaded', `Document uploaded: ${document_name}`]
    );

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully.',
      data: { id: result.insertId },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/patients/documents/:id/verify ────────────────────────────────
exports.verifyDocument = async (req, res, next) => {
  try {
    const { is_verified, notes } = req.body;

    await db.query(
      'UPDATE patient_documents SET is_verified = ?, verified_by = ?, verified_at = NOW() WHERE id = ?',
      [is_verified, req.employee.id, req.params.id]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient_document', req.params.id, req.employee.id, 'document_verified', notes || `Document ${is_verified ? 'verified' : 'unverified'}`]
    );

    res.json({ success: true, message: `Document ${is_verified ? 'verified' : 'marked as unverified'}.` });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/patients/:id/assign-hospital ──────────────────────────────────
exports.assignHospital = async (req, res, next) => {
  try {
    const { hospital_id, notes } = req.body;

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required.' });
    }

    // Verify hospital exists
    const [hospitalRows] = await db.query('SELECT id FROM hospitals WHERE id = ?', [hospital_id]);
    if (!hospitalRows.length) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    // Update patient assignment
    await db.query(
      'UPDATE patients SET assigned_hospital_id = ?, hospital_assigned_at = NOW() WHERE id = ?',
      [hospital_id, req.params.id]
    );

    // Record in assignment history
    await db.query(
      `INSERT INTO patient_assignments (patient_id, hospital_id, assigned_by, assignment_type, notes, status)
       VALUES (?, ?, ?, 'hospital', ?, 'active')`,
      [req.params.id, hospital_id, req.employee.id, notes || null]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', req.params.id, req.employee.id, 'hospital_assigned', `Hospital assigned: ${hospital_id}`]
    );

    res.json({ success: true, message: 'Hospital assigned successfully.' });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/patients/:id/assign-doctor ───────────────────────────────────
exports.assignDoctor = async (req, res, next) => {
  try {
    const { doctor_id, notes } = req.body;

    if (!doctor_id) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required.' });
    }

    // Verify doctor exists
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctorRows.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // Update patient assignment
    await db.query(
      'UPDATE patients SET assigned_doctor_id = ?, doctor_assigned_at = NOW() WHERE id = ?',
      [doctor_id, req.params.id]
    );

    // Record in assignment history
    await db.query(
      `INSERT INTO patient_assignments (patient_id, doctor_id, assigned_by, assignment_type, notes, status)
       VALUES (?, ?, ?, 'doctor', ?, 'active')`,
      [req.params.id, doctor_id, req.employee.id, notes || null]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', req.params.id, req.employee.id, 'doctor_assigned', `Doctor assigned: ${doctor_id}`]
    );

    res.json({ success: true, message: 'Doctor assigned successfully.' });
  } catch (err) { next(err); }
};

// ── PUT /api/v1/patients/:id/assign ───────────────────────────────────────────
exports.assignBoth = async (req, res, next) => {
  try {
    const { hospital_id, doctor_id, notes } = req.body;

    if (!hospital_id || !doctor_id) {
      return res.status(400).json({ success: false, message: 'Both hospital ID and doctor ID are required.' });
    }

    // Verify hospital exists
    const [hospitalRows] = await db.query('SELECT id FROM hospitals WHERE id = ?', [hospital_id]);
    if (!hospitalRows.length) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    // Verify doctor exists
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctorRows.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // Update patient assignment
    await db.query(
      'UPDATE patients SET assigned_hospital_id = ?, assigned_doctor_id = ?, hospital_assigned_at = NOW(), doctor_assigned_at = NOW() WHERE id = ?',
      [hospital_id, doctor_id, req.params.id]
    );

    // Record in assignment history
    await db.query(
      `INSERT INTO patient_assignments (patient_id, hospital_id, doctor_id, assigned_by, assignment_type, notes, status)
       VALUES (?, ?, ?, ?, 'both', ?, 'active')`,
      [req.params.id, hospital_id, doctor_id, req.employee.id, notes || null]
    );

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['patient', req.params.id, req.employee.id, 'hospital_doctor_assigned', `Hospital and Doctor assigned: ${hospital_id}, ${doctor_id}`]
    );

    res.json({ success: true, message: 'Hospital and Doctor assigned successfully.' });
  } catch (err) { next(err); }
};

// ── POST /api/v1/patients/bulk-assign ─────────────────────────────────────────
exports.bulkAssign = async (req, res, next) => {
  try {
    const { patient_ids, hospital_id, doctor_id, notes, send_notification } = req.body;

    if (!patient_ids || !Array.isArray(patient_ids) || patient_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Patient IDs array is required.' });
    }

    if (!hospital_id && !doctor_id) {
      return res.status(400).json({ success: false, message: 'At least hospital or doctor must be provided.' });
    }

    // Verify hospital and doctor exist if provided
    if (hospital_id) {
      const [hospitalRows] = await db.query('SELECT id, name, email FROM hospitals WHERE id = ?', [hospital_id]);
      if (!hospitalRows.length) {
        return res.status(404).json({ success: false, message: 'Hospital not found.' });
      }
    }

    if (doctor_id) {
      const [doctorRows] = await db.query('SELECT id, name, email FROM doctors WHERE id = ?', [doctor_id]);
      if (!doctorRows.length) {
        return res.status(404).json({ success: false, message: 'Doctor not found.' });
      }
    }

    let successCount = 0;
    const errors = [];

    for (const patientId of patient_ids) {
      try {
        // Update patient assignment
        const updates = [];
        const vals = [];

        if (hospital_id) {
          updates.push('assigned_hospital_id = ?');
          vals.push(hospital_id);
          updates.push('hospital_assigned_at = NOW()');
        }

        if (doctor_id) {
          updates.push('assigned_doctor_id = ?');
          vals.push(doctor_id);
          updates.push('doctor_assigned_at = NOW()');
        }

        vals.push(patientId);

        await db.query(
          `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`,
          vals
        );

        // Record in assignment history
        const assignmentType = hospital_id && doctor_id ? 'both' : (hospital_id ? 'hospital' : 'doctor');
        await db.query(
          `INSERT INTO patient_assignments (patient_id, hospital_id, doctor_id, assigned_by, assignment_type, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [patientId, hospital_id || null, doctor_id || null, req.employee.id, assignmentType, notes || null]
        );

        // Log activity
        await db.query(
          'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
          ['patient', patientId, req.employee.id, `bulk_assign_${assignmentType}`, `Bulk assignment: Hospital ${hospital_id}, Doctor ${doctor_id}`]
        );

        successCount++;
      } catch (error) {
        errors.push({ patientId, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk assignment completed. ${successCount}/${patient_ids.length} patients assigned.`,
      data: { successCount, totalRequested: patient_ids.length, errors }
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/patients/:id/notify-assignment ───────────────────────────────
exports.notifyAssignment = async (req, res, next) => {
  try {
    const { send_to_patient, send_to_hospital, send_to_doctor, message } = req.body;

    // Get patient and assignment details
    const [patientRows] = await db.query(
      `SELECT p.*,
              h.name AS hospital_name, h.email AS hospital_email, h.phone AS hospital_phone,
              d.name AS doctor_name, d.email AS doctor_email,
              l.patient_name, l.phone AS lead_phone, l.email AS lead_email
       FROM patients p
       LEFT JOIN hospitals h ON p.assigned_hospital_id = h.id
       LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
       JOIN leads l ON p.lead_id = l.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!patientRows.length) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const patient = patientRows[0];

    // Send notifications
    const { sendPatientEmail, sendHospitalEmail, sendDoctorEmail } = require('../utils/emailService');
    const notifications = [];

    if (send_to_patient && patient.email) {
      try {
        await sendPatientEmail({
          recipientEmail: patient.email,
          patientName: patient.patient_name,
          hospitalName: patient.hospital_name,
          doctorName: patient.doctor_name,
          doctorSpecialization: patient.specialization,
          message: message || 'Your hospital and doctor have been assigned for your treatment.'
        });
        notifications.push({ type: 'patient', status: 'sent' });

        // Log email
        await db.query(
          'INSERT INTO email_logs (email_type, recipient_email, entity_type, entity_id, status, sent_at) VALUES (?,?,?,?,?,NOW())',
          ['assignment_notification', patient.email, 'patient', patient.id, 'sent']
        );
      } catch (error) {
        notifications.push({ type: 'patient', status: 'failed', error: error.message });
      }
    }

    if (send_to_hospital && patient.hospital_email) {
      try {
        await sendHospitalEmail({
          recipientEmail: patient.hospital_email,
          hospitalName: patient.hospital_name,
          patientName: patient.patient_name,
          doctorName: patient.doctor_name,
          message: message || `New patient ${patient.patient_name} has been assigned for treatment.`
        });
        notifications.push({ type: 'hospital', status: 'sent' });

        await db.query(
          'INSERT INTO email_logs (email_type, recipient_email, entity_type, entity_id, status, sent_at) VALUES (?,?,?,?,?,NOW())',
          ['assignment_notification', patient.hospital_email, 'hospital', patient.assigned_hospital_id, 'sent']
        );
      } catch (error) {
        notifications.push({ type: 'hospital', status: 'failed', error: error.message });
      }
    }

    if (send_to_doctor && patient.doctor_email) {
      try {
        await sendDoctorEmail({
          recipientEmail: patient.doctor_email,
          doctorName: patient.doctor_name,
          patientName: patient.patient_name,
          hospitalName: patient.hospital_name,
          message: message || `You have a new patient referral: ${patient.patient_name}`
        });
        notifications.push({ type: 'doctor', status: 'sent' });

        await db.query(
          'INSERT INTO email_logs (email_type, recipient_email, entity_type, entity_id, status, sent_at) VALUES (?,?,?,?,?,NOW())',
          ['assignment_notification', patient.doctor_email, 'doctor', patient.assigned_doctor_id, 'sent']
        );
      } catch (error) {
        notifications.push({ type: 'doctor', status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Assignment notifications sent.',
      data: { notifications }
    });
  } catch (err) { next(err); }
};