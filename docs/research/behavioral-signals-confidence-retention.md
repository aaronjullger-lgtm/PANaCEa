# Behavioral Signals Correlated with Learner Confidence and Long-Term Retention

*Research synthesis for PANaCEa FSRS integration — April 2026*

---

## 1. Overview

A substantial body of peer-reviewed work in cognitive psychology, metacognition, and educational technology demonstrates that **observable behavioral patterns during retrieval practice reliably predict both a learner's subjective confidence and the durability of the underlying memory trace**. Two foundational findings anchor this literature. First, Koriat's accessibility model (1993, 1997) established that metacognitive judgments — feelings of knowing, confidence ratings, judgments of learning — are largely driven by the *speed and ease* with which information comes to mind (retrieval fluency). Faster, more effortless retrieval leads to higher confidence, and in most circumstances this heuristic is valid: quick correct responses genuinely do predict stronger long-term retention. However, Benjamin, Bjork, and Schwartz (1998) showed that retrieval fluency can *mislead*: items retrieved quickly on an initial test are sometimes the most vulnerable to forgetting, because the fluency stems from recency or short-term priming rather than durable encoding. This duality — fluency as a usually-valid but sometimes-deceptive cue — means that a spaced-repetition system should not rely on any single behavioral signal but should triangulate across multiple streams.

Beyond response latency, the literature identifies at least a dozen additional behavioral features that an app can passively collect and that carry empirical signal about confidence or retention: answer-switching behavior, hint and help-seeking patterns, cursor or pointer kinematics, session-level fatigue markers, inter-review spacing and lapse history, circadian timing, time spent reviewing explanations, and prior exposure counts. Many of these have been validated in large-scale digital learning analytics studies (e.g., Lindsey et al., 2014; Settles & Meeder, 2016) as well as controlled laboratory experiments. The table below catalogues 14 such features, each grounded in at least one empirical study, with operationalization guidance for a web-based study app like PANaCEa.

---

## 2. Behavioral Features Table

### Feature 1: Response Latency (time-to-first-click)

