# TASK-014 — Migrate clinical-library animate-spin loaders to canonical InlineSpinner (+ widen primitive to lg/xl)

- **Status:** completed
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** `0cb099fc` (code — bundled with calculator sprint-9 in a combined commit) / `0b90329a` (docs).
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `UNFINISHED_WORK_MASTER_AUDIT.md` §6 "Partial — Loading-state normalization rollout"; `AUDIT_RECONCILIATION.md` §7 "Loading-state normalization rollout" (currently `partial` after TASK-013; this task addresses the clinical-library cluster TASK-013 explicitly queued as "~25 other animate-spin files").

## Verify-first block (Audit Interpreter)

TASK-013 closed the inline-button-spinner cluster in the mode shells (`GrandRoundsMode`, `PatientEncounterMode`) by minting `InlineButtonSpinner`. The doc explicitly queued a "~25 other animate-spin files" sweep for TASK-014+, requiring per-file classification because the occurrences split three ways:

1. **Functional loading spinners inside inline status rows** (e.g. `<RefreshCw size={14} className="animate-spin" /> Loading library...`) — candidates for the canonical ring primitive but *outside button context*. TASK-013's primitive was named `InlineButtonSpinner` with a docblock that said "NOT for full-container loading blocks — use `DrillLoadingState` for those." That wording was overly restrictive: the ring visual fits inline-status-row use too, and the *full-container, centered-in-a-box overlay* use case (w-8 h-8 / w-12 h-12) also wants the same primitive, just at a larger size.
2. **Full-container loading overlays** (e.g. `<Loader2 className="w-8 h-8 animate-spin" />` inside an `absolute inset-0 flex-center` wrapper) — these are NOT full-viewport (so `Loader` is wrong; it locks body scroll and assumes fixed inset-0 at z-50) and NOT skeleton-shaped (so `ClinicalSkeleton` / `DrillLoadingState` are wrong; those render fake content shapes, not a "processing, please wait" beacon). They want a centered ring with optional label — exactly the same visual as `InlineButtonSpinner`, just bigger.
3. **Intentional non-loading spinners** — specifically Lucide's `RefreshCw` icon on a "Refresh content" button, conditionally applied `animate-spin` only while a refresh is in-flight. The icon glyph IS the meaningful information (tells the user "this button refreshes content"), and the conditional spin is an echo of the icon's semantics, not a generic loading beacon. These stay as-is.

