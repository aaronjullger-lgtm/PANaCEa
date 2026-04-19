# TASK-019 — Migrate modes + toolkit cluster animate-spin loaders to canonical InlineSpinner

- **Status:** completed (uncommitted — git index.lock held at host level; user to commit at convenience)
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** pending
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / M (combined cluster — 14 files, 16 migrations, 2 intentional keeps)
- **Audit reference:** Continuation of the cluster-by-cluster sweep (TASK-014 library, TASK-015 dashboard, TASK-017 analytics, TASK-018 drill/session).

## Verify-first block

After TASK-018 closed the drill + session cluster (15 migrations), modes + toolkit was the next logical cluster: smaller than admin, higher ROI than obscure pages. These live under `components/modes/` and `components/toolkit/` respectively.

### Modes-cluster inventory — 2026-04-17

```
components/modes/AntibioticMode.tsx:813              <div w-5 h-5 border-2 ... animate-spin/>       — button busy             (MIGRATE — size="md")
components/modes/AntibioticMode.tsx:835              <div w-16 h-16 border-4 ... animate-spin/>     — full-screen loader      (MIGRATE — size="xl")
components/modes/osce/OSCEHistoryPanel.tsx:96        <Loader w-5 h-5 animate-spin/>                 — history loading row     (MIGRATE — size="md")
components/modes/osce/OSCESimulator.tsx:241          <div w-12 h-12 border-4 ... animate-spin/>     — station loader          (MIGRATE — size="xl")
components/modes/osce/OSCELiveSession.tsx:278        <Loader2 w-5 h-5 animate-spin/>                — connecting indicator    (MIGRATE — size="md")
components/modes/osce/OrderPanel.tsx:414             <div w-8 h-8 border-2 ... animate-spin/>       — items loading           (MIGRATE — size="lg")
components/modes/FluidElectrolyteMode.tsx:343        <div w-5 h-5 border-2 ... animate-spin/>       — button busy             (MIGRATE — size="md")
components/modes/FluidElectrolyteMode.tsx:365        <div w-16 h-16 border-4 ... animate-spin/>     — full-screen loader      (MIGRATE — size="xl")
components/modes/BlueprintComplianceAuditorMode.tsx:243 <RefreshCw animate-spin conditional/>       — refresh button          (KEEP — intentional)
components/modes/ReasoningTutorMode.tsx:263          <Loader2 h-4 w-4 animate-spin/>                — reasoning indicator     (MIGRATE — size="sm")
components/modes/ReasoningTutorMode.tsx:300          <Loader2 h-4 w-4 animate-spin/>                — send-button busy        (MIGRATE — size="sm")
components/modes/CramMode.tsx:287                    <Loader2 w-12 h-12 animate-spin/>              — generation loader       (MIGRATE — size="xl")
components/modes/CommuterMode.tsx:74                 <div h-8 w-8 animate-spin/>                    — session loader          (MIGRATE — size="lg")
components/modes/FullSitDownTestMode.tsx:132         <div h-12 w-12 animate-spin/>                  — exam session loader     (MIGRATE — size="xl")
components/modes/PolypharmacyPuzzleMode.tsx:376      <Loader2 w-12 h-12 animate-spin/>              — med case loader         (MIGRATE — size="xl")
```

Modes total: 14 migrations + 1 intentional keep across 11 files.

### Toolkit-cluster inventory — 2026-04-17

```
components/toolkit/ClinicalMotionFlashcards.tsx:352          <Loader2 w-4 h-4 animate-spin/>         — generating button      (MIGRATE — size="sm")
components/toolkit/ClinicalMotionFlashcards.tsx:400          <Loader2 w-3 h-3 animate-spin/>         — polling indicator       (MIGRATE — size="sm")
components/toolkit/calculators/InstantCalcView.tsx:109       <Loader2 w-4 h-4 animate-spin/>         — generate-button busy    (MIGRATE — size="sm")
components/toolkit/MnemonicGenerator.tsx:281                 <RefreshCw w-5 h-5 animate-spin/>       — generating indicator    (MIGRATE — size="md")
components/toolkit/MnemonicGenerator.tsx:353                 <RefreshCw animate-spin conditional/>   — try-again button         (KEEP — intentional)
components/toolkit/LectureConverter.tsx:191                  <Loader2 w-4 h-4 animate-spin/>         — generate-button busy    (MIGRATE — size="sm")
components/toolkit/calculators/scoring/DynamicScoringCalculator.tsx:342 <RefreshCw size=20 animate-spin/> — scoring-system loader (MIGRATE — size="md")
components/toolkit/quickref/quickref-print.css:15            .animate-spin { ... } print override     — print CSS               (KEEP — stylesheet, not runtime)
```

