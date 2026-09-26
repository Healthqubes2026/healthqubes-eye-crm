require('dotenv').config();
const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function addSampleLeads() {
  try {
    console.log('🔄 Setting up leads with hospitals and doctors...\n');

    // 1. Ensure we have an employee to assign to
    console.log('✓ Checking for existing employees...');
    const checkEmployee = await db.query(`SELECT * FROM employees LIMIT 1`);
    
    let assignedToId;
    if (!checkEmployee || checkEmployee.length === 0) {
      console.log('  Creating default coordinator employee...');
      const bcryptjs = require('bcryptjs');
      const pwd = await bcryptjs.hash('password123', 10);
      const empInsert = await db.query(
        `INSERT INTO employees (uuid, name, email, phone, password_hash, role, is_active, created_at) 
         VALUES (?, ?, ?, ?, ?, 'sales_coordinator', 1, NOW())`,
        [uuidv4(), 'Lead Coordinator', 'coordinator@health.com', '+91-9999999999', pwd]
      );
      assignedToId = empInsert.insertId;
    } else {
      assignedToId = checkEmployee[0].id;
    }
    console.log(`✅ Employee ID: ${assignedToId}\n`);

    // 2. Add hospitals
    console.log('🏥 Adding hospitals...');
    const hospitalData = [
      {
        name: 'Apollo Eye Hospital Delhi',
        address: '7, Condo Place, New Delhi',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        phone: '+91-11-41614123',
        email: 'info@apolloeye.com',
        specialties: JSON.stringify(['Ophthalmology', 'Retina', 'Cornea']),
        category: 'super_specialty'
      },
      {
        name: 'Fortis Eye Hospital Mumbai',
        address: '154, Veer Savarkar Marg, Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        phone: '+91-22-67254321',
        email: 'info@fortiseye.com',
        specialties: JSON.stringify(['Ophthalmology', 'Lasik', 'Cataract']),
        category: 'tertiary'
      },
      {
        name: 'Eye Care Medical Center Bangalore',
        address: '123 MG Road, Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        phone: '+91-80-41234567',
        email: 'contact@eyecare.in',
        specialties: JSON.stringify(['Ophthalmology', 'Pediatric Eye Care', 'Glaucoma']),
        category: 'secondary'
      }
    ];

    let hospitalIds = [];
    for (const hospital of hospitalData) {
      const hInsert = await db.query(
        `INSERT INTO hospitals (name, address, city, state, country, phone, email, specialties, category, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [hospital.name, hospital.address, hospital.city, hospital.state, hospital.country, 
         hospital.phone, hospital.email, hospital.specialties, hospital.category]
      );
      hospitalIds.push(hInsert.insertId);
      console.log(`  ✅ ${hospital.name}`);
    }
    console.log();

    // 3. Add doctors
    console.log('👨‍⚕️ Adding doctors...');
    const doctorData = [
      {
        name: 'Dr. Rajesh Kumar Singh',
        specialization: 'Ophthalmology & Lasik',
        hospital: 'Apollo Eye Hospital Delhi',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91-9900011111',
        email: 'rajesh@apollo.com',
        category: 'A'
      },
      {
        name: 'Dr. Priya Sharma',
        specialization: 'Retina & Vitreous',
        hospital: 'Apollo Eye Hospital Delhi',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91-9900022222',
        email: 'priya@apollo.com',
        category: 'A'
      },
      {
        name: 'Dr. Arun Mehta',
        specialization: 'Cataract & Lasik Surgery',
        hospital: 'Fortis Eye Hospital Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '+91-9900033333',
        email: 'arun@fortis.com',
        category: 'A'
      },
      {
        name: 'Dr. Anjali Desai',
        specialization: 'Pediatric Ophthalmology',
        hospital: 'Eye Care Medical Center Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        phone: '+91-9900044444',
        email: 'anjali@eyecare.in',
        category: 'B'
      }
    ];

    let doctorIds = [];
    for (const doctor of doctorData) {
      const dInsert = await db.query(
        `INSERT INTO doctors (name, specialization, hospital, city, state, phone, email, category, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [doctor.name, doctor.specialization, doctor.hospital, doctor.city, doctor.state, 
         doctor.phone, doctor.email, doctor.category]
      );
      doctorIds.push(dInsert.insertId);
      console.log(`  ✅ ${doctor.name}`);
    }
    console.log();

    // 4. Add 6 leads
    console.log('👥 Adding 6 leads with full details...');
    const leadData = [
      {
        patient_name: 'Rajesh Patel',
        phone: '+91-9910110001',
        email: 'rajesh.patel@email.com',
        city: 'Delhi',
        state: 'Delhi',
        eye_condition: 'Myopia with Astigmatism',
        treatment: 'Lasik Surgery',
        hospital: 'Apollo Eye Hospital Delhi',
        doctor_id: doctorIds[0],
        source: 'field',
        priority: 'high',
        notes: 'Severe myopia, candidate for Lasik after evaluation'
      },
      {
        patient_name: 'Priya Singhania',
        phone: '+91-9910110002',
        email: 'priya.singhania@email.com',
        city: 'Delhi',
        state: 'Delhi',
        eye_condition: 'Age-related Macular Degeneration',
        treatment: 'Retinal Imaging & Monitoring',
        hospital: 'Apollo Eye Hospital Delhi',
        doctor_id: doctorIds[1],
        source: 'referral',
        priority: 'high',
        notes: 'Requires specialized retinal care and regular monitoring'
      },
      {
        patient_name: 'Amitabh Gupta',
        phone: '+91-9910110003',
        email: 'amitabh.gupta@email.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        eye_condition: 'Cataracts',
        treatment: 'Cataract Surgery',
        hospital: 'Fortis Eye Hospital Mumbai',
        doctor_id: doctorIds[2],
        source: 'online',
        priority: 'medium',
        notes: 'Bilateral cataracts, needs surgery in both eyes'
      },
      {
        patient_name: 'Neha Verma',
        phone: '+91-9910110004',
        email: 'neha.verma@email.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        eye_condition: 'Refractive Error - Hyperopia',
        treatment: 'Glasses Prescription Update',
        hospital: 'Fortis Eye Hospital Mumbai',
        doctor_id: doctorIds[2],
        source: 'camp',
        priority: 'low',
        notes: 'Regular eye checkup needed, possible Lasik after evaluation'
      },
      {
        patient_name: 'Arjun Nair',
        phone: '+91-9910110005',
        email: 'arjun.nair@email.com',
        city: 'Bangalore',
        state: 'Karnataka',
        eye_condition: 'Pediatric Strabismus',
        treatment: 'Orthoptic Training & Surgery',
        hospital: 'Eye Care Medical Center Bangalore',
        doctor_id: doctorIds[3],
        source: 'referral',
        priority: 'high',
        notes: 'Child with eye misalignment, requires specialized pediatric care'
      },
      {
        patient_name: 'Deepa Chatterjee',
        phone: '+91-9910110006',
        email: 'deepa.chatterjee@email.com',
        city: 'Bangalore',
        state: 'Karnataka',
        eye_condition: 'Glaucoma Screening Positive',
        treatment: 'Glaucoma Management',
        hospital: 'Eye Care Medical Center Bangalore',
        doctor_id: doctorIds[3],
        source: 'field',
        priority: 'high',
        notes: 'Positive glaucoma screening, needs immediate specialist evaluation'
      }
    ];

    const addedLeadIds = [];
    for (const lead of leadData) {
      const lInsert = await db.query(
        `INSERT INTO leads 
         (uuid, patient_name, phone, email, city, state, country, eye_condition, treatment, hospital, doctor_id, assigned_to, source, priority, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'India', ?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW())`,
        [uuidv4(), lead.patient_name, lead.phone, lead.email, lead.city, lead.state, 
         lead.eye_condition, lead.treatment, lead.hospital, lead.doctor_id, assignedToId, 
         lead.source, lead.priority, lead.notes]
      );
      addedLeadIds.push(lInsert.insertId);
      console.log(`  ✅ ${lead.patient_name} → Hospital: ${lead.hospital}`);
    }
    console.log();

    // Summary
    console.log('='.repeat(70));
    console.log('✨ SETUP COMPLETE - SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n📊 Records Added:`);
    console.log(`   • Hospitals: ${hospitalIds.length} (IDs: ${hospitalIds.join(', ')})`);
    console.log(`   • Doctors: ${doctorIds.length} (IDs: ${doctorIds.join(', ')})`);
    console.log(`   • Leads: ${addedLeadIds.length} (IDs: ${addedLeadIds.join(', ')})`);
    console.log(`   • All leads assigned to Employee ID: ${assignedToId}`);
    console.log(`\n🏥 Hospitals:`);
    hospitalData.forEach((h, i) => console.log(`   ${i+1}. ${h.name} (ID: ${hospitalIds[i]})`));
    console.log(`\n👨‍⚕️ Doctors:`);
    doctorData.forEach((d, i) => console.log(`   ${i+1}. ${d.name} → ${d.specialization} (Doctor ID: ${doctorIds[i]})`));
    console.log(`\n👥 Leads Status: ALL NEW - Ready for Follow-up`);
    console.log('='.repeat(70));
    console.log();

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the function
addSampleLeads();
