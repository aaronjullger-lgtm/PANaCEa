# PANaCEa Deprecated Code And Conflict Resolution Audit

Status: consolidated audit, updated 2026-05-02 20:52 EDT.

## Summary

The repo contains both actively useful launch code and many older plans, local-only services, deprecated components, and duplicate pipelines. Cleanup should be conservative: delete only verified-unmounted code, update or archive stale docs, and keep compatibility adapters where active callers still exist.

## Deprecated / Conflicting Code Table

| File/Area | Issue | Evidence | Action | Risk |
|---|---|---|---|---|
| `components/dashboard/DashboardPage.tsx` | Legacy dashboard entrypoint deleted in worktree. | `git status` shows deleted; `/study` imports adaptive dashboard via `CommandCenterWorkspace`. | Delete if import census stays clean. | Low if tests pass. |
| `components/dashboard/UnifiedDashboard/` | Legacy dashboard tree deleted in worktree. | `git status` shows deleted; `rg` finds only stale docs. | Delete if import census stays clean. | Low to medium, old docs/tests may mention. |
| `components/dashboard/*Widget.tsx` deleted set | Old analytics-dump widgets removed in worktree. | Many dashboard widget deletions; adaptive dashboard replaces command-center use. | Verify no production imports before finalizing deletion. | Medium because Progress/StudyPath may still use some old widgets. |
| `components/dashboard/index.ts` | Barrel no longer exports deleted widgets but still may need active exports. | Current file exports BentoGrid, DailyTriad, charts, CalibrationChart, GapAnalysisDashboard, CurriculumGrid. | Keep and verify import census. | Low. |
| Stale dashboard docs | Old references to `DashboardPage`, `UnifiedDashboard`, Daily Pilot, Data Scientist. | `rg "DashboardPage|UnifiedDashboard|Daily Pilot|Data Scientist"` finds docs references. | Update current docs, archive stale implementation logs. | Low, docs only. |
| `components/command/CommandPalette.tsx` | Deprecated/no-op palette conflicted with active `components/navigation/CommandPalette.tsx`. | Import census found no production imports of the old shim. | Deleted. | Low. |
| `routes/` and `server.ts` | Local-only Express API duplicates production Functions. | Repo docs say production uses `functions/api`; cartographer found duplicate systems. | Keep as local-only, label clearly, do not use for production docs/tests. | Medium if confused with prod behavior. |
| `/api/srs/*`, `SRSItem`, SDK compatibility types | Legacy SM-2/SRS compatibility route surface remains, but active DB scheduling reads/writes are mostly retired and the old localStorage helper was deleted. | `SRSItem` deprecated in schema; `/api/srs/submit` delegates to `drillReviewService`; `/api/srs/due` reads canonical progress; `/api/srs/sync` is a no-op; `SrsFlashcardView` now imports API-backed `srsReviewClient`. | Keep route shells until browser/runtime compatibility is verified, then remove SRSItem schema/types in a migration-backed cleanup. | Medium. |
| `functions/api/_shared/aiQuestionService.ts` | Explicit placeholder generation service. | AI agent found `generateQuestionFromGuideline` placeholder. | Deprecate or replace with canonical generator. | Medium. |
| `services/core/stagingQuestionService.ts` | Direct Google SDK and fail-open adequacy path. | AI agent found legacy direct SDK. | Move to Edge-safe shared service or remove when unused. | Medium. |
| `lib/services/session/sessionService.ts` hot-path dynamic generation | Unused learner-session Gemini generation branch conflicted with approved-pool-only serving. | Import/call census found `generateNewQuestions` and `generateQuestionFromContent` only as private definitions. | Removed unused methods and AI imports. | Low. |
| `scripts/regenerate-pool-v2.ts` | Destructive PGQ deletion can orphan soft references. | AI/DB agents found `deleteMany({})`. | Block in production; archive/supersede rows. | High. |
| `TrainingMenu` vs `PracticePage` | Duplicate mode library surfaces. | Design agent found conflicting experiences. | Pick one production surface; likely PracticePage, delegate TrainingMenu. | Medium. |
| Old planning/audit markdowns | Many root/docs audit plans from older stages. | `rg --files -g '*.md'` shows many plans and ledgers. | Merge active findings into root docs, mark older docs superseded instead of mass deletion. | Low to medium. |
| Public health tests | Tests expect diagnostic health payload. | QA agent found `e2e/api-health.spec.ts` and production smoke expectations. | Update after health split. | Medium, tests will fail intentionally. |
| Deferred modes | Many route entries/components point to `productionDeferred`. | `config/lazyComponents.tsx`, `modeReadiness.ts`. | Keep hidden; remove public CTAs; Daily Challenges route now gates closed because its underlying modes are deferred. | Medium. |
| `components/drill/SystemDrillSession.tsx` | Old system-drill implementation used the pre-canonical `/api/questions/system-drill` fetch path and conflicted with the new CoreAdaptiveSession-backed system drill. | `rg "SystemDrillSession"` found no production imports outside lazy export; lazy export now points to `components/session/StudyModeAdaptiveSession.tsx`. | Deleted after import census. | Low if route/readiness tests stay green. |
| Todoist OAuth/linking | Browser secret/token storage and direct API export. | `TodoistCallback` and `TodoistExportModal` deleted; `todoistService` is CSV-only; live-code `rg` finds no OAuth/token-storage references. | Removed linking; keep CSV export. Future Todoist OAuth must be server-side. | Low for current client. |
| OAuth-style Todoist API types | Unused types still described connected/exported Todoist OAuth behavior. | `rg` found `TodoistIntegrationResponse` and `TodoistExportRequest` only in `types/api.ts`. | Deleted unused types; CSV export types remain in `todoistService`. | Low. |
| Real pages registered as deferred | Protected admin/clinical/evidence/utility pages had real backing components but lazy exports still returned private-beta placeholders. | `config/lazyComponents.tsx` vs `pages/admin/*`, `components/dashboard/ClinicalProfile`, `pages/MedicalDatabaseWorkspacePage`, `pages/SimulationPage`, `pages/ClinicalEyePage`, `pages/VisualizerPage`, `pages/LectureConverterPage`, `pages/TechniqueCheckPage`. | Mounted real components; fixed stale admin type drift exposed by imports. | Medium until browser/runtime smoke. |
| Public health diagnostics | Public liveness exposed env/DB/content details. | `/api/health` now returns sanitized liveness; `/api/admin/readiness` is protected by admin auth. | Fixed and documented. | Low; production smoke still needed. |
| `functions/api/srs/index.ts.deprecated`, `stats.ts.deprecated`, `sync.ts` | Deprecated SRS API surface still lives under API tree. | Deprecated comments and tracked files; active `sync.ts` now no-ops instead of writing SRSItem rows. | Archive/delete `.deprecated` files and active compatibility shell only after route consumers migrate. | Medium. |
| `lib/services/fsrsScheduleService.ts` | Claims canonical scheduling, but production paths compute FSRS in `drillReviewService` and `/api/srs/submit`. | Deprecated agent found `computeFSRSUpdate` mostly tests/docs. | Merge into the single FSRS service or delete after adapter. | High. |
| `lib/eorFsrsScheduler.ts` | Old duplicate EOR scheduler. | Active code imports `lib/fsrs/eorScheduler.ts`; old file referenced by itself/CI include. | Delete/archive and remove CI include after test run. | Low-medium. |
| `components/questions/FlagFeedbackNotification.tsx` | Dead component with mock fallback and missing `/api/user/flags`. | No live imports found by agent. | Delete/archive or implement backend if feature returns. | Low. |
| `functions/api/admin/*.ts.disabled`, `functions/api/srs/*.deprecated` | Disabled/deprecated files tracked inside API tree. | `git ls-files` finds them. | Move to archive/docs or delete after owner review. | Low-medium. |
| `functions/geminiProxy.ts` | Deprecated Gemini proxy. | File says deprecated; likely superseded. | Delete after Vite proxy/docs check. | Low-medium. |
| `.bak`, demo/example/archive files | Backup/demo code remains tracked near production code. | Agent found `.bak` files and demo/example directories. | Move true examples to docs/examples; delete backups after import check. | Low. |
| Skipped tests | Large skipped-test surface. | Agent found 44 `test.skip` sites across E2E/core areas. | Quarantine stale specs or convert critical skips to tracked TODOs. | Medium. |
| Candidate unused deps | `@open-spaced-repetition/binding`, `fsrs-browser`, `fsrs.js`, `geist`, `langsmith`, `mdast-util-to-string`, `remark-parse`, `unified`, `bcrypt`, `ws`, `@prisma/studio-core` | Static grep found no non-doc imports; peer/package risk unknown. | Human-review with lockfile/build verification. | Low-medium. |
| Cloudflare cron vs GitHub schedules | Duplicate scheduler ownership. | DevOps agent found Cloudflare cron worker plus active GitHub scheduled workflows. | Pick one owner; remove duplicate schedules/manual-only jobs. | High. |

