# Healthqube Eyes — Deployment Guide

> Complete production deployment for Ubuntu 22.04 LTS

---

## Architecture

```
Internet
    │
    ▼
Nginx (80/443)
├── api.healthqube.in     → PM2 cluster (Node.js :5000)
│                              └── MySQL 8 (:3306)
└── admin.healthqube.in   → Static files (React build)

Mobile App (Android APK) → api.healthqube.in/api/v1
```

---

## Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU      | 1 vCPU  | 2+ vCPUs    |
| RAM      | 2 GB    | 4 GB        |
| Disk     | 20 GB   | 40 GB SSD   |
| OS       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Ports    | 22, 80, 443 | 22, 80, 443 |

**Recommended providers:** DigitalOcean, Hetzner, AWS EC2 (t3.small+), Vultr

---

## One-Command Deploy (Fresh Server)

```bash
# Upload your project files first, then:
export DOMAIN="api.yourdomain.com"
export ADMIN_DOMAIN="admin.yourdomain.com"
export DB_PASS="your_secure_db_password"

chmod +x scripts/deploy.sh
sudo -E ./scripts/deploy.sh
```

The script handles everything: Node.js, MySQL, Nginx, PM2, firewall, SSL, log rotation, and daily backups.

---

## Manual Step-by-Step

### 1. Server prep
```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw fail2ban certbot python3-certbot-nginx
```

### 2. Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 3. MySQL 8
```bash
apt-get install -y mysql-server
systemctl enable --now mysql
mysql_secure_installation
```

### 4. Create database
```sql
CREATE DATABASE healthqubes_eye CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'healthqubes'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON healthqubes_eye.* TO 'healthqubes'@'localhost';
FLUSH PRIVILEGES;
```

### 5. Deploy API
```bash
mkdir -p /opt/healthqubes-eye
cd /opt/healthqubes-eye
git clone <your-repo> api
cd api
cp .env.example .env
nano .env           # fill in DB credentials, JWT secrets
npm ci --omit=dev
node src/config/migrate.js
node src/config/seed.js     # optional — sample data
```

### 6. PM2 process manager
```bash
npm install -g pm2
cd /opt/healthqubes-eye
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash
```

### 7. Nginx
```bash
cp nginx/healthqubes.conf /etc/nginx/sites-available/healthqubes
ln -s /etc/nginx/sites-available/healthqubes /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 8. Build & deploy admin panel
```bash
# On your local machine:
cd healthqubes-eye-admin
echo "REACT_APP_API_URL=https://api.yourdomain.com/api/v1" > .env
npm install && npm run build

# Upload build to server:
rsync -az build/ user@your-server:/opt/healthqubes-eye/admin/build/
```

### 9. SSL
```bash
certbot --nginx \
  -d api.yourdomain.com \
  -d admin.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --redirect
```

### 10. Firewall
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## DNS Configuration

Point these A records to your server IP:

| Record | Type | Value |
|--------|------|-------|
| `api.yourdomain.com`   | A | `YOUR_SERVER_IP` |
| `admin.yourdomain.com` | A | `YOUR_SERVER_IP` |

Allow 10-60 minutes for DNS propagation before running certbot.

---

## GitHub Actions CI/CD

### Setup
1. Push your code to GitHub with this structure:
   ```
   /
   ├── backend/   (the Node.js API)
   ├── admin/     (the React admin panel)
   └── .github/workflows/deploy.yml
   ```

2. Copy `github-actions/deploy.yml` → `.github/workflows/deploy.yml`

3. Add these secrets in GitHub → Settings → Secrets → Actions:

   | Secret | Value |
   |--------|-------|
   | `SERVER_HOST` | Your server IP |
   | `SERVER_USER` | `root` or `ubuntu` |
   | `SSH_PRIVATE_KEY` | Contents of `~/.ssh/id_rsa` |
   | `DOMAIN` | `api.yourdomain.com` |
   | `SLACK_WEBHOOK_URL` | (optional) Slack webhook |

4. Every push to `main` → runs tests → builds admin → deploys to server.

---

## Routine Operations

### View logs
```bash
pm2 logs healthqubes-api          # live API logs
pm2 logs healthqubes-api --lines 100  # last 100 lines
tail -f /var/log/nginx/healthqubes-api-access.log
```

### Restart / reload
```bash
pm2 reload healthqubes-api        # zero-downtime reload
pm2 restart healthqubes-api       # full restart (brief downtime)
```

### Database backup
```bash
chmod +x scripts/db.sh
./scripts/db.sh backup          # create backup
./scripts/db.sh list            # list backups
./scripts/db.sh restore backups/healthqubes_20260401_020000.sql.gz
```

### Update to latest code
```bash
chmod +x scripts/update.sh
sudo ./scripts/update.sh
```

### Health check
```bash
chmod +x scripts/health.sh
./scripts/health.sh
```

### Add to cron (every 5 minutes)
```bash
echo "*/5 * * * * root /opt/healthqubes-eye/scripts/health.sh >> /opt/healthqubes-eye/logs/health.log 2>&1" \
  >> /etc/cron.d/healthqubes
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | API port (default: 5000) |
| `DB_HOST` | Yes | MySQL host |
| `DB_USER` | Yes | MySQL user |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars, random |
| `FIREBASE_PROJECT_ID` | Push notifications | From Firebase console |
| `FIREBASE_PRIVATE_KEY` | Push notifications | From Firebase console |
| `FIREBASE_CLIENT_EMAIL` | Push notifications | From Firebase console |
| `MSG91_AUTH_KEY` | OTP SMS | From MSG91 dashboard |
| `GOOGLE_MAPS_API_KEY` | Maps | From Google Cloud |
| `FRONTEND_URL` | CORS | Admin panel URL |

---

## Security Checklist

- [ ] Strong passwords for MySQL (`openssl rand -base64 32`)
- [ ] JWT secrets are 48+ random characters
- [ ] Firewall only allows 22, 80, 443
- [ ] SSL certificate installed and auto-renewing
- [ ] Fail2ban active
- [ ] `/root/healthqubes-credentials.txt` is read-only (`chmod 600`)
- [ ] `.env` is read-only (`chmod 600`)
- [ ] Uploads directory not executable
- [ ] Daily database backups running
- [ ] Health monitoring cron active

---

## Mobile App APK — Pointing to Production

Before building the release APK, update `src/config.js`:

```js
API_URL: 'https://api.yourdomain.com/api/v1',
UPLOAD_URL: 'https://api.yourdomain.com',
```

Then build: `cd android && ./gradlew assembleRelease`

---

## Complete System Summary

| Component | Technology | Location |
|-----------|-----------|----------|
| API Server | Node.js + Express | `/opt/healthqubes-eye/api` |
| Database | MySQL 8 | `localhost:3306` |
| Process Manager | PM2 (cluster) | `pm2 status` |
| Web Server | Nginx | `/etc/nginx` |
| Admin Panel | React (static) | `/opt/healthqubes-eye/admin/build` |
| Uploads | Static files | `/opt/healthqubes-eye/uploads` |
| Backups | gzipped SQL | `/opt/healthqubes-eye/backups` |
| Logs | PM2 + Nginx | `/opt/healthqubes-eye/logs` |
| SSL | Let's Encrypt | `/etc/letsencrypt` |
| Firewall | UFW | `ufw status` |
