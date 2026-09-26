// ecosystem.config.js
// Run with: pm2 start ecosystem.config.js --env production
// Or:       pm2 reload ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name:             'healthqubes-api',
      script:           'src/server.js',
      cwd:              '/opt/healthqubes-eye/api',
      instances:        'max',        // one per CPU core
      exec_mode:        'cluster',

      // ── Auto-restart thresholds ────────────────────────────────────────────
      max_memory_restart: '400M',
      restart_delay:      3000,
      max_restarts:       10,
      min_uptime:         '10s',

      // ── Logging ───────────────────────────────────────────────────────────
      log_file:    '/opt/healthqubes-eye/logs/combined.log',
      out_file:    '/opt/healthqubes-eye/logs/out.log',
      error_file:  '/opt/healthqubes-eye/logs/error.log',
      merge_logs:  true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── Environment ───────────────────────────────────────────────────────
      env_production: {
        NODE_ENV: 'production',
        PORT:     5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT:     5000,
      },

      // ── Graceful shutdown ─────────────────────────────────────────────────
      kill_timeout:       5000,
      listen_timeout:     8000,
      shutdown_with_message: true,

      // ── Watch (disabled in production) ────────────────────────────────────
      watch:         false,
      ignore_watch:  ['node_modules', 'uploads', 'logs', '.git'],
    },
  ],
};
