# Core Learning-Loop Stabilization (Phase 2)

**Scope:** Verify (and fix only where confirmed broken) the P0 learning loop the audit bundle flagged: `/api/srs/due`, answer submission, ReviewLog write, FSRS scheduling update, next-item selection, dashboard/readiness display.

**Method:** current code + local test execution win over audit text. **No prod connections, no live AI/DB.**

**Design invariant (owner-confirmed):** PANaCEa FSRS rating is **behaviorally-derived implicit confidence**. There are **NO explicit student-facing rating buttons** anywhere in the loop. Verified: `components/session/QuizView.tsx` contains no rating-button UI; `lib/implicit-metrics.ts` derives the rating from telemetry (`deriveContinuousRating` → binary `Again(1)`/`Good(3)`; `Hard`/`Easy` explicitly deprecated). Any UI work must surface feedback/schedule outcomes only — never solicit a rating.

---

## 1. Due-card retrieval — `/api/srs/due` (#227)

**Audit claim:** 500 error breaks the unified dashboard.
**Current code (`functions/api/srs/due.ts`):** reads the **canonical** stores (`Card` + `UserTopicProgress` + `UserProgress`), filters to `lifecycleStatus=ACTIVE`/`qaStatus=APPROVED` cards, dedups overlapping condition/task rows (`suppressDuplicateDueRows`), sorts by due-date then priority, and — critically — its `catch` returns an **empty, resilient 200 payload** (`{ items: [], totalDue: 0, error: '…' }`), **never a 500**.

**Verification:** `functions/api/srs/{due,submit,submit-compat}.test.ts` → **23 tests pass**; dashboard response contract additionally locked in `functions/api/srs/due.test.ts` (`items`/`totalDue`/`timestamp` stable keys; degraded path never 500).

**Verdict:** ✅ **Code-resolved.** The 500 root cause (previously an unguarded Prisma/query failure) is gone. Issue #227 can be closed by the owner after they confirm in their environment. Full request/response contract: [`docs/api/API_OVERVIEW.md`](api/API_OVERVIEW.md#get-apisrsdue).

### Flow (current)
```
GET /api/srs/due  (authenticatedEndpoint + Zod query schema)
  → resolveOrCreateUserId(clerkId)
  → Promise.all([ Card.findMany(due<=now, ACTIVE+APPROVED),
                  UserTopicProgress.findMany(nextReviewDate<=now),
                  UserProgress.findMany(nextReviewAt<=now) ])
  → suppressDuplicateDueRows()  (card > topic > condition specificity)
  → sort(dueDate, priority) → slice(limit)
  → 200 { items, totalDue, source:'canonical_fsrs_progress', suppressedDuplicates }
  catch → 200 { items:[], totalDue:0, error } // resilient, no 500
```

---

## 2. Answer submission → ReviewLog write → FSRS update

**Audit claim (FSRS + Deep audits):** "No production code writes to ReviewLog"; optimizer starved.
**Current code:** FALSE. Production drill/review submission writes real ReviewLog rows:
- `functions/api/drills/submit-review.ts` → `lib/services/drillReviewService.ts` calls `prisma.reviewLog.create` (lines 1618, 2119) via the dedicated `lib/services/reviewLogService.ts` (`createReviewLogEntry`).
- `reviewLogService` validates DB CHECK constraints (grade[0,4], state[0,3], difficulty[0,1], retrievability[0,1], …) and enforces `review_type ∈ {real, rapid_guess, cram, practice}` with `sessionType` classification, keeping non-`real` artifacts (rapid-guess/cram/practice) out of `real` FSRS statistics.

**Verification:** `tests/drillReviewService.test.ts` → **17 tests pass** (covers rating derivation, ReviewLog write, isolation).

**Verdict:** ✅ **Stale claim.** Data pipeline is wired. No schema change attempted (none needed).

