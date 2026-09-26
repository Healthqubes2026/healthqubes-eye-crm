require('dotenv').config();
const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');
const bcryptjs = require('bcryptjs');

const SAMPLE_HOSPITALS = [
  {
    name: 'Apollo Eye Hospital Delhi',
    address: '7, Condo Place, New Delhi',
    city: 'Delhi',
    state: 'Delhi',
    country: 'India',
    phone: '+91-11-41614123',
    email: 'info@apolloeye.com',
    website: 'https://www.apolloeye.com',
    specialties: JSON.stringify(['Ophthalmology', 'Retina', 'Cornea']),
    category: 'super_specialty',
    accreditation: 'NABH',
    emergency_services: true,
    international_patient_services: true,
  },
  {
    name: 'Fortis Eye Hospital Mumbai',
    address: '154, Veer Savarkar Marg, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    phone: '+91-22-67254321',
    email: 'info@fortiseye.com',
    website: 'https://www.fortiseye.com',
    specialties: JSON.stringify(['Ophthalmology', 'Lasik', 'Cataract']),
    category: 'tertiary',
    accreditation: 'JCI',
    emergency_services: true,
    international_patient_services: true,
  },
  {
    name: 'Eye Care Medical Center Bangalore',
    address: '123 MG Road, Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    phone: '+91-80-41234567',
    email: 'contact@eyecare.in',
    website: 'https://www.eyecare.in',
    specialties: JSON.stringify(['Ophthalmology', 'Pediatric Eye Care', 'Glaucoma']),
    category: 'secondary',
    accreditation: 'ISO 9001',
    emergency_services: true,
    international_patient_services: false,
  },
  {
    name: 'Narayana Nethralaya Chennai',
    address: '121, Ashok Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    phone: '+91-44-24350000',
    email: 'hello@narayananetralaya.org',
    website: 'https://www.narayanahealth.org',
    specialties: JSON.stringify(['Cataract', 'Retina', 'Oculoplasty']),
    category: 'super_specialty',
    accreditation: 'NABH',
    emergency_services: true,
    international_patient_services: true,
  },
  {
    name: 'Aravind Eye Hospital Coimbatore',
    address: '43, Race Course Road, Coimbatore',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    country: 'India',
    phone: '+91-422-2436100',
    email: 'contact@aravind.org',
    website: 'https://www.aravind.org',
    specialties: JSON.stringify(['Cataract', 'Cornea', 'Glaucoma']),
    category: 'super_specialty',
    accreditation: 'NABH',
    emergency_services: true,
    international_patient_services: true,
  }
];

const SAMPLE_DOCTORS = [
  {
    name: 'Dr. Rajesh Kumar Singh',
    specialization: 'Ophthalmology & Lasik',
    hospital: 'Apollo Eye Hospital Delhi',
    city: 'Delhi',
    state: 'Delhi',
    phone: '+91-9900011111',
    email: 'rajesh.singh@apollo.com',
    category: 'A',
  },
  {
    name: 'Dr. Priya Sharma',
    specialization: 'Retina & Vitreous',
    hospital: 'Apollo Eye Hospital Delhi',
    city: 'Delhi',
    state: 'Delhi',
    phone: '+91-9900022222',
    email: 'priya.sharma@apollo.com',
    category: 'A',
  },
  {
    name: 'Dr. Arun Mehta',
    specialization: 'Cataract & Lasik Surgery',
    hospital: 'Fortis Eye Hospital Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    phone: '+91-9900033333',
    email: 'arun.mehta@fortis.com',
    category: 'A',
  },
  {
    name: 'Dr. Anjali Desai',
    specialization: 'Pediatric Ophthalmology',
    hospital: 'Eye Care Medical Center Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    phone: '+91-9900044444',
    email: 'anjali.desai@eyecare.in',
    category: 'B',
  },
  {
    name: 'Dr. Sameer Kapoor',
    specialization: 'Glaucoma & Cornea',
    hospital: 'Narayana Nethralaya Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    phone: '+91-9900055555',
    email: 'sameer.kapoor@narayanahealth.org',
    category: 'A',
  },
  {
    name: 'Dr. Meenakshi Rao',
    specialization: 'Oculoplasty & Squint',
    hospital: 'Aravind Eye Hospital Coimbatore',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    phone: '+91-9900066666',
    email: 'meenakshi.rao@aravind.org',
    category: 'B',
  }
];