Toolkit total: 6 migrations + 1 intentional keep (Mnemonic try-again button) + 1 stylesheet keep across 5 files.

**Cluster grand total:** 20 migrations + 2 intentional keeps + 1 stylesheet keep across 14 files.

## What was changed

### Modes cluster

1. **`components/modes/AntibioticMode.tsx`** — two swaps:
   - Line 813 (button busy): `<div w-5 h-5 border-2 ...>` → `<InlineSpinner size="md" />`.
   - Line 835 (loading state): `<div w-16 h-16 border-4 ... mx-auto>` → wrapped `<InlineSpinner size="xl" text-[var(--color-accent)] />` in `<div flex justify-center>` to preserve centering. Added `aria-live="polite"` to existing `role="status"`.
   - Added `import { InlineSpinner } from '@/components/loading';`.

2. **`components/modes/FluidElectrolyteMode.tsx`** — same two-swap pattern as AntibioticMode:
   - Line 343 (button busy): `<div w-5 h-5 border-2 ...>` → `<InlineSpinner size="md" />`.
   - Line 365 (loading state): `<div w-16 h-16 border-4 ... mx-auto>` → wrapped `<InlineSpinner size="xl" text-[var(--color-accent)] />` in flex-justify-center div. Added `aria-live="polite"`.
   - Added `InlineSpinner` import.

3. **`components/modes/osce/OSCEHistoryPanel.tsx`** — swapped `<Loader w-5 h-5 animate-spin text-data-neutral />` for `<InlineSpinner size="md" className="text-data-neutral" />`. Removed `Loader` from `lucide-react` import (only usage). Added `role="status" aria-live="polite"` to the flex wrapper. Added InlineSpinner import.

4. **`components/modes/osce/OSCESimulator.tsx`** — swapped `<div w-12 h-12 border-4 ... mx-auto mb-4>` station loader for `<InlineSpinner size="xl" text-[var(--color-accent)] />` wrapped in `<div flex justify-center mb-4>`. Added `aria-live="polite"` to existing `role="status"`. Added InlineSpinner import.

5. **`components/modes/osce/OSCELiveSession.tsx`** — swapped `<Loader2 w-5 h-5 animate-spin />` for `<InlineSpinner size="md" />`. Removed `Loader2` from `lucide-react` import (only usage). Kept existing `role="status" aria-live="polite"` wrapper. Added InlineSpinner import.

6. **`components/modes/osce/OrderPanel.tsx`** — swapped `<div w-8 h-8 border-2 ...>` for `<InlineSpinner size="lg" text-[var(--color-accent)] />`. Added `aria-live="polite"` to existing `role="status"`. Added InlineSpinner import.

7. **`components/modes/BlueprintComplianceAuditorMode.tsx`** — KEPT (intentional refresh button `<RefreshCw className={\`w-4 h-4 ${refreshing ? 'animate-spin' : ''}\`} />`).

8. **`components/modes/ReasoningTutorMode.tsx`** — two swaps:
   - Line 263 (reasoning indicator): `<Loader2 h-4 w-4 animate-spin />` → `<InlineSpinner size="sm" />`.
   - Line 300 (send button): `<Loader2 h-4 w-4 animate-spin />` → `<InlineSpinner size="sm" />`.
   - Removed `Loader2` from `lucide-react` import (both usages migrated). Added InlineSpinner import.

9. **`components/modes/CramMode.tsx`** — swapped `<Loader2 w-12 h-12 animate-spin text-[var(--color-data-provisional)] mx-auto mb-4 />` for `<InlineSpinner size="xl" text-[var(--color-data-provisional)] />` wrapped in `<div flex justify-center mb-4>`. Removed `Loader2` from `lucide-react` import (only usage). Added `InlineSpinner` to existing `{ DrillLoadingState }` import. Added `aria-live="polite"`.

10. **`components/modes/CommuterMode.tsx`** — swapped `<div inline-block h-8 w-8 animate-spin />` for `<InlineSpinner size="lg" text-[var(--color-accent)] />` wrapped in `<div flex justify-center>`. Added `aria-live="polite"` to existing `role="status"`. Added InlineSpinner import.

11. **`components/modes/FullSitDownTestMode.tsx`** — swapped `<div inline-block animate-spin h-12 w-12 />` for `<InlineSpinner size="xl" text-primary />` wrapped in flex-justify-center div. Added `aria-live="polite"` to existing `role="status"`. Added InlineSpinner import.

