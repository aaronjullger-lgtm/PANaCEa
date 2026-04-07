# Spaced Repetition Calibration Methodology

*Internal research memo — April 2026*
*Relevant to: calibrationService.ts, retrievabilityCalibrationService.ts, confidence pipeline validation*

---

## Context

PANaCEa has two calibration systems operating at different levels:

1. **Behavioral confidence calibration** (`calibrationService.ts`) — Compares implicit confidence from the behavioral pipeline to actual retention on subsequent reviews. Uses Brier score. Per-user, refreshed every 50 reviews or 7 days. Minimum: 30 review pairs.

2. **Retrievability calibration** (`retrievabilityCalibrationService.ts`) — Compares FSRS-predicted retrievability (P(recall) at review time) to actual recall. Uses 10 bins with calibration ratios. Per-system, 24h cache. Minimum: 10 reviews per bin, 50 per system.

This memo synthesizes external research on calibration methodology to identify risks and improvements.

---

## 1. Brier Score: When It Works and When It Doesn't

The Brier score = mean((predicted - actual)²) is the standard metric for calibration of binary predictions. However, it has known limitations relevant to SR:

**High base-rate problem:** In spaced repetition, the base recall rate is typically 85–95% (by design — FSRS targets 90%). This means the "naive" Brier score of always predicting 0.9 is already quite low (~0.09). Small improvements in calibration produce tiny absolute Brier score changes, making it hard to detect whether the 18-step pipeline is actually improving predictions.

**Recommendation:** Use the Modified Brier Score (MSEP) from Qi et al. (2022), which separates model performance from inherent outcome variance: `MSEP = Brier - p(1-p)`, where p is the true positive rate. At 90% recall, p(1-p) = 0.09, so the standard Brier score is dominated by irreducible variance. MSEP isolates the calibration error.

**PANaCEa status:** `calibrationService.ts` computes standard Brier score. Consider adding MSEP alongside it for more sensitive pipeline evaluation.

---

## 2. Sample Size Requirements

The literature is clear: calibration estimates are unreliable with small samples, especially for high-base-rate events.

| Metric | Minimum n for Reliable Estimate | Source |
|---|---|---|
| Brier score (point estimate) | 50+ predictions | Monte Carlo simulations (Bradley et al., 2008) |
| Brier score (CI non-overlapping) | 200+ predictions | Bradley et al., 2008 |
| Calibration slope (regression) | 100+ outcome pairs | Hosmer-Lemeshow standard practice |
| Per-bin recall rates (10 bins) | 30+ per bin = 300+ total | Binomial proportion CI width |
| Per-user calibration (bootstrap CI) | 200+ reviews | Empirical guidance from FSRS benchmark |

**PANaCEa status audit:**

| Service | Current Minimum | Risk | Recommendation |
|---|---|---|---|
| `calibrationService.ts` | 30 review pairs | **Too low.** Brier score from 30 pairs has wide CI (±0.05+). The dampener factor will oscillate between users. | Raise to 100. Below 100, return dampener = 1.0 (neutral). |
| `retrievabilityCalibrationService.ts` | 10 per bin, 50 per system | **Marginal.** 10 per bin gives ~±15% CI on recall rate (binomial). | Raise to 30 per bin. Below that, merge adjacent bins. |
| `fsrsOptimizerService.ts` | 100 reviews | **OK for pretrain**, too low for full 17-parameter optimization. | Already addressed in the FSRS memo. |

---

## 3. Windowing and Staleness

Calibration drifts as the user's memory and study habits change. The right window balances recency (fresh signal) with sample size (enough data).

**Guidance from the FSRS benchmark:** The benchmark uses TimeSeriesSplit — train on older data, evaluate on newer data — to prevent overfitting. Calibration services should follow the same principle.

### Do

- **Use a rolling window, not all-time.** All-time calibration includes early learning data where the user was still building study habits. PANaCEa's calibrationService queries all ReviewLog pairs — this should be windowed to the last 90 days or 500 reviews (whichever is larger).
- **Time-weight recent reviews.** A review from yesterday is more informative about current calibration than one from 3 months ago. Apply exponential decay weighting: `weight = exp(-age_days / 30)`.
- **Recompute on schedule, not on every review.** PANaCEa recomputes every 50 reviews — this is sensible. But also recompute when a new wave of modifiers is enabled (the calibration landscape shifts).