## Cleanup Policy

1. Do not touch `prisma/migrations/20260426000000_osce_factorization/migration.sql` unless explicitly directed.
2. Delete only code that is verified unused by `rg`, test import census, and route registry review.
3. Do not delete compatibility paths with active production consumers, especially `/api/srs/*`, until browser/runtime compatibility and migration-backed schema cleanup are verified.
4. Archive or supersede outdated docs instead of deleting context-heavy history.
5. After each cleanup batch run targeted import/test checks and update `IMPLEMENTATION_LOG.md`.

## Immediate Cleanup Candidates

Safe or likely-safe:
- Add SPA fallback to `public/_redirects`.
- Update `pages/PracticePage.tsx` recommended modes to use `isPrivateBetaModeVisible`.
- Keep deleted legacy dashboard files deleted if import census remains clean.
- Update docs that call old dashboards current.
- Keep `components/command/CommandPalette.tsx` deleted; active palette is `components/navigation/CommandPalette.tsx`.
- Delete/archive `components/questions/FlagFeedbackNotification.tsx` if import census stays empty.

Needs adapter/removal window first:
- Remaining `/api/srs/*` route shells and SDK/schema `SRSItem` compatibility types.
- Old study-plan service contract.
- Question generation/staging legacy services.
- Duplicate FSRS scheduling helpers.

Needs human/operator review:
- Migration drift and deleted OSCE migration.
- Production dependency upgrades with lockfile churn.
- Rotation/secret replacement for local exposed env values.
- Scheduler ownership and high-risk cron job policy.
- Candidate unused dependencies.
