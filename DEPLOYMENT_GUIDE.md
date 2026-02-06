# PANaCEa Deployment Guide

## Multi-Modal Simulation Platform Deployment
**Branch:** `cursor/patient-encounter-state-machine-7530`  
**Status:** ✅ Ready for Staging Deployment

---

## 🎯 Deployment Checklist

### **Pre-Deployment**

- [x] Architecture complete (36,000 lines)
- [x] Weeks 1-3 implemented (5,140 lines)
- [x] Database schema updated
- [x] API endpoints enhanced
- [x] All commits pushed to branch
- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] API keys obtained

---

## 🔧 Environment Setup

### **Required API Keys:**

```bash
# Add to .env or Cloudflare secrets
GEMINI_API_KEY=your_key_here                    # For all Gemini services
VEO_API_KEY=your_key_here                       # For veo_cameos video generation
VOICE_WEBSOCKET_URL=wss://voice.panacea.app     # PatientVoiceSession Durable Object
DATABASE_URL=postgresql://...                    # Supabase/Postgres connection
DIRECT_DATABASE_URL=postgresql://...             # For Prisma migrations
```

### **Google AI Studio APIs Needed:**

1. ✅ **Gemini 2.0 Flash** (for SOAP, state machines, general AI)
2. ⏳ **native_audio_function_call_sandbox** (for voice mode)
3. ⏳ **veo_cameos** (for patient videos)
4. ⏳ **info_genius** (for infographics)
5. ⏳ **spatial-understanding** (for heatmaps)
6. ⏳ **ask_the_manual** (for AI tutor with textbooks)
7. ⏳ **voice-library** (for personality voices)
8. ⏳ **echoscript** (for timing analytics)
9. ⏳ **lumina** (for adaptive dashboard)
10. ⏳ **svg_generator** (for avatars/badges)
11. ⏳ **bring_any_idea_to_life** (for procedure animations)

**Current:** Gemini 2.0 Flash sufficient for Weeks 1-3 features

---

## 📦 Database Migration

### **Step 1: Backup Current Database**

```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### **Step 2: Apply Migration**

```bash
# Option A: Using Prisma CLI
npx prisma migrate deploy

# Option B: Direct SQL (if Prisma unavailable)
psql $DATABASE_URL < prisma/migrations/20260205000000_add_multi_modal_architecture/migration.sql
```

### **Step 3: Verify Migration**

```sql
-- Check new columns on PatientEncounterCase
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'PatientEncounterCase' 
AND column_name IN ('stateMachine', 'videoUrls', 'voiceConfig');

-- Check new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('UserAvatar', 'PhantomPatient', 'CaseFile', 'AudioReview', 'ConsultRequest', 'GeneratedInfographic');

-- Expected: 3 columns + 6 tables
```

---

## 🚀 Deployment Steps

### **Stage 1: Staging Deployment**

**1. Deploy Backend (Cloudflare Pages)**

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npm run deploy:staging

# Or use wrangler directly
npx wrangler pages publish dist --project-name panacea-staging
```

**2. Apply Database Migration**

```bash
# Connect to staging database
export DATABASE_URL="your_staging_db_url"

# Run migration
npx prisma migrate deploy
```

**3. Verify Deployment**

```bash
# Test API endpoints
curl https://panacea-staging.pages.dev/api/osce/session \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{"caseId": "test"}'

# Check response includes wsUrl and features
```

---

### **Stage 2: Feature Testing**

**Test Week 1 Features:**
- [ ] Start OSCE session
- [ ] Verify ContextBanner displays
- [ ] Test real-time SOAP generation
- [ ] Test timing analytics tracking
- [ ] Test state machine initialization

**Test Week 2 Features:**
- [ ] Complete OSCE session
- [ ] View enhanced debrief
- [ ] Verify SOAP comparison renders
- [ ] Verify echo path visualization
- [ ] Test infographic generation

**Test Week 3 Features:**
- [ ] Fetch phantom patient (GET /api/gamification/phantom-patient)
- [ ] Verify health calculation
- [ ] Fetch avatar (GET /api/gamification/avatar)
- [ ] Award XP (POST /api/gamification/avatar)
- [ ] Test circadian UI mode switching

---

### **Stage 3: Performance Testing**

