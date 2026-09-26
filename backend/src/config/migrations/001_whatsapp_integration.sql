-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP MESSAGES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_sid VARCHAR(255) UNIQUE,
  phone VARCHAR(20) NOT NULL,
  message LONGTEXT NOT NULL,
  media_url VARCHAR(1000),
  direction ENUM('incoming', 'outgoing') DEFAULT 'outgoing',
  status ENUM('sent', 'delivered', 'failed', 'read', 'received') DEFAULT 'sent',
  error_message LONGTEXT,
  lead_id INT,
  patient_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_direction (direction),
  INDEX idx_created_at (created_at),
  INDEX idx_message_sid (message_sid),
  INDEX idx_lead_id (lead_id),
  INDEX idx_patient_id (patient_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT,
  phone VARCHAR(20) NOT NULL,
  type ENUM('lead_welcome', 'followup_reminder', 'quotation', 'hospital_assignment', 'visa_update', 'admission_confirmation', 'discharge_care') NOT NULL,
  message LONGTEXT NOT NULL,
  status ENUM('sent', 'pending', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patient_id (patient_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP SETTINGS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  auto_welcome BOOLEAN DEFAULT FALSE,
  auto_followup BOOLEAN DEFAULT FALSE,
  followup_days_before INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADD WHATSAPP FIELDS TO EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN whatsapp VARCHAR(20), 
                   ADD COLUMN whatsapp_message_sent BOOLEAN DEFAULT FALSE,
                   ADD COLUMN last_followup_reminder_sent TIMESTAMP;

ALTER TABLE quotations ADD COLUMN whatsapp_sent BOOLEAN DEFAULT FALSE,
                       ADD COLUMN whatsapp_sent_at TIMESTAMP;

ALTER TABLE patients ADD COLUMN whatsapp_contact_verified BOOLEAN DEFAULT FALSE;
