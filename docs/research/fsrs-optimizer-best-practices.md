# FSRS v6 Optimizer & Post-Hoc Modifier Best Practices

*Internal research memo — April 2026*
*Relevant to: confidence pipeline (Waves 1–3), fsrsOptimizerService, drillReviewService*

---

## Context

PANaCEa uses FSRS v6 (21 parameters) with an 18-step confidence pipeline that applies post-hoc multipliers to FSRS-computed stability and difficulty. This memo synthesizes guidance from the open-spaced-repetition project (Expertium, Jarrett Ye, fsrs-rs/ts-fsrs, Anki FSRS benchmark) on when post-hoc modifiers help vs. hurt, and how to safely optimize parameters alongside custom modifiers.

---

## 1. Minimum Review Thresholds for Optimization

The upstream FSRS community has converged on a tiered approach:

| Reviews Available | Recommended Action |
|---|---|
| < 16 | Use defaults. Optimization cannot beat defaults. |
| 16–100 | "Pretrain" only — optimize w0–w3 (initial stability per rating). Penalize deviation from defaults for all other params. |
| 100–400 | Optimize all safe parameters (w0–w14, w19–w20) with coordinate descent, but use regularization to prevent overfitting. |
| 400–1000 | Full optimization is reliable. Confidence intervals on log-loss stop overlapping around 70 reviews per parameter. |
| > 1000 | Robust optimization. Per-system (e.g., per body system) optimization becomes viable. |

**PANaCEa status:** `fsrsOptimizerService.ts` uses `MIN_REVIEWS_FOR_OPTIMIZATION = 100`. This is reasonable but should implement the pretrain pattern (w0–w3 only) for users with 16–99 reviews rather than falling back entirely to defaults.

**Action item:** Add a "pretrain" path that optimizes only `OPTIMIZABLE_INDICES = [0, 1, 2, 3]` when review count is 16–99.

---

## 2. Parameter Bounds

FSRS v6 parameters have natural ranges. PANaCEa's current bounds in `fsrsOptimizerService.ts` are reasonable but two deserve attention:

| Param | PANaCEa Bound | Upstream Guidance | Issue? |
|---|---|---|---|
| w19 | [0.01, 20.0] | Typically 0.01–0.5 | **Too wide** — values >1.0 cause extreme retrievability curves |
| w20 | [0.01, 2.0] | [0.1, 0.8] per Expertium | **Too wide** — typical user values < 0.2; values > 0.8 produce pathological curves |

**Action item:** Tighten w19 to [0.01, 1.0] and w20 to [0.1, 0.8].

---

## 3. The Post-Hoc Modifier Problem

PANaCEa's 18-step confidence pipeline applies multiplicative modifiers to FSRS stability *after* the core FSRS computation. This is the single biggest architectural risk to scheduling quality. The FSRS community has not published guidance on this pattern because it's unique to PANaCEa.

### Why it's risky

FSRS was designed as a self-contained system: parameters are optimized to minimize log-loss between predicted retrievability and actual recall. When you multiply stability by external factors (e.g., 0.85 for distractor chronometry × 0.95 for session regularity × 1.08 for explanation engagement), you are shifting the predicted next-review date away from what the optimizer learned is optimal.

If the optimizer later re-trains on review data that was scheduled using modified intervals, it will try to compensate for the modifiers by adjusting its own parameters in the opposite direction, creating a feedback loop.

### Do

- **Keep the total modifier range narrow.** The product of all modifiers in a single review should stay within [0.70, 1.40]. PANaCEa's `retrievabilityCalibrationService` already clamps to this range — good. But the confidence pipeline's 18 multipliers can compound beyond this.
- **Log the unmodified FSRS stability alongside the modified stability** in every ReviewLog so the optimizer can train on the raw FSRS output, not the post-modified value. *(PANaCEa does log `final_stability` — verify this is the modified value and add `raw_fsrs_stability` separately.)*
- **Exclude modifier-adjusted intervals from optimizer training.** The optimizer's log-loss should compare raw FSRS predictions vs. outcomes, not modifier-adjusted predictions.
- **Monitor total modifier product distribution.** If the mean total modifier deviates from 1.0 over a 7-day window, the pipeline is introducing systematic bias.
- **Clamp the total pipeline product** to [0.65, 1.50] as a hard safety rail.

### Don't

- Don't optimize FSRS parameters on review data where intervals were modified without accounting for it. This creates a "double jeopardy" where modifiers and parameters chase each other.
- Don't let any single modifier exceed ±30% (0.70–1.30). The current services respect this individually but they multiply.
- Don't apply modifiers when the user has < 50 reviews. New users should get unmodified FSRS until the pipeline has enough signal.

---

## 4. Desired Retention Interaction

FSRS computes intervals from a `desired_retention` parameter (default 0.9 = 90% target recall). The PANaCEa pipeline effectively modifies the realized retention by adjusting stability — a 0.85× stability modifier is equivalent to targeting ~92% retention instead of 90% (shorter intervals → higher retention).

**Guidance:** Don't expose `desired_retention` as a user-facing setting if the pipeline is already modifying stability. The two mechanisms conflict: the user thinks they're getting 90% retention, but modifiers might silently push it to 95%. If you do expose it, the modifier pipeline should be aware of the user's `desired_retention` and scale its effects proportionally.

---

## 5. Binary Rating System Considerations

PANaCEa uses Again/Good only (Hard/Easy deprecated). The FSRS optimizer was designed for 4-rating input. With binary ratings:

- w15 (hard penalty) and w16 (easy bonus) are irrelevant — already skipped in `OPTIMIZABLE_INDICES`, good.
- The optimizer has less signal per review (2 ratings instead of 4), so convergence requires ~2× more reviews than the thresholds above.
- The continuous grade (grade_continuous) PANaCEa feeds to FSRS partially compensates but is not a standard FSRS input — the optimizer should weight reviews by the confidence in the continuous grade (telemetry quality).

---

## 6. Monitoring Checklist

After deploying the 3-wave pipeline, monitor these metrics weekly:

1. **Mean total modifier product** — should hover near 1.0 (target: 0.95–1.05)
2. **Log-loss of raw FSRS predictions** — should not increase after enabling modifiers
3. **Log-loss of modified predictions** — should be lower than raw (that's the point)
4. **Per-modifier activation rate** — if a modifier fires on > 80% of reviews, it's not discriminating; consider raising its threshold
5. **Stability ratio (modified / raw)** — distribution should be unimodal, centered near 1.0

---

## Sources

- [A technical explanation of FSRS — Expertium](https://expertium.github.io/Algorithm.html)
- [Benchmark of Spaced Repetition Algorithms — Expertium](https://expertium.github.io/Benchmark.html)
- [The Algorithm — open-spaced-repetition wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)
- [FSRS minimum review limit research — Anki #3094](https://github.com/ankitects/anki/issues/3094)
- [ts-fsrs algorithm source](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/src/fsrs/algorithm.ts)
- [FSRS4Anki tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md)
- [The optimal retention — FSRS wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention)
