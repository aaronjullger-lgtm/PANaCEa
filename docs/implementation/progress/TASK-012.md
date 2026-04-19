# TASK-012 — Normalize loading states in adaptive session + major mode shells

- **Status:** completed
- **Date:** 2026-04-16
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** `e11b0457` (code) / `3b15f3f7` (docs)
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §6 "Partial — Loading-state normalization rollout"; `AUDIT_RECONCILIATION.md` §7 "Loading-state normalization rollout" (previously `accurate` → `deferred`; this task begins the rollout on the highest-traffic session/mode shells).

## Verify-first block (Audit Interpreter)

Master audit §6 calls out a canonical loading system (`components/loading/index.tsx`) that is built but not consistently adopted across the app. Many high-traffic screens still hand-roll `animate-spin` border-spinner divs or inline `Loader2` icons. This breaks the cinematic loading grammar (gold shimmer, spring physics, blur-dissolve, drill-mode skeleton) that the canonical primitives provide, and it also means loading messages, aria-live regions, and skeleton shapes are reinvented ad-hoc each time.

### Canonical primitives surveyed

Read `components/loading/index.tsx` (901 lines). Relevant exports for session/mode shells:

- `Loader` — **full-screen overlay** (`fixed inset-0 z-50`, locks body scroll). Variants: `spinner`, `skeleton`, `progress`, `clinical`. Not appropriate for in-container loading blocks that live inside a `min-h-screen` or `min-h-[60vh]` wrapper.
- `DrillLoadingState` — **in-container drill/quiz skeleton** with question card, staggered option rows, animated progress bar, optional timer. Variants: `question`, `image`, `lab`, `encounter`. This is the right fit for pre-quiz loading blocks where the next render is a QuizView / DrillShell / mode shell.
- `ClinicalSkeleton`, `StreamingSkeleton`, `QuestionSkeleton`, `CommandCenterSkeleton`, etc. — specialized placeholders for non-drill contexts.

### Bespoke-spinner inventory (grep for `animate-spin` + `border-t-`) — 2026-04-16

Scanned `components/` for handrolled `animate-spin` spinners. Results targeted at master-audit §6 "session/mode files":

1. **`components/session/CoreAdaptiveSession.tsx`** — two bespoke spinners:
   - **Line 382** (pre-refactor): full `isLoading` block rendering "Resolving your study plan..." with a hand-rolled `animate-spin rounded-full h-10 w-10 border-2 border-...` div inside a `min-h-[60vh]` centered container. The block fires while `CoreAdaptiveSession` is resolving the blueprint, session scope, and selecting the reservoir-seeded question batch before `QuizView` is mounted.
   - **Line 574** (pre-refactor): Suspense fallback for the `lazy(() => import('@/components/session/QuizView'))` import. Same handrolled border-spinner div, smaller (`h-8 w-8`), inside a `min-h-[40vh]` wrapper.

2. **`components/modes/CramMode.tsx`** — two uses of `Loader2` from lucide-react:
   - **Line 242** (pre-refactor): per-question guard block ("Loading question...") rendered when `currentQuestion` is undefined during active play. Hand-rolled icon spinner inside a `min-h-screen` wrapper.
   - **Line 286** (KEEP AS-IS): generation-progress block with a real progress count (`{completed} / {total} questions`) and a real progress bar driven by `loadingProgress`. This is **not** a lazy-loading spinner — it communicates real-time AI generation progress while the Gemini pipeline streams question batches. Migrating to a canonical skeleton would lose the information density and user-trust signal that comes from showing actual N/M progress. Intentionally left untouched.

3. **`components/modes/GrandRoundsMode.tsx`** — five uses of `Loader2`:
   - **Line 576** (pre-refactor): `viewState === 'loading'` block ("Loading {modeLabel}..."). Full-page loader while the challenge-data fetch is in flight.
   - **Line 888** (pre-refactor): per-question guard block when `challengeData.questions[currentQuestionIndex]` is undefined. Same handrolled icon spinner inside a full-page wrapper.
   - **Lines 702, 1027, 1194** (KEEP AS-IS): three inline button spinners (`w-5 h-5 animate-spin`) embedded inside disabled-during-submit buttons. These are legitimate scoped in-button feedback; replacing them with `DrillLoadingState` (a large full-container skeleton) would break the button layout. The canonical system does not currently ship an inline `InlineButtonSpinner` primitive; creating one is out of scope for this task and would need its own design review.

