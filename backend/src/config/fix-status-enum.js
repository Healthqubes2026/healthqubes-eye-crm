const db = require('./database');

(async () => {
  console.log('🔄  Updating lead status enum and data...\n');

  try {
    // First expand the enum to include both old and new values
    await db.query(`ALTER TABLE leads MODIFY COLUMN status ENUM('new','contacted','follow_up','converted','closed','new_lead','attempted','connected','requirement_captured','docs_requested','docs_received','hospital_shortlisted','quotation_requested','quotation_received','treatment_plan_shared','negotiation','decision_pending','lost') DEFAULT 'new_lead'`);
    console.log('✅  Enum expanded');

    // Then update the data
    await db.query(`UPDATE leads SET status = CASE
      WHEN status = 'new' THEN 'new_lead'
      WHEN status = 'contacted' THEN 'connected'
      WHEN status = 'follow_up' THEN 'requirement_captured'
      WHEN status = 'converted' THEN 'converted'
      WHEN status = 'closed' THEN 'lost'
      ELSE status END`);
    console.log('✅  Statuses updated');

    // Finally set the final enum
    await db.query(`ALTER TABLE leads MODIFY COLUMN status ENUM('new_lead','attempted','connected','requirement_captured','docs_requested','docs_received','hospital_shortlisted','quotation_requested','quotation_received','treatment_plan_shared','negotiation','decision_pending','converted','lost') DEFAULT 'new_lead'`);
    console.log('✅  Enum finalized');

  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  }

  console.log('\n✅  Status migration complete.');
  process.exit(0);
})();