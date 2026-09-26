require('dotenv').config();
const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

const quotations = [
  {
    lead_id: 35,
    quotation_date: '2026-04-09',
    valid_until: '2026-05-09',
    base_cost: 150000,
    accommodation_cost: 25000,
    transport_cost: 15000,
    visa_support_cost: 5000,
    miscellaneous_cost: 5000,
    currency: 'INR',
    notes: 'Cataract surgery with premium accommodation package'
  },
  {
    lead_id: 36,
    quotation_date: '2026-04-09',
    valid_until: '2026-05-09',
    base_cost: 200000,
    accommodation_cost: 30000,
    transport_cost: 20000,
    visa_support_cost: 8000,
    miscellaneous_cost: 7000,
    currency: 'INR',
    notes: 'Glaucoma management with extended care package'
  },
  {
    lead_id: 37,
    quotation_date: '2026-04-09',
    valid_until: '2026-05-09',
    base_cost: 250000,
    accommodation_cost: 35000,
    transport_cost: 25000,
    visa_support_cost: 10000,
    miscellaneous_cost: 10000,
    currency: 'INR',
    notes: 'Retinal detachment treatment with urgent priority'
  },
  {
    lead_id: 35,
    quotation_date: '2026-04-10',
    valid_until: '2026-05-10',
    base_cost: 120000,
    accommodation_cost: 20000,
    transport_cost: 12000,
    visa_support_cost: 3000,
    miscellaneous_cost: 5000,
    currency: 'INR',
    notes: 'Follow-up quotation with reduced costs'
  }
];

const tasks = [
  {
    lead_id: 35,
    title: 'Prepare hospital admission documents',
    description: 'Collect and organize all medical documents and pre-operative reports for Meera Joshi',
    priority: 'high',
    due_date: '2026-04-15'
  },
  {
    lead_id: 36,
    title: 'Schedule follow-up pressure test',
    description: 'Contact Vikram Singh to schedule the glaucoma pressure monitoring appointment at Fortis Eye Hospital',
    priority: 'medium',
    due_date: '2026-04-20'
  }
];

async function addQuotations() {
  const [employees] = await db.query(`SELECT id FROM employees WHERE role IN ('sales_coordinator','manager') LIMIT 1`);
  const createdBy = employees[0]?.id || 1;

  for (const quot of quotations) {
    const total_cost = quot.base_cost + quot.accommodation_cost + quot.transport_cost + quot.visa_support_cost + quot.miscellaneous_cost;
    
    const [result] = await db.query(
      `INSERT INTO quotations
       (uuid, lead_id, quotation_date, valid_until, base_cost, accommodation_cost, transport_cost, visa_support_cost, miscellaneous_cost, total_cost, currency, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(), quot.lead_id, quot.quotation_date, quot.valid_until, quot.base_cost, quot.accommodation_cost,
        quot.transport_cost, quot.visa_support_cost, quot.miscellaneous_cost, total_cost, quot.currency, createdBy
      ]
    );

    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['quotation', result.insertId, createdBy, 'created', `Quotation created for lead ${quot.lead_id}`]
    );
  }
}

async function addTasks() {
  const [employees] = await db.query(`SELECT id FROM employees WHERE role IN ('sales_coordinator','case_manager') LIMIT 2`);
  const assignedToIds = employees.map(e => e.id);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const assignedTo = assignedToIds[i % assignedToIds.length];
    const createdBy = assignedToIds[(i + 1) % assignedToIds.length];

    const [result] = await db.query(
      `INSERT INTO tasks (lead_id, title, description, assigned_to, created_by, priority, due_date, status)
       VALUES (?,?,?,?,?,?,?,?)`,
      [task.lead_id, task.title, task.description, assignedTo, createdBy, task.priority, task.due_date, 'pending']
    );

    await db.query(
      'INSERT INTO activity_logs (entity_type, entity_id, employee_id, action, notes) VALUES (?,?,?,?,?)',
      ['task', result.insertId, createdBy, 'created', `Task created: ${task.title}`]
    );
  }
}

async function run() {
  try {
    console.log('Adding 4 quotations and 2 tasks...');
    await addQuotations();
    await addTasks();
    console.log('✅ Added 4 quotations and 2 tasks.');
    process.exit(0);
  } catch (error) {
    console.error('Error adding quotations/tasks:', error.message);
    process.exit(1);
  }
}

run();
