# Phase 2: Production Hardening Roadmap

> **Version:** 1.0.0  
> **Created:** January 10, 2026  
> **Status:** POST-SPRINT 10 - Consolidation Phase

## Executive Summary

The first 10 sprints delivered impressive feature breadth: 30+ API domains, 77+ services, 200+ components, FSRS v5 spaced repetition, PANCE exam simulation, and comprehensive medical content. However, the rapid velocity created **infrastructure debt** that must be addressed before scaling to real users.

---

## 🔴 Critical Findings

### 1. Testing Coverage Emergency

| Category       | Count | Tests | Coverage |
| -------------- | ----- | ----- | -------- |
| Services       | 77+   | ~21   | **~27%** |
| API Endpoints  | 100+  | 0     | **0%**   |
| Components     | 200+  | 0     | **0%**   |
| lib/ utilities | 50+   | 1     | **~2%**  |

**Impact:** Bugs reach production. Regressions go unnoticed. Refactoring is terrifying.

### 2. API Security Gaps

- Several endpoints missing auth header validation (documented in `docs/AUTH_HEADER_AUDIT_REPORT.md`)
- No Zod input validation on most POST endpoints
- Rate limiting exists but not consistently applied

### 3. Connection Pool Risk

- Cloudflare Functions must explicitly call `prisma.$disconnect()` in finally blocks
- Audit script exists (`scripts/audit-prisma-disconnect.ts`) but findings not fully resolved

### 4. Service Sprawl

- 77+ services with significant overlap (e.g., `questionService`, `enhancedQuestionService`, `intelligentQuestionService`, `adaptiveQuestionEngine`)
- No clear service architecture boundaries
- Difficult to understand data flow

### 5. Frontend Consistency

- Multiple skeleton/loading patterns (`SkeletonLoader`, `ClinicalSkeleton`, `ModeLoadingStates`)
- Inconsistent error handling across components

---

## 📋 Phase 2 Sprint Plan (Next 5 Sprints)

### SPRINT 11: "Test Foundation" (Week 1-2)

**Goal:** Establish test infrastructure and cover critical paths

#### Tasks

- [ ] **API Integration Tests** - Test top 10 most-used endpoints with mock DB
- [ ] **Service Unit Tests** - FSRS, question generation, session management
- [ ] **Component Tests** - React Testing Library for quiz components
- [ ] **E2E Smoke Test** - Playwright test for login → quiz → results flow
- [ ] **Coverage Dashboard** - Track test coverage in CI

#### Success Criteria

- 50% service coverage on critical services (fsrs, questionService, mainSessionService)
- E2E test passes on every push
- No PRs merged without tests for new features

#### Priority Files to Test

```
lib/fsrs.ts                          # CRITICAL - Spaced repetition algorithm
services/mainSessionService.ts        # Session orchestration
services/questionService.ts           # Question fetching
functions/api/questions/session.ts    # Session API
functions/api/drills/submit-review.ts # Review submission
lib/services/userProgressService.ts   # Progress tracking
```

---

### SPRINT 12: "API Hardening" (Week 2-3)

**Goal:** Bulletproof API security and reliability

#### Tasks

- [ ] **Auth Audit Fix** - Add auth headers to all identified endpoints
- [ ] **Zod Validation** - Add input schemas to all POST/PUT endpoints
- [ ] **Prisma Disconnect Audit** - Ensure all functions have proper cleanup
- [ ] **Rate Limiter Expansion** - Apply to all AI-powered endpoints
- [ ] **Error Response Standardization** - Consistent error format across all APIs
- [ ] **Request Logging** - Structured logs for debugging production issues

#### Success Criteria

- All endpoints pass security audit
- All POST endpoints have Zod validation
- 100% Prisma disconnect compliance
- Standardized error responses documented

#### Validation Schema Pattern

```typescript
// functions/api/_shared/validation-schemas.ts
import { z } from 'zod';

export const reviewSubmissionSchema = z.object({
  questionId: z.string().uuid(),
  userAnswer: z.string().min(1).max(1000),
  rating: z.number().min(1).max(4),
  timeSpentMs: z.number().min(0).max(600000),
});
```

---

### SPRINT 13: "Service Consolidation" (Week 3-4)

**Goal:** Reduce service sprawl and clarify architecture

#### Tasks

- [ ] **Service Audit** - Document purpose of all 77+ services
- [ ] **Merge Duplicates** - Consolidate overlapping question services
- [ ] **Define Boundaries** - Clear separation: Core, Domain, Analytics, AI
- [ ] **Dependency Graph** - Visual map of service dependencies
- [ ] **Dead Code Removal** - Remove unused services and components
- [ ] **Service Index** - Barrel exports with clear documentation

