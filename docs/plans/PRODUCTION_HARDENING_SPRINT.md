# Production Hardening Sprint
## PANaCEa Phase 5: Stability & Reliability

> **Status:** IN PROGRESS  
> **Created:** 2026-01-15  
> **Priority:** CRITICAL  
> **Estimated Duration:** 2-3 weeks

---

## Executive Summary

This sprint focuses on hardening the application for production reliability. Based on a comprehensive deep-dive audit, we've identified critical gaps that must be addressed before public launch.

---

## 🔴 Critical Issues Identified

| Issue | Risk Level | Status |
|-------|-----------|--------|
| Missing API endpoints causing 404 HTML responses | CRITICAL | 🟡 Partial Fix |
| No database-level RLS security | CRITICAL | ❌ Not Started |
| No health check endpoint for monitoring | HIGH | ✅ Implemented |
| Edge caching not configured | HIGH | ❌ Not Started |
| E2E test coverage < 20% | HIGH | ❌ Not Started |
| Inconsistent API response formats | MEDIUM | ❌ Not Started |

---

## Sprint 1: API Resilience (Days 1-5)

### 1.1 Health Check Endpoint ✅
**File:** `functions/api/health.ts`

- [x] Database connectivity check
- [x] Supabase storage check
- [x] Gemini API check
- [x] Cache/KV check (when available)
- [x] CORS headers

### 1.2 Missing Endpoint Audit
**Goal:** Zero 404 HTML responses

```bash
# Find all fetch calls to /api/*
grep -r "fetch.*\/api\/" --include="*.tsx" --include="*.ts" components/ hooks/ services/
```

**Known Missing Endpoints (Fixed):**
- [x] `/api/analytics/performance-deltas` - Gap Analysis Dashboard

**To Audit:**
- [ ] `/api/recommendations/*`
- [ ] `/api/questions/generate-batch`
- [ ] `/api/questions/pool`
- [ ] `/api/drills/contrastive/*`

### 1.3 Standardized API Response Format

All API endpoints MUST return:
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}
```

**Files to update:**
- [ ] `functions/api/_shared/response.ts` (create)
- [ ] All endpoint files

---

## Sprint 2: Security Foundation (Days 6-10)

### 2.1 Supabase RLS Policies
**Priority:** CRITICAL

```sql
-- Enable RLS on user-specific tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SRSItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyStreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;

-- User isolation policies
CREATE POLICY "Users can view own SRS items" ON "SRSItem"
  FOR ALL USING (auth.uid()::text = "userId");

-- Public read for medical content
CREATE POLICY "Public read medical content" ON "MedicalContent"
  FOR SELECT USING (true);
```

### 2.2 Rate Limiting Enhancement

```typescript
const RATE_LIMITS = {
  anonymous: { windowMs: 15 * 60 * 1000, max: 20 },
  authenticated: { windowMs: 15 * 60 * 1000, max: 100 },
  premium: { windowMs: 15 * 60 * 1000, max: 500 },
  ai_endpoints: { windowMs: 60 * 1000, max: 10 },
};
```

---

## Sprint 3: Performance & Caching (Days 11-15)

### 3.1 Cloudflare KV Setup

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "PANACEA_CACHE"
id = "xxx" # Create via: wrangler kv:namespace create PANACEA_CACHE
```

### 3.2 Cache Strategy

| Endpoint | TTL | Stale-While-Revalidate |
|----------|-----|------------------------|
| `/api/content/systems` | 1 hour | Yes |
| `/api/conditions` | 1 hour | Yes |
| `/api/drugs/classes` | 24 hours | Yes |
| `/api/user/*` | No cache | No |

---

## Sprint 4: Testing & CI/CD (Days 16-21)

### 4.1 E2E Test Expansion

**Target:** 80% critical path coverage

```
e2e/
├── auth.setup.ts         ✅ Exists
├── critical-flows.spec.ts ✅ Exists
├── main-session.spec.ts   ❌ Needed
├── analytics.spec.ts      ❌ Needed
├── library.spec.ts        ❌ Needed
└── mobile.spec.ts         ❌ Needed
```

### 4.2 CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npx playwright test
```

---

## Quick Wins Checklist

### Today
- [x] Create `/api/health` endpoint
- [x] Create `/api/analytics/performance-deltas` endpoint
- [ ] Add CORS to all API response helpers

### This Week
- [ ] Audit all frontend fetch calls
- [ ] Create standardized response helper
- [ ] Fix remaining 404 endpoints

### Next Week
- [ ] RLS migration script
- [ ] KV namespace setup
- [ ] E2E test expansion

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| API 500 Errors | Unknown | < 1/hour |
| P95 Response Time | Unknown | < 200ms |
| E2E Test Coverage | ~20% | 80% |
| Lighthouse Performance | Unknown | > 90 |
| Security Headers | Partial | A+ rating |

---

## Files Created/Modified

| Action | File |
|--------|------|
| CREATE | `functions/api/health.ts` |
| CREATE | `functions/api/analytics/performance-deltas.ts` |
| CREATE | `functions/api/_shared/response.ts` |
| MODIFY | All API endpoints (response format) |
| CREATE | `prisma/migrations/XXXXX_add_rls_policies/migration.sql` |
| CREATE | `e2e/main-session.spec.ts` |
| MODIFY | `.github/workflows/ci.yml` |

---

*Document created: 2026-01-15*
