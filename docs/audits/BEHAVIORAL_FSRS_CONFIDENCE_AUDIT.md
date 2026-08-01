# PANaCEa Behavioral Analysis, FSRS & Confidence Pipeline Audit

**Date:** 2026-07-31  
**Scope:** Behavioral signal extraction, implicit confidence rating, FSRS scheduling, confidence pipeline, and calibration systems  
**Authority:** Research specifications in `docs/research/` are the intended system. `CLAUDE.md` and `AGENTS.md` constraints are hard floors. Code in `lib/` is the actual system.  
**Author:** Audit agent (cross-referenced against 10 research docs, 8 planning docs, and live codebase)

---

## 1. Executive Summary

PANaCEa's behavioral/FSRS/confidence pipeline is **substantially built and research-aligned**. The core architecture matches the scientific literature: a multi-stage confidence pipeline (15 numbered steps), 3 waves of behavioral signals (10 signal services), FSRS v6 with 21 parameters, binary Again/Good rating with implicit behavioral inference, and dual calibration systems (per-user Brier + per-system retrievability).

**Key strengths:**
- All 15 documented pipeline steps are implemented with literature citations
- All 10 Wave 1-3 behavioral signal services exist and are wired
- Calibration minimums have been raised to research-recommended levels (100 pairs, 30 per bin, 200 per system)
- Quantile binning implemented for retrievability calibration
- Binary rating enforced via `normalizeRating()` with deprecated values mapped
- Ex-Gaussian RT modeling implemented with method-of-moments fitting

**Key gaps found (12 inconsistencies, 0 critical):**

| Severity | Count | Description |
|----------|-------|-------------|
| P0 Critical | 0 | No FSRS guarantees broken, no data integrity issues |
| P1 High | 3 | Missing safety clamp, missing optimizer pretrain path, missing MSEP metric |
| P2 Medium | 5 | Dead confidence constants, stale FSRS parameter values, missing time-weighting |
| P3 Low | 4 | Doc drift, stale enum values, minor naming inconsistencies |

---

## 2. Scientific Foundation

The PANaCEa pipeline is grounded in peer-reviewed cognitive science research. The key foundational papers and their implementation status:

| Research Finding | Citation | Implementation Status |
|-----------------|----------|----------------------|
| Retrieval fluency predicts confidence | Koriat (1993, 2010) | Response latency in `implicit-metrics.ts` |
| Fluency can mislead (recency priming) | Benjamin, Bjork & Schwartz (1998) | Fluency illusion dampener (Step 5) |
| Testing effect strengthens memory | Roediger & Karpicke (2006) | Core FSRS scheduling loop |
| Spacing effect with optimal intervals | Cepeda et al. (2006) | FSRS stability parameter |
| Answer switching carries 3:1 signal | Metcalfe & Finn (2016) | `answerSwitches` in metrics + Wave 2 switch direction |
| Diffusion decision model (RT = evidence quality) | Ratcliff & McKoon (2008) | Ex-Gaussian RT classification |
| Desirable difficulty strengthens encoding | Bjork & Bjork (2011) | Desirable difficulty bonus (Step 6c) |
| Metacognitive calibration (Brier score) | Koriat & Goldsmith (1996) | `calibrationService.ts` |
| Interference between similar items | Anderson & Neely (1996) | Interference detection (Step 4) |
| Session fatigue degrades performance | Warm (1984); Helton & Russell (2015) | Fatigue dampener (Step 3) |
| Ex-Gaussian RT distribution (lapse detection) | Ratcliff (1978) | `lib/confidence/exGaussianRT.ts` |
| Wilson score lower bound for mastery | Wilson (1927) | `wilsonMasteryService.ts` |
| Judgment of Learning (JOL) from RT change | Nelson & Dunlosky (1991) | RT trajectory (Step 6a) |
| Ebbinghaus savings (relearning speed) | Ebbinghaus (1885) | Relearning speed (Step 6b.2, Wave 3C) |
| FSRS-6 trainable forgetting curve | open-spaced-repetition/ts-fsrs | `lib/fsrs.ts` with 21 parameters |
| Binary rating is algorithmically sound for FSRS | FSRS benchmark data | `normalizeRating()` + implicit pipeline |

