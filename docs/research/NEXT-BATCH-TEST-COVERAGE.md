# Next Batch: Test Coverage & Type Safety Hardening

**Created:** 2026-07-30
**Context:** All 10 research improvements from the first synthesis are implemented and verified. This batch addresses the **highest-risk gaps** found in a codebase audit: untested critical-path services and `as any` type erosion.

---

## Audit Methodology

- **Scope:** `lib/services/*.ts` files with no corresponding `.test.ts` or `__tests__/*.test.ts`
- **Risk signal:** Lines of code × criticality of path × presence of `as any`
- **Metric:** 20 service files totaling **8,500+ lines** have zero test coverage

---

## Top 5 Improvements

### 1. Drill Review Service Test Suite (Critical Path)

**Composite: 120 (5 × 4 × 6)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | This is the ONLY path from student answer → FSRS update → DB write. A bug here corrupts learning data silently. |
| Feasibility | 4 | Pure logic; mock Prisma + FSRS; no external deps |
| Evidence | 6 | 2713 lines, 0 tests, 15 `as any` casts — highest risk-to-coverage ratio in codebase |

**What it is:** Add a comprehensive test suite for `lib/services/drillReviewService.ts` covering:
- Correct/incorrect answer flows
- Implicit rating derivation from behavioral signals
- Wave 1A (lapse severity), Wave 2 (distractor chronometry), Wave 3 (explanation engagement)
- FSRS state transitions (reps, lapses, stability, difficulty)
- Telemetry logging completeness
- Edge cases: first review, relearning state, EOR clamp, sibling propagation
- Error paths: invalid card state, missing telemetry, NaN stability

**Implementation path:**
1. Create `lib/services/drillReviewService.test.ts`
2. Mock: PrismaClient, FSRS singleton, propagateRecallToSiblings, userStatisticsService
3. Test happy path: correct answer → stability increases → ReviewLog written
4. Test lapse path: incorrect answer → stability resets → lapse severity applied
5. Test telemetry: all server_computed fields populated correctly
6. Test edge cases: elapsed_days=0, stability=0, reps=0, lapses=0

---

### 2. Question Selector Test Suites

**Composite: 96 (4 × 4 × 6)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Controls which questions students see; bugs cause repeat questions or gaps |
| Feasibility | 4 | Pure selection logic; mock DB queries |
| Evidence | 6 | 1931 combined lines (conceptQuestionSelector 1036 + mainSessionQuestionSelector 895), 0 tests |

**What it is:** Add test suites for both question selectors:
- `conceptQuestionSelector.ts` (1036 lines): concept-based question routing
- `mainSessionQuestionSelector.ts` (895 lines): main study session question delivery

---

### 3. FSRS Schedule Service Tests

**Composite: 90 (5 × 3 × 6)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | Controls review scheduling intervals — directly affects retention |
| Feasibility | 3 | Integrates with optimizer + calibration; more complex mocks |
| Evidence | 6 | 547 lines, 0 tests |

**What it is:** Add test suite for `lib/services/fsrsScheduleService.ts` covering interval calculation, stability-to-interval conversion, and EOR clamping.

---

### 4. Offline Sync Service Tests

**Composite: 84 (4 × 3 × 7)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Handles queued answer submission when connectivity returns — data loss risk |
| Feasibility | 3 | Async retry logic, idempotency, conflict resolution |
| Evidence | 7 | 467 lines, 0 tests — offline bugs are silent and hard to reproduce |

**What it is:** Add test suite for `lib/services/offlineSyncService.ts` covering:
- Queue ordering and deduplication
- Idempotency key handling
- Partial failure and retry
- Conflict resolution (same answer submitted twice)

---

### 5. Type Safety: Eliminate `as any` in drillReviewService.ts

**Composite: 80 (4 × 4 × 5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Type erosion in the core pipeline masks real bugs; `as any` bypasses compile-time safety |
| Feasibility | 4 | 15 instances in one file; can be addressed incrementally |
| Evidence | 5 | `as any` count in drillReviewService is 7.5× higher than next worst file |

**What it is:** Replace all 15 `as any` casts in `drillReviewService.ts` with proper types or type guards. Categories:
- Prisma type mismatches (card state shape)
- FSRS card serialization
- Telemetry JSON fields

---

## Summary Table

| Rank | Improvement | Composite | LOC Untested | Status |
|------|-------------|-----------|-------------|--------|
| 1 | Drill Review Service Tests | 120 | 2713 | ✅ Phase 1 DONE (44 pure function tests) |
| 2 | Question Selector Tests | 96 | 1931 | 🔲 TODO |
| 3 | FSRS Schedule Service Tests | 90 | 547 | 🔲 TODO |
| 4 | Offline Sync Service Tests | 84 | 467 | 🔲 TODO |
| 5 | Type Safety Hardening | 80 | — | 🔲 TODO |

**Total untested critical-path LOC addressed: 5,658**
