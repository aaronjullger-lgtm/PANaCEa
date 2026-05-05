# Canonical Implementation Decisions

Status: integration decisions current as of 2026-05-05 12:03 EDT.

## Product Surfaces

| Concept | Canonical Implementation | Replaced / Deprecated | Rationale |
|---|---|---|---|
| `/study` dashboard | `CommandCenterHub -> CommandCenterWorkspace -> components/dashboard/adaptive/page/DashboardPage.tsx` | `components/dashboard/DashboardPage.tsx`, `UnifiedDashboard`, analytics-dump widget set | The dashboard is now an adaptive clinical command center with a dominant Today card, registry-selected widgets, suppression, visual budgets, and truthful review coverage. |
| Mode discovery | `/practice` plus readiness-gated routes | Old mixed `TrainingMenu`/legacy menu role | `/practice` is the clearest production mode library. `TrainingMenu` remains until a focused route cleanup proves it is safe to remove. |
| System drill UI | `components/session/StudyModeAdaptiveSession.tsx` backed by `CoreAdaptiveSession` | `components/drill/SystemDrillSession.tsx` | System drills should use the canonical session pipeline, telemetry, source identity, and FSRS guardrails. |
| Todoist | CSV export through `TodoistExportPanel` and CSV-only `todoistService` | Client-side OAuth callback/modal and token storage | Direct browser OAuth/token flows are unsafe. Future Todoist integration must be server-side. |

## Learning Pipeline

| Concept | Canonical Implementation | Compatibility / Follow-Up |
|---|---|---|
| Review/FSRS writer | `lib/services/drillReviewService.ts` through `/api/drills/submit-review` and `/api/drills/submit-reviews` | `/api/srs/*` stays as route-shell compatibility and delegates/no-ops rather than owning a second scheduler. |
| Legacy SRS idempotency | `/api/srs/submit` forwards `attemptId` as `idempotencyKey` to `submitDrillReview` | Add runtime replay smoke after browser consumers are confirmed. |
| Offline review drain | `syncManager.syncAll()` is the awaitable drain point for answers, pearl actions, and reviews | Immediate category-specific syncs were replaced by `syncAll()` calls to avoid summary/progress races. |
| Attempt endpoint | `/api/questions/attempt` remains stats/attempt persistence only | It must not schedule review concepts or write a second FSRS path. |
| Study plan truth | Current writer remains `DailyStudyPlan.recommendedSessions` JSON plus compatibility route normalization | New normalized `StudyPlan`/`StudyPlanItem` tables are not authoritative until dual-write/parity tests exist. |
| Question identity | Existing mirror helpers are transitional | Launch-safe version requires a source identity migration/backfill before relying on generated/pre-generated IDs broadly. |
| Progress concept identity | `UserProgress.conditionId` is treated as legacy `MedicalContent.id` identity | A migration should rename/add `medicalContentId` and map true `Condition.id` separately. |

## Backend And AI

| Concept | Canonical Implementation | Replaced / Deprecated |
|---|---|---|
| Production endpoint layer | `functions/api/*` Cloudflare Pages Functions | Local `routes/` remains non-production unless explicitly wired. |
| AI gateway rate limiting | Gateway middleware `ai` tier plus per-endpoint AI wrappers | Admin AI routes are now explicitly classified as `ai` before `/api/admin/`. |
| Generated question serving | Generated questions must stage/persist with provenance before becoming learner-submittable | Review-held `202 requiresApproval` responses are not usable session questions. |
| Library answer failures | Secure logs retain details; public response returns generic failure | Raw DB/vector/AI error messages must not leave public APIs. |
| Health checks | `/api/health` is public liveness only; authenticated/admin readiness belongs to `/api/admin/readiness` | Docs and scripts must not expect DB/auth/cache diagnostics from public liveness. |

## Verification Gates

| Gate | Canonical Command | Notes |
|---|---|---|
| Focused unit regression | `npx vitest run <changed suites>` | Run after each slice. |
| Typecheck | `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck` | Required before commit readiness. |
| Lint | `npm run lint` | Existing raw-color warnings are tracked separately. |
| Build | `npm run build` | Required before commit readiness. |
| Health smoke | `npm run verify:health` | Now uses `playwright.wrangler.config.ts`; requires Wrangler server or `BASE_URL`. |
| Production smoke | `npm run test:e2e:production-smoke` | Requires live/runtime credentials and test data. |
