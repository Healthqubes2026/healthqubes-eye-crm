const db = require('./src/config/database');

(async () => {
  try {
    const sql = `ALTER TABLE employees MODIFY role ENUM('admin','management','manager','sales_coordinator','case_manager','field_agent') DEFAULT 'field_agent'`;
    await db.query(sql);
    console.log('✅ employees.role enum updated');
    const [rows] = await db.query('SELECT id, name, role FROM employees ORDER BY id');
    console.log(rows);
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    process.exit(0);
  }
})();