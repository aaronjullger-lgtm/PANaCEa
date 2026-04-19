# TASK-021 — Migrate pages cluster animate-spin loaders to canonical InlineSpinner

- **Status:** completed
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** pending
- **Category:** UI hygiene / design system consolidation
- **Priority / Risk / Size:** Medium / Low / S (3 files, 8 migrations, 0 intentional keeps)
- **Audit reference:** Continuation of the cluster-by-cluster sweep (TASK-014 library, TASK-015 dashboard, TASK-017 analytics, TASK-018 drill/session, TASK-019 modes+toolkit, TASK-020 admin).

## Verify-first block

After the parallel-agent commits closed admin (TASK-020: `db2e2114` + `54421c2f` + `829c7912` + `8d8aa8ca` + `179725b1`) and modes/toolkit (TASK-019 folded into `829c7912`), the next highest-ROI cluster by surface area is the **top-level pages** cluster — `TutorChatPage`, `StudyCompanionPage`, `MyLibraryPage`. These are student-facing workspace shells for tutor chat, PDF study, and knowledge-cache management. Every session that routes through the tutor or library flows touches at least one.

### Pages-cluster inventory — 2026-04-17

```
components/pages/TutorChatPage.tsx:413      <Loader2 h-6 w-6 animate-spin text-accent/>  — tutor context loader (empty-state card)  (MIGRATE — size="lg")
components/pages/TutorChatPage.tsx:491      <Loader2 h-4 w-4 animate-spin/>              — Ask-tutor button busy state             (MIGRATE — size="sm")
components/pages/StudyCompanionPage.tsx:321 <Loader2 h-4 w-4 animate-spin/>              — approved-documents inline status row    (MIGRATE — size="sm")
components/pages/MyLibraryPage.tsx:420      <Loader2 h-4 w-4 animate-spin/>              — Choose-PDF upload button busy           (MIGRATE — size="sm")
components/pages/MyLibraryPage.tsx:456      <Loader2 h-8 w-8 animate-spin text-accent/>  — caches-loading container overlay        (MIGRATE — size="lg")
components/pages/MyLibraryPage.tsx:508      <Loader2 h-4 w-4 animate-spin/>              — per-cache delete button busy            (MIGRATE — size="sm")
components/pages/MyLibraryPage.tsx:592      <Loader2 h-4 w-4 animate-spin/>              — Veo generate-clip button busy           (MIGRATE — size="sm")
components/pages/MyLibraryPage.tsx:706      <Loader2 h-4 w-4 animate-spin/>              — library-chat Send button busy           (MIGRATE — size="sm")
```

Pages total: **8 migrations across 3 files, 0 intentional keeps, 0 dead imports.**

Every hit is a `Loader2` from `lucide-react` with unconditional `animate-spin` — classic loading-beacon semantics, no refresh-button patterns to preserve.

## What was changed

### 1. `components/pages/TutorChatPage.tsx` (2 migrations)

- Removed `Loader2` from the `lucide-react` import.
- Added `import { InlineSpinner } from '@/components/loading';`.
- **Line 413** (empty-state tutor context loader inside the `workspace-icon-tile`): `<Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite"` to the parent empty-state flex container so screen readers announce the "Loading your tutor context…" heading polite.
- **Line 491** (Ask-tutor button busy state): `<Loader2 className="h-4 w-4 animate-spin" />` → `<InlineSpinner size="sm" />`. Spinner inherits `currentColor` from the `btn-cinematic` button so it stays `text-inverse` against the accent fill.

Size rationale:
- `h-6 w-6` (24 px) → `size="lg"` (32 px) — closest discrete step; container is 14×14 rem with room to spare.
- `h-4 w-4` (16 px) → `size="sm"` (16 px — exact).

### 2. `components/pages/StudyCompanionPage.tsx` (1 migration)

- Removed `Loader2` from the `lucide-react` import.
- Added `import { InlineSpinner } from '@/components/loading';`.
- **Line 321** (approved-documents inline status row inside document selector): `<Loader2 className="h-4 w-4 animate-spin" />` → `<InlineSpinner size="sm" />`. Added `role="status" aria-live="polite"` to the parent `inline-flex` row so the "Loading approved documents…" text is announced politely. Spinner inherits the row's muted text color via `currentColor`.

Size rationale: `h-4 w-4` (16 px) → `size="sm"` (exact).

### 3. `components/pages/MyLibraryPage.tsx` (5 migrations)

