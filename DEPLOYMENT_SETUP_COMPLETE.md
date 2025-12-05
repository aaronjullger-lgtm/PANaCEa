# Deployment Setup Complete ✅

## Overview

This document summarizes the deployment infrastructure that has been implemented for PANaCEa Phase 3-5 features.

**Status:** All deployment infrastructure files and scripts have been created and are ready for use.

## What's Been Implemented

### 1. Process Management

#### PM2 Configuration (`ecosystem.config.js`)
- **Server Process:** Backend API server (port 3001)
- **Worker Process:** Background job processor
- **Features:**
  - Auto-restart on failure
  - Memory limits and monitoring
  - Separate log files for each process
  - Environment-specific configuration (dev/production)

#### Systemd Service Files (`deployment/systemd/`)
- `panacea-server.service` - Backend API server
- `panacea-worker.service` - Background job worker
- **Security Features:**
  - Runs as dedicated `panacea` user
  - Restricted file system access
  - No privilege escalation
  - Private /tmp directory

### 2. Job Scheduling

#### Cron Configuration (`deployment/cron/`)
- **Daily Scheduler (Midnight):** Schedules jobs for the next day
- **Health Check (3 AM):** Audits content quality
- **Cleanup (Sunday 4 AM):** Removes old jobs from database
- **Log Rotation:** Optional cleanup of old log files

### 3. Deployment Scripts

All scripts in `deployment/scripts/`:

#### `deploy.sh`
Main deployment script that:
- Backs up database
- Installs dependencies
- Generates Prisma client
- Runs database migrations
- Builds application
- Starts workers with PM2

#### `monitor.sh`
System monitoring script that displays:
- PM2 process status
- Database connectivity
- Job queue statistics
- Recent error logs
- System resources (memory, disk)
- **Supports:** `--watch` flag for continuous monitoring

#### `verify-deployment.sh`
Pre-deployment verification that checks:
- Prerequisites (Node.js, npm, npx)
- Application files
- Worker scripts
- Deployment configuration
- Dependencies
- Database connectivity
- Process management
- Logs directory

#### `init-migrations.sh`
Database migration setup that:
- Validates environment configuration
- Checks database connectivity
- Creates initial migration
- Generates Prisma client

#### `job-stats.ts`
Displays job queue statistics:
- Pending, processing, completed, failed counts
- Recent failed jobs with errors
- Real-time queue health

### 4. Worker Scripts

Enhanced existing scripts:

#### `scripts/backgroundWorker.ts`
- Polls job queue every 5 seconds
- Processes different job types:
  - Question generation
  - Health checks
  - Media processing
  - Sync operations
  - AI quality checks
  - Duplicate detection
- Graceful shutdown handling
- Automatic retry with exponential backoff

#### `scripts/scheduleJobs.ts`
- Schedules recurring jobs
- Prevents duplicate scheduling
- Configurable job priorities
- Cleanup of old jobs

#### `scripts/contentHealthChecker.ts`
- Audits content quality
- Detects missing explanations
- Identifies broken media links
- Validates required fields
- Generates comprehensive reports

#### `scripts/cleanupJobs.ts` (NEW)
- Removes old completed/failed jobs
- Configurable retention period (default: 30 days)
- Dry-run mode for testing
- Displays before/after statistics

### 5. Documentation

#### `deployment/README.md`
Comprehensive guide covering:
- Directory structure
- Quick start instructions
- Three deployment methods (PM2, systemd, manual)
- Configuration details
- Monitoring and troubleshooting
- Performance tuning

#### `deployment/MIGRATION_GUIDE.md`
Database migration instructions:
- Initial setup
- Development vs production migrations
- Creating custom migrations
- Rollback procedures
- Best practices
- Troubleshooting

#### `deployment/DEPLOYMENT_CHECKLIST.md`
Step-by-step checklist:
- Pre-deployment tasks
- Deployment steps
- Post-deployment verification
- Day 1 and Week 1 checklists
- Rollback plan
- Success criteria

