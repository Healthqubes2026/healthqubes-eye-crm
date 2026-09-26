require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'patients'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('Patients table columns:');
    cols.forEach(c => console.log(` - ${c.COLUMN_NAME} (${c.COLUMN_TYPE})`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
