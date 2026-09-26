require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const hash = (pw) => bcrypt.hash(pw, 12);

async function seed() {
  console.log('🌱  Seeding Healthqube Eyes database...\n');

  // ── Employees ──────────────────────────────────────────────────────────────
  console.log('  👤  Employees...');
  const adminPassword = 'NewPassword123';
  const adminHash     = await hash(adminPassword);
  const managerHash   = await hash('Manager@123');
  const agentHash     = await hash('Agent@123');

  const [adminRes] = await db.query(
    `INSERT IGNORE INTO employees (uuid, name, email, phone, password_hash, role, zone) VALUES (?,?,?,?,?,?,?)`,
    [uuidv4(), 'Super Admin', 'admin@healthqubes.in', '9000000001', adminHash, 'admin', 'HQ']
  );

  await db.query('UPDATE employees SET password_hash = ? WHERE email = ?', [adminHash, 'admin@healthqubes.in']);

  const [mgr1] = await db.query(
    `INSERT IGNORE INTO employees (uuid, name, email, phone, password_hash, role, zone) VALUES (?,?,?,?,?,?,?)`,
    [uuidv4(), 'Suresh Menon', 'suresh.m@healthqubes.in', '9000000002', managerHash, 'management', 'South Bengaluru']
  );
  const [mgr2] = await db.query(
    `INSERT IGNORE INTO employees (uuid, name, email, phone, password_hash, role, zone) VALUES (?,?,?,?,?,?,?)`,
    [uuidv4(), 'Anita Desai', 'anita.d@healthqubes.in', '9000000003', managerHash, 'case_manager', 'North Bengaluru']
  );

  const managerId1 = mgr1.insertId || 2;
  const managerId2 = mgr2.insertId || 3;

  const agents = [
    ['Rajesh Sharma',  'rajesh.s@healthqubes.in',  '9000000011', 'South Bengaluru', managerId1],
    ['Priya Kumar',    'priya.k@healthqubes.in',   '9000000012', 'East Bengaluru',  managerId1],
    ['Amit Mehta',     'amit.m@healthqubes.in',    '9000000013', 'Whitefield',      managerId1],
    ['Sneha Joshi',    'sneha.j@healthqubes.in',   '9000000014', 'North Bengaluru', managerId2],
    ['Vikram Nair',    'vikram.n@healthqubes.in',  '9000000015', 'HSR Layout',      managerId1],
    ['Kiran Rao',      'kiran.r@healthqubes.in',   '9000000016', 'Jayanagar',       managerId2],
    ['Deepa Singh',    'deepa.s@healthqubes.in',   '9000000017', 'Indiranagar',     managerId2],
    ['Mohan Pillai',   'mohan.p@healthqubes.in',   '9000000018', 'Koramangala',     managerId1],
  ];

  const agentIds = [];
  for (let i = 0; i < agents.length; i++) {
    const [name, email, phone, zone, mgr] = agents[i];
    const role = i < 4 ? 'sales_coordinator' : 'case_manager';
    const [r] = await db.query(
      `INSERT IGNORE INTO employees (uuid, name, email, phone, password_hash, role, zone, manager_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuidv4(), name, email, phone, agentHash, role, zone, mgr]
    );
    agentIds.push(r.insertId || agentIds.length + 4);
  }

  // ── Products ───────────────────────────────────────────────────────────────
  console.log('  📦  Products...');
  const products = [
    ['Cataract IOL Lens (Monofocal)', 'Surgical',    1700.00, 'piece'],
    ['Cataract IOL Lens (Trifocal)',  'Surgical',    8500.00, 'piece'],
    ['Anti-VEGF Injection (Avastin)', 'Intravitreal', 5000.00, 'vial'],
    ['Dry Eye Drops (Refreshdrops)',  'OTC',           160.00, 'bottle'],
    ['Contact Lens Solution',         'OTC',           250.00, 'bottle'],
    ['Daily Disposable Lenses',       'Optical',       800.00, 'box'],
    ['Fundus Camera Consumables',     'Equipment',    2500.00, 'set'],
    ['Retinal OCT Scan Dye',          'Diagnostic',   1200.00, 'vial'],
    ['Orthokeratology Lens',          'Optical',      6000.00, 'pair'],
    ['LASIK Post-op Eye Drops Kit',   'Surgical',      450.00, 'kit'],
  ];

  const productIds = [];
  for (const [name, category, unit_price, unit] of products) {
    const [r] = await db.query(
      'INSERT IGNORE INTO products (name, category, unit_price, unit) VALUES (?,?,?,?)',
      [name, category, unit_price, unit]
    );
    productIds.push(r.insertId || productIds.length + 1);
  }

  // ── Doctors ────────────────────────────────────────────────────────────────
  console.log('  🏥  Doctors...');
  const doctors = [
    ['Dr. Ramesh Patel',     'Cataract Surgery',    'Koramangala Eye Clinic',  'Koramangala', 'Karnataka', '9800000001', 12.9352, 77.6245],
    ['Dr. Meena Nair',       'Retina Specialist',   'Vision Care Centre',      'Indiranagar', 'Karnataka', '9800000002', 12.9784, 77.6408],
    ['Dr. Suresh Kumar',     'Glaucoma',            'Whitefield Hospital',     'Whitefield',  'Karnataka', '9800000003', 12.9698, 77.7500],
    ['Dr. Anjali Sharma',    'Cornea & Refractive', 'Retina Specialists',      'HSR Layout',  'Karnataka', '9800000004', 12.9116, 77.6389],
    ['Dr. Pradeep Iyer',     'Paediatric Eye',      'National Eye Centre',     'Jayanagar',   'Karnataka', '9800000005', 12.9255, 77.5831],
    ['Dr. Lalitha Menon',    'Contact Lens',        'LV Prasad Eye',           'Koramangala', 'Karnataka', '9800000006', 12.9350, 77.6240],
    ['Dr. Sanjay Rao',       'LASIK Surgery',       'Sankara Eye Hospital',    'Bangalore',   'Karnataka', '9800000007', 12.9762, 77.5929],
    ['Dr. Rekha Singh',      'Oculoplasty',         'Narayana Nethralaya',     'Rajajinagar', 'Karnataka', '9800000008', 13.0027, 77.5529],
    ['Dr. Vinod Thomas',     'Diabetic Retinopathy','Aravind Eye Hospital',    'Electronic City','Karnataka','9800000009',12.8442,77.6602],
    ['Dr. Kavitha Krishnan', 'Dry Eye Clinic',      'Manipal Eye Centre',      'Malleshwaram','Karnataka', '9800000010', 13.0069, 77.5676],
  ];

  const doctorIds = [];
  for (const [name, spec, hospital, city, state, phone, lat, lng] of doctors) {
    const [r] = await db.query(
      `INSERT IGNORE INTO doctors (name, specialization, hospital, city, state, phone, lat, lng, added_by)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [name, spec, hospital, city, state, phone, lat, lng]
    );
    doctorIds.push(r.insertId || doctorIds.length + 1);
  }

  // ── Attendance (last 7 days) ───────────────────────────────────────────────
  console.log('  📅  Attendance...');
  const statuses = ['present', 'present', 'present', 'present', 'late', 'absent', 'half_day'];
  for (let d = 6; d >= 0; d--) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    for (const agentId of agentIds) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      if (status === 'absent') continue;

      const checkinHour  = status === 'late' ? 10 : 9;
      const checkinMin   = Math.floor(Math.random() * 30);
      const workingHours = status === 'half_day' ? 4 : 7 + Math.random() * 2;

      await db.query(
        `INSERT IGNORE INTO attendance
         (employee_id, date, checkin_time, checkin_lat, checkin_lng, checkin_address,
          working_hours, status, is_late)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          agentId, dateStr,
          `${dateStr} ${String(checkinHour).padStart(2,'0')}:${String(checkinMin).padStart(2,'0')}:00`,
          12.9352 + (Math.random() - 0.5) * 0.1,
          77.6245 + (Math.random() - 0.5) * 0.1,
          'Bengaluru, Karnataka',
          parseFloat(workingHours.toFixed(2)),
          status,
          status === 'late' ? 1 : 0,
        ]
      ).catch(() => {}); // ignore duplicate
    }
  }

  // ── Meetings (last 7 days) ─────────────────────────────────────────────────
  console.log('  🤝  Meetings...');
  const outcomes = ['positive', 'positive', 'neutral', 'neutral', 'negative'];
  for (let d = 6; d >= 0; d--) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    for (const agentId of agentIds) {
      const numVisits = 3 + Math.floor(Math.random() * 5);
      for (let v = 0; v < numVisits; v++) {
        const doctorId  = doctorIds[Math.floor(Math.random() * doctorIds.length)];
        const productIdx = Math.floor(Math.random() * productIds.length);
        const hour = 9 + Math.floor(Math.random() * 8);
        const followUp = new Date(); followUp.setDate(followUp.getDate() + 7 + Math.floor(Math.random() * 14));

        await db.query(
          `INSERT INTO meetings
           (uuid, employee_id, doctor_id, visit_date, checkin_time, checkout_time,
            duration_minutes, products_discussed, meeting_notes, follow_up_date,
            outcome, photos)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            uuidv4(), agentId, doctorId, dateStr,
            `${dateStr} ${String(hour).padStart(2,'0')}:00:00`,
            `${dateStr} ${String(hour).padStart(2,'0')}:${String(10 + Math.floor(Math.random() * 20)).padStart(2,'0')}:00`,
            10 + Math.floor(Math.random() * 25),
            JSON.stringify([products[productIdx][0]]),
            'Discussed product benefits and pricing. Doctor showed interest.',
            followUp.toISOString().split('T')[0],
            outcomes[Math.floor(Math.random() * outcomes.length)],
            '[]',
          ]
        );
      }
    }
  }

  // ── Leads ──────────────────────────────────────────────────────────────────
  console.log('  👥  Leads...');
  const leadData = [
    ['Anita Verma',    '9100000001', 'anita@email.com',  'Cataract',          'IOL Surgery'],
    ['Ravi Krishnan',  '9100000002', 'ravi@email.com',   'Glaucoma',          'Medication'],
    ['Sunita Pillai',  '9100000003', 'sunita@email.com', 'Dry Eye',           'Drops Therapy'],
    ['Mohammed Ali',   '9100000004', 'mali@email.com',   'LASIK',             'Refractive Surgery'],
    ['Leela Menon',    '9100000005', 'leela@email.com',  'Diabetic Retinopathy','Intravitreal Injection'],
    ['Sunil Verma',    '9100000006', 'sunil@email.com',  'Cataract',          'IOL Surgery'],
    ['Preethi Iyer',   '9100000007', 'preethi@email.com','Keratoconus',       'Cross-linking'],
    ['Deepak Nair',    '9100000008', 'deepak@email.com', 'Age-related Macular Degeneration','Anti-VEGF'],
    ['Geetha Rao',     '9100000009', 'geetha@email.com', 'Squint',            'Strabismus Surgery'],
    ['Arjun Pillai',   '9100000010', 'arjun@email.com',  'Contact Lens',      'Orthokeratology'],
  ];
  const leadStatuses = ['new','contacted','follow_up','converted','closed'];
  const cities = ['Bengaluru','Mumbai','Chennai','Hyderabad','Kochi'];

  for (const [name, phone, email, condition, treatment] of leadData) {
    const agentId  = agentIds[Math.floor(Math.random() * agentIds.length)];
    const doctorId = doctorIds[Math.floor(Math.random() * doctorIds.length)];
    const status   = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];
    const city     = cities[Math.floor(Math.random() * cities.length)];
    const followUp = new Date(); followUp.setDate(followUp.getDate() + Math.floor(Math.random() * 14));

    await db.query(
      `INSERT IGNORE INTO leads
       (uuid, patient_name, phone, email, city, country, eye_condition, treatment,
        doctor_id, assigned_to, status, follow_up_date, priority, source, notes, reports)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(), name, phone, email, city, 'India', condition, treatment,
        doctorId, agentId, status,
        followUp.toISOString().split('T')[0],
        ['high','medium','low'][Math.floor(Math.random() * 3)],
        'field', 'Patient referred by doctor during visit.', '[]',
      ]
    ).catch(() => {});
  }

  // ── Sales (last 30 days) ───────────────────────────────────────────────────
  console.log('  💰  Sales...');
  for (let d = 29; d >= 0; d--) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const numSales = 1 + Math.floor(Math.random() * 4);

    for (let s = 0; s < numSales; s++) {
      const agentId  = agentIds[Math.floor(Math.random() * agentIds.length)];
      const doctorId = doctorIds[Math.floor(Math.random() * doctorIds.length)];
      const prodIdx  = Math.floor(Math.random() * products.length);
      const qty      = 1 + Math.floor(Math.random() * 10);
      const price    = products[prodIdx][2];
      const total    = qty * price;

      const [saleRes] = await db.query(
        `INSERT INTO sales (uuid, employee_id, doctor_id, sale_date, total_amount, payment_mode, location_name)
         VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), agentId, doctorId, dateStr, total,
          ['cash','upi','neft','cheque'][Math.floor(Math.random() * 4)],
          'Bengaluru, Karnataka']
      );

      await db.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) VALUES (?,?,?,?,?)',
        [saleRes.insertId, productIds[prodIdx] || 1, qty, price, total]
      );
    }
  }

  console.log('\n✅  Seed complete!\n');
  console.log('  Login credentials:');
  console.log('  Admin   → admin@healthqubes.in    / NewPassword123');
  console.log('  Manager → suresh.m@healthqubes.in / Manager@123');
  console.log('  Agent   → rajesh.s@healthqubes.in / Agent@123\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
