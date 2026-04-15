# PANaCEa — Comprehensive Improvement & Study App Improvement Plan

## Executive Summary

PANaCEa ([github.com/aaronjullger-lgtm/PANaCEa](https://github.com/aaronjullger-lgtm/PANaCEa)) is a sophisticated adaptive clinical education platform built by a solo PA-S2 developer. The platform combines FSRS v6 spaced repetition, implicit behavioral metrics, NCCPA blueprint-aligned question generation, and AI-powered clinical simulations. The codebase is substantial — 580+ React components, 81+ Cloudflare Edge API endpoints, 60+ Prisma models, and 3200+ passing tests across 205/213 test files. This plan identifies improvements in priority order, drawing directly from the open issues, current sprint state, plans directory, and the attached dynamic study path proposal.

***

## Current State Snapshot

| Dimension | Current Status |
|-----------|---------------|
| Core FSRS pipeline | ✅ Functional — implicit-only, binary Again/Good |
| Test suite | 205/213 files pass, 3200+/3219 tests pass |
| TypeScript errors | `wip/quizview-refactor-parked` has 192 TS errors |
| Master sprint plan | Sprints 1–6 ✅ complete; Sprint 7 (polish + content) remaining |
| Open blockers | FSRS session UI completeness (Issue #210); QuizView refactor parked |
| Pending migrations | `ContentGap`, `banditState`, `PushSubscription` models await approval |
| Active branches | 20+ open `copilot/` and `codex/` branches, many unmerged |
| Repository images | Large JPEG screenshots committed directly to repo root (~1–2 MB each) |

***

## Priority 1 — Unblock the Core Product

This is the highest-ROI work. Nothing else matters until the main FSRS study session is fully functional and polished.

### 1.1 Resolve QuizView Refactor

The `wip/quizview-refactor-parked` branch has 192 TypeScript errors in state management and button primitives. This is the most critical blocker for any production deployment. The resolution path:

- **Audit the type errors** — Run `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` against the branch and triage errors into categories (state shape mismatches, missing types, import errors).
- **Rewire state + button primitives** — The `CLAUDE.md` identifies this as needing state + button primitive rewiring specifically; focus first on Zustand store type alignment, then the interactive UI primitives.
- **Do not rewrite from scratch** — The refactor branch likely holds significant improvements. Resolve type errors incrementally, file by file, starting with `QuizView.tsx` (2045 lines).
- **Validation gate:** Zero TypeScript errors and all 3200+ tests passing before merging to `main`.

### 1.2 Complete DEV-003: FSRS Session UI (Issue #210)

Issue #210 is the immediate next production priority after DEV-001/DEV-002 merge. The specific gaps to close:

- **FSRS state machine round-trip** — Verify the DB reflects correct `state`, `stability`, `difficulty`, and `due` date after a `submit-review` call. Write integration tests that walk the state progression: New → Learning → Review.
- **Session queue logic audit** — Confirm cards are ordered by `due ASC`, new cards are correctly interleaved, and a just-reviewed card is not immediately re-shown unless it is a lapse relearn.
- **Rating button UX** — Show projected next-due intervals on each button (e.g., "Good — 3d"), disable immediately on tap to prevent double-submit, show loading state during API call.
- **Session completion flow** — The end-of-session screen must show stats (cards reviewed, retention rate, time spent) with no infinite spinner or blank screen.
- **Card layout polish** — Correct font sizing, smooth answer reveal, visible progress bar or counter, and verified mobile viewport compatibility at 375px minimum.
- **Rapid guess UX** — When a rapid guess is detected (below MVRT thresholds), the UI should not show rating buttons since it auto-grades as `Again`.

### 1.3 Resolve Drill Routing Split

The CLAUDE.md identifies an unresolved architectural decision between `DrillShell` and `useDrillFSRS` for which drill types consolidate. Pick one canonical path (recommendation: `useDrillFSRS` → `submit-review` since it's already wired for 13 active drill types) and document the decision in `CLAUDE.md` to prevent future ambiguity.

***

## Priority 2 — Repository Hygiene

These are high-impact, low-risk improvements that reduce cognitive overhead and keep the codebase clean.

### 2.1 Merge or Close Stale Branches

There are 20+ open `copilot/` and `codex/` AI-agent branches, many of which are likely stale or superseded by `main`. A cluttered branch list makes it hard to track real work-in-progress. The action plan:

1. Run `git branch -r --merged main` to identify branches already incorporated.
2. For unmerged branches, review the last commit date and diff size — delete any branch >30 days old with no open PR.
3. Create a GitHub Project board with three columns: **Backlog**, **In Progress**, **Done** — move all active branches into corresponding items.

### 2.2 Remove Binary Assets from Repository Root

Multiple large JPEG screenshots (audit-dashboard-full.jpeg, chrome-landing-full.jpeg, landing-full.jpeg, etc.) are committed directly to the repository root at ~80–300 KB each. These inflate repository clone size and pollute `git log`. Move them to:
- **Option A (recommended):** GitHub's `wiki` or a `/docs/screenshots/` subfolder tracked via Git LFS.
- **Option B:** A CDN/R2 bucket (since Cloudflare R2 is already in-stack) and reference them by URL in `README.md`.

### 2.3 Consolidate Redundant AI Config Directories

The root contains separate config directories for `.agents`, `.aidesigner`, `.amazonq`, `.claude`, `.cline`, `.codex`, `.cursor`, `.kiro`, `.roo`. This reflects a healthy multi-agent workflow, but the proliferation of AI rule files (`.clinerules`, `.cursorrules`, `.qrules`, `.roomodes`) with potentially overlapping content creates a maintenance burden. Steps:

- Audit each for unique content vs. duplication.
- Create a single source-of-truth `AGENTS.md` or extend `CLAUDE.md` with a "shared rules" section, then have each tool-specific file `include` or link to it.
- Document in `README.md` which AI tools are actively used vs. experimental.

### 2.4 Approve and Land Pending Migrations

Four schema changes are waiting for approval:
- `ContentGap` model (Sprint 15)
- `banditState` on `UserPreferences` (Sprint 16)
- `PushSubscription` + `NotificationLog` (Sprint 18)
- `web-push` npm package (Sprint 18)

Each of these is blocking downstream features. Approving these migrations in a dedicated "schema consolidation session" with a backup snapshot of Supabase is the correct approach. Run `npm run db:migrate:deploy` against the staging environment first.

***

## Priority 3 — Sprint 7: Content Generation & Launch Polish

Sprint 7 is the only remaining sprint from the master plan. It has three sub-components:

### 3.1 Content Generation: CV and Pulmonary Focus

The CLAUDE.md explicitly flags CV and PULM as under-represented in the question bank. The generation strategy:

- **Target counts:** CV is 11% of NCCPA blueprint; PULM is 9%. Generate questions proportional to these weights until the question reservoir is fully seeded.
- **Question order distribution:** Apply the phase-aware weighting from Sprint 2 — for PANCE prep mode: 10% first-order, 35% second-order, 55% third-order.
- **Task category tagging:** Run a backfill script to tag existing questions with `taskCategory` (history_pe, diagnostics, management, education, professional).
- **Generation command:** `npm run generate:clinical` followed by `npm run health-check` to validate output quality.

### 3.2 Performance Audit

Before launch:
- Run Lighthouse CI (`lighthouserc.js` is already in the repo) against the production Cloudflare Pages URL.
- Target: Performance > 85, Accessibility > 95, Best Practices > 90.
- **Known risk:** The `index.css` file is 80 KB — audit for unused CSS with PurgeCSS integration in the Vite config.
- **Edge function cold starts:** Review the most-called endpoints in `functions/api/` for initialization overhead. Cache shared data (like blueprint weights) at module scope, not inside request handlers.

### 3.3 Beta Testing with PA Students

Recruit 3–5 fellow PA students for beta testing. Prioritize peers who are:
- On rotations different from your own (to test cross-rotation content breadth).
- At varying program phases (PA-S1 vs. PA-S2) to validate the progression-aware question selection from Sprint 2.

Provide them with a structured feedback form covering: (1) dashboard clarity, (2) session flow, (3) OSCE realism, (4) perceived content accuracy. Use Sentry (already wired) to capture any errors they encounter.

***

## Priority 4 — Phase 6: Dynamic Study Path Optimizer

The attached `phase6-dynamic-study-path-optimizer.md` is a well-architected plan that aligns perfectly with the existing FSRS + NCCPA infrastructure. This is the next major feature after Sprint 7. The implementation should follow the phased approach in the document:[^1]

### 4.1 Phase 6.1: Core Analysis Engine

Build two standalone services first:[^1]
- **`PerformanceGapAnalyzer`** — Computes rolling accuracy (last 200 reviews) per taxonomy node, compares against 90% target retention, and outputs ranked gaps. Key input: `UserProgress.fsrsParams` + `ReviewLog` filtered to `session_type = 'MAIN'`.
- **`RetentionAwareScheduler`** — Solves for the optimal review interval where retrievability \( R(t) \) drops below target using the FSRS v6 formula. This is non-destructive — it suggests; it never overrides the SRS schedule.

Expose a `GET /api/study-path/debug` endpoint that returns raw gap analysis. This allows manual validation before building any UI.

### 4.2 Phase 6.2: Path Generation & API

Once the analysis engine is validated:[^1]
- Build `PathGenerator` using a knapsack-style optimization: maximize total gap reduction subject to user-defined time limits and blueprint balance constraints.
- Build `ConfidenceScorer` using Bayesian confidence intervals — if `N < 60` reviews for a topic, flag as `NEEDS_MORE_DATA` and fall back to a calibration plan.[^1]
- Add Cloudflare KV caching (24-hour TTL) for generated plans to avoid recomputation per request.[^1]

### 4.3 Phase 6.3: Dashboard UI

The `StudyPathDashboard` should be additive to the existing dashboard layout from Sprint 1, not a replacement. The proposed components from the plan are well-scoped:[^1]
- `ProgressProjectionChart` — Line chart projecting retention over 30 days (use Recharts, already in-stack).
- `PlanAlternativesModal` — Side-by-side comparison of aggressive / balanced / light plans.
- `FatigueAlertBanner` — Triggered when `fatigueRiskLevel = HIGH` from the `FatigueRiskDetector`.

### 4.4 Blueprint-Balanced Selector Integration

The "zipper sort" algorithm that interleaves high-gap topics with under-represented blueprint categories is the highest-leverage component of the optimizer. It directly addresses the production priority order (Priority 1: FSRS session, Priority 2: OSCE, Priority 3: Clinical Library) by ensuring no blueprint category gets neglected. Wire it into the existing `lib/nccpa-question-weighting.ts` module.[^1]

***

## Priority 5 — OSCE Completeness (Issue #209, Priority 2)

OSCE is the second production priority per Issue #209. The `OSCE_REFACTOR_PLAN.md` is already detailed. The key improvements to layer on top:

### 5.1 Structured Reasoning Scaffold

Add the "Clinical Reasoning Ladder" from Sprint 4: five sequential steps — H&P → PE → Dx → DDx → Tx — scored independently. Gemini evaluates reasoning quality, not just correct/incorrect answers. This transforms OSCE from a chatbot into a genuine clinical encounter simulation.

### 5.2 Rotation-Specific Cases

Map OSCE cases to current rotation by leveraging the `pa-curriculum.ts` constants (already completed in Sprint 3):
- IM rotation → ACS, CHF, COPD, DKA
- Emergency → PE, stroke, trauma, anaphylaxis
- Surgery → Appendicitis, cholecystitis, bowel obstruction

When `currentRotation` is set in `UserPreferences`, surface rotation-matched cases first in the OSCE case selector.

### 5.3 Personality-Adaptive Progression

The current 8-personality system uses random selection. Upgrade to adaptive selection: start with cooperative personalities and progressively introduce evasive or anxious patients as the user's OSCE score improves. This mirrors real clinical training progression.

***

## Priority 6 — Clinical Library & Infrastructure

### 6.1 Clinical Library Completeness (Issue #209, Priority 3)

Per the production priority order, the clinical library is Priority 3 after FSRS session and OSCE. The `CLINICAL_LIBRARY_PLAN.md` documents the full scope. Focus on:
- **SmartConditionView** — Already has comprehensive error/loading/retry states (confirmed complete in 2026-04-13 session).
- **Imaging Reference Library** — Add CXR, CT, and ECG interpretation content to the `ImagingStudy` model (already in the schema).
- **Auscultation Audio Library** — Host audio files on Cloudflare R2, build `AuscultationView.tsx` with waveform display.

### 6.2 Notification Push Infrastructure

Sprints 18 requires `web-push` npm package and `PushSubscription` + `NotificationLog` schema. Once the migration is approved, implement the study nudge system from Sprint 1B: context-sensitive toasts for study time reminders, retention drop alerts, and session completion summaries.

### 6.3 Account Lifecycle

Sprint 6B is complete in the master plan, but verify the account deletion endpoint is fully wired:
- `functions/api/user/delete.ts` — Confirm Clerk webhook triggers cascade.
- 30-day grace period (soft delete → hard delete).
- Data export (study history CSV, performance analytics PDF).

***

## Priority 7 — Developer Experience & Repository Health

### 7.1 Reduce TypeScript Compilation Memory Pressure

The typecheck command requires `NODE_OPTIONS="--max-old-space-size=4096"` due to OOM issues. This is a signal that the project would benefit from TypeScript project references (`--build` mode), which compile each subproject independently. Candidates for project references: `functions/api/` (Edge runtime), `lib/` (core business logic), `components/` (React tree). This would also speed up incremental typecheck in CI.

### 7.2 Playwright E2E Coverage

The `e2e/` directory and `playwright.config.ts` are in place. The priority E2E scenarios to add:
- Full FSRS session: start session → answer questions → submit ratings → verify session completion screen.
- Drill submission: open a drill → submit answer → verify FSRS update reflected in UI.
- OSCE encounter: initiate case → walk through reasoning ladder → receive score.

These E2E tests are the only way to catch regressions in the integrated submission flow that unit tests miss.

### 7.3 CI/CD Pipeline Hardening

The `.github/` directory exists. Ensure the GitHub Actions workflow includes:
- `npm run typecheck` (zero errors gate)
- `npx vitest run` (3200+ tests gate)
- `npm run build` (Vite production build succeeds)
- Secret scanning via `.gitleaks.toml` (already configured)
- Lighthouse CI on Cloudflare Pages preview URL

Currently there is no visible branch protection rule on `main` — add one requiring all CI checks to pass before merge.

### 7.4 Skill Documentation Consolidation

There are 27 custom Claude skills in `.claude/skills/`. These are a significant competitive advantage for maintaining development velocity. To maximize their value:
- Ensure each skill file includes a `last-updated` timestamp and a brief `changelog` section.
- Add a `SKILL-ROUTING-QUICK.md` quick-reference at the root level (if not already present — the CLAUDE.md references it existing).
- Run a quarterly audit to retire skills that have been superseded by refactors.

***

## Implementation Sequence

Given that time is extremely limited (PA rotations + solo development), the recommended execution order is:

| Phase | Work Item | Est. Effort | ROI |
|-------|-----------|-------------|-----|
| **Now** | Fix QuizView 192 TS errors | 1–2 days | 🔴 Unblocks production |
| **Now** | Close DEV-003 (FSRS session UI) | 2–3 days | 🔴 Core product |
| **This week** | Merge/delete stale branches | 1–2 hrs | 🟡 Hygiene |
| **This week** | Approve pending migrations | 1 session | 🟡 Unblocks Sprint 18 |
| **This week** | CV/PULM content generation | 1–2 hrs | 🟡 Blueprint coverage |
| **Next sprint** | Sprint 7 full (performance audit, beta users) | 1 week | 🟡 Launch readiness |
| **Month 2** | Phase 6.1–6.2 (optimizer core + API) | 2–3 weeks | 🟢 Differentiator |
| **Month 2–3** | OSCE Reasoning Scaffold + rotation cases | 2 weeks | 🟢 Priority 2 product |
| **Month 3** | Phase 6.3 (dashboard UI) + Clinical Library | 2 weeks | 🟢 Priority 3 product |
| **Ongoing** | E2E test coverage, CI hardening | Incremental | 🟢 Quality |

***

## Key Non-Negotiables

These constraints from Issue #209 and `CLAUDE.md` must govern all improvement work:

- FSRS must remain **implicit-only** — no user-facing rating buttons, no Hard/Easy values.
- Zero TypeScript errors before any production deployment.
- Every new Edge function must use `authenticatedEndpoint` + `safePrismaDisconnect`.
- FSRS updates only trigger for `review_type: 'real'` with `MAIN` or `DRILL` session types.
- All schema migrations require explicit approval before execution.
- No secrets committed to the repository (`.gitleaks.toml` enforces this).

---

## References

1. [phase6-dynamic-study-path-optimizer.md](https://drive.google.com/file/d/1MUObL5oW_qkC4CXetINjSRRcRcTqM_Jb/view?usp=drivesdk) - # Phase 6: Dynamic Study Path Optimizer

## Overview
The **Dynamic Study Path Optimizer** is a perso...

