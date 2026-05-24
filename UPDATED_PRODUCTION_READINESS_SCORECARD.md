# Updated Production Readiness Scorecard

> Last synchronized: 2026-05-23
> Based on: CONTINUATION_REVIEW.md, NEXT_WORK_DISCOVERY.md, PRODUCTION_ACCEPTANCE_REPORT.md, CHANGE_INTEGRATION_LOG.md, CONTINUATION_IMPLEMENTATION_LOG.md
>
> **Overall status:** Almost ready — all local gates pass; live Cloudflare/Clerk/Postgres smoke is the remaining launch blocker.

## Readiness by Subsystem

### Build & Verification

| Gate | Status | Evidence | Remaining Risk |
|------|--------|----------|----------------|
| `typecheck` (production gate) | ✅ Pass | `tsconfig.production.json` | `typecheck:all` has 1,654 lines of historical drift (admin, cron, DDX, exam, gamification) |
| `typecheck:ci` | ✅ Pass | CI gate | — |
| `lint` | ✅ Pass | 0 errors, 422 raw-color/design-token warnings | Token migration tracked separately |
| `build` | ✅ Pass | Production build completes | Bundle size at budget ceiling |
| `build:check-size` | ✅ Pass | Rebaselined budget | Chunk splitting still needed |
| `test:critical` | ✅ Pass | 142 tests across 6 files | Full suite (9,570 tests) not run in most slices |
| `npm test` (full) | ✅ Pass | 501 files, 9,570 tests (last run 2026-05-05) | — |
| `npm audit --omit=dev` | ✅ Pass | 0 vulnerabilities | — |
| `git diff --check` | ✅ Pass | Clean diff per slice | Uncommitted user work present in tree |

### API / Backend (Cloudflare Edge)

| Function | Status | Evidence | Remaining Risk |
|----------|--------|----------|----------------|
| Auth middleware | ✅ Production | `authenticatedEndpoint` wrapper, Clerk backend | Live Clerk smoke not run |
| Gateway (AI routing) | ✅ Hardened | Admin enrichment, condition cards, explanations, library answers all migrated to gateway | Deep generation still uses raw text JSON parsing |
| Question generation — primary | ✅ Fail-closed | `stageGeneratedQuestionPreview`, staging-first, 502 on staging fail | Schema not yet canonical across generation paths |
| Question generation — RAG | ✅ Fail-closed | Same shared preview/staging helper | — |
| Question generation — enhanced | ✅ Fail-closed | CoVe gate + staging-first before live promotion | Separate CoVe/live-promotion schema path |
| Question generation — deep | ✅ Admin-only | `persistence: "admin_preview_only"` | Text JSON parsing; must stay hidden from learners |
| Question attempt/record | ✅ Hardened | `withProductionQuestionSafety` filter | Canonical source identity migration still needed |
| Question context | ✅ Hardened | Uses production safety filter + internal user IDs | — |
| Due-sibling variant seeding | ✅ Hardened | Production filters for pre-gen and canonical originals | — |
| Explanation generation | ✅ Hardened | `gateway.callStructured` + Zod schema + fail-closed | Consumer UI for unavailable states unproven |
| Structured condition cards | ✅ Hardened | `gateway.callStructured` + `StructuredConditionSchema` | — |
| Library answer | ✅ Hardened | `gateway.callText` + shared `getEmbedding` helper | Embedding helper does direct provider call |
| Admin enrichment | ✅ Hardened | `gateway.callStructured` + `EnrichmentResponseSchema` | Admin-only AI-generated clinical content |
| Library/RAG embeddings | ✅ Consolidated | 5 services now share `getEmbedding` helper | Backfill/evaluation paths still handle separately |
| Study plan — route scoping | ✅ Hardened | Single-system tasks emit `mode=system` | Multi-system tasks still default to adaptive |
| Study plan — task modes | ✅ Hardened | No hidden `rapid_recall` leakage | Full V2 contract not yet consolidated |
| Rate limiting | ✅ Active | `RATE_LIMIT_KV` namespace | Live behavior unverified |
| Content caching | ✅ Active | `CACHE` KV namespace | Live behavior unverified |
| Legacy exam/OSCE endpoints | ✅ Gated | Feature-disabled by default | Old behavior behind explicit feature flags |
| Live runtime smoke | ❌ Not run | No Cloudflare/Clerk/Postgres end-to-end smoke | **P1 launch blocker** |

### Session / FSRS Pipeline

| Function | Status | Evidence | Remaining Risk |
|----------|--------|----------|----------------|
| FSRS v6 algorithm | ✅ Production | 21 params, `lib/fsrs.ts` | 3,200+ tests protecting it |
| Implicit rating | ✅ Production | Binary Again/Good, MVRT rapid-guess filtering | Ghost Grader override risk low |
| Confidence pipeline | ✅ Production | 15-stage pipeline, Wave 1-3 signals | — |
| Drill review submission | ✅ Canonical | `drillReviewService` is sole writer | Non-atomic writes across QuestionAttempt/ReviewLog/UserProgress |
| Main session submission | ✅ Hardened | `syncManager` token + idempotency | — |
| Legacy `/api/srs/*` | ⚠️ Compat only | Adapters delegate to `submitDrillReview` | Remove after runtime compatibility proven |
| Session summary sync | ✅ Hardened | `syncAll()` drains in-flight + fresh pending | — |

