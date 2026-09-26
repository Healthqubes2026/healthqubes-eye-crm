const db = require('./database');
const { ensureColumn, ensureConstraint } = require('./migration-utils');

const migrations = [
  // ── Ad Integration Configs Table ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ad_integrations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    type            ENUM('facebook','google_ads','google_leads') NOT NULL,
    platform_id     VARCHAR(255) NOT NULL UNIQUE,
    business_id     VARCHAR(255),
    access_token    TEXT,
    webhook_secret  VARCHAR(255),
    config          JSON,
    is_active       BOOLEAN DEFAULT TRUE,
    last_sync       DATETIME,
    error_message   TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      INT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_type (type),
    INDEX idx_active (is_active)
  ) ENGINE=InnoDB`,

  // ── Ad Campaign Metadata Table ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ad_campaigns (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    lead_id         INT NOT NULL,
    integration_id  INT NOT NULL,
    platform        ENUM('facebook','google_ads') NOT NULL,
    campaign_id     VARCHAR(255),
    campaign_name   VARCHAR(255),
    ad_set_id       VARCHAR(255),
    ad_set_name     VARCHAR(255),
    ad_id           VARCHAR(255),
    ad_name         VARCHAR(255),
    form_id         VARCHAR(255),
    form_name       VARCHAR(255),
    utm_source      VARCHAR(100),
    utm_medium      VARCHAR(100),
    utm_campaign    VARCHAR(100),
    utm_content     VARCHAR(100),
    utm_term        VARCHAR(100),
    cost_per_lead   DECIMAL(10,4),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (integration_id) REFERENCES ad_integrations(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_campaign (campaign_id),
    INDEX idx_platform (platform)
  ) ENGINE=InnoDB`,

  // ── Webhook Logs Table ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS webhook_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    integration_id  INT NOT NULL,
    event_type      VARCHAR(100),
    payload         JSON,
    status          ENUM('success','failed','duplicate') DEFAULT 'success',
    error_message   TEXT,
    lead_id         INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES ad_integrations(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created (created_at)
  ) ENGINE=InnoDB`,
];

exports.runMigrations = async () => {
  try {
    console.log('🔄 Running ad integration migrations...');

    for (const migration of migrations) {
      await db.query(migration);
    }

    await ensureColumn('leads', 'ad_source', 'ad_source VARCHAR(50) AFTER source');
    await ensureColumn('leads', 'ad_campaign', 'ad_campaign VARCHAR(255) AFTER ad_source');
    await ensureColumn('leads', 'utm_source', 'utm_source VARCHAR(100) AFTER ad_campaign');
    await ensureColumn('leads', 'utm_medium', 'utm_medium VARCHAR(100) AFTER utm_source');
    await ensureColumn('leads', 'utm_campaign', 'utm_campaign VARCHAR(100) AFTER utm_medium');
    await ensureColumn('leads', 'is_duplicate', 'is_duplicate BOOLEAN DEFAULT FALSE AFTER utm_campaign');
    await ensureColumn('leads', 'duplicate_of_id', 'duplicate_of_id INT AFTER is_duplicate');
    await ensureConstraint(
      'leads',
      'fk_duplicate_lead',
      'ADD CONSTRAINT fk_duplicate_lead FOREIGN KEY (duplicate_of_id) REFERENCES leads(id) ON DELETE SET NULL'
    );

    console.log('✅ Ad integration migrations completed successfully');
    return { success: true };
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  }
};

// Run if called directly
if (require.main === module) {
  exports.runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
