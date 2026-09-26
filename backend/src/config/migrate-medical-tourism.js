require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./database');

const migrations = [

  // ── Status update and alter already done ────────────────────────────────────

  // ── Add new columns to leads (ALTER already partially done) ─────────────────
  `ALTER TABLE leads
   ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(15) AFTER email,
   ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100) AFTER source,
   ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100) AFTER utm_source,
   ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100) AFTER utm_medium,
   ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255) AFTER utm_campaign,
   ADD COLUMN IF NOT EXISTS landing_page VARCHAR(500) AFTER referral_source,
   ADD COLUMN IF NOT EXISTS relationship_to_patient VARCHAR(255) AFTER country,
   ADD COLUMN IF NOT EXISTS language VARCHAR(100) AFTER relationship_to_patient,
   ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) AFTER language,
   ADD COLUMN IF NOT EXISTS preferred_country VARCHAR(100) AFTER nationality,
   ADD COLUMN IF NOT EXISTS medical_category VARCHAR(100) AFTER eye_condition,
   ADD COLUMN IF NOT EXISTS diagnosis VARCHAR(255) AFTER medical_category,
   ADD COLUMN IF NOT EXISTS severity ENUM('mild','moderate','severe','critical') DEFAULT 'moderate' AFTER diagnosis,
   ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) AFTER severity,
   ADD COLUMN IF NOT EXISTS estimated_revenue DECIMAL(12,2) AFTER budget,
   ADD COLUMN IF NOT EXISTS timeline_days INT AFTER estimated_revenue,
   ADD COLUMN IF NOT EXISTS loss_reason VARCHAR(255) AFTER converted_at,
   ADD COLUMN IF NOT EXISTS stage_changed_at DATETIME AFTER loss_reason`,

  // ── Patients Table (Dual Identity) ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS patients (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    lead_id         INT NOT NULL UNIQUE,
    patient_name    VARCHAR(100) NOT NULL,
    phone           VARCHAR(15),
    whatsapp        VARCHAR(15),
    email           VARCHAR(100),
    date_of_birth   DATE,
    gender          ENUM('male','female','other'),
    nationality     VARCHAR(100),
    passport_no     VARCHAR(20),
    passport_expiry DATE,
    address         TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(15),
    medical_history TEXT,
    allergies       TEXT,
    current_medications TEXT,
    blood_group     VARCHAR(5),
    visa_status     ENUM('not_applied','applied','approved','rejected','extension_needed','visa_on_arrival') DEFAULT 'not_applied',
    visa_number     VARCHAR(20),
    visa_expiry     DATE,
    arrival_date    DATE,
    departure_date DATE,
    accommodation   VARCHAR(255),
    transport       VARCHAR(255),
    case_manager_id INT,
    package_value   DECIMAL(12,2),
    payment_status  ENUM('pending','partial','paid','refunded') DEFAULT 'pending',
    payment_amount  DECIMAL(12,2),
    feedback        TEXT,
    completion_status ENUM('confirmation','onboarding','docs_complete','travel_planning','appointment','treatment','recovery','completed','on_hold','cancelled') DEFAULT 'confirmation',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (case_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_lead (lead_id),
    INDEX idx_visa_status (visa_status),
    INDEX idx_completion_status (completion_status)
  ) ENGINE=InnoDB`,

  // ── Tasks Table ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tasks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    lead_id         INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    assigned_to     INT NOT NULL,
    created_by      INT NOT NULL,
    priority        ENUM('low','medium','high','urgent') DEFAULT 'medium',
    status          ENUM('pending','in_progress','completed','cancelled') DEFAULT 'pending',
    due_date        DATE,
    completed_at    DATETIME,
    reminder_sent   BOOLEAN DEFAULT FALSE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_assigned (assigned_to),
    INDEX idx_due_date (due_date),
    INDEX idx_status (status)
  ) ENGINE=InnoDB`,

  // ── Hospitals Table ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS hospitals (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'India',
    phone           VARCHAR(15),
    email           VARCHAR(100),
    website         VARCHAR(255),
    lat             DECIMAL(10,8),
    lng             DECIMAL(11,8),
    specialties     JSON,
    category        ENUM('primary','secondary','tertiary','super_specialty') DEFAULT 'secondary',
    accreditation   VARCHAR(100),
    emergency_services BOOLEAN DEFAULT TRUE,
    international_patient_services BOOLEAN DEFAULT FALSE,
    added_by        INT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_city (city),
    INDEX idx_category (category),
    FULLTEXT INDEX ft_name (name)
  ) ENGINE=InnoDB`,

  // ── Update Doctors Table to Link to Hospitals ──────────────────────────────
  `ALTER TABLE doctors
   ADD COLUMN IF NOT EXISTS hospital_id INT AFTER hospital,
   ADD COLUMN IF NOT EXISTS qualifications VARCHAR(255) AFTER specialization,
   ADD COLUMN IF NOT EXISTS experience_years INT AFTER qualifications,
   ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(8,2) AFTER experience_years,
   ADD COLUMN IF NOT EXISTS languages_spoken JSON AFTER consultation_fee,
   ADD COLUMN IF NOT EXISTS availability JSON AFTER languages_spoken,
   ADD CONSTRAINT IF NOT EXISTS fk_doctors_hospital_id FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL`,

  // ── Treatment Categories Table ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS treatment_categories (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    estimated_days  INT,
    category_type   ENUM('surgery','treatment','diagnostic','consultation') DEFAULT 'treatment',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,

  // ── Loss Reasons Table ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS loss_reasons (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    reason          VARCHAR(255) NOT NULL UNIQUE,
    category        ENUM('price','competition','medical','logistics','other') DEFAULT 'other',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,

  // ── Quotations Table ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS quotations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    uuid            VARCHAR(36) NOT NULL UNIQUE,
    lead_id         INT NOT NULL,
    hospital_id     INT,
    doctor_id       INT,
    treatment_category_id INT,
    quotation_date  DATE NOT NULL,
    valid_until     DATE,
    base_cost       DECIMAL(12,2),
    accommodation_cost DECIMAL(10,2),
    transport_cost  DECIMAL(10,2),
    visa_support_cost DECIMAL(10,2),
    miscellaneous_cost DECIMAL(10,2),
    total_cost      DECIMAL(12,2),
    currency        VARCHAR(3) DEFAULT 'INR',
    status          ENUM('draft','sent','awaiting_response','received','follow_up','accepted','rejected','closed') DEFAULT 'draft',
    response_date   DATE,
    response_notes  TEXT,
    email_sent      BOOLEAN DEFAULT FALSE,
    email_sent_at   DATETIME,
    created_by      INT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    FOREIGN KEY (treatment_category_id) REFERENCES treatment_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_status (status),
    INDEX idx_hospital (hospital_id)
  ) ENGINE=InnoDB`,

  // ── Stage History Table ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS lead_stage_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    lead_id         INT NOT NULL,
    from_stage      VARCHAR(50),
    to_stage        VARCHAR(50) NOT NULL,
    changed_by      INT NOT NULL,
    change_reason   TEXT,
    changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_changed_at (changed_at)
  ) ENGINE=InnoDB`,

  // ── Activity Logs Table (Generalized) ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    entity_type     ENUM('lead','patient','task','quotation','meeting','sale') NOT NULL,
    entity_id       INT NOT NULL,
    employee_id     INT NOT NULL,
    action          VARCHAR(100) NOT NULL,
    old_value       JSON,
    new_value       JSON,
    notes           TEXT,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_employee (employee_id),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB`,

  // ── Patient Documents Table ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS patient_documents (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT NOT NULL,
    document_type   ENUM('passport','visa','medical_report','prescription','discharge_summary','payment_receipt','other') NOT NULL,
    document_name   VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    expiry_date     DATE,
    verified_by     INT,
    verified_at     DATETIME,
    is_verified     BOOLEAN DEFAULT FALSE,
    uploaded_by     INT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_type (document_type)
  ) ENGINE=InnoDB`,

  // ── Insert Default Data ─────────────────────────────────────────────────────
  `INSERT IGNORE INTO treatment_categories (name, description, estimated_days, category_type) VALUES
   ('Cataract Surgery', 'Surgical removal of cataract with IOL implantation', 1, 'surgery'),
   ('LASIK', 'Laser eye surgery for vision correction', 1, 'surgery'),
   ('Glaucoma Treatment', 'Medical and surgical treatment for glaucoma', 7, 'treatment'),
   ('Retinal Surgery', 'Surgical treatment for retinal disorders', 3, 'surgery'),
   ('Cornea Transplant', 'Corneal transplantation surgery', 14, 'surgery'),
   ('General Consultation', 'Eye examination and consultation', 1, 'consultation')`,

  `INSERT IGNORE INTO loss_reasons (reason, category) VALUES
   ('High Cost', 'price'),
   ('Found Better Option', 'competition'),
   ('Medical Condition Not Suitable', 'medical'),
   ('Travel Restrictions', 'logistics'),
   ('Changed Mind', 'other'),
   ('Insurance Issues', 'other')`,

];

(async () => {
  console.log('🔄  Running Medical Tourism CRM migrations...\n');
  for (const [i, sql] of migrations.entries()) {
    const tableName = sql.match(/(?:CREATE TABLE|ALTER TABLE) (?:\w+\.)?(\w+)/)?.[1] || `migration_${i}`;
    try {
      await db.query(sql);
      console.log(`  ✅  ${tableName}`);
    } catch (err) {
      console.error(`  ❌  ${tableName}: ${err.message}`);
      // Continue with next migration instead of exiting
      // process.exit(1);
    }
  }
  console.log('\n✅  All migrations complete.');
  process.exit(0);
})();