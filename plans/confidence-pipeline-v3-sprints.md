# Confidence Pipeline v3 — Sprint Plan

**Date:** 2026-04-02
**Goal:** Seven research-backed enhancements to the behavioral analytics → confidence → FSRS scheduling pipeline.

## Sprint Dependency Graph

```
Sprint 1 (Fatigue Dampener) ──┐
Sprint 2 (Desirable Difficulty) ──┤
Sprint 3 (Interference Detection) ──┤──→ drillReviewService integration
Sprint 4 (Ex-Gaussian RT) ──┤
Sprint 6 (Confidence→Difficulty) ──┤
Sprint 7 (Cross-Session Trend) ──┘
Sprint 5 (Calibration Dashboard) ← reads from calibrationService (independent)
```

---

## Sprint 1: Session Fatigue Confidence Dampener

**Research:** Warm (1984) vigilance decrement; Helton & Russell (2015) cognitive resource depletion
**Problem:** `sessionFatigueService.ts` already adjusts par time, but doesn't dampen *confidence*. Late-session correct answers feel fluent but are produced under cognitive fatigue — their confidence should be discounted.
**Files:**
- MODIFY `lib/services/sessionFatigueService.ts` — Add `computeFatigueConfidenceDampener(questionNumber)` returning [0.85, 1.0]
- MODIFY `lib/services/drillReviewService.ts` — Apply fatigue confidence dampener in Step 3 of the pipeline

---

## Sprint 2: Desirable Difficulty Bonus

**Research:** Bjork & Bjork (2011) desirable difficulties; Kornell & Bjork (2009) generation effect
**Problem:** Correct answers with low confidence get penalized by the stability multiplier. But effortful correct retrieval (slow + hesitant but RIGHT) strengthens memory more than easy recall.
**Files:**
- NEW `lib/confidence/desirableDifficultyBonus.ts` — `computeDesirableDifficultyBonus(confidence, isCorrect, elapsedDays)` returning stability multiplier [1.0, 1.25]
- MODIFY `lib/services/drillReviewService.ts` — Apply after stability multiplier for correct+low-confidence answers

---

## Sprint 3: Retrieval Interference Detection

**Research:** Anderson & Neely (1996) retrieval-induced forgetting; Anderson et al. (1994) fan effect
**Problem:** Reviewing confusable cards in the same session inflates confidence via recency priming.
**Files:**
- NEW `lib/confidence/interferenceDetector.ts` — `detectInterference(questionId, conditionId, sessionReviewHistory)` returning discount factor [0.85, 1.0]
- MODIFY `lib/services/drillReviewService.ts` — Apply interference discount to confidence before stability multiplier

---

## Sprint 4: Ex-Gaussian RT Distribution Modeling

**Research:** Ratcliff (1978) drift-diffusion model; Luce (1986) ex-Gaussian RT decomposition
**Problem:** Z-score normalization assumes Gaussian RT. Real RT is right-skewed (ex-Gaussian). The tau component captures attentional lapses vs genuine struggle.
**Files:**
- NEW `lib/confidence/exGaussianRT.ts` — `fitExGaussian(rtValues)` returning {mu, sigma, tau}; `classifyRT(rt, params)` returning {signal, isLapse}
- MODIFY `lib/services/userTimingProfileService.ts` — Store ex-Gaussian params in behavioral baseline
- MODIFY `lib/implicit-metrics.ts` — Use ex-Gaussian classification when baseline includes these params

---

## Sprint 5: Metacognitive Feedback Dashboard

**Research:** Dunlosky et al. (2013) metacognitive monitoring; Carpenter et al. (2016) calibration feedback
**Problem:** calibrationService data is server-only. Surfacing it improves student metacognition → better implicit signals → better scheduling.
**Files:**
- NEW `components/dashboard/CalibrationChart.tsx` — React component showing calibration curve
- NEW `functions/api/user/calibration.ts` — API endpoint returning user's calibration profile

---

## Sprint 6: Confidence-Weighted Difficulty Updates

**Research:** Metcalfe & Kornell (2005) region of proximal learning; Pyc & Rawson (2009) difficulty modulation
**Problem:** FSRS updates difficulty the same way for all "Good" ratings, but 0.92 confidence ≠ 0.45 confidence.
**Files:**
- NEW `lib/confidence/difficultyModulator.ts` — `modulateDifficultyDelta(baseDelta, confidence, isCorrect)` returning adjusted delta
- MODIFY `lib/services/drillReviewService.ts` — Apply difficulty modulation after FSRS next()

---

## Sprint 7: Cross-Session Trend Detection

**Research:** Bjork (1999) retrieval practice; Kornell et al. (2009) spacing effects across sessions
**Problem:** Single-review snapshots miss declining trajectories. A card with confidence 0.85→0.72→0.58 has an encoding problem.
**Files:**
- NEW `lib/confidence/trendDetector.ts` — `detectConfidenceTrend(reviewHistory)` returning {slope, isConcerning, trendMultiplier}
- MODIFY `lib/confidence/bayesianAccumulator.ts` — Feed trend signal into accumulation
- MODIFY `lib/services/drillReviewService.ts` — Apply trend multiplier to stability

---

## Success Criteria
- All 7 modules have comprehensive unit tests
- drillReviewService integrates all new pipeline stages
- Cold-start graceful degradation (new users get neutral values)
- No changes to FSRS core algorithm (fsrs.ts untouched)
- All existing 160+ tests continue passing