const TREATMENT_CATEGORIES = [
  { name: 'Lasik', description: 'Laser vision correction procedure', estimated_days: 1, category_type: 'surgery' },
  { name: 'Cataract Surgery', description: 'Lens replacement surgery for cataracts', estimated_days: 2, category_type: 'surgery' },
  { name: 'Retina Treatment', description: 'Retinal care and surgery', estimated_days: 5, category_type: 'treatment' },
  { name: 'Glaucoma Management', description: 'Medication and follow-up for glaucoma', estimated_days: 7, category_type: 'treatment' },
  { name: 'Pediatric Eye Care', description: 'Child eye care and surgery', estimated_days: 3, category_type: 'consultation' }
];

const leadNames = [
  'Aarav Sharma', 'Isha Mehta', 'Kabir Singh', 'Sana Patel', 'Reyansh Desai', 'Ananya Rao',
  'Vivaan Kumar', 'Diya Joshi', 'Ayaan Kapoor', 'Myra Iyer', 'Rohan Nair', 'Kiara Gupta',
  'Aditya Bhat', 'Nisha Reddy', 'Karan Chauhan', 'Aditi Mishra', 'Veer Sood', 'Meera Sharma',
  'Dhruv Jain', 'Anika Verma', 'Arjun Singh', 'Riya Shah', 'Sai Patel', 'Tara Nair',
  'Yash Sharma', 'Pooja Agarwal', 'Neil Khanna', 'Simran Kaur', 'Aryan Reddy', 'Isha Bhatt',
  'Kavya Das', 'Aarohi Sen', 'Ritik Mehra', 'Naina Kapoor', 'Shaurya Joshi', 'Sakshi Rao',
  'Vivaan Chopra', 'Anjali Deshmukh', 'Rudra Gupta', 'Suhani Singh'
];

const eyeConditions = [
  { condition: 'Myopia', treatment: 'Lasik Surgery' },
  { condition: 'Hyperopia', treatment: 'Spectacle Prescription' },
  { condition: 'Astigmatism', treatment: 'LASIK/PRK' },
  { condition: 'Cataract', treatment: 'Cataract Surgery' },
  { condition: 'Retinal Detachment', treatment: 'Retina Treatment' },
  { condition: 'Glaucoma', treatment: 'Glaucoma Management' },
  { condition: 'Pediatric Squint', treatment: 'Pediatric Eye Care' },
  { condition: 'Dry Eye', treatment: 'Medical Management' },
];

const sources = ['field', 'referral', 'online', 'camp', 'other'];
const statuses = ['new', 'contacted', 'follow_up', 'converted', 'closed'];
const priorities = ['high', 'medium', 'low'];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const phoneNumber = (index) => `+91-99${String(100000 + index).slice(1)}`;

