# 🚀 Production Deployment Checklist

## PANaCEa Multi-Modal Simulation Platform
**Branch:** `cursor/patient-encounter-state-machine-7530`  
**Date:** February 5, 2026  
**Status:** Ready for Production

---

## ⚠️ Pre-Deployment Requirements

### **Access Required (User Must Have):**
- [ ] Cloudflare account with Pages access
- [ ] Production database access (Supabase/PostgreSQL)
- [ ] Google AI Studio API key (Gemini)
- [ ] Clerk authentication configured
- [ ] Domain configured (panacea.app)

---

## 📋 Production Deployment Steps

### **Step 1: Backup Production Database**

```bash
# Create timestamped backup
pg_dump $PRODUCTION_DATABASE_URL > backups/prod_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backups/
```

### **Step 2: Apply Database Migration**

```bash
# Set production database URL
export DATABASE_URL="your_production_database_url"
export DIRECT_DATABASE_URL="your_direct_connection_url"

# Apply migration
npx prisma migrate deploy

# Verify migration
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'PatientEncounterCase' AND column_name = 'stateMachine';"
```

**Expected Output:** `stateMachine` column exists

### **Step 3: Configure Production Secrets**

```bash
# In Cloudflare Pages dashboard, add secrets:
# Settings > Environment Variables > Production

GEMINI_API_KEY=your_production_key
DATABASE_URL=your_production_db_url
CLERK_SECRET_KEY=your_clerk_secret
VOICE_WEBSOCKET_URL=wss://voice.panacea.app
VEO_API_KEY=your_veo_key (optional for now)
```

### **Step 4: Build Production Bundle**

```bash
# Clean and build
rm -rf dist
npm run build

# Verify build output
ls -lh dist/
du -sh dist/
```

### **Step 5: Deploy to Cloudflare Pages**

```bash
# Deploy using wrangler
npx wrangler pages publish dist \
  --project-name panacea \
  --branch main \
  --commit-hash $(git rev-parse HEAD)

# Or use Cloudflare dashboard:
# Pages > panacea > Create deployment > Upload dist/
```

### **Step 6: Verify Deployment**

```bash
# Test health check
curl https://panacea.app/api/health

# Test OSCE session creation
curl -X POST https://panacea.app/api/osce/session \
  -H "Authorization: Bearer your_test_token" \
  -H "Content-Type: application/json" \
  -d '{"caseId": "test-case-id"}'

# Expected: 200 OK with session object
```

### **Step 7: Enable Features Progressively**

```typescript
// Update feature flags in production
// config/featureFlags.ts or Cloudflare KV

// Day 1: Enable low-risk features
enableRealtimeSOAP: true
enableTimingAnalytics: true
enableContextBanner: true
enablePhantomPatient: true
enableAvatar: true

// Day 2-3: Enable after monitoring
enableSOAPComparison: true
enableEchoPath: true
enableCircadianUI: true
enableAchievements: true

// Future: Enable when ready
enableVoiceMode: false
enableStateMachine: false
enableInfographics: false (needs API key)
```

### **Step 8: Monitor Production**

```bash
# Monitor Cloudflare analytics
# - Request rate
# - Error rate
# - Response times

# Monitor database
# - Connection pool usage
# - Query performance
# - Storage usage

# Monitor user metrics
# - Session start rate
# - Completion rate
# - Feature usage
```

---

## ✅ Post-Deployment Verification

### **Smoke Tests (15 minutes):**

**Test 1: OSCE Session**
- [ ] Navigate to OSCE mode
- [ ] Start new session
- [ ] Verify ContextBanner displays
- [ ] Ask a question
- [ ] Verify no errors in console
- [ ] Submit diagnosis
- [ ] Complete session

**Test 2: Real-Time Features**
- [ ] Start OSCE session
- [ ] Watch SOAP draft (should update within 5s)
- [ ] Verify timing metrics track
- [ ] Check context banner updates

**Test 3: Enhanced Debrief**
- [ ] Complete OSCE session
- [ ] View results
- [ ] Verify SOAP comparison renders
- [ ] Check echo path visualization
- [ ] Confirm no errors

