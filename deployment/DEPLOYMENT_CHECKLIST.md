# Deployment Checklist

Use this checklist to ensure all steps are completed for a successful deployment.

## Pre-Deployment

### Environment Setup
- [ ] Node.js 18+ installed on server
- [ ] PostgreSQL 12+ installed and running
- [ ] Database created (e.g., `panacea_production`)
- [ ] `.env` file created from `.env.example`
- [ ] All environment variables configured
  - [ ] `DATABASE_URL`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `VITE_CLERK_PUBLISHABLE_KEY`
  - [ ] `GEMINI_API_KEY`
  - [ ] `BACKGROUND_WORKER_ENABLED`
  - [ ] `NODE_ENV` set to `production`

### Security
- [ ] Database credentials secured
- [ ] API keys rotated (if reusing from dev)
- [ ] `.env` file not in version control
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] CORS settings reviewed

### Backup
- [ ] Database backup taken
- [ ] Backup location documented
- [ ] Backup restoration tested
- [ ] Backup retention policy defined

### Code Preparation
- [ ] Latest code pulled from main branch
- [ ] All tests passing
- [ ] Dependencies installed (`npm install`)
- [ ] Build successful (`npm run build`)
- [ ] Linting passing (if applicable)

## Deployment Steps

### 1. Verification
```bash
./deployment/scripts/verify-deployment.sh
```
- [ ] All prerequisites met
- [ ] Required files present
- [ ] Dependencies installed
- [ ] Configuration valid

### 2. Database Migration
```bash
npx prisma generate
npx prisma migrate deploy
```
- [ ] Prisma client generated
- [ ] Migrations applied successfully
- [ ] Migration status checked
- [ ] Database schema verified

### 3. Application Deployment

#### Option A: PM2 (Recommended)
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```
- [ ] PM2 installed globally
- [ ] Server process started
- [ ] Worker process started
- [ ] Processes set to auto-start
- [ ] PM2 configuration saved

#### Option B: Systemd
```bash
sudo cp deployment/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable panacea-server panacea-worker
sudo systemctl start panacea-server panacea-worker
```
- [ ] Service files copied
- [ ] Services enabled
- [ ] Services started
- [ ] Services set to auto-start

### 4. Schedule Recurring Jobs
```bash
crontab -e
# Add jobs from deployment/cron/panacea.cron
```
- [ ] Cron jobs configured
- [ ] Job scheduler (midnight)
- [ ] Health checker (3 AM)
- [ ] Cleanup job (Sunday 4 AM)
- [ ] Log rotation (optional)

### 5. Monitoring Setup
- [ ] Log directory created and writable
- [ ] Monitoring script tested
- [ ] Alerting configured (if applicable)
- [ ] Health check endpoint accessible

## Post-Deployment

### Immediate Verification (0-15 minutes)

#### Service Status
```bash
# PM2
pm2 status
pm2 logs --lines 50