#### Updated `.env.example`
Added worker configuration:
```env
BACKGROUND_WORKER_ENABLED=true
JOB_QUEUE_POLL_INTERVAL=5000
HEALTH_CHECK_SCHEDULE=0 3 * * *
MAX_JOB_ATTEMPTS=3
SYNC_DEBOUNCE_DELAY=500
NODE_ENV=development
PORT=3001
```

## File Structure

```
PANaCEa/
├── ecosystem.config.js                   # PM2 configuration
├── .env.example                          # Environment template (updated)
├── deployment/
│   ├── README.md                         # Deployment guide
│   ├── MIGRATION_GUIDE.md                # Database migration guide
│   ├── DEPLOYMENT_CHECKLIST.md           # Step-by-step checklist
│   ├── scripts/
│   │   ├── deploy.sh                     # Main deployment script
│   │   ├── monitor.sh                    # System monitoring
│   │   ├── verify-deployment.sh          # Pre-deployment checks
│   │   ├── init-migrations.sh            # Migration setup
│   │   └── job-stats.ts                  # Job queue statistics
│   ├── systemd/
│   │   ├── README.md                     # Systemd guide
│   │   ├── panacea-server.service        # Server service
│   │   └── panacea-worker.service        # Worker service
│   └── cron/
│       ├── README.md                     # Cron guide
│       └── panacea.cron                  # Cron jobs
└── scripts/
    ├── backgroundWorker.ts               # Job processor
    ├── scheduleJobs.ts                   # Job scheduler
    ├── contentHealthChecker.ts           # Health auditor
    └── cleanupJobs.ts                    # Job cleanup (NEW)
```

## How to Use

### Quick Start

1. **Verify Setup:**
   ```bash
   ./deployment/scripts/verify-deployment.sh
   ```

2. **Deploy:**
   ```bash
   ./deployment/scripts/deploy.sh
   ```

3. **Monitor:**
   ```bash
   ./deployment/scripts/monitor.sh --watch
   ```

### Detailed Deployment

Follow the comprehensive guide:
```bash
# Read the deployment checklist
cat deployment/DEPLOYMENT_CHECKLIST.md

# Follow DEPLOYMENT_GUIDE_PHASE_3_5.md step-by-step
```

## Prerequisites

Before deploying:

1. **Server Requirements:**
   - Node.js 18+
   - PostgreSQL 12+
   - npm/npx
   - (Optional) PM2 for process management

2. **Configuration:**
   - `.env` file with all required variables
   - Database created and accessible
   - API keys (Clerk, Gemini) configured

3. **Permissions:**
   - Write access to application directory
   - Database access
   - (For systemd) root/sudo access

## Process Management Options

### Option 1: PM2 (Recommended for Production)

**Pros:**
- Easy to use
- Built-in monitoring
- Automatic restarts
- Log management
- Load balancing support

**Setup:**
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Option 2: Systemd (Linux Servers)

**Pros:**
- System-level integration
- Starts on boot
- Journal logging
- Resource limits

**Setup:**
```bash
sudo cp deployment/systemd/*.service /etc/systemd/system/
sudo systemctl enable panacea-server panacea-worker
sudo systemctl start panacea-server panacea-worker
```

### Option 3: Manual (Development)

**Pros:**
- Simple
- No additional dependencies
- Easy debugging

**Setup:**
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run worker
```

## Scheduled Jobs

Three recurring jobs via cron:

1. **Job Scheduler (Daily 00:00)**
   - Schedules background jobs
   - Pre-generates questions
   - Plans maintenance tasks

2. **Health Check (Daily 03:00)**
   - Audits content quality
   - Generates health reports
   - Identifies issues

3. **Cleanup (Weekly Sunday 04:00)**
   - Removes old jobs (30+ days)
   - Prevents database bloat
   - Maintains performance

**Install:**
```bash
crontab -e
# Add lines from deployment/cron/panacea.cron
```

## Monitoring

### Real-time Monitoring

```bash
# Continuous monitoring
./deployment/scripts/monitor.sh --watch