---

## 3. Subsystem Audit: Research-to-Implementation Traceability

### 3.1 FSRS Algorithm (`lib/fsrs.ts`)

| Spec (Research) | Implementation Location | Status | Evidence |
|-----------------|------------------------|--------|----------|
| 21 trainable parameters (w0-w20) | `FSRSParameters.w: number[]` (line 181) | Match | Default array has 21 elements |
| Power-law forgetting curve | `computeRetrievability()` in `lib/fsrs/retrievability.ts` | Match | `R = (1 + factor * t/S)^decay` |
| Stability after successful recall | `schedule()` in `lib/fsrs.ts` | Match | Uses `e^(w8) * (11-D) * S^(-w9) * ...` |
| Stability after forgetting | `schedule()` in `lib/fsrs.ts` | Match | Uses `w11 * D^(-w12) * ...` |
| Difficulty initialization and update | `schedule()` in `lib/fsrs.ts` | Match | `D0(G) = w4 - e^(w5*(G-1)) + 1` |
| Same-day short-term stability | `schedule()` in `lib/fsrs.ts` | Match | `S * e^(w17*(G-3+w18)) * S^(-w19)` |
| FSRSState enum (New/Learning/Review/Relearning) | `FSRSState` (line 83) | Match | 4 states, 0-3 |
| Rating enum (Again/H**d/Good/E**y) | `Rating` (line 90) | Partial | Values 2/4 marked deprecated, `normalizeRating()` maps to binary |
| Default w[19]-w[20] values | `lib/fsrs.ts` line 189 | **Inconsistency** | Impl: w19=0.1597, w20=2.2700 (ts-fsrs defaults). Research doc cites w19=0.0658, w20=0.1542. See F-06. |
| FSRS v7-alpha (29 params, fractional intervals) | `lib/fsrs-v7.ts`, `FSRSAlgorithmVersion` type | Research-only | v7 is a documented placeholder; not yet production-active |

**Status: Working** — Core FSRS-6 algorithm matches spec.

---

### 3.2 Implicit Metrics & Behavioral Signal Extraction (`lib/implicit-metrics.ts`)

| Spec (Research) | Implementation Location | Status | Evidence |
|-----------------|------------------------|--------|----------|
| Response latency (time-to-first-click) | `ImplicitBehaviorMetrics.timeToFirstClick` | Match | Captured in `useImplicitMetrics.ts` hook |
| Answer switching count | `ImplicitBehaviorMetrics.answerSwitches` | Match | Tracked via `recordAnswerSelection()` |
| Hint/help-seeking before answering | `ImplicitBehaviorMetrics.hintViewed`, `hintViewDurationMs` | Match | Optional fields on metrics interface |
| Time-to-commit (dwell after first selection) | `ImplicitBehaviorMetrics.commitmentGapMs` | Match | Micro-kinetics field |
| Cursor trajectory entropy | `ImplicitBehaviorMetrics.cursorEntropy` | Match | Micro-kinetics field |
| Hover oscillation count | `ImplicitBehaviorMetrics.hoverOscillationCount` | Match | Micro-kinetics field |
| Consecutive correct streak | `ImplicitBehaviorMetrics.consecutiveCorrectStreak` | Match | Used by grade modulation |
| Telemetry quality classification (full/partial/minimal) | `assessTelemetryQuality()` | Match | Checks for firstClick + switches + CRPL |
| Ex-Gaussian RT fitting (lapse detection) | `fitExGaussian()`, `classifyRT()` in `lib/confidence/exGaussianRT.ts` | Match | Method-of-moments fitting, 4 classifications |
| Per-user baseline normalization | `UserBaseline` interface | Match | Z-scored against user's own history |
| Continuous rating derivation [1.0, 4.0] | `deriveContinuousRating()` | Match | Outputs float grade + confidence + discrete rating |
| RT percentile thresholds (0.5x and 1.5x of median) | `BEHAVIORAL_CONSTANTS.RT_FAST_MULTIPLIER`, `RT_SLOW_MULTIPLIER` | Match | Exact values from audit spec |
| MVRT rapid-guess filter | `getMVRTThreshold()` from `types/telemetry.ts` | Match | Per-question-type thresholds |