| Aspect | Detail |
|---|---|
| **How to measure/log** | Record `timestamp_question_displayed` and `timestamp_first_answer_selected`. Compute `RT = first_click - display` in ms. Normalize per question type (vignette vs. recall vs. image) because baseline reading times differ. |
| **Confidence/retention signal** | Indexes retrieval fluency — the ease with which the answer is accessed from long-term memory. Faster RT generally reflects stronger memory traces and higher subjective confidence. |
| **Effect direction** | **Shorter RT → higher confidence and (usually) better retention.** Koriat (2010) showed confidence is inversely related to choice latency in both adults and children. Chen, Zhang, & Liu (2019) confirmed that RT independently mediated JOL–retention correspondence in retrieval practice, though the effect was modest (~2% of total). |
| **Cautions/confounds** | Very fast RT may indicate *guessing* rather than confident retrieval (need MVRT floor). Benjamin et al. (1998) showed that fast retrieval can be misleading when it reflects recency priming rather than durable encoding. Device/input method (touch vs. mouse) affects absolute latencies. Test anxiety speeds some learners (impulsive responding) and slows others. |
| **Key citations** | 1. Koriat, A. (2010). Choice latency as a cue for children's subjective confidence. *Developmental Science*, 14(3), 441–453. [DOI: 10.1111/j.1467-7687.2009.00907.x](https://doi.org/10.1111/j.1467-7687.2009.00907.x) |
| | 2. Benjamin, A. S., Bjork, R. A., & Schwartz, B. L. (1998). The mismeasure of memory: When retrieval fluency is misleading. *J. Exp. Psychol.: General*, 127(1), 55–68. [DOI: 10.1037/0096-3445.127.1.55](https://doi.org/10.1037/0096-3445.127.1.55) |
| | 3. Chen, X., Zhang, M., & Liu, X. L. (2019). Retrieval practice facilitates JOLs through multiple mechanisms. *Frontiers in Psychology*, 10, 987. [DOI: 10.3389/fpsyg.2019.00987](https://doi.org/10.3389/fpsyg.2019.00987) |

---

### Feature 2: Answer Switching Count

| Aspect | Detail |
|---|---|
| **How to measure/log** | Track every `option_selected` event. Count the number of times the selected answer changes before final submission. Log both the count and the sequence (e.g., A→B→A). |
| **Confidence/retention signal** | Indexes decision conflict and metacognitive uncertainty. More switches indicate the learner is torn between competing retrievals — a sign of partial knowledge or interference between similar concepts. |
| **Effect direction** | **More switches → lower confidence, weaker/less stable memory.** Metcalfe & Finn (2016) found that real-time confidence accurately predicted when switching would improve vs. hurt performance. Low-confidence items that were revised tended to improve; high-confidence items were better left alone. Frequent switching without resolution suggests the learner lacks a dominant memory trace. |
| **Cautions/confounds** | A single deliberate change (wrong → right) is often beneficial and reflects good metacognition, so raw switch count alone is insufficient — *direction* matters (wrong→right vs. right→wrong). Some learners are dispositionally more cautious/revisory. |
| **Key citations** | 1. Metcalfe, J., & Finn, B. (2016). The instinct fallacy: The metacognition of answering and revising during college exams. *Metacognition and Learning*, 11(2), 171–185. [DOI: 10.1007/s11409-015-9140-8](https://doi.org/10.1007/s11409-015-9140-8) |
| | 2. Koriat, A., & Goldsmith, M. (1996). Monitoring and control processes in the strategic regulation of memory accuracy. *Psychol. Review*, 103(3), 490–517. [DOI: 10.1037/0033-295X.103.3.490](https://doi.org/10.1037/0033-295X.103.3.490) |

---

### Feature 3: Hint/Help-Seeking Before Answering

| Aspect | Detail |
|---|---|
| **How to measure/log** | Log `hint_viewed: boolean`, `hint_view_timestamp`, `hint_view_duration_ms`, and whether the hint was viewed *before* or *after* the first answer selection. |
| **Confidence/retention signal** | Viewing a hint before committing an answer signals that free recall has failed and the learner requires external scaffolding. This is "aided recall" and produces weaker memory encoding than unassisted retrieval. |
| **Effect direction** | **Hint use before answering → lower effective retrieval strength, lower subsequent retention.** Aleven et al. (2003) showed that students who used help appropriately (when truly stuck) learned more, but frequent/premature hint use ("help abuse") predicted poor learning gains. Hint systems can negatively impact learning when over-relied upon (Hicks et al., 2014). |
| **Cautions/confounds** | Appropriate help-seeking is a healthy metacognitive strategy — penalizing all hint use indiscriminately would be wrong. The signal is strongest for *premature* hint use (before any genuine retrieval attempt). Cultural/personality differences in help-seeking tendencies exist. |
| **Key citations** | 1. Aleven, V., Stahl, E., Schworm, S., Fischer, F., & Wallace, R. (2003). Help seeking and help design in interactive learning environments. *Review of Educational Research*, 73(3), 277–320. [DOI: 10.3102/00346543073003277](https://doi.org/10.3102/00346543073003277) |
| | 2. Hicks, A., Peddycord, B., & Barnes, T. (2014). Hint systems may negatively impact performance in educational games. *Proc. ACM Learning @ Scale*, 71–72. [DOI: 10.1145/2556325.2566248](https://doi.org/10.1145/2556325.2566248) |

---

### Feature 4: Time-to-Commit (Dwell Time After First Selection)

| Aspect | Detail |
|---|---|
| **How to measure/log** | Record `timestamp_first_selection` and `timestamp_submit`. Compute `commit_gap = submit - first_selection` in ms. A long gap suggests the learner is second-guessing; a very short gap suggests high confidence or impulsivity. |
| **Confidence/retention signal** | Indexes post-decisional metacognitive monitoring. A long deliberation after initial selection reflects uncertainty about the chosen answer — the learner is re-evaluating. |
| **Effect direction** | **Longer commit gap → lower confidence.** Ratcliff & McKoon (2008) established in the diffusion decision model that decision time reflects the quality of evidence accumulation — weaker evidence (lower drift rate) produces longer decision times. Koriat & Goldsmith (1996) showed that people use a "confidence criterion" to decide whether to volunteer an answer, and monitoring time increases with uncertainty. |
| **Cautions/confounds** | Could reflect thoroughness rather than uncertainty (some learners habitually double-check). Long dwell could also mean the learner is reading the explanation or rationale if it's shown pre-submit. Need to distinguish review-dwell from hesitation-dwell. |
| **Key citations** | 1. Ratcliff, R., & McKoon, G. (2008). The diffusion decision model: Theory and data for two-choice decision tasks. *Neural Computation*, 20(4), 873–922. [DOI: 10.1162/neco.2008.12-06-420](https://doi.org/10.1162/neco.2008.12-06-420) |
| | 2. Koriat, A., & Goldsmith, M. (1996). Monitoring and control processes in the strategic regulation of memory accuracy. *Psychol. Review*, 103(3), 490–517. [DOI: 10.1037/0033-295X.103.3.490](https://doi.org/10.1037/0033-295X.103.3.490) |

---

### Feature 5: Retrieval Success History (Consecutive Correct Streak)

| Aspect | Detail |
|---|---|
| **How to measure/log** | For each card, track `consecutive_correct_count` — the number of times it has been correctly recalled in a row across review sessions. Also log `total_attempts` and `lapse_count` (times it went from "correct" to "incorrect"). |
| **Confidence/retention signal** | Successive correct retrievals at increasing intervals are the gold standard for memory durability. Each successful retrieval strengthens the memory trace (testing effect). Lapses after a streak indicate fragile knowledge. |
| **Effect direction** | **Longer streak at increasing intervals → more durable retention.** Roediger & Karpicke (2006) demonstrated that repeated testing improves long-term retention far more than repeated study. Kang et al. (2014) showed that the benefit of retrieval practice persists over weeks. A lapse after multiple correct retrievals is a strong negative signal (interference, not just decay). |
| **Cautions/confounds** | Streak length must be interpreted alongside *interval length* — five correct answers in five minutes means less than five correct answers across five weeks. Massed correct responses inflate apparent mastery (Kornell & Bjork's fluency illusion). |
| **Key citations** | 1. Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychol. Science*, 17(3), 249–255. [DOI: 10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x) |
| | 2. Kang, S. H. K., Lindsey, R. V., Mozer, M. C., & Pashler, H. (2014). Retrieval practice over the long term. *Psychonomic Bull. & Review*, 21(4), 1090–1098. [DOI: 10.3758/s13423-014-0600-x](https://doi.org/10.3758/s13423-014-0600-x) |

---

### Feature 6: Elapsed Days Since Last Review (Inter-Review Interval)

| Aspect | Detail |
|---|---|
| **How to measure/log** | Compute `days_since_last_review` from the stored `last_review_timestamp` for each card. Also log `scheduled_interval` vs. `actual_interval` to detect early or late reviews. |
| **Confidence/retention signal** | The core variable in all spacing algorithms. Successfully recalling after a *longer* interval provides much stronger evidence of durable memory than recalling after a short gap. This is the foundation of FSRS's stability parameter. |
| **Effect direction** | **Correct recall at longer intervals → higher estimated stability.** Cepeda et al. (2006) meta-analyzed 317 experiments and found a robust spacing effect, with optimal inter-study intervals scaling with the desired retention interval. Mozer et al. (2009) built a multiscale context model showing spacing can double retention at educationally relevant time scales. |
| **Cautions/confounds** | If a learner reviews *early* (before the scheduled date), a correct answer is less informative because retrievability was still high. Late reviews that succeed are highly informative but create selection bias (the learner chose to review, possibly because they felt uncertain). |
| **Key citations** | 1. Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks. *Psychol. Bull.*, 132(3), 354–380. [DOI: 10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354) |
| | 2. Mozer, M. C., Pashler, H., Cepeda, N., Lindsey, R., & Vul, E. (2009). Predicting the optimal spacing of study. *Advances in NIPS*, 22, 1321–1329. [PDF](https://home.cs.colorado.edu/~mozer/Research/Selected%20Publications/reprints/MozerPashlerCepedaLindseyVul2009.pdf) |

---

### Feature 7: Session Position / Fatigue Index

| Aspect | Detail |
|---|---|
| **How to measure/log** | Log `card_position_in_session` (ordinal index, 1-based). Also compute a running `session_duration_ms` and `mean_RT_last_10` to detect RT drift upward (fatigue) or downward (warm-up). Optionally compute `RT_slope` via linear regression over the last N items. |
| **Confidence/retention signal** | Vigilance decrement — the well-documented decline in sustained attention — manifests as slower RTs, higher error rates, and more careless responding as a session progresses. Reviews performed under fatigue may produce weaker encoding. |
| **Effect direction** | **Later session position → slower RT, higher error rate, less durable encoding.** Warm-up effects can improve performance in the first few items, then vigilance decreases. See et al. (1995) meta-analyzed 42 vigilance studies and found reliable performance declines within 15–30 minutes. Sievertsen et al. (2016) showed in a large Danish study (N>2M observations) that student test performance declined roughly 0.9% of a standard deviation for every hour of testing. |
| **Cautions/confounds** | Individual differences in fatigue resistance are large. Motivation and engagement (gamification) can mask fatigue. Short sessions (<15 min) may not show the effect. The "warm-up" benefit in the first 2–5 items can confound early-session data. |
| **Key citations** | 1. See, J. E., Howe, S. R., Warm, J. S., & Dember, W. N. (1995). Meta-analysis of the sensitivity decrement in vigilance. *Psychol. Bull.*, 117(2), 230–249. [DOI: 10.1037/0033-2909.117.2.230](https://doi.org/10.1037/0033-2909.117.2.230) |
| | 2. Sievertsen, H. H., Gino, F., & Piovesan, M. (2016). Cognitive fatigue influences students' performance on standardized tests. *PNAS*, 113(10), 2621–2624. [DOI: 10.1073/pnas.1516947113](https://doi.org/10.1073/pnas.1516947113) |

---

### Feature 8: Circadian Phase (Time-of-Day)

| Aspect | Detail |
|---|---|
| **How to measure/log** | Record `session_start_utc` and the learner's timezone. Derive local hour. Optionally, infer chronotype from historical usage patterns (when the user most frequently studies). Classify into bins: early-morning, morning, afternoon, evening, late-night. |
| **Confidence/retention signal** | The "synchrony effect" shows that cognitive performance on effortful tasks is better when testing time aligns with the learner's circadian peak. Encoding during non-optimal hours may produce weaker initial memory traces. |
| **Effect direction** | **Studying at circadian peak → better encoding and retention.** May et al. (1999) showed that older adults tested at their optimal time of day (morning) outperformed those tested at non-optimal time on explicit memory tasks. Smarr et al. (2014) reviewed evidence for 24-hour periodicity in recall efficacy and proportional deficits from circadian misalignment. |
| **Cautions/confounds** | Evidence is stronger for older adults and young children than for college-age students. Individual chronotype variation is large. Hard to disentangle circadian effects from fatigue/sleep-deprivation confounds. The signal may be too noisy for per-card adjustments — better used as a session-level modifier. |
| **Key citations** | 1. May, C. P., Hasher, L., & Stoltzfus, E. R. (1993). Optimal time of day and the magnitude of age differences in memory. *Psychol. Science*, 4(5), 326–330. [DOI: 10.1111/j.1467-9280.1993.tb00573.x](https://doi.org/10.1111/j.1467-9280.1993.tb00573.x) |
| | 2. Smarr, B. L., Jennings, K. J., Driscoll, J. R., & Kriegsfeld, L. J. (2014). A time to remember: The role of circadian clocks in learning and memory. *Behavioral Neuroscience*, 128(3), 283–303. [DOI: 10.1037/a0035963](https://doi.org/10.1037/a0035963) |

---

### Feature 9: Explanation Dwell Time (Post-Answer Review)

| Aspect | Detail |
|---|---|
| **How to measure/log** | After the learner submits an answer and views the explanation/rationale, record `explanation_view_duration_ms`. Also track whether the learner scrolled through the full explanation or dismissed it quickly. Log separately for correct vs. incorrect answers. |
| **Confidence/retention signal** | Longer engagement with the explanation after a *correct* answer may indicate surprise (the learner wasn't sure they were right) or genuine study. After an *incorrect* answer, longer engagement with the rationale predicts better error correction and subsequent retention. |
| **Effect direction** | **Longer explanation dwell after errors → better subsequent retention.** Butler et al. (2008) found that feedback after testing enhances the testing effect, and the benefit is greater with elaborative feedback than simple correct/incorrect signals. Pashler et al. (2005) showed that feedback is most beneficial when the learner has made an error. After correct answers, very long dwell may indicate low confidence (the answer was a lucky guess). |
| **Cautions/confounds** | Dwell time is a noisy proxy — the learner may be distracted (phone, multitasking) rather than actively reading. Short dwell after errors may indicate frustration/disengagement rather than mastery. |
| **Key citations** | 1. Butler, A. C., Karpicke, J. D., & Roediger, H. L. (2008). Correcting a metacognitive error: Feedback increases retention of low-confidence correct responses. *J. Exp. Psychol.: Learning, Memory, & Cognition*, 34(4), 918–928. [DOI: 10.1037/0278-7393.34.4.918](https://doi.org/10.1037/0278-7393.34.4.918) |
| | 2. Pashler, H., Cepeda, N. J., Wixted, J. T., & Rohrer, D. (2005). When does feedback facilitate learning of words? *J. Exp. Psychol.: Learning, Memory, & Cognition*, 31(1), 3–8. [DOI: 10.1037/0278-7393.31.1.3](https://doi.org/10.1037/0278-7393.31.1.3) |

---

### Feature 10: Fluency Illusion Susceptibility (Same-Day Re-Encounter Speed)

| Aspect | Detail |
|---|---|
| **How to measure/log** | When a card is reviewed multiple times within the same session or same day, compute `RT_ratio = RT_second / RT_first`. A very low ratio (the learner gets dramatically faster) may reflect short-term priming rather than genuine learning. |
| **Confidence/retention signal** | Kornell & Bjork (2008) demonstrated that massed repetitions create feelings of fluency that are disproportionate to actual durable learning. A card answered much faster on its second same-day encounter may have artificially inflated confidence. |
| **Effect direction** | **Large RT speedup on same-day re-encounter → inflated confidence, possibly weaker long-term retention than the speed suggests.** The mismeasure effect (Benjamin et al., 1998): learners predict they'll remember fast-retrieved items better, but the opposite often holds for same-day reviews. |
| **Cautions/confounds** | Some speedup is legitimate (the first encounter genuinely strengthened the trace). The fluency illusion is strongest for *massed* repetitions (minutes apart) and diminishes with spacing ≥1 day. Difficult to set a threshold for "too fast" without per-user baselines. |
| **Key citations** | 1. Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychol. Science*, 19(6), 585–592. [DOI: 10.1111/j.1467-9280.2008.02127.x](https://doi.org/10.1111/j.1467-9280.2008.02127.x) |
| | 2. Benjamin, A. S., Bjork, R. A., & Schwartz, B. L. (1998). The mismeasure of memory. *J. Exp. Psychol.: General*, 127(1), 55–68. [DOI: 10.1037/0096-3445.127.1.55](https://doi.org/10.1037/0096-3445.127.1.55) |

---

### Feature 11: Cursor/Pointer Trajectory Entropy

| Aspect | Detail |
|---|---|
| **How to measure/log** | On desktop, sample mouse position every ~50ms from question display to answer submission. Compute: (a) x-axis flips (reversals toward alternative answers), (b) maximum deviation from a straight path to the chosen answer, (c) sample entropy of the trajectory. On mobile, track touch-drag or successive tap coordinates if applicable. |
| **Confidence/retention signal** | Mouse-tracking research shows that cursor trajectories reflect real-time competition between response alternatives. Higher trajectory entropy and more x-flips indicate greater decision conflict and lower confidence. |
| **Effect direction** | **More trajectory deviations / higher entropy → greater decision conflict → lower confidence.** Schoemann et al. (2020) reviewed mouse-tracking methodology and confirmed that deflection metrics index activation of competing responses. Freeman & Ambady (2010) showed that mouse trajectories reveal graded cognitive processing in real time. |
| **Cautions/confounds** | **Evidence quality: moderate.** Works well on desktop with spatially separated answer options. Much less applicable on mobile (taps don't produce trajectories). Requires specific UI layout (answer options in predictable spatial positions). High data volume — need to decide what summary statistics to store. Individual differences in motor behavior are large. |
| **Key citations** | 1. Schoemann, M., O'Hora, D., Dale, R., & Scherbaum, S. (2020). Using mouse cursor tracking to investigate online cognition. *Psychonomic Bull. & Review*, 28, 766–787. [DOI: 10.3758/s13423-020-01851-3](https://doi.org/10.3758/s13423-020-01851-3) |
| | 2. Freeman, J. B., & Ambady, N. (2010). MouseTracker: Software for studying real-time mental processing. *Behavior Research Methods*, 42(1), 226–241. [DOI: 10.3758/BRM.42.1.226](https://doi.org/10.3758/BRM.42.1.226) |

---

### Feature 12: Prior Exposure Count (Repetition History)

| Aspect | Detail |
|---|---|
| **How to measure/log** | For each card, maintain `total_review_count` and `days_since_first_encounter`. Also track `unique_session_count` (how many distinct sessions included this card). |
| **Confidence/retention signal** | More prior exposures, especially successful retrievals spread over time, predict stronger memory. But *many* exposures with continued errors signals a "leech" — a card that resists learning and may require different pedagogical intervention. |
| **Effect direction** | **More spaced successful exposures → stronger retention.** Lindsey et al. (2014) showed personalized review scheduling based on individual history yielded 16.5% retention gains over massed study. High exposure count with persistent errors is a negative signal — the card may be poorly worded, or the concept needs prerequisite knowledge. |
| **Cautions/confounds** | Raw count without spacing information is misleading (10 reviews in one day ≠ 10 reviews across 10 weeks). Must be interpreted jointly with interval data and accuracy history. |
| **Key citations** | 1. Lindsey, R. V., Shroyer, J. D., Pashler, H., & Mozer, M. C. (2014). Improving students' long-term knowledge retention through personalized review. *Psychol. Science*, 25(3), 639–647. [DOI: 10.1177/0956797613504302](https://doi.org/10.1177/0956797613504302) |
| | 2. Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychol. Science*, 19(11), 1095–1102. [DOI: 10.1111/j.1467-9280.2008.02209.x](https://doi.org/10.1111/j.1467-9280.2008.02209.x) |

---

### Feature 13: Within-Session Accuracy Trajectory (Performance Slope)

| Aspect | Detail |
|---|---|
| **How to measure/log** | Compute a rolling accuracy rate over the last N items (e.g., sliding window of 10). Fit a simple linear regression to correctness (0/1) over item position in the session. Log `accuracy_slope` — positive means the learner is warming up or encountering easier items; negative means fatigue or increasing difficulty. |
| **Confidence/retention signal** | A declining accuracy trajectory within a session suggests the learner is either fatigued or encountering material beyond their current competence. Reviews occurring during a performance decline may benefit from shorter future intervals (the encoding context was suboptimal). |
| **Effect direction** | **Negative accuracy slope → less reliable encoding for late-session items.** Sievertsen et al. (2016) showed performance declines of ~0.9% SD per hour. Bjork & Bjork (2011) noted that "desirable difficulties" can produce temporarily lower performance that leads to better long-term retention, so context matters — declining accuracy from *harder* material may actually be beneficial. |
| **Cautions/confounds** | Accuracy slope is confounded with item difficulty ordering. If the app serves harder items later (adaptive ordering), the slope is not solely attributable to fatigue. Small session sizes produce unstable slope estimates. |
| **Key citations** | 1. Sievertsen, H. H., Gino, F., & Piovesan, M. (2016). Cognitive fatigue influences students' performance. *PNAS*, 113(10), 2621–2624. [DOI: 10.1073/pnas.1516947113](https://doi.org/10.1073/pnas.1516947113) |
| | 2. Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In *Psychology and the real world* (pp. 56–64). New York: Worth. |

---

### Feature 14: Delayed JOL Proxy (Retrieval Latency at Spaced Intervals)

| Aspect | Detail |
|---|---|
| **How to measure/log** | For each card, compare RT on the current review to the RT on the *previous* review. Compute `RT_change_ratio = RT_current / RT_previous`. If the card was last seen ≥1 day ago and RT is stable or decreasing, this indicates the memory is consolidating. If RT increases sharply, the memory is decaying. |
| **Confidence/retention signal** | Nelson & Dunlosky (1991) showed that delayed judgments of learning (made after a gap, based on attempted retrieval from LTM rather than STM) are far more accurate predictors of future retention than immediate JOLs. RT change across spaced reviews serves as an *implicit* delayed JOL. |
| **Effect direction** | **Stable or decreasing RT across spaced reviews → consolidating memory → higher future retention. Increasing RT → decaying trace → needs shorter interval.** This is the behavioral fingerprint of memory stabilization vs. destabilization. |
| **Cautions/confounds** | Requires ≥2 spaced reviews to compute. RT is affected by many factors beyond memory strength (device, context, time of day, fatigue). Per-user normalization (z-scoring against the user's own baseline) is essential to extract signal. |
| **Key citations** | 1. Nelson, T. O., & Dunlosky, J. (1991). When people's judgments of learning are extremely accurate at predicting subsequent recall: The "delayed-JOL effect." *Psychol. Science*, 2(4), 267–270. [DOI: 10.1111/j.1467-9280.1991.tb00147.x](https://doi.org/10.1111/j.1467-9280.1991.tb00147.x) |
| | 2. Nelson, T. O., & Dunlosky, J. (1992). How shall we explain the delayed-judgment-of-learning effect? *Psychol. Science*, 3(5), 317–318. [DOI: 10.1111/j.1467-9280.1992.tb00681.x](https://doi.org/10.1111/j.1467-9280.1992.tb00681.x) |

---

## 3. FSRS Integration Notes

### 3.1 Most Promising Features for FSRS Rating/Interval Adjustment

The following five features have the strongest empirical backing, the most practical signal-to-noise ratio, and integrate most naturally with FSRS's stability/difficulty framework:

**1. Response Latency (Feature 1)** — This is the single most-studied behavioral correlate of confidence and memory strength. PANaCEa already captures `timeToFirstClick` and uses it. The key improvement is per-user normalization: z-score each RT against the learner's rolling baseline (by question type), as described in your Sprint 1 baseline normalization. This converts a noisy absolute signal into a reliable relative one. Use the normalized RT as a primary input to `deriveContinuousRating`, weighted ~0.30–0.40.

**2. Answer Switching Count (Feature 2)** — Already captured as `answerSwitches`. This is a clean, discrete signal with clear directionality. Zero switches + correct + fast RT = high confidence. Multiple switches + correct = lower confidence (hedged knowledge). Weight ~0.20–0.25. The key enhancement would be logging *direction* (initial→final correctness) to distinguish beneficial revision from vacillation.

**3. Retrieval Success History / Streak (Feature 5)** — FSRS already tracks this implicitly through its state transitions. The enhancement is to treat *lapses after long streaks* as especially informative negative signals (possible interference or "false stability"). A card with 5 consecutive correct answers that suddenly fails should receive a larger stability penalty than a card with alternating correct/incorrect that fails. This is implementable as a lapse-severity multiplier.

**4. Elapsed Days Since Last Review (Feature 6)** — FSRS already uses this as `elapsed_days`. The refinement is to weight the *information value* of a review: correct at 90% retrievability tells you little; correct at 50% retrievability is highly informative. Use the delta between expected and actual performance (`retrievability - actual_outcome`) to scale how much the review updates stability, similar to a Bayesian surprise signal.

**5. Fluency Illusion Dampener (Feature 10)** — Already partially implemented in PANaCEa's `fluencyIllusionDampener()`. The research strongly supports discounting confidence for same-day reviews. The current 30% reduction for same-day reviews (ramping to 0% at ≥1 day) is well-calibrated to Benjamin et al.'s findings. Consider extending this to detect *within-session repeated encounters* of the same concept (not just the same card) — e.g., two pharma questions about beta-blockers in the same session may inflate apparent mastery of both.

### 3.2 Features That Are Too Noisy or Context-Dependent

**Cursor/Pointer Trajectory (Feature 11)** — While the HCI literature validates this in controlled desktop experiments, it is impractical for a production study app. Most PANaCEa users are likely on mobile or tablet, where meaningful cursor data doesn't exist. Even on desktop, the data volume is high and the signal requires careful spatial layout of answer options. **Recommendation: deprioritize.** PANaCEa's existing CRPL micro-kinetics (`cursorEntropy`, `hoverOscillationCount`) are a reasonable lightweight approximation; keep them as secondary signals but don't invest in full trajectory logging.

**Circadian Phase (Feature 8)** — The evidence for time-of-day effects on memory is real but the effect sizes are small for college-age adults, highly individual, and confounded with sleep deprivation. PANaCEa already logs `circadian_phase` — this is appropriate as a *session-level modifier* but should not be used for per-card interval adjustments. The signal is too weak and too confounded.

**Within-Session Accuracy Slope (Feature 13)** — Interesting in principle but confounded by item difficulty ordering and small sample sizes in typical sessions. Could be used as a *session quality flag* (sessions with strong negative slope get a global 5–10% confidence reduction) but should not drive per-card scheduling.

### 3.3 Practical Recommendations

**Logging granularity.** For the five priority features, millisecond-resolution timestamps and per-event logging are justified. For secondary features (explanation dwell, session position), second-resolution is sufficient. Store raw telemetry in `ReviewLog.telemetry` as you're already doing, and compute derived features server-side.

**Per-user normalization is critical.** Absolute RT values are almost meaningless across users (device differences, reading speed, personality). All RT-derived features should be z-scored against the user's own rolling baseline, stratified by question type. Your Sprint 1 implementation (200-attempt rolling window from `userTimingProfileService.ts`) is well-aligned with the research: Van der Linden (2006) recommends person-specific baselines, and 200 observations is sufficient for stable estimates.

**Telemetry quality tiers.** Your existing `assessTelemetryQuality()` classification (full/partial/minimal) is sound. The optimizer should upweight reviews with full telemetry, as you're doing in Sprint 5. The key insight from the literature is that reviews with only duration data (minimal) are much less informative for confidence estimation — they can still update FSRS state based on correctness alone, but should contribute nothing to the confidence pipeline.

**Privacy considerations.** All behavioral telemetry should be stored as aggregated features (RT in ms, switch count, boolean flags), never raw interaction streams. Cursor data in particular can be personally identifiable at scale (mouse movement fingerprinting). The current design of storing computed metrics rather than raw events is privacy-appropriate. If you add any new telemetry, ensure it's described in your privacy policy under "learning analytics used to personalize review scheduling."

**Calibration feedback loop.** Your Sprint 2 metacognitive calibration service (Brier scores) is the right mechanism to validate whether the behavioral signals are actually improving prediction. Run the validation pipeline (Sprint 6) monthly, stratified by telemetry quality tier and question type, to detect if any signal is degrading or if the confidence model is systematically miscalibrated for certain subpopulations.

---

## References (Consolidated)

1. Aleven, V., Stahl, E., Schworm, S., Fischer, F., & Wallace, R. (2003). Help seeking and help design in interactive learning environments. *Review of Educational Research*, 73(3), 277–320. [DOI: 10.3102/00346543073003277](https://doi.org/10.3102/00346543073003277)

2. Benjamin, A. S., Bjork, R. A., & Schwartz, B. L. (1998). The mismeasure of memory: When retrieval fluency is misleading as a metamnemonic index. *Journal of Experimental Psychology: General*, 127(1), 55–68. [DOI: 10.1037/0096-3445.127.1.55](https://doi.org/10.1037/0096-3445.127.1.55)

3. Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In M. A. Gernsbacher et al. (Eds.), *Psychology and the real world* (pp. 56–64). Worth Publishers.

4. Butler, A. C., Karpicke, J. D., & Roediger, H. L. (2008). Correcting a metacognitive error: Feedback increases retention of low-confidence correct responses. *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 34(4), 918–928. [DOI: 10.1037/0278-7393.34.4.918](https://doi.org/10.1037/0278-7393.34.4.918)

5. Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380. [DOI: 10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354)

6. Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science*, 19(11), 1095–1102. [DOI: 10.1111/j.1467-9280.2008.02209.x](https://doi.org/10.1111/j.1467-9280.2008.02209.x)

7. Chen, X., Zhang, M., & Liu, X. L. (2019). Retrieval practice facilitates judgments of learning through multiple mechanisms. *Frontiers in Psychology*, 10, 987. [DOI: 10.3389/fpsyg.2019.00987](https://doi.org/10.3389/fpsyg.2019.00987)

8. Freeman, J. B., & Ambady, N. (2010). MouseTracker: Software for studying real-time mental processing using the computer mouse. *Behavior Research Methods*, 42(1), 226–241. [DOI: 10.3758/BRM.42.1.226](https://doi.org/10.3758/BRM.42.1.226)

9. Hicks, A., Peddycord, B., & Barnes, T. (2014). Hint systems may negatively impact performance in educational games. *Proceedings of the ACM Conference on Learning @ Scale*, 71–72. [DOI: 10.1145/2556325.2566248](https://doi.org/10.1145/2556325.2566248)

10. Kang, S. H. K., Lindsey, R. V., Mozer, M. C., & Pashler, H. (2014). Retrieval practice over the long term: Should spacing be expanding or equal-interval? *Psychonomic Bulletin & Review*, 21(4), 1090–1098. [DOI: 10.3758/s13423-014-0600-x](https://doi.org/10.3758/s13423-014-0600-x)

11. Koriat, A. (1993). How do we know that we know? The accessibility model of the feeling of knowing. *Psychological Review*, 100(4), 609–639. [DOI: 10.1037/0033-295X.100.4.609](https://doi.org/10.1037/0033-295X.100.4.609)

12. Koriat, A. (2010). Choice latency as a cue for children's subjective confidence in the correctness of their answers. *Developmental Science*, 14(3), 441–453. [DOI: 10.1111/j.1467-7687.2009.00907.x](https://doi.org/10.1111/j.1467-7687.2009.00907.x)

13. Koriat, A., & Goldsmith, M. (1996). Monitoring and control processes in the strategic regulation of memory accuracy. *Psychological Review*, 103(3), 490–517. [DOI: 10.1037/0033-295X.103.3.490](https://doi.org/10.1037/0033-295X.103.3.490)

14. Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science*, 19(6), 585–592. [DOI: 10.1111/j.1467-9280.2008.02127.x](https://doi.org/10.1111/j.1467-9280.2008.02127.x)

15. Lindsey, R. V., Shroyer, J. D., Pashler, H., & Mozer, M. C. (2014). Improving students' long-term knowledge retention through personalized review. *Psychological Science*, 25(3), 639–647. [DOI: 10.1177/0956797613504302](https://doi.org/10.1177/0956797613504302)

16. May, C. P., Hasher, L., & Stoltzfus, E. R. (1993). Optimal time of day and the magnitude of age differences in memory. *Psychological Science*, 4(5), 326–330. [DOI: 10.1111/j.1467-9280.1993.tb00573.x](https://doi.org/10.1111/j.1467-9280.1993.tb00573.x)

17. Metcalfe, J., & Finn, B. (2016). The instinct fallacy: The metacognition of answering and revising during college exams. *Metacognition and Learning*, 11(2), 171–185. [DOI: 10.1007/s11409-015-9140-8](https://doi.org/10.1007/s11409-015-9140-8)

18. Mozer, M. C., Pashler, H., Cepeda, N., Lindsey, R., & Vul, E. (2009). Predicting the optimal spacing of study: A multiscale context model of memory. *Advances in Neural Information Processing Systems*, 22, 1321–1329. [PDF](https://home.cs.colorado.edu/~mozer/Research/Selected%20Publications/reprints/MozerPashlerCepedaLindseyVul2009.pdf)

19. Nelson, T. O., & Dunlosky, J. (1991). When people's judgments of learning are extremely accurate: The "delayed-JOL effect." *Psychological Science*, 2(4), 267–270. [DOI: 10.1111/j.1467-9280.1991.tb00147.x](https://doi.org/10.1111/j.1467-9280.1991.tb00147.x)

20. Nelson, T. O., & Dunlosky, J. (1992). How shall we explain the delayed-judgment-of-learning effect? *Psychological Science*, 3(5), 317–318. [DOI: 10.1111/j.1467-9280.1992.tb00681.x](https://doi.org/10.1111/j.1467-9280.1992.tb00681.x)

21. Pashler, H., Cepeda, N. J., Wixted, J. T., & Rohrer, D. (2005). When does feedback facilitate learning of words? *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 31(1), 3–8. [DOI: 10.1037/0278-7393.31.1.3](https://doi.org/10.1037/0278-7393.31.1.3)

22. Ratcliff, R., & McKoon, G. (2008). The diffusion decision model: Theory and data for two-choice decision tasks. *Neural Computation*, 20(4), 873–922. [DOI: 10.1162/neco.2008.12-06-420](https://doi.org/10.1162/neco.2008.12-06-420)

23. Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3), 249–255. [DOI: 10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x)

24. Schoemann, M., O'Hora, D., Dale, R., & Scherbaum, S. (2020). Using mouse cursor tracking to investigate online cognition. *Psychonomic Bulletin & Review*, 28, 766–787. [DOI: 10.3758/s13423-020-01851-3](https://doi.org/10.3758/s13423-020-01851-3)

25. See, J. E., Howe, S. R., Warm, J. S., & Dember, W. N. (1995). Meta-analysis of the sensitivity decrement in vigilance. *Psychological Bulletin*, 117(2), 230–249. [DOI: 10.1037/0033-2909.117.2.230](https://doi.org/10.1037/0033-2909.117.2.230)

26. Sievertsen, H. H., Gino, F., & Piovesan, M. (2016). Cognitive fatigue influences students' performance on standardized tests. *Proceedings of the National Academy of Sciences*, 113(10), 2621–2624. [DOI: 10.1073/pnas.1516947113](https://doi.org/10.1073/pnas.1516947113)

27. Smarr, B. L., Jennings, K. J., Driscoll, J. R., & Kriegsfeld, L. J. (2014). A time to remember: The role of circadian clocks in learning and memory. *Behavioral Neuroscience*, 128(3), 283–303. [DOI: 10.1037/a0035963](https://doi.org/10.1037/a0035963)
