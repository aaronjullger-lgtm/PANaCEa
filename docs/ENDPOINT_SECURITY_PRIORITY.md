# Endpoint Security Priority List

**Date:** 2026-01-15  
**Sprint:** Security Hardening Sprint 3  
**Goal:** Apply middleware pattern to 10 highest-risk endpoints

---

## Priority Ranking Criteria

Endpoints are ranked by security risk based on:

1. **Cost Risk** - Can abuse exhaust paid API credits (Gemini AI)?
2. **Data Sensitivity** - Handles PII or medical data?
3. **Authentication** - Currently lacks auth enforcement?
4. **Public Exposure** - Accessible without authentication?
5. **Input Validation** - Lacks proper validation?
6. **CORS Exposure** - Uses wildcard CORS?

---

## 🔴 Critical Priority (Must Secure Immediately)

### 1. `/api/questions/generate.ts` ⚠️ **HIGHEST RISK**

- **Risk**: Unauthenticated AI generation can exhaust Gemini API credits
- **Cost Impact**: $$$$ (unlimited AI calls)
- **Issues**:
  - Commented-out auth logic
  - Wildcard CORS
  - No rate limiting enforcement
  - Verbose error logging
- **Status**: ❌ **UNSAFE** - Security audit identified as CRITICAL
- **Schema**: `questionGenerationSchema` (already exists in zodSchemas.ts)

### 2. `/api/drills/submit-review.ts`

- **Risk**: Updates FSRS spaced repetition state
- **Data Sensitivity**: User progress data
- **Issues**:
  - Direct Prisma access without validation
  - No explicit auth check visible
  - Critical for learning algorithm integrity
- **Status**: ⚠️ Needs review
- **Schema**: Need to create `reviewSubmissionSchema`

### 3. `/api/user/preferences.ts`

- **Risk**: Stores user PII and preferences
- **Data Sensitivity**: HIGH (user settings, potentially PII)
- **Issues**:
  - No validation on preference updates
  - Could allow injection of malicious data
- **Status**: ⚠️ Needs validation
- **Schema**: Need to create `userPreferencesSchema`

---

## 🟠 High Priority

### 4. `/api/user/goals.ts`

- **Risk**: User goal management
- **Data Sensitivity**: MEDIUM (user study goals)
- **Issues**:
  - Goal creation/update without proper validation
  - Could create excessive goals (DoS)
- **Status**: ⚠️ Needs validation
- **Schema**: `goalSchema` (already exists)

### 5. `/api/recommendations/generate.ts`

- **Risk**: AI-powered recommendations
- **Cost Impact**: $$ (Gemini API usage)
- **Issues**:
  - Another AI endpoint without rate limiting
  - Could be abused for credential stuffing
- **Status**: ⚠️ Needs rate limiting
- **Schema**: Need to create `recommendationRequestSchema`

### 6. `/api/admin/enrich-condition.ts`

- **Risk**: Admin endpoint for content enrichment
- **Data Sensitivity**: HIGH (medical content modification)
- **Issues**:
  - Lacks admin role enforcement
  - Could allow unauthorized content changes
- **Status**: ⚠️ Missing admin check
- **Schema**: `contentEnrichmentSchema` (already exists)

### 7. `/api/user/session.ts`

- **Risk**: Session management
- **Data Sensitivity**: HIGH (session state)
- **Issues**:
  - Session hijacking risk if not properly validated
  - State manipulation possible
- **Status**: ⚠️ Needs validation
- **Schema**: Need to create `sessionUpdateSchema`

---

## 🟡 Medium Priority

### 8. `/api/drills/contrastive/start.ts`

- **Risk**: Drill session initiation
- **Data Sensitivity**: MEDIUM (session setup)
- **Issues**:
  - Could create excessive sessions (resource exhaustion)
  - No payload size limits
- **Status**: ⚠️ Needs validation
- **Schema**: Need to create `contrastiveDrillStartSchema`

### 9. `/api/recommendations/action.ts`

- **Risk**: Recommendation action processing
- **Data Sensitivity**: MEDIUM (user interactions)
- **Issues**:
  - Tracks user behavior without validation
  - Could inject false interaction data
