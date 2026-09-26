const db = require('./src/config/database');

async function patch() {
  console.log('🔄 Patching database for Manual Attendance...');
  try {
    // attendance_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
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
        INDEX idx_date (date)
      ) ENGINE=InnoDB
    `);
    console.log('  ✅ attendance_logs table ready');

    // Add manual tracking columns to attendance
    const cols = [
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS modified_by INT NULL`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS modified_by_role VARCHAR(20) NULL`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS override_status ENUM('present','late','absent','half_day','on_leave') NULL`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS override_remarks TEXT NULL`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overridden_by INT NULL`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overridden_at DATETIME NULL`,
    ];
    for (const sql of cols) {
      try { await db.query(sql); } catch(e) { /* already exists */ }
    }
    console.log('  ✅ attendance table columns patched');

    // patch leave_requests if not already done
    try { await db.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_by INT NULL`); } catch(e) {}
    try { await db.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS remarks TEXT NULL`); } catch(e) {}
    console.log('  ✅ leave_requests patched');

    console.log('\n✅ All patches applied!');
  } catch (err) {
    console.error('❌ Patch failed:', err.message);
  }
  process.exit();
}

patch();
