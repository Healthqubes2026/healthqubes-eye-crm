const db = require('./database');

(async () => {
  console.log('🔄  Adding lead activity metadata columns...\n');

  const columnsToAdd = [
    'channel VARCHAR(50) AFTER action',
    'tags VARCHAR(255) AFTER channel',
  ];

  for (const col of columnsToAdd) {
    try {
      await db.query(`ALTER TABLE lead_activities ADD COLUMN ${col}`);
      console.log(`✅ Added: ${col.split(' ')[0]}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️  Skipped (exists): ${col.split(' ')[0]}`);
      } else {
        console.error(`❌ Error adding ${col.split(' ')[0]}: ${err.message}`);
      }
    }
  }

  console.log('\n✅  Lead activity metadata update complete.');
  process.exit(0);
})();
