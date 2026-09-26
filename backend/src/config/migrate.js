require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./database');
const adIntegrationsMigrations = require('./add-ad-integrations');
const patientAssignmentsMigrations = require('./add-patient-assignments');

const migrations = [

  // ── Employees ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS employees (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    username      VARCHAR(50) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(100),
    phone         VARCHAR(15),
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','management','manager','sales_coordinator','case_manager','field_agent') DEFAULT 'field_agent',
    zone          VARCHAR(100),
    manager_id    INT,
    profile_photo VARCHAR(255),
    device_token  VARCHAR(255),
    fcm_token     VARCHAR(500),
    is_active     BOOLEAN DEFAULT TRUE,
    last_login    DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,

  // ── OTP Store ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS otp_store (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    phone      VARCHAR(15) NOT NULL,
    otp        VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    used       BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone)
  ) ENGINE=InnoDB`,

  // ── Refresh Tokens ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    employee_id  INT NOT NULL,
    token        VARCHAR(500) NOT NULL UNIQUE,
    expires_at   DATETIME NOT NULL,
    revoked      BOOLEAN DEFAULT FALSE,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_token (token(255))
  ) ENGINE=InnoDB`,

  // ── Attendance ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS attendance (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    employee_id          INT NOT NULL,
    date                 DATE NOT NULL,
    checkin_time         DATETIME,
    checkin_lat          DECIMAL(10,8),
    checkin_lng          DECIMAL(11,8),
    checkin_address      VARCHAR(255),
    checkin_selfie       VARCHAR(255),
    checkout_time        DATETIME,
    checkout_lat         DECIMAL(10,8),
    checkout_lng         DECIMAL(11,8),
    checkout_address     VARCHAR(255),
    working_hours        DECIMAL(4,2),
    status               ENUM('present','absent','half_day','on_leave','late') DEFAULT 'present',
    is_late              BOOLEAN DEFAULT FALSE,
    late_reason          TEXT,
    notes                TEXT,
    is_manual            BOOLEAN DEFAULT FALSE,
    modified_by          INT NULL,
    modified_by_role     VARCHAR(50) NULL,
    override_status      ENUM('present','late','absent','half_day','on_leave') NULL,
    override_remarks     TEXT NULL,
    overridden_by        INT NULL,
    overridden_at        DATETIME NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_date (employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_date (date),
    INDEX idx_employee_date (employee_id, date)
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS attendance_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    attendance_id INT NOT NULL,
    employee_id   INT NOT NULL,
    date          DATE NOT NULL,
    changed_by    INT NOT NULL,
    change_type   ENUM('manual_add','override','bulk_upload') DEFAULT 'override',
    old_value     JSON,
    new_value     JSON,
    reason        TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attendance (attendance_id),
    INDEX idx_employee (employee_id),
    INDEX idx_date (date),
    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  // ── Leave Requests ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS leave_requests (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    employee_id  INT NOT NULL,
    from_date    DATE NOT NULL,
    to_date      DATE NOT NULL,
    leave_type   ENUM('sick','casual','earned','unpaid') DEFAULT 'casual',
    reason       TEXT,
    status       ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewed_by  INT,
    reviewed_at  DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by)  REFERENCES employees(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,

  // ── Doctors ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS doctors (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    hospital      VARCHAR(150),
    address       VARCHAR(255),
    city          VARCHAR(100),
    state         VARCHAR(100),
    phone         VARCHAR(15),
    email         VARCHAR(100),
    lat           DECIMAL(10,8),
    lng           DECIMAL(11,8),
    category      ENUM('A','B','C') DEFAULT 'B',
    added_by      INT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_city (city),
    FULLTEXT INDEX ft_name (name, hospital)
  ) ENGINE=InnoDB`,

  // ── Doctor Meetings ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS meetings (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    uuid               VARCHAR(36) NOT NULL UNIQUE,
    employee_id        INT NOT NULL,
    doctor_id          INT NOT NULL,
    visit_date         DATE NOT NULL,
    checkin_time       DATETIME,
    checkin_lat        DECIMAL(10,8),
    checkin_lng        DECIMAL(11,8),
    checkout_time      DATETIME,
    duration_minutes   INT,
    products_discussed JSON,
    meeting_notes      TEXT,
    follow_up_date     DATE,
    follow_up_done     BOOLEAN DEFAULT FALSE,
    prescription_support BOOLEAN DEFAULT FALSE,
    outcome            ENUM('positive','neutral','negative','no_meet') DEFAULT 'neutral',
    photos             JSON,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)   REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_employee_date (employee_id, visit_date),
    INDEX idx_doctor (doctor_id),
    INDEX idx_follow_up (follow_up_date, follow_up_done)
  ) ENGINE=InnoDB`,

  // ── GPS Location Tracking ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS location_tracking (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    lat         DECIMAL(10,8) NOT NULL,
    lng         DECIMAL(11,8) NOT NULL,
    accuracy    FLOAT,
    speed       FLOAT,
    heading     FLOAT,
    address     VARCHAR(255),
    battery     TINYINT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_time (employee_id, recorded_at),
    INDEX idx_recorded_at   (recorded_at)
  ) ENGINE=InnoDB`,

  // ── Leads ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS leads (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    uuid            VARCHAR(36) NOT NULL UNIQUE,
    patient_name    VARCHAR(100) NOT NULL,
    phone           VARCHAR(15),
    email           VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'India',
    city            VARCHAR(100),
    state           VARCHAR(100),
    eye_condition   VARCHAR(150),
    treatment       VARCHAR(150),
    hospital        VARCHAR(150),
    doctor_id       INT,
    assigned_to     INT NOT NULL,
    status          ENUM('new','contacted','follow_up','converted','closed','new_lead','attempted','connected','requirement_captured','docs_requested','docs_received','hospital_shortlisted','quotation_requested','quotation_received','treatment_plan_shared','negotiation','decision_pending','lost') DEFAULT 'new_lead',
    follow_up_date  DATE,
    priority        ENUM('high','medium','low') DEFAULT 'medium',
    source          ENUM('field','referral','online','camp','other') DEFAULT 'field',
    notes           TEXT,
    reports         JSON,
    converted_at    DATETIME,
    loss_reason     VARCHAR(255),
    stage_changed_at DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)   REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_assigned (assigned_to),
    INDEX idx_follow_up (follow_up_date, status)
  ) ENGINE=InnoDB`,

  // ── Lead Activity Log ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS lead_activities (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    lead_id     INT NOT NULL,
    employee_id INT NOT NULL,
    action      VARCHAR(100) NOT NULL,
    channel     VARCHAR(50),
    tags        VARCHAR(255),
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id)     REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS lead_stage_history (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    lead_id     INT NOT NULL,
    from_stage  VARCHAR(50),
    to_stage    VARCHAR(50) NOT NULL,
    changed_by  INT NOT NULL,
    change_reason TEXT,
    changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_changed_at (changed_at)
  ) ENGINE=InnoDB`,

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
    departure_date  DATE,
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

  // ── Products ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS products (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    category   VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL,
    unit       VARCHAR(50) DEFAULT 'piece',
    is_active  BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,

  // ── Sales ────────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sales (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    uuid         VARCHAR(36) NOT NULL UNIQUE,
    employee_id  INT NOT NULL,
    doctor_id    INT,
    hospital     VARCHAR(150),
    sale_date    DATE NOT NULL,
    lat          DECIMAL(10,8),
    lng          DECIMAL(11,8),
    location_name VARCHAR(255),
    total_amount DECIMAL(12,2) NOT NULL,
    notes        TEXT,
    invoice_no   VARCHAR(50),
    payment_mode ENUM('cash','cheque','neft','upi','credit') DEFAULT 'cash',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)   REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_employee_date (employee_id, sale_date),
    INDEX idx_sale_date (sale_date)
  ) ENGINE=InnoDB`,

  // ── Sale Line Items ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sale_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    sale_id    INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total      DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB`,

  // ── Push Notifications ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    title       VARCHAR(200) NOT NULL,
    body        TEXT NOT NULL,
    type        ENUM('attendance','meeting','lead','sales','system','alert') DEFAULT 'system',
    data        JSON,
    sent        BOOLEAN DEFAULT FALSE,
    read_at     DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee (employee_id),
    INDEX idx_sent (sent)
  ) ENGINE=InnoDB`,

  // ── Email Logs ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS email_logs (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    patient_id       INT,
    recipient_email  VARCHAR(100) NOT NULL,
    subject          VARCHAR(255) NOT NULL,
    sent_by          INT NOT NULL,
    sent_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    status           ENUM('sent','failed') DEFAULT 'sent',
    error_message    TEXT,
    message_id       VARCHAR(255),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_sent_by (sent_by),
    INDEX idx_status (status)
  ) ENGINE=InnoDB`,

  // ── WhatsApp Messages ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    message_sid    VARCHAR(255),
    phone          VARCHAR(15) NOT NULL,
    message        TEXT NOT NULL,
    media_url      VARCHAR(500),
    status         ENUM('sent','delivered','read','failed') DEFAULT 'sent',
    error_message  TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB`,

  // ── SMS Messages ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sms_messages (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    message_sid    VARCHAR(255),
    phone          VARCHAR(15) NOT NULL,
    message        TEXT NOT NULL,
    status         ENUM('sent','delivered','failed') DEFAULT 'sent',
    error_message  TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB`,

];

(async () => {
  console.log('🔄  Running migrations...\n');
  for (const [i, sql] of migrations.entries()) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `migration_${i}`;
    try {
      await db.query(sql);
      console.log(`  ✅  ${tableName}`);
    } catch (err) {
      console.error(`  ❌  ${tableName}: ${err.message}`);
      process.exit(1);
    }
  }
  
  // Run ad integrations migrations
  try {
    await adIntegrationsMigrations.runMigrations();
  } catch (err) {
    console.error('❌  Ad integrations migration failed:', err.message);
    process.exit(1);
  }

  // Run patient assignment migrations
  try {
    await patientAssignmentsMigrations.runMigrations();
  } catch (err) {
    console.error('❌  Patient assignment migration failed:', err.message);
    process.exit(1);
  }
  
  console.log('\n✅  All migrations complete.');
  process.exit(0);
})();
