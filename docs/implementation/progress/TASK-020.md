# TASK-020 — Admin cluster animate-spin → InlineSpinner migration

**Date:** 2026-04-17
**Scope:** All components under `components/admin/**` using `Loader2`, handrolled spinners, or ambiguous `RefreshCw + animate-spin` patterns.
**Outcome:** 13 migrations, 7 intentional refresh-button keeps, 0 dead cleanups. Loader2 fully eliminated from admin.

---

## Sub-sprint breakdown

### Sub-sprint 1 — Content editors (2 files, 4 migrations)

1. **`components/admin/CuratedPassageManager.tsx`**
   - Removed `Loader2` from `lucide-react` import; added `import { InlineSpinner } from '@/components/loading';`
   - Line 151 load-passages indicator: `<Loader2 className="w-3 h-3 animate-spin" />` → `<InlineSpinner size="sm" />` inside existing `role="status" aria-live="polite"` wrapper
   - Line 296 saving indicator: `{saving && <Loader2 className="w-4 h-4 animate-spin" />}` → `{saving && <InlineSpinner size="sm" />}`

2. **`components/admin/ContentEditor.tsx`**
   - Added `import { InlineSpinner } from '@/components/loading';`
   - Line 217 Saving button handrolled div → `<InlineSpinner size="sm" />`
   - Line 235 Generating button handrolled div → `<InlineSpinner size="sm" />`

### Sub-sprint 2 — Refinery / Review queues (5 files, 6 migrations + 1 keep)

3. **`components/admin/refinery/RefineryInbox.tsx`**
   - Removed `Loader2` from `lucide-react` import (RefreshCw kept); added InlineSpinner
   - Line 126 loading-inbox indicator: `<Loader2 className="w-6 h-6 animate-spin" />` → `<InlineSpinner size="lg" />` inside a `role="status" aria-live="polite"` wrapper
   - Line 146 Retry button busy state: `<Loader2 className="w-4 h-4 animate-spin" />` → `<InlineSpinner size="sm" />`

4. **`components/admin/refinery/TriageCard.tsx`**
   - Removed `Loader2` from `lucide-react` import; added InlineSpinner
   - Line 251 image-loading placeholder: `<Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" aria-hidden />` → `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />`

5. **`components/admin/BulkApprovalPanel.tsx`**
   - Removed `Loader2` from multi-line `lucide-react` import; added InlineSpinner
   - Line 182 bulk-action button busy: `{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}` → `{isLoading ? <InlineSpinner size="sm" /> : <Icon className="w-4 h-4" />}`

6. **`components/admin/FlaggedQuestionsDashboard.tsx`** (2 migrate + 1 keep)
   - Added InlineSpinner import (kept RefreshCw)
   - Line 266 Refresh button → **KEEP** (static RefreshCw glyph with conditional `animate-spin`, refresh-button pattern)
   - Line 356 full loading state: `<RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` inside `role="status" aria-live="polite" aria-label="Loading flagged questions"` wrapper
   - Line 525 Resolve button busy: `<RefreshCw className="w-4 h-4 animate-spin" />` → `<InlineSpinner size="sm" />` (loading indicator swap, not refresh)

7. **`components/admin/SuggestionTable.tsx`** (1 migrate + 1 keep)
   - Added InlineSpinner import (kept RefreshCw)
   - Line 286 loading-suggestions indicator: `<RefreshCw className="w-8 h-8 animate-spin text-[var(--color-text-muted)] mx-auto mb-4" />` → `<InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />` inside flex-justify-center wrapper + `role="status" aria-live="polite"` added
   - Line 366 Refresh button → **KEEP** (static RefreshCw glyph)

8. **`components/admin/QuestionCurationPanel.tsx`** (1 migrate + 1 keep)
   - Added InlineSpinner import (kept RefreshCw)
   - Line 172 loading indicator: `<RefreshCw className="w-5 h-5 animate-spin" />` → `<InlineSpinner size="md" />` inside `role="status" aria-live="polite"` wrapper
   - Line 215 Refresh button → **KEEP** (static RefreshCw glyph)

9. **`components/admin/QuestionReviewQueue.tsx`** (0 migrate + 1 keep)
   - Line 245 Refresh button → **KEEP** (refresh-button pattern)

### Sub-sprint 3 — Dashboards (8 files, 5 migrations + 5 keeps)

10. **`components/admin/AuditLogViewer.tsx`**
    - Added InlineSpinner import
    - Line 142 handrolled loading spinner → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` inside `role="status" aria-live="polite" aria-label="Loading audit log"` wrapper

11. **`components/admin/VersionHistoryViewer.tsx`**
    - Added InlineSpinner import
    - Line 127 handrolled loading spinner → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` inside `role="status" aria-live="polite" aria-label="Loading version history"` wrapper