### Flow (current)
```
Client (QuizView / DrillShell) collects behavioral telemetry
  (timeToFirstClick, answerSwitches, dwell, hoverOscillations, …)  ← NO rating buttons
  → POST /api/drills/submit-review (Zod-validated)
  → drillReviewService:
       correctness check
       → deriveContinuousRating(telemetry)         (lib/implicit-metrics.ts) → Again/Good
       → par-time lookup + circadian adjust
       → FSRS.next() (lib/fsrs.ts) → new stability/difficulty/state/due
       → createReviewLogEntry() (review_type gated)  → ReviewLog row
       → QuestionAttempt + UserProgress updates
  → 200 { isCorrect, rating, stability, difficulty, nextReview, retrievability }
```

---

## 3. Study-mode review loop (#239)

**Audit claim:** main-session review loop broken ("Question not found" for pool/seed-sourced questions).
**Current code:** the **question-identity contract** migration `prisma/migrations/20260517000000_add_question_identity_contract` is applied, and identity fields (`questionIdentity`, `canonicalQuestionId`, `questionSource`) flow through session generation, the client transform, and submit-review resolution (`functions/api/drills/_shared/reviewQuestionResolver.ts`). Related tests pass (`reviewQuestionResolver`, `questions/attempt`, `study/session-generate`, `questionIdentity`, `useStudyStore` → **69 tests**).

**Gap:** the two #239-specific additions — the **serving-safety gate `withProgressLinkage`** and the **`fsrsSkippedReason` observability flag** — are **absent** from this branch. They live in **open PR #239**, whose remaining rollout steps (live AI clinical re-linking of 89 unlinked questions + authenticated full-loop smoke) are **blocked on live secrets/infra** (`GEMINI_API_KEY`, `DATABASE_URL`, `CLERK_SECRET_KEY`) that this mission must not touch.

**Verdict:** ⏸️ **Substantially fixed in open PR #239; infra/secret-blocked.** Per owner direction, we **verify + document, do not re-implement** (re-implementing would duplicate/conflict with the PR and requires prod access). The current branch's loop is coherent for linked/canonical questions (69 tests green); unlinked pool questions remain conservatively quarantined until PR #239's live steps run.

---

## 4. FSRS Session UI completeness (#210)

**Audit/issue text:** mentions "Again / Hard / Good / Easy" rating buttons and session polish.
**Resolution:** the "Again/Hard/Good/Easy" wording is a **docs lead to ignore** — it contradicts the owner-confirmed implicit-only design. The FSRS state machine round-trip (New→Learning→Review→Relearning) is exercised by `test:critical` (143 tests incl. `fsrs-canonical-verification`) and `drillReviewService`. No incoherent break was found in the submit→schedule→persist path on this branch. **No explicit rating UI was added or should be.** Remaining #210 items are polish tracked by the owner; not a code-correctness blocker.

**Verdict:** ✅ **Loop is coherent & implicit-only.** No unsafe UI surface introduced.

---

## 5. Next-item selection & dashboard/readiness display

- Next-item: driven by `/api/srs/due` ordering + session generation (`functions/api/study/session/generate.ts`) — verified via loop tests.
- Dashboard readiness widgets (`ReadinessVitalsWidget`, `PanceReadinessTimelineWidget`) — some retain mock fallbacks; triaged in `docs/mock-fallback-and-placeholder-inventory.md` (Phase 5). These are display-layer, not loop-correctness, issues.

---

## 6. Before / after summary

| Loop stage | Audit said | Verified now | Action |
|---|---|---|---|
| Due retrieval | 500 breaks dashboard | Resilient 200; 23 tests pass | none (code-resolved) |
| Answer submit | — | Zod-validated, implicit rating | none |
| ReviewLog write | "nothing writes it" | Wired + isolated; 17 tests | none (stale) |
| FSRS update | core correct, pipeline broken | core + pipeline both working; 143 crit tests | none |
| Study-loop identity (#239) | broken | identity contract present; serving-gate in open PR | verify+document |
| Session UI (#210) | incomplete, add rating buttons | coherent, implicit-only (no buttons) | none (buttons forbidden) |
| Next-item / dashboard | — | works; some mock fallbacks in widgets | Phase 5 triage |

**Conclusion:** The core learning loop is **functional and safe on this branch**; the audit's two loudest P0 loop claims (ReviewLog + `/api/srs/due` 500) are **already resolved in code and proven by passing tests**. The only residual loop gap (#239 serving gate for unlinked questions) is correctly quarantined and lives in an infra-blocked open PR — not re-implemented here.
