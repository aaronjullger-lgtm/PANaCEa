# Repo Hygiene TODO — Claude's Autonomous Sweep

Original sweep: 2026-04-17. Refreshed after audit: 2026-04-18.

## Status

- Tier 1 — DONE. Commit `44890508` chore(hygiene): delete tier-1 tombstones (review.ts, log-attempt.ts).
- Tier 2 — DONE. Commit `685a93e2` chore(hygiene): delete tier-2 tombstones (301 redirects to /api/drills/*).
- Tombstone file patterns (`*.todelete_*`, `*.local_preserve*`) — DONE. Zero matches in repo.

## Tier 3 (re-audited 2026-04-18)

### 3a. `lib/poolSelection.ts` — ORIGINAL AUDIT WAS WRONG

The file is a **live utility** used by `functions/api/questions/pool.ts` for
weighted PANCE-distribution selection (`selectByPanceDistribution`,
`fisherYatesShuffle`). It internally already reads from
`BLUEPRINT_PERCENT_BY_ABBREVIATION` — the migration the original audit asked
for is already done.

The real cleanup target is the deprecated re-export `PANCE_SYSTEM_PERCENTAGES`
(line 12). Callers to migrate:

- `components/quiz/SessionEndSummary.tsx`
- `components/quiz/SessionStatsOverlay.tsx`
- `services/ai/enhancedQuestionService.ts`
- `services/ai/panceDistributionService.ts`
- `services/domain/panceDistributionService.ts`
- `services/domain/index.ts`
- `tests/poolSelection.test.ts`
- `lib/poolSelection.ts` (self-reference)

Replace `import { PANCE_SYSTEM_PERCENTAGES } from '.../poolSelection'` →
`import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '.../constants/blueprint'`,
then delete the deprecated re-export.

### 3b. `lib/sessionInterleaving.ts` — CAN BE DELETED (with its parent)

Only real caller: `services/core/enhancedQuestionPool.ts`.
But `enhancedQuestionPool.ts` is itself orphaned — its sole consumer
`services/core/questionService.ts` has the import commented out (lines 65-68).

Safe cleanup path:

```bash
git rm lib/sessionInterleaving.ts
git rm services/core/enhancedQuestionPool.ts
# Then trim the imports from scripts/demo-question-sprint-b.ts OR delete the
# demo script if it's no longer exercised (verify usage first).
```

Note: `lib/nccpa-blueprint.ts` defines its OWN `validateInterleaving` (line
218). It is NOT a consumer of `lib/sessionInterleaving.ts`.

### 3c. `lib/toast.ts` — 15 CALLERS, LARGE MIGRATION

Confirmed live callers (migrate each to `useToastStore` directly):

- `components/modes/PatientEncounterMode.tsx`
- `components/osce/SOAPNoteTrainer.tsx`
- `components/offline/OfflineSyncIndicator.tsx`
- `components/modals/SettingsStatsModal.tsx`
- `components/session/SrsFlashcardView.tsx`
- `components/drill/ContrastiveDrillSession.tsx`
- `components/layout/AppLayout.tsx`
- `components/modes/MedicalWordleMode.tsx`
- `components/external/MedicalDatabaseSearch.tsx`
- `hooks/useSRSItems.ts`
- `hooks/useDrillFSRS.ts`
- `components/library/ClinicalReferenceLibrary.tsx`
- `components/modes/BlueprintComplianceAuditorMode.tsx`
- `contexts/CommuterContext.tsx`

Defer until the current hotfix branch is stable — adding 15-file churn on top
of the existing diff is risky.

## Not safe to delete (from original sweep — still valid)

- `components/ui/ErrorState.tsx` — still exports `ErrorBoundaryFallback`,
  which is imported by `components/error/ErrorBoundary.tsx`. Keep as-is.
