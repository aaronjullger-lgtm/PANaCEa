# Production Readiness Plan - PANaCEa
**Created:** January 18, 2026  
**Current Status:** 147 TypeScript errors, Multiple security vulnerabilities

## 🚨 CRITICAL ISSUES (Must Fix Before Production)

### 1. **UNSECURED ADMIN ENDPOINTS** 🔴 P0
**Risk Level:** CRITICAL - Complete security bypass possible

These admin endpoints have NO authentication:
- `functions/api/admin/media/pending.ts` - Anyone can view pending media
- `functions/api/admin/media/approve.ts` - Anyone can approve/modify media (POST, PUT)
- `functions/api/admin/media/stats.ts` - Exposes internal stats
- `functions/api/admin/media/upload.ts` - Anyone can upload media (POST, GET)
- `functions/api/admin/media/[id].ts` - Anyone can GET, PUT, DELETE media by ID

**Impact:** Attackers can:
- Upload malicious content
- Approve/modify any media asset
- Delete legitimate medical content
- Access internal system statistics
- Bypass all content moderation

**Fix Required:** Add `adminEndpoint()` wrapper to ALL admin routes

---

### 2. **UNSECURED QUESTION MANAGEMENT ENDPOINTS** 🔴 P0
**Risk Level:** CRITICAL - Content integrity compromise

These endpoints controlling question bank have NO authentication:
- `functions/api/questions/seeds/index.ts` (POST) - Create question seeds
- `functions/api/questions/seeds/stats.ts` (GET) - View seed statistics
- `functions/api/questions/seeds/[id]/assemble.ts` (GET) - Assemble questions
- `functions/api/questions/seeds/assemble.ts` (POST) - Assemble from seeds
- `functions/api/questions/staging/index.ts` (POST) - Create staging questions
- `functions/api/questions/staging/stats.ts` (GET) - View staging stats
- `functions/api/questions/staging/[id]/check.ts` (POST) - Check questions
- `functions/api/questions/staging/process.ts` (POST) - Process staging queue
- `functions/api/questions/flag/index.ts` (POST) - Flag questions
- `functions/api/questions/flag/[flagId]/resolve.ts` (POST) - Resolve flags

**Impact:** Attackers can:
- Inject fake medical questions
- Corrupt question bank integrity
- View internal question pipeline
- Manipulate question flags/reviews
- Compromise exam preparation quality

**Fix Required:** Add authentication checks to ALL question pipeline endpoints

---

### 3. **UNSECURED CONTENT BRANCHING ENDPOINT** 🔴 P0
**Risk Level:** HIGH - Content versioning bypass

- `functions/api/branches/[branchName]/merge.ts` (POST) - Merge content branches

**Impact:** Anyone can merge content branches, bypassing review workflows

**Fix Required:** Add `adminEndpoint()` wrapper

---

### 4. **PRISMA TYPE SAFETY ISSUES** 🟠 P1
**Risk Level:** HIGH - 93+ Prisma Exact<> type errors

**Problem:** Missing `updatedAt` fields in `.create()` operations across:
- `lib/services/contentBranchingService.ts` (2 errors)
- `lib/services/questionBankService.ts` (1 error)  
- `lib/services/socialService.ts` (1 error)
- `lib/services/sync/registrySync.ts` (2 errors)
- `routes/osce.ts` (1 error)
- `routes/questions.ts` (1 error)
- `scripts/condition-doctor.ts` (3 errors)
- `scripts/content-doctor.ts` (1 error)
- `scripts/content-enrichment.ts` (1 error)
- And 50+ more files in `scripts/generators/`

**Impact:**
- Type safety compromised
- Runtime errors possible
- Database integrity issues
- Failed deployments

**Fix Required:** Remove ALL manual `updatedAt` assignments (Prisma auto-generates with `@updatedAt`)

---

### 5. **API HANDLER TYPE MISMATCHES** 🟠 P1
**Risk Level:** MEDIUM - Breaking type contracts

Handler return types don't match `HandlerResponse`:
- `functions/api/conditions/[conditionId]/pearls.ts` - Returns `{ pearls: string[] }`
- `functions/api/conditions/content.ts` - Returns complex union type
- `functions/api/conditions/high-yield.ts` - Returns custom object
- `functions/api/conditions/index.ts` - Returns custom object

**Impact:** API contracts broken, runtime errors possible

**Fix Required:** Ensure all handlers return proper `HandlerResponse` type

---

### 6. **MISSING ENVIRONMENT VALIDATION** 🟠 P1
**Risk Level:** MEDIUM - Runtime configuration failures