#### Success Criteria

- Services reduced from 77+ to ~50 through consolidation
- Clear `services/index.ts` with domain separation
- No circular dependencies
- All services documented with purpose and usage

#### Target Architecture

```
services/
├── core/                # Foundational services
│   ├── prismaService.ts
│   ├── authService.ts
│   └── cacheService.ts
├── domain/              # Business logic
│   ├── question/
│   ├── session/
│   ├── exam/
│   └── content/
├── analytics/           # User insights
│   ├── progressService.ts
│   ├── predictionService.ts
│   └── performanceService.ts
├── ai/                  # Gemini integrations
│   ├── generationService.ts
│   ├── validationService.ts
│   └── explanationService.ts
└── index.ts             # Public API
```

---

### SPRINT 14: "Frontend Polish" (Week 4-5)

**Goal:** Consistent, accessible, performant UI

#### Tasks

- [ ] **Design System Audit** - Document all UI components
- [ ] **Loading State Unification** - Single skeleton pattern
- [ ] **Error Boundary Coverage** - Wrap all mode components
- [ ] **Accessibility Audit** - WCAG 2.1 AA compliance
- [ ] **Performance Profiling** - Identify React re-render issues
- [ ] **Mobile Responsiveness** - Test all modes on mobile viewports

#### Success Criteria

- Single `components/ui/loading/` pattern
- All modes wrapped in error boundaries
- Lighthouse accessibility score >90
- No unnecessary re-renders in quiz flow

---

### SPRINT 15: "Monitoring & Operations" (Week 5-6)

**Goal:** Production observability and operational excellence

#### Tasks

- [ ] **Sentry Error Tracking** - Complete integration with source maps
- [ ] **Structured Logging** - JSON logs for all API calls
- [ ] **Health Dashboard** - Real-time system status page
- [ ] **Alerting Rules** - PagerDuty/Slack alerts for critical failures
- [ ] **Database Monitoring** - Connection pool metrics, slow query alerts
- [ ] **Runbook Documentation** - Incident response procedures

#### Success Criteria

- All errors captured in Sentry with context
- Health dashboard shows real-time status
- Alerting configured for 5xx spikes, DB issues
- Runbook exists for common incidents

---

## 📊 Success Metrics

### Quality Gates

| Metric                   | Current | Sprint 15 Target |
| ------------------------ | ------- | ---------------- |
| Test Coverage (Services) | ~27%    | 70%              |
| Test Coverage (API)      | 0%      | 50%              |
| E2E Test Pass Rate       | N/A     | 100%             |
| Lighthouse Performance   | ~70     | 85+              |
| Lighthouse Accessibility | ~75     | 90+              |
| Sentry Error Rate        | High    | <1%              |

### Operational Readiness

- [ ] Deployment automated via GitHub Actions ✅
- [ ] Rollback procedure documented
- [ ] Database backup verified
- [ ] Security audit passed
- [ ] Performance baseline established

---

## 🎯 Phase 2 Definition of Done

The application is ready for public beta when:

1. **Test coverage** on critical paths exceeds 70%
2. **No security vulnerabilities** in API endpoints
3. **All services documented** with clear ownership
4. **Error tracking** captures all production issues
5. **Performance metrics** meet targets
6. **Deployment pipeline** is fully automated
7. **Incident response** procedures documented

---

## 📝 Files to Create/Modify

### New Files

- `tests/api/session.test.ts` - API integration tests
- `tests/services/questionService.test.ts`
- `tests/components/QuizView.test.tsx`
- `e2e/quiz-flow.spec.ts` - Full E2E test
- `services/README.md` - Service architecture guide
- `docs/operations/RUNBOOK.md` - Incident procedures

### Modifications Required

- `functions/api/_shared/validation-schemas.ts` - Complete schemas
- `services/index.ts` - Consolidated exports
- `components/ui/loading/index.ts` - Unified loading
- `.github/workflows/ci.yml` - Add coverage reporting

---

## 🚀 Immediate Action Items (This Week)

### Priority 1: Critical (Today)

1. ✅ CI/CD pipeline deployed (completed)
2. ⬜ Fix remaining auth header issues
3. ⬜ Add Zod validation to session endpoint

### Priority 2: High (This Week)

4. ⬜ Write FSRS algorithm tests
5. ⬜ Write session service tests
6. ⬜ Complete E2E smoke test

### Priority 3: Medium (Next Week)

7. ⬜ Service consolidation plan
8. ⬜ Loading component unification
9. ⬜ Sentry source maps

---

_Last Updated: January 10, 2026_