### Don't

- Don't use the same data for both calibrating the dampener and evaluating whether the dampener helps. This is circular — the Brier score will always look better on the data used to fit the dampener.
- Don't cache calibration for more than 7 days for active users (> 10 reviews/day). PANaCEa's 7-day staleness limit is appropriate.

---

## 4. Retrievability Calibration: Bin Design

PANaCEa's `retrievabilityCalibrationService.ts` uses 10 equal-width bins (0–0.1, 0.1–0.2, ..., 0.9–1.0). This is problematic because FSRS schedules reviews near the desired retention (0.9), so the 0.8–0.9 bin gets the vast majority of reviews while low-retrievability bins (0.0–0.5) are nearly empty.

### Do

- **Use quantile bins instead of equal-width bins.** Split the review population into 10 bins of equal count (each containing 10% of reviews). This ensures every bin has sufficient data for reliable calibration ratios.
- **Or merge sparse bins.** If keeping equal-width, merge bins with < 30 reviews into their nearest neighbor. Report the merged range in telemetry.
- **Calibrate correction factors conservatively.** The current clamping ([0.7, 1.4]) is appropriate. But also apply shrinkage toward 1.0 proportional to sample size: `corrected_factor = 1.0 + (raw_factor - 1.0) * min(1, n / 200)`. This prevents low-data bins from producing extreme corrections.

### Don't

- Don't compute per-system corrections with < 200 reviews per system. PANaCEa's threshold of 50 is too aggressive — at 50 reviews, each bin has only 5 reviews on average (meaningless).
- Don't apply corrections from the same data window the user was trained on. Ideally, compute corrections on the last 30 days and evaluate improvement on the most recent 7 days.

---

## 5. Validating the Full Pipeline

The 3-wave behavioral signals add 10 multipliers to the confidence pipeline. The rollout plan (Days 15–17) calls for validation. Here's how:

### Methodology

1. **A/B comparison on historical data:** Replay the last 90 days of ReviewLog data through two paths: (a) raw FSRS predictions, (b) full pipeline predictions. Compare log-loss and RMSE(bins) on the same outcomes.

2. **Per-modifier ablation:** Disable each modifier one at a time and measure log-loss. If removing a modifier *improves* log-loss, that modifier is adding noise and should be disabled or retrained.

3. **Stratified analysis:** Compute log-loss separately for new users (< 100 reviews), intermediate (100–500), and experienced (500+). The pipeline may help experienced users but hurt new ones.

### Minimum viable validation dataset

Per the FSRS benchmark methodology: you need **at least 400 reviews per user** for reliable log-loss comparison between two algorithms. With fewer reviews, the noise exceeds the signal from modifier improvements.

---

## 6. Cold-Start Calibration

New users (< 30 review pairs) get `dampener = 1.0` from `calibrationService.ts` — correct. But the 18-step pipeline still applies other modifiers (session regularity, distractor chronometry, etc.) whose thresholds were tuned on experienced users.

**Recommendation:** Add a global "pipeline trust ramp" that scales all non-FSRS modifiers by `min(1, total_reviews / 100)`. At 0 reviews, all modifiers are 1.0 (neutral). At 100 reviews, full modifier strength. This prevents the pipeline from making aggressive adjustments on users with no baseline.

---

## Sources

- [Modified Brier score for binary outcomes — Qi et al. (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9691523/)
- [Sampling Uncertainty and Confidence Intervals for the Brier Score — Bradley et al. (2008)](https://journals.ametsoc.org/view/journals/wefo/23/5/2007waf2007049_1.xml)
- [Brier Score — Wikipedia](https://en.wikipedia.org/wiki/Brier_score)
- [Benchmark of Spaced Repetition Algorithms — Expertium](https://expertium.github.io/Benchmark.html)
- [Model Calibration, Explained — Towards Data Science](https://towardsdatascience.com/model-calibration-explained-a-visual-guide-with-code-examples-for-beginners-55f368bafe72/)
- [On misconceptions about the Brier score — ScienceDirect (2025)](https://www.sciencedirect.com/science/article/pii/S2590113325000604)
- [A technical explanation of FSRS — Expertium](https://expertium.github.io/Algorithm.html)
