const db = require('./database');

(async () => {
  console.log('🔄  Adding missing columns to doctors table...\n');

  const columnsToAdd = [
    'hospital_id INT AFTER hospital',
    'qualifications VARCHAR(255) AFTER specialization',
    'experience_years INT AFTER qualifications',
    'consultation_fee DECIMAL(8,2) AFTER experience_years',
    'languages_spoken JSON AFTER consultation_fee',
    'availability JSON AFTER languages_spoken'
  ];

  for (const col of columnsToAdd) {
    try {
      await db.query(`ALTER TABLE doctors ADD COLUMN ${col}`);
      console.log(`✅ Added: ${col.split(' ')[0]}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️  Skipped (exists): ${col.split(' ')[0]}`);
      } else {
        console.error(`❌ Error adding ${col.split(' ')[0]}: ${err.message}`);
      }
    }
  }

  // Add foreign key if not exists
  try {
    await db.query(`ALTER TABLE doctors ADD CONSTRAINT fk_doctors_hospital_id FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL`);
    console.log('✅ Added foreign key constraint');
  } catch (err) {
    if (err.code === 'ER_FK_DUP_NAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.log('⚠️  Foreign key constraint already exists');
    } else {
      console.error(`❌ Error adding foreign key: ${err.message}`);
    }
  }

  console.log('\n✅  Doctors columns update complete.');
  process.exit(0);
})();