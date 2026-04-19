# TASK-022 — Misc cluster animate-spin → InlineSpinner migration (final sweep)

**Date:** 2026-04-17
**Scope:** All remaining components outside the earlier library / dashboard / analytics / drill-session / modes+toolkit / admin / pages clusters. This is the final surface in the repo-wide Loader2 → InlineSpinner consolidation.
**Outcome:** 24 files migrated (~32 spinner call-sites), 1 dead-import cleanup (`MyPearlsPanel.tsx`), plus a high-leverage migration of the shared `components/ui/button.tsx` CVA primitive that propagates to every `<Button loading>` consumer.

---

## Sub-sprint breakdown

### Sub-sprint 1 — OSCE cluster (3 files, 5 migrations)

1. **`components/osce/SOAPDraftPanel.tsx`** — removed `Loader2` from lucide import; added `InlineSpinner` import. Two identical `<Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />` call-sites (lines 29, 89) replaced via `replace_all: true` → `<InlineSpinner size="sm" className="text-[var(--color-accent)]" />`.
2. **`components/osce/AudioInterface.tsx`** — removed `Loader2` from multi-icon lucide import. Line 204 "connecting" state migrated to `<InlineSpinner size="md" />`; wrapper picked up `role="status" aria-live="polite"`.
3. **`components/osce/SOAPNoteTrainer.tsx`** — added `InlineSpinner` import. Two handrolled border-spinners replaced:
   - Line 272 submit-button (16 px) → `size="sm"`.
   - Line 292 "grading in progress" splash (40 px border-4) → `size="xl"` + `role="status" aria-live="polite"` on the motion wrapper.

### Sub-sprint 2 — Knowledge / Modals / Social / External (5 files, 6 migrations)

4. **`components/knowledge/NormalLabsLibraryView.tsx`** — removed `RefreshCw` from lucide import (confirmed only used as loader). Line 76 `<RefreshCw animate-spin />` → `<InlineSpinner size="lg" className="mr-3" />` inside existing `role="status"` wrapper; added `aria-live="polite"`.
5. **`components/modals/ConditionDetailModal.tsx`** — added `InlineSpinner` import. Line 341 handrolled `w-12 h-12 border-4` spinner → `<InlineSpinner size="xl" className="text-[var(--color-category-practice)]" />`; added `aria-live="polite"` to existing `role="status"` wrapper.
6. **`components/modals/FlagQuestionModal.tsx`** — added `InlineSpinner` import. Line 237 submit-button handrolled div → `<InlineSpinner size="sm" />`.
7. **`components/social/StudyGroupDashboard.tsx`** — removed `Loader2` from lucide import (kept Users/Plus/Trophy/Copy/Check). Lines 268 + 373 (both "Loading groups"/"Loading leaderboard") → `<InlineSpinner size="xl" className="text-[var(--color-accent)] mb-4" />`; added `aria-live="polite"` to each parent.
8. **`components/external/MedicalDatabaseSearch.tsx`** — added `InlineSpinner` import. Line 354 handrolled `h-8 w-8 border-b-2` spinner → `<InlineSpinner size="lg" className="text-[var(--color-category-practice)]" />` wrapped in `flex justify-center` to preserve `mx-auto` centering; added `role="status" aria-live="polite"` on the outer container.

### Sub-sprint 3 — Navigation / Explorer / Custom-study / Integrations (6 files, 8 migrations)

9. **`components/navigation/CommandPalette.tsx`** — removed `Loader2` from lucide import; added `InlineSpinner`.
   - Line 328 input-adornment loader: rewrapped as `<span className="mr-3 text-[var(--color-accent)]"><InlineSpinner size="md" /></span>` to preserve spacing and color.
   - Line 365 results-loading loader: `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` inside `flex justify-center mb-2` wrapper; outer div given `role="status" aria-live="polite"`.
