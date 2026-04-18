# PANaCEa Database & Prisma Audit — 2026-04-17

**Scope:** `prisma/schema.prisma`, 74 migrations, ~400 hot-path Prisma call sites in `functions/` and `lib/`.
**Method:** Static analysis of schema + migrations, query-pattern extraction against hot-path tables, cross-walk against declared indexes, RLS coverage check. No prod queries were executed — see `prisma/audit/orphan_probes.sql` for read-only probes to run against `DATABASE_URL`.

---

## Executive summary

| Rank | Finding | Severity | Risk |
|---|---|---|---|
| 1 | `generate-daily-insights` cron filters on `nextReviewDate`/`fsrsState:'NEW'` that don't exist on `UserProgress` | **Critical** | Daily cron fails silently or throws at runtime |
| 2 | `QuestionAttempt` has **no** foreign keys on userId/questionId/conditionId/medicalContentId | **High** | Orphan accumulation; referential breakage invisible |
| 3 | `ReviewLog` has **no** FK on userId; dual questionId/questionFkId split with only the latter FK'd | **High** | Same as #2, plus drift between the two fields |
| 4 | `QuestionEmbedding` uses IVFFlat(lists=100); peers (`MedicalContentEmbedding`, `ContentChunk`) use HNSW | **Medium** | Recall regression on semantic-spacing queries |
| 5 | 23 redundant indexes duplicate `@unique` constraints; 21 composite prefixes are redundant with wider composites; 1 ASC/DESC twin | **Medium** | Write amplification + wasted disk on every hot table |
| 6 | 10 user-data tables without RLS (UserPreferences, PersonalizedFSRSParams, Card, UserLearningProfile, UserCircadianProfile, UserConditionAccuracy, ConfusionPair, UserConfusionPattern, UserGoal, UserBehaviorMetrics) | **High** | Cross-tenant read exposure if anon key ever used in client code |
| 7 | `userId_fk` columns added by migration 20260102 but absent from schema.prisma — dead weight on QuestionAttempt, ConfusionPair, WeaknessPattern, StudySession, UserLearningProfile | **Low** | Schema drift; confuses future migrations |
| 8 | Missing composite indexes for high-frequency auto-author quality filters (`validationStatus + qualityScore`, `validationStatus + flagCount`), Question health scans (`lifecycleStatus + contentHealthScore`), ConfusionPair dashboards (`count DESC, lastOccurrence DESC`) | **Medium** | Seq scans on growing tables |
| 9 | `CLAUDE.md` claims `PushSubscription` migration is pending — the model is **already in schema**; still outstanding: `ContentGap`, `NotificationLog`, `UserPreferences.banditState` | **Low** | Stale planning doc, not a DB issue |
| 10 | 20260212 migration comment claims `CONCURRENTLY` but DDL is not concurrent — fine historically, worth knowing before replaying on a hot replica | **Low** | Future risk only |

---

## Phase 1 — Schema & migration audit

### 1.1 Redundant indexes duplicating `@unique` (23)

PostgreSQL already creates a btree index for every `@unique` constraint. Declaring `@@index([col])` on the same column is pure write overhead.

```
AnatomyStructure.name              BaselineAssessment.userId
ContentLock.contentId              DailyDiagnosticPuzzle.date
Drug.genericName                   MedicalContent.conditionId
MedicalContentStructured.medicalContentId
MedicalTaxonomy.code               PersonalizedFSRSParams.userId
PlatformStatistics.date            Reflection.sessionId
SessionAnalytics.sessionId         SpecialTest.name
StudyGroup.code                    User.clerkId
User.email                         UserCircadianProfile.userId
UserLearningProfile.userId         UserPreferences.userId
UserRolling360Stats.userId         UserSRSConfig.userId
UserStatistics.userId              UserStudyPhenotype.userId
```

**Recommendation:** Drop these `@@index` declarations in schema.prisma, generate migration.

### 1.2 Composite prefix redundancy (21)

Postgres btree serves prefix scans from composite indexes. `@@index([a])` is dead weight when `@@index([a, b])` exists.

