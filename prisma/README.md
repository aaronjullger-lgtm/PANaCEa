# Prisma Schema and Database

## Schema overview

The schema is organized by domain:

- **Users and auth:** `User`, `UserPreferences`, `UserSRSConfig`, `UserAchievement`, `UserLearningProfile`, `Cohort`, `CohortMember`
- **Conditions and content:** `Condition`, `MedicalContent`, `ContentVersion`, `ContentAuditLog`, junction tables (`*ConditionLink`), `AnatomyStructure`, `Anatomy3DModel`, `Anatomy3DModelConditionLink`
- **Questions and attempts:** `Question`, `PreGeneratedQuestion`, `QuestionSeed`, `QuestionAttempt`, `QuestionFlag`, `QuestionHistory`, `QuestionVariant`
- **SRS and reviews:** `SRSItem` (deprecated), `Card`, `ReviewLog`, `UserTopicProgress`, `UserProgress` (deprecated)
- **Analytics:** `SessionAnalytics`, `DailyUserAnalytics`, `PerformanceRecord`, `DrillSessionRecord`, `StudySession`, `UserRolling360Stats`, `Rolling360Buffer`, `UserConditionAccuracy`
- **System:** `AuditLog` (cron/system audit trail)
- **Reference data:** `Drug`, `LabTest`, `ImagingStudy`, `ECGPattern`, `FirstLineTreatment`, `Guideline`, `ScoringSystem`, etc.

See [prisma/schema.prisma](schema.prisma) for the full schema. Migrations live in [prisma/migrations](migrations/); see [migrations/README.md](migrations/README.md) for how to run them.

## Normalized study schema

The additive normalized study layer introduces `Course`, `StudyTopic`, `CourseStudyTopic`, `StudyTopicCondition`, `QuestionStudyTopic`, `QuestionAnswerChoice`, `QuestionExplanation`, `QuestionExplanationCitation`, `StudyPlan`, `StudyPlanItem`, and `StudySessionQuestion`. These tables give study modes, question generation, explanations, daily plans, and scheduler analytics relational joins while preserving legacy JSON/string fields during migration.

See [docs/database/normalized-study-schema.md](../docs/database/normalized-study-schema.md) and migration `20260502000000_normalized_study_schema`.

## UserProgress → ReviewLog migration

**New review data must be written to `ReviewLog`.** `UserProgress.reviewHistory` (Json[]) is legacy and is a performance anti-pattern for large datasets; `ReviewLog` provides a queryable time-series table and ~100x faster reads (e.g. 500ms → 5ms for FSRS optimizer).

**Migration path:**

1. **Write path:** SRS/submit and review flows should write to `ReviewLog` (and optionally continue dual-write to `UserProgress.reviewHistory` during transition).
2. **Backfill:** Run a one-off or background job to copy historical reviews from `UserProgress.reviewHistory` into `ReviewLog` where needed.
3. **Read path:** Switch FSRS optimizer and any other readers from `UserProgress.reviewHistory` to `ReviewLog`.
4. **Deprecation:** After cutover, stop writing to `UserProgress.reviewHistory` and eventually remove the `UserProgress` model (or keep it only for `fsrsCard`/`nextReviewAt` if still used).

See schema comments on `UserProgress` and `ReviewLog` in [schema.prisma](schema.prisma).

## Deepened analytics storage

- **DrillSessionRecord:** Session-level drill metrics from `/api/performance/record` (mode, score, totalQuestions, accuracy, timeSpentMs, streak, sessionStart, sessionEnd). Distinct from per-question `PerformanceRecord`.
- **AuditLog:** System/cron audit trail (action, entityType, entityId, details). Used by aggregate-analytics, daily-prescription, replenish-pool crons.
- **QuestionAttempt.medicalContentId:** Optional FK for content-level analytics; send from client with attempt payload when known.
- **DailyUserAnalytics.accuracyBySystem:** Per-system daily accuracy (e.g. `{"CV": 0.85, "PULM": 0.72}`). Populated by aggregate-analytics cron.
- **SessionAnalytics:** Created when a session is recorded via `/api/analytics/session` (sessionId, totalDurationMinutes, systemDistribution, etc.).
- **UserConditionAccuracy:** Per-user per-condition accuracy snapshot (attemptCount, correctCount, lastAttemptedAt). Updated by aggregate-analytics cron for fast "my accuracy by condition" dashboards.

## Validation

Run these regularly (e.g. in CI) to catch schema vs DB drift:

- **`npx prisma validate`** — Validates `schema.prisma` syntax and references. Run on every PR.
- **`npx prisma migrate diff`** (optional) — Compares schema to a database URL to detect drift. Use in deploy or staging pipelines when you have a DB URL available.

Example (no DB required):

```bash
npx prisma validate
```
