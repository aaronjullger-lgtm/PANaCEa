# PANaCEa Skill Library — Engineering Playbook

> **27 skills** across 6 domains. 12 new skills created, 15 existing skills preserved.
> Last updated: 2026-04-03

---

## A. Skill Inventory (Ranked by Reuse Value)

### Tier 1 — Must-Have (use in nearly every cowork chat)

| # | Skill | Purpose | Why It Matters |
|---|-------|---------|----------------|
| 1 | **panacea-dev** | Project architecture, conventions, build commands | Foundation for every chat — sets the rules |
| 2 | **panacea-navigator** | Codebase map, data flows, directory structure | Fastest way to orient in 562+ components |
| 3 | **fsrs-pipeline** | Full FSRS submission flow: telemetry → FSRS → persistence | Core differentiator — most bugs live here |
| 4 | **panacea-verify** | Transpile check, clinical safety grep, import verification | Final gate before any PR |
| 5 | **cf-edge-api** | Cloudflare Edge function patterns, middleware, constraints | Every API change needs this |

### Tier 2 — Best Overall (cover 90% of cowork tasks)

| # | Skill | Purpose | Why It Matters |
|---|-------|---------|----------------|
| 6 | **session-orchestration** ★ | QuizView, DrillShell, reservoir, sync, session state machines | Where students spend 90% of their time |
| 7 | **ai-generation-safety** ★ | Gemini validation, fallbacks, rate limiting, clinical accuracy | Every AI feature needs safety review |
| 8 | **dashboard-trust** ★ | Metric accuracy, chart null-safety, analytics pipeline | Students must trust what they see |
| 9 | **clinical-content-gen** | PANCE blueprint, question schema, Gemini generation constraints | Content is the product |
| 10 | **prisma-data-integrity** ★ | Schema, migrations, RLS, query optimization, edge Prisma | Data errors cascade everywhere |

### Tier 3 — Specialized (use when the domain is in play)

| # | Skill | Purpose | Why It Matters |
|---|-------|---------|----------------|
| 11 | **fsrs-domain** | FSRS v6 algorithm concepts, parameters, behavioral confidence | Deep algorithm work |
| 12 | **panacea-fsrs-wiring** | Hook-level drill→FSRS integration, useDrillFSRS | Wiring new drills |
| 13 | **osce-architect** ★ | OSCE simulation, grading, transcripts, clinical reasoning | Complex standalone subsystem |
| 14 | **clinical-library-search** ★ | Knowledge base, semantic search, embeddings, content enrichment | Currently broken — high priority |
| 15 | **auth-policy-review** ★ | Endpoint auth audit, RLS, Clerk, rate limiting coverage | Security surface is 421 endpoints |
| 16 | **async-state-hardening** ★ | Loading/error/empty/offline states across React components | Most common UX bugs |
| 17 | **model-routing-escalation** ★ | Gemini model selection, cost optimization, escalation chains | AI cost control |
| 18 | **clinical-safety-review** | Medical content accuracy tiers, safety audit checklist | Clinical accuracy is non-negotiable |
| 19 | **perf-bundle-edge** ★ | Bundle size, code splitting, edge cold starts, query perf | Student experience + cost |
| 20 | **ui-primitive-consolidation** ★ | Extract reusable UI primitives from 562 scattered components | Design debt reduction |
| 21 | **react-refactor** | Component decomposition, useState→useReducer, hook extraction | Tactical refactoring |
| 22 | **repo-hygiene** ★ | Duplicate code, dead files, service layer consolidation | Long-term maintainability |
| 23 | **panacea-style-system** | Typography, color, visual hierarchy, progressive disclosure | Design consistency |
| 24 | **vitest-author** | Test patterns, z-score assertions, signal strength math | Test quality |
| 25 | **sprint-pipeline** | End-to-end sprint execution: audit → implement → verify → commit | Multi-day feature work |
| 26 | **panacea-component-sprint** | Four-phase improvement workflow for subsystems | Systematic improvement |
| 27 | **desktop-commander-deploy** | Desktop Commander workarounds for file ops and git | Tooling compatibility |