After an initial `grep animate-spin components/` returned 103 matches (much larger than TASK-013's "~25" estimate), the sprint was deliberately scoped down to the **clinical-library cluster** (`components/library/`) — 6 files, 9 occurrences — to keep the diff reviewable and let the primitive extension happen alongside exactly one cohesive consumer set. Remaining clusters (dashboard, admin, modes, toolkit, analytics, OSCE, drill, session) are queued for TASK-015+.

### Library-cluster inventory — 2026-04-17

```
components/library/HighYieldSummary.tsx:165        <RefreshCw size={14} className="animate-spin" style={{ color: '...' }} />   — inline status spinner (MIGRATE)
components/library/DrugReferenceLibrary.tsx:51     <div ...border-4 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin ... />  — full-container overlay (MIGRATE)
components/library/DrugReferenceLibrary.tsx:580    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />   — refresh button icon (KEEP — intentional)
components/library/ClinicalReferenceLibrary.tsx:660 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />  — refresh button icon (KEEP — intentional)
components/library/ReferenceHub.tsx:327            <RefreshCw size={14} className="animate-spin" />   — inline status spinner (MIGRATE)
components/library/ReferenceHub.tsx:439            <RefreshCw size={14} className="animate-spin" />   — inline status spinner (MIGRATE)
components/library/SmartPDFViewer.tsx:365          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" aria-hidden />  — container overlay (MIGRATE)
components/library/ContextWidget.tsx:77            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />  — container overlay (MIGRATE)
components/library/GenericReferenceView.tsx:274    <RefreshCw size={20} className="animate-spin" style={{ marginRight: 8 }} />  — large inline status spinner (MIGRATE)
```

Count: **9 total** → **7 migrate**, **2 intentional keep**. The 2 keepers share the exact same idiom (`<RefreshCw className={w-4 h-4 ${loading ? 'animate-spin' : ''}} />` inside a "Refresh content" button, with the animate-spin conditional); they are correct as-is and should NOT be touched.

### Primitive design delta vs TASK-013

TASK-013 shipped `InlineButtonSpinner` with only `sm`/`md` sizes and a docblock scoped to disabled-during-submit buttons. The clinical-library sweep exposed three gaps:

- **Size range.** Container-overlay cases use `w-8 h-8` (SmartPDFViewer, ContextWidget approximations) and `w-12 h-12` (DrugReferenceLibrary's `LoadingOverlay` helper). Neither `sm` (w-4 h-4) nor `md` (w-5 h-5) fits.
- **Name is misleading.** "InlineButtonSpinner" suggests button-only use. Inline status rows and container-overlay cases are legitimate, and routing them all through the same primitive is the whole point of consolidation.
- **Docblock was too restrictive.** The "NOT for full-container loading blocks" line discouraged the exact consolidation this sweep wants to do.

TASK-014 widens the primitive: adds `lg` (w-8 h-8) and `xl` (w-12 h-12) sizes, renames the canonical export to `InlineSpinner`, aliases `InlineButtonSpinner` → `InlineSpinner` for backward compat, and rewrites the docblock to list the three legitimate use cases (buttons / inline status rows / container overlays) with pointer-references to `ClinicalSkeleton`, `Loader`, and `DrillLoadingState` for the use cases it's *still* not right for.

### Classification

- 7 library-cluster call sites → **accurate** to migrate: 4 inline-status-row (sm) and 3 container-overlay (lg/xl).
- 2 library-cluster `RefreshCw` "refresh content" buttons → **intentional, keep** (idiomatic `animate-spin` echo of a meaningful glyph; not a generic loading beacon).
- Remaining ~94 `animate-spin` occurrences outside `components/library/` → **deferred to TASK-015+** with the same grep-and-classify workflow.

## Planned-code-changes block (Repo Mapper)

1. **`components/loading/index.tsx`** — extend the primitive.
   - Widen `InlineButtonSpinnerSize` to `'sm' | 'md' | 'lg' | 'xl'` and re-export under the new name `InlineSpinnerSize`.
   - Rename the canonical export to `InlineSpinner` with the new size table (`sm` = w-4 h-4, `md` = w-5 h-5, `lg` = w-8 h-8, `xl` = w-12 h-12).
   - Export `InlineButtonSpinner` as a backward-compat alias (`const InlineButtonSpinner = InlineSpinner`) plus type aliases so TASK-013's existing call sites keep working without edits.
   - Rewrite the JSDoc: list the three legitimate use cases, point at `ClinicalSkeleton` / `Loader` / `DrillLoadingState` for the cases the primitive is still not right for.

2. **`components/library/DrugReferenceLibrary.tsx`** — replace the handrolled 48px CSS ring in the `LoadingOverlay` helper with `<InlineSpinner size="xl" className="text-[var(--color-accent)] mb-4" />`. Wrap the surrounding div in `role="status" aria-live="polite"` for a11y. Import `InlineSpinner` via a sibling line under the existing `DrugMaster` import. Leave the line 580 `RefreshCw` refresh-button icon untouched.

3. **`components/library/SmartPDFViewer.tsx`** — swap `<Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" aria-hidden />` for `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />`. Remove `Loader2` from the lucide-react import block (only reference in the file). Wrap the overlay div in `role="status" aria-live="polite" aria-label="Loading PDF viewer"`. Add `import { InlineSpinner } from '@/components/loading';`.

4. **`components/library/ContextWidget.tsx`** — swap `<Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />` for `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />`. Remove `Loader2` from the lucide-react import block (only reference). Wrap the loading div in `role="status" aria-live="polite" aria-label={`Loading ${title.toLowerCase()}`}`.

5. **`components/library/ReferenceHub.tsx`** — two call sites.
   - Line 327 (cross-entity "Searching across all reference types..."): swap `<RefreshCw size={14} className="animate-spin" />` → `<InlineSpinner size="sm" />`. Add `role="status" aria-live="polite"` on the container div.
   - Line 439 ("Loading reference library..."): same pattern.
   - Remove `RefreshCw` from the lucide-react import block — it was only used in these two spots in this file.
   - Add `import { InlineSpinner } from '@/components/loading';`.

6. **`components/library/HighYieldSummary.tsx`** — swap `<RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />` → `<InlineSpinner size="sm" className="text-[var(--color-text-secondary)]" />`. Remove `RefreshCw` from the lucide-react import block. Add `import { InlineSpinner } from '@/components/loading';`.

7. **`components/library/GenericReferenceView.tsx`** — swap `<RefreshCw size={20} className="animate-spin" style={{ marginRight: 8 }} />` → `<InlineSpinner size="md" className="mr-2" />`. Wrap container in `role="status" aria-live="polite"`. Remove `RefreshCw` from the lucide-react import block. Add `import { InlineSpinner } from '@/components/loading';`.

## What was changed

- `components/loading/index.tsx`:
  - `InlineButtonSpinnerSize` widened to 4 variants and re-exported under canonical name `InlineSpinnerSize` (`'sm' | 'md' | 'lg' | 'xl'`).
  - New canonical `InlineSpinner` component replaces the body of the old `InlineButtonSpinner`. Same SVG structure (track circle + quarter-arc head, both `stroke="currentColor"`, `strokeOpacity={0.3}` on track, `strokeLinecap="round"` on head, `aria-hidden="true" focusable="false"`, `animate-spin`), now with the 4-size table: `sm` = w-4 h-4, `md` = w-5 h-5, `lg` = w-8 h-8, `xl` = w-12 h-12.
  - Backward-compat: `export const InlineButtonSpinner = InlineSpinner;` plus type aliases `InlineButtonSpinnerSize` / `InlineButtonSpinnerProps`. All TASK-013 call sites (GrandRoundsMode 3 × `size="md"`, PatientEncounterMode 2 × default + 3 × `size="sm"`) keep working unchanged.
  - JSDoc rewritten: lists the three legitimate use cases (buttons, inline status rows, container overlays) with pointer-references to `ClinicalSkeleton` (multi-line skeleton blocks), `Loader` (full-viewport overlays), and `DrillLoadingState` (drill-question layouts).

- `components/library/DrugReferenceLibrary.tsx`:
  - Added `import { InlineSpinner } from '@/components/loading';` below the `DrugMaster` import.
  - `LoadingOverlay` helper: replaced the 48 px `<div className="w-12 h-12 border-4 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin mb-4" />` with `<InlineSpinner size="xl" className="text-[var(--color-accent)] mb-4" />`. Added `role="status" aria-live="polite"` on the surrounding flex container. Used by both `<LoadingOverlay message="Loading drug classes..." />` and `<LoadingOverlay message="Loading medications..." />` call sites (unchanged).
  - Line 580 `RefreshCw` refresh-button icon intentionally untouched.

- `components/library/SmartPDFViewer.tsx`:
  - Removed `Loader2` from the `lucide-react` import (only reference in the file).
  - Added `import { InlineSpinner } from '@/components/loading';`.
  - `!sdkReady` overlay: swapped `<Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" aria-hidden />` for `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />`. Added `role="status" aria-live="polite" aria-label="Loading PDF viewer"` on the wrapping absolute-inset div.

- `components/library/ContextWidget.tsx`:
  - Removed `Loader2` from the `lucide-react` import (only reference in the file).
  - Added `import { InlineSpinner } from '@/components/loading';`.
  - Loading-state branch: swapped `<Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />` for `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />`. Added `role="status" aria-live="polite" aria-label={`Loading ${title.toLowerCase()}`}` on the wrapping centered-flex div (`title` is the computed "Pharmacology" / "Pathophysiology" label in scope).

- `components/library/ReferenceHub.tsx`:
  - Removed `RefreshCw` from the `lucide-react` import (only used in the two migrated spots).
  - Added `import { InlineSpinner } from '@/components/loading';`.
  - Line 327 "Searching across all reference types..." row: swapped `<RefreshCw size={14} className="animate-spin" />` for `<InlineSpinner size="sm" />`; added `role="status" aria-live="polite"` on the container.
  - Line 439 "Loading reference library..." row: same swap + same a11y attributes.

- `components/library/HighYieldSummary.tsx`:
  - Removed `RefreshCw` from the `lucide-react` import (only reference).
  - Added `import { InlineSpinner } from '@/components/loading';`.
  - Per-group `group.loading` ternary branch: swapped `<RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />` for `<InlineSpinner size="sm" className="text-[var(--color-text-secondary)]" />`.

- `components/library/GenericReferenceView.tsx`:
  - Removed `RefreshCw` from the `lucide-react` import (only reference).
  - Added `import { InlineSpinner } from '@/components/loading';`.
  - Top-level `if (loading)` branch: swapped `<RefreshCw size={20} className="animate-spin" style={{ marginRight: 8 }} />` for `<InlineSpinner size="md" className="mr-2" />`. Added `role="status" aria-live="polite"` on the wrapping centered-flex div.

## Verification

- **Typecheck** (`NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`): **zero errors** in any of the 7 touched files (`components/loading/index.tsx`, `components/library/DrugReferenceLibrary.tsx`, `components/library/SmartPDFViewer.tsx`, `components/library/ContextWidget.tsx`, `components/library/ReferenceHub.tsx`, `components/library/HighYieldSummary.tsx`, `components/library/GenericReferenceView.tsx`). Repo-wide error count: **1,151 error lines** (previously 1,152 in TASK-013 baseline) — one *fewer* error, attributable to the orphaned-import cleanups unused by the migrated files. Zero new errors introduced.
- **Backward-compat for TASK-013 call sites:** `InlineButtonSpinner` remains a named export (aliased to `InlineSpinner`), and the type aliases `InlineButtonSpinnerSize` / `InlineButtonSpinnerProps` remain exported. The 8 TASK-013 call sites (`GrandRoundsMode` 3 × `size="md"`, `PatientEncounterMode` 2 × default + 3 × `size="sm"`) were not touched and continue to compile and render identically. Verified by re-greping: `grep -rn "InlineButtonSpinner" components/` still returns the TASK-013 call sites, and the lucide `Loader2` orphan was removed in TASK-013.
- **Behavioral parity check:**
  - **DrugReferenceLibrary's `LoadingOverlay`:** Previously rendered a 48 px CSS ring via `border-4 border-[var(--color-accent)]/20 border-t-[var(--color-accent)]`. Now renders a 48 px SVG ring with `stroke="currentColor"` + `stroke-opacity={0.3}` on the track and a full-opacity quarter-arc head. The `className="text-[var(--color-accent)]"` on the primitive sets the `color`, so `currentColor` resolves to the same accent color the old ring used. Size is pixel-identical (`w-12 h-12`). The spin animation is Tailwind's `animate-spin` in both cases.
  - **SmartPDFViewer overlay:** `Loader2` (lucide) was a 32 px SVG icon with dashed-arc segments. `InlineSpinner size="lg"` is a 32 px SVG ring with a rotating head. Visual weight is very close; the canonical ring is marginally cleaner and matches the design system. `text-[var(--color-text-muted)]` is preserved verbatim. The previously-missing `role="status"` + `aria-label` now make the loading state announce correctly.
  - **ContextWidget overlay:** `Loader2` at `w-6 h-6` (24 px) → `InlineSpinner size="lg"` at `w-8 h-8` (32 px). Slight visual upscale (~8 px) — chosen deliberately because `lg` is the standard overlay size in the new scale and the ContextWidget loading block has plenty of vertical padding (`py-8`) to accommodate. The `text-[var(--color-text-muted)]` color override is preserved. Added `role="status" aria-live="polite" aria-label={`Loading ${title.toLowerCase()}`}` surfaces the loading state to screen readers for the first time.
  - **ReferenceHub inline status rows (both line 327 and line 439):** `RefreshCw size={14}` (14 px inline) → `InlineSpinner size="sm"` at `w-4 h-4` (16 px). Slight upscale (~2 px); the primitive's ring visual is less busy than `RefreshCw`'s double-arrow glyph and reads more clearly as "loading" than "refresh in progress". Color inherits from the parent's `color: 'var(--color-text-secondary)'` inline style via `currentColor`, so the visible color is unchanged. `role="status" aria-live="polite"` newly announces the loading state.
  - **HighYieldSummary group-loading indicator:** `RefreshCw size={14}` (14 px) with hard-coded `color: 'var(--color-text-secondary)'` → `InlineSpinner size="sm"` (16 px) with `className="text-[var(--color-text-secondary)]"`. Same visible color, ~2 px size bump. The parent `<button>` already serves as the announcement anchor; the spinner is pure visual affordance.
  - **GenericReferenceView full-container loader:** `RefreshCw size={20}` (20 px) → `InlineSpinner size="md"` at `w-5 h-5` (20 px). Pixel-identical bounding box. `mr-2` replaces the inline `marginRight: 8` style (same 8 px gap). `role="status" aria-live="polite"` added — previously the `div` had no a11y role, so "Loading {entity}..." was invisible to screen readers.
- **Accessibility summary:** 5 of the 7 migrated spots GAINED proper `role="status"` / `aria-live="polite"` / `aria-label` attributes they previously lacked. No spot LOST any a11y affordance (the old `aria-hidden` on SmartPDFViewer's `Loader2` is preserved via the primitive's built-in `aria-hidden="true"`).
- **Diff footprint:** 7 files touched (1 primitive + 6 consumers). 9 occurrences classified (7 migrated, 2 kept as intentional refresh-button icons). 1 new size-table extension (`lg`, `xl`). 3 orphaned import removals (`Loader2` from SmartPDFViewer + ContextWidget, `RefreshCw` from ReferenceHub + HighYieldSummary + GenericReferenceView). Net change is additive on the primitive side and simplifying on the consumer side.

## Audit delta

- `AUDIT_RECONCILIATION.md` §7 "Loading-state normalization rollout" narrows once more: previously `partial` (post-TASK-013) with inline-button cluster closed + ~25 other `animate-spin` files queued. After TASK-014: the **clinical-library cluster is closed** (6 files, 7 migrations, 2 intentional keepers documented); the remaining cluster scope has shrunk proportionally. Status stays `partial` with an explicitly narrower remaining scope. The "~25 other animate-spin files" estimate in TASK-013 has been superseded by the real number (**103 total `animate-spin` matches** across `components/` pre-TASK-014; now 96 post-TASK-014).
- `UNFINISHED_WORK_MASTER_AUDIT.md` §6 action "Finish migration to `components/loading` primitives across adaptive/session and mode shells" — all loading affordances in the clinical-library hub (`components/library/**`) now route through the canonical `InlineSpinner` primitive, except the 2 documented `RefreshCw`-as-refresh-glyph call sites which are intentional idiomatic UI and NOT loading beacons.
- Zod audit counts (PASS/WARN_OUT_OF_BAND/WARN_MANUAL_ONLY/FAIL = 176/8/3/2) unchanged — this task does not touch `functions/api/**`.

## Follow-ups

- **TASK-015+ animate-spin sweep, per-cluster.** 96 remaining matches across `components/` split approximately: dashboard (~15 files), admin (~15 files), modes (~10 files), toolkit (~10 files), analytics (~8 files), OSCE (~8 files), drill (~8 files), session (~6 files), navigation/command palette (~3 files), plus pages/. The next sprint should pick ONE cluster, run the same classify-and-migrate workflow, and land a reviewable diff. Recommended order: session → drill → modes (highest user-facing visibility) → dashboard → admin (more diffuse). Do not attempt to batch multiple clusters in one sprint — classification is the long pole, not the mechanical swap.
- **Consider an `InlineSpinnerWithLabel` or `LoadingRow` helper.** Four of the TASK-014 migrations pair an `InlineSpinner size="sm"` with a short status label in a flex-row container (`display: flex; gap: 8px; color: var(--color-text-secondary); font-size: 13px;`). A tiny wrapper `<LoadingRow>Loading reference library…</LoadingRow>` could encode the layout once and enforce `role="status"` automatically. Very low priority — the three-line `<div role="status" aria-live="polite" style={...}><InlineSpinner size="sm" /> label</div>` idiom is fine and doesn't block anything.
- **Docblock visibility in IDE.** The rewritten JSDoc on `InlineSpinner` now lists all three use cases and points at the other primitives for the cases it's not right for. This is the canonical onboarding surface for future contributors — no separate doc needed.
- **Name migration path.** `InlineButtonSpinner` is the backward-compat alias; new code should prefer `InlineSpinner`. Over time, the 8 TASK-013 call sites can be rewritten to the canonical name in a drive-by `chore(ui)` pass, but that's cosmetic — there's no functional benefit and the alias will stay in place indefinitely.