**Status: Working** — All 14 research-documented behavioral features have corresponding implementation fields.

---

### 3.3 Grade Modulation Coordinator (`lib/services/gradeModulationCoordinator.ts`)

| Spec (Research - Audit Doc Section 2) | Implementation | Status | Evidence |
|---------------------------------------|----------------|--------|----------|
| RT zone classification (fast/normal/slow) | `classifyRtZone()` using 0.5x and 1.5x thresholds | Match | Constants match spec exactly |
| Fatigue score computation | `computeFatigueScore()` with RT ratio > 1.3 and accuracy ratio < 0.7 | Match | Thresholds match spec |
| RT deltas: +0.4, +0.3, -0.3, 0.0 | `BEHAVIORAL_CONSTANTS.DELTAS.RT_*` | Match | Exact values from spec |
| Confidence deltas: +0.3, -0.3, -0.15, +0.15 | `BEHAVIORAL_CONSTANTS.DELTAS.CONF_*` | **Inconsistency** | Constants defined but always produce 0 because confidenceCategory is hardcoded to unknown (implicit-only). Dead code. See F-01. |
| Streak deltas: 0.0, +0.05, +0.08 | `BEHAVIORAL_CONSTANTS.DELTAS.STREAK_*` | Match | Exact values, hard cap at streak 4+ |
| Fatigue delta: max -0.2 | `BEHAVIORAL_CONSTANTS.DELTAS.FATIGUE_MAX` | Match | `fatigueScore * -0.2` |
| Effective grade clamping [1.0, 4.0] | `Math.max(1.0, Math.min(4.0, rawGrade + delta))` | Match | |
| Discrete grade mapping (4 bins) | `continuousToDiscreteGrade()` | Match | [1.0,1.5)->1, [1.5,2.5)->2, [2.5,3.5)->3, [3.5,4.0]->4 |
| Ex-Gaussian delta integration | `exGaussianDelta` in `GradeModulation.deltas` | Match | RT signal quality reduces weight on lapse-detected RTs |
| User confidence rating input | `BehavioralContext.userConfidenceRating` | **Removed** | Field was removed 2026-07-31. System is now fully implicit. See F-01. |

**Status: Working with dead code** — Core modulation matches spec exactly, but confidence delta constants are vestigial.

---

### 3.4 Confidence Pipeline (Steps 1-8 + Waves 1-3)

| Pipeline Step | Research Citation | Implementation Line | Status |
|---------------|-------------------|---------------------|--------|
| Step 1: Bayesian accumulation | Blend with card history, prior <= 0.4 | Line 1765 | Match |
| Step 2: Metacognitive calibration | Brier-slope dampener [0.7, 1.3] | Line 1790 | Match |
| Step 3: Session fatigue dampener | Warm (1984); Helton & Russell (2015) | Line 1800 | Match |
| Step 4: Retrieval interference detection | Anderson & Neely (1996) | Line 1804 | Match |
| Step 4b: Session accuracy slope | Sievertsen et al. (2016) | Line 1877 | Match |
| Step 4c (Wave 3B): Session regularity | Habit consistency CV | Line 1882 | Match |
| Step 5: Fluency illusion dampener | Kornell & Bjork (2008); 30% same-day reduction | Line 1868 | Match |
| Step 6: Graduated stability multiplier | Sigmoid centered at 0.6, [0.72, 1.28] | Line 1895 | Match |
| Step 6a: RT trajectory (implicit delayed JOL) | Nelson & Dunlosky (1991) | Line 1898 | Match |
| Step 6b: Interval deviation | Mozer et al. (2009) | Line 1913 | Match |
| Step 6b.1 (Wave 3A): Explanation engagement | Post-error engagement | Line 1921 | Match |
| Step 6b.2 (Wave 3C): Relearning speed | Ebbinghaus savings (post-lapse only) | Line 1931 | Match |
| Step 6c: Desirable difficulty bonus | Bjork & Bjork (2011); [1.0, 1.25] | Line 1957 | Match |
| Step 7: Cross-session trend detection | Bjork (1999); Kornell et al. (2009) | Line 1970 | Match |
| Step 8: Confidence-weighted difficulty modulation | Metcalfe & Kornell (2005) | Line 2011 | Match |