**Test 4: Gamification**
- [ ] Visit dashboard
- [ ] Verify phantom patient loads
- [ ] Check avatar displays
- [ ] Confirm health/XP calculations correct

**Test 5: API Endpoints**
- [ ] Test /api/osce/session
- [ ] Test /api/osce/complete
- [ ] Test /api/gamification/phantom-patient
- [ ] Test /api/gamification/avatar
- [ ] All should return 200 OK

---

## 🔄 Rollback Procedure

### **If Critical Issues Found:**

**1. Immediate Rollback (< 5 minutes):**
```bash
# Revert to previous Cloudflare Pages deployment
npx wrangler pages deployments list --project-name panacea
npx wrangler pages deployments rollback <previous-deployment-id>

# Verify rollback
curl https://panacea.app/api/health
```

**2. Database Rollback (if needed):**
```bash
# Only if migration caused issues
# Restore from backup
psql $PRODUCTION_DATABASE_URL < backups/prod_backup_YYYYMMDD_HHMMSS.sql

# Or run down migration
npx prisma migrate resolve --rolled-back 20260205000000_add_multi_modal_architecture
```

**3. Verify Old Functionality:**
```bash
# Test that existing features still work
# - OSCE sessions can start
# - Questions can be asked
# - Sessions can complete
```

---

## 📊 Success Criteria

### **Deployment Successful If:**

- [ ] No increase in error rate (< 1% target)
- [ ] API response times within target (< 500ms p95)
- [ ] Database migration applied without errors
- [ ] All smoke tests pass
- [ ] At least 10 users complete a session successfully
- [ ] No critical bugs reported in first 24 hours

### **Feature Adoption:**

- [ ] > 50% of sessions use real-time SOAP
- [ ] > 30% of users view enhanced debrief
- [ ] > 60% of users engage with phantom patient
- [ ] > 70% of users see context banner

---

## 🎯 Deployment Timeline

**Day 0 (Today):**
- [x] Code ready and pushed
- [x] Deployment guide written
- [ ] Database migration applied
- [ ] Deploy to production
- [ ] Smoke tests pass

**Day 1:**
- [ ] Monitor metrics (24-hour watch)
- [ ] Fix any critical bugs
- [ ] Gather initial user feedback

**Day 2-7:**
- [ ] Progressive feature enablement
- [ ] Performance optimization
- [ ] User feedback incorporation

**Week 2+:**
- [ ] Continue with Weeks 4-5 implementation
- [ ] Build Modules 2 & 3
- [ ] Additional feature releases

---

## 🔐 Security Notes

**Before Production:**
- [ ] All secrets in environment variables (not hardcoded)
- [ ] API keys rotated from development
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] SQL injection prevention verified (Prisma)
- [ ] XSS prevention verified (React)
- [ ] Authentication tested (Clerk)

---

## 📞 Support Plan

**If Issues Arise:**

**Critical (Production Down):**
1. Immediate rollback
2. Investigate root cause
3. Fix and redeploy

**High (Feature Not Working):**
1. Disable feature flag
2. Debug in staging
3. Fix and redeploy

**Medium (Performance Issue):**
1. Monitor and document
2. Optimize in next release
3. Deploy optimization

**Low (Minor Bug):**
1. Log issue
2. Fix in next sprint
3. Include in batch release

---

## 🎊 Deployment Status

**Code:** ✅ Committed (29 commits)  
**Branch:** ✅ Pushed to origin  
**Documentation:** ✅ Complete  
**Database:** ✅ Migration prepared  
**Deployment Guide:** ✅ Written  

**Ready For:** Production deployment by user with appropriate access

---

**Note:** Actual deployment requires access to:
- Cloudflare Pages account
- Production database
- API keys
- Domain configuration

**User should follow steps above to complete deployment.**

---

**Branch:** `cursor/patient-encounter-state-machine-7530`  
**Status:** ✅ **READY FOR PRODUCTION DEPLOYMENT**