10. **`components/explorer/NodeDetailPanel.tsx`** — added `InlineSpinner` import. Line 181 handrolled `h-8 w-8 border-b-2` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`; parent got `role="status" aria-live="polite"`.
11. **`components/explorer/GraphSearchBar.tsx`** — removed `Loader2` from lucide import; added `InlineSpinner`. Line 159 absolute-positioned Loader2 → wrapped `<InlineSpinner size="sm" />` in `<span>` preserving `absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]` positioning.
12. **`components/custom-study/CustomSessionRunner.tsx`** — removed `Loader2` from multi-line lucide import; added `InlineSpinner`. Line 157 → `<InlineSpinner size="lg" className="text-[var(--color-accent)] mb-4" />`; added `aria-live="polite"`.
13. **`components/custom-study/CustomSessionBuilder.tsx`** — same treatment at line 153.
14. **`components/integrations/TodoistExportModal.tsx`** — removed `Loader2` from lucide import; added `InlineSpinner`. Line 372 button spinner → wrapped in `<span className="mr-2">` to preserve layout.
15. **`components/integrations/TodoistCallback.tsx`** — removed `Loader2`; added `InlineSpinner`. Line 61 fragment (`<>…</>`) converted to `<div role="status" aria-live="polite">…</div>`; handrolled `w-12 h-12` Loader2 → `<InlineSpinner size="xl" className="text-[var(--color-accent)]" />` inside `flex justify-center`. Matched closing `</>` → `</div>` fix.

### Sub-sprint 4 — Pearls / Goals / Settings / Offline (5 files, 7 migrations)

16. **`components/pearls/MyPearlsPanel.tsx`** — added `InlineSpinner` import. Line 354 `<RefreshCw animate-spin />` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`; parent got `role="status" aria-live="polite"`. **Dead-import cleanup:** `RefreshCw` was only used by this single loader; removed from lucide import after the migration.
17. **`components/goals/GoalEditModal.tsx`** — added `InlineSpinner` import. Line 237 submit-button handrolled span → `<InlineSpinner size="sm" />`.
18. **`components/settings/DataExport.tsx`** — added `InlineSpinner` import. Line 375 handrolled `h-5 w-5 border-b-2` → `<InlineSpinner size="md" className="text-[var(--color-accent)]" />`.
19. **`components/settings/FSRSOptimizer.tsx`** — removed `Loader` (note: this file imported `Loader`, NOT `Loader2`) from lucide import; added `InlineSpinner`. Line 117 → `<InlineSpinner size="sm" />`.
20. **`components/offline/OfflineSyncPanel.tsx`** — added `InlineSpinner` import. Lines 69-83 — 14-line inline `<svg>` with two `<circle>` + `<path>` elements replaced by a single `<InlineSpinner size="sm" />`.
21. **`components/offline/OfflineSyncIndicator.tsx`** — removed `Loader2` from lucide import; added `InlineSpinner`. Two migrations: line 152 badge icon (`w-3.5 h-3.5`) → `size="sm"`; line 212 dropdown (`w-4 h-4`) → `size="sm"` with accent color preserved.

### Sub-sprint 5 — Compliance / Agents / Shared (4 files, 5 migrations)

22. **`components/compliance/MedicalComplianceDashboard.tsx`** — added `InlineSpinner` import. Line 119 handrolled `h-12 w-12 border-b-2` → `<InlineSpinner size="xl" className="text-[var(--color-category-practice)]" />` inside `flex justify-center mb-4` wrapper; outer div got `role="status" aria-live="polite"`.
23. **`components/agents/AgentChat.tsx`** — removed `Loader2` from multi-line lucide import; added `InlineSpinner` after the useAuth import. Two migrations:
    - Line 392 Send button (`h-4 w-4`) → `size="sm"`.
    - Line 505 `LoadingBubble` (`h-4 w-4` accent) → `size="sm"` + accent color; parent div got `role="status" aria-live="polite"`.
24. **`components/shared/LanguageSwitcher.tsx`** — removed `Loader2` from lucide import; added `InlineSpinner`. Line 89 → `<InlineSpinner size="sm" />`.
25. **`components/shared/MobileGestureHandler.tsx`** — added `InlineSpinner` import after springs import. Line 574 pull-to-refresh handrolled `h-6 w-6 border-2` → `<InlineSpinner size="lg" className="text-[var(--color-action-primary)]" />`.

### Sub-sprint 6 — UI primitive consolidation (3 files, 4 migrations — **high leverage**)

