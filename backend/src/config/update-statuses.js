const db = require('./database');

(async () => {
  console.log('🔄  Updating existing lead statuses...\n');

  // Map old statuses to new ones
  const statusMap = {
    'new': 'new_lead',
    'contacted': 'connected',
    'follow_up': 'requirement_captured',
    'converted': 'converted',
    'closed': 'lost'
  };

  for (const [oldStatus, newStatus] of Object.entries(statusMap)) {
    const [result] = await db.query('UPDATE leads SET status = ? WHERE status = ?', [newStatus, oldStatus]);
    console.log(`  ✅  ${oldStatus} → ${newStatus}: ${result.affectedRows} rows`);
  }

  console.log('\n✅  Status update complete.');
  process.exit(0);
})();