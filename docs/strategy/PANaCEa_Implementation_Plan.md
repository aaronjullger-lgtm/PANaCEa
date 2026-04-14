# PANaCEa Implementation Plan

**20 Improvements Across 6 Phases Over 12 Weeks**

*Based on Architecture Audit Report | April 3, 2026*
*Last updated: April 6, 2026*

---

## Implementation Status Summary

| Phase | Theme | Status | Notes |
|-------|-------|--------|-------|
| 1 | Foundation & Observability | **COMPLETE** | Structured logging, BRIN indexes (pre-existing), tsvector (pre-existing), provenance badges |
| 2 | Data Quality Gates | **COMPLETE** | Review queue UI, ALLOWED_VALIDATION_STATUSES gate, SRSItem references removed |
| 3 | Frontend State & Performance | **COMPLETE** | Zustand (pre-existing), bundle budget CI (pre-existing), mobile nav & Radix deferred |
| 4 | Search & Personalization | **COMPLETE** | pgvector (pre-existing), FSRS optimizer (pre-existing), course retention, Wilson score, guideline RAG |
| 5 | Analytics Performance | **COMPLETE** | 3 materialized views, blueprint-coverage endpoint, cron refresh |
| 6 | Infrastructure Cleanup | **COMPLETE** | Express deprecation checklist + route annotations, axe-core CI step, TanStack Query key factory + 12 hooks + GoalsDashboard migration |

---

## Plan Overview

This plan sequences the 20 audit improvements into 6 phases ordered by dependency chains, risk, and value. Each phase builds on the previous. The plan is designed so that a PA-S2 balancing rotations can execute it incrementally without disrupting the live application.

| Phase | Weeks | Theme | Key Deliverables |
|-------|-------|-------|------------------|
| 1 | 1-2 | Foundation & Observability | Structured logging, BRIN indexes, tsvector activation, content provenance |
| 2 | 3-4 | Data Quality Gates | AI question review queue, deprecated schema cleanup |
| 3 | 5-6 | Frontend State & Performance | Zustand migration, bundle budget CI, mobile bottom nav, Radix UI start |
| 4 | 7-9 | Search & Personalization | pgvector semantic search, FSRS optimizer, desired retention, Wilson score, guideline RAG |
| 5 | 10 | Analytics Performance | Materialized views for dashboards |
| 6 | 11-12 | Infrastructure Cleanup | Express deprecation, table partitioning, a11y CI, TanStack Query standardization |

---

## Dependency Map

Some improvements depend on others. This section shows the critical ordering constraints.

### Must-Do-First (Phase 1 Prerequisites)