| Wave Signal | Service File | Status |
|-------------|-------------|--------|
| Wave 1A: Lapse severity | `lapseSeverityService.ts` | Match |
| Wave 1B: RT trajectory | `rtTrajectoryService.ts` | Match |
| Wave 1C: Session accuracy slope | `sessionAccuracySlopeService.ts` | Match |
| Wave 1D: Interval deviation | `intervalDeviationService.ts` | Match |
| Wave 2A: Distractor chronometry | `distractorChronometryService.ts` | Match |
| Wave 2B: Switch direction | `switchDirectionService.ts` | Match |
| Wave 3A: Explanation engagement | `explanationEngagementService.ts` | Match |
| Wave 3B: Session regularity | `sessionRegularityService.ts` | Match |
| Wave 3C: Relearning speed | `relearningSpeedService.ts` | Match |
| Wave 3D: Confusion pair recurrence | `confusionPairRecurrenceService.ts` | Match |

**Status: Working** — All 15 steps and all 10 wave signals are implemented, imported, and wired with literature citations.

---

### 3.5 Calibration Services

| Spec (Research) | Implementation | Status | Evidence |
|-----------------------------------------------|----------------|--------|----------|
| Min 100 review pairs for Brier | `MIN_PAIRS_FOR_CALIBRATION = 100` | Match | Was 30, raised to 100 |
| Min 30 per bin, 200 per system | `MIN_BIN_COUNT = 30`, `MIN_SYSTEM_REVIEWS = 200` | Match | Was 10/50, raised to 30/200 |
| Quantile (equal-count) binning | Line 75: quantile binning | Match | Was equal-width, changed to quantile |
| Brier score | `calibrationService.ts` computes standard Brier | Match | |
| Modified Brier Score (MSEP) | Not implemented | **Inconsistency** | See F-03 |
| Time-weighting (exp decay, 30-day) | Not implemented | **Inconsistency** | See F-04 |
| Shrinkage toward 1.0 for small samples | Present in retrievability service | Match | |
| Correction factor clamped [0.7, 1.4] | Present in retrievability service | Match | |

**Status: Mostly working** — Core calibration matches spec. MSEP and time-weighting are research-recommended improvements.

---

### 3.6 FSRS Optimizer

| Spec (Research) | Implementation | Status | Evidence |
|--------------------------------------------|----------------|--------|----------|
| Min 1000 reviews for full optimization | `MIN_REVIEWS_FOR_OPTIMIZATION = 1000` | Match | Conservative |
| Pretrain path for 16-99 reviews | Not implemented | **Inconsistency** | See F-02 |
| Binary ratings need ~2x more reviews | `MIN_REVIEWS = 1000` | Match | Conservative for binary |
| Exclude modifier-adjusted intervals from training | Partially implemented | Partial | Needs verification |

**Status: Partial** — Core optimization works conservatively. Missing the pretrain path for new users.

---

### 3.7 Binary Rating Constraint

| Constraint (CLAUDE.md / AGENTS.md) | Implementation | Status | Evidence |
|-------------------------------------|----------------|--------|----------|
| Binary only: Again/Good | Rating enum values 2/4 deprecated, `normalizeRating()` maps them | Match | Binary enforcement via normalization |
| No self-rated difficulty buttons | `userConfidenceRating` removed from `BehavioralContext` | Match | Removed 2026-07-31 |
| Only real sessions update FSRS | `review_type: 'real'` check in drillReviewService | Match | Cram/rapid_recall excluded |
| MVRT rapid-guess filter | `getMVRTThreshold()` per question type | Match | VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms |

**Status: Working** — Binary constraint properly enforced.

---

### 3.8 Post-Hoc Modifier Safety

