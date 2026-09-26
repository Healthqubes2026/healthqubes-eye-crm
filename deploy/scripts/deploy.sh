#!/bin/bash
# =============================================================================
# Healthqube Eyes — Master Deployment Script
# Tested on: Ubuntu 22.04 LTS
# Run as root or with sudo
# Usage: curl -fsSL https://your-server.com/deploy.sh | bash
#        OR: chmod +x deploy.sh && sudo ./deploy.sh
# =============================================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}══════════════════════════════════════${NC}"; }

# ── Configuration (edit before running) ───────────────────────────────────────
DOMAIN="${DOMAIN:-api.healthqubes.in}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.healthqubes.in}"
APP_DIR="/opt/healthqubes-eye"
DB_NAME="healthqubes_eye"
DB_USER="healthqubes"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -d '=+/')}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48 | tr -d '=+/')}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -base64 48 | tr -d '=+/')}"
NODE_VERSION="20"
REPO_URL="${REPO_URL:-}"  # Set if deploying from git

echo -e "${BLUE}"
cat << 'EOF'
  ╔══════════════════════════════════════════════════════╗
  ║         HEALTHQUBE EYES — DEPLOYMENT                 ║
  ║     Smart Eye Care FieldForce & Sales System         ║
  ╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# ── 1. System update ──────────────────────────────────────────────────────────
section "1. Updating system packages"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip zip build-essential \
  ca-certificates gnupg lsb-release \
  ufw fail2ban certbot python3-certbot-nginx
log "System packages installed"

# ── 2. Install Node.js ────────────────────────────────────────────────────────
section "2. Installing Node.js $NODE_VERSION"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
log "Node.js $(node -v) · npm $(npm -v)"

# ── 3. Install MySQL 8 ────────────────────────────────────────────────────────
section "3. Installing MySQL 8"
if ! command -v mysql &>/dev/null; then
  apt-get install -y mysql-server
  systemctl enable mysql
  systemctl start mysql
fi

# Secure and create DB
mysql -u root << MYSQL_EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}_root';
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
log "MySQL 8 configured · DB: $DB_NAME · User: $DB_USER"

# ── 4. Install Nginx ──────────────────────────────────────────────────────────
section "4. Installing Nginx"
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
  systemctl enable nginx
fi
log "Nginx $(nginx -v 2>&1 | grep -o '[0-9.]*')"

# ── 5. Install PM2 (process manager) ─────────────────────────────────────────
section "5. Installing PM2"
npm install -g pm2 --quiet
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
log "PM2 installed"

# ── 6. App setup ──────────────────────────────────────────────────────────────
section "6. Setting up application"
mkdir -p "$APP_DIR"/{api,admin,uploads/{selfies,meetings,reports},logs}

# If no repo, assume files are uploaded manually
if [ -n "$REPO_URL" ]; then
  if [ -d "$APP_DIR/api/.git" ]; then
    cd "$APP_DIR/api" && git pull
  else
    git clone "$REPO_URL" "$APP_DIR/api"
  fi
fi

# ── 7. Write .env ─────────────────────────────────────────────────────────────
section "7. Writing environment config"
cat > "$APP_DIR/api/.env" << EOF
NODE_ENV=production
PORT=5000
API_VERSION=v1

DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=30d

OTP_EXPIRY_MINUTES=10
OTP_LENGTH=6

UPLOAD_PATH=/opt/healthqubes-eye/uploads
MAX_FILE_SIZE_MB=10

FRONTEND_URL=https://${ADMIN_DOMAIN}
ADMIN_PANEL_URL=https://${ADMIN_DOMAIN}

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
chmod 600 "$APP_DIR/api/.env"
log ".env written (permissions: 600)"

# ── 8. Install Node deps + migrate ───────────────────────────────────────────
section "8. Installing API dependencies & running migrations"
cd "$APP_DIR/api"
npm ci --omit=dev --quiet
node src/config/migrate.js
log "Dependencies installed · Database migrated"

# ── 9. PM2 process ────────────────────────────────────────────────────────────
section "9. Starting API with PM2"
pm2 delete healthqubes-api 2>/dev/null || true
pm2 start src/server.js \
  --name healthqubes-api \
  --instances max \
  --exec-mode cluster \
  --max-memory-restart 400M \
  --log "$APP_DIR/logs/api.log" \
  --merge-logs \
  --env production
pm2 save
log "API running in cluster mode ($(nproc) workers)"

# ── 10. Nginx config ──────────────────────────────────────────────────────────
section "10. Configuring Nginx"

