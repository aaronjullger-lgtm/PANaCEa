# Deployment Guide: Phase 3-5 Features

## Overview

This guide provides step-by-step instructions for deploying the Phase 3-5 features to production. Follow these steps carefully to ensure a smooth rollout.

## Prerequisites

- [x] Node.js 18+ installed
- [x] PostgreSQL database (or Neon/Supabase)
- [x] Clerk authentication configured
- [x] Environment variables set up

## Step 1: Database Migration

### 1.1 Backup Current Database

**IMPORTANT:** Always backup before running migrations!

```bash
# For PostgreSQL
pg_dump -U your_user -d panacea_db > backup_$(date +%Y%m%d_%H%M%S).sql

# For Neon/Supabase
# Use their backup tools via dashboard
```

### 1.2 Review Schema Changes

The migration adds:
- 8 new tables (MedicalContent, ContentVersion, ContentAuditLog, etc.)
- 2 table modifications (User, MediaAsset)
- 30+ indexes for performance

```bash
# Review the schema
cat prisma/schema.prisma
```

### 1.3 Run Migration

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration (development)
npx prisma migrate dev --name phase_3_5_features

# OR for production (recommended)
npx prisma migrate deploy
```

### 1.4 Verify Migration

```bash
# Check migration status
npx prisma migrate status

# Inspect database
npx prisma studio
```

## Step 2: Update Environment Variables

### 2.1 Required Variables

Add to your `.env` file:

```env
# Existing (keep these)
DATABASE_URL=postgresql://user:pass@host:5432/db
CLERK_SECRET_KEY=sk_...
GEMINI_API_KEY=AIza...
VITE_CLERK_PUBLISHABLE_KEY=pk_...

# New (optional but recommended)
BACKGROUND_WORKER_ENABLED=true
JOB_QUEUE_POLL_INTERVAL=5000
HEALTH_CHECK_SCHEDULE=0 3 * * *
MAX_JOB_ATTEMPTS=3
SYNC_DEBOUNCE_DELAY=500
```

### 2.2 Production Environment

Ensure these are set in your production environment (Vercel, Railway, etc.):

```bash
# Set via CLI or dashboard
BACKGROUND_WORKER_ENABLED=true
```

## Step 3: Deploy Application

### 3.1 Build and Test Locally

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Preview
npm run preview
```

### 3.2 Deploy Frontend

```bash
# For Vercel
vercel --prod

# For Netlify
netlify deploy --prod

# For custom server
npm run build
# Then copy dist/ to your server
```

### 3.3 Deploy Backend Server

```bash
# Start backend server
npm run dev:server

# Or for production (using PM2)
pm2 start npm --name "panacea-server" -- run dev:server
pm2 save
```

## Step 4: Start Background Workers

### 4.1 Background Job Worker

This processes queued jobs (question generation, health checks, etc.):

```bash
# Using PM2 (recommended for production)
pm2 start npm --name "panacea-worker" -- run worker
pm2 save
pm2 startup

# Or using systemd
sudo systemctl start panacea-worker
sudo systemctl enable panacea-worker
```

### 4.2 Job Scheduler

Set up cron job for daily scheduling:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at midnight)
0 0 * * * cd /path/to/PANaCEa && npm run schedule >> /var/log/panacea-scheduler.log 2>&1

# Add this line for health check (3 AM daily)
0 3 * * * cd /path/to/PANaCEa && npm run health-check >> /var/log/panacea-health.log 2>&1
```

### 4.3 Verify Workers

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs panacea-worker
pm2 logs panacea-server

# Check cron logs
tail -f /var/log/panacea-scheduler.log
tail -f /var/log/panacea-health.log
```

## Step 5: Initialize System

### 5.1 Create Admin Users

Update user roles in database:

```sql
-- Update a user to superadmin
UPDATE "User" 
SET role = 'superadmin' 
WHERE email = 'admin@example.com';

-- Update a user to approver
UPDATE "User" 
SET role = 'approver' 
WHERE email = 'doctor@example.com';
```

### 5.2 Run Initial Health Check

```bash
# Manually run health check
npm run health-check

# Check output
cat content_health_report_*.json
```

### 5.3 Schedule Initial Job

```bash
# Run scheduler to set up recurring jobs
npm run schedule
```

## Step 6: Monitoring & Verification