async function ensureEmployees() {
  const employees = await db.query(`SELECT id, role FROM employees WHERE role IN ('sales_coordinator','case_manager','manager')`);
  const result = {};

  if (employees.length >= 3) {
    employees.forEach((emp) => { result[emp.role] = emp.id; });
    return result;
  }

  const existing = await db.query(`SELECT id, role FROM employees LIMIT 1`);
  if (existing.length === 0) {
    console.log('⚙️ Creating default admin employee...');
    const password = await bcryptjs.hash('Password@123', 10);
    const res = await db.query(
      `INSERT INTO employees (uuid, name, email, phone, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 'manager', TRUE, NOW())`,
      [uuidv4(), 'Default Manager', 'manager@healthqube.com', '+91-9999900000', password]
    );
    result.manager = res.insertId;
  } else {
    result.manager = existing[0].id;
  }

  const joinEmployee = async (role, name, email, phone) => {
    if (result[role]) return;
    const password = await bcryptjs.hash('Password@123', 10);
    const res = await db.query(
      `INSERT INTO employees (uuid, name, email, phone, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [uuidv4(), name, email, phone, password, role]
    );
    result[role] = res.insertId;
  };

  await joinEmployee('sales_coordinator', 'Sales Coordinator', 'sales@healthqube.com', '+91-9999900001');
  await joinEmployee('case_manager', 'Case Manager', 'case@healthqube.com', '+91-9999900002');
  await joinEmployee('manager', 'Account Manager', 'account@healthqube.com', '+91-9999900003');

  return result;
}

async function ensureHospitals() {
  const existing = await db.query(`SELECT id, name FROM hospitals WHERE name IN (${SAMPLE_HOSPITALS.map(() => '?').join(',')})`, SAMPLE_HOSPITALS.map((h) => h.name));
  const existingNames = existing.map((row) => row.name);
  const inserted = [];

  for (const hospital of SAMPLE_HOSPITALS) {
    if (existingNames.includes(hospital.name)) {
      const row = existing.find((r) => r.name === hospital.name);
      inserted.push({ ...hospital, id: row.id });
      continue;
    }
    const res = await db.query(
      `INSERT INTO hospitals
       (name, address, city, state, country, phone, email, website, lat, lng, specialties, category, accreditation, emergency_services, international_patient_services, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        hospital.name, hospital.address, hospital.city, hospital.state, hospital.country,
        hospital.phone, hospital.email, hospital.website, hospital.lat || null, hospital.lng || null,
        hospital.specialties, hospital.category, hospital.accreditation,
        hospital.emergency_services, hospital.international_patient_services
      ]
    );
    inserted.push({ ...hospital, id: res.insertId });
  }

  return inserted;
}

