# PANaCEa: Post-Sprint Integration & Improvement Plan

**Date**: April 12, 2026  
**Scope**: Audit of Sprints 1–12 (two sessions), code quality fixes, production wiring, and remaining pa4.md gaps  
**Guiding docs**: pa4.md gap analysis, CLAUDE.md current priorities, SKILL-ROUTING-QUICK.md, panacea-navigator, sprint-pipeline, cf-edge-api, panacea-fsrs-wiring, session-orchestration

---

## Executive Summary

Sprints 1–12 produced **12 new services with 263+ new tests**, covering all P0–P3 items from pa4.md. However, **8 of 12 services are isolated** — they pass tests but are not wired into any production code path. The code is a library on a shelf.

Three work streams are needed:

1. **Harden** (fix 17 code quality issues across 7 services)
2. **Wire** (integrate isolated services into production pipelines)
3. **Extend** (address remaining pa4.md gaps and CLAUDE.md priorities)

---

## Phase 1: Code Quality Hardening

**Goal**: Fix all critical and high-priority bugs before any production wiring.  
**Estimated sprints**: 2 (Sprint 13–14)  
**Skills**: `panacea-verify`, `vitest-author`

### Sprint 13: Critical Fixes (3 bugs)

| Service | Issue | Fix |
|---------|-------|-----|
| `contextualBanditService.ts` | ε-greedy mutates `scored[]` during iteration (`ucbScore += 1000`) | Deep-copy the promotion targets or use a separate promotion set; select from copy |
| `habitFormationService.ts` | `scheduleAt()` mutates input `Date` via `setHours()` | Clone: `const deferred = new Date(now.getTime())` |
| `cragGuardrailService.ts` | Score accumulation exceeds 1.0 (base + bonuses = up to 1.13) | Clamp final score: `Math.min(1.0, adjustedScore)` after all bonuses |

### Sprint 14: High-Priority Fixes (5 bugs) + Medium Sweep

| Service | Issue | Fix |
|---------|-------|-----|
| `prerequisiteGraphService.ts` | No validation that node IDs exist before creating edges | Add `existingNodeIds: Set<string>` parameter; filter edges against it |
| `prerequisiteGraphService.ts` | Hardcoded `CROSS_SYSTEM_PREREQUISITES` — no update path | Extract to a JSON config file loadable from KV or Prisma |
| `illnessScriptService.ts` | `splitClinicalList()` 100-char threshold arbitrary; `buzzwordSet` lacks null-safety | Add `.filter(Boolean)` on buzzwords array; document the 100-char heuristic or make configurable |
| `contextualBanditService.ts` | No NaN/Infinity guards on context vectors | Add `isFinite()` check in `contextToVector()`; replace NaN with 0.5 default |
| `learnerClusteringService.ts` | `sortedDists[1]!` assumes array length ≥ 2 | Guard: `sortedDists.length >= 2 ? margin : 0` |

**Medium fixes** (batch): bounds checking in `rerankService.ts`, timezone validation in `habitFormationService.ts`, consistent `noUncheckedIndexedAccess` handling across all 7 files.

**Verification**: Re-run all 263 new tests + full suite. No regressions.

---

## Phase 2: Production Wiring

**Goal**: Connect isolated services to live code paths so they actually run.  
**Estimated sprints**: 5 (Sprint 15–19)  
**Skills**: `cf-edge-api`, `session-orchestration`, `panacea-fsrs-wiring`, `panacea-navigator`, `dashboard-trust`

### Sprint 15: Wire CRAG + Reranker into RAG Pipeline

**Current state**: `ragContextService.ts` retrieves chunks → passes directly to LLM. No quality evaluation or reranking.

**Integration plan**:
1. In `ragContextService.ts`, after `retrieveContext()`:
   - Call `rerankPipeline()` from `rerankService.ts` to reorder chunks
   - Call `evaluateRetrieval()` from `cragGuardrailService.ts` to assess quality
2. Route based on CRAG action:
   - `CORRECT` → proceed with reranked context
   - `AMBIGUOUS` → prepend caution prefix to LLM prompt
   - `INCORRECT` → fall back to prompt-only generation (no RAG context)
3. Log `ContentGapSignal` from CRAG to a new `ContentGap` Prisma model for knowledge base improvement

