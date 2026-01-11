# Fortress Mode: Production Readiness Roadmap

**Created:** January 10, 2026  
**Status:** Active  
**Goal:** Transform StudyPANaCEa from feature-complete to production-ready

---

## Executive Summary

Following the 5-sprint "Magic Features" phase, this roadmap addresses the technical debt accumulated during rapid feature development. The focus shifts from "what can we build" to "how do we make it bulletproof."

**Production Readiness Target: 95%**  
**Timeline: 7 weeks**

---

## Current State Assessment

### Metrics (January 10, 2026)

| Metric | Current | Target |
|--------|---------|--------|
| Service files | 77 | 25 |
| Zod validation | 27% | 100% |
| Test coverage | 31% | 80% |
| CLS score | Unknown | 0.0 |
| API P95 latency | Unknown | <200ms |
| Error rate | Unknown | <0.1% |

### Critical Gaps Identified

1. **Service Layer Chaos** - 77 overlapping services
2. **Input Validation** - 73% of endpoints unvalidated
3. **Test Coverage** - Only 31% coverage
4. **Loading States** - CLS issues across 80 components
5. **Observability** - No structured logging

---

## Phase 6: Service Consolidation (2 weeks)

### Goal
Reduce 77 services → 25 organized services with clear responsibilities.

### Target Structure

```
services/
├── core/                    # Core business logic
│   ├── questionService.ts   # Merged from 4 files
│   ├── sessionService.ts    # Session management
│   ├── userService.ts       # User operations
│   ├── contentService.ts    # Medical content
│   └── index.ts
├── analytics/               # All analytics
│   ├── performanceService.ts    # Merged from 4 files
│   ├── predictionService.ts     # Score predictions
│   ├── insightsService.ts       # User insights
│   └── index.ts
├── ai/                      # AI/LLM services
│   ├── geminiService.ts
│   ├── generatorService.ts
│   └── index.ts
├── domain/                  # Domain-specific
│   ├── fsrsService.ts
│   ├── examService.ts
│   ├── osceService.ts
│   ├── drillService.ts
│   ├── labService.ts
│   ├── anatomyService.ts
│   ├── drugService.ts
│   └── index.ts
├── integrations/            # External services
│   ├── clerkService.ts
│   ├── supabaseService.ts
│   ├── todoistService.ts
│   └── index.ts
└── index.ts                 # Main barrel export
```

### Consolidation Tasks

#### Question Services (4 → 1)
- [ ] Audit: `questionService.ts`
- [ ] Audit: `enhancedQuestionService.ts`
- [ ] Audit: `intelligentQuestionService.ts`
- [ ] Audit: `adaptiveQuestionEngine.ts`
- [ ] Create unified: `services/core/questionService.ts`
- [ ] Update all imports

#### Performance Services (4 → 1)
- [ ] Audit: `performanceService.ts`
- [ ] Audit: `performancePredictionService.ts`
- [ ] Audit: `panaceScorePredictor.ts`
- [ ] Audit: `panceScorePredictorService.ts`
- [ ] Create unified: `services/analytics/performanceService.ts`
- [ ] Update all imports

#### Analytics Services (5 → 2)
- [ ] Audit: `advancedUserAnalyticsEngine.ts`
- [ ] Audit: `circadianAnalyticsService.ts`
- [ ] Audit: `deepAnalyticsStore.ts`
- [ ] Audit: `researchBackedAnalytics.ts`
- [ ] Audit: `sessionAnalyticsSyncService.ts`
- [ ] Create: `services/analytics/insightsService.ts`
- [ ] Update all imports

### Success Criteria
- [ ] All 77 service files mapped to new structure
- [ ] Zero duplicate function names
- [ ] All imports updated
- [ ] All tests passing

---

## Phase 7: Validation Hardening (1 week)

### Goal
100% Zod validation on all POST/PUT endpoints.

### Priority Order