> ★ = New skill created in this session

---

## B. Full Skill Specs

### 1. session-orchestration ★

| Field | Detail |
|-------|--------|
| **Purpose** | Debug, extend, or review the study session and drill orchestration layer |
| **Use when** | Session bugs, question flow issues, drill wiring, reservoir problems, sync failures, "questions aren't loading" |
| **Don't use when** | FSRS algorithm tuning (use fsrs-domain), chart/metric bugs (use dashboard-trust), UI styling (use panacea-style-system) |
| **Inputs** | Bug report or feature description; session type (MAIN/DRILL/CRAM); affected drill name |
| **Outputs** | Root cause analysis; fix plan; updated wiring checklist if adding drill |
| **Inspect first** | `components/session/QuizView.tsx`, `components/drill/DrillShell.tsx`, `lib/services/reservoir/`, `lib/services/drillReviewService.ts`, `lib/services/sync/syncManager.ts`, `functions/api/drills/submit-review.ts` |
| **Failure modes** | Stale reservoir items, dropped telemetry, sync auth token expiry, rapid-guess false positives, session type misclassification skipping FSRS, concurrent reservation race |
| **Good looks like** | Zero-latency question transitions; every answer persisted with full telemetry; reservoir self-heals below LOW_WATER; drills update FSRS identically to main sessions |
| **Composes with** | fsrs-pipeline, panacea-fsrs-wiring, cf-edge-api |

### 2. ai-generation-safety ★

| Field | Detail |
|-------|--------|
| **Purpose** | Harden every AI generation pipeline: validation, fallbacks, rate limiting, clinical accuracy |
| **Use when** | AI returning bad results, adding new Gemini feature, generation failures, clinical accuracy concerns, cost spikes |
| **Don't use when** | Pure UI work, database-only changes, FSRS algorithm tuning |
| **Inputs** | Failing generation endpoint or new AI feature spec |
| **Outputs** | Validation audit; fallback chain diagram; rate limit verification; fix plan |
| **Inspect first** | `functions/api/_shared/question-generator.ts`, `question-validator.ts`, `analyzeBehaviorGemini.ts`, `functions/api/tutor/chat.ts`, `functions/api/osce/live-engine.ts`, `functions/api/_shared/rateLimiter.ts` |
| **Failure modes** | 429 cascades without backoff, malformed Gemini JSON, hallucinated drug interactions, embedding dimension mismatch, missing fallback on generation endpoint, distractor validation cascade |
| **Good looks like** | Every Gemini call has zod validation + try/catch + fallback; rate limits prevent cost runaway; clinical content passes safety-review; JSON parse errors never crash endpoints |
| **Composes with** | clinical-safety-review, clinical-content-gen, cf-edge-api, model-routing-escalation |

### 3. dashboard-trust ★

| Field | Detail |
|-------|--------|
| **Purpose** | Ensure every displayed metric is accurate, null-safe, and trustworthy |
| **Use when** | Numbers look wrong, charts crash, adding new metrics, analytics pipeline bugs, "the dashboard is blank" |
| **Don't use when** | FSRS algorithm changes, question generation, UI-only styling |
| **Inputs** | Specific metric or chart that's broken; new metric spec |
| **Outputs** | End-to-end trace (DB → API → transform → component); fix for data integrity issue |
| **Inspect first** | `components/dashboard/`, `components/analytics/`, `components/charts/SafeChart.tsx`, `lib/services/analyticsService.ts`, `lib/services/widgetService.ts`, `functions/api/dashboard/`, `functions/api/analytics/` |
| **Failure modes** | Null retrievability crashing recharts, empty session history showing NaN, timezone mismatch in circadian charts, stale widget cache, incorrect streak calculation, aggregation mismatch vs raw data |
| **Good looks like** | Every chart handles empty/loading/error; every metric traces to verified query; aggregations match raw; timezones explicit; cache has TTL |
| **Composes with** | fsrs-pipeline, panacea-verify, cf-edge-api, async-state-hardening |

### 4. osce-architect ★

| Field | Detail |
|-------|--------|
| **Purpose** | Design, review, and fix OSCE clinical simulation flows |
| **Use when** | OSCE mode bugs, grading issues, transcript handling, adding station types, simulation feedback quality |
| **Don't use when** | Standard quiz/drill work (use session-orchestration), question generation (use clinical-content-gen) |
| **Inputs** | OSCE bug report, new station spec, grading rubric concern |
| **Outputs** | Architecture review; grading integrity audit; fix plan; station design template |
| **Inspect first** | `components/osce/`, `functions/api/osce/live-engine.ts`, `lib/osce/clinicalReasoningScaffold.ts`, `types/osce-enhanced.ts`, `config/osce-settings.ts`, `plans/OSCE_REFACTOR_PLAN.md` |
| **Failure modes** | Gemini timeout during live sim, grading inconsistency across attempts, lost transcripts, scoring dimension misalignment, AI patient losing coherence mid-encounter |
| **Good looks like** | Immersive encounter feel; transparent grading rubric; full transcript persistence and replay; graceful timeout handling; scoring matches clinical standards |
| **Composes with** | ai-generation-safety, clinical-content-gen, clinical-safety-review |

### 5. prisma-data-integrity ★

| Field | Detail |
|-------|--------|
| **Purpose** | Database schema correctness, migration safety, query optimization, RLS enforcement |
| **Use when** | Writing migrations, data inconsistencies, slow queries, RLS audit, adding models, "records are missing" |
| **Don't use when** | Frontend-only work, AI generation, UI styling |
| **Inputs** | Migration spec, query performance concern, data integrity bug |
| **Outputs** | Migration with safety checklist; RLS audit results; query optimization plan |
| **Inspect first** | `prisma/schema.prisma`, `prisma/migrations/`, `functions/api/_shared/prisma-edge.ts`, `lib/services/drillReviewService.ts`, `lib/services/reservoir/reservoirService.ts` |
| **Failure modes** | Migration drift between environments, missing RLS on new table, Prisma connection leak on edge, N+1 in list endpoints, stale enum values, missing index on hot query path |
| **Good looks like** | Every migration is backward-compatible; every user-facing table has RLS; every edge function calls safePrismaDisconnect; no N+1 patterns; indexes cover all WHERE clauses |
| **Composes with** | cf-edge-api, auth-policy-review, session-orchestration |

### 6. clinical-library-search ★

| Field | Detail |
|-------|--------|
| **Purpose** | Fix and improve the clinical reference library, knowledge base, and search system |
| **Use when** | Knowledge Base content not loading (CURRENT PRIORITY), search results are bad, adding content types, embedding pipeline issues |
| **Don't use when** | Question generation (use clinical-content-gen), OSCE simulation (use osce-architect) |
| **Inputs** | Search quality issue, content loading bug, new content type spec |
| **Outputs** | Search pipeline diagnosis; embedding health check; content loading fix |
| **Inspect first** | `components/knowledge/`, `components/library/`, `functions/api/search/`, `services/ai/semanticSearchService.ts`, `functions/api/clinical/`, `functions/api/conditions/`, `functions/api/cron/compute-content-health.ts` |
| **Failure modes** | Null embeddings for new content, stale HNSW index, broken condition hierarchy links, search returning irrelevant results, content health score drift |
| **Good looks like** | All content has fresh embeddings; search returns relevant top-3; hierarchy navigation works; content health scores are monitored; Knowledge Base loads reliably |
| **Composes with** | ai-generation-safety, clinical-content-gen, cf-edge-api |

