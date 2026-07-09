# FSRS Current-State & Hardening Report (Phase 4)

**Guide:** `FSRS_AUDIT_REPORT.md` (bundle, dated "2025"). **Rule:** verified against current code; no scheduling-semantics changes without tests + product/science approval. Implicit-only design (behavioral confidence, no explicit rating buttons) is a hard constraint.

---

## 1. Verified current state

| Component | File | Verdict |
|---|---|---|
| Core v6 scheduler | `lib/fsrs.ts` | Correct per spec; retrievability factor is a documented deviation (below). |
| Retrievability | `lib/fsrs-retrievability.ts`, `lib/fsrs.ts:718` | `factor=w[19]`, `decay=-w[20]`; documented `S = time to ~75.4% retention`. |
| v7 extensions | `lib/fsrs-v7.ts` (`forgettingCurve: 'placeholder'`), `lib/fsrs-version-selector.ts` | **Explicitly labeled `v7-alpha` / placeholder**; **default is always v6**, no implicit migration (`fsrs-version-selector.ts:14`). |
| Optimizer bridge | `lib/fsrs-optimizer.ts`, `lib/services/fsrsOptimizerService.ts`, `gcp-fsrs-optimizer/` | v6/v7 version-dispatched retrievability; non-deterministic downsampling noted (below). |
| ReviewLog pipeline | `lib/services/reviewLogService.ts`, `lib/services/drillReviewService.ts` | **Wired** (writes real ReviewLog; `review_type` gated). Contradicts the stale "nothing writes ReviewLog" claim. |
| Data isolation | `review_type ∈ {real,rapid_guess,cram,practice}` + `sessionType` | Enforced at the service layer; non-`real` artifacts excluded from `real` FSRS stats. |

**Test coverage (verified green):** `npm run test:critical` = **143 tests** across `tests/fsrs.test.ts`, `tests/fsrs-optimizer-bridge.test.ts`, `tests/retrievability.test.ts`, `tests/fsrs-eor-scheduler.test.ts`, `tests/lib/fsrs-canonical-verification.test.ts`, `tests/store/useStudyStore.test.ts`. Plus `tests/drillReviewService.test.ts` (17). Retrievability, stability/difficulty updates, and scheduling boundaries are already covered → **no redundant tests added** (mission: add only *if missing*).

---

## 2. Findings from `FSRS_AUDIT_REPORT.md` — reconciled

| Audit finding | Verdict now | Action |
|---|---|---|
| **"No production code writes ReviewLog"** (HIGH) | **STALE / FIXED** — wired via `reviewLogService` (Phase 2). | None (documented). |
| Retrievability factor deviation (`w[19]` vs `0.9^(-1/w20)-1`) | **Intentional & documented** product/science choice (ts-fsrs defaults; R(S,S)≈75.4%). Not a bug. | **No change.** Changing it alters every user's intervals → **product/science approval + migration + tests required.** |
| Non-deterministic optimizer downsampling (`random.random()`) | Confirmed present in `gcp-fsrs-optimizer`. | Recommend a fixed seed for reproducibility — **approval-gated** (touches the GCP optimizer service; not run here). |
| v7 8-parameter forgetting curve is a PANaCEa invention | Confirmed; **clearly labeled placeholder/alpha**, v6 default. | None; monitor upstream ts-fsrs v7. |
| Binary Again/Good only; Hard/Easy deprecated | Confirmed and **required** (implicit-only). | Preserve; never add explicit rating buttons. |
| Optimizer min-review threshold mismatch (TS vs Python) | Present; conservative. | Documented; low risk. |

---

## 3. Decisions requiring product/science approval (NOT actioned)
1. **Standardize the retrievability factor** to the spec formula for benchmark comparability — changes scheduling semantics for all users; needs A/B + migration + owner sign-off. Recommendation: keep current documented behavior unless benchmarking demands otherwise.
2. **Deterministic optimizer seed** in the GCP function.
3. **Promote v7-alpha** beyond experimental — blocked until upstream publishes the canonical v7 curve.

## 4. Net
FSRS is mathematically sound, well-tested, correctly version-gated, and its data pipeline is wired (the audit's HIGH ReviewLog finding is stale). No code changes were needed or safe to make in this phase; the only open items are product/science-gated algorithm decisions, documented above.