| Spec (Research) | Implementation | Status | Evidence |
|--------------------------------------------|----------------|--------|----------|
| Total modifier product clamped [0.65, 1.50] | Not found | **Inconsistency** | See F-05 |
| No single modifier exceeds +/-30% | Individual services have own bounds | Partial | No aggregate guard |
| Monitor total modifier distribution weekly | Not implemented | **Inconsistency** | See F-07 |

**Status: Partial** — Individual modifiers bounded, no aggregate clamp.

---

## 4. Inconsistency Catalog

### P1 — High Severity

#### F-02: Missing FSRS Optimizer Pretrain Path `[P1:optimizer-cold-start]`
**Blast radius:** All users with 16-999 reviews receive zero parameter optimization.  
**Research spec:** Users with 16-100 reviews should enter a "pretrain" path optimizing only `w0-w3` (initial stability per rating).  
**Implementation:** `MIN_REVIEWS_FOR_OPTIMIZATION = 1000`. No pretrain path exists.  
**Fix:** Add a pretrain mode optimizing only `OPTIMIZABLE_INDICES = [0, 1, 2, 3]` when `reviews.length >= 16 && reviews.length < 1000`.  
**Reversible:** Yes.

#### F-03: Missing Modified Brier Score (MSEP) `[P1:calibration-sensitivity]`
**Blast radius:** Calibration dampener may oscillate due to noise in standard Brier at high base rates.  
**Research spec:** `MSEP = Brier - p(1-p)` isolates calibration error from irreducible variance.  
**Implementation:** `calibrationService.ts` computes standard Brier only.  
**Fix:** Add MSEP alongside standard Brier; use MSEP for dampener computation.  
**Reversible:** Yes.

#### F-05: Missing Aggregate Post-Hoc Modifier Safety Clamp `[P1:stability-safety]`
**Blast radius:** Compounding modifiers could push stability far outside the FSRS-optimized range.  
**Research spec:** Total modifier product clamped to [0.65, 1.50] as a hard safety rail.  
**Implementation:** Each modifier service clamps its own output, but NO aggregate clamp exists on the sequential product in `drillReviewService.ts`.  
**Fix:** After all Step 6/6a/6b/6c/7 modifiers multiply into `modifiedStability`, clamp the total product to [0.65, 1.50].  
**Reversible:** Yes.

---

### P2 — Medium Severity

#### F-01: Vestigial Confidence Delta Constants `[P2:dead-code]`
**Blast radius:** None (dead code).  
**Implementation:** Constants in `BEHAVIORAL_CONSTANTS.DELTAS.CONF_*` exist but `confidenceCategory` is always `'unknown'`, so `calculateConfidenceDelta()` always returns 0.0.  
**Fix:** Remove or document as reserved for future implicit confidence mapping.  
**Reversible:** Yes.

#### F-04: Missing Time-Weighting in Calibration `[P2:calibration-recency]`
**Blast radius:** Old reviews have equal weight to recent reviews in calibration.  
**Research spec:** `weight = exp(-age_days / 30)`.  
**Fix:** Add exponential decay time-weighting to Brier score computation.  
**Reversible:** Yes.

#### F-06: FSRS Parameter Value Discrepancy `[P2:parameter-values]`
**Blast radius:** Low — implementation uses ts-fsrs published defaults which are well-tested.  
**Analysis:** Different parameterizations of the same formula. The ts-fsrs library stores `w[20]` as the negative exponent directly (2.2700), while the research doc uses a different convention (0.1542). `computeDecayFactor()` bridges these.  
**Fix:** Document the convention difference. No code change needed.  
**Reversible:** Yes.

#### F-08: Missing Cold-Start Trust Ramp `[P2:cold-start]`
**Blast radius:** New users (<100 reviews) get full-strength modifiers which may be noisy.  
**Research spec:** Scale all non-FSRS modifiers by `min(1, total_reviews / 100)`.  
**Fix:** Add `pipelineTrustMultiplier` in `drillReviewService.ts`.  
**Reversible:** Yes.

#### F-09: Missing Pipeline Validation Script `[P2:validation]`
**Blast radius:** No automated way to measure pipeline effectiveness.  
**Research spec:** `scripts/validate-confidence-pipeline.ts` computing Brier scores, calibration curves, feature ablation.  
**Fix:** Create the validation script.  
**Reversible:** Yes.

