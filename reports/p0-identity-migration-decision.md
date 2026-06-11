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

## CORRECTION (2026-06-11): there is NO schema drift

> The "tables do not exist" rows below were a **false alarm** from the
> 2026-06-10 probe, which queried the Prisma *model* names (`QuestionIdentity`,
> `StudySessionQuestion`) instead of the actual Postgres table names set by
> `@@map(...)`. Re-probed 2026-06-11 against `lzfescdrpezzjhgveotz` by table name:

| Postgres table (`@@map`) | Exists | Rows | Columns / indexes / FKs |
| --- | --- | --- | --- |
| `question_identities` (`QuestionIdentity`) | **yes** | 2197 | match `schema.prisma` exactly |
| `study_session_questions` (`StudySessionQuestion`) | **yes** | 0 | match `schema.prisma` exactly |
| `Card` / `StudentReservoirItem` | yes | — | — |

Both backing migrations are recorded as **applied** in Prisma's `_prisma_migrations`
ledger:
- `20260502000000_normalized_study_schema` (applied; one earlier attempt was
  rolled back then re-applied cleanly)
- `20260517000000_add_question_identity_contract` (applied)

`npx prisma validate` passes; the live columns, indexes, and foreign keys match
the schema. **No migration is required — the schema is in sync.** The
`questionIdentityId` columns on `QuestionAttempt` / `ReviewLog` / `Card` /
`SavedQuestion` and the `study_session_questions` FKs all resolve.

### Original (now-superseded) live DB state from 2026-06-10

| Table | Rows | Note |
| --- | --- | --- |
| `QuestionAttempt` | **0** | has `questionIdentityId` column |
| `ReviewLog` | **0** | has `questionIdentityId` column |
| `UserProgress` | **0** | 0 orphan `conditionId` |
| ~~`QuestionIdentity` table~~ | — | **WRONG — table exists as `question_identities`** |
| ~~`StudySessionQuestion` table~~ | — | **WRONG — table exists as `study_session_questions`** |
| `Card` / `StudentReservoirItem` tables | exist | — |

**The learning tables (QuestionAttempt/ReviewLog/UserProgress) are empty — this
is pre-launch data.** There is no history to backfill, which removes the
large/destructive part of the two *concept-identity* migrations below.

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

## What remains (after the 2026-06-11 correction)

- **Schema drift: NONE.** `question_identities` and `study_session_questions`
  are deployed and match the schema; `questionIdentityId` FKs resolve. The
  durable normalization those tables provide IS available. Nothing to fix here.
- **Concept-identity (UserProgress.conditionId → MedicalContent):** still a
  forward-only design item, but backfill-free (UserProgress is empty) and
  already enforced at write time by `resolveProgressConditionId()`. Not blocking.

## Risks

- **Low (data):** empty learning tables → no backfill, no historical
  reconciliation, no risk of corrupting existing progress.
- **Medium (schema):** deploying `QuestionIdentity` / `StudySessionQuestion`
  must match the Prisma schema exactly, or the existing `questionIdentityId`
  columns become real FKs that could reject writes. Must verify FK direction and
  nullability before enabling.
- **Low (concept):** `UserProgress.conditionId → MedicalContent` is already
  enforced at write time and there is no legacy data to migrate.

## Remaining work (none is schema-drift)

1. ~~Resolve schema drift~~ — **DONE / not needed.** The identity tables are
   deployed and applied through the Prisma ledger; `prisma validate` passes.
2. **Source-identity migration** (`source` columns on attempt/review/seen
   tables) — backfill-free (0 rows). Optional forward-only hardening; the
   normalized `question_identities` table already carries provenance, so this is
   no longer load-bearing.
3. **Concept-identity** (`UserProgress.conditionId → MedicalContent`) —
   backfill-free; already enforced at write time. Add the FK + parity test
   when convenient.

## Rollback strategy (for the optional future items only)

- Any future item is additive (new nullable column / new FK). Roll back by
  dropping the added object; no data to reverse (empty tables).

## Verification performed 2026-06-11

- `npx prisma validate` → schema valid.
- Live introspection by table name: `question_identities` (2197 rows) and
  `study_session_questions` (0 rows) present with matching columns/indexes/FKs.
- `_prisma_migrations` shows both backing migrations applied.

## Recommendation

The identity schema is **already in sync** — no migration to deploy, nothing
blocked. The two concept-identity items are backfill-free, write-time-enforced,
and non-blocking; pursue them as routine hardening, not as launch-gating P0s.
