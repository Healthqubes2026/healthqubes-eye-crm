const db = require('./src/config/database');

async function checkTreatmentCategoriesSchema() {
  try {
    const [cols] = await db.query('DESCRIBE treatment_categories');
    console.log('Current treatment_categories table columns:');
    cols.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTreatmentCategoriesSchema();
