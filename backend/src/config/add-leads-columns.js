const db = require('./database');

(async () => {
  console.log('🔄  Adding missing columns to leads table...\n');

  const columnsToAdd = [
    'whatsapp VARCHAR(15) AFTER email',
    'utm_source VARCHAR(100) AFTER source',
    'utm_medium VARCHAR(100) AFTER utm_source',
    'utm_campaign VARCHAR(100) AFTER utm_medium',
    'referral_source VARCHAR(255) AFTER utm_campaign',
    'landing_page VARCHAR(500) AFTER referral_source',
    'relationship_to_patient VARCHAR(255) AFTER country',
    'language VARCHAR(100) AFTER relationship_to_patient',
    'nationality VARCHAR(100) AFTER language',
    'preferred_country VARCHAR(100) AFTER nationality',
    'medical_category VARCHAR(100) AFTER eye_condition',
    'diagnosis VARCHAR(255) AFTER medical_category',
    "severity ENUM('mild','moderate','severe','critical') DEFAULT 'moderate' AFTER diagnosis",
    'budget DECIMAL(12,2) AFTER severity',
    'estimated_revenue DECIMAL(12,2) AFTER budget',
    'timeline_days INT AFTER estimated_revenue',
    'loss_reason VARCHAR(255) AFTER converted_at',
    'stage_changed_at DATETIME AFTER loss_reason'
  ];

  for (const col of columnsToAdd) {
    try {
      await db.query(`ALTER TABLE leads ADD COLUMN ${col}`);
      console.log(`✅ Added: ${col.split(' ')[0]}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️  Skipped (exists): ${col.split(' ')[0]}`);
      } else {
        console.error(`❌ Error adding ${col.split(' ')[0]}: ${err.message}`);
      }
    }
  }

  console.log('\n✅  Leads columns update complete.');
  process.exit(0);
})();