- `lib/config/environment.ts:26` - `.url()` doesn't exist on ZodDefault<ZodString>

**Impact:** Environment validation fails, deployment issues

**Fix Required:** Fix Zod schema ordering

---

## 📋 PHASE 1: CRITICAL SECURITY FIXES (Days 1-2)

### Sprint 1.1: Secure Admin Endpoints ⏱️ 4 hours
**Priority:** P0 - MUST DO FIRST

1. **Add authentication to all admin media endpoints** (2h)
   ```typescript
   // Before:
   export const onRequestPost = async (context) => {
   
   // After:
   export const onRequestPost = adminEndpoint(MediaUploadSchema, async (context) => {
   ```

   Files to fix:
   - ✅ `functions/api/admin/media/pending.ts`
   - ✅ `functions/api/admin/media/approve.ts` (POST + PUT)
   - ✅ `functions/api/admin/media/stats.ts`
   - ✅ `functions/api/admin/media/upload.ts` (POST + GET)
   - ✅ `functions/api/admin/media/[id].ts` (GET + PUT + DELETE)

2. **Add Zod validation schemas** (1h)
   - Create schema for each admin endpoint
   - Validate all inputs

3. **Add audit logging** (1h)
   - Log all admin actions
   - Track who approved/uploaded/deleted what

**Testing:** Attempt to access admin endpoints without auth → Should return 401

---

### Sprint 1.2: Secure Question Pipeline ⏱️ 3 hours
**Priority:** P0 - MUST DO FIRST

1. **Secure question seed endpoints** (1h)
   - Add `adminEndpoint()` to seed creation/assembly
   - Add validation schemas

2. **Secure staging endpoints** (1h)
   - Add `adminEndpoint()` to staging operations
   - Validate question data structure

3. **Secure flag management** (1h)
   - `flag/index.ts` → `authenticatedEndpoint()` (users can flag)
   - `flag/[flagId]/resolve.ts` → `adminEndpoint()` (only admins resolve)

**Files to fix:**
- ✅ `functions/api/questions/seeds/*.ts` (4 files)
- ✅ `functions/api/questions/staging/*.ts` (4 files)
- ✅ `functions/api/questions/flag/*.ts` (2 files)

**Testing:** Try to create/process questions without auth → Should return 401/403

---

### Sprint 1.3: Secure Content Branching ⏱️ 1 hour
**Priority:** P0

1. **Add admin authentication**
   ```typescript
   export const onRequestPost = adminEndpoint(BranchMergeSchema, async (context) => {
   ```

2. **Add merge validation**
   - Validate branch exists
   - Check for conflicts
   - Require approval workflow

**Testing:** Try to merge branches without admin role → Should return 403

---

## 📋 PHASE 2: TYPE SAFETY & DATA INTEGRITY (Days 3-4)

### Sprint 2.1: Fix Prisma Type Issues ⏱️ 6 hours
**Priority:** P1

**Strategy:** Systematic cleanup of 93+ errors

1. **Remove manual `updatedAt` from services** (2h)
   - `lib/services/contentBranchingService.ts`
   - `lib/services/questionBankService.ts`
   - `lib/services/socialService.ts`
   - `lib/services/sync/registrySync.ts`

2. **Remove manual `updatedAt` from routes** (1h)
   - `routes/osce.ts`
   - `routes/questions.ts`

3. **Remove manual `updatedAt` from scripts** (3h)
   - `scripts/condition-doctor.ts`
   - `scripts/content-*.ts`
   - `scripts/generators/*.ts` (50+ files)

**Validation:** `npm run typecheck` should show <60 errors

---

### Sprint 2.2: Fix API Handler Return Types ⏱️ 3 hours
**Priority:** P1

1. **Standardize handler responses** (2h)
   - Ensure all return `{ success: boolean, data?: any, error?: string }`
   - Fix conditions API handlers
   - Update HandlerResponse type if needed

2. **Add response validation** (1h)
   - Create response schemas
   - Validate at runtime

---

### Sprint 2.3: Fix Environment Config ⏱️ 1 hour
**Priority:** P1

Fix `lib/config/environment.ts`:
```typescript
// Before:
FRONTEND_URL: z.string().default('http://localhost:3000').url().optional(),

// After:
FRONTEND_URL: z.string().url().default('http://localhost:3000').optional(),
```

---

## 📋 PHASE 3: CODE QUALITY & STABILITY (Days 5-7)

### Sprint 3.1: Fix Remaining Type Errors ⏱️ 8 hours

Target: All 147 errors

1. **Component type issues** (3h)
   - `ScorePredictionCard` - PerformanceSnapshot vs SystemPerformance
   - `QuizView` - SessionStatsOverlay props
   - Fix missing properties