### 7. auth-policy-review ★

| Field | Detail |
|-------|--------|
| **Purpose** | Audit authentication, authorization, and endpoint security across 421 API endpoints |
| **Use when** | Adding new endpoints, 401/403 errors, Clerk issues, RLS verification, rate limiting gaps |
| **Don't use when** | Frontend auth UI (use panacea-dev), FSRS pipeline (use fsrs-pipeline) |
| **Inputs** | New endpoint code, auth error report, security audit request |
| **Outputs** | Endpoint auth coverage report; RLS gap analysis; fix plan |
| **Inspect first** | `functions/api/_shared/auth.ts`, `enhancedMiddleware.ts`, `rbac.ts`, `rateLimiter.ts`, `user-resolver.ts` |
| **Failure modes** | Missing auth on new endpoint, stale JWT handling, webhook signature mismatch, RLS bypass via direct Prisma, admin endpoint without RBAC, unrated AI endpoint |
| **Good looks like** | Every endpoint uses authenticatedEndpoint or aiEndpoint; every user table has RLS; rate limits on all AI endpoints; admin routes check RBAC |
| **Composes with** | cf-edge-api, panacea-verify, prisma-data-integrity |

### 8. async-state-hardening ★

| Field | Detail |
|-------|--------|
| **Purpose** | Systematize loading, error, empty, and offline state handling across React components |
| **Use when** | Blank screens, undefined crashes, adding data-fetching components, "it crashes when there's no data" |
| **Don't use when** | Backend-only work, database changes, AI generation |
| **Inputs** | Crashing component, new data-dependent component spec |
| **Outputs** | Component audit with missing states identified; fix with all 5 states (loading/error/empty/success/offline) |
| **Inspect first** | `components/session/QuizView.tsx`, `components/drill/DrillShell.tsx`, `components/dashboard/`, `components/analytics/`, `components/loading/`, `components/error/`, `hooks/` |
| **Failure modes** | undefined.map(), recharts crashing on null, framer-motion animating unmounted component, stale query cache after session, auth race conditions, silent fetch failures |
| **Good looks like** | Every async boundary has explicit loading/error/empty/success states; react-query with proper staleTime/gcTime; error boundaries at route level; offline indicator |
| **Composes with** | dashboard-trust, react-refactor, panacea-style-system |

### 9. perf-bundle-edge ★

| Field | Detail |
|-------|--------|
| **Purpose** | Optimize frontend bundle size, edge function performance, and database query efficiency |
| **Use when** | App feels slow, bundle growing, edge functions timing out, adding heavy dependency, deployment getting large |
| **Don't use when** | Feature logic bugs, clinical accuracy, auth issues |
| **Inputs** | Performance complaint, new dependency evaluation, build size concern |
| **Outputs** | Bundle analysis report; lazy loading plan; edge function optimization; query performance fixes |
| **Inspect first** | `vite.config.ts`, `wrangler.toml`, `functions/api/_shared/prisma-edge.ts`, `dist/` output, `package.json` |
| **Failure modes** | Edge function CPU timeout, Prisma connection leak, vendor chunk explosion from Three.js/recharts, unused imports in bundle, N+1 queries |
| **Good looks like** | Three.js/anatomy routes lazy-loaded; main bundle < 500KB; edge functions < 1MB; all Prisma connections closed; no N+1 patterns |
| **Composes with** | cf-edge-api, session-orchestration, repo-hygiene |

### 10. model-routing-escalation ★