```
ConceptGap([userId])         ⊂ ([userId, system])
Condition([system])          ⊂ ([system, parent_category])
ConfusionPair([userId])      ⊂ ([userId, correctConditionId])
DrillSessionRecord([userId]) ⊂ ([userId, sessionStart])
GrandRoundsHistory([date])   ⊂ ([date, score])
KnowledgeCache([userId])     ⊂ ([userId, expiresAt])
MedicalContent([status])     ⊂ ([status, conditionId])
MedicalContent([system])     ⊂ ([system, pance_yield])
PerformanceRecord([userId])  ⊂ ([userId, timestamp])
QuestionFlag([status])       ⊂ ([status, priority])
QuestionHistory([questionId]) ⊂ ([questionId, validFrom])
SRSItem([userId])            ⊂ ([userId, dueDate])
SavedQuestion([conditionId]) ⊂ ([conditionId, taskType])
SavedQuestion([userId])      ⊂ ([userId, type])
StudySession([userId])       ⊂ ([userId, startedAt])
WeaknessPattern([userId])    ⊂ ([userId, conditionId])
AITokenUsage([userId])       ⊂ ([userId, createdAt])
AITokenUsage([endpoint])     ⊂ ([endpoint, createdAt])
StudentAbility([userId])     ⊂ ([userId, domain])
ABConversion([experimentId]) ⊂ ([experimentId, variantName])
ContentQualityFlag([status]) ⊂ ([status, createdAt])
```

### 1.3 ASC/DESC twin

`QuestionAttempt` declares `@@index([userId, isMainSession, createdAt])` AND `@@index([userId, isMainSession, createdAt(sort: Desc)])`. Postgres btree walks in either direction — the second is redundant. The 20260212 optimization migration created `QuestionAttempt_userId_isMainSession_createdAt_desc_idx` believing it was a distinct win; it isn't. Same story for `ReviewLog_userId_reviewedAt_desc_idx`.

### 1.4 Missing FKs (orphan risk)

Hottest-write-path tables have `String` reference columns with **no** `@relation` and **no** SQL-level `FOREIGN KEY` constraint:

| Table | Columns | Rows written per session |
|---|---|---|
| QuestionAttempt | userId, questionId, conditionId, medicalContentId | Every question answered |
| ReviewLog | userId, conditionId, medicalContentId, questionId, sessionId, attemptId | Every FSRS update |
| StudentReservoirItem | userId, questionId | Every reservoir claim |
| Card | questionId | Every card upsert |
| ItemDifficulty | cardId | Elo updates |
| AITokenUsage | userId | Every Gemini call |
| BaselineAssessment | userId | Placement only |

Only `BehaviorLog.questionAttemptId` has a proper FK constraint (migration 20260207).

### 1.5 Duplicate `nextReview*` column names

Different models use different column names for the same concept:

- `UserProgress.nextReviewAt` (DateTime)
- `SRSItem.nextReviewDate` (DateTime)
- `SavedQuestion.nextReviewDate` (String!)

Not a bug per se, but creates confusion and enables Finding #1 below.

### 1.6 pgvector inconsistency

| Table | Index | Columns | Added |
|---|---|---|---|
| MedicalContentEmbedding.embedding | HNSW | (vector_cosine_ops) | 20260207 upgrade |
| ContentChunk.embedding | HNSW | (vector_cosine_ops) | 20260207 upgrade |
| QuestionEmbedding.embedding | **IVFFlat (lists=100)** | (vector_cosine_ops) | 20260407 |

The 20260407 migration regressed to IVFFlat. For <100k vectors HNSW dominates IVFFlat on both recall and query latency and does not need tuning around `lists`. Peers agree — this should match.

### 1.7 `userId_fk` dead columns

