# FSRS Data Isolation Policy

This document defines the strict separation between **FSRS (Main Session)** data and **non-FSRS** data (OSCE, Cram, Rapid Recall, side quests) in PANaCEa. It is the source of truth for query filters, write rules, and validation.

---

## 1. Source of Truth

| Concern | Source |
|--------|--------|
| Schema | `prisma/schema.prisma` |
| FSRS-active review data | `ReviewLog` where `review_type = 'real'` **and** `sessionType = 'MAIN'` |
| Legacy FSRS review data | `UserProgress.reviewHistory` (only appended from **main** sessions) |
| Non-FSRS / practice | OSCE → `PatientEncounterSession` + `OsceResult`; Cram/Rapid Recall → `QuestionAttempt` + optional `ReviewLog` with `review_type = 'cram'` |

---

## 2. FSRS Query Isolation (The "Main Session" Filter)

**Rule:** The FSRS Scheduler and Optimizer must **never** see data from OSCE, Cram, or other non-MAIN modes.

### When querying `ReviewLog` for algorithm/optimizer

- **Always** include one of:
  - `where: { review_type: 'real' }`, or
  - `where: { sessionType: 'MAIN' }`
- Prefer both for clarity: `where: { review_type: 'real', sessionType: 'MAIN' }`

### Endpoints and jobs

| Location | Responsibility |
|----------|----------------|
| `functions/api/user/fsrs-params.ts` | GET/POST use `UserProgress.reviewHistory`; when migrating to `ReviewLog`, filter by `review_type: 'real'`. |
| `functions/api/user/update-fsrs-params.ts` | Writes `UserProgress.fsrsParams` only; does not aggregate reviews. Params apply to MAIN session scheduling only. |
| `functions/api/user/review-history.ts` | Optional `?mainOnly=true`: returns only `QuestionAttempt` with `mode in ['session','main','MAIN']`. |
| `scripts/automation/jobs/fsrsOptimization.ts` | `reviewLog.groupBy` uses `where: { review_type: 'real', sessionType: 'MAIN' }`. |

### SRS endpoints (`functions/api/srs/`)

- `next`, `due`, `stats` use `SRSItem` and `UserTopicProgress`; they do **not** read `ReviewLog`.
- When adding any `ReviewLog`-based query in SRS or user APIs, always apply the main-session filter above.

---

## 3. Write Protection (The Firewall)

**Rule:** Non-MAIN modes must not pollute FSRS state. MAIN-only data must not be written from OSCE or Cram paths.

### OSCE

| Endpoint / Flow | Writes | Must NOT |
|-----------------|--------|----------|
| `POST /api/osce/complete` | `PatientEncounterSession` (status, diagnosis, treatmentPlan) | Create `ReviewLog` |
| `POST /api/osce/analysis/grade` | `OsceResult` (+ optional `ConceptGap`) | Create or update `ReviewLog` or Card/UserProgress |

### Drills / practice modes

| Endpoint / Flow | When `sessionType` = main | When `sessionType` = cram or rapid_recall |
|-----------------|---------------------------|------------------------------------------|
| `POST /api/drills/submit-review` → `drillReviewService.submitDrillReview` | Updates `UserProgress.reviewHistory` and FSRS card state | Does **not** update `UserProgress.reviewHistory` or Card/UserTopicProgress |
| Future `ReviewLog` writes | `review_type: 'real'`, `sessionType: 'MAIN'` | `review_type: 'cram'`, do **not** update Card/UserTopicProgress |

### When adding `ReviewLog` writes

- **Main session:** Set `review_type: 'real'` and `sessionType: 'MAIN'`.
- **Cram / Rapid Recall / OSCE (if ever logged for history only):** Set `review_type: 'cram'` and do **not** update Card or UserTopicProgress/UserProgress FSRS state.

---

## 4. Siloed Analytics (OSCE & Side Quests)

**Rule:** OSCE and practice metrics must not depend on FSRS tables (`ReviewLog` for algorithm, Card, etc.).

### OSCE stats