| Field | Detail |
|-------|--------|
| **Purpose** | Design optimal AI model selection, cost control, and escalation chains |
| **Use when** | Choosing model for new feature, AI costs too high, quality/cost tradeoff decisions, adding extended thinking or streaming |
| **Don't use when** | Non-AI features, frontend styling, database work |
| **Inputs** | New AI feature spec with quality requirements; cost analysis request |
| **Outputs** | Model selection recommendation with cost estimate; escalation chain design; streaming vs batch decision |
| **Inspect first** | `services/ai/`, `functions/api/gemini/`, `functions/api/tutor/chat.ts`, `functions/api/_shared/analyzeBehaviorGemini.ts`, `functions/api/_shared/rateLimiter.ts` |
| **Failure modes** | Using Pro where Flash suffices (~200x cost), missing escalation path (Flash fails → no fallback), no quality gate between models, extended thinking on simple tasks |
| **Good looks like** | Flash-first for all generation; Pro only for vision/medical images; extended thinking only for clinical reasoning; per-user cost tracking; monthly spend under budget |
| **Composes with** | ai-generation-safety, clinical-content-gen |

### 11. ui-primitive-consolidation ★

| Field | Detail |
|-------|--------|
| **Purpose** | Extract and consolidate scattered UI patterns into reusable primitives |
| **Use when** | Duplicate UI across components, inconsistent buttons/cards/modals, planning design system expansion, "make the UI consistent" |
| **Don't use when** | Single-component fixes (use react-refactor), backend work, data pipeline issues |
| **Inputs** | UI inconsistency report; component audit request; new primitive spec |
| **Outputs** | Duplication map; extracted primitive components; migration plan for consumers |
| **Inspect first** | `components/ui/`, `components/shared/`, `components/loading/`, `components/charts/SafeChart.tsx`, `components/drill/`, `components/session/` |
| **Failure modes** | Inconsistent props across variants, missing accessibility, Tailwind class conflicts, hardcoded dimensions, broken responsive behavior |
| **Good looks like** | One button component used everywhere; one card primitive; SafeChart wraps all recharts; clinical safety tiers consistently applied; empty states are a shared primitive |
| **Composes with** | panacea-style-system, react-refactor, async-state-hardening |

### 12. repo-hygiene ★

| Field | Detail |
|-------|--------|
| **Purpose** | Clean duplicate code, dead files, overlapping service layers, structural inconsistencies |
| **Use when** | Repo feels messy, duplicate logic found, build times growing, memory pressure (--max-old-space-size=4096), "why do we have two of these?" |
| **Don't use when** | Active feature development (clean after shipping), urgent bug fixes |
| **Inputs** | Cleanup request; duplication report; pre-refactor audit |
| **Outputs** | Duplication map; dead code inventory; consolidation plan; cleanup PR |
| **Inspect first** | `services/ai/` vs `lib/services/`, `services/domain/`, `routes/` (should be dev-only), `plans/`, `docs/`, root AUDIT_*.md files |
| **Failure modes** | Importing from routes/ instead of functions/api/, duplicate service instantiation (geminiService exists twice), stale type definitions, circular dependencies, dead cron jobs |
| **Good looks like** | One canonical location per service; no dead imports; no duplicate logic; build completes without memory flag; clear README for directory purpose |
| **Composes with** | panacea-dev, panacea-navigator, perf-bundle-edge |

---

## C. Recommended Skill Sets

### 5 Must-Have Skills (use in every cowork chat)

1. **panacea-dev** — Sets the architectural rules
2. **panacea-navigator** — Orients you in the codebase
3. **fsrs-pipeline** — Guards the core differentiator
4. **panacea-verify** — Final quality gate
5. **cf-edge-api** — Edge function correctness

### 10 Best Overall Skills

The 5 must-haves plus:

6. **session-orchestration** — Where students live
7. **ai-generation-safety** — Every AI call needs this
8. **dashboard-trust** — Metric accuracy
9. **clinical-content-gen** — Content is the product
10. **prisma-data-integrity** — Data correctness

### Specialized Skills (use when the domain is active)

- **osce-architect** — OSCE simulation work
- **clinical-library-search** — Knowledge base / search
- **model-routing-escalation** — AI cost optimization
- **auth-policy-review** — Security audits
- **async-state-hardening** — UX resilience
- **perf-bundle-edge** — Performance work
- **ui-primitive-consolidation** — Design system expansion
- **repo-hygiene** — Periodic cleanup
- **vitest-author** — Test writing
- **desktop-commander-deploy** — Tooling workarounds

