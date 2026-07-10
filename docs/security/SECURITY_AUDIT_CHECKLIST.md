# PANaCEa Security Audit Checklist

> **Last Audit:** January 8, 2026  
> **Next Scheduled:** March 8, 2026 (Quarterly)

---

## ✅ Authentication & Authorization

### Clerk Integration

- [x] `CLERK_SECRET_KEY` stored in Cloudflare Secrets (not in code)
- [x] `VITE_CLERK_PUBLISHABLE_KEY` is the ONLY VITE\_ prefixed secret
- [x] JWT verification with clock skew tolerance (5000ms)
- [x] `authenticateRequest()` used in all protected endpoints
- [x] Webhook signature verification enabled

### Role-Based Access Control (RBAC)

- [x] Admin role check via `check-access.ts`
- [x] Supports env vars (`ADMIN_USER_IDS`) and DB role column
- [x] Admin endpoints return 403 for non-admin users
- [x] Superadmin tier for sensitive operations

### Files Audited

| File                                  | Auth Check               | Status |
| ------------------------------------- | ------------------------ | ------ |
| `functions/api/_shared/auth.ts`       | Core auth implementation | ✅     |
| `functions/api/admin/check-access.ts` | Admin verification       | ✅     |
| `functions/api/webhooks/clerk.ts`     | Webhook handler          | ✅     |

---

## 🔒 Row-Level Security (RLS)

### Tables with RLS Enabled

| Table                 | Policy                 | Status |
| --------------------- | ---------------------- | ------ |
| `User`                | Own data only          | ✅     |
| `UserQuestionHistory` | Own data only          | ✅     |
| `UserSRSConfig`       | Own data only          | ✅     |
| `SRSItem`             | Own data only          | ✅     |
| `QuestionAttempt`     | Own data only          | ✅     |
| `StudySession`        | Own data only          | ✅     |
| `PerformanceRecord`   | Own data only          | ✅     |
| `UserAchievement`     | Own data only          | ✅     |
| `UserLearningProfile` | Own data only          | ✅     |
| `StudyGroupMember`    | Own + group visibility | ✅     |
| `SyncQueue`           | Own data only          | ✅     |
| `Bookmark`            | Own data only          | ✅     |
| `QuestionFlag`        | Own data + admin view  | ✅     |

### Public Content Tables (No RLS Needed)

- `MedicalContent` - Public read
- `Condition` - Public read
- `Drug` - Public read
- `LabTest` - Public read
- `ImagingStudy` - Public read
- `Question` - Public read (via pool)
- `MediaAsset` - Public read (approved only)

### Migration Applied

- [x] `prisma/migrations/20260104_add_rls_policies/migration.sql`

---

## 🛡️ API Endpoint Security

### Protected Endpoints (Auth Required)

| Endpoint                    | Auth | Rate Limit | Zod Validation |
| --------------------------- | ---- | ---------- | -------------- |
| `/api/questions/session`    | ✅   | questions  | ⚠️ Partial     |
| `/api/questions/review`     | ✅   | standard   | ⚠️ Partial     |
| `/api/user/stats`           | ✅   | standard   | ❌             |
| `/api/user/stability-trend` | ✅   | standard   | ❌             |
| `/api/analytics/session`    | ✅   | standard   | ❌             |
| `/api/drills/*`             | ✅   | gemini     | ⚠️ Partial     |

### Admin Endpoints (Admin Auth Required)

| Endpoint                   | Admin Check | Rate Limit | Status |
| -------------------------- | ----------- | ---------- | ------ |
| `/api/admin/check-access`  | ✅          | admin      | ✅     |
| `/api/admin/media/upload`  | ✅          | admin      | ✅     |
| `/api/admin/media/approve` | ✅          | admin      | ✅     |
| `/api/admin/media/pending` | ✅          | admin      | ✅     |
| `/api/admin/cache-metrics` | ✅          | admin      | ✅     |

### Public Endpoints (No Auth Needed)

| Endpoint           | Purpose        | Rate Limit |
| ------------------ | -------------- | ---------- |
| `/api/health`      | Health check   | standard   |
| `/api/conditions`  | Public content | standard   |
| `/api/reference/*` | Reference data | standard   |

