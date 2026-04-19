# TASK-015 — Migrate dashboard animate-spin loaders to canonical InlineSpinner

- **Status:** completed (uncommitted — git index.lock held at host level during session; user to commit at convenience)
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** pending
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / S
- **Audit reference:** `docs/implementation/IMPLEMENTATION_QUEUE.md` row "TASK-014+ — remainder of loading-state rollout"; continues the cluster-by-cluster sweep started in TASK-014 (clinical library).

## Verify-first block

After TASK-014 closed the 7 library-cluster migrations, the remaining `animate-spin` inventory split into six natural clusters (dashboard, admin, analytics, modes, drill/session, toolkit/misc). Dashboard is the highest-traffic cluster — it is the landing surface users hit on every app open — so it is prioritized first.

### Dashboard-cluster inventory — 2026-04-17

```
components/dashboard/InsightsHub.tsx:195                                   <Loader2 w-6 h-6/>            — inline overlay           (MIGRATE — size="lg")
components/dashboard/RecommendationFeed.tsx:291                            <RefreshCw w-4 h-4 ${loading ? 'animate-spin' : ''}/>  — refresh-btn icon (KEEP — intentional)
components/dashboard/RecommendationFeed.tsx:364                            <Loader2 w-8 h-8/>            — container overlay        (MIGRATE — size="lg")
components/dashboard/GapAnalysisDashboard.tsx:365                          <div 2-border ring/>          — container overlay        (MIGRATE — size="lg")
components/dashboard/StudyPathDashboard/index.tsx:231                      <div 2-border ring/>          — container overlay        (MIGRATE — size="lg")
components/dashboard/StudyPathDashboard/ProgressProjectionChart.tsx:87     <div b-2 border ring/>        — container overlay        (MIGRATE — size="lg")
components/dashboard/ClinicalProfile/ClinicalProfileDashboard.tsx:64       <Loader2 h-6 w-6/>            — inline text row          (MIGRATE — size="lg")
```

Total: 7 occurrences across 6 files → 6 migrations, 1 intentional keep (same pattern as library-cluster refresh-button icon in `DrugReferenceLibrary.tsx:580` and `ClinicalReferenceLibrary.tsx:660`, which TASK-014 also left untouched).

## What was changed

1. **`components/dashboard/InsightsHub.tsx`** — swapped `<Loader2 w-6 h-6 animate-spin />` for `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />`. Wrapped the centered flex container in `role="status" aria-live="polite" aria-label="Loading insights"`. Removed `Loader2` from the `lucide-react` import (only reference). Added `import { InlineSpinner } from '@/components/loading';`.

2. **`components/dashboard/RecommendationFeed.tsx`** — swapped the `<Loader2 w-8 h-8 animate-spin mb-2 text-[var(--color-accent)] />` in the empty-state "Analyzing your learning profile..." block for `<InlineSpinner size="lg" className="text-[var(--color-accent)] mb-2" />`. Added `role="status" aria-live="polite"` on the wrapper. Removed `Loader2` from the `lucide-react` import (the line-291 `RefreshCw` refresh-button icon stays — conditional `animate-spin` on a meaningful glyph is intentional per TASK-014 precedent). Added `import { InlineSpinner } from '@/components/loading';`.

3. **`components/dashboard/GapAnalysisDashboard.tsx`** — swapped the handrolled `<div h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-b-transparent />` for `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite"` on the centered flex-column container. Added `import { InlineSpinner } from '@/components/loading';` beside the existing `Button` import.

4. **`components/dashboard/StudyPathDashboard/index.tsx`** — same swap as #3 on the "Loading your personalized study path..." loading overlay. Added `role="status" aria-live="polite"`. Added `import { InlineSpinner } from '@/components/loading';` beside the existing `Button` import.

5. **`components/dashboard/StudyPathDashboard/ProgressProjectionChart.tsx`** — swapped `<div animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] />` for `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite"` on the wrapping centered container. Added `import { InlineSpinner } from '@/components/loading';`.

6. **`components/dashboard/ClinicalProfile/ClinicalProfileDashboard.tsx`** — swapped `<Loader2 h-6 w-6 animate-spin />` for `<InlineSpinner size="lg" />` (inherits `currentColor` from the enclosing `text-[var(--color-text-secondary)]` on the parent, so no `className` override needed). Added `role="status" aria-live="polite"`. Removed `Loader2` from the `lucide-react` import (only reference). Added `import { InlineSpinner } from '@/components/loading';`.

## Verification

- Static pattern check: `grep -n "animate-spin\|Loader2" components/dashboard/...` returns only the intentional `RefreshCw` refresh-button icon in `RecommendationFeed.tsx:292`. All other dashboard loaders now route through the canonical `InlineSpinner`.
- All migrations pair the spinner with a parent `role="status"` + `aria-live="polite"` for screen-reader announcement — the spinner itself remains `aria-hidden` (matches TASK-013/014 pattern).
- Size selection logic: every dashboard loader sits inside a min-height container ≥ 16rem; `size="lg"` (w-8 h-8) is the proportion that matched the originals most closely (originals were w-6 through w-8).

## Remaining clusters (queued for TASK-017+)

- Admin (~22 files): `components/admin/**` — content editors, dashboards, review queues, refinery
- Analytics (~7 files): AdvancedLearningProfileDashboard, AnalyticsDashboard, ConfusionMatrix, DatabaseAnalyticsDashboard, LearningProfileDashboard, SyllabusDecompiler, TopicMasteryBreakdown
- Drill/session (~10 files): drill sessions, custom session runners
- Modes (~5 files): auxiliary modes not covered by TASK-012 (CramMode progress block is intentional keeper)
- Toolkit/misc (~5 files): calculators, interpreters, compliance