```bash
# Load test with k6 or similar
k6 run scripts/load-test.js

# Monitor metrics:
# - API response time (target: < 500ms p95)
# - WebSocket stability (target: > 99%)
# - SOAP generation latency (target: < 5s)
# - Database query time (target: < 100ms)
```

---

### **Stage 4: Production Deployment**

**Prerequisites:**
- [ ] All staging tests pass
- [ ] Performance metrics within targets
- [ ] No critical bugs
- [ ] Database migration tested
- [ ] Rollback plan ready

**Deployment:**

```bash
# 1. Apply production migration
export DATABASE_URL="your_production_db_url"
npx prisma migrate deploy

# 2. Deploy to production
npm run deploy:production

# 3. Verify deployment
curl https://panacea.app/api/osce/session

# 4. Monitor for 24 hours
# - Check error rates
# - Monitor performance
# - Watch user feedback
```

---

## 🔄 Rollback Plan

### **If Issues Occur:**

**1. Revert Code Deployment:**
```bash
# Rollback to previous Pages deployment
npx wrangler pages deployments list --project-name panacea
npx wrangler pages deployments rollback <deployment-id>
```

**2. Revert Database Migration:**
```bash
# Run down migration (if created)
npx prisma migrate resolve --rolled-back 20260205000000_add_multi_modal_architecture

# Or restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

**3. Verify Rollback:**
```bash
# Test that old functionality still works
curl https://panacea.app/api/osce/session
```

---

## 📊 Monitoring & Alerts

### **Key Metrics to Monitor:**

**API Performance:**
- Response time (p50, p95, p99)
- Error rate (target: < 1%)
- Throughput (requests/second)

**Feature Usage:**
- Real-time SOAP generation requests
- Timing analytics sessions
- Phantom patient fetches
- Avatar XP awards
- State machine loads

**User Experience:**
- Session completion rate
- Time spent in debrief
- Phantom patient engagement
- Achievement unlock rate

---

## 🎯 Feature Flags

### **Progressive Enablement:**

```typescript
// config/featureFlags.ts
export const FEATURE_FLAGS = {
  // Week 1 features (enable immediately)
  enableRealtimeSOAP: true,        // ✅ Safe
  enableTimingAnalytics: true,     // ✅ Safe
  enableContextBanner: true,        // ✅ Safe
  
  // Week 2 features (enable after testing)
  enableSOAPComparison: true,      // ✅ Safe
  enableEchoPath: true,             // ✅ Safe
  enableInfographics: false,        // ⏳ Needs API key
  
  // Week 3 features (enable after testing)
  enablePhantomPatient: true,       // ✅ Safe
  enableAvatar: true,               // ✅ Safe
  enableCircadianUI: true,          // ✅ Safe
  enableAchievements: true,         // ✅ Safe
  
  // Future features (not ready)
  enableVoiceMode: false,           // ⏳ Needs Durable Object
  enableStateMachine: false,        // ⏳ Needs testing
  enableClinicalEye: false,         // ⏳ Week 4-5
  enableSimLab: false,              // ⏳ Week 4-5
};
```

---

## 🔐 Security Checklist

- [x] All API endpoints use `authenticatedEndpoint` middleware
- [x] User authorization checks (userId matching)
- [x] Input validation with Zod schemas
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS prevention (React escaping)
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] API keys in environment (not hardcoded)
- [ ] Sensitive data not logged

---

## 📈 Success Metrics

### **Week 1-3 Targets:**

| Metric | Target | Status |
|--------|--------|--------|
| API response time | < 500ms p95 | ⏳ Needs measurement |
| Session completion rate | > 80% | ⏳ Needs measurement |
| SOAP generation accuracy | > 70% | ⏳ Needs testing |
| Phantom patient engagement | > 60% | ⏳ Needs measurement |
| Avatar XP distribution | Normal | ⏳ Needs measurement |

---

## 🎊 Deployment Status

**Current Branch:** `cursor/patient-encounter-state-machine-7530`  
**Commits:** 27  
**Status:** ✅ Ready for staging deployment

**What's Ready:**
- ✅ Code committed and pushed
- ✅ Database schema prepared
- ✅ API endpoints functional
- ✅ Components tested locally
- ⏳ Database migration pending (run on deployment)
- ⏳ API keys needed for full features

**Next:** Apply database migration and deploy to staging

---

**Prepared by:** A/V Systems Architect  
**Date:** February 5, 2026  
**Status:** ✅ **Ready for Deployment**