2. **Service type issues** (3h)
   - `contentService.ts` - Array type mismatches
   - `recommendationService.ts` - Missing relations
   - `rolling360Service.ts` - JsonValue casting

3. **Script type issues** (2h)
   - Fix ConditionRegistryEntry usage
   - Fix aliases type (string vs string[])

---

### Sprint 3.2: Add Production Monitoring ⏱️ 4 hours

1. **Error tracking** (2h)
   - Sentry error boundaries on all major components
   - API error logging
   - Database error tracking

2. **Performance monitoring** (2h)
   - API response times
   - Database query performance
   - Client-side metrics

---

### Sprint 3.3: Security Hardening ⏱️ 6 hours

1. **Rate limiting** (2h)
   - Add rate limits to all public endpoints
   - Add stricter limits to admin endpoints
   - Implement IP-based throttling

2. **Input validation** (2h)
   - Audit all Zod schemas
   - Add sanitization for user inputs
   - Validate file uploads strictly

3. **CSP & CORS review** (2h)
   - Review Content Security Policy
   - Audit CORS allowlists
   - Add security headers

---

## 📋 PHASE 4: TESTING & DEPLOYMENT (Days 8-10)

### Sprint 4.1: Integration Testing ⏱️ 8 hours

1. **Security testing** (3h)
   - Attempt to access admin endpoints without auth
   - Test RBAC on all protected routes
   - Verify Clerk integration

2. **API testing** (3h)
   - Test all critical endpoints
   - Verify error handling
   - Check response formats

3. **Database testing** (2h)
   - Test migrations
   - Verify data integrity
   - Check connection pooling

---

### Sprint 4.2: Production Preparation ⏱️ 4 hours

1. **Environment setup** (2h)
   - Production env vars
   - Database connection strings
   - API keys rotation

2. **Deployment scripts** (1h)
   - CI/CD pipeline review
   - Build verification
   - Rollback procedures

3. **Documentation** (1h)
   - API documentation
   - Deployment guide
   - Incident response plan

---

### Sprint 4.3: Staged Rollout ⏱️ Ongoing

1. **Staging deployment** (Day 8)
   - Deploy to staging
   - Run smoke tests
   - Monitor for 24 hours

2. **Canary deployment** (Day 9)
   - Deploy to 10% of users
   - Monitor error rates
   - Check performance metrics

3. **Full production** (Day 10)
   - Full rollout
   - Active monitoring
   - Quick rollback plan ready

---

## 🎯 SUCCESS CRITERIA

### Security ✅
- [ ] All admin endpoints require authentication
- [ ] All question pipeline endpoints secured
- [ ] RBAC working correctly
- [ ] No security warnings in audit

### Code Quality ✅
- [ ] 0 TypeScript errors
- [ ] All handlers return proper types
- [ ] Prisma operations type-safe
- [ ] Environment validation working

### Stability ✅
- [ ] Error rate < 0.1%
- [ ] API response time < 500ms p95
- [ ] Database connections stable
- [ ] No memory leaks

### Monitoring ✅
- [ ] Sentry capturing all errors
- [ ] Performance metrics tracked
- [ ] Alert system configured
- [ ] Log aggregation working

---

## 📊 EFFORT ESTIMATE

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Critical Security | 2 days | P0 - MUST DO |
| Phase 2: Type Safety | 2 days | P1 - HIGH |
| Phase 3: Code Quality | 3 days | P1 - HIGH |
| Phase 4: Testing & Deploy | 3 days | P0 - MUST DO |
| **TOTAL** | **10 days** | **2 weeks** |

---

## 🚀 QUICK START (Next 2 Hours)

**Immediate Actions:**

1. **Secure admin endpoints** (60 min)
   - Add `adminEndpoint()` to all 5 admin media files
   - Test with Postman/curl

2. **Secure question seeds** (30 min)
   - Add `adminEndpoint()` to 4 seed files
   - Add validation schemas

3. **Secure staging questions** (30 min)
   - Add `adminEndpoint()` to 4 staging files
   - Test authentication

**After these fixes:**
- 🔒 Admin panel secured
- 🔒 Question pipeline secured
- ✅ Critical vulnerabilities patched
- Ready to proceed with Phase 2

---

## 📝 NOTES

- **Deployment blockers:** Phases 1 & 2 must be complete
- **Recommended order:** Security → Type Safety → Quality → Deploy
- **Testing:** After each sprint, run full test suite
- **Rollback:** Keep current production version ready

**Contact for issues:** Check MASTER_DOCUMENTATION.md for architecture details