### 6.1 Check API Endpoints

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test admin content list (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/admin/content/list
```

### 6.2 Monitor Logs

```bash
# Application logs
pm2 logs

# Database queries (optional)
# Add to .env: DATABASE_LOGGING=true

# System resources
pm2 monit
```

### 6.3 Check Job Queue

Access Prisma Studio to view job queue:

```bash
npx prisma studio

# Navigate to BackgroundJob table
# Verify jobs are being created and processed
```

## Step 7: Enable Features Gradually

### 7.1 Phase 1: Read-Only CMS Access

- Enable viewer role for selected users
- Test content viewing
- Verify audit log is recording views

### 7.2 Phase 2: Content Editing

- Enable editor role
- Test content creation and editing
- Verify version control works
- Check audit logs

### 7.3 Phase 3: Approval Workflow

- Enable approver role
- Test state transitions
- Verify approval process

### 7.4 Phase 4: Publishing

- Enable admin/superadmin roles
- Test full workflow: draft → review → approve → publish
- Monitor for issues

## Rollback Plan

If issues occur, follow this rollback procedure:

### Rollback Step 1: Stop New Services

```bash
# Stop background worker
pm2 stop panacea-worker

# Stop job scheduler
crontab -e  # Comment out scheduler lines
```

### Rollback Step 2: Revert Database

```bash
# Restore from backup
psql -U your_user -d panacea_db < backup_YYYYMMDD_HHMMSS.sql

# OR rollback migration
npx prisma migrate reset  # WARNING: Destructive!
```

### Rollback Step 3: Deploy Previous Version

```bash
# Checkout previous version
git checkout <previous-commit>

# Rebuild and deploy
npm install
npm run build
# Deploy as usual
```

## Troubleshooting

### Issue: Migration Fails

**Solution:**
1. Check PostgreSQL version (need 12+)
2. Verify database connection
3. Check for conflicting tables
4. Review migration errors in console

### Issue: Background Worker Not Processing Jobs

**Solution:**
1. Check PM2 logs: `pm2 logs panacea-worker`
2. Verify DATABASE_URL is set
3. Check job queue table for pending jobs
4. Ensure worker has correct permissions

### Issue: Audit Logs Not Recording

**Solution:**
1. Verify API endpoints are using audit service
2. Check user roles and permissions
3. Verify database connection
4. Check ContentAuditLog table directly

### Issue: Offline Sync Not Working

**Solution:**
1. Check browser console for errors
2. Verify localStorage is enabled
3. Check network connectivity
4. Review sync queue status

## Performance Tuning

### Database Optimization

```sql
-- Create additional indexes if needed
CREATE INDEX idx_content_search ON "MedicalContent" 
USING gin(to_tsvector('english', condition));

-- Analyze tables
ANALYZE "MedicalContent";
ANALYZE "ContentAuditLog";
```

### Connection Pooling

Update Prisma client configuration:

```typescript
// lib/prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});
```

### Job Queue Optimization

Adjust worker count based on load:

```bash
# Start multiple workers
pm2 start npm --name "panacea-worker-1" -- run worker
pm2 start npm --name "panacea-worker-2" -- run worker
```

## Security Checklist

- [ ] All API endpoints use authentication
- [ ] RBAC enforced on all routes
- [ ] Audit logging enabled
- [ ] Rate limiting configured
- [ ] Input validation active
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] SQL injection prevention verified

## Post-Deployment Verification

### Day 1 Checklist

- [ ] All services running (frontend, backend, worker)
- [ ] Health check completed successfully
- [ ] Audit logs recording properly
- [ ] Users can access CMS with correct roles
- [ ] Job queue processing jobs
- [ ] No error logs in PM2/systemd
- [ ] Database backups automated

### Week 1 Checklist

- [ ] Monitor job queue statistics
- [ ] Review health reports
- [ ] Check audit log volume
- [ ] Verify offline sync working
- [ ] Review user feedback
- [ ] Monitor performance metrics
- [ ] Check error rates

## Support & Resources

### Documentation
- `PHASE_3_4_5_IMPLEMENTATION.md` - Feature documentation
- `ADMIN_CMS_IMPLEMENTATION.md` - CMS guide
- `prisma/schema.prisma` - Database schema

### Commands Reference
```bash
npm run dev           # Frontend dev server
npm run dev:server    # Backend dev server
npm run worker        # Background job worker
npm run schedule      # Job scheduler
npm run health-check  # Manual health check
npm test              # Run tests
npm run build         # Build production
```

### Contact
For issues or questions:
1. Check logs: `pm2 logs`
2. Review documentation
3. Check GitHub issues
4. Contact dev team

## Conclusion

Following this guide ensures a smooth deployment of Phase 3-5 features. Take time to verify each step and monitor the system closely during the first week.

**Remember:** Always have a rollback plan ready!