- **API:** `GET /api/osce/stats` — returns metrics from **`OsceResult` and `PatientEncounterSession` only** (pass rate, average score, average clinical reasoning score, trend).
- **Dashboard:** `functions/api/dashboard/stats.ts` already uses `PatientEncounterSession` + `OsceResult` for OSCE-related stats; keep this siloed from `ReviewLog`.
- **Frontend:** Use `/api/osce/stats` for "Clinical Competency Trend" (e.g. session date vs score / clinicalReasoningScore). Do not use FSRS "Forgetting Curve" or ReviewLog for OSCE.

### Indexes (see `prisma/schema.prisma`)

- `PatientEncounterSession`: `@@index([userId, startTime])` for trend by user and time.
- `OsceResult`: `@@index([score])` for pass-rate and score-band aggregations.

---

## 5. Type Safety

**File:** `functions/api/_shared/types.ts`

- **`FSRSSessionType`** = `'MAIN'` (only session type that affects FSRS).
- **`PracticeSessionType`** = `'CRAM' | 'RAPID_RECALL' | 'CUSTOM_DRILL'`.
- **`ClinicalSessionType`** = `'OSCE' | 'GRAND_ROUNDS'`.
- **`isFSRSEligible(mode)`** — type guard; use when writing `ReviewLog` or deciding whether to update Card/UserProgress.
- **`FSRS_REVIEW_TYPE_REAL`** / **`FSRS_REVIEW_TYPE_CRAM`** — use when setting `review_type`.

Use these types and guards so that OSCE/clinical modes cannot be passed into FSRS scheduling or optimization logic.

---

## 6. Data Cleanup and Validation

### Purge (before enabling v6 Optimizer)

```bash
npx ts-node scripts/purge-bad-fsrs-logs.ts [--dry-run] [--delete]
```

- **Default:** Downgrade bad rows to `review_type: 'cram'` and `fsrsVersion: 'archived_purge'`.
- **`--dry-run`:** Log only; no writes.
- **`--delete`:** Delete bad rows instead of downgrading.
- Bad = `review_type: 'real'` and (sessionType in CRAM/RAPID_RECALL, or questionType in osce/wordle/patient_encounter/tutorial, or duration null, or stability 0).

### Health check

```bash
npx ts-node scripts/verify-fsrs-health.ts
```

- Fails if any `ReviewLog` has `review_type: 'real'` and `sessionType != 'MAIN'` (or real + non-eligible questionType).
- Run after purge and periodically to confirm isolation.

### Optional DB constraint

- **Migration:** `prisma/migrations/20260205120000_enforce_fsrs_purity/migration.sql`
- **Effect:** CHECK that `review_type = 'real'` only when `sessionType = 'MAIN'`.
- **When:** Apply after purging bad rows; skip if you rely only on application-level enforcement.

---

## 7. SRS Gatekeeper

**`GET /api/srs/next`**

- Rejects requests with `mode` = `OSCE`/`osce` or `DRILL`/`drill` with **400** and a message to use `/api/osce/cases/random` for OSCE.
- MAIN, CRAM, RAPID_RECALL continue to existing next-item logic.

---

## 8. Quick Reference

| I want to… | Do this |
|------------|--------|
| Query reviews for FSRS optimizer/scheduler | Filter `ReviewLog` with `review_type: 'real'` and `sessionType: 'MAIN'` (or use `UserProgress.reviewHistory` which is main-only at write time). |
| Write a main-session review | Set `review_type: 'real'`, `sessionType: 'MAIN'`; update Card/UserProgress as needed. |
| Write a cram/rapid/OSCE review (history only) | Set `review_type: 'cram'`; do **not** update Card or UserProgress FSRS state. |
| Show OSCE stats / trend | Use `GET /api/osce/stats` and `OsceResult` + `PatientEncounterSession` only. |
| Check isolation health | Run `scripts/verify-fsrs-health.ts`. |
| Clean bad FSRS data | Run `scripts/purge-bad-fsrs-logs.ts` (optionally with `--dry-run` first). |