---

## 🔑 Secrets Management

### Required Secrets (Cloudflare Dashboard)

| Secret                 | Location   | Verified |
| ---------------------- | ---------- | -------- |
| `DATABASE_URL`         | CF Secrets | ✅       |
| `CLERK_SECRET_KEY`     | CF Secrets | ✅       |
| `CLERK_WEBHOOK_SECRET` | CF Secrets | ✅       |
| `GEMINI_API_KEY`       | CF Secrets | ✅       |

### Optional Secrets

| Secret                | Location     | Purpose             |
| --------------------- | ------------ | ------------------- |
| `SENTRY_DSN`          | CF Variables | Error monitoring    |
| `ADMIN_USER_IDS`      | CF Variables | Admin access bypass |
| `SUPERADMIN_USER_IDS` | CF Variables | Superadmin access   |

### Secret Hygiene

- [x] No secrets committed to git (verified in `.gitignore`)
- [x] No `VITE_` prefix on sensitive data (except publishable key)
- [x] Environment variables documented in `deployment/DEPLOYMENT_CHECKLIST.md`

---

## ⚡ Rate Limiting

### Configuration (`functions/api/_shared/rateLimiter.ts`)

| Type        | Max Requests | Window | Purpose                |
| ----------- | ------------ | ------ | ---------------------- |
| `gemini`    | 20           | 1 hour | AI API protection      |
| `questions` | 100          | 1 hour | Quiz flow              |
| `standard`  | 300          | 1 hour | General API            |
| `auth`      | 10           | 5 min  | Brute force protection |
| `admin`     | 50           | 1 hour | Admin operations       |

### Implementation

- [x] In-memory rate limiting (per-isolate)
- [x] KV-backed distributed rate limiting (optional)
- [x] Rate limit headers (X-RateLimit-\*)
- [x] 429 response with Retry-After header

---

## 🔍 Input Validation

### Current Status

- ⚠️ **Zod not universally applied** - Some endpoints lack input validation

### Recommended Additions

```typescript
// Example: Session endpoint needs validation
const SessionRequestSchema = z.object({
  count: z.number().min(1).max(50).default(20),
  system: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});
```

### Priority Endpoints for Validation

1. `/api/questions/session` - Count and filter params
2. `/api/drills/submit-review` - Rating and answer data
3. `/api/feedback/submit` - User input sanitization (Zod `.strict()` with bounded free-text fields; see `docs/api/API_OVERVIEW.md`)

---

## 🚨 Known Vulnerabilities

### Resolved ✅

- Clock skew causing auth failures (fixed with 5000ms tolerance)
- Prisma connection pool exhaustion (fixed with try/finally disconnect)

### Pending ⚠️

1. **Input Validation Gap** - Add Zod schemas to all POST/PUT endpoints
2. **CORS Wildcard** - Currently `Access-Control-Allow-Origin: *` (acceptable for API)

### Not Applicable ❌

- SQL Injection - Prisma prevents by design
- XSS - React escapes by default, no dangerouslySetInnerHTML

---

## 📋 Audit Actions

### Quarterly Tasks

- [ ] Review Cloudflare Analytics for suspicious patterns
- [ ] Check Sentry for security-related errors
- [ ] Verify RLS policies still match schema
- [ ] Audit new endpoints added since last review

### Before Each Release

- [ ] Run `npm run test` to ensure no regressions
- [ ] Verify no new `VITE_` prefixed secrets
- [ ] Check that new endpoints have auth middleware

---

## 🔧 Remediation Priority

### Immediate (Sprint 2)

- [x] RLS policies enabled ✅
- [x] Admin access control working ✅
- [x] Rate limiting active ✅
- [ ] Add Zod to critical POST endpoints

### Short-term (Sprint 3-4)

- [ ] Audit all 50+ API endpoints for auth consistency
- [ ] Add comprehensive input validation
- [ ] Set up Cloudflare WAF rules (optional)

### Long-term (Sprint 10)

- [ ] Implement refresh token rotation
- [ ] Add API versioning for deprecation
- [ ] Set up automated security scanning

---

_Security Contact: security@studypanacea.com_  
_Report vulnerabilities responsibly_
