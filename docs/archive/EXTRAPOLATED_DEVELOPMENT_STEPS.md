# Extrapolated Further Development Steps

**Created:** February 4, 2026  
**Context:** Follow-on from the 10-step improvement plan; planned and executed in one pass.

## Plan (executed)

1. **Centralize labels in remaining components** – Use `config/labels.ts` in CommandCenterHub (`TO_REVIEW_LABEL` for dueLabel), MenuView (`TO_REVIEW_STUDY_GUIDE`), TodoistExportPanel (`TO_REVIEW_ONLY`), AnkiExportPanel (`EXPORT_TO_REVIEW`), TodoistExportModal (`TO_REVIEW_LABEL`). Added `EXPORT_TO_REVIEW` to labels.
2. **Update AUDIT_FOLLOW_UP** – Note that Study Tools tab → URL sync is already implemented in CommandCenterHub (`navigate(\`/study${search}\`)` on tab click).
3. **Dashboard skeleton fallback for Command Center** – Add `CommandCenterSkeleton` (QuickStatsBarSkeleton + card placeholders + message) and use it as Suspense fallback for Command Center instead of Loader to reduce CLS.
4. **Remove manual updatedAt from more services** – Remove from `lib/services/userProgressService.ts` (2 places) and `lib/services/recommendationService.ts` (1 place); Prisma `@updatedAt` handles these.

## Completed

- All four steps implemented.
- Labels: CommandCenterHub, MenuView, TodoistExportPanel, AnkiExportPanel, TodoistExportModal now use `config/labels`.
- AUDIT_FOLLOW_UP.md item #4 marked done (Study Tools URL sync).
- CommandCenterSkeleton added and used in App.tsx for command_center Suspense fallback.
- userProgressService and recommendationService no longer set `updatedAt` manually.

## Possible next steps (not done)

- Run `audit:prisma` and fix any handlers missing `safePrismaDisconnect` in `finally`.
- Run `audit:zod` and add Zod to POST/PUT endpoints that lack it.
- Remove manual `updatedAt` from remaining files (srsService, rolling360Service, queue/jobQueue, api/contentService, etc.) in batches.
- Wire DiagnosticDrillHub into the app (e.g. from Command Center or a dedicated route) and map `virtual_osce` → patient_encounter, `ventilator` → ventilator_hero so hub cards open existing views.
- Add more skeleton fallbacks for Menu and Toolkit (same pattern as Command Center).
