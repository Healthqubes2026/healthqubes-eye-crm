const db = require('./database');

async function updateLeadSources() {
  try {
    console.log('Updating lead sources enum...');

    // Update the source enum to include new social media sources
    await db.query(`
      ALTER TABLE leads
      MODIFY COLUMN source ENUM(
        'field',
        'referral',
        'online',
        'camp',
        'other',
        'google_leads',
        'facebook',
        'instagram',
        'linkedin',
        'twitter',
        'whatsapp'
      ) DEFAULT 'field'
    `);

    console.log('Lead sources updated successfully!');
  } catch (error) {
    console.error('Error updating lead sources:', error);
  } finally {
    process.exit();
  }
}

updateLeadSources();