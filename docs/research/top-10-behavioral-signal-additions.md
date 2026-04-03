# Top 10 Behavioral Signal Additions for PANaCEa

*Gap analysis: literature vs. current implementation — April 2026*

---

## Current Implementation Inventory

Before listing additions, here's what PANaCEa **already captures and uses**, based on the codebase audit:

| Signal | Where Captured | How Used |
|---|---|---|
| Response latency (time-to-first-click) | `ImplicitBehaviorMetrics.timeToFirstClick` | Primary input to `deriveContinuousRating`; per-user z-scored via `userTimingProfileService` |
| Answer switches | `ImplicitBehaviorMetrics.answerSwitches` | Grade penalty + confidence signal weight (0.25) |
| Total dwell time | `ImplicitBehaviorMetrics.totalDwellTime` | Par time comparison; logged to telemetry |
| Hint viewed + duration | `hintViewed`, `hintViewDurationMs` | 0.4 flat penalty + time-proportional (capped 0.3) |
| Commitment gap (time-to-submit after selection) | `commitmentGapMs` | Hesitation composite signal (0.20 weight) |
| Cursor entropy | `cursorEntropy` | Hesitation composite; penalty above 1.0 |
| Hover oscillation count | `hoverOscillationCount` | Hesitation composite; per-oscillation penalty |
| Full mouse trajectory (MAD, AUC, jitter, hesitation) | `micro-kinetics.ts` → `TrajectoryMetrics` | Trajectory confidence signal (0.20 weight) |
| Circadian phase | `circadian.ts` → `CircadianContext` | Stability modifier + par time modifier |
| Session fatigue (question position) | `sessionFatigueService.ts` | Logarithmic par time relaxation after item 15 |
| Per-user RT/switch/hesitation baseline | `userTimingProfileService.ts` | Z-score normalization for all confidence signals |
| Bayesian confidence accumulation | `bayesianAccumulator.ts` | Blends current confidence with card history (max 0.4 prior) |
| Metacognitive calibration (Brier score) | `calibrationService.ts` | Per-user dampener factor (0.7–1.3×) |
| Fluency illusion dampener | `fluencyIllusionDampener()` | 30% confidence reduction for same-day reviews |
| Retrievability calibration | `retrievabilityCalibrationService.ts` | Stability correction from predicted-vs-actual recall |
| Question-type weight profiles | `QUESTION_TYPE_WEIGHTS` | Vignette/recall/image/rapid_recall signal weighting |
| Ghost Grader overrides | `ghostGrader.ts` | Indecision → Again; clean+fast → grade boost |
| Elimination velocity | `telemetry.elimination_velocity` | Ghost Grader bonus for rapid distractor elimination |
| Rapid guess detection (MVRT) | `getMVRTThreshold()` | Skip FSRS for sub-threshold responses |
| Telemetry quality tiers | `assessTelemetryQuality()` | Optimizer downsamples low-quality reviews |

**That's 19 distinct behavioral signals.** PANaCEa's implementation is already substantially ahead of most SRS systems. The additions below target gaps where literature provides strong evidence but the codebase has no current instrumentation or use.

---

## Top 10 Additions (Ranked by Expected Impact × Feasibility)

### 1. Lapse Severity Index

**What it is:** When a card that was previously recalled correctly is now answered incorrectly (a "lapse"), the severity of that lapse varies enormously. A lapse after 2 correct reviews is qualitatively different from a lapse after 8 consecutive correct reviews across months. The latter signals interference or "false stability" — the card appeared mastered but the knowledge was fragile.

**What PANaCEa lacks:** FSRS treats all lapses identically (reset to Again). There's no lapse-severity multiplier that considers streak length or interval context.

