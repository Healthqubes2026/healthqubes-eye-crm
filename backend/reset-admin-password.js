require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'healthqubes_eye',
  });

  const password = 'NewPassword123';
  const hash = await bcrypt.hash(password, 12);

  const [result] = await connection.execute(
    'UPDATE employees SET password_hash = ? WHERE email = ?',
    [hash, 'admin@healthqubes.in']
  );

  console.log(`Updated admin password for admin@healthqubes.in. Rows affected: ${result.affectedRows}`);
  await connection.end();
})();
