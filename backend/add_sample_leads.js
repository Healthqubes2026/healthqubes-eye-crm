require('dotenv').config();
const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function addSampleLeads() {
  try {
    console.log('🔄 Checking/Creating coordinator employee...');
    
    // Check if there are any employees
    const existingEmployees = await db.query(`SELECT id FROM employees LIMIT 1`);
    let assignedToId = null;
    
    if (existingEmployees && existingEmployees.length > 0) {
      // Get the ID from the result - it might be in different property names
      const emp = existingEmployees[0];
      assignedToId = emp.id || Object.values(emp)[0];
      console.log(`✅ Found existing employee with ID: ${assignedToId}`);
    } else {
      // Create a default coordinator if none exists
      const bcryptjs = require('bcryptjs');
      const password = await bcryptjs.hash('password123', 10);
      const coordinatorResult = await db.query(
        `INSERT INTO employees (uuid, name, email, phone, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, ?, 'sales_coordinator', TRUE)`,
        [uuidv4(), 'Default Coordinator', 'coordinator@healthqubes.com', '+91-99999-99999', password]
      );
      assignedToId = coordinatorResult.insertId;
      console.log(`✅ Created default coordinator with ID: ${assignedToId}`);
    }

    console.log('\n🔄 Adding sample hospitals...');

    // Add sample hospitals
    const hospitals = [
      {
        name: 'Apollo Eye Hospital Delhi',
        address: '7, Condo Place, New Delhi',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        phone: '+91-11-41614123',
        email: 'info@apolloeye.com',
        website: 'www.apolloeye.com',
        lat: 28.5355,
        lng: 77.2107,
        specialties: JSON.stringify(['Ophthalmology', 'Retina', 'Cornea']),
        category: 'super_specialty',
        accreditation: 'NABH',
        emergency_services: true,
        international_patient_services: true
      },
      {
        name: 'Fortis Eye Hospital Mumbai',
        address: '154, Veer Savarkar Marg, Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        phone: '+91-22-67254321',
        email: 'info@fortiseye.com',
        website: 'www.fortiseye.com',
        lat: 19.0760,
        lng: 72.8777,
        specialties: JSON.stringify(['Ophthalmology', 'Lasik', 'Cataract']),
        category: 'tertiary',
        accreditation: 'JCI',
        emergency_services: true,
        international_patient_services: true
      },
      {
        name: 'Eye Care Medical Center Bangalore',
        address: '123 MG Road, Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        phone: '+91-80-41234567',
        email: 'contact@eyecare.in',
        website: 'www.eyecare.in',
        lat: 12.9716,
        lng: 77.5946,
        specialties: JSON.stringify(['Ophthalmology', 'Pediatric Eye Care', 'Glaucoma']),
        category: 'secondary',
        accreditation: 'ISO 9001',
        emergency_services: true,
        international_patient_services: false
      }
    ];

    let hospitalIds = [];
    for (const hospital of hospitals) {
      const result = await db.query(
        `INSERT INTO hospitals (name, address, city, state, country, phone, email, website, lat, lng, specialties, category, accreditation, emergency_services, international_patient_services)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hospital.name, hospital.address, hospital.city, hospital.state, hospital.country,
          hospital.phone, hospital.email, hospital.website, hospital.lat, hospital.lng,
          hospital.specialties, hospital.category, hospital.accreditation,
          hospital.emergency_services, hospital.international_patient_services
        ]
      );
      hospitalIds.push(result.insertId);
      console.log(`✅ Added hospital: ${hospital.name}`);
    }

    console.log('\n🔄 Adding sample doctors...');

    // Add sample doctors
    const doctors = [
      {
        name: 'Dr. Rajesh Kumar Singh',
        specialization: 'Ophthalmology & Lasik',
        hospital: 'Apollo Eye Hospital Delhi',
        address: 'Apollo Eye Hospital Delhi, Condo Place, New Delhi',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91-99000-11111',
        email: 'dr.rajesh@apollo.com',
        category: 'A'
      },
      {
        name: 'Dr. Priya Sharma',
        specialization: 'Retina & Vitreous',
        hospital: 'Apollo Eye Hospital Delhi',
        address: 'Apollo Eye Hospital Delhi, Condo Place, New Delhi',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91-99000-22222',
        email: 'dr.priya@apollo.com',
        category: 'A'
      },
      {
        name: 'Dr. Arun Mehta',
        specialization: 'Cataract & Lasik Surgery',
        hospital: 'Fortis Eye Hospital Mumbai',
        address: 'Fortis Eye Hospital Mumbai, Veer Savarkar Marg',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '+91-99000-33333',
        email: 'dr.arun@fortis.com',
        category: 'A'
      },
      {
        name: 'Dr. Anjali Desai',
        specialization: 'Pediatric Ophthalmology',
        hospital: 'Eye Care Medical Center Bangalore',
        address: 'Eye Care Medical Center Bangalore, MG Road',
        city: 'Bangalore',
        state: 'Karnataka',
        phone: '+91-99000-44444',
        email: 'dr.anjali@eyecare.in',
        category: 'B'
      }
    ];

    let doctorIds = [];
    for (const doctor of doctors) {
      const result = await db.query(
        `INSERT INTO doctors (name, specialization, hospital, address, city, state, phone, email, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doctor.name, doctor.specialization, doctor.hospital, doctor.address, doctor.city,
          doctor.state, doctor.phone, doctor.email, doctor.category
        ]
      );
      doctorIds.push(result.insertId);
      console.log(`✅ Added doctor: ${doctor.name}`);
    }

    console.log('\n🔄 Adding 6 sample leads with hospital and doctor assignments...');

    // Get a coordinator to assign leads to - fallback to any employee
    let assignedTo = 1;
    try {
      const coordinatorResult = await db.query(`SELECT id FROM employees WHERE role = 'sales_coordinator' LIMIT 1`);
      if (coordinatorResult.length > 0) {
        assignedTo = coordinatorResult[0].id;
      } else {
        const employeeResult = await db.query(`SELECT id FROM employees LIMIT 1`);
        if (employeeResult.length > 0) {
          assignedTo = employeeResult[0].id;
        }
      }
    } catch (err) {
      console.log('⚠️  Using default assigned_to ID: 1');
      assignedTo = 1;
    }

    // Add 6 sample leads
    const leads = [
      {
        patient_name: 'Rajesh Patel',
        phone: '+91-99101-10001',
        email: 'rajesh.patel@email.com',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
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
        phone: '+91-99101-10002',
        email: 'priya.singhania@email.com',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
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
        phone: '+91-99101-10003',
        email: 'amitabh.gupta@email.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
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
        phone: '+91-99101-10004',
        email: 'neha.verma@email.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
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
        phone: '+91-99101-10005',
        email: 'arjun.nair@email.com',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
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
        phone: '+91-99101-10006',
        email: 'deepa.chatterjee@email.com',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        eye_condition: 'Glaucoma Screening Positive',
        treatment: 'Glaucoma Management',
        hospital: 'Eye Care Medical Center Bangalore',
        doctor_id: doctorIds[3],
        source: 'field',
        priority: 'high',
        notes: 'Positive glaucoma screening, needs immediate specialist evaluation'
      }
    ];

    let addedLeads = [];
    for (const lead of leads) {
      const uuid = uuidv4();
      const result = await db.query(
        `INSERT INTO leads (uuid, patient_name, phone, email, city, state, country, eye_condition, treatment, hospital, doctor_id, assigned_to, source, priority, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
        [
          uuid, lead.patient_name, lead.phone, lead.email, lead.city, lead.state, lead.country,
          lead.eye_condition, lead.treatment, lead.hospital, lead.doctor_id, assignedToId,
          lead.source, lead.priority, lead.notes
        ]
      );
      addedLeads.push(result.insertId);
      console.log(`✅ Added lead: ${lead.patient_name} - Hospital: ${lead.hospital} - Doctor: ${lead.doctor_id}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Added ${hospitals.length} hospitals`);
    console.log(`✅ Added ${doctors.length} doctors`);
    console.log(`✅ Added ${leads.length} leads with hospital and doctor assignments`);
    console.log('\n📋 Details:');
    console.log(`   - Hospitals: ${hospitals.map(h => h.name).join(', ')}`);
    console.log(`   - Leads assigned to Employee ID: ${assignedToId}`);
    console.log(`   - All leads status: NEW`);
    console.log(`   - Leads have specific eye conditions and treatment plans`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding sample leads:', error);
    process.exit(1);
  }
}

addSampleLeads();
