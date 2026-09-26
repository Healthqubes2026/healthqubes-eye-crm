require('dotenv').config();
const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function seedAllData() {
  try {
    console.log('🚀 Starting comprehensive lead seeding setup...\n');

    // Step 1: Verify/Create employee
    const [employees] = await db.query('SELECT * FROM employees LIMIT 1');
    let coordinatorId = 1;
    
    if (!employees || employees.length === 0) {
      console.log('📝 Creating default coordinator employee...');
      const bcryptjs = require('bcryptjs');
      const pwd = await bcryptjs.hash('password123', 10);
      await db.query(
        `INSERT INTO employees (uuid, name, email, phone, password_hash, role, is_active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uuidv4(), 'Lead Coordinator', 'coordinator@healthqubes.com', '+91-99999-99999', pwd, 'sales_coordinator', true]
      );
      // Get the ID we just created
      const [result] = await db.query('SELECT id FROM employees WHERE role = ? ORDER BY id DESC LIMIT 1', ['sales_coordinator']);
      coordinatorId = result[0]?.id || 1;
    } else {
      coordinatorId = employees[0].id;
    }
    console.log(`✅ Coordinator Employee ID: ${coordinatorId}\n`);

    // Step 2: Add hospitals
    console.log('🏥 Adding 3 hospitals...');
    const hospitalInserts = [];
    
    const hospitals = [
      ['Apollo Eye Hospital Delhi', '7, Condo Place, New Delhi', 'Delhi', 'Delhi', 'India', '+91-11-41614123', 'info@apolloeye.com', 'super_specialty'],
      ['Fortis Eye Hospital Mumbai', '154, Veer Savarkar Marg, Mumbai', 'Mumbai', 'Maharashtra', 'India', '+91-22-67254321', 'info@fortiseye.com', 'tertiary'],
      ['Eye Care Medical Center Bangalore', '123 MG Road, Bangalore', 'Bangalore', 'Karnataka', 'India', '+91-80-41234567', 'contact@eyecare.in', 'secondary']
    ];

    for (const hospital of hospitals) {
      await db.query(
        `INSERT INTO hospitals (name, address, city, state, country, phone, email, category, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        hospital
      );
      hospitalInserts.push(hospital[0]);
        console.log(`  ✅ ${hospital[0]}`);
    }

    // Get hospital IDs  
    const [hospitalsData] = await db.query('SELECT id, name FROM hospitals ORDER BY id DESC LIMIT 3');
    const hospitalIds = hospitalsData.reverse().map(h => h.id);
    console.log(`   Hospital IDs: ${hospitalIds.join(', ')}\n`);

    // Step 3: Add doctors
    console.log('👨‍⚕️ Adding 4 doctors...');
    const doctors = [
      ['Dr. Rajesh Kumar Singh', 'Ophthalmology & Lasik', 'Apollo Eye Hospital Delhi', 'Delhi', 'Delhi', '+91-9900011111', 'rajesh@apollo.com', 'A'],
      ['Dr. Priya Sharma', 'Retina & Vitreous', 'Apollo Eye Hospital Delhi', 'Delhi', 'Delhi', '+91-9900022222', 'priya@apollo.com', 'A'],
      ['Dr. Arun Mehta', 'Cataract & Lasik Surgery', 'Fortis Eye Hospital Mumbai', 'Mumbai', 'Maharashtra', '+91-9900033333', 'arun@fortis.com', 'A'],
      ['Dr. Anjali Desai', 'Pediatric Ophthalmology', 'Eye Care Medical Center Bangalore', 'Bangalore', 'Karnataka', '+91-9900044444', 'anjali@eyecare.in', 'B']
    ];

    for (const doctor of doctors) {
      await db.query(
        `INSERT INTO doctors (name, specialization, hospital, city, state, phone, email, category, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        doctor
      );
      console.log(`  ✅ ${doctor[0]}`);
    }

    // Get doctor IDs
    const [doctorsData] = await db.query('SELECT id, name FROM doctors ORDER BY id DESC LIMIT 4');
    const doctorIds = doctorsData.reverse().map(d => d.id);
    console.log(`   Doctor IDs: ${doctorIds.join(', ')}\n`);

    // Step 4: Add 6 leads
    console.log('👥 Adding 6 leads with full details...');
    const leads = [
      {
        name: 'Rajesh Patel',
        phone: '+91-9910110001',
        email: 'rajesh.patel@email.com',
        city: 'Delhi',
        state: 'Delhi',
        condition: 'Myopia with Astigmatism',
        treatment: 'Lasik Surgery',
        hospital: 'Apollo Eye Hospital Delhi',
        doctor_id: doctorIds[0],
        source: 'field',
        priority: 'high',
        notes: 'Severe myopia, candidate for Lasik after evaluation'
      },
      {
        name: 'Priya Singhania',
        phone: '+91-9910110002',
        email: 'priya.singhania@email.com',
        city: 'Delhi',
        state: 'Delhi',
        condition: 'Age-related Macular Degeneration',
        treatment: 'Retinal Imaging & Monitoring',
        hospital: 'Apollo Eye Hospital Delhi',
        doctor_id: doctorIds[1],
        source: 'referral',
        priority: 'high',
        notes: 'Requires specialized retinal care'
      },
      {
        name: 'Amitabh Gupta',
        phone: '+91-9910110003',
        email: 'amitabh.gupta@email.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        condition: 'Cataracts',
        treatment: 'Cataract Surgery',
        hospital: 'Fortis Eye Hospital Mumbai',
        doctor_id: doctorIds[2],
        source: 'online',
        priority: 'medium',
        notes: 'Bilateral cataracts'
      },
      {
        name: 'Neha Verma',
        phone: '+91-9910110004',
        email: 'neha.verma@email.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        condition: 'Hyperopia',
        treatment: 'Glasses Prescription',
        hospital: 'Fortis Eye Hospital Mumbai',
        doctor_id: doctorIds[2],
        source: 'camp',
        priority: 'low',
        notes: 'Routine eye checkup'
      },
      {
        name: 'Arjun Nair',
        phone: '+91-9910110005',
        email: 'arjun.nair@email.com',
        city: 'Bangalore',
        state: 'Karnataka',
        condition: 'Pediatric Strabismus',
        treatment: 'Eye Training & Surgery',
        hospital: 'Eye Care Medical Center Bangalore',
        doctor_id: doctorIds[3],
        source: 'referral',
        priority: 'high',
        notes: 'Child eye misalignment'
      },
      {
        name: 'Deepa Chatterjee',
        phone: '+91-9910110006',
        email: 'deepa.chatterjee@email.com',
        city: 'Bangalore',
        state: 'Karnataka',
        condition: 'Glaucoma Positive',
        treatment: 'Glaucoma Management',
        hospital: 'Eye Care Medical Center Bangalore',
        doctor_id: doctorIds[3],
        source: 'field',
        priority: 'high',
        notes: 'Glaucoma screening positive'
      }
    ];

    const leadIds = [];
    for (const lead of leads) {
      await db.query(
        `INSERT INTO leads (uuid, patient_name, phone, email, city, state, country, eye_condition, treatment, hospital, doctor_id, assigned_to, source, priority, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'India', ?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW())`,
        [uuidv4(), lead.name, lead.phone, lead.email, lead.city, lead.state, lead.condition, lead.treatment, lead.hospital, lead.doctor_id, coordinatorId, lead.source, lead.priority, lead.notes]
      );
    }

    // Get lead IDs
    const [leadsData] = await db.query('SELECT id, patient_name FROM leads ORDER BY id DESC LIMIT 6');
    const finalLeadIds = leadsData.reverse().map(l => l.id);

    for (const lead of leads) {
      console.log(`  ✅ ${lead.name} → ${lead.hospital} (Doctor ID: ${lead.doctor_id})`);
    }
    console.log(`   Lead IDs: ${finalLeadIds.join(', ')}\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('✨ SEEDING COMPLETE - SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n📊 RECORDS INSERTED:`);
    console.log(`   💼 Hospitals: 3 (IDs: ${hospitalIds.join(', ')})`);
    console.log(`   👨‍⚕️  Doctors: 4 (IDs: ${doctorIds.join(', ')})`);
    console.log(`   👥 Leads: 6 (IDs: ${finalLeadIds.join(', ')})`);
    console.log(`   👤 Coordinator: ID ${coordinatorId}\n`);

    console.log(`🏥 HOSPITALS:`);
    hospitalInserts.forEach((h, i) => console.log(`   ${i+1}. ${h}`));
    
    console.log(`\n👨‍⚕️ DOCTORS:`);
    doctors.forEach((d, i) => {
      console.log(`   ${i+1}. ${d[0]} - ${d[1]}`);
    });

    console.log(`\n📋 LEADS STATUS: ALL NEW - Ready for Follow-up`);
    console.log('='.repeat(80));
    console.log('\n✅ All data seeded successfully!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.sql) console.error('SQL:', error.sql);
    console.error(error);
    process.exit(1);
  }
}

seedAllData();