- **Status**: ⚠️ Needs validation
- **Schema**: Need to create `recommendationActionSchema`

### 10. `/api/buzzwords/random.ts`

- **Risk**: Public endpoint for buzzword retrieval
- **Data Sensitivity**: LOW (public medical terminology)
- **Issues**:
  - Wildcard CORS on public endpoint
  - No rate limiting (could be scraped)
- **Status**: ⚠️ Needs CORS fix + rate limit
- **Schema**: `paginationSchema` (simple - already exists)

---

## Implementation Order

### Phase 1: Critical (Immediate - This Sprint)

1. ✅ Create example endpoint (template)
2. 🚧 Secure `/api/questions/generate.ts` (CRITICAL)
3. 🚧 Secure `/api/drills/submit-review.ts`
4. 🚧 Secure `/api/user/preferences.ts`

### Phase 2: High Priority (This Sprint)

5. Secure `/api/user/goals.ts`
6. Secure `/api/recommendations/generate.ts`
7. Secure `/api/admin/enrich-condition.ts`
8. Secure `/api/user/session.ts`

### Phase 3: Medium Priority (Next Sprint)

9. Secure `/api/drills/contrastive/start.ts`
10. Secure `/api/recommendations/action.ts`
11. Secure `/api/buzzwords/random.ts`

---

## Migration Checklist (Per Endpoint)

For each endpoint, follow these steps:

### 1. **Identify or Create Schema**

```typescript
// In functions/api/_shared/zodSchemas.ts
export const endpointSchema = z.object({
  field1: z.string().min(1),
  field2: z.number().int().positive(),
});
```

### 2. **Choose Middleware Stack**

- `authenticatedEndpoint()` - Most common (auth required)
- `publicEndpoint()` - Public but validated
- `adminEndpoint()` - Auth + admin check
- `withMiddleware()` - Custom composition

### 3. **Convert Handler**

```typescript
// OLD (unsafe)
export async function onRequestPost(context: any) {
  const body = await context.request.json();
  // ... unsafe logic
}

// NEW (secure)
import { authenticatedEndpoint } from './_shared/middleware';
import { endpointSchema } from './_shared/zodSchemas';

export const onRequestPost = authenticatedEndpoint(endpointSchema, async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    // Secure logic with context.validated and context.auth
    return { data: result };
  } finally {
    await prisma.$disconnect();
  }
});
```

### 4. **Test**

- ✅ Unauthenticated request → 401
- ✅ Invalid payload → 400 with helpful errors
- ✅ Valid request → 200 with data
- ✅ CORS headers present
- ✅ Logs show redacted secrets

### 5. **Document**

- Add endpoint to security test suite
- Update API documentation
- Mark as secured in this document

---

## Success Metrics

| Metric                     | Target | Current |
| -------------------------- | ------ | ------- |
| Critical endpoints secured | 3/3    | 0/3     |
| High priority secured      | 4/4    | 0/4     |
| Medium priority secured    | 3/3    | 0/3     |
| Total endpoints secured    | 10/10  | 0/10    |
| Auth enforcement           | 100%   | ~60%    |
| Input validation           | 100%   | ~20%    |
| Secure CORS                | 100%   | ~40%    |

---

## Risk Reduction Impact

**Before:**

- 3 Critical vulnerabilities
- 200+ endpoints with inconsistent security
- Wildcard CORS on 50+ endpoints
- No input validation on 150+ endpoints

**After (Target):**

- 0 Critical vulnerabilities
- 10 highest-risk endpoints secured
- Blueprint for securing remaining 190+ endpoints
- Foundation for consistent security patterns

**Estimated Risk Reduction:** 80% of exploitable attack surface closed

---

## Next Steps After Top 10

1. **Create Security Test Suite** - Automated tests for auth, validation, CORS
2. **Audit Remaining 190+ Endpoints** - Categorize by risk
3. **Batch Conversion** - Apply middleware to 10-20 endpoints per week
4. **Deprecate Unsafe Patterns** - Remove legacy handler patterns
5. **Documentation** - Update API docs with security requirements
6. **Monitoring** - Set up alerts for failed auth/validation attempts
