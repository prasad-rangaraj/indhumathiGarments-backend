# 🚀 Indhumathi Garments — Professional AWS EC2 Deployment Guide

> **Stack**: Fastify 5 · TypeScript · TypeORM · PostgreSQL · JWT · Razorpay · Google OAuth · Brevo SMTP · Multer uploads
> **Target OS**: Amazon Linux 2023 / Ubuntu 22.04 LTS on EC2

---

## 📋 Table of Contents

1. [Project Summary](#project-summary)
2. [Prerequisites](#prerequisites)
3. [Phase 1 — EC2 Instance Setup](#phase-1--ec2-instance-setup)
4. [Phase 2 — Server Hardening & Dependencies](#phase-2--server-hardening--dependencies)
5. [Phase 3 — Database Setup (PostgreSQL)](#phase-3--database-setup-postgresql)
6. [Phase 4 — Application Deployment](#phase-4--application-deployment)
7. [Phase 5 — Process Management with PM2](#phase-5--process-management-with-pm2)
8. [Phase 6 — Nginx Reverse Proxy & SSL](#phase-6--nginx-reverse-proxy--ssl)
9. [Phase 7 — Environment Variables (Production)](#phase-7--environment-variables-production)
10. [Phase 8 — File Uploads & Storage](#phase-8--file-uploads--storage)
11. [Phase 9 — Monitoring & Logging](#phase-9--monitoring--logging)
12. [Phase 10 — CI/CD with GitHub Actions](#phase-10--cicd-with-github-actions)
13. [Troubleshooting](#troubleshooting)
14. [Security Checklist](#security-checklist)

---

## Project Summary

| Item | Value |
|---|---|
| **Runtime** | Node.js 20 LTS |
| **Framework** | Fastify 5 (TypeScript) |
| **ORM** | TypeORM 0.3 |
| **Database** | PostgreSQL 15 |
| **Auth** | JWT + Google OAuth 2.0 |
| **Payments** | Razorpay |
| **Email** | Brevo (Sendinblue) |
| **File storage** | Local `/uploads` (migrate to S3 for production scale) |
| **Port** | `5001` (configurable via `PORT` env var) |

---

## Prerequisites

- AWS account with EC2 and RDS (or self-hosted PostgreSQL) access
- Domain name pointed to your EC2 Elastic IP
- SSH key pair (`.pem` file) downloaded
- GitHub repository with your code

---

## Phase 1 — EC2 Instance Setup

### 1.1 Launch EC2 Instance

| Setting | Recommended Value |
|---|---|
| AMI | Ubuntu 22.04 LTS (Free Tier eligible) |
| Instance Type | `t3.small` (2 vCPU, 2 GB RAM) for production |
| Storage | 20 GB gp3 SSD |
| Key Pair | Create or use existing `.pem` |

### 1.2 Security Group Rules (Inbound)

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | Your IP only | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (Nginx) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (SSL) |
| 5001 | TCP | 127.0.0.1 | App port (localhost-only, Nginx proxies) |
| 5432 | TCP | EC2 Security Group | PostgreSQL (only if using separate RDS) |

> ⚠️ **Never expose port 5001 or 5432 to 0.0.0.0/0 in production!**

### 1.3 Allocate Elastic IP

In EC2 → Elastic IPs → Allocate → Associate to your instance.
This ensures your IP doesn't change on restart.

### 1.4 Connect via SSH

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
```

---

## Phase 2 — Server Hardening & Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl wget unzip build-essential

# Install Node.js 20 LTS via NVM (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node -v   # Should print v20.x.x

# Install PM2 globally
npm install -g pm2

# Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Phase 3 — Database Setup (PostgreSQL)

### Option A: PostgreSQL on the same EC2 (simpler, free)

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create DB user and database
sudo -u postgres psql <<EOF
CREATE USER garments_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE indhumathi_garments OWNER garments_user;
GRANT ALL PRIVILEGES ON DATABASE indhumathi_garments TO garments_user;
EOF
```

### Option B: AWS RDS PostgreSQL (recommended for production)

1. Launch RDS → PostgreSQL 15 → db.t3.micro (Free Tier)
2. Set your DB name, master username, and password
3. In **VPC Security Group**, allow port `5432` from your EC2 security group only
4. Set `DATABASE_URL` in your `.env.production`:

```
DATABASE_URL="postgresql://garments_user:PASS@your-rds-endpoint.rds.amazonaws.com:5432/indhumathi_garments"
```

---

## Phase 4 — Application Deployment

### 4.1 Clone Repository

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/indhumathiGarments-backend.git
cd indhumathiGarments-backend
```

### 4.2 Install Dependencies

```bash
npm ci --omit=dev
```

> Use `npm ci` (not `npm install`) for reproducible, production-safe installs.

### 4.3 Create Production Environment File

```bash
nano .env.production
```

Paste your production values (see [Phase 7](#phase-7--environment-variables-production)).

```bash
# Link the production env
cp .env.production .env
```

### 4.4 Build TypeScript

```bash
npm run build
```

This compiles `src/` → `dist/` using `tsc`.

### 4.5 Run Database Migrations

```bash
# TypeORM will auto-sync on startup if synchronize: true
# For production, use explicit migrations:
npx typeorm migration:run -d dist/lib/db.js
```

### 4.6 Verify Startup Manually

```bash
node dist/index.js
# Should print: Server running on port 5001
# Check health: curl http://localhost:5001/api/health
```

Press `Ctrl+C` — PM2 will manage this in the next step.

---

## Phase 5 — Process Management with PM2

PM2 keeps your app alive after crashes and server reboots.

```bash
# Start application with PM2
pm2 start dist/index.js --name "indhumathi-backend" --node-args="--max-old-space-size=512"

# Save process list (survives reboots)
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs (it will start with: sudo env PATH=...)
```

### Useful PM2 Commands

```bash
pm2 status                        # View all processes
pm2 logs indhumathi-backend       # View live logs
pm2 logs indhumathi-backend --lines 100   # Last 100 lines
pm2 restart indhumathi-backend    # Restart app
pm2 reload indhumathi-backend     # Zero-downtime reload
pm2 stop indhumathi-backend       # Stop app
pm2 monit                         # CPU/Memory dashboard
```

### ecosystem.config.js (Recommended PM2 config)

Create this file in your project root:

```js
// ecosystem.config.js
export default {
  apps: [
    {
      name: 'indhumathi-backend',
      script: 'dist/index.js',
      instances: 'max',          // Cluster mode — uses all CPU cores
      exec_mode: 'cluster',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      error_file: '/var/log/pm2/indhumathi-error.log',
      out_file: '/var/log/pm2/indhumathi-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '400M',
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## Phase 6 — Nginx Reverse Proxy & SSL

### 6.1 Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/indhumathi
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;   # ← Replace with your domain

    # Increase upload size for product images
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # Serve uploaded images directly via Nginx (faster)
    location /uploads/ {
        alias /home/ubuntu/indhumathiGarments-backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/indhumathi /etc/nginx/sites-enabled/
sudo nginx -t          # Test config
sudo systemctl reload nginx
```

### 6.2 SSL Certificate with Let's Encrypt (Free HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
# Follow prompts — it will auto-update nginx config for HTTPS
```

Certbot auto-renews via cron. Verify:

```bash
sudo certbot renew --dry-run
```

---

## Phase 7 — Environment Variables (Production)

Create `/home/ubuntu/indhumathiGarments-backend/.env` with your production values:

```env
# ─── Server ───────────────────────────────────────────────
NODE_ENV=production
PORT=5001

# ─── Database ─────────────────────────────────────────────
# Option A: Local PostgreSQL
DATABASE_URL="postgresql://garments_user:YOUR_STRONG_DB_PASSWORD@localhost:5432/indhumathi_garments"
# Option B: RDS
# DATABASE_URL="postgresql://garments_user:PASS@your-rds.amazonaws.com:5432/indhumathi_garments"

# ─── CORS ─────────────────────────────────────────────────
FRONTEND_URL=https://yourdomain.com

# ─── JWT ──────────────────────────────────────────────────
# Generate strong secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=YOUR_LONG_RANDOM_64_CHAR_SECRET

# ─── Google OAuth ─────────────────────────────────────────
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# ─── Brevo Email ──────────────────────────────────────────
BREVO_API_KEY=YOUR_BREVO_API_KEY
BREVO_SENDER_EMAIL=indhumathi.img@gmail.com
BREVO_SENDER_NAME=Indhumathi Garments

# ─── Razorpay ─────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX      # Switch to LIVE key!
RAZORPAY_KEY_SECRET=YOUR_LIVE_RAZORPAY_SECRET
```

> 🔐 **Security**: Never commit `.env` to GitHub. It is already in `.gitignore`.

---

## Phase 8 — File Uploads & Storage

### Current Setup
Your app stores uploaded product images in the `uploads/` directory and serves them via `/uploads/:filename`. This works but is **not scalable** across multiple EC2 instances.

### Recommended: Migrate to AWS S3

1. Create an S3 bucket (e.g., `indhumathi-garments-uploads`)
2. Set bucket policy (public read for product images)
3. Create IAM user with `AmazonS3FullAccess`, download Access Keys
4. Install AWS SDK: `npm install @aws-sdk/client-s3`
5. Replace `multer` disk storage with S3 upload in your routes

For now, ensure `uploads/` directory persists across deployments:

```bash
# On EC2, create the uploads directory (it's in .gitignore so won't be cloned)
mkdir -p /home/ubuntu/indhumathiGarments-backend/uploads
chmod 755 /home/ubuntu/indhumathiGarments-backend/uploads
```

---

## Phase 9 — Monitoring & Logging

### CloudWatch Agent (AWS Native)

```bash
# Install CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

Attach `CloudWatchAgentServerPolicy` IAM role to your EC2 instance.

### Application Health Check

Your app already has a health endpoint:

```
GET /api/health
→ { status: "ok", message: "Indhumathi API is running..." }
```

Add to AWS Route 53 Health Checks or use an uptime monitor (UptimeRobot is free).

### Log Rotation

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Phase 10 — CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml` in your repo:

```yaml
name: Deploy to AWS EC2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/indhumathiGarments-backend
            git pull origin main
            npm ci --omit=dev
            npm run build
            pm2 reload indhumathi-backend --update-env
            echo "✅ Deployment complete"
```

### GitHub Secrets to Add

Navigate to: **Repo → Settings → Secrets → Actions → New secret**

| Secret Name | Value |
|---|---|
| `EC2_HOST` | Your EC2 Elastic IP |
| `EC2_SSH_KEY` | Contents of your `.pem` file |

---

## Troubleshooting

### App crashes on startup
```bash
pm2 logs indhumathi-backend --lines 50
# Check for missing env vars or DB connection errors
```

### Cannot connect to PostgreSQL
```bash
sudo systemctl status postgresql
psql -U garments_user -d indhumathi_garments -h localhost
# Check DATABASE_URL in .env matches the credentials above
```

### Nginx 502 Bad Gateway
```bash
# App is not running on port 5001
pm2 status
curl http://localhost:5001/api/health
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew
```

### OracleDB module errors
Your `package.json` includes `oracledb`. If you're using PostgreSQL only, remove it:
```bash
npm uninstall oracledb
```
Then rebuild and restart.

---

## Security Checklist

- [ ] `.env` is **not** committed to GitHub
- [ ] PostgreSQL port 5432 is **not** exposed to the internet
- [ ] App port 5001 is **not** exposed to the internet (Nginx proxies it)
- [ ] SSH (port 22) is restricted to **your IP** only
- [ ] JWT_SECRET is a strong, random 64-char hex string
- [ ] Razorpay keys switched from **test** to **live** for production
- [ ] SSL certificate installed (HTTPS)
- [ ] PM2 startup configured (survives reboots)
- [ ] Regular DB backups enabled (RDS automated snapshots OR `pg_dump` cron)
- [ ] CloudWatch or uptime monitoring enabled
- [ ] `ubuntu` user does **not** have a password (key-pair only access)

---

## Quick Reference — Deploy from Scratch

```bash
# 1. Connect
ssh -i key.pem ubuntu@<EC2_IP>

# 2. One-time setup (Phase 2-3)
sudo apt update && sudo apt upgrade -y
# ... (see Phase 2 and 3 above)

# 3. Clone & build
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/indhumathiGarments-backend.git
cd indhumathiGarments-backend
cp .env.production .env
npm ci --omit=dev && npm run build

# 4. Start
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup

# 5. Nginx + SSL
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com

# 6. Verify
curl https://api.yourdomain.com/api/health
```

---

*Generated: 2026-04-24 | Architecture: Fastify 5 + TypeScript + PostgreSQL + AWS EC2*
