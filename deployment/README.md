# PANaCEa Deployment Infrastructure

This directory contains all the necessary infrastructure files and scripts for deploying PANaCEa to production.

## Directory Structure

```
deployment/
├── scripts/          # Deployment automation scripts
│   ├── deploy.sh              # Main deployment script
│   ├── monitor.sh             # System monitoring script
│   ├── verify-deployment.sh   # Deployment verification
│   └── job-stats.ts           # Job queue statistics
├── systemd/          # Linux systemd service files
│   ├── panacea-server.service
│   ├── panacea-worker.service
│   └── README.md
├── cron/             # Cron job configurations
│   ├── panacea.cron
│   └── README.md
└── README.md         # This file
```

## Quick Start

### 1. Verify Prerequisites

```bash
./deployment/scripts/verify-deployment.sh
```

This will check:

- Node.js and npm installed
- All required files present
- Database connectivity
- Dependencies installed

### 2. Run Deployment

```bash
./deployment/scripts/deploy.sh
```

This will:

- Backup the database
- Install dependencies
- Generate Prisma client
- Run database migrations
- Build the application
- Start workers with PM2

### 3. Monitor System

```bash
# One-time status check
./deployment/scripts/monitor.sh

# Continuous monitoring (refreshes every 5 seconds)
./deployment/scripts/monitor.sh --watch
```

## Deployment Methods

### Method 1: PM2 (Recommended)

PM2 provides process management with automatic restarts and log management.

**Setup:**

```bash
# Install PM2 globally
npm install -g pm2

# Start services
pm2 start ecosystem.config.js --env production

# Save configuration for auto-start
pm2 save

# Enable startup script
pm2 startup
```

**Management:**

```bash
pm2 status              # View process status
pm2 logs                # View logs
pm2 restart all         # Restart all processes
pm2 stop all            # Stop all processes
pm2 monit               # Monitor resources
```

### Method 2: Systemd Services

For Linux systems, use systemd for automatic startup and management.

**Setup:**
See `deployment/systemd/README.md` for detailed instructions.

```bash
# Install service files
sudo cp deployment/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable panacea-server panacea-worker
sudo systemctl start panacea-server panacea-worker
```

**Management:**

```bash
sudo systemctl status panacea-server
sudo systemctl restart panacea-worker
sudo journalctl -u panacea-server -f
```

### Method 3: Manual (Development)

For development or simple setups:

```bash
# Terminal 1: Start backend server
npm run dev:server

# Terminal 2: Start background worker
npm run worker

# Terminal 3: Run frontend (if needed)
npm run dev
```

## Scheduled Jobs

Set up recurring tasks using cron:

```bash
# Edit crontab
crontab -e

# Add PANaCEa jobs (see deployment/cron/panacea.cron)
0 0 * * * cd /opt/PANaCEa && npx tsx scripts/scheduleJobs.ts >> logs/scheduler.log 2>&1
0 3 * * * cd /opt/PANaCEa && npx tsx scripts/contentHealthChecker.ts >> logs/health-check.log 2>&1
0 4 * * 0 cd /opt/PANaCEa && npx tsx scripts/cleanupJobs.ts >> logs/cleanup.log 2>&1
```

See `deployment/cron/README.md` for more details.

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

**Required:**

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
CLERK_SECRET_KEY=sk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...
GEMINI_API_KEY=AIza...
```

**Optional (with defaults):**

```env
BACKGROUND_WORKER_ENABLED=true
JOB_QUEUE_POLL_INTERVAL=5000
MAX_JOB_ATTEMPTS=3
NODE_ENV=production
PORT=3001
```

### Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (development)
npx prisma migrate dev

# Run migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## Monitoring

### View Logs

**PM2:**

```bash
pm2 logs                    # All logs
pm2 logs panacea-server     # Server logs only
pm2 logs panacea-worker     # Worker logs only
```

**Systemd:**

```bash
sudo journalctl -u panacea-server -f
sudo journalctl -u panacea-worker -f
```

**Direct:**

```bash
tail -f logs/panacea-server-out.log
tail -f logs/panacea-worker-error.log
```

### Check Job Queue

```bash
# View queue statistics
npx tsx deployment/scripts/job-stats.ts

# Or use monitor script
./deployment/scripts/monitor.sh
```

### Health Checks

```bash
# Run manual health check
npm run health-check

# Check API health endpoint
curl http://localhost:3001/health

# View latest health report
cat content-health-report.json | jq .
```

## Troubleshooting

### Common Issues

**1. Database Connection Failed**

```bash
# Check DATABASE_URL
cat .env | grep DATABASE_URL

# Test connection
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.\$connect().then(() => console.log('OK')).catch(e => console.log('Failed:', e.message));"
```

**2. Worker Not Processing Jobs**

```bash
# Check if worker is running
pm2 status
# or
ps aux | grep backgroundWorker

# Check logs for errors
pm2 logs panacea-worker --lines 50

# Verify jobs exist in queue
npx tsx deployment/scripts/job-stats.ts
```

**3. Port Already in Use**

```bash
# Find what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port in .env
PORT=3002
```

**4. Prisma Client Not Generated**

```bash
# Generate Prisma client
npx prisma generate

# Verify generation
ls -la node_modules/@prisma/client
```

### Debug Mode

Enable detailed logging:

```env
# Add to .env
NODE_ENV=development
DATABASE_LOGGING=true
DEBUG=*
```

## Rollback Procedure

If deployment fails:

**1. Stop New Services**

```bash
pm2 stop all
# or
sudo systemctl stop panacea-server panacea-worker
```

**2. Restore Database**

```bash
# Restore from backup
psql -U user -d panacea < backup_YYYYMMDD_HHMMSS.sql
```

**3. Deploy Previous Version**

```bash
git checkout <previous-commit>
npm install
npm run build
pm2 restart all
```

## Security Checklist

- [ ] Database credentials secured in .env
- [ ] .env file not in version control
- [ ] API keys rotated regularly
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] Services run as non-root user
- [ ] Firewall configured

## Performance Tuning

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_job_priority ON "BackgroundJob"(priority DESC, status, scheduledFor);

-- Analyze tables
ANALYZE "BackgroundJob";
ANALYZE "MedicalContent";
```

### Multiple Workers

```bash
# Scale workers with PM2
pm2 scale panacea-worker 4

# Or run multiple worker instances
pm2 start npm --name "worker-1" -- run worker
pm2 start npm --name "worker-2" -- run worker
```

### Connection Pooling

Update Prisma configuration:

```typescript
// lib/prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10',
    },
  },
});
```

## Resources

- **Main Guide:** `DEPLOYMENT_GUIDE_PHASE_3_5.md`
- **Feature Documentation:** `PHASE_3_4_5_IMPLEMENTATION.md`
- **Database Schema:** `prisma/schema.prisma`
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Systemd Documentation:** https://www.freedesktop.org/software/systemd/man/systemd.service.html

## Support

For issues:

1. Check logs: `pm2 logs` or `sudo journalctl -u panacea-*`
2. Run verification: `./deployment/scripts/verify-deployment.sh`
3. Review troubleshooting section above
4. Check GitHub issues
5. Contact development team