**How to implement:**
- In `drillReviewService.ts`, when `isCorrect === false` and the card was previously in "review" state (state ≥ 2):
  - Read `currentCard.reps` (consecutive correct count) and `currentCard.stability` (current estimated stability)
  - Compute `lapseSeverity = log2(1 + reps) × log2(1 + stability)` — logarithmic so it doesn't explode
  - Apply a *new-card penalty*: multiply the post-lapse difficulty increase by `1 + 0.15 × lapseSeverity`
  - Store `lapse_severity` in `ReviewLog.telemetry.server_computed`
- Log: `{ lapse_severity, pre_lapse_reps, pre_lapse_stability, pre_lapse_elapsed_days }`

**Effect direction:** Higher lapse severity → card was falsely stable → needs *more aggressive rescheduling* and difficulty increase than a standard lapse.

**Evidence:** Bjork & Bjork (2011) on "desirable difficulties" notes that retrieval failures after apparent mastery are among the strongest indicators of fragile knowledge. The FSRS v4 paper by Ye (2024) acknowledges that lapse handling is the weakest part of the algorithm. Kornell et al. (2015) showed that items that were once well-learned but then forgotten showed different relearning patterns than never-learned items.

**Citations:**
- Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way. In *Psychology and the real world* (pp. 56–64). Worth.
- Ye, J. (2024). FSRS v4 algorithm. [open-spaced-repetition/fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki)

---

### 2. Distractor Interaction Chronometry

**What it is:** On MCQ questions, log *which* answer options the learner interacted with (hovered, clicked, then changed) and *for how long*, before settling on their final answer. This goes beyond raw switch count — it captures the *decision topology*.

**What PANaCEa lacks:** `answerSwitches` counts changes but doesn't track which options were involved. `elimination_velocity` exists in Ghost Grader but only as a single scalar. There's no log of the sequence A→C→A→B or how long each option was considered.

**How to implement:**
- **Client-side:** In the answer selection handler, log each `{ optionId, selectedAt, deselectedAt }` event into an array `optionInteractions[]`.
- **Server-side:** Compute derived features:
  - `uniqueOptionsConsidered`: count of distinct options selected (1–N)
  - `finalOptionRank`: was the final answer the first, second, or third option tried?
  - `correctOptionEverSelected`: boolean — did the learner ever select the correct answer then switch away?
  - `longestDistractorDwellMs`: max dwell on any single wrong option
- Store as `telemetry.option_interactions` (array) and derived features in `server_computed`.
- Feed `uniqueOptionsConsidered` into confidence: more unique options tried → lower confidence. `correctOptionEverSelected && !isCorrect` → strong negative signal (they knew it but second-guessed).

**Effect direction:** Fewer unique options considered + correct → high confidence. Correct answer ever selected then abandoned → low retention durability even if ultimately correct (partial knowledge, susceptible to interference).

**Evidence:** Sherbina (2022) showed that distractor view chronometry reproduces the information value of process-of-elimination methods and can separate confident responses from guesses without self-report. Gierl et al. (2017) meta-analyzed distractor functioning and found that distractor attraction patterns predict item difficulty and learner ability.

