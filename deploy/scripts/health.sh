#!/bin/bash
# =============================================================================
# Healthqube Eyes — Health Monitor
# Run manually: ./health.sh
# Or as cron (every 5 min): */5 * * * * /opt/healthqubes-eye/scripts/health.sh >> /opt/healthqubes-eye/logs/health.log 2>&1
# =============================================================================

set -uo pipefail

DOMAIN="${DOMAIN:-api.healthqubes.in}"
APP_DIR="/opt/healthqubes-eye"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
LOG_FILE="$APP_DIR/logs/health.log"
ALERT_FILE="/tmp/healthqubes_alert_sent"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAILED+=("$1"); }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

FAILED=()
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "══ Healthqube Eyes Health Check — $TIMESTAMP ══"

# ── 1. API process ────────────────────────────────────────────────────────────
if pm2 show healthqubes-api 2>/dev/null | grep -q "online"; then
  WORKERS=$(pm2 show healthqubes-api 2>/dev/null | grep instances | awk '{print $4}')
  ok "PM2: healthqubes-api running ($WORKERS workers)"
else
  fail "PM2: healthqubes-api is NOT running"
fi

# ── 2. API health endpoint ────────────────────────────────────────────────────
HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:5000/health" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  RESPONSE=$(curl -sf "http://localhost:5000/health" || echo '{}')
  DB_STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db','?'))" 2>/dev/null || echo "?")
  ok "API health: HTTP $HTTP_STATUS · DB: $DB_STATUS"
else
  fail "API health: HTTP $HTTP_STATUS (expected 200)"
fi

# ── 3. MySQL ──────────────────────────────────────────────────────────────────
if mysqladmin ping -u root --silent 2>/dev/null; then
  ok "MySQL: running"
else
  fail "MySQL: not responding"
fi

# ── 4. Nginx ──────────────────────────────────────────────────────────────────
if systemctl is-active nginx --quiet; then
  ok "Nginx: active"
else
  fail "Nginx: not active"
fi

# ── 5. Disk space ─────────────────────────────────────────────────────────────
DISK_USE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USE" -lt 80 ]; then
  ok "Disk: ${DISK_USE}% used"
elif [ "$DISK_USE" -lt 90 ]; then
  warn "Disk: ${DISK_USE}% used (getting full)"
else
  fail "Disk: ${DISK_USE}% used (CRITICAL)"
fi

# ── 6. Memory ─────────────────────────────────────────────────────────────────
MEM_USE=$(free | awk 'NR==2{printf "%.0f", $3/$2*100}')
if [ "$MEM_USE" -lt 85 ]; then
  ok "Memory: ${MEM_USE}% used"
else
  warn "Memory: ${MEM_USE}% used (high)"
fi

# ── 7. Upload directory ───────────────────────────────────────────────────────
if [ -d "$APP_DIR/uploads" ] && [ -w "$APP_DIR/uploads" ]; then
  ok "Uploads directory: writable"
else
  fail "Uploads directory: missing or not writable"
fi

# ── 8. SSL certificate expiry ─────────────────────────────────────────────────
CERT_FILE="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
  EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
  EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY_DATE" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

  if [ "$DAYS_LEFT" -gt 14 ]; then
    ok "SSL cert: expires in $DAYS_LEFT days"
  elif [ "$DAYS_LEFT" -gt 0 ]; then
    warn "SSL cert: expires in $DAYS_LEFT days — renew soon!"
    FAILED+=("SSL cert expiring in $DAYS_LEFT days")
  else
    fail "SSL cert: EXPIRED"
  fi
else
  warn "SSL cert: not found at $CERT_FILE"
fi

# ── Summary + alert ───────────────────────────────────────────────────────────
echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All systems healthy${NC}"
  rm -f "$ALERT_FILE"
else
  echo -e "${RED}❌ ${#FAILED[@]} check(s) FAILED:${NC}"
  for f in "${FAILED[@]}"; do echo "   • $f"; done

  # Send Slack alert (once per incident — don't spam)
  if [ -n "$SLACK_WEBHOOK" ] && [ ! -f "$ALERT_FILE" ]; then
    FAILURES=$(printf '• %s\n' "${FAILED[@]}")
    curl -s -X POST "$SLACK_WEBHOOK" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"🚨 *Healthqube Eyes Alert* — Server issues detected at $TIMESTAMP:\n$FAILURES\"}" \
      > /dev/null 2>&1
    touch "$ALERT_FILE"
  fi

  exit 1
fi