---

## D. Skill Stacks (Multi-Skill Combinations for Common Tasks)

### Stack 1: Study Engine Correctness
> *"Debug this FSRS regression" / "Drill answers aren't saving"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | panacea-navigator | Orient in the codebase |
| 2 | fsrs-pipeline | Understand the full submission flow |
| 3 | session-orchestration | Trace the session → reservoir → submit path |
| 4 | panacea-fsrs-wiring | Verify hook-level drill integration |
| 5 | panacea-verify | Transpile + safety check after fix |

### Stack 2: AI Generation Safety
> *"Question generation is failing" / "The AI tutor is hallucinating"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | ai-generation-safety | Audit the full AI pipeline |
| 2 | model-routing-escalation | Verify correct model selection |
| 3 | clinical-safety-review | Check clinical accuracy of outputs |
| 4 | clinical-content-gen | Ensure PANCE blueprint compliance |
| 5 | cf-edge-api | Verify edge endpoint patterns |

### Stack 3: Clinical Library Quality
> *"Knowledge Base isn't loading" / "Search results are irrelevant"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | clinical-library-search | Diagnose content/search pipeline |
| 2 | ai-generation-safety | Check embedding generation |
| 3 | prisma-data-integrity | Verify content data and indexes |
| 4 | async-state-hardening | Fix loading/error states in library UI |
| 5 | clinical-content-gen | Audit content completeness |

### Stack 4: OSCE Architecture
> *"OSCE grading is inconsistent" / "Simulation keeps timing out"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | osce-architect | Full OSCE architecture review |
| 2 | ai-generation-safety | Audit Gemini live-engine integration |
| 3 | model-routing-escalation | Verify extended thinking config |
| 4 | clinical-safety-review | Validate grading rubric accuracy |
| 5 | cf-edge-api | Check streaming endpoint patterns |

### Stack 5: Dashboard Trust
> *"The numbers look wrong" / "Chart crashes on empty data"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | dashboard-trust | End-to-end metric audit |
| 2 | async-state-hardening | Fix null/empty/loading states |
| 3 | prisma-data-integrity | Verify source queries |
| 4 | fsrs-pipeline | Confirm FSRS data feeding charts |
| 5 | panacea-verify | Final verification |

### Stack 6: UI Consistency
> *"Make the UI consistent" / "Too many different button styles"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | ui-primitive-consolidation | Identify duplicates, plan primitives |
| 2 | panacea-style-system | Apply design tokens and hierarchy |
| 3 | react-refactor | Decompose bloated components |
| 4 | async-state-hardening | Standardize loading/empty states |
| 5 | panacea-verify | Transpile check after changes |

### Stack 7: Performance Hardening
> *"The app is slow" / "Edge functions are timing out"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | perf-bundle-edge | Bundle + edge + query optimization |
| 2 | cf-edge-api | Edge-specific patterns and limits |
| 3 | prisma-data-integrity | Query performance and connection mgmt |
| 4 | repo-hygiene | Remove dead code reducing bundle |
| 5 | session-orchestration | Optimize hot path (session flow) |

### Stack 8: Repo Cleanup + Maintainability
> *"Clean up the codebase" / "Why do we have duplicate services?"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | repo-hygiene | Map duplicates and dead code |
| 2 | panacea-navigator | Understand canonical locations |
| 3 | panacea-dev | Enforce architecture rules |
| 4 | perf-bundle-edge | Verify cleanup reduces bundle |
| 5 | panacea-verify | Final transpile + import check |

