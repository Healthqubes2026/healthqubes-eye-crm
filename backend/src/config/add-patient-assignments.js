require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./database');
const { ensureColumn, ensureConstraint } = require('./migration-utils');

const migrations = [
  // Create patient assignments history table
  `CREATE TABLE IF NOT EXISTS patient_assignments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT NOT NULL,
    hospital_id     INT,
    doctor_id       INT,
    assigned_by     INT NOT NULL,
    assignment_type ENUM('hospital','doctor','both') NOT NULL,
    status          ENUM('active','inactive') DEFAULT 'active',
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at     DATETIME,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_hospital (hospital_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_status (status)
  ) ENGINE=InnoDB`,
];

async function runMigrations() {
  try {
    console.log('Starting patient assignment migrations...');
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      await db.query(migrations[i]);
    }

    await ensureColumn('patients', 'assigned_hospital_id', 'assigned_hospital_id INT AFTER case_manager_id');
    await ensureColumn('patients', 'assigned_doctor_id', 'assigned_doctor_id INT AFTER assigned_hospital_id');
    await ensureColumn('patients', 'hospital_assigned_at', 'hospital_assigned_at DATETIME AFTER assigned_doctor_id');
    await ensureColumn('patients', 'doctor_assigned_at', 'doctor_assigned_at DATETIME AFTER hospital_assigned_at');
    await ensureConstraint(
      'patients',
      'fk_patients_hospital',
      'ADD CONSTRAINT fk_patients_hospital FOREIGN KEY (assigned_hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL'
    );
    await ensureConstraint(
      'patients',
      'fk_patients_doctor',
      'ADD CONSTRAINT fk_patients_doctor FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL'
    );

    console.log('✅ All migrations completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => process.exit(1));
}

module.exports = { runMigrations };