async function ensureDoctors() {
  const existing = await db.query(`SELECT id, name FROM doctors WHERE name IN (${SAMPLE_DOCTORS.map(() => '?').join(',')})`, SAMPLE_DOCTORS.map((d) => d.name));
  const existingNames = existing.map((row) => row.name);
  const inserted = [];

  for (const doctor of SAMPLE_DOCTORS) {
    if (existingNames.includes(doctor.name)) {
      const row = existing.find((r) => r.name === doctor.name);
      inserted.push({ ...doctor, id: row.id });
      continue;
    }
    const res = await db.query(
      `INSERT INTO doctors
       (name, specialization, hospital, address, city, state, phone, email, category, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        doctor.name, doctor.specialization, doctor.hospital, doctor.hospital,
        doctor.city, doctor.state, doctor.phone, doctor.email, doctor.category
      ]
    );
    inserted.push({ ...doctor, id: res.insertId });
  }
  return inserted;
}

async function ensureTreatmentCategories() {
  const existing = await db.query(`SELECT id, name FROM treatment_categories WHERE name IN (${TREATMENT_CATEGORIES.map(() => '?').join(',')})`, TREATMENT_CATEGORIES.map((t) => t.name));
  const existingNames = existing.map((row) => row.name);
  const inserted = [];

  for (const category of TREATMENT_CATEGORIES) {
    if (existingNames.includes(category.name)) {
      const row = existing.find((r) => r.name === category.name);
      inserted.push({ ...category, id: row.id });
      continue;
    }
    const res = await db.query(
      `INSERT INTO treatment_categories (name, description, estimated_days, category_type, is_active, created_at)
       VALUES (?, ?, ?, ?, TRUE, NOW())`,
      [category.name, category.description, category.estimated_days, category.category_type]
    );
    inserted.push({ ...category, id: res.insertId });
  }
  return inserted;
}

async function addLeads(employeeIds, hospitals, doctors, treatmentCategories) {
  console.log('🔄 Adding 40 leads with full details...');
  const addedLeadIds = [];

  for (let index = 0; index < 40; index++) {
    const name = leadNames[index];
    const contact = phoneNumber(index + 1);
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const city = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Coimbatore'][index % 5];
    const state = city === 'Mumbai' ? 'Maharashtra' : city === 'Bangalore' ? 'Karnataka' : city === 'Chennai' || city === 'Coimbatore' ? 'Tamil Nadu' : 'Delhi';
    const country = 'India';
    const condition = eyeConditions[index % eyeConditions.length];
    const status = statuses[index % statuses.length];
    const priority = priorities[index % priorities.length];
    const source = sources[index % sources.length];
    const hospital = hospitals[index % hospitals.length];
    const doctor = doctors[index % doctors.length];
    const followUpDate = status === 'follow_up' ? new Date(Date.now() + ((index % 10) + 2) * 24 * 60 * 60 * 1000) : null;
    const convertedAt = status === 'converted' ? new Date(Date.now() - ((index % 20) + 2) * 24 * 60 * 60 * 1000) : null;

    const lead = {
      uuid: uuidv4(),
      patient_name: name,
      phone: contact,
      email,
      country,
      city,
      state,
      eye_condition: `${condition.condition} with ${['dry eye','astigmatism','blurred vision'][index % 3]}`,
      treatment: condition.treatment,
      hospital: hospital.name,
      doctor_id: doctor.id,
      assigned_to: employeeIds.sales_coordinator,
      source,
      priority,
      status,
      notes: `Lead created for ${name}. ${condition.condition} requiring ${condition.treatment}. Needs follow-up by field agent.`,
      reports: JSON.stringify({ initial_assessment: `Patient requires ${condition.treatment.toLowerCase()}.`, risk_score: 70 + index % 20 }),
      follow_up_date: followUpDate ? followUpDate.toISOString().slice(0, 10) : null,
      converted_at: convertedAt ? convertedAt.toISOString().slice(0, 10) : null,
    };

    const res = await db.query(
      `INSERT INTO leads
       (uuid, patient_name, phone, email, country, city, state, eye_condition, treatment, hospital, doctor_id, assigned_to, status, follow_up_date, priority, source, notes, reports, converted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        lead.uuid, lead.patient_name, lead.phone, lead.email, lead.country, lead.city,
        lead.state, lead.eye_condition, lead.treatment, lead.hospital, lead.doctor_id,
        lead.assigned_to, lead.status, lead.follow_up_date, lead.priority, lead.source,
        lead.notes, lead.reports, lead.converted_at
      ]
    );

    addedLeadIds.push(res.insertId);
  }

  console.log(`✅ Added ${addedLeadIds.length} leads`);
  return addedLeadIds;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function addQuotations(leadIds, hospitalIds, doctorIds, treatmentCategories, employeeIds) {
  console.log('💰 Adding 5 quotations...');
  const quotationPayloads = [
    {
      leadId: leadIds[0],
      hospitalId: hospitalIds[0],
      doctorId: doctorIds[0],
      treatmentCategoryId: treatmentCategories.find((c) => c.name === 'Lasik').id,
      base_cost: 85000,
      accommodation_cost: 12000,
      transport_cost: 4000,
      visa_support_cost: 6000,
      miscellaneous_cost: 2500,
      currency: 'INR',
    },
    {
      leadId: leadIds[5],
      hospitalId: hospitalIds[1],
      doctorId: doctorIds[2],
      treatmentCategoryId: treatmentCategories.find((c) => c.name === 'Cataract Surgery').id,
      base_cost: 65000,
      accommodation_cost: 10000,
      transport_cost: 3500,
      visa_support_cost: 5000,
      miscellaneous_cost: 1800,
      currency: 'INR',
    },
    {
      leadId: leadIds[10],
      hospitalId: hospitalIds[2],
      doctorId: doctorIds[3],
      treatmentCategoryId: treatmentCategories.find((c) => c.name === 'Glaucoma Management').id,
      base_cost: 35000,
      accommodation_cost: 9000,
      transport_cost: 2500,
      visa_support_cost: 4500,
      miscellaneous_cost: 2200,
      currency: 'INR',
    },
    {
      leadId: leadIds[15],
      hospitalId: hospitalIds[3],
      doctorId: doctorIds[4],
      treatmentCategoryId: treatmentCategories.find((c) => c.name === 'Retina Treatment').id,
      base_cost: 95000,
      accommodation_cost: 15000,
      transport_cost: 5000,
      visa_support_cost: 7000,
      miscellaneous_cost: 3200,
      currency: 'INR',
    },
    {
      leadId: leadIds[20],
      hospitalId: hospitalIds[4],
      doctorId: doctorIds[5],
      treatmentCategoryId: treatmentCategories.find((c) => c.name === 'Pediatric Eye Care').id,
      base_cost: 45000,
      accommodation_cost: 11000,
      transport_cost: 3000,
      visa_support_cost: 5500,
      miscellaneous_cost: 2000,
      currency: 'INR',
    }
  ];

  const addedIds = [];
  for (const item of quotationPayloads) {
    const total_cost = item.base_cost + item.accommodation_cost + item.transport_cost + item.visa_support_cost + item.miscellaneous_cost;
    const [res] = await db.query(
      `INSERT INTO quotations
       (uuid, lead_id, hospital_id, doctor_id, treatment_category_id, quotation_date, valid_until, base_cost, accommodation_cost, transport_cost, visa_support_cost, miscellaneous_cost, total_cost, currency, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), item.leadId, item.hospitalId, item.doctorId, item.treatmentCategoryId,
        addDays(0), addDays(10), item.base_cost, item.accommodation_cost, item.transport_cost,
        item.visa_support_cost, item.miscellaneous_cost, total_cost, item.currency, employeeIds.manager
      ]
    );
    addedIds.push(res.insertId);
  }

  console.log(`✅ Added ${addedIds.length} quotations`);
  return addedIds;
}

async function addTasks(leadIds, employeeIds) {
  console.log('📝 Adding 5 tasks...');
  const taskPayloads = [
    {
      leadId: leadIds[2],
      title: 'Follow up on consultation package',
      description: 'Call the patient and confirm package details after initial consultation.',
      assignedTo: employeeIds.case_manager,
      dueDate: addDays(3),
      priority: 'high',
    },
    {
      leadId: leadIds[7],
      title: 'Schedule retinal scan',
      description: 'Book retinal imaging appointment and share schedule with patient.',
      assignedTo: employeeIds.sales_coordinator,
      dueDate: addDays(5),
      priority: 'medium',
    },
    {
      leadId: leadIds[12],
      title: 'Verify patient documents',
      description: 'Check passport and medical documents before sending quotation.',
      assignedTo: employeeIds.case_manager,
      dueDate: addDays(4),
      priority: 'high',
    },
    {
      leadId: leadIds[18],
      title: 'Confirm accommodation booking',
      description: 'Confirm hotel availability for patient during treatment stay.',
      assignedTo: employeeIds.sales_coordinator,
      dueDate: addDays(6),
      priority: 'medium',
    },
    {
      leadId: leadIds[25],
      title: 'Update patient hospital assignment',
      description: 'Assign hospital based on doctor recommendation and update lead notes.',
      assignedTo: employeeIds.case_manager,
      dueDate: addDays(7),
      priority: 'medium',
    }
  ];

  const addedIds = [];
  for (const item of taskPayloads) {
    const [res] = await db.query(
      `INSERT INTO tasks (lead_id, title, description, assigned_to, created_by, priority, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [item.leadId, item.title, item.description, item.assignedTo, employeeIds.manager, item.priority, item.dueDate]
    );
    addedIds.push(res.insertId);
  }

  console.log(`✅ Added ${addedIds.length} tasks`);
  return addedIds;
}

async function run() {
  try {
    console.log('🚀 Starting sample data generation...');

    const employeeIds = await ensureEmployees();
    const hospitals = await ensureHospitals();
    const doctors = await ensureDoctors();
    const treatmentCategories = await ensureTreatmentCategories();

    const leadIds = await addLeads(employeeIds, hospitals, doctors, treatmentCategories);
    const quotationIds = await addQuotations(leadIds, hospitals.map((h) => h.id), doctors.map((d) => d.id), treatmentCategories, employeeIds);
    const taskIds = await addTasks(leadIds, employeeIds);

    console.log('\n✅ Sample data import complete.');
    console.log(`   • Leads created: ${leadIds.length}`);
    console.log(`   • Quotations created: ${quotationIds.length}`);
    console.log(`   • Tasks created: ${taskIds.length}`);
    console.log('\nRun `node add_sample_full_data.js` from the backend folder to recreate.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating sample data:', error.message || error);
    process.exit(1);
  }
}

run();
