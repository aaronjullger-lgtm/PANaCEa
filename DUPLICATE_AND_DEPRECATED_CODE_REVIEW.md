# Duplicate And Deprecated Code Review

Status: integration review current as of 2026-05-05 12:03 EDT.

## Canonical Cleanup Register

| File / Area | Issue | Evidence | Action Taken | Risk |
|---|---|---|---|---|
| `components/dashboard/DashboardPage.tsx` | Legacy dashboard entrypoint deleted in worktree. | `/study` imports `components/dashboard/adaptive/page/DashboardPage.tsx`; `rg` finds old path only in historical docs/plans/reports. | Keep deletion. | Low if route tests stay green. |
| `components/dashboard/UnifiedDashboard/` | Unmounted legacy dashboard tree deleted. | Active code no longer imports `UnifiedDashboard`; references are historical docs/plans. | Keep deletion. | Low. |
| Old dashboard widgets under `components/dashboard/*Widget.tsx` | Analytics-dump widgets conflicted with adaptive command-center direction. | Active adaptive registry lives under `components/dashboard/adaptive/widgets/`; deleted widgets are doc-only references. | Keep deletion and canonicalize adaptive dashboard docs. | Low to medium if an old progress surface expected one of these widgets. Import census found none. |
| `components/command/CommandPalette.tsx` | Older command palette deleted while `components/navigation/CommandPalette.tsx` remains. | Active navigation imports point to `components/navigation/CommandPalette.tsx`. | Keep deletion. | Low. |
| `components/drill/SystemDrillSession.tsx` | Old direct-fetch system drill conflicted with `CoreAdaptiveSession`-backed wrapper. | `config/lazyComponents.tsx` and `DrillViewRouter` point to `components/session/StudyModeAdaptiveSession.tsx`; old path references are docs/logs. | Keep deletion. | Low if mode readiness tests stay green. |
| `components/integrations/TodoistCallback.tsx`, `TodoistExportModal.tsx` | Client-side Todoist OAuth/linking removed. | Live `TodoistExportPanel` and `lib/services/todoistService.ts` are CSV-only. | Keep deletion. | Low for current product; future Todoist OAuth must be server-side. |
| `lib/services/srsService.ts`, `lib/services/srsService.pure.test.ts` | LocalStorage-era SRS helper deleted after flashcard UI moved to API-backed client. | Active import census finds no code consumers; `/api/srs/*` route shells remain compatibility adapters. | Keep deletion. | Medium until all route-shell runtime consumers are smoke-tested. |
| `pages/CommandCenterPage.tsx` | Stale duplicate command-center page still exists while lazy map defers it. | Rawls found active `/study` is `CommandCenterWorkspace`; `lazyComponents.tsx` maps `CommandCenterPage` to `productionDeferred`. | Not removed in this pass. | Medium. Needs route inventory before deletion. |
| `components/navigation/MenuView.tsx` and `/menu` | Legacy menu surface exists while `useAppNavigation` redirects `/menu` to `/study`. | Rawls found mixed registration in `routeRegistry`. | Not removed in this pass. | Medium. Needs explicit redirect-only route decision. |
| `components/dashboard/TrainingMenu.tsx` | Duplicates `/practice` mode-library role. | Rawls found it mounted in both view/modal paths in `AppRoutes`. | Not removed in this pass. | Medium. Needs UX decision before deletion. |
| Historical root/docs audits | Many old audits/plans reference deleted widgets, FSRS v5, or old routes. | `rg` shows stale references in `docs/`, `plans/`, and old reports. | Current scorecard/integration docs made canonical; historical docs not mass-edited. | Low if readers use canonical docs; medium for onboarding confusion. |
| `package.json` missing scripts | `migrate:guidelines` and `migrate:buzzwords` pointed to absent files. | `ls scripts/migrateGuidelinesToDb.ts scripts/migrateBuzzwordsToDb.ts` found no files. | Removed scripts and matching docs rows. | Low. |
| `prisma/migrations/20260426000000_osce_factorization/migration.sql` | Earlier integration review found migration history staged for deletion. | Push finalization restored the migration from `HEAD`; `git diff --cached` no longer includes the deleted migration. | Restored and preserved. | Low for this branch; future schema changes must use new migrations rather than deleting historical files. |

## Safe-Removal Policy For Remaining Items

1. Do not delete route surfaces until `config/routes.ts`, `config/routeRegistry.ts`, `config/AppRoutes.tsx`, `config/lazyComponents.tsx`, and E2E route tests agree.
2. Do not delete `/api/srs/*` shells until browser/runtime compatibility is proven and SDK/types no longer depend on compatibility response shapes.
3. Do not delete historical docs that serve audit provenance; mark them as historical or move them into a real archive directory in a dedicated docs cleanup.
4. Do not remove Prisma migration files in this pass.