- **Observability (#2)** underpins everything. You cannot safely deploy FSRS optimizer or pgvector without production tracing.
- **BRIN indexes (#6)** and **tsvector activation (#5)** are zero-risk database improvements that benefit all subsequent query work.
- **Content provenance (#9)** adds fields needed by guideline RAG (#14) and semantic search (#3).

### Mid-Tier Dependencies

- **pgvector (#3)** depends on provenance fields (#9) for embedding source tracking, and tsvector (#5) for hybrid BM25 + vector search.
- **FSRS optimizer (#1)** needs observability (#2) to monitor parameter quality in production. Also benefits from materialized views (#7) for review history aggregation.
- **Guideline RAG (#14)** needs both provenance fields (#9) and semantic search (#3) to retrieve relevant guidelines.

### Independent (Can Run Anytime)

- Bundle budget (#10), axe-core (#16), deprecated model removal (#19) have no dependencies and can be done in any phase.
- Zustand (#17), Radix UI (#12), mobile nav (#13) are frontend-only and independent of database work.
- Wilson score (#18), desired retention (#15) are isolated feature additions.

### Dependency Chain Diagram

```
Observability (#2) --> FSRS Optimizer (#1)
Provenance (#9) --> tsvector (#5) --> pgvector (#3) --> Guideline RAG (#14)
BRIN Indexes (#6) --> Materialized Views (#7) --> Table Partitioning (#20)
TanStack Query (#8) --> Optimistic Updates in Drill Submissions
```

---

## Phase 1: Foundation & Observability (Weeks 1-2) — COMPLETE

Low-risk, high-payoff database and infrastructure improvements. Every item here is either additive (new indexes, new fields) or purely operational (logging). Nothing here changes application behavior.

### 1.1 Structured Observability for Edge Functions (#2) — DONE

**Priority:** CRITICAL | **Effort:** 1 week | **Risk:** Very Low

> **Implemented:** `functions/api/_shared/structuredLogger.ts` with span-based timing, Sentry-ready lazy loading, and `withStructuredLogging()` middleware. Applied to all endpoint stacks via `middleware.ts`. Pipeline spans added to `submit-review.ts`.

Without structured logging, every subsequent improvement is deployed blind. This must be first.

#### What Changes

- New file: `functions/api/_shared/structuredLogger.ts` - Middleware that wraps every edge function handler
- Modified: All `functions/api/` endpoints (wrap existing handlers)
- Modified: `lib/services/drillReviewService.ts` (add Sentry spans around confidence pipeline)

#### Implementation Steps

1. Create structuredLogger middleware that generates a requestId (crypto.randomUUID()), logs JSON start/end events, and wraps handler in try/catch with Sentry.captureException
2. Apply middleware to `functions/api/drills/submit-review.ts` first (most critical endpoint)
3. Add Sentry.startSpan around the confidence pipeline section of drillReviewService.ts (the 18-step modulation chain)
4. Roll out middleware to all remaining endpoints (batch by directory: analytics/, content/, admin/)
5. Verify structured logs appear in Cloudflare Workers dashboard and Sentry receives exceptions

#### Log Format

```json
{ requestId, endpoint, method, userId, timestamp, latencyMs, status, error?, confidencePipelineMs? }
```

#### Success Criteria

- 100% of edge function requests emit structured JSON logs
- Sentry captures all unhandled exceptions with requestId correlation
- Confidence pipeline latency is visible as a named span in Sentry

### 1.2 BRIN Indexes on Time-Series Columns (#6) — PRE-EXISTING

**Priority:** High | **Effort:** 1 day | **Risk:** Zero

> **Status:** Already deployed in `prisma/migrations/20260326_add_performance_indexes/`. No action needed.

BRIN (Block Range Index) indexes are 19.8% smaller than B-tree for naturally time-ordered data and provide faster range scans. These columns are append-only, making them ideal BRIN candidates.

#### Migration SQL

```sql
CREATE INDEX CONCURRENTLY idx_reviewlog_reviewedat_brin ON "ReviewLog" USING brin ("reviewedAt");
CREATE INDEX CONCURRENTLY idx_questionattempt_createdat_brin ON "QuestionAttempt" USING brin ("createdAt");
CREATE INDEX CONCURRENTLY idx_performancerecord_timestamp_brin ON "PerformanceRecord" USING brin (timestamp);
```

#### Important Notes

- Do NOT remove existing B-tree composite indexes (e.g., userId + createdAt). BRIN indexes supplement composites for pure time-range queries.
- CREATE INDEX CONCURRENTLY does not lock the table. Zero downtime.
- Verify with EXPLAIN ANALYZE on a sample query before and after.

### 1.3 Activate tsvector Full-Text Search (#5) — PRE-EXISTING

**Priority:** High | **Effort:** 2-3 days | **Risk:** Very Low

> **Status:** tsvector column, GIN index, and `websearch_to_tsquery` search already active in content endpoints. No action needed.

The tsvector column already exists on MedicalContent but the search API uses ILIKE. This is nearly free: switch the query, add a GIN index, and search quality improves dramatically.

#### Implementation Steps

1. Verify tsvector column exists and is populated (check for NULL values; if empty, create a trigger to populate on INSERT/UPDATE)
2. Create migration: `CREATE INDEX idx_medicalcontent_search_gin ON "MedicalContent" USING gin (search_vector)`
3. Find all ILIKE queries in `functions/api/content/` endpoints (grep for ILIKE or ilike)
4. Replace with: `WHERE search_vector @@ plainto_tsquery('english', $searchTerm) ORDER BY ts_rank(search_vector, plainto_tsquery('english', $searchTerm)) DESC`
5. Add prefix matching support: `to_tsquery('english', $term || ':*')` for autocomplete
6. Test with medical queries: 'chest pain', 'shortness of breath', 'PE', 'myocardial infarction'

### 1.4 Content Provenance Fields (#9) — DONE

**Priority:** Medium | **Effort:** 2-3 days | **Risk:** Zero

> **Implemented:** `components/ui/ProvenanceBadge.tsx` with color-coded shield (green/yellow/gray) and hover tooltip. Integrated into `EnhancedConditionCard.tsx`. Schema fields were pre-existing.

#### Schema Changes

MedicalContent: Add
- `lastClinicalReviewAt` DateTime?
- `evidenceGrade` String? @db.VarChar(1)
- `guidelineSource` String?
- `guidelineYear` Int?
- `reviewedBy` String?

#### UI Changes

Display small badge in ClinicalReferenceLibrary: green for Grade A reviewed within 2 years, yellow for Grade B or older than 2 years, gray for no provenance data

Tooltip on badge showing full provenance: 'Source: AHA 2025 Guidelines | Last reviewed: March 2026 | Grade: A'

---

## Phase 2: Data Quality Gates (Weeks 3-4) — COMPLETE

This phase adds the human review gate for AI-generated questions. This is a clinical safety requirement: AI-generated medical MCQs must have a review path before serving to students.

### 2.1 AI Question Review Queue (#4) — DONE

**Priority:** CRITICAL (Safety) | **Effort:** 1 week | **Risk:** Medium

> **Implemented:** `components/admin/QuestionReviewQueue.tsx` with full admin UI (stats dashboard, filtering, expandable preview, approve/reject/needs_revision actions, batch auto-approve). `ENABLE_REVIEW_GATE` flag and `ALLOWED_VALIDATION_STATUSES` constant in `mainSessionQuestionSelector.ts`, imported by `refillWorker.ts` for single source of truth.

#### Current State

PreGeneratedQuestion already has validationStatus (default: 'pending'), validatedAt, validatedBy, validationNotes. The infrastructure partially exists but there is no admin UI and no gate preventing unreviewed questions from being served.

#### Implementation Steps

1. Add reviewStatus values: PENDING -> NEEDS_REVIEW -> APPROVED | REJECTED. Questions with qualityScore >= 90 auto-promote to APPROVED. All others go to NEEDS_REVIEW.
2. Create admin endpoint: GET `/api/admin/review-queue` (paginated, sortable by qualityScore, system, conditionId)
3. Create admin endpoint: PATCH `/api/admin/review-queue/:id` (approve/reject with reviewNote, reviewedBy)
4. Update question pool selection to only serve APPROVED questions in production sessions
5. Build admin review UI component: QuestionReviewQueue.tsx with question preview, explanation display, approve/reject buttons, and batch actions
6. Update pool health monitor to only count APPROVED questions toward threshold

#### Risk Mitigation

- Feature flag: `ENABLE_REVIEW_GATE=true`. Set to false initially to avoid blocking question supply while review queue ramps up.
- Auto-approve threshold (qualityScore >= 90) ensures high-quality questions flow without manual review.
- Monitor question supply: if APPROVED pool drops below LOW_WATER_MARK, alert admin and temporarily widen auto-approve threshold.

### 2.2 Remove Deprecated Schema Models (#19) — DONE

**Priority:** Low | **Effort:** 1 day | **Risk:** Very Low

> **Implemented:** Removed last runtime reference to SRSItem from `disasterRecoveryService.ts`. Schema models remain in Prisma for migration history but have zero runtime references.

1. grep -r 'SRSItem' across entire codebase (excluding prisma/migrations/)
2. grep -r 'UserFSRSWeights' across entire codebase (excluding prisma/migrations/)
3. If zero active references: create migration to DROP TABLE
4. If references found: update code first, then drop

---

## Phase 3: Frontend State & Performance (Weeks 5-6) — COMPLETE

Frontend improvements that reduce re-renders, enforce bundle budgets, and improve mobile UX.

### 3.1 Zustand for Non-Global State (#17) — PRE-EXISTING

**Effort:** 1 week | **Risk:** Low

> **Status:** Zustand v5 stores already exist in `stores/` (tooltipStore, navRailStore, toastStore, etc.). Migration was completed in a prior session.

#### Migration Plan

- TooltipContext -> stores/tooltipStore.ts (useTooltipStore)
- NavRailContext -> stores/navRailStore.ts (useNavRailStore)
- ToastContext -> stores/toastStore.ts (useToastStore)
- Keep SessionContext, ThemeContext, and ShortcutContext as React Contexts (these are truly global and rarely change). Zustand atoms re-render only subscribers, reducing unnecessary re-renders when unrelated state changes.

#### Implementation

1. Install zustand. Create each store as a standalone file with create(). Use immer middleware if state has nested updates.
2. Update all consumer components to use useXyzStore() hook instead of useContext(XyzContext).
3. Remove Context providers from index.tsx provider tree. Run full test suite.

### 3.2 Bundle Size Budget in CI (#10) — PRE-EXISTING

**Effort:** 1 day | **Risk:** Zero

> **Status:** `npm run build:check-size` and CI step already exist in `.github/workflows/ci.yml`.

1. Install rollup-plugin-visualizer as devDependency
2. Add to vite.config.ts: `visualizer({ filename: 'dist/stats.html', gzipSize: true })`
3. Create scripts/check-bundle-size.sh: build, check dist/assets/ sizes, enforce budgets (any chunk > 200KB uncompressed = fail, total > 2MB = fail)
4. Add as CI step in GitHub Actions. Document baseline sizes.

### 3.3 Mobile Bottom Navigation (#13) — DEFERRED

**Effort:** 1 week | **Risk:** Medium

> **Status:** Deferred to a future sprint. Non-blocking for core functionality.

1. Create `components/layout/BottomNav.tsx`: 5 tabs (Study, Drills, Library, Progress, Menu)
2. Use lucide-react icons matching NavRail. Fixed bottom positioning with safe-area-inset-bottom for iOS.
3. Show at < 768px (md:hidden on NavRail, md:block on NavRail, block md:hidden on BottomNav)
4. Add bottom padding to main content area to prevent overlap
5. Test at 375px (iPhone SE) and 414px (iPhone 14) widths

### 3.4 Radix UI Adoption (#12) — DEFERRED

**Effort:** 2 weeks (incremental) | **Risk:** Low

> **Status:** Deferred to incremental adoption. Non-blocking for core functionality.

Migrate in order of impact: Dialog (most used) -> Dropdown -> Tabs -> Tooltip -> Popover. Create wrapper components in components/ui/radix/ that apply PANaCEa design tokens. Keep all custom drill and session components unchanged.

---

## Phase 4: Search & Personalization (Weeks 7-9) — COMPLETE

The highest-impact phase. pgvector transforms the clinical library, and FSRS optimization personalizes scheduling for every student.

### 4.1 pgvector Semantic Search (#3) — PRE-EXISTING

**Effort:** 2-3 weeks | **Risk:** Medium

> **Status:** pgvector extension, embedding column, HNSW index, and hybrid search with Reciprocal Rank Fusion already deployed. `lib/services/semanticSearchService.ts` handles BM25 + vector fusion.

#### Week 7: Infrastructure

- Verify PostgreSQL hosting supports pgvector (Neon, Supabase, and most managed Postgres do)
- Migration: `CREATE EXTENSION IF NOT EXISTS vector;`
- Add embedding `vector(768)` column to MedicalContent
- Create HNSW index: `CREATE INDEX ON "MedicalContent" USING hnsw (embedding vector_cosine_ops)`

#### Week 8: Embedding Generation

1. Create `scripts/generate-embeddings.ts` that iterates all MedicalContent records
2. For each: concatenate condition + overview + symptoms + diagnostics text
3. Call Gemini embedding API (text-embedding-004, 768 dimensions)
4. Rate limit: 100 requests/minute, batch 1000 records/hour
5. Store vectors in embedding column. Log coverage: what % of content has embeddings.

#### Week 9: Hybrid Search

1. Replace `semanticSearchService.ts` hardcoded CONCEPT_MAPPINGS with hybrid query:
   - BM25 score: `ts_rank(search_vector, query)` with weight 0.6
   - Vector score: `1 - (embedding <=> query_embedding)` with weight 0.4
   - Final score: reciprocal rank fusion of both rankings
2. Update `/api/content/library` search endpoint to use hybrid search
3. Test: 'crushing chest pain radiating to jaw' should rank MI #1

### 4.2 Per-User FSRS Parameter Optimization (#1) — PRE-EXISTING

**Effort:** 3-4 weeks | **Risk:** High (requires careful validation)

> **Status:** FSRS optimizer already deployed with shadow mode, A/B testing infrastructure, and `usePersonalizedParams` flag in UserSRSConfig. `lib/services/fsrs/parameterOptimizer.ts` exists.

#### Architecture

- Create `lib/services/fsrs/parameterOptimizer.ts`
- Create `functions/api/cron/fsrs-optimize.ts` (weekly cron)
- Modify `lib/fsrs.ts` to accept personalized params
- Modify `drillReviewService.ts` to load user params before scheduling

#### Optimization Pipeline

1. Query ReviewLog for users with >= 100 reviews
2. For each user: extract review history (grade, state, stability, difficulty, elapsed_days, retrievability)
3. Split 80/20 train/validation
4. Optimize 21 parameters to minimize log loss on training set (predicted vs actual retrievability)
5. Validate on holdout: if improvement > 5% in Brier score, save to PersonalizedFSRSParams
6. Store: optimized weights, sampleSize, improvementOverDefault, validationBrierScore, lastOptimizedAt

#### Safety Protocol

- **Shadow mode first (2 weeks):** Run optimizer, log recommendations, but do NOT apply to live scheduling
- **A/B test (2 weeks):** 10% of eligible users get personalized params; monitor retention rate and card stability
- **Guardrails:** If any parameter deviates > 3x from default, flag for manual review. Cap stability at 365 days.
- **Rollback:** usePersonalizedParams flag in UserSRSConfig. Set to false to revert any user to defaults.

### 4.3 Desired Retention per Course (#15) — DONE

**Effort:** 2-3 days | **Risk:** Low

> **Implemented:** `lib/services/courseRetentionResolver.ts` with `resolveRetention()` and `updateCourseRetention()`. Migration `20260406120000_phase4_course_retention_wilson` adds `courseRetentionMap` JSONB to UserSRSConfig. Clamped to 0.80–0.95 safe bounds.

1. Add `courseRetentionMap` Json? to UserSRSConfig (map of courseId -> retention float, 0.80-0.95)
2. Add settings UI: slider per course with recommended defaults (85% for IM/Surgery, 90% default, 95% for shelf prep)
3. Modify `drillReviewService.ts` to read per-course retention: `const retention = userConfig.courseRetentionMap?.[courseId] ?? userConfig.requestRetention ?? 0.9`

### 4.4 Wilson Score Confidence Intervals (#18) — DONE

**Effort:** 2-3 days | **Risk:** Very Low

> **Implemented:** `lib/statistics/wilsonScore.ts` with `wilsonScore()`, `hasMastery()`, and `masteryLevel()`. Replaces old MIN_SYSTEM_REVIEWS = 5 hard cutoff with statistically grounded Wilson CI lower bound check.

1. Create `lib/statistics/wilsonScore.ts`: Wilson CI at 95% confidence
2. Replace `MIN_SYSTEM_REVIEWS = 5` with: show mastery badge only if Wilson lower bound > 0.8
3. Display confidence range as error bars on accuracy charts in dashboard

### 4.5 Guideline RAG for Virtual Preceptor (#14) — DONE

**Effort:** 2-3 weeks | **Risk:** Medium | **Depends on:** #3 (pgvector), #9 (provenance)

> **Implemented:** `lib/services/guidelineRagService.ts` with two-strategy retrieval (direct conditionId lookup + FTS fallback). Returns typed `GuidelineSnippet[]` with `formatPromptContext()` for system prompt injection. Audit-ready with `retrievedContentIds`.

1. Before generating Preceptor feedback: extract condition + key findings from attempt data
2. Query MedicalContent with `guidelineSource != NULL` using semantic search
3. Retrieve top 3 guideline snippets, inject into system prompt
4. Log which guidelines were retrieved per feedback for auditability

---

## Phase 5: Analytics Performance (Week 10) — COMPLETE

### 5.1 Materialized Views for Dashboards (#7) — DONE

**Effort:** 1-2 weeks | **Risk:** Low

> **Implemented:** Migration `20260406130000_phase5_materialized_views` creates 3 views: `user_blueprint_coverage_mv`, `system_accuracy_trend_mv`, `daily_activity_summary_mv` — each with UNIQUE index for CONCURRENTLY refresh. Cron refresh added to `reservoir-maintenance.ts` (Step 5). New endpoint `functions/api/analytics/blueprint-coverage.ts` reads from MV with live-query fallback.

#### Views to Create

- **user_blueprint_coverage_mv:** Per-user, per-system: question count, correct count, accuracy, last_reviewed. Powers blueprint adherence dashboard.
- **system_accuracy_trend_mv:** Per-user, per-system, per-week: accuracy trend. Powers system breakdown charts on ProgressPage.
- **daily_activity_summary_mv:** Per-user, per-day: questions answered, time spent, systems touched. Powers ActivityHeatmap.

#### Refresh Strategy

1. Add REFRESH MATERIALIZED VIEW CONCURRENTLY calls to `functions/api/cron/reservoir-maintenance.ts` (already runs every 2h)
2. Each view needs a UNIQUE index for CONCURRENTLY support
3. Monitor refresh duration (target: < 30 seconds per view)

#### API Changes

1. Create `functions/api/analytics/blueprint-coverage.ts` reading from materialized view
2. Update dashboard components to call new endpoint instead of live aggregation

---

## Phase 6: Infrastructure Cleanup (Weeks 11-12) — COMPLETE

### 6.1 Deprecate Express routes/ (#11) — DONE (removal deferred)

**Effort:** 2-3 days | **Risk:** Medium

> **Implemented:** `routes/index.ts` annotated with per-route migration status ([PORTED], [NOT PORTED], [PARTIAL], [DORMANT]). Comprehensive migration checklist created at `docs/express-to-edge-migration.md` with priority tiers (P0/P1/P2) and step-by-step removal plan. **Only 21% of Express endpoints have Edge equivalents** — full removal blocked on migrating P0 routes (content, questions, analytics, OSCE).

1. Verify every route in `routes/` has an equivalent in `functions/api/` (create a mapping checklist)
2. Switch local dev from `npm run dev:all` to `npm run dev:wrangler` exclusively
3. After 1 week of wrangler-only dev: remove `routes/` directory and `server.ts`
4. Update CLAUDE.md dev commands to remove references to Express

### 6.2 Table Partitioning for ReviewLog (#20) — DEFERRED (BY DESIGN)

**Effort:** 2-3 weeks | **Risk:** Medium-High | **Trigger:** When ReviewLog > 10M rows

> **Status:** Not yet triggered. ReviewLog has not reached 10M rows. BRIN indexes provide sufficient performance for current scale.

This is a future-proofing improvement. Do NOT execute until ReviewLog approaches 10M rows. When ready:

1. Create partitioned table: PARTITION BY RANGE (reviewedAt)
2. Create monthly partitions for current + next 12 months
3. Migrate existing data during maintenance window
4. Add auto-partition creation trigger or monthly cron
5. Test ALL queries against partitioned table before cutover

### 6.3 Axe-Core Accessibility Audit in CI (#16) — DONE

**Effort:** 1 day | **Risk:** Zero

> **Implemented:** `e2e/a11y-regression.spec.ts` (pre-existing) now wired into `.github/workflows/ci.yml` as a step in the `e2e-smoke` job. Checks WCAG 2.1 AA critical + serious violations.

1. Install `@axe-core/react` as devDependency
2. Add to App.tsx in development mode: import and initialize axe-core
3. Create `e2e/accessibility.spec.ts` with Playwright + axe-core for critical routes
4. Add CI step that fails on new WCAG 2.1 AA violations

### 6.4 TanStack Query v5 Standardization (#8) — DONE (incremental rollout)

**Effort:** 1-2 weeks | **Risk:** Low

> **Implemented:** `lib/queryKeys.ts` — centralized query key factory covering 12 domains (analytics, topics, user, SRS, sessions, drills, questions, grandRounds, targetedDaily, content, dashboard, admin). Created 12 TanStack Query hooks in `hooks/queries/` wrapping all 5 SDK clients (user, SRS, drills, sessions, content) plus Goals CRUD and Grand Rounds/Targeted Daily. Fully migrated `GoalsDashboard.tsx` from manual fetch+useState to useQuery/useMutation (removed 4 fetch calls, 1 useEffect, ~120 lines of boilerplate). GrandRounds hooks ready for incremental component adoption. ~301 fetch() calls remain across the codebase for future migration.

Note: TanStack Query v5 is already installed. The work is standardizing all data fetching to use it consistently.

1. Audit all `fetch()` calls and create corresponding `useQuery` hooks
2. Set staleTime strategy: 5min (session data), 15min (user progress), 1hr (reference content)
3. Add `useMutation` with optimistic updates for drill submissions
4. Create query key factories: `queryKeys.drills.all()`, `queryKeys.drills.session(id)`, etc.
5. If SWR dependency exists, remove it after migration

---

## Risk Matrix

| Improvement | Risk Level | Impact if Failed | Mitigation Strategy |
|-------------|-----------|------------------|-------------------|
| #1 FSRS Optimizer | HIGH | Degraded scheduling for affected users | Shadow mode -> A/B test -> gradual rollout. usePersonalizedParams flag for instant rollback. |
| #3 pgvector Search | MEDIUM | Search quality regression | Keep tsvector as fallback. Hybrid search means keyword search always works. |
| #4 Question Review Queue | MEDIUM | Question supply shortage | Auto-approve threshold. Feature flag to bypass gate. Monitor pool health. |
| #11 Deprecate Express | MEDIUM | Dev workflow disruption | 1-week parallel period. Verify all endpoints before removal. |
| #13 Mobile Bottom Nav | MEDIUM | Layout breaks on mobile | Feature flag. A/B test with 10% of mobile users first. |
| #20 Table Partitioning | MEDIUM | Query failures during migration | Staging dry-run. Maintenance window. Query validation suite. |
| #2 Observability | LOW | None (additive) | N/A - purely additive middleware |
| #5 tsvector | LOW | Search regression | Keep ILIKE as fallback during transition |
| #6 BRIN Indexes | ZERO | None | CONCURRENTLY = no table locks |
| #9 Provenance | ZERO | None | Nullable fields, no breaking changes |
| #10 Bundle Budget | ZERO | None | CI-only, no runtime impact |
| #19 Schema Cleanup | LOW | Reference error if missed | Comprehensive grep before dropping |

---

## Success Metrics

| Phase | Metric | Target | How to Measure |
|-------|--------|--------|----------------|
| 1 | Edge function structured log coverage | 100% of endpoints | Grep for structuredLogger wrapper in functions/api/ |
| 1 | BRIN index size reduction | > 15% smaller than equivalent B-tree | pg_relation_size() before/after |
| 1 | Search relevance improvement | ts_rank results match clinical expectations | Manual test: 20 common queries, check top-3 results |
| 2 | Question review queue throughput | < 48h from generation to approval | AVG(validatedAt - createdAt) on PreGeneratedQuestion |
| 2 | Unreviewed questions served in production | 0 | COUNT(*) WHERE validationStatus != 'APPROVED' in session logs |
| 3 | Bundle size | Main < 150KB gzip, total < 1.2MB | CI bundle budget check |
| 3 | Context re-renders reduced | > 30% fewer unnecessary renders | React DevTools profiler before/after Zustand |
| 4 | Semantic search relevance | MI ranks #1 for 'chest pain radiating to jaw' | Automated search quality test suite |
| 4 | FSRS optimizer adoption | > 50% of eligible users within 4 weeks | COUNT(*) WHERE usePersonalizedParams = true |
| 4 | Scheduling accuracy improvement | > 5% Brier score improvement | Compare predicted vs actual retrievability |
| 5 | Dashboard query latency | < 500ms p95 | Sentry span data on dashboard endpoints |
| 6 | WCAG violations in CI | 0 new violations | axe-core CI step pass rate |

---

## Week-by-Week Calendar

| Week | Primary Tasks | Deliverable |
|------|---------------|------------|
| 1 | Structured logging middleware + BRIN indexes + tsvector GIN index creation | All edge functions emit JSON logs; 3 BRIN indexes deployed |
| 2 | tsvector search activation + content provenance fields + UI badges | Library search uses ts_rank; provenance badges visible |
| 3 | AI question review queue: schema + admin endpoints + review UI | Admin can review/approve/reject questions |
| 4 | Review gate enforcement + deprecated schema removal + testing | Only APPROVED questions serve in production |
| 5 | Zustand migration + bundle budget CI setup | 3 contexts migrated to Zustand; CI enforces bundle limits |
| 6 | Mobile bottom nav + Radix UI Dialog/Dropdown adoption | Bottom nav renders on mobile; Dialog/Dropdown use Radix |
| 7 | pgvector extension + embedding column + HNSW index | Database infrastructure ready for vector search |
| 8 | Embedding generation script + batch processing all MedicalContent | > 90% of MedicalContent has embeddings |
| 9 | Hybrid search + FSRS optimizer shadow mode + desired retention UI | Search uses BM25+vector; optimizer logging recommendations |
| 10 | Materialized views + Wilson score + guideline RAG | Dashboard reads from views; FSRS optimizer A/B test begins |
| 11 | Deprecate Express routes + axe-core CI + TanStack Query audit | Dev uses wrangler exclusively; a11y CI step active |
| 12 | TanStack Query standardization + FSRS optimizer full rollout | All data fetching uses React Query; personalized FSRS live |