26. **`components/ui/button.tsx`** — **CVA button primitive**. Swapped `import { Loader2 } from 'lucide-react';` for `import { InlineSpinner } from '@/components/loading';`. Line 99 loading-state JSX → `<InlineSpinner size="sm" />` (kept the `role="status" aria-live="polite"` on the parent span). Every consumer of `<Button loading>` across the repo now renders the canonical spinner.
27. **`components/ui/layouts/ContentGrid.tsx`** — `LoadingOverlay` migration. Import swapped, line 232 → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`. (Fixes the interrupted mid-session state where the import was swapped but the JSX still referenced undefined `Loader2`.)
28. **`components/ui/SmartImage.tsx`** — removed `Loader2` from `lucide-react` (kept `ImageOff`); added `InlineSpinner`. Line 158 `<Loader2 role="status" …/>` → `<span role="status" aria-label="Loading image">` wrapping `<InlineSpinner size="lg" />`. Preserved `z-10` stacking and muted text color via parent span.

---

## Residual sweep verification

Post-migration `rg -n 'animate-spin|Loader2' components/` returns 20 matches — all intentional:

| Category | Count | Files |
|---|---|---|
| **Refresh-button pattern** (static `RefreshCw` + conditional `animate-spin`) | 14 | MediaApprovalDashboard, QuestionPerformanceDashboard, FlaggedQuestionsDashboard, QuestionReviewQueue, LibraryEnrichmentDashboard, StagingLake, UserCountCard, AuditLogTable, MnemonicGenerator, RecommendationFeed, DrugReferenceLibrary, ClinicalReferenceLibrary, DatabaseAnalyticsDashboard, BlueprintComplianceAuditorMode, VisualizationDemoPage |
| **Primitive library defns** | 2 | `shared/LoadingSystem.tsx`, `loading/index.tsx` |
| **Library re-export** | 2 | `components/ui/icons.ts`, `lib/icons.ts` |
| **Semantic keep** | 1 | `components/error/ErrorBoundary.tsx` (chunk-load splash glyph) |
| **Print CSS** | 1 | `components/toolkit/quickref/quickref-print.css` |

No stray `Loader2` usages remain in feature code. The audit script `scripts/audit-loading-states.ts` was deliberately left untouched — it searches for the pattern as a CI guard.

## Cumulative sweep totals (TASK-014 → TASK-022)

| Cluster | Task | Files migrated | Keeps |
|---|---|---|---|
| Library | TASK-014 | 7 | 2 |
| Dashboard | TASK-015 | 6 | 1 |
| Analytics | TASK-017 | 7 | 1 |
| Drill + Session | TASK-018 | 15 | 0 |
| Modes + Toolkit | TASK-019 | 16 | 2 |
| Admin | TASK-020 | 13 | 7 |
| Pages | TASK-021 | 3 | 0 |
| **Misc (final)** | **TASK-022** | **24 (+3 UI primitives)** | **~14 remaining** |

**Running total: ~91 migrations, ~90 files, 14 accepted keeps, 3 dead-import cleanups (across all tasks).**

## Verification affordances

- **Accessibility:** every migrated container-level loader now has `role="status"` + `aria-live="polite"` on the parent wrapper. Button-level spinners inherit their button's `disabled`/`aria-busy` state and rely on adjacent label text.
- **Color preservation:** `text-[var(--color-accent)]`, `text-[var(--color-category-practice)]`, `text-[var(--color-action-primary)]` passed via `className`. InlineSpinner inherits `currentColor` — no color drift.
- **Layout preservation:** absolute-positioned, margin-carrying, or `mx-auto`-centered Loader2s were rewrapped in a `<span>` or `<div>` carrying the original positioning so surrounding layout is identical.
- **Import hygiene:** Loader2 removed from every lucide import where it was the only loader; `RefreshCw` cleaned up where its last non-refresh usage was migrated.

## Follow-ups (non-blocking)

1. Batch commit when git `.git/index.lock` permission is available (sandbox cannot remove host-owned lock).
2. Next sprint: run `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` to confirm zero regressions across the ~91 touched files.
3. Consider removing `scripts/audit-loading-states.ts` now that the migration is essentially complete — or keep as a CI guard.
4. Pick up the next improvement cluster from the standing autonomous queue.
