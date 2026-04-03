---
name: auth-policy-review
description: "Audit authentication, authorization, and endpoint security across PANaCEa's API surface. Use this skill whenever adding new API endpoints, reviewing auth middleware, checking RLS policies, investigating 401/403 errors, or auditing which endpoints are protected — even if the user just says 'auth is broken' or 'I'm getting unauthorized'. Also use when reviewing Clerk webhook handling, rate limiting coverage, or admin-only endpoint protection."
composes:
  - cf-edge-api
  - panacea-verify
---

# Auth Policy Review

## Purpose
Every API endpoint must have correct authentication. Every database query must respect Row-Level Security (RLS) policies. This skill audits the entire auth surface to prevent unauthorized access, token leaks, and RLS bypasses.

## Auth Architecture

**Clerk JWT → verifyToken → userId → Prisma with RLS**

1. **Frontend:** @clerk/clerk-react handles sign-in and sends JWT in Authorization: Bearer header
2. **Edge Auth:** functions/api/_shared/auth.ts provides:
   - verifyToken(token, env) — validate JWT, extract userId
   - authenticateRequest(request, env) — parse header, verify, return userId
   - requireAuth(context) — throw 401 if no userId
3. **Middleware:** functions/api/_shared/enhancedMiddleware.ts
   - authenticatedEndpoint — all requests require valid JWT
   - aiEndpoint — rate-limited, typically no auth
4. **Database:** Prisma RLS policies (migrations 20260104, 20260309) filter rows by user_id

## Middleware Patterns

| Pattern | Usage | Auth Required | Rate Limited |
|---------|-------|---------------|--------------|
| authenticatedEndpoint | User-scoped endpoints (MAIN, DRILL sessions) | ✓ JWT verified | Per-user |
| aiEndpoint | LLM operations (question gen, grading) | ✗ Public/API-key | IP-based |
| Raw handler | Legacy, rarely used | Variable | None |

## Endpoint Audit Checklist

For each endpoint in functions/api/:
- [ ] Is it wrapped in authenticatedEndpoint or aiEndpoint?
- [ ] Does it call env.user.id or context.user.id (never context.request alone)?
- [ ] Does it include Prisma queries (if yes, RLS must filter by userId)?
- [ ] Is rate limiting applied? Check functions/api/_shared/rateLimiter.ts
- [ ] If admin-only, does it check context.user.role via RBAC in functions/api/_shared/rbac.ts?
- [ ] Does it handle errors without leaking user data in response?

## RLS Policy Verification

**Tables WITH RLS (auto-filtered):**
- QuestionAttempt, UserProgress, ReviewLog, ReservoirQuestion — all include user_id

**Tables WITHOUT RLS (risk zone):**
- Question, Section, Course — public, shared across users
- User — check direct SELECT queries; may need explicit WHERE clause

**Query Risk Patterns:**
```typescript
// BAD: No RLS filter; bypasses edge auth
const attempts = await prisma.questionAttempt.findMany();

// GOOD: RLS filter (implicit via row-level policy)
const attempts = await prisma.questionAttempt.findMany({
  where: { userId: context.user.id }
});

// GOOD: Explicit filter on public table
const question = await prisma.question.findUnique({
  where: { id: questionId },
  include: { section: true } // shared, OK
});
```

## Common Failure Modes

1. **Missing auth on new endpoint:** Added POST endpoint without authenticatedEndpoint wrapper → 401 errors or public access
2. **Stale JWT:** Old token cached in localStorage → 401 after user signs out elsewhere
3. **Webhook signature mismatch:** CLERK_WEBHOOK_SECRET missing or mismatched → user sync fails silently
4. **RLS bypass via raw SQL:** Direct Prisma .query() circumvents RLS → user sees others' data
5. **Admin endpoint without RBAC:** Protected by authenticatedEndpoint but missing role check → any user can access
6. **Rate limiter not applied to high-volume endpoint:** AI endpoints (question gen, grading) need IP-based limits
7. **Token provider pattern forgotten:** useSyncManager(getToken) missing → offline sync fails on re-auth

## Files to Inspect First

- functions/api/_shared/auth.ts — JWT verification logic
- functions/api/_shared/enhancedMiddleware.ts — endpoint wrapper patterns
- functions/api/_shared/rbac.ts — role checks (admin, instructor, student)
- functions/api/_shared/rateLimiter.ts — rate limit config by endpoint
- functions/api/drills/submit-review.ts — FSRS submission (example of correct auth)
- lib/services/drillReviewService.ts — Prisma usage (check RLS assumptions)
- prisma/migrations/20260104* and 20260309* — RLS policy definitions

## Verification Steps

1. **Audit new endpoint:** Wrap in authenticatedEndpoint, test 401 without token
2. **Check RLS:** Run SELECT count(*) FROM users u JOIN question_attempt qa ON qa.user_id = u.id WHERE u.id != current_user_id; — must return 0
3. **Test webhook:** Trigger user update in Clerk dashboard, verify CLERK_WEBHOOK_SECRET match
4. **Load test:** High concurrency on rate-limited endpoints; expect 429 responses
5. **Code review:** 421 endpoints is large surface; prioritize drills, sessions, and admin routes

---

**Last updated:** 2026-04-03
**Related:** Clerk docs, Cloudflare Edge auth, Prisma RLS
