const db = require('./src/config/database');

async function checkProductsTable() {
  try {
    const [cols] = await db.query('DESCRIBE products');
    console.log('Current products table columns:');
    cols.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkProductsTable();
