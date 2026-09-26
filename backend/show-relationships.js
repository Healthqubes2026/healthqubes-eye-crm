const db = require('./src/config/database');

(async () => {
  console.log('🔍 ENTITY RELATIONSHIP MAPPING\n');
  console.log('='.repeat(60));

  const [results] = await db.query(`
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      REFERENCED_TABLE_NAME,
      REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);

  const relationships = {};
  results.forEach(row => {
    if (!relationships[row.TABLE_NAME]) relationships[row.TABLE_NAME] = [];
    relationships[row.TABLE_NAME].push({
      column: row.COLUMN_NAME,
      references: `${row.REFERENCED_TABLE_NAME}.${row.REFERENCED_COLUMN_NAME}`
    });
  });

  Object.keys(relationships).sort().forEach(table => {
    console.log(`📋 ${table.toUpperCase()}`);
    relationships[table].forEach(rel => {
      console.log(`   └─ ${rel.column} → ${rel.references}`);
    });
    console.log('');
  });

  process.exit(0);
})();