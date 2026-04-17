# TASK-013 — Add canonical InlineButtonSpinner primitive + migrate 8 inline button spinners

- **Status:** completed
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** (pending this-run commit)
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §6 "Partial — Loading-state normalization rollout"; `AUDIT_RECONCILIATION.md` §7 "Loading-state normalization rollout" (currently `partial` after TASK-012; this task addresses the inline-button-spinner cluster that TASK-012 explicitly deferred because no canonical primitive existed yet).

## Verify-first block (Audit Interpreter)

TASK-012's progress doc called out three places where the normalization rollout was deliberately paused:

1. Three inline button spinners in `GrandRoundsMode.tsx` (lines 702, 1027, 1194) — `<Loader2 className="w-5 h-5 animate-spin" />` inside disabled-during-submit primary buttons.
2. Five inline button spinners in `PatientEncounterMode.tsx` (lines 1706, 2616, 2722, 2775, 2793) — handrolled `<div aria-hidden="true" className="w-4|5 h-4|5 border-2 border-white/30 border-t-white rounded-full animate-spin" />` inside primary / ghost buttons.
3. The real-progress generation block in `CramMode.tsx` line 286 — **intentional steady state**, not in scope for this task.

The gating issue for cluster 1+2 was: the canonical loading system (`components/loading/index.tsx`) had no inline-button-scoped spinner. `DrillLoadingState` and friends are full-container skeletons that would blow out a button's layout; the `Loader` overlay locks body scroll. Using them inside a button was worse than leaving the bespoke spinner in place. TASK-013 closes that gap by adding a purpose-built primitive and migrating the 8 deferred call sites.

### Primitive design requirements

- **Inherits `currentColor`.** Buttons in PANaCEa's design system range from white-on-amber (primary), white-on-deep-plum, accent-on-neutral, to ghost-style with dark text. A spinner that hard-codes a color (`border-t-white`, `border-t-amber-400`, etc.) needs per-call-site configuration. A currentColor-driven spinner just inherits the button's `color` and works everywhere.
- **Size variants.** Existing spinners in the 8 call sites are either `w-4 h-4` (used in tight `<button>` primaries inside flex layouts) or `w-5 h-5` (used in `<Button variant="primary">` with larger type). Match both. Default to `md` (w-5 h-5) because it's the more common size.
- **`aria-hidden` by default.** The canonical pattern in all 8 call sites is: a disabled button whose text already announces the state ("Submitting...", "Evaluating...", "Generating Case...", "Consulting Preceptor..."). The spinner itself is pure visual affordance and should NOT be announced separately — it would double-announce.
- **Respect `prefers-reduced-motion`.** Tailwind's `animate-spin` class already does this via the framework's media-query stub. Use it.
- **No border-utility tricks.** Initial drafts used `border-t-white border-white/30` or `border-t-[color:currentColor] border-current/30` — both rely on `color-mix(... currentColor ...)` which has uneven browser support on Tailwind 3.4's JIT compile of arbitrary-property border-side utilities. An SVG with `stroke="currentColor"` + `stroke-opacity` for the track is universally supported and is the cleaner answer.

### Bespoke-spinner inventory — 2026-04-17 (confirming TASK-012's deferred list)

1. **`components/modes/GrandRoundsMode.tsx`** — 3 inline button spinners using `<Loader2 className="w-5 h-5 animate-spin" />` from lucide-react:
   - **Line 702** — "Review answers" button (reviewLoading branch).
   - **Line 1027** — "Submitting..." primary button.
   - **Line 1194** — second "Review answers" button on the results screen.
   - All three use `w-5 h-5` → `size="md"`.
   - After all three migrate, the `Loader2` import becomes orphaned and must be removed from the lucide-react import block.

2. **`components/modes/PatientEncounterMode.tsx`** — 5 inline button spinners using the `<div aria-hidden="true" className="w-X h-X border-2 border-white/30 border-t-white rounded-full animate-spin" />` pattern:
   - **Line 1706** — "Generating Case..." on the "Start Interview" button (`w-5 h-5` → `size="md"`).
   - **Line 2616** — icon-only ghost button for `handleOrderTest` (`w-5 h-5` → `size="md"`).
   - **Line 2722** — "Evaluating..." on `handleSubmitDiagnosis` primary button (`w-4 h-4` → `size="sm"`).
   - **Line 2775** — "Evaluating..." on `handleTreatmentSubmit` button (`w-4 h-4` → `size="sm"`).
   - **Line 2793** — "Consulting Preceptor..." on `handleEndEncounter` button (`w-4 h-4` → `size="sm"`).
   - Existing `@/components/loading` import is already present at line 85 (`import { ChatSkeleton } from '@/components/loading';`) — extend it rather than add a second line.