---

### P3 — Low Severity

#### F-07: Missing Modifier Distribution Monitoring `[P3:observability]`
**Fix:** Add telemetry for `totalModifierProduct` and create a monitoring dashboard.

#### F-10: Stale Deprecated Enum Values `[P3:legacy-debt]`
No action needed. The deprecation pattern is correct. Remove when all legacy data is migrated.

#### F-11: FSRS v7-alpha Optimizer Parameters `[P3:future-readiness]`
No action needed until v7 stabilizes upstream.

#### F-12: Session Rolling Window Persistence `[P3:session-resilience]`
Verify `DrillSessionRecord` has rolling window fields and they are read/written on each review.

---

## 5. Working / Needs-Work Status Matrix

| Subsystem | Status | Notes |
|-----------|--------|-------|
| FSRS v6 Algorithm | Working | Core scheduling math matches spec |
| Implicit Metrics Extraction | Working | All 14 behavioral features implemented |
| Grade Modulation Coordinator | Working | Constants match spec; confidence deltas dead code |
| Confidence Pipeline (Steps 1-8) | Working | All 15 steps implemented with citations |
| Wave 1 Signals (1A-1D) | Working | All 4 server-only signals wired |
| Wave 2 Signals (2A-2B) | Working | Client telemetry enrichment signals wired |
| Wave 3 Signals (3A-3D) | Working | Post-answer engagement signals wired |
| Calibration (per-user Brier) | Partial | Missing MSEP and time-weighting |
| Calibration (per-system retrievability) | Working | Quantile binning + shrinkage implemented |
| FSRS Optimizer | Partial | Conservative (1000 min); missing pretrain path |
| Binary Rating Enforcement | Working | `normalizeRating()` + implicit-only pipeline |
| Ghost Grader | Working | Pre-pipeline behavioral override |
| Post-Hoc Modifier Safety | Partial | Individual bounds exist; no aggregate clamp |
| Ex-Gaussian RT Modeling | Working | Method-of-moments fitting + 4 classifications |
| MVRT Rapid-Guess Filter | Working | Per-question-type thresholds |
| Wilson Score Mastery | Working | Recency-weighted variant implemented |
| Pipeline Validation | Research-only | Validation script not yet built |
| FSRS v7-Alpha | Research-only | Documented placeholder; not production-active |
| Semantic Sibling Propagation (KARL) | Research-only | Tier 2 feature |
| Visual Mnemonics for Leech Cards | Research-only | Tier 3 feature |

---

## 6. Recommendations (Prioritized)

### Immediate (P1)
1. **F-05: Add aggregate modifier clamp** — Safety rail preventing compounding from pushing stability outside [0.65x, 1.50x].
2. **F-02: Add optimizer pretrain path** — Meaningful scheduling improvement for early users (16-999 reviews).
3. **F-03: Add MSEP to calibration** — More stable dampener near 90% recall target.

### Near-term (P2)
4. **F-08: Add cold-start trust ramp** — Scale modifiers by `min(1, totalReviews / 100)`.
5. **F-04: Add time-weighting to calibration** — Weight recent reviews more heavily.
6. **F-01: Clean up vestigial confidence constants** — Remove or document as reserved.
7. **F-09: Build pipeline validation script** — Offline measurement of pipeline effectiveness.

### Background (P3)
8. **F-07: Add modifier distribution monitoring**
9. **F-12: Verify session rolling window persistence**
10. **F-06: Document FSRS parameter convention**

---

## 7. Methodology

This audit was conducted by:
1. Reading all 10 research documents and 8 planning documents to extract intended specs
2. Using codegraph (AST-based symbol index) to trace actual implementations
3. Cross-referencing each spec against implementation code
4. Using grep to confirm pipeline steps, wave wiring, calibration minimums, and clamp presence
5. Classifying inconsistencies P0-P3 with blast-radius tags

**Limitations:** Full test suite not executed (timeout). Some details marked "needs verification." Scope limited to behavioral/FSRS/confidence pipeline.