# PM2 monitoring
pm2 monit

# View logs
pm2 logs
# or
sudo journalctl -u panacea-server -f
```

### Health Checks

```bash
# API health
curl http://localhost:3001/health

# Job queue stats
npx tsx deployment/scripts/job-stats.ts

# Manual health check
npm run health-check
```

## Security Considerations

✅ **Implemented:**
- Systemd services run as non-root user
- Restricted file system access
- Environment variables in .env (not version controlled)
- Service auto-restart with limits
- Separate log files for each component

⚠️ **Production Recommendations:**
- Enable HTTPS/SSL
- Configure firewall rules
- Set up rate limiting
- Enable audit logging
- Rotate credentials regularly
- Use secrets management (e.g., Vault)

## Testing

### Verification Without Database

Most scripts can be verified without a database:

```bash
# Check script syntax
bash -n deployment/scripts/deploy.sh
bash -n deployment/scripts/monitor.sh

# Verify file structure
./deployment/scripts/verify-deployment.sh

# Test TypeScript scripts compile
npx tsc --noEmit scripts/cleanupJobs.ts
npx tsc --noEmit deployment/scripts/job-stats.ts
```

### Testing with Database

Once database is configured:

```bash
# Initialize migrations
./deployment/scripts/init-migrations.sh

# Test worker script
npm run worker

# Test scheduler
npm run schedule

# Test health check
npm run health-check

# Test cleanup
npm run cleanupJobs -- --dry-run
```

## Troubleshooting

### Common Issues

**"DATABASE_URL not found"**
- Solution: Create `.env` from `.env.example` and set DATABASE_URL

**"Port already in use"**
- Solution: Change PORT in `.env` or kill existing process

**"Worker not processing jobs"**
- Solution: Check worker logs, verify DATABASE_URL, restart worker

**"Permission denied"**
- Solution: Set proper ownership/permissions on files and directories

For detailed troubleshooting, see:
- `deployment/README.md` - Troubleshooting section
- `deployment/MIGRATION_GUIDE.md` - Database issues
- `deployment/DEPLOYMENT_CHECKLIST.md` - Quick fixes

## Next Steps

1. **Review Documentation:**
   - Read `DEPLOYMENT_GUIDE_PHASE_3_5.md`
   - Review `deployment/DEPLOYMENT_CHECKLIST.md`
   - Understand `deployment/MIGRATION_GUIDE.md`

2. **Configure Environment:**
   - Copy `.env.example` to `.env`
   - Set all required environment variables
   - Create production database

3. **Test Deployment:**
   - Use staging environment first
   - Run verification script
   - Test each component individually
   - Perform end-to-end testing

4. **Deploy to Production:**
   - Follow deployment checklist
   - Monitor closely during and after deployment
   - Have rollback plan ready
   - Document any issues

5. **Setup Monitoring:**
   - Configure cron jobs
   - Set up log rotation
   - Configure alerting (if needed)
   - Establish backup schedule

## Support Resources

- **Documentation:** `deployment/` directory
- **Scripts:** `deployment/scripts/` directory
- **Main Guide:** `DEPLOYMENT_GUIDE_PHASE_3_5.md`
- **Database Schema:** `prisma/schema.prisma`
- **Worker Code:** `scripts/backgroundWorker.ts`

## Summary

✅ **Complete:** All deployment infrastructure files created
✅ **Documented:** Comprehensive guides and checklists provided
✅ **Tested:** Scripts validated (syntax and structure)
⏳ **Ready:** Awaiting database configuration for full testing
🚀 **Next:** Follow deployment checklist to deploy to production

---

**Deployment infrastructure is ready for use!**

For questions or issues:
1. Check relevant documentation in `deployment/` directory
2. Review troubleshooting sections
3. Test in staging environment first
4. Contact development team if needed
