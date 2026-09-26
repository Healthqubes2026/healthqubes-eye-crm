#!/bin/bash
# =============================================================================
# Healthqubes Eye — Database Backup & Restore
# =============================================================================

set -euo pipefail
source /opt/healthqubes-eye/api/.env 2>/dev/null || true

DB_NAME="${DB_NAME:-healthqubes_eye}"
DB_USER="${DB_USER:-healthqubes}"
DB_PASS="${DB_PASSWORD:-}"
BACKUP_DIR="/opt/healthqubes-eye/backups"

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── backup ────────────────────────────────────────────────────────────────────
backup() {
  mkdir -p "$BACKUP_DIR"
  TS=$(date +%Y%m%d_%H%M%S)
  FILE="$BACKUP_DIR/healthqubes_${TS}.sql.gz"

  echo "Backing up $DB_NAME → $FILE"
  mysqldump \
    -u"$DB_USER" \
    -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    "$DB_NAME" | gzip > "$FILE"

  SIZE=$(du -sh "$FILE" | cut -f1)
  log "Backup complete: $FILE ($SIZE)"

  # Keep last 30 days only
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
  log "Old backups pruned (30-day retention)"
}

# ── restore ───────────────────────────────────────────────────────────────────
restore() {
  FILE="${1:-}"
  [ -z "$FILE" ] && { echo "Usage: $0 restore <backup_file.sql.gz>"; exit 1; }
  [ -f "$FILE" ] || error "File not found: $FILE"

  read -rp "⚠️  This will OVERWRITE the database '$DB_NAME'. Are you sure? (yes/no): " CONFIRM
  [ "$CONFIRM" != "yes" ] && { echo "Cancelled."; exit 0; }

  echo "Restoring from $FILE..."
  gunzip -c "$FILE" | mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"
  log "Restore complete"
}

# ── list ──────────────────────────────────────────────────────────────────────
list() {
  echo "Available backups in $BACKUP_DIR:"
  ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  No backups found"
}

case "${1:-backup}" in
  backup)  backup ;;
  restore) restore "${2:-}" ;;
  list)    list ;;
  *)       echo "Usage: $0 {backup|restore <file>|list}" ;;
esac