**Files touched**: `lib/services/ragContextService.ts`, `functions/api/questions/generate-rag.ts`  
**New file**: `prisma/migrations/YYYYMMDD_add_content_gap_log.sql` (⚠️ migration — needs Aaron's approval)

### Sprint 16: Wire Contextual Bandit into Question Selector

**Current state**: `conceptQuestionSelector.ts` selects questions by overdue ratio + blueprint weights. No explore-exploit optimization.

**Integration plan**:
1. After `fetchDueReviews()` + `fetchNewCards()` assemble the candidate pool, call `buildBanditArm()` for each candidate
2. Call `selectQuestions()` to rerank by UCB score instead of simple overdue ordering
3. Store `BanditState` per-user in a new `UserBanditState` Prisma Json field on `UserPreferences` (or KV cache)
4. After session completes, call `batchUpdateBanditState()` with rewards from `QuestionAttempt` results
5. Integrate into `drillReviewService.ts` response path: after FSRS update, compute `learningProgressBonus` from ΔP(correct) and queue bandit reward

**Files touched**: `lib/services/conceptQuestionSelector.ts`, `lib/services/drillReviewService.ts`  
**Schema change**: Add `banditState Json?` to `UserPreferences` (⚠️ migration — needs Aaron's approval)

### Sprint 17: Wire Learner Clustering + Early Warning into Dashboard

**Current state**: Dashboard shows historical metrics but no behavioral archetype or risk alerts.

**Integration plan**:
1. Create `functions/api/analytics/learner-profile.ts` endpoint:
   - Fetch `UserStudyPhenotype`, `UserLearningProfile`, `UserRolling360Stats`, `DailyUserAnalytics`
   - Map to `LearnerFeatures` → call `assignArchetype()`
   - Map to `WarningInput` → call `detectWarnings()`
   - Return `LearnerAnalysis` (cluster + warnings + riskScore)
2. Create `components/dashboard/LearnerInsightsCard.tsx`:
   - Display archetype badge with description
   - Show warnings sorted by severity with actionable recommendations
   - Show risk score gauge
3. Register in `config/appViews.ts` and `config/lazyComponents.tsx`

**Files touched**: New endpoint + new component + config registration  
**No schema changes needed** — consumes existing models

### Sprint 18: Wire Habit Formation into Notification Cron

**Current state**: `public/sw.js` has push notification handlers. No server-side scheduling or subscription management.

**Integration plan**:
1. Create `functions/api/cron/send-notifications.ts`:
   - Iterate active users with push subscriptions
   - Build `HabitProfile` from `UserStudyPhenotype` + `UserProgress` + `DailyUserAnalytics`
   - Call `generateCandidateNotifications()` → `throttleNotifications()`
   - Dispatch via Web Push API (requires `web-push` package — ⚠️ production dependency, needs Aaron's approval)
2. Create `functions/api/notifications/subscribe.ts` — stores push subscription
3. Create `functions/api/notifications/preferences.ts` — quiet hours, max frequency
4. Add Prisma models: `PushSubscription`, `NotificationLog` (⚠️ migration — needs Aaron's approval)

**Frontend**: Add notification opt-in flow in Settings + subscription registration via `navigator.serviceWorker`

### Sprint 19: Wire Illness Script + Prerequisite Graph into Frontend

**Current state**: Both have API endpoints but no frontend consumers.

**Integration plan**:
1. **Illness Script UI** (`components/library/IllnessScriptView.tsx`):
   - Fetch from `GET /api/conditions/illness-script?conditionId=...`
   - Three-panel layout: Enabling Conditions → Fault → Consequences
   - Comparison mode for DDx (side-by-side two conditions)
   - Completeness indicator showing gaps
   - Link from condition detail pages in the clinical library
2. **Prerequisite Graph Visualization** (`components/dashboard/PrerequisiteGraphView.tsx`):
   - Fetch GraphNode + GraphEdge data
   - D3 force-directed graph or Recharts tree
   - Color nodes by mastery level (green/yellow/red)
   - Show SEMANTIC prerequisite edges with weights
3. Register both in `config/appViews.ts` + `config/lazyComponents.tsx`
4. Add routes in the clinical library and dashboard navigation

---

## Phase 3: Extend (Remaining Gaps + CLAUDE.md Priorities)

**Goal**: Address highest-ROI remaining gaps from pa4.md and current CLAUDE.md priorities.  
**Estimated sprints**: 6 (Sprint 20–25)  
**Skills**: `clinical-content-gen`, `fsrs-pipeline`, `session-orchestration`, `panacea-component-sprint`

### Sprint 20: Daily Study Load Recommendations

**pa4.md gap**: "Daily study load recommendations (15–20 new cards/day)" — ❌ NOT IMPLEMENTED  
**CLAUDE.md priority alignment**: Supports question generation for under-represented areas

**Plan**:
- Add `dailyLoadRecommendationService.ts`:
  - Input: `UserStudyPhenotype` (avgDailyQuestions, burnoutRisk), `UserProgress` (cards due), blueprint gaps
  - Output: recommended new card count (capped by fatigue), recommended review count, system priority order
  - Research: 15–20 new cards/day optimal for long-term retention (Kornell 2009)
- Surface in dashboard as "Today's Study Plan" card
- Feed into reservoir policy to cap `NEW_STANDARD` priority items

### Sprint 21: Content Quality Feedback Loop (Psychometric Item Analysis)

**pa4.md gap**: "Psychometric item analysis (discrimination index, point-biserial)" — ❌ NOT IMPLEMENTED  
**pa4.md gap**: "Distractor analysis (non-functioning distractor flagging)" — ❌ NOT IMPLEMENTED

**Plan**:
- Add `itemAnalysisService.ts`:
  - Compute per-question: discrimination index (D), point-biserial correlation (rpb), distractor selection rates
  - Flag items: D < 0.10 (non-discriminating), negative rpb (penalizes knowledgeable students), distractors selected < 5% (non-functioning)
  - Requires minimum 30 attempts per question
- Add `functions/api/cron/compute-item-metrics.ts` — batch computation, store in `ContentStatistics`
- Surface in admin panel for content review queue

### Sprint 22: Self-Refine Loop for Question Generation

**pa4.md gap**: "Self-refine loop (draft → critique → rewrite)" — ❌ NOT IMPLEMENTED

**Plan**:
- Extend `generate-rag.ts` pipeline:
  1. **Draft**: Current Gemini Flash generation (unchanged)
  2. **Critique**: Second Gemini call evaluating: clinical accuracy, distractor plausibility, Bloom's level alignment, stem clarity, answer homogeneity
  3. **Rewrite**: If critique identifies issues, re-generate with critique feedback injected into prompt
- Gate: only run self-refine for difficulty ≥ 3 or third-order questions (cost optimization)
- Log refinement stats to track improvement rate

### Sprint 23: Error Pattern Classification

**pa4.md gap**: "Error pattern classification (anchoring, premature closure)" — ❌ NOT IMPLEMENTED

**Plan**:
- Add `errorPatternService.ts`:
  - Classify incorrect answers by cognitive bias pattern:
    - **Anchoring**: first answer selected quickly, never changed despite contradicting info
    - **Premature closure**: correct first click → switched to wrong answer (answered too early in vignette)
    - **Availability bias**: chose condition seen recently over statistically more likely one
    - **Confirmation bias**: consistently wrong on DDx questions where two conditions share features
  - Uses existing telemetry: `timeToFirstClick`, `answerSwitches`, `commitmentGapMs`, confusion pairs
- Surface patterns in learning profile dashboard with targeted remediation suggestions

### Sprint 24: Forgetting Curve Projection to Exam Date

**pa4.md gap**: "Forgetting curve projection to exam date" — ❌ NOT IMPLEMENTED  
**pa4.md gap**: "Exam readiness gap (projected vs required)" — partially addressed by `readinessProjectionService.ts`

**Plan**:
- Extend `readinessProjectionService.ts`:
  - Add `projectToExamDate(userId, examDate)`: for each system, project retrievability at exam date using FSRS power-law decay
  - Compute: "If you stop studying today, projected PANCE score = X. If you maintain current pace, projected = Y."
  - Generate per-system intervention plan: "Cardiovascular needs 45 more reviews before exam to reach 0.85 target"
- Surface as "Exam Countdown" widget on dashboard with projected score trajectory chart

### Sprint 25: FIRe Implicit Review Compression

**pa4.md gap**: "FIRe implicit review compression" — ❌ NOT IMPLEMENTED  
**Builds on**: Sprint 6 prerequisite graph edges

**Plan**:
- Add `fireCompressionService.ts`:
  - When a student reviews "CHF Treatment" (high-level), propagate partial credit to prerequisite nodes: "Cardiac Physiology", "Hemodynamics", "Diuretic Pharmacology"
  - Credit = parent_review_grade × edge_weight × decay_factor
  - Penalty path: failing a child node penalizes parent stability (if you forget pharmacology, your treatment knowledge is suspect)
  - Integrates into `drillReviewService.ts` response path, after FSRS update
- Reduces total review load by ~15-25% (FIRe paper estimate) by crediting related concepts

---

## Phase 4: CLAUDE.md Priority Alignment

These are the 5 current priorities from CLAUDE.md that the above phases don't fully cover:

| Priority | Status | Plan |
|----------|--------|------|
| Generate questions for CV/PULM gaps | Addressed by Sprint 20 (daily load recs) + existing `generate-rag.ts` | Run a batch generation targeting CV + PULM systems specifically |
| QuizView refactor (`wip/quizview-refactor-parked`, 192 TS errors) | NOT addressed above | Separate effort: `react-refactor` skill, estimated 3–4 sprints |
| Fix Knowledge Base content loading | NOT addressed above | Separate effort: `clinical-library-search` skill |
| Resolve drill routing split (DrillShell vs useDrillFSRS) | NOT addressed above | Separate effort: `panacea-fsrs-wiring` + `session-orchestration` skills |
| Optimize skill descriptions | NOT addressed above | Separate effort: `skill-creator` skill |

**Recommendation**: Phases 1–2 (hardening + wiring) should happen before tackling the QuizView refactor, since the refactor will touch session orchestration files that Phase 2 also modifies. Doing wiring first avoids merge conflicts.

---

## Dependency Graph

```
Phase 1 (Sprint 13-14): Hardening
  └─> Phase 2 (Sprint 15-19): Wiring
       ├─> Sprint 15: CRAG + Reranker → RAG pipeline
       ├─> Sprint 16: Bandit → Question selector
       │     └─> requires Sprint 15 (bandit rewards need working RAG)
       ├─> Sprint 17: Clustering → Dashboard (independent)
       ├─> Sprint 18: Notifications → Cron (independent, needs approval for web-push dep)
       └─> Sprint 19: Illness Script + Graph → Frontend (independent)
  └─> Phase 3 (Sprint 20-25): Extensions
       ├─> Sprint 20: Daily load recs (independent)
       ├─> Sprint 21: Item analysis (independent)
       ├─> Sprint 22: Self-refine loop (depends on Sprint 15 for RAG pipeline)
       ├─> Sprint 23: Error patterns (independent)
       ├─> Sprint 24: Forgetting curve projection (depends on Sprint 16 for bandit data)
       └─> Sprint 25: FIRe compression (depends on Sprint 19 for graph viz)
```

---

## Decisions Requiring Aaron's Approval

| Decision | Sprint | Type |
|----------|--------|------|
| Prisma migration: `ContentGap` model | 15 | Schema change |
| Prisma migration: `banditState` on `UserPreferences` | 16 | Schema change |
| Prisma migration: `PushSubscription` + `NotificationLog` | 18 | Schema change |
| Production dependency: `web-push` npm package | 18 | New dependency |
| Cross-system prerequisites: extract to config vs keep hardcoded | 14 | Architecture |

---

## Summary

| Phase | Sprints | Files | Goal |
|-------|---------|-------|------|
| **1. Harden** | 13–14 | ~7 existing files | Fix 17 bugs (3 critical, 5 high, 9 medium) |
| **2. Wire** | 15–19 | ~12 new + ~8 modified | Connect 8 isolated services to production |
| **3. Extend** | 20–25 | ~12 new + ~6 modified | Close highest-ROI pa4.md gaps |
| **4. Align** | TBD | varies | CLAUDE.md priorities (QuizView refactor, KB loading, drill routing) |

**Total estimated effort**: 13 sprints across 4 phases.  
**Highest-ROI first action**: Phase 1 (hardening) — 2 sprints, zero new features, prevents production bugs.