12. **`components/modes/PolypharmacyPuzzleMode.tsx`** — swapped `<Loader2 w-12 h-12 text-[var(--color-accent)] animate-spin mx-auto mb-4 />` for `<InlineSpinner size="xl" text-[var(--color-accent)] />` wrapped in flex-justify-center div. Removed `Loader2` from `lucide-react` import (only usage). Added `aria-live="polite"`. Added InlineSpinner import.

### Toolkit cluster

13. **`components/toolkit/ClinicalMotionFlashcards.tsx`** — two swaps:
    - Line 352 (generate button busy): `<Loader2 w-4 h-4 animate-spin />` → `<InlineSpinner size="sm" />`.
    - Line 400 (polling indicator): `<Loader2 w-3 h-3 animate-spin />` → `<InlineSpinner size="sm" />`. Added `role="status" aria-live="polite"` to the parent `<p>`.
    - Removed `Loader2` from `lucide-react` import (both usages migrated). Added InlineSpinner import.

14. **`components/toolkit/calculators/InstantCalcView.tsx`** — swapped `<Loader2 w-4 h-4 animate-spin />` for `<InlineSpinner size="sm" />`. Removed `Loader2` from `lucide-react` import (only usage). Added InlineSpinner import.

15. **`components/toolkit/MnemonicGenerator.tsx`** — one migration + one intentional keep:
    - Line 281 (loading indicator): `<RefreshCw w-5 h-5 text-[var(--color-accent)] animate-spin />` → `<InlineSpinner size="md" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite"` to flex wrapper.
    - Line 354 (try-again button): KEPT — RefreshCw glyph with conditional animate-spin is intentional pattern for refresh-style buttons. `RefreshCw` import retained.
    - Added InlineSpinner import.

16. **`components/toolkit/LectureConverter.tsx`** — swapped `<Loader2 w-4 h-4 animate-spin />` for `<InlineSpinner size="sm" />`. Removed `Loader2` from `lucide-react` import (only usage). Added InlineSpinner import.

17. **`components/toolkit/calculators/scoring/DynamicScoringCalculator.tsx`** — swapped `<RefreshCw size={20} animate-spin marginRight: 8 />` for `<InlineSpinner size="md" />` wrapped in an inline-flex span (inline style preserved `marginRight: 8` behavior). Kept `RefreshCw` import (still used for Reset button at line 436). Added `aria-live="polite"` to existing `role="status"`. Added InlineSpinner import.

## Verification

- Static pattern check: `grep -rn "animate-spin\|Loader2" components/modes/ components/toolkit/` returns **only the 2 intentional refresh-button keeps plus the print stylesheet** — no remaining cosmetic animate-spin or Loader2 imports.
- All migrations pair the spinner with a parent `role="status"` + `aria-live="polite"` for screen-reader announcement; the spinner SVG itself remains `aria-hidden` (consistent with TASK-013 through TASK-018 pattern).
- Size selection matched original pixel sizes:
  - w-3 / w-4 (12–16px) → `size="sm"` (w-4 = 16px)
  - w-5 (20px) → `size="md"` (w-5 = 20px — exact)
  - w-8 (32px) → `size="lg"` (w-8 = 32px — exact)
  - w-10 / w-12 / w-16 (40–64px) → `size="xl"` (w-12 = 48px — closest)
- DynamicScoringCalculator keeps both `RefreshCw` (for Reset button) and adds InlineSpinner (for loading state) — no unused imports.
- No component API changes; all migrations are purely internal render-tree refactors.

## Cumulative cluster sweep status

| Cluster | Task | Status | Migrations | Dead cleanups | Intentional keeps |
|---|---|---|---|---|---|
| Library | TASK-014 | completed | 7 | — | 2 |
| Dashboard | TASK-015 | completed | 6 | — | 1 |
| Analytics | TASK-017 | completed | 7 | — | 1 |
| Drill + Session | TASK-018 | completed | 15 | 2 | 0 |
| Modes + Toolkit | TASK-019 | completed | 20 | — | 2 (+1 CSS) |
| Admin | TASK-020+ | pending | ~22 files | — | — |
| Misc (pages/osce/modals) | TASK-021+ | pending | ~15 files | — | — |

Running total: 55 migrations across 46 files, 2 dead-import cleanups, 6 intentional keeps.

## Remaining clusters (queued)

- **Admin (~22 files):** largest remaining cluster. Will split into 2–3 sub-sprints: content-editors, review-queues/refinery, dashboards.
- **Misc (~15 files):** pages (MyLibraryPage, StudyCompanionPage, TutorChatPage), OSCE (SOAPDraftPanel, SOAPNoteTrainer, AudioInterface), modals, navigation (CommandPalette), knowledge, social, external, etc.