#### P0: Security-Critical (Admin)
- [ ] `functions/api/admin/content/[id].ts`
- [ ] `functions/api/admin/content/create.ts`
- [ ] `functions/api/admin/content/transition.ts`
- [ ] `functions/api/admin/media/[id].ts`
- [ ] `functions/api/admin/media/approve.ts`

#### P1: User Data Endpoints
- [ ] `functions/api/questions/record.ts`
- [ ] `functions/api/questions/custom-session.ts`
- [ ] `functions/api/analytics/session.ts`
- [ ] `functions/api/analytics/profile.ts`

#### P2: All Remaining POST/PUT
- Remaining 20+ endpoints

### Schema Standards
```typescript
// All schemas should:
// 1. Use strict mode
// 2. Include max lengths for strings
// 3. Include bounds for numbers
// 4. Use enums for finite options

const ExampleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  count: z.number().int().min(0).max(10000),
  type: z.enum(['quiz', 'drill', 'exam']),
}).strict();
```

---

## Phase 8: Test Coverage (2 weeks)

### Goal
>80% coverage on critical paths.

### Test Categories

#### Unit Tests (50+ new)
- FSRS calculations
- Score predictions
- Content parsing
- Utility functions

#### Integration Tests (20+ new)
- Question session flow
- User progress tracking
- OSCE chat flow
- Exam completion flow

#### API Tests (30+ new)
- All POST endpoints
- Error responses
- Auth flows
- Rate limiting

### Coverage Targets
| Category | Current | Target |
|----------|---------|--------|
| Services | 31% | 85% |
| API Endpoints | 0% | 75% |
| Components | ~10% | 50% |

---

## Phase 9: Observability (1 week)

### Goal
Full production visibility.

### Deliverables

1. **Structured Logging**
   ```typescript
   logger.info('question.generated', {
     userId: ctx.userId,
     system: 'cardiovascular',
     difficulty: 3,
     durationMs: 245
   });
   ```

2. **Request Tracing**
   - Add `x-request-id` header propagation
   - Log correlation IDs across function calls

3. **Metrics Dashboard**
   - API response times (P50, P95, P99)
   - Error rates by endpoint
   - Database query times
   - AI generation latencies

4. **Alerting**
   - Error rate > 1%
   - P95 latency > 500ms
   - Database connection failures

---

## Phase 10: Performance & Caching (1 week)

### Goal
Sub-200ms API responses for common operations.

### Caching Strategy

1. **Cloudflare KV Cache**
   - Question pools (per system)
   - User session state
   - Static medical content

2. **Pre-generation**
   - Warm question pool nightly
   - Pre-compute daily prescriptions
   - Cache common analytics

3. **Database Optimization**
   - Add missing indexes
   - Optimize N+1 queries
   - Connection pooling tuning

### Target Latencies
| Operation | Current | Target |
|-----------|---------|--------|
| Get question | ~400ms | <100ms |
| Submit answer | ~300ms | <150ms |
| Load analytics | ~800ms | <200ms |

---

## Risk Mitigation

### During Consolidation
1. **Feature flags** for new service paths
2. **Parallel running** old + new for 1 week
3. **Rollback scripts** prepared

### Testing
1. **Snapshot tests** before consolidation
2. **Contract tests** for API stability
3. **Load testing** before launch

---

## Timeline

```
Week 1-2: Phase 6 - Service Consolidation
Week 3:   Phase 7 - Validation Hardening
Week 4-5: Phase 8 - Test Coverage
Week 6:   Phase 9 - Observability
Week 7:   Phase 10 - Performance & Caching
```

---

## Success Definition

The platform is "production-ready" when:

1. ✅ Service layer is organized (25 files, clear boundaries)
2. ✅ All user inputs validated (Zod on 100% of endpoints)
3. ✅ Test coverage > 80% on critical paths
4. ✅ CLS = 0 (no loading state jank)
5. ✅ API P95 < 200ms
6. ✅ Error rate < 0.1%
7. ✅ Full observability (logs, metrics, traces)
8. ✅ Documented runbooks for common issues
