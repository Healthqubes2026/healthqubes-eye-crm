const db = require('./database');

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) {
    console.log(`⏭️  Column already exists: ${tableName}.${columnName}`);
    return;
  }

  await db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`);
  console.log(`✅  Added column: ${tableName}.${columnName}`);
}

async function ensureConstraint(tableName, constraintName, alterDefinition) {
  if (await constraintExists(tableName, constraintName)) {
    console.log(`⏭️  Constraint already exists: ${constraintName}`);
    return;
  }

  await db.query(`ALTER TABLE \`${tableName}\` ${alterDefinition}`);
  console.log(`✅  Added constraint: ${constraintName}`);
}

module.exports = {
  columnExists,
  constraintExists,
  ensureColumn,
  ensureConstraint,
};
