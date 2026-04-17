# TASK-017 — Migrate analytics-cluster animate-spin loaders to canonical InlineSpinner

- **Status:** completed (uncommitted — git index.lock held at host level; user to commit at convenience)
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** pending
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** Continuation of the cluster-by-cluster sweep started in TASK-014 (library) and TASK-015 (dashboard).

## Verify-first block

After TASK-015 closed the 6 dashboard-cluster migrations, analytics was the next highest-ROI cluster — 7 files, 8 migratable loaders, and unlike admin it has no upstream migrations blocking it.

### Analytics-cluster inventory — 2026-04-17

```
components/analytics/AdvancedLearningProfileDashboard.tsx:235   <RefreshCw w-10 h-10 animate-spin/>   — full-page loading state       (MIGRATE — size="xl")
components/analytics/AnalyticsDashboard.tsx:832                 <div w-3 h-3 border-2 animate-spin/>   — inline "Fetching data..."   (MIGRATE — size="sm")
components/analytics/ConfusionMatrix.tsx:82                     <Loader2 w-4 h-4 animate-spin/>       — inline "Loading..." row      (MIGRATE — size="sm")
components/analytics/ConfusionMatrix.tsx:130                    <Loader2 w-3 h-3 animate-spin/>       — button busy indicator        (MIGRATE — size="sm")
components/analytics/DatabaseAnalyticsDashboard.tsx:245         <RefreshCw animate-spin/> conditional  — refresh button icon         (KEEP — intentional)
components/analytics/LearningProfileDashboard.tsx:158           <RefreshCw w-8 h-8 animate-spin/>      — centered full-page loader   (MIGRATE — size="lg")
components/analytics/SyllabusDecompiler.tsx:203                 <Loader2 w-12 h-12 animate-spin/>      — upload/processing state     (MIGRATE — size="xl")
components/analytics/TopicMasteryBreakdown.tsx:109              <Loader2 w-5 h-5 animate-spin/>        — inline "Loading..." row     (MIGRATE — size="md")
```

Total: 8 occurrences across 7 files → 7 migrations, 1 intentional keep (DatabaseAnalyticsDashboard refresh-button icon, matches TASK-014/015 precedent — conditional `animate-spin` on a meaningful glyph).

## What was changed

1. **`components/analytics/AdvancedLearningProfileDashboard.tsx`** — swapped `<RefreshCw w-10 h-10 animate-spin />` for `<InlineSpinner size="xl" className="text-[var(--color-accent)]" />`. Removed `RefreshCw` from the `lucide-react` import (only reference was this loading state). Added `role="status" aria-live="polite"` on the centered flex container. Added `import { InlineSpinner } from '@/components/loading';`.

2. **`components/analytics/AnalyticsDashboard.tsx`** — swapped the handrolled `<div w-3 h-3 border-2 ... animate-spin />` tiny spinner inside the Memory Stability Growth card header for `<InlineSpinner size="sm" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite"` on the wrapping flex-row. Added `InlineSpinner` to the existing `{ SkeletonLoader, SkeletonCard }` import from `@/components/loading`.

3. **`components/analytics/ConfusionMatrix.tsx`** — two swaps:
   - Line 82: `<Loader2 w-4 h-4 animate-spin />` → `<InlineSpinner size="sm" />`. The parent already had `role="status" aria-live="polite"` from a prior pass; left intact.
   - Line 130: `<Loader2 w-3 h-3 animate-spin />` inside the "Compare" button busy indicator → `<InlineSpinner size="sm" />`. Left the `Sparkles` fallback alone (static icon).
   - Removed `Loader2` from the `lucide-react` import (both references now migrated).
   - Added `import { InlineSpinner } from '@/components/loading';`.

4. **`components/analytics/LearningProfileDashboard.tsx`** — swapped `<RefreshCw w-8 h-8 animate-spin />` for `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite" aria-label="Loading learning profile"` on the centered flex container. Kept `RefreshCw` in imports — it's still used at line 211 as a static icon in the action bar (not a spinner). Added `import { InlineSpinner } from '@/components/loading';`.

5. **`components/analytics/SyllabusDecompiler.tsx`** — swapped `<Loader2 w-12 h-12 mx-auto mb-3 animate-spin text-[var(--color-accent)] />` for a wrapping `<div className="mx-auto mb-3 flex justify-center"><InlineSpinner size="xl" className="text-[var(--color-accent)]" /></div>` (needed the wrapper because the original relied on `mx-auto` centering; `InlineSpinner` is inline-flex so a flex-justify-center wrapper is the cleanest equivalent). Added `role="status" aria-live="polite"` on the outer upload-progress container. Removed `Loader2` from the `lucide-react` import (only reference). Added `import { InlineSpinner } from '@/components/loading';`.

6. **`components/analytics/TopicMasteryBreakdown.tsx`** — swapped `<Loader2 w-5 h-5 animate-spin mr-2 />` for `<InlineSpinner size="md" className="mr-2" />`. Added `role="status" aria-live="polite"` on the wrapping flex container. Removed `Loader2` from the `lucide-react` import (only reference). Added `import { InlineSpinner } from '@/components/loading';`.

## Verification

- Static pattern check: `grep -rn "animate-spin\|Loader2" components/analytics/` returns only the intentional `RefreshCw` refresh-button icon in `DatabaseAnalyticsDashboard.tsx:245`. All other analytics loaders now route through the canonical `InlineSpinner`.
- All migrations pair the spinner with a parent `role="status"` + `aria-live="polite"` for screen-reader announcement — the spinner SVG itself remains `aria-hidden` (matches TASK-013/014/015 pattern).
- Size selection logic matched original pixel sizes:
  - w-3 (12px) → `size="sm"` (w-4 = 16px — closest proportion)
  - w-4 (16px) → `size="sm"` (w-4 = 16px — exact)
  - w-5 (20px) → `size="md"` (w-5 = 20px — exact)
  - w-8 (32px) → `size="lg"` (w-8 = 32px — exact)
  - w-10 / w-12 (40–48px) → `size="xl"` (w-12 = 48px — exact / closest)

## Cumulative cluster sweep status

| Cluster | Task | Status | Migrations | Intentional keeps |
|---|---|---|---|---|
| Library | TASK-014 | completed | 7 | 2 (`DrugReferenceLibrary.tsx`, `ClinicalReferenceLibrary.tsx` refresh buttons) |
| Dashboard | TASK-015 | completed | 6 | 1 (`RecommendationFeed.tsx` refresh button) |
| Analytics | TASK-017 | completed | 7 | 1 (`DatabaseAnalyticsDashboard.tsx` refresh button) |
| Admin | TASK-018+ | pending | ~22 files | — |
| Drill/session | TASK-019+ | pending | ~10 files | — |
| Modes | TASK-020+ | pending | ~5 files | (CramMode progress block is intentional keeper) |
| Toolkit/misc | TASK-021+ | pending | ~5 files | — |

Running total: 20 migrations across 19 files, 4 intentional keeps across 4 files.

## Remaining clusters (queued)

- Admin (~22 files): `components/admin/**` — content editors, dashboards, review queues, refinery. Largest remaining cluster; should split into 2–3 sub-sprints.
- Drill/session (~10 files): drill sessions, custom session runners.
- Modes (~5 files): auxiliary modes not covered by TASK-012.
- Toolkit/misc (~5 files): calculators, interpreters, compliance.