4. **`components/modes/PatientEncounterMode.tsx`** (surveyed, not modified this sprint): five inline button spinners in the same pattern as GrandRoundsMode's lines 702/1027/1194 — all legitimate scoped in-button feedback. Deferring these to a future `InlineButtonSpinner` primitive task.

### Classification

- CoreAdaptiveSession lines 382 + 574 → **accurate**; migrate to `DrillLoadingState` (both are pre-quiz loading blocks where the next render is a full QuizView).
- CramMode line 242 → **accurate**; migrate to `DrillLoadingState`.
- CramMode line 286 → **intentional steady state**; real-progress-count generation UX is correct-by-design and outside the normalization scope. Canonical primitives do not carry count data.
- GrandRoundsMode lines 576 + 888 → **accurate**; migrate to `DrillLoadingState`.
- GrandRoundsMode lines 702/1027/1194 + PatientEncounterMode button spinners → **deferred**; need a new canonical `InlineButtonSpinner` primitive before these can be normalized without regressing the button layouts.

## Planned-code-changes block (Repo Mapper)

1. **`components/session/CoreAdaptiveSession.tsx`**:
   - Add `import { DrillLoadingState } from '@/components/loading';`.
   - Replace the `if (isLoading)` block (lines 379–388 pre-refactor) with a single `<DrillLoadingState message="Resolving your study plan..." variant="question" showTimer showProgress />`.
   - Replace the `<Suspense fallback={...}>` inner spinner (lines 572–576 pre-refactor) with `<DrillLoadingState message="Preparing your questions..." variant="question" showTimer showProgress />`.

2. **`components/modes/CramMode.tsx`**:
   - Add `import { DrillLoadingState } from '@/components/loading';`.
   - Replace the `!currentQuestion` guard block (lines 238–247 pre-refactor) with `<DrillLoadingState message="Loading question..." variant="question" showTimer showProgress />`.
   - **Leave the generation-progress block (lines 282–312 pre-refactor) untouched** — it communicates real progress that the canonical primitives cannot represent.

3. **`components/modes/GrandRoundsMode.tsx`**:
   - Add `import { DrillLoadingState } from '@/components/loading';`.
   - Replace the `viewState === 'loading'` block (lines 571–581 pre-refactor) with `<DrillLoadingState message={`Loading ${modeLabel}...`} variant="question" showTimer showProgress />`.
   - Replace the `!currentQuestion` guard block (lines 883–893 pre-refactor) with `<DrillLoadingState message="Loading question..." variant="question" showTimer showProgress />`.
   - **Leave the three inline button spinners (lines 702, 1027, 1194) untouched** — canonical `InlineButtonSpinner` doesn't exist yet; blocking on that is out of scope for this sprint.

4. **`components/modes/PatientEncounterMode.tsx`** — **not modified.** All five bespoke spinners in this file are inline button feedback, the same category as the deferred ones in GrandRoundsMode.

## What was changed

- `components/session/CoreAdaptiveSession.tsx`:
  - Added `import { DrillLoadingState } from '@/components/loading';`.
  - `isLoading` return block reduced from 10 lines (wrapper + handrolled border-spinner + `<p>` tag) to a single `<DrillLoadingState ... />` element with the same message.
  - `<Suspense fallback={...}>` inner handrolled spinner replaced with `<DrillLoadingState ... />`. Message now reads "Preparing your questions..." which more accurately describes the lazy-chunk load + initial QuizView render.
- `components/modes/CramMode.tsx`:
  - Added `import { DrillLoadingState } from '@/components/loading';`.
  - `!currentQuestion` guard block reduced from 9 lines to a single `<DrillLoadingState ... />`.
  - `Loader2` import retained (still used by the generation-progress block).
