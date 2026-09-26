require('dotenv').config();
const db = require('./src/config/database');

async function checkDoctorsTable() {
  try {
    const columns = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='doctors' 
      AND TABLE_SCHEMA=DATABASE()
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Doctors table columns:');
    columns.forEach((col, idx) => {
      console.log(`${idx + 1}. ${col.COLUMN_NAME}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDoctorsTable();