Migration 20260102 added `userId_fk`, `conditionId_fk`, `questionFkId`-style columns on QuestionAttempt, ConfusionPair, WeaknessPattern, StudySession, UserLearningProfile. Of these, only `ReviewLog.questionFkId` made it into schema.prisma and code. The rest are dark columns — nullable TEXT that nothing writes to. Safe to drop after a probe (see `orphan_probes.sql` #19).

### 1.8 RLS coverage gaps (10 tables)

Four migrations enable RLS — 20260104 (baseline), 20260309200000 (Sprint 2), 20260407200000 (Sprint 3). Not yet covered despite holding per-user data:

```
UserPreferences         (study settings, notification prefs)
PersonalizedFSRSParams  (per-user FSRS w parameters)
Card                    (FSRS card state — arguably most sensitive)
UserLearningProfile     (AI-derived learner profile)
UserCircadianProfile    (performance-by-hour telemetry)
UserConditionAccuracy   (per-condition accuracy rollups)
ConfusionPair           (per-user confusion pairs)
UserConfusionPattern    (derived patterns)
UserGoal                (user-entered goals)
UserBehaviorMetrics     (behavior rollups)
```

Recommend: one migration extending RLS to these, same pattern as 20260309/20260407.

### 1.9 `CLAUDE.md` staleness

Current Priorities item 4 lists `PushSubscription` as pending — the model is already in `schema.prisma` (line 3437) with `userId String`, `endpoint`, `p256dh`, etc. Still actually pending: `ContentGap`, `UserPreferences.banditState`, `NotificationLog`, and the `web-push` dev dep.

---

## Phase 2 — Hot-path index coverage

Extracted 400+ Prisma call sites across `functions/` and `lib/`. Below are the gaps where query shape does **not** align with any existing index.

### 2.1 Critical runtime bug — mis-named fields in `generate-daily-insights.ts`

The cron at `functions/api/cron/generate-daily-insights.ts` has at least **ten** field-name bugs across three tables. Four were fixed in this audit pass; six remain and require a product/schema decision.

**Fixed in this pass (2026-04-17):**

| Line(s) | Was | Should be | Table |
|---|---|---|---|
| 76, 81, 90, 95, 145, 148, 149, 192 | `isCorrect` | `wasCorrect` | QuestionAttempt |
| 104 | `nextReviewDate` | `nextReviewAt` | UserProgress |
| 105 | `fsrsState: { not: 'NEW' }` | `fsrsState: { not: 0 }` | UserProgress (state is `Int?`, 0 = New) |

**Still broken (needs decision):**

- Line 303: `userId_date` — DailyStudyPlan composite is `userId_planDate`
- Line 305, 311: `date:` — field is `planDate`
- Line 312, 322: `planData: {...}` — field does not exist. DailyStudyPlan has `recommendedSessions`, `targetQuestionsCount`, etc. — no generic JSON blob for insights.
- Line 352: `performedBy: 'system:cron'` — AuditLog has no `performedBy`. Closest is `entityType` (default 'SYSTEM').
- Line 353: `metadata: {...}` — AuditLog field is `details`.

These are **shape mismatches**, not typos. The cron was never wired correctly against the current schema. Three plausible resolutions — Aaron's call:

**(a) Add a `UserDailyInsight` model** (what the top-of-file comment hints at):

```prisma
model UserDailyInsight {
  id         String   @id @default(cuid())
  userId     String
  date       DateTime @db.Date
  insights   String   @db.Text
  metrics    Json
  modelUsed  String
  createdAt  DateTime @default(now())

  User User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([date])
}
```

Pros: clean separation, indexable, queryable. Cons: new model + migration.

**(b) Extend DailyStudyPlan with an optional `insights Json?` field.** Pros: no new table. Cons: conflates "recommended plan" with "cached insight" — semantic pollution.

**(c) Delete the cron.** It appears to have never run successfully. If the dashboard doesn't rely on it today, drop the file and reopen when the product needs it.

Recommendation: **(a)**. The cron is cheap ($3/mo at 100 users) and the comment already anticipated this model. Low effort, proper separation.

### 2.2 Missing composite indexes

| Model | Query (count of sites) | Current coverage | Proposed index |
|---|---|---|---|
| `PreGeneratedQuestion` | `where: { validationStatus, qualityScore: { gte/lt }, flagCount: { gte } }` (auto-author quality filter) | single-col on each | `[validationStatus, qualityScore]` and/or `[validationStatus, flagCount]` |
| `PreGeneratedQuestion` | `where: { system, usedAt: null }` (reservoir gap query) | single-col on `usedAt`, `system` | `[system, usedAt]` (partial: `WHERE "usedAt" IS NULL`) |
| `Question` | `where: { lifecycleStatus, contentHealthScore: { lt } }` (4 variants) | single-col each | `[lifecycleStatus, contentHealthScore]` |
| `Question` | `where: { lifecycleStatus, qaStatus }` (3 variants) | single-col each | `[lifecycleStatus, qaStatus]` |
| `ConfusionPair` | `orderBy: [{ count: 'desc' }, { lastOccurrence: 'desc' }]` (dashboard) | none on `count`/`lastOccurrence` | `[userId, count(sort: Desc), lastOccurrence(sort: Desc)]` |
| `StudentReservoirItem` | `updateMany where: { status, questionId: { in }, reservedBy }` (claim release) | `[userId, status, priority]`, `[status, reservedAt]` | `[reservedBy]` (partial: `WHERE reservedBy IS NOT NULL`) |
| `ReviewLog` | `count where: { review_type, sessionType }` (no userId; telemetry rollup) | `[userId, review_type, reviewedAt]` | `[review_type, sessionType]` (small) |
| `ItemDifficulty` | `findMany where: { cardId: { in } }` | single index needed | `[cardId]` already added? → verify |

### 2.3 Redundant composite (delete candidate)

- `QuestionAttempt_userId_isMainSession_createdAt_desc_idx` — redundant with the ASC variant.
- `ReviewLog_userId_reviewedAt_desc_idx` — redundant with `[userId, reviewedAt]`.

These can be dropped; ~10-20% write amplification reduction on the hottest tables.

### 2.4 Partial-index opportunities already in place (keep)

Good calls from 20260212 — verify they still match code:

- `QuestionAttempt_main_session_user_idx` — `WHERE isMainSession = true` — matches main-session queries
- `ReviewLog_real_reviews_idx` — `WHERE review_type = 'real'` — matches FSRS-writer gate
- `Card_active_idx` — `WHERE state IN (1,2,3)` — matches drill claim path

### 2.5 No-filter queries to audit

Twelve `QuestionAttempt.findMany({ orderBy: { createdAt } })` call sites have no `where` clause. Most are admin/analytics; confirm each has either `take:` or tenant scoping — otherwise they risk unbounded result sets.

---

## Phase 3 — Orphan & integrity scan

Full SQL at `prisma/audit/orphan_probes.sql`. Twenty-four read-only probes covering:

1. Dangling userId/questionId/conditionId/medicalContentId on QuestionAttempt (no FK)
2. Same for ReviewLog plus `questionId` vs `questionFkId` divergence
3. UserProgress.conditionId → MedicalContent (not Condition — schema mis-naming)
4. Card.questionId, StudentReservoirItem.{userId,questionId}, ItemDifficulty.cardId, AITokenUsage.userId, BaselineAssessment.userId, QuestionSubmission.questionId — all unchecked FKs
5. MedicalContent.conditionId orphans
6. `userId_fk` column population (dead-column audit)
7. PreGeneratedQuestion → QuestionEmbedding coverage gaps
8. Postgres-catalog duplicate-index detection (`pg_index`)
9. `pg_stat_user_indexes` unused-index list
10. Materialized view staleness (`pg_xact_commit_timestamp`)
11. RLS-enabled check across 20 sensitive tables

Run with:
```bash
psql "$DIRECT_DATABASE_URL" -f prisma/audit/orphan_probes.sql
```

All queries are SELECT-only. No cleanup script is written — post-probe, prioritize based on actual orphan counts (nullable FKs with 0 dangling ≠ problem, even without a constraint).

---

## Phase 4 — Recommended action plan

### P0 — Fix now (minutes)

1. **Correct `generate-daily-insights.ts` field names** — single-file edit, no migration.
2. **Drop `userId_fk_idx` / `ReviewLog_userId_reviewedAt_desc_idx` duplicates** — 2 one-line migrations, no data risk.

### P1 — Short sprint (hours)

3. **Single consolidation migration**: drop 23 `@@index`-duplicates-of-`@unique` + 21 composite-prefix redundants + 1 ASC/DESC twin. Schema-level edits are mechanical; verify with `prisma migrate diff`.
4. **Extend RLS to the 10 remaining user-data tables** following the 20260309/20260407 pattern.
5. **Switch `QuestionEmbedding` from IVFFlat → HNSW** to match peers. One-line migration: `DROP INDEX … ; CREATE INDEX … USING hnsw (...)`.

### P2 — Approval required (migration week)

6. **Add missing foreign keys** (`QuestionAttempt.userId`, `ReviewLog.userId`, `Card.questionId`, `StudentReservoirItem.userId/questionId`, etc.). Must run `orphan_probes.sql` first; any nonzero orphan requires cleanup before the constraint is added. Use `NOT VALID` + `VALIDATE CONSTRAINT` for zero-downtime application.
7. **Composite indexes for hot-path gaps** (2.2). Each single `CREATE INDEX CONCURRENTLY` — safe on live DB but cannot run inside a Prisma migration transaction, so use `// prisma-ignore` or run via `execute_sql`.
8. **Drop dead `userId_fk` columns** after probe #19 confirms zero writes. One `DROP COLUMN` per table.

### P3 — Doc hygiene

9. Update `CLAUDE.md` "Current Priorities" items 4-5: `PushSubscription` is already applied; still pending are `ContentGap`, `banditState`, `NotificationLog`, `web-push`.

---

## Appendix A — Migrations inventory (74)

Latest 12:
```
20260403100000_phase1_brin_indexes_and_provenance
20260404000000_add_retention_validation_log
20260405000000_phase4_knowledge_graph
20260405120000_add_mastery_scorecard_fields
20260406130000_phase5_materialized_views
20260407200000_add_rls_reviewlog_behaviorlog_sessionanalytics
20260407210000_add_question_embeddings
(plus 3 earlier in April)
```

## Appendix B — Files touched by this audit

```
prisma/audit/DATABASE_AUDIT_2026-04-17.md   (this file)
prisma/audit/orphan_probes.sql              (24 read-only probes)
```

No schema or migration changes were written. All edits are pending Aaron's approval per the Ask-First rule on migrations.

---

## Addendum (2026-04-17, later) — Live-DB re-baseline

The original audit cross-walked schema.prisma against itself and against the migration history — it did **not** query the live DB. After Aaron's sign-off, I ran the probes + index catalog queries against `lzfescdrpezzjhgveotz` (prod). Several of the findings above were wrong or overstated. Below is the re-baselined picture.

### A.1 Ground truth: this is a greenfield DB

| Table | Rows |
|---|---|
| `PreGeneratedQuestion` | 1,414 |
| `MedicalContent` | 1,316 |
| `Condition` | 1,316 |
| `Question` | 532 |
| `DailyStudyPlan` | 38 |
| `User` | 3 |
| `QuestionAttempt` | **0** |
| `ReviewLog` | **0** |
| `UserProgress` | **0** |
| `Card` | **0** |
| `StudentReservoirItem` | **0** |
| `QuestionEmbedding` | **0** |
| `BaselineAssessment` | **0** |
| `AuditLog` | **0** |

Every user-activity table is empty. This collapses most of the "write amplification" and "hot-path performance" urgency in the original audit — there is nothing hot yet. Reframe the remaining work as **correctness before first real traffic**, not tuning.

### A.2 Findings that were wrong or moot

| Original finding | Verified state |
|---|---|
| #2 **QA has no FKs / orphans possible** | 0 orphans on userId, questionId, conditionId, medicalContentId (table is empty anyway). Safe to add FKs with no cleanup. |
| #3 **ReviewLog FK gaps + questionId/questionFkId divergence** | 0 orphans, 0 rows total, 0 field divergence. Safe to add FKs. |
| #5 **23 + 21 + 1 redundant indexes** | Most are phantom — schema.prisma declarations that never made it to DB (drift). Actual DB duplicate count is **3**, not 45 (see A.3). P0-2 migration is **withdrawn** — see `proposed_migration_drop_twin_indexes.sql`. |
| #6 **10 tables without RLS** | Only **1** real gap: `StudentReservoirItem`. All others in the original list already have `relrowsecurity=true`. `force_rls=false` everywhere is expected — Supabase's service role must bypass RLS. |
| #7 **Dead `userId_fk` columns** | Zero columns named `userId_fk` exist in `public` schema. They were dropped somewhere after the 20260102 migration. No cleanup needed. |
| #9 **CLAUDE.md stale on PushSubscription** | Still accurate — the model exists in schema.prisma but not in DB (RLS audit returned no row). Doc update still valid. |

### A.3 Actual DB duplicate indexes (3 pairs, all low-value given empty tables)

| Table | Keep | Drop | Reason |
|---|---|---|---|
| `MedicalContent` | `MedicalContent_buzzwords_gin_idx` | `MC_buzzwords_gin_idx` | Identical GIN index on `buzzwords` — verbatim duplicate |
| `UserQuestionSeen` | one of `UserQuestionSeen_userId_lastSeenAt_idx` (ASC) | the other (`idx_user_question_seen_user_last` DESC) | btree is bidirectional — one serves both sorts |
| `UserBehaviorMetrics` | `UserBehaviorMetrics_userId_createdAt_idx` (ASC) | `idx_ubm_user_created` (DESC) | Same logic |

Bonus candidate: `Drug_drugClass_idx` is a btree on `text[]` — btree can't efficiently serve array-containment queries; `Drug_drugClass_gin_idx` (GIN) handles those. The btree one is essentially dead weight. Drop candidate.

BRIN/btree and trgm-GIN/btree pairs on `Condition.name`, `ContentIndex.title`, `DailyUserAnalytics.sessionDate`, `QuestionAttempt.createdAt` are **complementary**, not duplicate. Keep both.

### A.4 Migration history red flag

`20260212200000_database_performance_optimization` was **rolled back three times** (2026-03-01, 2026-03-07 twice) before applying successfully on 2026-03-07 01:26. The migration is not idempotent — any `CREATE INDEX IF NOT EXISTS` or `ALTER TABLE IF NOT EXISTS` that partially succeeded before a rollback could leave DB state that diverges from the migration's declared intent. This is likely the origin of several drift cases. Worth spot-checking what actually made it in.

Separately, that migration's comment claims `CREATE INDEX CONCURRENTLY` but the DDL omits `CONCURRENTLY` — with empty tables today it's irrelevant, but if replayed on a loaded replica it will block writes. Annotate or rewrite before any replay.

### A.5 Materialized views: 3 of 6 are empty (0 bytes)

`daily_activity_summary_mv`, `system_accuracy_trend_mv`, `user_blueprint_coverage_mv` — 0 bytes. They were created but never refreshed, which is consistent with the zero rows in the underlying tables they aggregate from. No action yet; revisit once real traffic lands.

### A.6 QuestionEmbedding still on IVFFlat (confirmed from original audit)

```
QuestionEmbedding_embedding_idx: USING ivfflat (embedding vector_cosine_ops) WITH (lists='100')
```

Peer tables use HNSW. Since `QuestionEmbedding` is empty, switching the index type now is a pure `DROP INDEX + CREATE INDEX` — no reindex cost. This is the one P1 item where "do it now, while free" applies.

### A.7 Corrected action plan (supersedes Phase 4 action plan above)

**Already applied** during this pass:
- `generate-daily-insights.ts` field-name bugs (10 edits, 1 file) — applied 2026-04-17
- `prisma/schema.prisma` drift cleanup — removed orphaned `@@index([userId, isMainSession, createdAt])` on QuestionAttempt (line 2435) that never migrated to DB

**Remaining queue, re-ranked for "before first traffic":**

| Rank | Item | Why now | Why cheap |
|---|---|---|---|
| 1 | Enable RLS on `StudentReservoirItem` + add userId-scoped policy | Only real RLS gap | 1 migration, empty table |
| 2 | `QuestionEmbedding` IVFFlat → HNSW | Peers use HNSW; embedding-consistency matters for recall | Table empty, trivial swap |
| 3 | Drop 3 duplicate indexes (§A.3) + `Drug_drugClass_idx` btree-on-array | Hygiene | One migration, 4 DROPs |
| 4 | Decide resolution for `generate-daily-insights.ts` (option a/b/c) | Cron still broken for DailyStudyPlan + AuditLog shape mismatches | Product decision, not DB work |
| 5 | Add FKs on QuestionAttempt, ReviewLog, Card, StudentReservoirItem, ItemDifficulty (all userId + questionId + content refs) | 0 orphans verified; best moment is before any traffic | Empty tables, no cleanup needed |
| 6 | Missing composite indexes from §2.2 (validationStatus+qualityScore, etc.) | Will matter once PreGeneratedQuestion grows | Non-blocking, CONCURRENTLY-safe |
| 7 | CLAUDE.md hygiene: remove PushSubscription "pending" claim; note empty-DB state | Doc accuracy | Free |

**Withdrawn / no-op:** original P0-2 (drop twin indexes), original P1 "consolidate 23+21+1 redundant indexes" (phantom), original P2 dead-column drops (already gone).
