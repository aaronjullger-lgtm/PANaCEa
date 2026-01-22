# Production Readiness Plan - PANaCEa
**Created:** January 18, 2026  
**Last Updated:** January 22, 2026  
**Current Status:** P0 Security COMPLETED ✅ | P1 Type Safety in progress (93+ Prisma errors)

## ✅ COMPLETED SECURITY FIXES (Verified January 22, 2026)

### 1. **ADMIN ENDPOINTS** ✅ SECURED
**Status:** COMPLETED - All endpoints use `adminEndpoint()` or full middleware chain

All admin endpoints now have proper authentication:
- ✅ `functions/api/admin/media/pending.ts` - Uses `adminEndpoint(PendingMediaQuerySchema, ...)`
- ✅ `functions/api/admin/media/approve.ts` - Uses `adminEndpoint()` for POST and PUT
- ✅ `functions/api/admin/media/stats.ts` - Uses `withAuth(), withAdminRole(), withRateLimit()`
- ✅ `functions/api/admin/media/upload.ts` - Uses full middleware chain
- ✅ `functions/api/admin/media/[id].ts` - Uses full middleware chain for GET, PUT, DELETE

**Verification:** All endpoints return 401/403 without proper authentication.

---

### 2. **QUESTION MANAGEMENT ENDPOINTS** ✅ SECURED
**Status:** COMPLETED - All endpoints use appropriate authentication

All question pipeline endpoints are now secured:
- ✅ `functions/api/questions/seeds/index.ts` - Uses `adminEndpoint(QuestionSeedSchema, ...)`
- ✅ `functions/api/questions/seeds/stats.ts` - Uses `adminEndpoint()`
- ✅ `functions/api/questions/staging/index.ts` - Uses `adminEndpoint()`
- ✅ `functions/api/questions/staging/stats.ts` - Uses `adminEndpoint()`
- ✅ `functions/api/questions/flag/index.ts` - Uses `authenticatedEndpoint()` (users can flag)
- ✅ `functions/api/questions/flag/[flagId]/resolve.ts` - Uses `adminEndpoint()` (only admins resolve)

**Note:** Flag creation correctly uses `authenticatedEndpoint()` since any authenticated user should be able to flag problematic questions.

---

### 3. **CONTENT BRANCHING ENDPOINT** ✅ SECURED
**Status:** COMPLETED

- ✅ `functions/api/branches/[branchName]/merge.ts` - Uses `adminEndpoint(BranchMergeSchema, ...)`

**Verification:** Branch merges require admin role.

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

## ✅ PHASE 1: CRITICAL SECURITY FIXES - COMPLETED (January 22, 2026)

### Sprint 1.1: Secure Admin Endpoints ✅ COMPLETED
**Status:** All admin media endpoints secured with `adminEndpoint()` or full middleware chain

**Verified Files:**
- ✅ `functions/api/admin/media/pending.ts` - `adminEndpoint(PendingMediaQuerySchema, ...)`
- ✅ `functions/api/admin/media/approve.ts` - `adminEndpoint()` for POST + PUT
- ✅ `functions/api/admin/media/stats.ts` - Full middleware: `withAuth(), withAdminRole(), withRateLimit()`
- ✅ `functions/api/admin/media/upload.ts` - Full middleware chain
- ✅ `functions/api/admin/media/[id].ts` - Full middleware for GET + PUT + DELETE

**Zod validation:** ✅ All endpoints have validation schemas
**Audit logging:** Available via middleware

---

### Sprint 1.2: Secure Question Pipeline ✅ COMPLETED
**Status:** All question pipeline endpoints properly secured

**Verified Files:**
- ✅ `functions/api/questions/seeds/index.ts` - `adminEndpoint(QuestionSeedSchema, ...)`
- ✅ `functions/api/questions/seeds/stats.ts` - `adminEndpoint()`
- ✅ `functions/api/questions/staging/index.ts` - `adminEndpoint()`
- ✅ `functions/api/questions/staging/stats.ts` - `adminEndpoint()`
- ✅ `functions/api/questions/flag/index.ts` - `authenticatedEndpoint()` (correct - users can flag)
- ✅ `functions/api/questions/flag/[flagId]/resolve.ts` - `adminEndpoint()` (correct - only admins resolve)

---

### Sprint 1.3: Secure Content Branching ✅ COMPLETED
**Status:** Branch merge endpoint secured

- ✅ `functions/api/branches/[branchName]/merge.ts` - `adminEndpoint(BranchMergeSchema, ...)`

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

### Security ✅ COMPLETED
- [x] All admin endpoints require authentication
- [x] All question pipeline endpoints secured
- [x] RBAC working correctly
- [x] No security warnings in audit

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

| Phase | Duration | Priority | Status |
|-------|----------|----------|--------|
| Phase 1: Critical Security | 2 days | P0 - MUST DO | ✅ COMPLETED |
| Phase 2: Type Safety | 2 days | P1 - HIGH | 🔄 IN PROGRESS |
| Phase 3: Code Quality | 3 days | P1 - HIGH | ⏳ Pending |
| Phase 4: Testing & Deploy | 3 days | P0 - MUST DO | ⏳ Pending |
| **TOTAL** | **10 days** | **2 weeks** | **~20% done** |

---

## 🚀 QUICK START (Next 2 Hours)

**Phase 1 Complete!** ✅ All security endpoints verified and secured.

**Current Focus: Phase 2 - Type Safety (93+ Prisma errors)**

1. **Fix Prisma `updatedAt` errors** (90 min)
   - Remove manual `updatedAt` from all `.create()` calls
   - Prisma auto-generates via `@updatedAt` directive
   - Files: services/, routes/, scripts/generators/

2. **Fix API handler return types** (20 min)
   - Standardize conditions API responses
   - Ensure `HandlerResponse` compliance

3. **Fix environment validation** (10 min)
   - Reorder Zod chain: `.url().default().optional()`

**After these fixes:**
- ✅ TypeScript errors reduced from 93+ to <20
- ✅ Prisma operations type-safe
- ✅ Ready for Phase 3: Code Quality

---

## 📝 NOTES

- **Deployment blockers:** Phases 1 & 2 must be complete
- **Recommended order:** Security → Type Safety → Quality → Deploy
- **Testing:** After each sprint, run full test suite
- **Rollback:** Keep current production version ready

**Contact for issues:** Check MASTER_DOCUMENTATION.md for architecture details