# Systemd
sudo systemctl status panacea-server panacea-worker
sudo journalctl -u panacea-server -n 50
```
- [ ] Server process running
- [ ] Worker process running
- [ ] No errors in logs
- [ ] Processes not restarting

#### Application Health
```bash
curl http://localhost:3001/health
```
- [ ] API responding
- [ ] Health endpoint returns 200
- [ ] Database connection working
- [ ] No error responses

#### Database
```bash
npx prisma studio  # Or connect via psql
```
- [ ] Database accessible
- [ ] Tables created correctly
- [ ] Indexes present
- [ ] Data integrity maintained

#### Job Queue
```bash
npx tsx deployment/scripts/job-stats.ts
```
- [ ] Job queue accessible
- [ ] No stuck jobs
- [ ] Worker processing jobs
- [ ] No failed jobs piling up

### Day 1 Checklist (0-24 hours)

#### Monitoring
```bash
./deployment/scripts/monitor.sh --watch
```
- [ ] All services stable
- [ ] Memory usage normal
- [ ] CPU usage acceptable
- [ ] Disk space adequate
- [ ] No unexpected errors in logs

#### Functionality
- [ ] Users can log in (Clerk auth)
- [ ] Questions load correctly
- [ ] Performance tracking works
- [ ] Media assets load
- [ ] Background jobs executing

#### Job Schedule
- [ ] Daily scheduler ran (check at 12:01 AM)
- [ ] Health check ran (check at 3:01 AM)
- [ ] Jobs created in queue
- [ ] Worker processing jobs

#### Logs Review
```bash
tail -f logs/*.log
```
- [ ] No critical errors
- [ ] Expected operations logged
- [ ] Performance acceptable
- [ ] No security warnings

### Week 1 Checklist (1-7 days)

#### Performance
- [ ] Response times acceptable
- [ ] Database queries optimized
- [ ] No memory leaks detected
- [ ] Worker keeping up with queue

#### Job Queue Health
- [ ] Jobs completing successfully
- [ ] Queue not backing up
- [ ] Failed job rate < 5%
- [ ] Retry mechanism working

#### Health Reports
```bash
cat content-health-report.json
```
- [ ] Health checks running nightly
- [ ] Reports being generated
- [ ] Issues tracked
- [ ] Critical issues addressed

#### User Feedback
- [ ] No major user complaints
- [ ] Performance acceptable to users
- [ ] Features working as expected
- [ ] Error rate acceptable

#### Data Integrity
- [ ] User data persisting correctly
- [ ] Performance records accurate
- [ ] SRS items tracking properly
- [ ] Audit logs complete

## Rollback Plan

If critical issues occur:

### Immediate Actions
- [ ] Stop new services
  ```bash
  pm2 stop all
  # or
  sudo systemctl stop panacea-server panacea-worker
  ```
- [ ] Assess issue severity
- [ ] Document the problem
- [ ] Notify stakeholders

### Rollback Database
- [ ] Restore from backup
  ```bash
  psql -U user -d panacea < backup_YYYYMMDD.sql
  ```
- [ ] Verify data integrity
- [ ] Test restored database

### Rollback Application
- [ ] Checkout previous version
  ```bash
  git checkout <previous-tag>
  ```
- [ ] Reinstall dependencies
  ```bash
  npm install
  ```
- [ ] Rebuild application
  ```bash
  npm run build
  ```
- [ ] Restart services
  ```bash
  pm2 restart all
  ```

### Post-Rollback
- [ ] Verify services running
- [ ] Test critical functionality
- [ ] Monitor for issues
- [ ] Document rollback reason
- [ ] Plan fix for next deployment

## Troubleshooting Quick Reference

### Service Won't Start
```bash
# Check logs
pm2 logs
sudo journalctl -u panacea-server -n 50

# Common fixes
npm install
npx prisma generate
check .env file
check database connection
```

### Database Issues
```bash
# Test connection
psql "$DATABASE_URL"

# Check migration status
npx prisma migrate status

# Regenerate client
npx prisma generate
```

### Worker Not Processing
```bash
# Check worker status
pm2 status
pm2 logs panacea-worker

# Check job queue
npx tsx deployment/scripts/job-stats.ts

# Restart worker
pm2 restart panacea-worker
```

### High Memory Usage
```bash
# Check memory
pm2 monit
free -h

# Restart if needed
pm2 restart all

# Adjust limits in ecosystem.config.js
max_memory_restart: '1G'
```

## Success Criteria

Deployment is considered successful when:

- [ ] All services running for 24+ hours without restart
- [ ] No critical errors in logs
- [ ] Users able to access and use application
- [ ] Performance metrics within acceptable range
- [ ] Background jobs executing successfully
- [ ] Health checks passing
- [ ] No data integrity issues
- [ ] Monitoring and alerting functional
- [ ] Team confident in stability

## Documentation

After successful deployment:

- [ ] Update deployment date in docs
- [ ] Document any issues encountered
- [ ] Update runbook with lessons learned
- [ ] Brief team on changes
- [ ] Update monitoring dashboards
- [ ] Archive deployment logs

## Resources

- Main Guide: `DEPLOYMENT_GUIDE_PHASE_3_5.md`
- Migration Guide: `deployment/MIGRATION_GUIDE.md`
- Deployment Tools: `deployment/scripts/`
- Service Configs: `deployment/systemd/`
- Cron Jobs: `deployment/cron/`

## Contact

For deployment issues:
- Check logs first
- Review troubleshooting section
- Consult deployment documentation
- Contact on-call engineer
- Escalate to dev team if needed

---

**Remember:** Take your time, follow the checklist, and have a rollback plan ready!