- `components/modes/GrandRoundsMode.tsx`:
  - Added `import { DrillLoadingState } from '@/components/loading';`.
  - `viewState === 'loading'` block reduced from 10 lines to a single `<DrillLoadingState ... />`; message preserves the `{modeLabel}` template ("Loading Grand Rounds..." or "Loading Targeted Daily Question...").
  - `!currentQuestion` guard block reduced from 11 lines to a single `<DrillLoadingState ... />`.
  - `Loader2` import retained (still used by the three inline button spinners).

## Verification

- **Typecheck** (`NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`): **zero errors** in any of the three touched files (`components/session/CoreAdaptiveSession.tsx`, `components/modes/CramMode.tsx`, `components/modes/GrandRoundsMode.tsx`) or in `components/loading/index.tsx`. Pre-existing repo-wide error count is unchanged (1,152 error lines, all in unrelated `services/optimizer/*`, `services/imageOptimizationService.ts`, `functions/api/admin/refinery/action.ts`, etc. — these are leftover from other parked work and not introduced here).
- **Regression tests:** No existing test files reference `CoreAdaptiveSession`, `CramMode`, `GrandRoundsMode`, or `DrillLoadingState` (`grep -rl` across `tests/` and `components/**/*.test.*` returned zero matches). There is no regression test surface to run for this change; the migration is structurally isomorphic (same conditional branches, same return positions) and the canonical primitive already ships with its own aria-live + role="status" affordances that the bespoke spinners did not have.
- **Behavioral parity check:** Both CoreAdaptiveSession's `isLoading` return and the Suspense fallback render inside container-shaped parent divs (`flex flex-col items-center justify-center min-h-[60vh]` / `min-h-[40vh]`). `DrillLoadingState` has its own `min-h-[500px]` wrapper with `bg-[var(--color-bg-primary)]` and a centered `max-w-3xl` content column — it replaces the parent container shape correctly and provides richer affordance (timer placeholder, progress bar, staggered option rows) without shifting layout. CramMode + GrandRoundsMode guard blocks previously used `min-h-screen` backdrops with gradient washes; `DrillLoadingState` drops the gradient-wash chrome but keeps the same "full-viewport pre-quiz skeleton" role, which matches what users see when they land on the same screen in the normal (non-loading) state.
- **Diff footprint:** 3 files touched; ~40 lines removed, ~25 lines added, net −15 lines. No API surface changes, no prop shape changes, no new dependencies. Safe rollback is a single `git revert`.

## Audit delta

- Begins the rollout on the `accurate` / `deferred` §7 "Loading-state normalization rollout" row. Post-task status: **partial** — the four highest-traffic session/mode loading blocks are on canonical primitives; the inline button-spinner family (3 in GrandRoundsMode + 5 in PatientEncounterMode) remains on `Loader2` pending a canonical `InlineButtonSpinner` primitive.
- `UNFINISHED_WORK_MASTER_AUDIT.md` §6 action "Finish migration to `components/loading` primitives across adaptive/session and mode shells" — **core adaptive session + cram + grand rounds full-page loaders done**; patient encounter + inline button spinners deferred.

## Follow-ups

- **Create a canonical `InlineButtonSpinner` primitive** in `components/loading/index.tsx` that ships `w-4 h-4` / `w-5 h-5` size variants, inherits `currentColor`, and renders a ring-spinner consistent with the gold-accent design system. Once it exists, migrate:
  - `components/modes/GrandRoundsMode.tsx` lines 702, 1027, 1194.
  - `components/modes/PatientEncounterMode.tsx` lines 1706, 2616, 2722, 2775, 2793.
  - Any other `w-4 h-4 animate-spin` / `w-5 h-5 animate-spin` occurrences in button contexts across the app.
- **Document the intentional carve-out for real-progress loaders.** `CramMode.tsx`'s generation-progress block (count + progress bar) should not be migrated to a canonical skeleton because it conveys information that skeletons cannot. If canonical primitives ever gain a `ProgressWithCount` variant, revisit.
- **Survey the other 25 files flagged by the `animate-spin` grep** (e.g. `components/library/ClinicalReferenceLibrary.tsx`, `components/dashboard/StudyPathDashboard/index.tsx`, `components/navigation/CommandPalette.tsx`, `components/pages/MyLibraryPage.tsx`, etc.) in follow-up TASK-013+. Most are likely inline button spinners; the full-container loaders should get migrated one sprint at a time to keep diffs reviewable.