### Stack 9: New Feature Architecture
> *"Plan this new feature" / "Where should this code live?"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | panacea-dev | Architecture rules and conventions |
| 2 | panacea-navigator | Find related existing code |
| 3 | cf-edge-api | API endpoint patterns |
| 4 | prisma-data-integrity | Schema design for new models |
| 5 | auth-policy-review | Auth + RLS for new endpoints |

### Stack 10: Security Audit
> *"Audit our auth" / "Which endpoints are unprotected?"*

| Order | Skill | Role |
|-------|-------|------|
| 1 | auth-policy-review | Full endpoint + RLS audit |
| 2 | cf-edge-api | Middleware patterns |
| 3 | prisma-data-integrity | RLS policy verification |
| 4 | panacea-verify | Automated safety checks |

---

## E. Copy-Paste Skill Prompts

Use these in future cowork chats to invoke skills cleanly.

---

### Study Engine Debugging

```
I need to debug a study engine issue in PANaCEa.

Use skills: session-orchestration + fsrs-pipeline + panacea-fsrs-wiring

The problem: [describe symptom — e.g., "drill answers aren't updating the review schedule"]

Trace the full path from user interaction → DrillShell → useDrillFSRS → submit-review API → drillReviewService → FSRS update → persistence. Identify where the chain breaks.
```

---

### AI Generation Review

```
Review the AI generation pipeline for [feature — e.g., "question generation" / "OSCE simulation" / "Ghost Grader"].

Use skills: ai-generation-safety + model-routing-escalation + clinical-safety-review

Check: schema validation, fallback paths, rate limiting, clinical accuracy, model selection. Flag any endpoint that can crash on malformed Gemini output or has no fallback.
```

---

### Dashboard Metric Audit

```
Audit the [specific metric/chart — e.g., "accuracy trend chart" / "streak counter" / "calibration chart"].

Use skills: dashboard-trust + async-state-hardening + prisma-data-integrity

Trace end-to-end: database query → API transform → component render. Verify null safety, empty state handling, timezone correctness, and that the displayed number matches the raw data.
```

---

### Knowledge Base Fix

```
The Knowledge Base content isn't loading properly.

Use skills: clinical-library-search + ai-generation-safety + async-state-hardening

Diagnose: Is it an embedding issue? API endpoint returning empty? Component not handling loading state? Trace from the search/content API through to the UI component.
```

---

### OSCE Mode Work

```
I need to [fix/extend] the OSCE simulation.

Use skills: osce-architect + ai-generation-safety + model-routing-escalation

Focus on: [grading consistency / transcript handling / station design / timeout handling]. Review the live-engine → transcript → grading → feedback loop.
```

---

### New API Endpoint

```
I'm adding a new API endpoint: [describe endpoint].

Use skills: cf-edge-api + auth-policy-review + prisma-data-integrity

Ensure: correct middleware (authenticatedEndpoint or aiEndpoint), rate limiting if AI-backed, RLS-compatible queries, safePrismaDisconnect in finally block, proper error handling.
```

---

### UI Consistency Sprint

```
Consolidate scattered UI patterns in [area — e.g., "drill components" / "dashboard cards" / "loading states"].

Use skills: ui-primitive-consolidation + panacea-style-system + react-refactor

Audit the area for duplicate button/card/modal/empty-state patterns. Extract shared primitives. Apply design tokens. Verify all 5 async states.
```

---

### Performance Investigation

```
PANaCEa feels slow. Investigate [frontend load time / edge function timeout / specific page].

Use skills: perf-bundle-edge + cf-edge-api + prisma-data-integrity

Analyze: bundle size, lazy loading gaps, edge function CPU time, Prisma connection lifecycle, N+1 queries. Produce a prioritized optimization plan.
```

---

### Migration + Schema Change

```
I need to add [describe schema change — e.g., "new fields on Question model" / "new table for X"].

Use skills: prisma-data-integrity + cf-edge-api + auth-policy-review

Write a safe migration: backward-compatible, with RLS if user-facing, proper indexes, and a backfill plan if needed. Verify edge Prisma compatibility.
```