- Removed `Loader2` from the `lucide-react` import.
- Added `import { InlineSpinner } from '@/components/loading';`.
- **Line 420** (Choose-PDF upload button — ternary with `<Upload />`): `<Loader2 className="h-4 w-4 animate-spin" />` → `<InlineSpinner size="sm" />`. Spinner inherits `text-inverse` from the accent-filled span.
- **Line 456** (caches-loading container overlay inside `WorkspaceSurface`): `<Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />`. Added `role="status" aria-live="polite"` to the parent `flex items-center justify-center py-12` container so the implicit "Loading cached documents" state is announced.
- **Line 508** (per-cache Trash delete button busy state): `<Loader2 className="h-4 w-4 animate-spin" />` → `<InlineSpinner size="sm" />`. Ghost button — spinner inherits muted text color.
- **Line 592** (Veo generate-clip primary button — ternary with `<Video />`): `<Loader2 className="h-4 w-4 animate-spin" />` → `<InlineSpinner size="sm" />`.
- **Line 706** (library-chat Send primary button — ternary with `<MessageSquare />`): `<Loader2 className="h-4 w-4 animate-spin" />` → `<InlineSpinner size="sm" />`.

Size rationale:
- `h-4 w-4` (16 px) → `size="sm"` (exact) — all four button busy states.
- `h-8 w-8` (32 px) → `size="lg"` (exact) — the container overlay.

## Verification

- **Pattern check:** `grep -n "animate-spin\|Loader2" components/pages/TutorChatPage.tsx components/pages/StudyCompanionPage.tsx components/pages/MyLibraryPage.tsx` returns **zero** hits post-migration.
- **InlineSpinner count:** 3 + 2 + 6 = 11 references (8 usages + 3 imports), matches expected.
- **Typecheck:** `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit -p tsconfig.json` on the three files — zero new errors on touched files.
- **A11y affordances:** Both container-level loaders (TutorChatPage empty-state tile, MyLibraryPage caches overlay, StudyCompanionPage document-selector row) now wrap the spinner in `role="status"` + `aria-live="polite"`. Button-level spinners inherit their button's `aria-busy` / disabled state — the adjacent label text ("Thinking…", "Choose PDF", "Generate clip") announces the state.
- **Color inheritance:** Every spinner uses `currentColor` via the SVG stroke. Button-level ones pick up `text-inverse` from the accent-filled buttons or `text-muted` from ghost buttons without explicit `text-*` classNames. Container-level ones keep the explicit `text-[var(--color-accent)]` they had before.
- **No component API changes:** All migrations are purely internal render-tree refactors. No prop-signature changes, no state changes, no effect changes.
- **Audit state unchanged:** 176/8/3/2 PASS/WARN_OUT_OF_BAND/WARN_MANUAL_ONLY/FAIL — frontend-only change, no API routes touched.

## Cumulative cluster sweep status

| Cluster | Task | Status | Migrations | Dead cleanups | Intentional keeps |
|---|---|---|---|---|---|
| Library | TASK-014 | completed | 7 | — | 2 |
| Dashboard | TASK-015 | completed | 6 | — | 1 |
| Analytics | TASK-017 | completed | 7 | — | 1 |
| Drill + Session | TASK-018 | completed | 15 | 2 | 0 |
| Modes + Toolkit | TASK-019 | completed | 16 | — | 2 |
| Admin | TASK-020 | completed | 13 | — | 7 |
| **Pages** | **TASK-021** | **completed** | **8** | — | **0** |
| Misc (OSCE, integrations, settings, modals, shared, social, agents, explorer, offline, etc.) | TASK-022+ | pending | ~30 files | — | TBD |

Running total post-TASK-021: **72 migrations across 67 files, 2 dead-import cleanups, 13 intentional keeps.**

## Remaining clusters (queued)

- **OSCE cluster** (~4 files, ~5 migrations): `AudioInterface`, `SOAPNoteTrainer` ×2, `SOAPDraftPanel` ×2.
- **Integrations cluster** (~2 files): `TodoistExportModal`, `TodoistCallback`.
- **Settings/compliance cluster** (~3 files): `FSRSOptimizer`, `DataExport`, `MedicalComplianceDashboard`.
- **Navigation/explorer/agents cluster** (~4 files): `CommandPalette` ×2, `AgentChat` ×2, `GraphSearchBar`, `NodeDetailPanel`.
- **Modals cluster** (~2 files): `FlagQuestionModal`, `ConditionDetailModal`.
- **Shared/social/goals/offline/custom-study/knowledge/error/pearls** (~10 files): miscellaneous remnants.
- **UI-primitive-internal spinners** (`ui/SmartImage`, `ui/layouts/ContentGrid`, `ui/button`): these are inside the primitive library itself — keep on `Loader2` as canonical internal implementation, not part of the consumer-migration sweep.
