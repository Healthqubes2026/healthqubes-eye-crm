require('dotenv').config();
const db = require('./src/config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const employees = [
  { name: 'Nikhil Rao', email: 'nikhil.rao@healthqubes.in', phone: '9000000021', role: 'sales_coordinator', zone: 'West Bengaluru' },
  { name: 'Sneha Kapoor', email: 'sneha.kapoor@healthqubes.in', phone: '9000000022', role: 'sales_coordinator', zone: 'East Bengaluru' },
  { name: 'Arun Menon', email: 'arun.menon@healthqubes.in', phone: '9000000023', role: 'case_manager', zone: 'North Bengaluru' },
  { name: 'Manisha Gupta', email: 'manisha.gupta@healthqubes.in', phone: '9000000024', role: 'case_manager', zone: 'South Bengaluru' },
  { name: 'Karthik Sharma', email: 'karthik.sharma@healthqubes.in', phone: '9000000025', role: 'manager', zone: 'Central Bengaluru' },
  { name: 'Pavithra Nair', email: 'pavithra.nair@healthqubes.in', phone: '9000000026', role: 'manager', zone: 'North Bengaluru' },
];

const sampleLeads = [
  {
    patient_name: 'Meera Joshi',
    phone: '9100000101',
    whatsapp: '9100000101',
    email: 'meera.joshi@example.com',
    country: 'India',
    city: 'Bengaluru',
    state: 'Karnataka',
    eye_condition: 'Cataract',
    treatment: 'Cataract Surgery',
    hospital: 'Apollo Eye Hospital Delhi',
    doctor_id: null,
    assigned_to_role: 'sales_coordinator',
    status: 'contacted',
    priority: 'high',
    source: 'referral',
    notes: 'Patient has stage 2 cataract and needs confirmation for surgery in 1 week.',
    reports: [
      '/uploads/reports/cataract_scan_meera.pdf',
      '/uploads/reports/pre_op_report_meera.pdf'
    ]
  },
  {
    patient_name: 'Vikram Singh',
    phone: '9100000102',
    whatsapp: '9100000102',
    email: 'vikram.singh@example.com',
    country: 'India',
    city: 'Mumbai',
    state: 'Maharashtra',
    eye_condition: 'Glaucoma',
    treatment: 'Glaucoma Management',
    hospital: 'Fortis Eye Hospital Mumbai',
    doctor_id: null,
    assigned_to_role: 'case_manager',
    status: 'follow_up',
    priority: 'medium',
    source: 'online',
    notes: 'Patient has early glaucoma, follow up scheduled after pressure test.',
    reports: [
      '/uploads/reports/glaucoma_pressure_report_vikram.pdf'
    ]
  },
  {
    patient_name: 'Shreya Patel',
    phone: '9100000103',
    whatsapp: '9100000103',
    email: 'shreya.patel@example.com',
    country: 'India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    eye_condition: 'Retinal Detachment',
    treatment: 'Retina Treatment',
    hospital: 'Narayana Nethralaya Chennai',
    doctor_id: null,
    assigned_to_role: 'sales_coordinator',
    status: 'new',
    priority: 'high',
    source: 'camp',
    notes: 'Urgent retina review needed. Patient is ready for hospital admission.',
    reports: [
      '/uploads/reports/retina_scan_shreya.pdf',
      '/uploads/reports/medical_history_shreya.pdf',
      '/uploads/reports/insurance_details_shreya.pdf'
    ]
  }
];

async function addEmployees() {
  const passwordHash = await bcrypt.hash('Health@123', 12);
  const added = [];

  for (const emp of employees) {
    const [result] = await db.query(
      `INSERT IGNORE INTO employees (uuid, name, email, phone, password_hash, role, zone, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [uuidv4(), emp.name, emp.email, emp.phone, passwordHash, emp.role, emp.zone]
    );
    added.push(result.insertId || null);
  }

  return added;
}

async function addLeads() {
  const [employeeRows] = await db.query(`SELECT id, role FROM employees WHERE role IN ('sales_coordinator','case_manager')`);
  const roleMap = employeeRows.reduce((acc, row) => {
    if (!acc[row.role]) acc[row.role] = [];
    acc[row.role].push(row.id);
    return acc;
  }, {});

  for (const lead of sampleLeads) {
    const assignedList = roleMap[lead.assigned_to_role] || [];
    const assignedTo = assignedList.length ? assignedList[Math.floor(Math.random() * assignedList.length)] : null;

    await db.query(
      `INSERT IGNORE INTO leads
       (uuid, patient_name, phone, whatsapp, email, country, city, state, eye_condition, treatment,
        hospital, doctor_id, assigned_to, status, priority, source, notes, reports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), lead.patient_name, lead.phone, lead.whatsapp, lead.email,
        lead.country, lead.city, lead.state, lead.eye_condition, lead.treatment,
        lead.hospital, lead.doctor_id, assignedTo, lead.status, lead.priority,
        lead.source, lead.notes, JSON.stringify(lead.reports)
      ]
    );
  }
}

async function run() {
  try {
    console.log('Adding 6 employees and 3 leads with reports...');
    await addEmployees();
    await addLeads();
    console.log('✅ Added sample employees and report-backed leads.');
    process.exit(0);
  } catch (error) {
    console.error('Error adding sample employees/reports:', error);
    process.exit(1);
  }
}

run();