cat > /etc/nginx/sites-available/healthqubes-api << NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 15M;
    gzip on;
    gzip_types application/json text/plain;

    location /health {
        proxy_pass http://localhost:5000;
    }

    location ~ ^/api/v1/auth/(login|otp|verify) {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /api/ {
        limit_req zone=api burst=30 nodelay;
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        alias /opt/healthqubes-eye/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

cat > /etc/nginx/sites-available/healthqubes-admin << NGINX
server {
    listen 80;
    server_name ${ADMIN_DOMAIN};

    root /opt/healthqubes-eye/admin/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# Rate limit zones in nginx.conf http block
grep -q 'limit_req_zone' /etc/nginx/nginx.conf || \
  sed -i '/http {/a\    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;\n    limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;' \
  /etc/nginx/nginx.conf

ln -sf /etc/nginx/sites-available/healthqubes-api   /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/healthqubes-admin  /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
log "Nginx configured"

# ── 11. Firewall ──────────────────────────────────────────────────────────────
section "11. Configuring firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
log "UFW firewall enabled (SSH + HTTP/HTTPS)"

# ── 12. SSL with Let's Encrypt ────────────────────────────────────────────────
section "12. SSL certificates"
if [ "$DOMAIN" != "api.healthqubes.in" ]; then
  certbot --nginx \
    -d "$DOMAIN" \
    -d "$ADMIN_DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "admin@${DOMAIN}" \
    --redirect || warn "SSL setup failed — run certbot manually after DNS propagates"
  log "SSL certificates issued"
else
  warn "Using placeholder domain — run certbot manually after setting real domain"
fi

# ── 13. Fail2ban ──────────────────────────────────────────────────────────────
section "13. Configuring Fail2ban"
cat > /etc/fail2ban/jail.local << 'F2B'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true
F2B
systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2ban active"

# ── 14. Logrotate ─────────────────────────────────────────────────────────────
section "14. Setting up log rotation"
cat > /etc/logrotate.d/healthqubes << 'LR'
/opt/healthqubes-eye/logs/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
LR
log "Log rotation configured (14-day retention)"

# ── 15. Cron — daily backup ───────────────────────────────────────────────────
section "15. Setting up automated database backup"
mkdir -p /opt/healthqubes-eye/backups
cat > /etc/cron.d/healthqubes-backup << CRON
# Healthqube Eyes — daily MySQL backup at 2 AM
0 2 * * * root mysqldump -u${DB_USER} -p${DB_PASS} ${DB_NAME} | gzip > /opt/healthqubes-eye/backups/db_\$(date +\%Y\%m\%d).sql.gz && find /opt/healthqubes-eye/backups -name "*.sql.gz" -mtime +30 -delete
CRON
log "Daily backup scheduled at 02:00 AM (30-day retention)"

# ── Summary ───────────────────────────────────────────────────────────────────
section "🎉 Deployment Complete"

echo -e "${GREEN}"
cat << SUMMARY
  ┌─────────────────────────────────────────────────────┐
  │         HEALTHQUBE EYES — SYSTEM READY             │
  ├─────────────────────────────────────────────────────┤
  │  API Server     : http://${DOMAIN}            │
  │  Admin Panel    : http://${ADMIN_DOMAIN}      │
  │  Health Check   : http://${DOMAIN}/health     │
  │  PM2 Status     : pm2 status                        │
  │  PM2 Logs       : pm2 logs healthqubes-api            │
  │  Nginx Logs     : tail -f /var/log/nginx/access.log │
  ├─────────────────────────────────────────────────────┤
  │  DB Name        : ${DB_NAME}                        │
  │  DB User        : ${DB_USER}                        │
  │  DB Password    : ${DB_PASS}                        │
  │  JWT Secret     : (saved in .env)                   │
  ├─────────────────────────────────────────────────────┤
  │  NEXT STEPS:                                        │
  │  1. Upload admin panel build → /opt/healthqubes-eye/  │
  │     admin/build/                                    │
  │  2. Run seed: cd api && node src/config/seed.js     │
  │  3. Add Firebase config to .env                     │
  │  4. Point DNS A records to this server IP           │
  │  5. Run certbot for SSL (if domain is live)         │
  └─────────────────────────────────────────────────────┘
SUMMARY
echo -e "${NC}"

# Save credentials to file
cat > /root/healthqubes-credentials.txt << CREDS
Healthqubes Eye Deployment Credentials
Generated: $(date)
=====================================
Domain:         ${DOMAIN}
Admin Domain:   ${ADMIN_DOMAIN}
DB Name:        ${DB_NAME}
DB User:        ${DB_USER}
DB Password:    ${DB_PASS}
JWT Secret:     ${JWT_SECRET}
JWT Refresh:    ${JWT_REFRESH_SECRET}
=====================================
CREDS
chmod 600 /root/healthqubes-credentials.txt
warn "Credentials saved to /root/healthqubes-credentials.txt — keep this safe!"