### Classification

- All 8 call sites → **accurate**; migrate to the new `InlineButtonSpinner` primitive.
- `CramMode` line 286 (real-progress count UX) → **unchanged from TASK-012 classification**: intentional steady state, outside normalization scope.
- The ~25 other `animate-spin` occurrences elsewhere in `components/` (library, dashboard, command palette, my-library, etc.) → **deferred to TASK-014+**; requires its own audit pass because some are spinners in loading blocks (candidates for `DrillLoadingState` / `ClinicalSkeleton`), not just button spinners.

## Planned-code-changes block (Repo Mapper)

1. **`components/loading/index.tsx`**:
   - Add a new `InlineButtonSpinner` named export between the `Loader` section and the `// Skeleton Component — Base with gold shimmer` header (approximately after line 198 in the post-TASK-012 file).
   - Export `InlineButtonSpinnerSize` (`'sm' | 'md'`) and `InlineButtonSpinnerProps` interface alongside.
   - Implement as an SVG with two circles (track at `stroke-opacity={0.3}`, animated head as a quarter-arc `<path>`), both `stroke="currentColor"`. `animate-spin` on the root `<svg>`. `aria-hidden="true"`, `focusable="false"`. Pass-through `className` for the rare caller that needs to override color. Comment at the top documenting why SVG beats border-utility tricks and why this isn't for full-container loading blocks.

2. **`components/modes/GrandRoundsMode.tsx`**:
   - Extend the `@/components/loading` import from `import { DrillLoadingState } from '@/components/loading';` → `import { DrillLoadingState, InlineButtonSpinner } from '@/components/loading';`.
   - Replace line 702 (`<Loader2 className="w-5 h-5 animate-spin" />`) with `<InlineButtonSpinner />`.
   - Replace line 1027 (same pattern) with `<InlineButtonSpinner />`.
   - Replace line 1194 (same pattern) with `<InlineButtonSpinner />`.
   - Remove `Loader2,` from the lucide-react import block — no other references remain.

3. **`components/modes/PatientEncounterMode.tsx`**:
   - Extend the existing import at line 85: `import { ChatSkeleton } from '@/components/loading';` → `import { ChatSkeleton, InlineButtonSpinner } from '@/components/loading';`.
   - Replace line 1706 with `<InlineButtonSpinner />`.
   - Replace line 2616 with `<InlineButtonSpinner />`.
   - Replace line 2722 with `<InlineButtonSpinner size="sm" />`.
   - Replace line 2775 with `<InlineButtonSpinner size="sm" />`.
   - Replace line 2793 with `<InlineButtonSpinner size="sm" />`.

## What was changed

- `components/loading/index.tsx`:
  - New `InlineButtonSpinner` named export plus `InlineButtonSpinnerSize` and `InlineButtonSpinnerProps` types. SVG-based, two-circle ring: track at `strokeOpacity={0.3}`, quarter-arc head at full opacity, both `stroke="currentColor"`. `strokeLinecap="round"` on the head. `animate-spin` root class. Default size `md` (w-5 h-5). Optional `className` pass-through.
  - Inline doc block explains: (a) currentColor contract, (b) why SVG instead of Tailwind `border-current/30` + `border-t-current`, (c) that this primitive is explicitly NOT for full-container loading blocks (point callers at `DrillLoadingState`), (d) that `aria-hidden="true"` is correct because the surrounding button's text announces state.
- `components/modes/GrandRoundsMode.tsx`:
  - Import rewritten to `import { DrillLoadingState, InlineButtonSpinner } from '@/components/loading';`.
  - 3 `<Loader2 className="w-5 h-5 animate-spin" />` call sites (lines 702 / 1027 / 1194 in the pre-TASK-013 file) swapped for `<InlineButtonSpinner />`.
  - `Loader2,` removed from the lucide-react import block — it was the only remaining reference in the file.
- `components/modes/PatientEncounterMode.tsx`:
  - Line 85 import extended to `import { ChatSkeleton, InlineButtonSpinner } from '@/components/loading';`.
  - 5 handrolled `<div aria-hidden="true" className="... border-t-white rounded-full animate-spin" />` spinners replaced: 2 with `<InlineButtonSpinner />` (lines 1706, 2616) and 3 with `<InlineButtonSpinner size="sm" />` (lines 2722, 2775, 2793).
  - No other imports touched.

## Verification