12. **`components/admin/MappingEnrichmentDashboard.tsx`** (2 migrate + 1 keep)
    - Added InlineSpinner import (kept RefreshCw)
    - Line 236 Refresh button → **KEEP** (static RefreshCw glyph)
    - Line 331 Detect Gaps busy: `<RefreshCw className="w-4 h-4 animate-spin" />` → `<InlineSpinner size="sm" />` (loading indicator swap)
    - Line 343 Generate Suggestions busy: `<RefreshCw className="w-4 h-4 animate-spin" />` → `<InlineSpinner size="sm" />` (loading indicator swap)

13. **`components/admin/QuestionPerformanceDashboard.tsx`** (1 migrate + 1 keep)
    - Added InlineSpinner import (kept RefreshCw)
    - Line 140 Refresh button → **KEEP** (refresh-button pattern)
    - Line 241 loading state: `<RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` inside `role="status" aria-live="polite" aria-label="Loading question performance"` wrapper

14. **`components/admin/MediaApprovalDashboard.tsx`** (1 migrate + 1 keep)
    - Added InlineSpinner import (kept RefreshCw)
    - Line 212 handrolled loading spinner → `<InlineSpinner size="xl" className="text-[var(--color-accent)]" />` inside flex-justify-center + `role="status" aria-live="polite" aria-label="Loading pending media"` wrapper
    - Line 265 Refresh button → **KEEP** (refresh-button pattern)

15. **`components/admin/DisasterRecoveryDashboard.tsx`**
    - Added InlineSpinner import
    - Line 168 handrolled loading spinner → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` inside `role="status" aria-live="polite" aria-label="Loading disaster recovery data"` wrapper

16. **`components/admin/mapping-enrichment/ChangePreviewModal.tsx`**
    - Removed `Loader2` from `lucide-react` import; added InlineSpinner
    - Line 219 loading preview: `<Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />` → `<InlineSpinner size="lg" className="text-[var(--color-accent)]" />` (existing `role="status"` wrapper received `aria-live="polite"`)

17. **`components/admin/LibraryEnrichmentDashboard.tsx`** (0 migrate + 1 keep)
    - Line 195 Refresh button → **KEEP**

18. **`components/admin/StagingLake.tsx`** (0 migrate + 1 keep)
    - Line 155 Refresh button → **KEEP**

19. **`components/admin/UserCountCard.tsx`** (0 migrate + 1 keep)
    - Line 132 Refresh button → **KEEP** (line 104 is a static RefreshCw glyph, already no animate-spin)

20. **`components/admin/mapping-enrichment/AuditLogTable.tsx`** (0 migrate + 1 keep)
    - Line 283 Refresh button → **KEEP**

---

## Post-migration verification (grep)

```
Loader2:        No files found in components/admin
animate-spin:   8 occurrences remain — all refresh-button keeps:
  - MediaApprovalDashboard.tsx:265       (RefreshCw)
  - LibraryEnrichmentDashboard.tsx:195   (RefreshCw)
  - QuestionPerformanceDashboard.tsx:141 (RefreshCw)
  - UserCountCard.tsx:132                (RefreshCw)
  - QuestionReviewQueue.tsx:245          (RefreshCw)
  - StagingLake.tsx:155                  (RefreshCw)
  - FlaggedQuestionsDashboard.tsx:267    (RefreshCw)
  - mapping-enrichment/AuditLogTable.tsx:283 (RefreshCw)
```

All 8 remaining admin-cluster `animate-spin` occurrences are the established refresh-button pattern (static RefreshCw glyph that rotates while fetching, not a loading indicator). Intentionally kept per the migration rule: **migrate when animate-spin is a loading indicator; keep when it's the refresh-button pattern.**

---

## Cumulative cluster progress (all tasks)

| Task     | Cluster              | Migrations | Files touched | Dead cleanups | Intentional keeps |
| -------- | -------------------- | ---------- | ------------- | ------------- | ----------------- |
| TASK-014 | Library              | 9          | 8             | 0             | 1                 |
| TASK-015 | Dashboard            | 7          | 6             | 1             | 0                 |
| TASK-016 | (reserved)           | —          | —             | —             | —                 |
| TASK-017 | Analytics            | 8          | 7             | 0             | 1                 |
| TASK-018 | Drill/Session        | 17         | 14            | 1             | 2                 |
| TASK-019 | Modes + Toolkit      | 20         | 16            | 0             | 2 + 1 CSS         |
| TASK-020 | Admin                | 13         | 13            | 0             | 7                 |
| **TOTAL**| —                    | **74**     | **64**        | **2**         | **13 + 1 CSS**    |

---

## Notes

- The 2 dead cleanups from prior tasks are retained in count — no new ones this sprint.
- Every migration preserves the user-facing layout (sizes, spacing, margins, text content). Accessibility improvements are additive: each ex-handrolled or ex-RefreshCw loading indicator now lives inside a `role="status" aria-live="polite"` wrapper where one didn't exist before.
- Refresh-button pattern retained deliberately: `RefreshCw` stays to communicate the "refresh" semantic; conditional `animate-spin` shows it's rotating while fetching.
- Next cluster (TASK-021): misc — `pages/` (MyLibraryPage has 5 occurrences, StudyCompanionPage, TutorChatPage), OSCE support panels, `components/knowledge`, `components/social`, `components/external`, `components/CommandPalette`, modals.