---

### Repo Cleanup

```
The codebase needs cleanup. Focus on [duplicate services / dead code / import hygiene / service layer consolidation].

Use skills: repo-hygiene + panacea-navigator + perf-bundle-edge

Map all duplicates and dead code. Produce a consolidation plan that preserves the canonical locations defined in panacea-dev. Verify build still passes after changes.
```

---

### Security Audit

```
Audit PANaCEa's API security surface.

Use skills: auth-policy-review + cf-edge-api + prisma-data-integrity

Check every endpoint in functions/api/ for: auth middleware presence, rate limiting on AI endpoints, RLS on user-facing queries, admin RBAC checks. Flag unprotected endpoints.
```

---

### Full Feature Sprint

```
I'm building [feature description] for PANaCEa.

Use skills: sprint-pipeline + panacea-dev + cf-edge-api + prisma-data-integrity + panacea-verify

Follow the sprint pipeline: Phase 0 (audit existing code) → Phase 1 (implement with numbered sprints) → Phase 2 (wire/integrate) → Phase 3 (test) → Phase 4 (verify + commit).
```

---

## Composition Graph

```
                    ┌─────────────────┐
                    │   panacea-dev    │ ← Foundation for everything
                    │ panacea-navigator│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐ ┌────▼─────┐ ┌──────▼──────────┐
    │  cf-edge-api   │ │fsrs-pipe │ │clinical-content  │
    │                │ │  line    │ │    -gen          │
    └───┬───┬───┬────┘ └──┬──┬───┘ └──┬───────┬───────┘
        │   │   │         │  │        │       │
   ┌────▼┐ ┌▼───▼──┐  ┌──▼──▼──┐  ┌──▼───┐ ┌─▼──────────┐
   │auth-│ │prisma- │  │session-│  │osce- │ │clinical-   │
   │poli-│ │data-   │  │orches- │  │archi-│ │library-    │
   │cy   │ │integri-│  │tration │  │tect  │ │search      │
   └─────┘ │ty      │  └────────┘  └──────┘ └────────────┘
           └────────┘
              │
    ┌─────────┼──────────┐
    │         │          │
┌───▼────┐┌──▼─────┐┌───▼──────────┐
│dashbrd-││ai-gen- ││model-routing-│
│trust   ││safety  ││escalation    │
└───┬────┘└────────┘└──────────────┘
    │
┌───▼──────────┐  ┌──────────────┐  ┌────────────┐
│async-state-  │  │ui-primitive- │  │repo-       │
│hardening     │  │consolidation │  │hygiene     │
└──────────────┘  └──────────────┘  └────────────┘

Cross-cutting: panacea-verify, panacea-style-system, react-refactor,
               vitest-author, sprint-pipeline, perf-bundle-edge
```

---

## PANaCEa Strengths Worth Preserving

These are areas where your codebase is unusually strong. Skills should protect and extend these:

1. **FSRS v6 with implicit metrics** — The zero-friction behavioral confidence system (no rating buttons) is research-grounded and well-tested (254 tests). The 8-step confidence pipeline is a genuine competitive advantage.

2. **Reservoir system** — FOR UPDATE SKIP LOCKED for atomic question reservation is production-grade concurrent programming. The policy layer (LOW_WATER/HIGH_WATER/TTL) is clean and configurable.

3. **Cognitive science grounding** — Every confidence module cites research (Bjork, Ratcliff, Dunlosky, Mozer). This isn't cosmetic — the citations inform the algorithm design.

4. **Ghost Grader fallback pattern** — Gemini → local deriveContinuousRating() is the model for all AI integration: always have a local fallback.

5. **Circadian optimization** — Time-of-day modifiers for both stability and par-time are a genuine differentiator for a study app.

6. **Edge-first architecture** — Cloudflare Pages Functions with Prisma Accelerate is modern and cost-effective. The middleware composition pattern is clean.