### Data Integrity / Prisma

| Function | Status | Evidence | Remaining Risk |
|----------|--------|----------|----------------|
| Production question lifecycle filter | ✅ Applied | `withProductionQuestionSafety` predicate | Canonical source identity migration pending (P0) |
| Canonical question/source identity | ❌ P0 | No `source` column in `Question` | Historical attempts/sessions unprovable end-to-end |
| Condition/content identity | ❌ P0 | No explicit `medicalContentId` on `UserProgress` | Progress rows may point at wrong concept domain |
| StudyPlanTask V2 consolidation | ⚠️ P1 partial | Partially normalized | Multi-system/review task contracts still split |
| Generated-question canonical schema | ⚠️ P1 partial | Primary/RAG use shared preview/staging helper | Enhanced/deep/batch still fragmented |
| Pending Prisma migrations | ⚠️ Approval | 7 migrations drafted, awaiting Aaron's OK | 0 orphans on FK probe (2026-04-17) |
| Prisma client in browser | ✅ Guarded | Vite plugin stubs `@prisma/client` | — |
| Edge `safePrismaDisconnect` | ✅ Enforced | All Edge functions | — |

### Frontend / UI

| Function | Status | Evidence | Remaining Risk |
|----------|--------|----------|----------------|
| Adaptive dashboard | ✅ Production | `CommandCenterHub → AdaptiveDashboardPage` | Legacy dashboard widgets removed |
| Study modes | ✅ Launch candidates | `core_adaptive`, `system_drill` ready | Other modes hidden/deferred |
| Drill modes (13 types) | ✅ Active | All wired through `DrillShell` + `useDrillFSRS` | DrillShell vs. useDrillFSRS routing split unresolved |
| QuizView | ⚠️ Parked | `wip/quizview-refactor-parked`: 192 TS errors | Large component, state rewiring needed |
| Offline/PWA | ✅ Active | `vite-plugin-pwa`, cache v12 | Offline sync regression suite minimal |
| Design tokens | ⚠️ P2 | 422 raw-color/design-token warnings | Separate token migration needed |
| Bundle performance | ⚠️ P2 | Within budget ceiling | Chunk splitting and route-level splitting still needed |

### Content / Medical Database

| Function | Status | Evidence | Remaining Risk |
|----------|--------|----------|----------------|
| Question pool | ✅ Active | Reservoir with queue + priority | Blueprint coverage gaps (CV, PULM) |
| Clinical content | ⚠️ Partial | Schema exists | Provenance/citations incomplete |
| Seed content | ⚠️ Partial | Database-first architecture | Not launch-grade for all organ systems |
| Medical database integrity | ⚠️ Partial | `MEDICAL_DATABASE_FINAL_REPORT.md` | Canonical identity/citations weak |

### Deployment / CI

| Function | Status | Evidence | Remaining Risk |
|----------|--------|----------|----------------|
| CI pipeline | ✅ Active | GitHub Actions → Cloudflare Pages | — |
| `npm run deploy:local` | ⚠️ Needs approval | Builds + deploys to Cloudflare | Pending migration application |
| CSP / security headers | ✅ Active | `public/_headers` | — |
| KV namespace bindings | ✅ Configured | `RATE_LIMIT_KV`, `CACHE` | Production parity unverified |
| Environment variables | ✅ Documented | `.env.example` | Public `VITE_*` values in `wrangler.toml` need review |

## Score Summary

| Tier | Count | Subsystems |
|------|-------|------------|
| ✅ Production-ready | 28 | Build, typecheck, lint, test, auth middleware, gateway-migrated routes, FSRS, implicit rating, sync, dashboard, drills, Edge safety |
| ⚠️ Partial / needs work | 12 | QuizView refactor, StudyPlanTask V2, generated-question schema, P0 identity migrations, pending migrations, content provenance, design tokens, bundle, PWA tests |
| ❌ Not done / P0 | 2 | Canonical source identity migration, condition concept identity migration |
| 🔴 Launch blocker | 1 | Live Cloudflare/Clerk/Postgres runtime smoke suite execution |

## Go-Live Prerequisites

1. **Execute production-smoke suite** against Wrangler or Cloudflare preview with Clerk E2E credentials
2. **Verify Cloudflare production env parity**: DB URL, Clerk key, KV bindings, AI keys
3. **Resolve canonical source identity** (P0 migration) before historical data becomes unprovable
4. **Resolve condition concept identity** (P0 migration) for progress/review correctness
5. **Apply pending Prisma migrations** after Aaron approval
6. **Finish or shelve QuizView refactor** (192 TS errors on parked branch)