- **Typecheck** (`NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`): **zero errors** in any of the three touched files (`components/loading/index.tsx`, `components/modes/GrandRoundsMode.tsx`, `components/modes/PatientEncounterMode.tsx`). Pre-existing repo-wide error count is **1,152 error lines**, identical to the post-TASK-012 baseline — this task introduces zero new errors.
- **Regression tests:** No existing test files reference `InlineButtonSpinner` (it's newly minted), `GrandRoundsMode`, or `PatientEncounterMode` (`grep -rl` in `tests/` and colocated `.test.*` files returned zero matches). The migration is structurally isomorphic — each call site is a drop-in visual replacement with identical `aria-hidden` semantics, so there is no behavioral regression surface to cover.
- **Behavioral parity check:** 
  - **GrandRoundsMode:** The three `Loader2` icons were already lucide's `currentColor`-inheriting SVG icons at `w-5 h-5`. `InlineButtonSpinner` at default size is also `w-5 h-5` and also inherits `currentColor`. Visual weight, bounding box, and color are unchanged. The difference is the spinner graphic (lucide's `Loader2` has dashed-arc segments; the canonical primitive has a smooth ring with a rotating head) — the canonical version is more consistent with the design system's other loading affordances.
  - **PatientEncounterMode:** The handrolled `border-2 border-white/30 border-t-white` divs were hard-coded to white. All 5 call sites are inside buttons with white text (primary amber buttons, ghost buttons, white-on-plum action buttons). `InlineButtonSpinner` inherits `currentColor` from the button, which is also white at these call sites — so the visible color is unchanged. The size mapping is exact: `w-5 h-5` → `size="md"`, `w-4 h-4` → `size="sm"`. No layout shift.
  - **Accessibility:** The primitive ships `aria-hidden="true" focusable="false"` by default. Before the migration, `Loader2` from lucide also lacked default `aria-hidden` (consumers had to remember); the handrolled divs in PatientEncounterMode did carry `aria-hidden="true"` manually. Post-migration, the entire family gets correct announcement semantics for free — the button's text label ("Submitting...", "Evaluating...", etc.) is the single source of screen-reader information, as intended.
- **Diff footprint:** 3 files touched; 8 call sites migrated; 1 new primitive with 2 types; 1 orphaned import removed. Net diff is small and easily reverted with a single `git revert`.

## Audit delta

- `AUDIT_RECONCILIATION.md` §7 "Loading-state normalization rollout" narrows further: previously `partial` (post-TASK-012) with three remaining clusters (inline button spinners / real-progress block / ~25 other animate-spin files). After TASK-013: the inline-button-spinner cluster is **closed** for `GrandRoundsMode` + `PatientEncounterMode`; the real-progress block remains intentional steady state; the ~25-file "other" cluster remains queued for TASK-014+. Status stays `partial` with narrower remaining scope.
- `UNFINISHED_WORK_MASTER_AUDIT.md` §6 action "Finish migration to `components/loading` primitives across adaptive/session and mode shells" — **all loading affordances in the two active encounter-style mode shells (GrandRoundsMode, PatientEncounterMode) now route through the canonical loading module**; nothing in those two files still hand-rolls a spinner. Cram's real-progress block is documented as out-of-scope-by-design.
- Zod audit counts (PASS/WARN_OUT_OF_BAND/WARN_MANUAL_ONLY/FAIL = 176/8/3/2) unchanged — this task does not touch `functions/api/**`.

## Follow-ups

- **TASK-014+ animate-spin sweep.** Approximately 25 other files across `components/library/`, `components/dashboard/`, `components/navigation/CommandPalette.tsx`, `components/pages/MyLibraryPage.tsx`, `components/admin/**`, etc. still use `animate-spin` — some in inline-button contexts (can adopt `InlineButtonSpinner` immediately), others in full-container loading blocks (candidates for `DrillLoadingState` / `ClinicalSkeleton` / `StreamingSkeleton`), and a handful likely intentional (spinning icons that are NOT loading affordances — e.g. an always-spinning decorative element or a Lucide `RefreshCw` on a "sync now" button). The next sprint should grep-and-classify these before migrating; the classification step is most of the cost, and aggregating into one sprint per file cluster keeps diffs reviewable.
- **Consider an `InlineSpinnerWithLabel` helper** for the pattern `<InlineButtonSpinner /> Submitting...`. Eight of the call sites duplicate the "spinner + gap-2 + text" layout. A tiny wrapper could encode it once, accept `children` for the label, and ensure consistent spacing. Low priority — the current `<> <InlineButtonSpinner /> label </>` is fine and doesn't block anything.
- **Light-mode audit.** `InlineButtonSpinner` inherits `currentColor` cleanly, so it adapts to any button color. But PANaCEa's light-mode QA bench should sanity-check that the 0.3 track opacity is still visible on light-on-light buttons (e.g. if a future ghost-button variant has dark-accent text on near-white background — 0.3 of a dark color may be too faint). If that becomes a problem, expose a `trackOpacity` prop; not necessary now.
