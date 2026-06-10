# P0 Identity Migration — Decision Record

> Sprint: 2026-06 study-mode repair. Status: **decision/analysis only — no
> migration implemented.** Probed live against PANaCEa
> (`lzfescdrpezzjhgveotz`) 2026-06-10.

## The two P0 migrations (per NEXT_IMPLEMENTATION_PLAN.md)

1. **Canonical Question/Source Identity** — distinguish canonical `Question`
   IDs from `PreGeneratedQuestion` IDs across `QuestionAttempt`, `ReviewLog`,
   `UserQuestionSeen`, `StudentReservoirItem` so a review can be traced to the
   exact source row it came from.
2. **Condition/Content Concept Identity** — ensure `UserProgress.conditionId`
   references canonical `MedicalContent` rather than a legacy condition concept,
   so progress aggregation is correct.

## Live DB state (the finding that reframes both)

| Table | Rows | Note |
| --- | --- | --- |
| `QuestionAttempt` | **0** | has `questionIdentityId` column |
| `ReviewLog` | **0** | has `questionIdentityId` column |
| `UserProgress` | **0** | 0 orphan `conditionId` |
| `QuestionIdentity` table | **does not exist** | schema + code reference it |
| `StudySessionQuestion` table | **does not exist** | schema + code reference it |
| `Card` / `StudentReservoirItem` tables | exist | — |

**The learning tables are empty — this is pre-launch data.** There is no
history to backfill or to "prove end-to-end," which was the stated risk behind
both P0 items. That removes the large/destructive part of each migration.

## Already mitigated by 7b012c6 / 3969c9d

- **Write-time source identity** is solved: served questions carry
  `questionSource` / `canonicalQuestionId` / `sourceQuestionId`
  (`sessionService`, `mainSessionService`, `questionApi`, `due-siblings`,
  `QuickReviewMode`), and `reviewQuestionResolver` resolves/heals them. So new
  rows are written with correct provenance regardless of the migration.
- **Concept linkage at write time** is solved: `drillReviewService`
  `resolveProgressConditionId()` maps `conditionId → MedicalContent.id` and
  fail-closes; the serving gate (`withProgressLinkage`) keeps unlinked questions
  out of the live path so no new `UserProgress` row is created from an unlinked
  question.

## What remains unsolved without the migration

- **Schema drift:** `QuestionAttempt.questionIdentityId` /
  `ReviewLog.questionIdentityId` columns exist but the `QuestionIdentity` table
  they reference is **not deployed**; `StudySessionQuestion` is likewise absent.
  Code guards these (delegate-existence checks + try/catch), so writes degrade
  to "skip the identity/link row" rather than failing — but the durable
  normalization those tables provide is not actually happening.
- **Durable, queryable provenance:** without `QuestionIdentity`, source identity
  lives only on the inline `*QuestionId` columns of each row, not in a
  normalized table that can be joined/audited.

## Risks

- **Low (data):** empty learning tables → no backfill, no historical
  reconciliation, no risk of corrupting existing progress.
- **Medium (schema):** deploying `QuestionIdentity` / `StudySessionQuestion`
  must match the Prisma schema exactly, or the existing `questionIdentityId`
  columns become real FKs that could reject writes. Must verify FK direction and
  nullability before enabling.
- **Low (concept):** `UserProgress.conditionId → MedicalContent` is already
  enforced at write time and there is no legacy data to migrate.

## Recommended order

1. **Resolve schema drift first** (deploy `QuestionIdentity` +
   `StudySessionQuestion` to match `schema.prisma`, confirm `questionIdentityId`
   FKs resolve). This is the real gap; do it while tables are empty (zero risk).
2. **Source-identity migration** becomes a no-op backfill (0 rows) + the
   forward-only guard tests already specified. Add `source`/identity guard tests
   and ship.
3. **Concept-identity migration** is likewise backfill-free; add the FK
   constraint + the before/after aggregation test (trivially equal on empty
   data) and ship.

## Rollback strategy

- Each migration is additive (new table / new nullable column / new FK). Roll
  back by dropping the added object; no data transformation to reverse because
  there is no historical data.
- Take a pre-migration snapshot of `schema.prisma` + a `prisma migrate` entry so
  the change is a single revertible migration file.

## Tests required

- Before: `prisma validate`; confirm `QuestionIdentity`/`StudySessionQuestion`
  absent and the guarded code paths still pass the full unit suite (they do
  today).
- After: FK/domain guard tests for the new tables; submit-review idempotency +
  single-writer suites unchanged; progress-aggregation parity test (equal on
  empty data, re-run post-launch once rows exist).

## Should the migration wait for the 89 manual links?

**No — they are independent.** The 89 unlinked rows are a *content* problem
(serving pool health) already contained by the serving gate. The P0 migrations
are *schema/provenance* work on empty learning tables. Sequence the schema-drift
fix whenever convenient; review the 89 links before launch so the live pool is
populated. Neither blocks the other.

## Recommendation

Do **not** treat these as large/blocking P0s anymore. Reclassify: the dangerous
"migrate historical learning data" work does not exist (tables are empty). The
actionable item is the **schema-drift deployment** of `QuestionIdentity` /
`StudySessionQuestion` while the cost is zero. Await Aaron's approval before
implementing (migrations touch production schema — Ask-First per CLAUDE.md).
