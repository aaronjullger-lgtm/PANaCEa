# APP_FUNCTIONALITY_PLAN.md

> Quick-reference recovery plan, known blockers, verification history, current task, and next best step.
> Created 2026-05-22 — referenced by 5+ agent skills. Update after setup, build, runtime, auth, API, test, or workflow changes.
>
> **For the full detailed plan (core user flows, route registry, API map, dependency audit, setup verification), see [`docs/plans/APP_FUNCTIONALITY_PLAN.md`](docs/plans/APP_FUNCTIONALITY_PLAN.md).**

## Status

**Phase:** Active development — post-integration hardening
**Last session:** 2026-05 Integration Session
**CI:** Typecheck, lint, build, unit tests, E2E smoke — run on push to main

## Known Blockers (P0)

| Blocker | Detail | Owner |
|---------|--------|-------|
| QuizView refactor parked | `wip/quizview-refactor-parked` — 192 TS errors, state + button primitives need rewiring | Open |
| Drill routing split | DrillShell vs. useDrillFSRS — decide which drill types consolidate | Open |
| Pending Prisma migrations | 7 migrations awaiting approval (see `prisma/audit/proposed_migration_*.sql`) | Needs Aaron approval |
| Prod dep: `web-push` | Sprint 18 notification cron — needs Aaron approval | Needs Aaron approval |
| Supabase MCP migrations | 3 migrations applied 2026-04-17, need `npx prisma migrate resolve --applied` on pull | Session setup |

## Current Task Priorities

1. **Generate questions** — under-represented PANCE blueprint areas (CV, PULM)
2. **QuizView refactor** — resume parked branch, resolve 192 TS errors
3. **Drill routing** — resolve DrillShell vs. useDrillFSRS consolidation
4. **Pending Prisma migrations** — apply after Aaron approval
5. **Notification cron** — Sprint 18 with `web-push` dependency
6. **Blueprint coverage gap analysis** — identify and fill content gaps

### Pending Prisma Migrations (awaiting approval)

| Migration | File | Status |
|-----------|------|--------|
| UserDailyInsight model | `prisma/audit/proposed_migration_user_daily_insight.sql` | Schema updated, DDL ready |
| Missing foreign keys (QuestionAttempt, ReviewLog, Card, etc.) | `prisma/audit/proposed_migration_add_missing_fks.sql` | 0 orphans (2026-04-17), safe to apply |
| Missing composite indexes | `prisma/audit/proposed_migration_missing_composite_indexes.sql` | Schema updated, DDL ready |
| ContentGap model (Sprint 15) | `prisma/migrations/20260418120000_add_content_gap/migration.sql` | Schema.prisma needs model declaration |
| NotificationLog model (Sprint 18) | `prisma/migrations/20260418120100_add_notification_log/migration.sql` | Schema.prisma needs model declaration |
| banditState on UserPreferences (Sprint 16) | Not yet drafted | — |
| version on PersonalizedFSRSParams | `prisma/audit/proposed_migration_personalized_fsrs_params_version.sql` | Schema updated, app works either way |

### Applied Supabase Migrations (resolve on pull)

```
20260418000000_enable_rls_student_reservoir_item
20260418000100_drop_redundant_indexes
20260418000200_question_embedding_ivfflat_to_hnsw
```

Resolve with: `npx prisma migrate resolve --applied <dir>`

## Recently Completed

- ✅ `/study` routes through `CommandCenterHub → CommandCenterWorkspace → AdaptiveDashboardPage`
- ✅ Legacy dashboard entrypoints and unmounted analytics widgets removed after import census
- ✅ Adaptive dashboard: normalized signals, mode profiles, registry scoring, suppression, visual budget enforcement
- ✅ SRS review writes owned by `drillReviewService`; legacy `/api/srs/*` are compatibility adapters only
- ✅ Todoist OAuth/linking removed; CSV export remains the supported Todoist-compatible path
- ✅ syncManager auth bug fixed (token provider pattern)
- ✅ drillReviewService FSRS gating fixed (`sessionType='drill'` now included)
- ✅ ReviewLog session type fixed (drills map to `DRILL`, not `CRAM`)

## Known Test Gaps

- React 19 compat issues in `components/admin`
- Goals subsystem tests
- Offline sync tests
- QuizView refactor tests (none yet — parked branch)
- Auth smoke tests blocked until safe E2E credentials available
- Production-parity E2E: partial (Playwright smoke exists but needs Clerk E2E user)
- OSCE E2E coverage: limited
- PWA/offline-first regression suite: minimal

## Known Dead-Code / Cleanup Targets

- Legacy landing pages, UI components, section headers
- Skeleton loader shims (replace or remove)
- Smart image duplicates
- Rotation selector duplicates
- Compatibility shells from deprecated dashboards
- Stale docs referencing removed GSAP/R3F/drei
- Express-only routes shadowing production Functions
- Orphaned training mode registrations
- Duplicate `CommandCenterPage`, `/menu`, `TrainingMenu` routes
- Historical docs/archive: FSRS v5 claims, stale smoke routes

## Verification History

| Date | Command | Result | Notes |
|------|---------|--------|-------|
| 2026-05-23 | `test:critical` | PASS | 6 files, 143 tests |
| 2026-05-23 | `tests/fsrsSingleWriter` | PASS | 6 tests (hardened from 1) |
| 2026-05-23 | `tests/drillReviewService` | PASS | 17 tests |
| 2026-05-23 | `lib/services/session/sessionService` | PASS | 9 tests (known benign stderr) |
| 2026-05-23 | E2E smoke gap fix | DONE | 5 uncovered drill types added to all-modes.spec.ts |
| 2026-05-22 | `audit-skills.sh` | PASS | 44 skills, 0 errors, 0 warnings |
| 2026-04-17 | Orphan FK probe | PASS | 0 orphans across all targeted tables |
| 2026-03-31 | syncManager auth fix | FIXED | Token provider pattern added |
| 2026-03-31 | drillReviewService FSRS gating | FIXED | `sessionType='drill'` now FSRS-eligible |

## Risk Register

| Risk | Severity | Source |
|------|----------|--------|
| QuizView refactor touches 2045-line component | High | `panacea-navigator` |
| FSRS double-write from duplicate submission paths | High | `panacea-fsrs-guardrails` |
| Admin React 19 compat issues block CI | Medium | Test exclusions |
| Missing APP_FUNCTIONALITY_PLAN.md broke skill references | Medium | 5 skills referenced non-existent file (fixed) |
| CLAUDE.md stale skill count/path misleads agents | Medium | Said 27 skills in `.claude/skills/`; reality is 44 in `.agents/skills/` (fixed) |
| Pending migrations accumulate without approval | Low | 7 migrations pending, 0 blockers |
| Stale docs reference removed deps (GSAP, R3F, drei) | Low | `panacea-repo-hygiene` |

## Next Best Step

**Audit and fix `UPDATED_PRODUCTION_READINESS_SCORECARD.md` and `NEXT_IMPLEMENTATION_PLAN.md`** — both are referenced by CLAUDE.md but don't exist. These are the primary status documents agents consult when picking up work.
