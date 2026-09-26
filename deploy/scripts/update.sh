#!/bin/bash
# =============================================================================
# Healthqube Eyes — Zero-Downtime Update Script
# Run this after initial deploy to push new code without downtime
# Usage: sudo ./update.sh [--skip-migrate] [--skip-admin]
# =============================================================================

set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

APP_DIR="/opt/healthqubes-eye"
SKIP_MIGRATE=false
SKIP_ADMIN=false

for arg in "$@"; do
  [[ "$arg" == "--skip-migrate" ]] && SKIP_MIGRATE=true
  [[ "$arg" == "--skip-admin"   ]] && SKIP_ADMIN=true
done

START_TIME=$(date +%s)

section "Pulling latest code"
cd "$APP_DIR/api"
git pull origin main
log "Code updated"

section "Installing dependencies"
npm ci --omit=dev --quiet
log "Dependencies installed"

if [ "$SKIP_MIGRATE" = false ]; then
  section "Running migrations"
  node src/config/migrate.js
  log "Migrations complete"
fi

section "Reloading API (zero downtime)"
pm2 reload healthqubes-api --update-env
log "API reloaded"

if [ "$SKIP_ADMIN" = false ] && [ -d "$APP_DIR/admin-src" ]; then
  section "Building admin panel"
  cd "$APP_DIR/admin-src"
  npm ci --quiet
  npm run build
  rsync -a --delete build/ "$APP_DIR/admin/build/"
  log "Admin panel built and deployed"
fi

section "Reloading Nginx"
nginx -t && systemctl reload nginx
log "Nginx reloaded"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}✅ Update complete in ${DURATION}s${NC}"
echo "  API status: $(pm2 show healthqubes-api | grep status | head -1)"