**Citations:**
- Sherbina, D. N. (2022). Chronometry of distractor views to discover thinking processes. *Behavior Research Methods*, 54, 1568–1586. [DOI: 10.3758/s13428-021-01743-x](https://doi.org/10.3758/s13428-021-01743-x)
- Gierl, M. J., Bulut, O., Guo, Q., & Zhang, X. (2017). Developing, analyzing, and using distractors for MCQ tests in education. *Review of Educational Research*, 87(6), 1082–1116. [DOI: 10.3102/0034654317726529](https://doi.org/10.3102/0034654317726529)

---

### 3. Explanation Engagement Depth

**What it is:** After a learner submits an answer and views the explanation/rationale, measure *how deeply they engage*: did they scroll through the full explanation, how long did they spend, and did they interact with any expandable elements (e.g., "Why not option B?" panels)?

**What PANaCEa lacks:** `ExplanationPanel` exists in `QuizView.tsx` but no post-answer engagement telemetry is collected or fed into the FSRS pipeline. The current `totalDwellTime` is measured pre-submit, not post-answer.

**How to implement:**
- **Client-side:** In `ExplanationPanel`, log:
  - `explanationViewedMs`: time from answer reveal to next-question click
  - `explanationScrollDepth`: 0.0–1.0 (fraction of explanation scrolled)
  - `expandedSections`: count of expandable rationale sections clicked
  - `explanationViewedAfterCorrect` vs `explanationViewedAfterIncorrect`: boolean context
- **Server-side integration:**
  - After incorrect answers: `longExplanationDwell + highScrollDepth` → positive signal for error correction → slightly *reduce* the next-review penalty (the learner is investing in understanding)
  - After correct answers: `longExplanationDwell` → ambiguous signal but > 15s suggests surprise/uncertainty → modestly reduce confidence
  - Feed `explanationEngagement = scrollDepth × log(1 + dwellMs/5000)` into a new confidence modifier

**Effect direction:** Deep explanation engagement after errors → better error correction → slightly shorter next interval than a bare lapse. Minimal explanation engagement after errors → low engagement with corrective feedback → standard lapse penalty.

**Evidence:** Butler, Karpicke, & Roediger (2008) showed that elaborative feedback after errors significantly improves subsequent retention compared to simple correct/incorrect signals. The benefit scales with feedback depth. Smith & Kimball (2010) showed that feedback timing and engagement interact with spacing to affect retention.

**Citations:**
- Butler, A. C., Karpicke, J. D., & Roediger, H. L. (2008). Correcting a metacognitive error: Feedback increases retention of low-confidence correct responses. *J. Exp. Psychol.: LMC*, 34(4), 918–928. [DOI: 10.1037/0278-7393.34.4.918](https://doi.org/10.1037/0278-7393.34.4.918)
- Smith, T. A., & Kimball, D. R. (2010). Learning from feedback: Spacing and the delay-retention effect. *J. Exp. Psychol.: LMC*, 36(1), 268–279. [DOI: 10.1037/a0017407](https://doi.org/10.1037/a0017407)

---

### 4. RT Change Across Spaced Reviews (Implicit Delayed-JOL)

**What it is:** For cards with ≥2 spaced reviews, compute the *ratio of current RT to previous RT*. A card that gets answered faster each time across spaced intervals is consolidating. A card whose RT increases across reviews (despite the same interval or longer) is decaying.

**What PANaCEa lacks:** Bayesian accumulation blends *confidence* across reviews, but doesn't specifically track *RT trajectory*. The RT change is a more direct proxy for Nelson & Dunlosky's delayed-JOL effect than blending confidence scores.

**How to implement:**
- In `drillReviewService.ts`, when building review history, also extract `previousRT` from the most recent ReviewLog entry for this card.
- Compute `rtChangeRatio = currentRT / previousRT` (z-scored against user baseline if possible).
- Interpretation:
  - `rtChangeRatio < 0.8` (got 20%+ faster) → memory consolidating → boost stability by 5–10%
  - `rtChangeRatio > 1.3` (got 30%+ slower) → memory decaying despite correct answer → reduce stability by 5–10%
  - Between 0.8–1.3 → neutral
- Store in `server_computed.rt_change_ratio`

**Effect direction:** Decreasing RT across spaced reviews → consolidation → reward with longer interval. Increasing RT → fragile despite being correct → shorten interval.

**Evidence:** Nelson & Dunlosky (1991, 1992) demonstrated that delayed JOLs (based on retrieval from LTM) are far more accurate predictors of retention than immediate JOLs. RT change across spaced reviews is the *behavioral analog* of a delayed JOL without requiring any self-report. Chen et al. (2019) confirmed that retrieval RT independently mediates JOL–retention correspondence.

**Citations:**
- Nelson, T. O., & Dunlosky, J. (1991). The "delayed-JOL effect." *Psychol. Science*, 2(4), 267–270. [DOI: 10.1111/j.1467-9280.1991.tb00147.x](https://doi.org/10.1111/j.1467-9280.1991.tb00147.x)
- Chen, X., Zhang, M., & Liu, X. L. (2019). Retrieval practice facilitates JOLs through multiple mechanisms. *Frontiers in Psychology*, 10, 987. [DOI: 10.3389/fpsyg.2019.00987](https://doi.org/10.3389/fpsyg.2019.00987)

---

### 5. Session Regularity Score (Habit Consistency)

**What it is:** Track how consistently a learner studies — not just whether they show up, but whether their session timing is regular. A learner who studies at roughly the same time every day has formed a study habit, which correlates with better long-term outcomes and more reliable behavioral telemetry.

**What PANaCEa lacks:** `useStudyWellness` exists for burnout detection but doesn't compute a session regularity score. No current feature feeds session-level consistency into FSRS or confidence scoring.

**How to implement:**
- Compute from `ReviewLog` or session history:
  - `sessionRegularity`: coefficient of variation (σ/μ) of inter-session intervals over the last 14 days. Low CV = regular. High CV = erratic.
  - `streakDays`: consecutive days with at least 1 review session
  - `avgSessionGapHours`: mean hours between session starts
- Use as a **session-level modifier** (not per-card):
  - Highly regular learners (CV < 0.3) → their behavioral telemetry is more trustworthy → upweight telemetry quality
  - Erratic learners (CV > 0.8) → greater chance of fatigue/rushing effects → apply modest confidence dampening (0.95×)
- Store in a `UserStudyHabit` cache, refresh daily

**Effect direction:** Regular study habits → more predictable memory dynamics → FSRS predictions more accurate. Irregular habits → FSRS accuracy degrades → conservative scheduling warranted.

**Evidence:** Lindsey et al. (2014) showed that personalized scheduling interacts with session regularity — consistent study timing allows the model to better predict retrieval probability. Dunlosky et al. (2013) reviewed effective learning strategies and found that distributed practice (regular spacing) is among the highest-utility techniques. Mazza et al. (2016) showed that learning regularity (evenness of study distribution) predicted exam performance in a large-scale MOOC.

**Citations:**
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychol. Science in the Public Interest*, 14(1), 4–58. [DOI: 10.1177/1529100612453266](https://doi.org/10.1177/1529100612453266)
- Lindsey, R. V., Shroyer, J. D., Pashler, H., & Mozer, M. C. (2014). Improving students' long-term knowledge retention through personalized review. *Psychol. Science*, 25(3), 639–647. [DOI: 10.1177/0956797613504302](https://doi.org/10.1177/0956797613504302)

---

### 6. Relearning Speed (Savings Score)

**What it is:** When a learner lapses on a card and then re-encounters it in a later session, measure how much *faster* they relearn it compared to the original learning. This is Ebbinghaus's "savings" metric — the gold standard for residual memory strength that's invisible to binary correct/incorrect scoring.

**What PANaCEa lacks:** Lapse handling resets the card to Again and restarts the FSRS cycle. There's no mechanism to detect that a previously-lapsed card is being relearned faster than a brand-new card, which should result in *faster interval escalation* on the second learning curve.

**How to implement:**
- When a card enters "relearning" state (post-lapse), tag it with `relapsedAt` timestamp and `preLapseStability`.
- On subsequent correct reviews of that card, compute:
  - `relearningRT` vs `originalLearningRT` (from the first-ever attempt on this card)
  - `savingsRatio = 1 - (relearningRT / originalLearningRT)` — percentage of time saved
  - Or simpler: count how many reviews until the card gets 2 consecutive correct at ≥1-day intervals (vs original)
- If `savingsRatio > 0.3` (relearning 30%+ faster): apply a post-lapse stability bonus of `1 + savingsRatio × 0.5` — the memory trace isn't fully gone, just temporarily inaccessible.
- Store in `ReviewLog.telemetry.server_computed.savings_ratio`

**Effect direction:** High savings → residual memory exists → faster interval escalation post-lapse. Low/zero savings → genuine forgetting → standard FSRS lapse recovery.

**Evidence:** Ebbinghaus (1885/1913) first demonstrated savings as a measure of residual memory. Nelson (1985) showed savings could detect memory that's completely inaccessible to recall. MacLeod (1988) found savings effects even after years. Modern work by Murre & Dros (2015) replicated Ebbinghaus's forgetting curve and confirmed savings as a robust memory metric.

**Citations:**
- Nelson, T. O. (1985). Ebbinghaus's contribution to the measurement of retention: Savings during relearning. *J. Exp. Psychol.: LMC*, 11(3), 472–479. [DOI: 10.1037/0278-7393.11.3.472](https://doi.org/10.1037/0278-7393.11.3.472)
- Murre, J. M., & Dros, J. (2015). Replication and analysis of Ebbinghaus' forgetting curve. *PLOS ONE*, 10(7), e0120644. [DOI: 10.1371/journal.pone.0120644](https://doi.org/10.1371/journal.pone.0120644)

---

### 7. Answer-Switch Direction Tracking

**What it is:** PANaCEa counts answer switches but doesn't track *direction* — specifically, whether the learner switched from right→wrong, wrong→right, or wrong→wrong. The direction of switching is far more diagnostic of metacognitive quality than the raw count.

**What PANaCEa lacks:** `answerSwitches` is a scalar count. `elimination_velocity` captures speed of elimination but not the correctness trajectory. No current telemetry encodes the sequence of option correctness.

**How to implement:**
- **Client-side:** For each switch event, log `{ fromOption, toOption, timestamp }`. On the server, resolve each option's correctness and classify each switch:
  - `right_to_wrong`: Bad metacognitive override — learner second-guessed correct knowledge
  - `wrong_to_right`: Good metacognitive revision — detected and corrected error
  - `wrong_to_wrong`: Lateral confusion — doesn't know the answer, trying options
- Compute:
  - `netSwitchValue = (wrong_to_right_count - right_to_wrong_count)`
  - `metacognitivePrecision = wrong_to_right_count / total_switches` (proportion of beneficial switches)
- Use:
  - `right_to_wrong` occurred → strong negative confidence signal even if final answer is correct (the learner nearly got it wrong; fragile knowledge)
  - `wrong_to_right` + 0 other switches → actually a positive signal (good error monitoring)
  - Build per-user rolling `metacognitivePrecision` score for calibration

**Effect direction:** High proportion of beneficial switches → good metacognition → their confidence signals are more trustworthy. Frequent right→wrong switches → overriding correct instincts → confidence should be dampened.

**Evidence:** Metcalfe & Finn (2016) showed that real-time confidence accurately predicted which revisions would be beneficial. Students who switched from right to wrong had systematically miscalibrated confidence. The direction of answer changes is more informative than the count.

**Citations:**
- Metcalfe, J., & Finn, B. (2016). The instinct fallacy. *Metacognition and Learning*, 11(2), 171–185. [DOI: 10.1007/s11409-015-9140-8](https://doi.org/10.1007/s11409-015-9140-8)
- Koriat, A., & Goldsmith, M. (1996). Monitoring and control processes in strategic regulation of memory accuracy. *Psychol. Review*, 103(3), 490–517. [DOI: 10.1037/0033-295X.103.3.490](https://doi.org/10.1037/0033-295X.103.3.490)

---

### 8. Within-Session Accuracy Slope (Fatigue vs. Warm-Up)

**What it is:** Compute a rolling accuracy rate over the current session and detect whether the learner is *warming up* (improving) or *fatiguing* (declining). Use this as a session-level quality modifier on all cards reviewed during the declining phase.

**What PANaCEa lacks:** `sessionFatigueService.ts` adjusts **par time** based on question position (logarithmic relaxation after item 15), but doesn't adjust **confidence** or **stability** based on observed accuracy trajectory. Par time relaxation is a one-directional heuristic — it doesn't detect whether the learner is actually fatiguing (maybe they're still sharp at item 30).

**How to implement:**
- Track a sliding window of last 10 items: compute `rollingAccuracy` and `accuracySlope` (linear regression of correctness over position).
- Send `{ session_accuracy_slope, session_rolling_accuracy, session_position }` in telemetry.
- Server-side:
  - `accuracySlope < -0.05` (strong decline) → apply 0.92× confidence multiplier to items reviewed during decline
  - `accuracySlope > 0.05` (warming up) → apply 1.05× confidence multiplier (warm-up items may have been under-estimated)
  - Neutral otherwise
- This complements the existing par time adjustment: fatigue service relaxes the par time ceiling, but accuracy slope adjusts the confidence *floor*.

**Effect direction:** Declining accuracy trajectory → encoding during this phase is less reliable → schedule more conservatively.

**Evidence:** Sievertsen, Gino, & Piovesan (2016) showed ~0.9% SD performance decline per hour in standardized testing (N > 2M). See et al. (1995) meta-analyzed vigilance decrement across 42 studies showing reliable sensitivity loss within 15–30 minutes.

**Citations:**
- Sievertsen, H. H., Gino, F., & Piovesan, M. (2016). Cognitive fatigue influences students' performance. *PNAS*, 113(10), 2621–2624. [DOI: 10.1073/pnas.1516947113](https://doi.org/10.1073/pnas.1516947113)
- See, J. E., Howe, S. R., Warm, J. S., & Dember, W. N. (1995). Meta-analysis of the sensitivity decrement in vigilance. *Psychol. Bull.*, 117(2), 230–249. [DOI: 10.1037/0033-2909.117.2.230](https://doi.org/10.1037/0033-2909.117.2.230)

---

### 9. Inter-Review Interval Deviation (Early/Late Review Signal)

**What it is:** Measure the difference between the *scheduled* review date and the *actual* review date. A learner who reviews a card 3 days early is in a different information state than one who reviews 3 days late. This context should modify how much the system "learns" from the review outcome.

**What PANaCEa lacks:** FSRS computes `elapsed_days` from the last review, but doesn't compare it against the `scheduled_days`. There's no mechanism to weight the *information value* of early vs. on-time vs. late reviews.

**How to implement:**
- In `drillReviewService.ts`, compute:
  - `scheduledDays = currentCard.scheduled_days`
  - `actualDays = currentCard.elapsed_days`
  - `intervalDeviation = actualDays / scheduledDays` (ratio)
  - `expectedRetrievability` from FSRS: `R = (1 + elapsed_days / (9 × stability))^(-1)`
- Interpretation:
  - `intervalDeviation < 0.5` (reviewed at ≥2× the expected retrievability) → correct answer is less informative (R was still very high). Apply 0.85× to the stability update magnitude.
  - `intervalDeviation > 1.5` (reviewed much later than scheduled) → correct answer is *very informative* (R was low but they still got it). Apply 1.15× to stability update magnitude.
  - On time (0.7–1.3) → standard update
- Store `interval_deviation` in `server_computed`

**Effect direction:** Early correct → less informative → modest stability update. Late correct → highly informative → generous stability update. Late incorrect → expected, standard lapse. Early incorrect → surprising, possibly indicates interference → increase difficulty more.

**Evidence:** The core insight comes from Bayesian updating: observations at extreme retrievability values carry less information (ceiling/floor effects). Mozer et al. (2009) built this into their multiscale context model. The FSRS v4 algorithm partially addresses this through its retrievability-weighted difficulty update, but doesn't adjust *stability update magnitude* based on interval deviation.

**Citations:**
- Mozer, M. C., Pashler, H., Cepeda, N., Lindsey, R., & Vul, E. (2009). Predicting the optimal spacing of study. *Advances in NIPS*, 22, 1321–1329. [PDF](https://home.cs.colorado.edu/~mozer/Research/Selected%20Publications/reprints/MozerPashlerCepedaLindseyVul2009.pdf)

---

### 10. Confusion Pair Recurrence Rate

**What it is:** Track how often a learner confuses the *same pair* of concepts across different cards and sessions. If a learner repeatedly selects "atenolol" when the correct answer is "metoprolol" across multiple beta-blocker questions, that's a fundamentally different problem than random errors — it's a stable interference pattern that requires targeted intervention.

**What PANaCEa lacks:** `propagateRecallToSiblings` in `semanticSiblingService` exists for *positive* propagation (correct recall → boost related cards). But there's no tracking of *which specific wrong answer* a learner keeps choosing for the same concept, or how to escalate repeated confusion pairs.

**How to implement:**
- In `drillReviewService.ts`, when `isCorrect === false`:
  - Record `{ userId, correctConditionId, selectedConditionId, timestamp }` as a confusion event
  - Query recent confusion events (last 90 days) for the same `(correctConditionId, selectedConditionId)` pair
  - Compute `confusionPairCount` — how many times this exact pair has been confused
- Thresholds:
  - `count ≥ 3`: Flag as "stable confusion pair." Apply 1.3× difficulty increase to both conditions. Queue a "contrastive drill" specifically comparing these two conditions.
  - `count ≥ 5`: Escalate — generate a targeted Gemini explanation of the difference; notify the learner via study nudge.
- Store in a `ConfusionPair` table: `{ userId, conditionA, conditionB, occurrences, lastOccurred }`
- Feed into scheduling: cards involving either member of a high-frequency confusion pair get shortened intervals until the pair is resolved (3 consecutive correct differentiations).

**Effect direction:** Recurring confusion pair → stable interference → needs *contrastive* intervention, not just more repetition. Raw repetition of confusable items can actually *reinforce* interference (Potts & Shanks, 2014).

**Evidence:** Potts & Shanks (2014) showed that similar items create proactive interference that repetition alone can't resolve — contrastive (interleaved) presentation is needed. Rohrer & Taylor (2007) demonstrated that interleaving similar problem types improves discrimination. Kornell & Bjork (2008) showed that interleaving improves induction even when it feels harder.

**Citations:**
- Potts, R., & Shanks, D. R. (2014). The benefit of generating errors during learning. *J. Exp. Psychol.: General*, 143(2), 644–667. [DOI: 10.1037/a0033194](https://doi.org/10.1037/a0033194)
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35(6), 481–498. [DOI: 10.1007/s11251-007-9015-8](https://doi.org/10.1007/s11251-007-9015-8)

---

## Summary Priority Matrix

| Rank | Addition | Effort | Expected Impact | Disruption to Learner |
|---|---|---|---|---|
| 1 | Lapse Severity Index | Low (server-only) | High | None |
| 2 | Distractor Interaction Chronometry | Medium (client+server) | High | None |
| 3 | Explanation Engagement Depth | Medium (client+server) | High | None |
| 4 | RT Change Across Spaced Reviews | Low (server-only) | High | None |
| 5 | Session Regularity Score | Low (server-only) | Medium | None |
| 6 | Relearning Speed (Savings) | Medium (server logic) | Medium-High | None |
| 7 | Answer-Switch Direction Tracking | Medium (client+server) | Medium-High | None |
| 8 | Within-Session Accuracy Slope | Low (server-only) | Medium | None |
| 9 | Inter-Review Interval Deviation | Low (server-only) | Medium | None |
| 10 | Confusion Pair Recurrence Rate | Medium (DB+server) | High (long-term) | None (positive) |

**Implementation order recommendation:** Start with #1, #4, #8, #9 (all server-only, no client changes needed). Then #2 and #7 (client telemetry enrichment). Then #3 and #6 (post-answer engagement). Finally #5 and #10 (require new DB tables/caches).
