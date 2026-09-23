# Concept-level learning: science, differentiation, and implementation audit

Date: September 23, 2026. Scope: primary research, the owner's concept-level scheduling description and supplied research brief, and the repository on `design/site-usability-audit`. Findings describe inspected source, not production telemetry or measured learner outcomes. No scheduling parameters, schema, or backend behavior were changed.

## Product thesis

**PANaCEa learns from how a PA student answers, estimates the durability of their knowledge, and schedules another encounter with the concept through a fresh question.** The useful promise is less study management and practice that exercises knowledge across contexts. “Maximize retention and minimize effort” is an optimization goal; it is not an outcome established for this implementation.

The distinctive combination is concept memory, behavior-inferred grading, fresh clinical retrieval, and PA-specific prioritization. Each ingredient has prior art. Avoid “first,” “only,” or “scientifically proven to improve PANCE scores” without a current comparative study and direct product evidence.

## The science beyond the forgetting curve

| Principle | What the research supports | PANaCEa implication and boundary |
| --- | --- | --- |
| Distributed practice | Cepeda et al. reviewed hundreds of experiments: effective spacing depends partly on how long knowledge must be retained [1]. | Estimate changing recall over time; adapt the schedule to the target horizon. A single fixed Ebbinghaus curve is not a personalized schedule. |
| Retrieval practice | Karpicke and Blunt found benefits from actively retrieving science material, including meaningful learning tasks [2]. | Ask the learner to retrieve before showing the explanation. A fluent reread and a successful independent retrieval should not count as equivalent evidence. |
| Varied retrieval and transfer | Butler et al. directly compared repeated identical questions with different applications of the same concept. Four experiments favored varied retrieval on new questions two days later [3]. | Preserve the knowledge target while varying the case, wording, and application. This study used geology material; it does not validate clinical outcomes or every generated variant. |
| Personalized review | Lindsey et al. compared time-matched review schedules in a middle-school language course and found an advantage for personalized review [4]. | Test scheduling against an equal-time baseline. Their effect sizes cannot become PANaCEa marketing numbers. |
| Trainable forgetting models | Settles and Meeder model word/concept memory using learner history in language learning [5]. | Personalization is credible prior art, not a unique invention. Benchmark the behavioral layer against a simpler history-only model. |
| Knowledge tracing across items | DAS3H combines skill relationships, temporal practice history, and forgetting, evaluated on three educational datasets [6]. | Clinical concepts should persist across question IDs. Explicit concept/task tags matter when one vignette tests several skills. |
| Metacognitive miscalibration | Benjamin et al. show that retrieval fluency can mislead judgments of later memory [7]. | Avoid depending on learner self-ratings alone. Equally, do not treat speed as ground truth: fast answers may reflect guessing or easy wording. |
| Variant difficulty | Westacott et al. found meaningful difficulty variation within generated medical item families [8]. | Same concept does not mean equivalent measurement. Calibrate question difficulty and case complexity before attributing performance differences to memory decay. |
| Productive challenge | Wilson et al.'s approximately 85% result comes from particular learning models and classification/perceptual settings [9]. | Difficulty should be adaptive, but 85% is not a universal PA question-bank target. Tune challenge against delayed retention, burden, and error patterns. |

These are different claims: improved prediction, increased engagement, better transfer, and reduced study time. Evidence for one does not establish the others. The public page now presents spacing, varied retrieval, and evidence limits with primary-source links.

## What the code supports now

| Capability | Source evidence | Honest feature language |
| --- | --- | --- |
| Memory state shared across questions | `lib/services/drillReviewService.ts` reads and updates `UserProgress` by user, condition, and progress context; a separate task-level update also exists. | “Review the concept through fresh questions.” The inspected primary grain is a condition, not necessarily every atomic fact. |
| Implicit grading | `lib/implicit-metrics.ts` and the canonical review service derive grades from correctness and behavioral inputs; FSRS receives a continuous grade while lapse handling preserves Again/Good semantics. | “Your answers and response patterns guide review—no confidence rating required.” |
| Personal timing context | The review pipeline uses response-time baselines and context adjustments, with fallback paths for missing signals. | “Timing is considered in context.” Do not describe fast responses as proof of mastery. |
| Multi-signal adjustments | The review service invokes fatigue, guessing, interference, answer-switching, explanation-engagement, and other adjustments. Some depend on optional telemetry. | “More than right or wrong.” Existence in code is not evidence that each adjustment improves predictions; historical-data gaps are listed below. |
| Rapid-guess protection | A rapid-guess branch logs separately and skips the normal FSRS update. | “Avoid treating a rapid guess as reliable evidence of learning.” Detection accuracy remains to be measured. |
| Fresh-item selection | Question fetch/pool and session selection paths exclude seen IDs. | “Practice familiar concepts with fresh prompts.” An absolute never-repeat guarantee needs further route and failure-path validation. |
| Separate practice contexts | Cram/rapid recall are excluded from canonical FSRS writes; readiness and targeted progress are partitioned. | Explain the purpose of each mode. Do not promise that every activity updates longitudinal memory. |

Primary scheduling references: `lib/services/drillReviewService.ts`, `lib/services/userProgressService.ts`, `lib/fsrs.ts`. Fresh-item references: `functions/api/questions/fetch.ts`, `functions/api/questions/pool.ts`, `functions/api/_shared/no-repeat.ts`, `lib/services/session/sessionService.ts`. This is source tracing, not an end-to-end exercise of every route.

## Confidence needs three separate meanings

1. **Behavioral confidence score:** a proxy derived from response behavior. It is neither the learner's reported confidence nor automatically a calibrated probability.
2. **Predicted recall probability:** a model estimate for a defined concept at a defined future time and testing condition. Validate it against later answers on unseen variants.
3. **Uncertainty interval:** uncertainty around an estimate. Specify what varies, the method, and whether the reported range has empirically correct coverage. A confidence interval and a Bayesian credible interval are not interchangeable labels.

The existing scheduling path uses behavioral scores and memory-state adjustments. The Wilson mastery calculation is explicitly **read-only/shadow**, not the scheduling policy. `lib/confidence/bayesianAccumulator.ts` performs a quality- and recency-weighted blend with bounded history influence; it returns no interval. Its `posterior` name does not itself establish a calibrated Bayesian posterior.

A future uncertainty-aware policy could use an interval to avoid postponing an uncertain concept too aggressively, or select a diagnostic question when uncertainty is high. That is a proposed extension. A simple Wilson interval over changing, dependent, unequal-difficulty responses is not by itself an interval for future concept recall under a dynamic learning process.

## Prioritized implementation findings

| Priority | Finding and evidence | Consequence / next acceptance criterion |
| --- | --- | --- |
| P1 | **Historical behavioral fields are not written by the canonical snapshot path.** `drillReviewService.ts` filters `existingProgress.reviewHistory` for `confidence`, `wasCorrect`, and `responseTimeMs`. `userProgressService.ts` calls `createReviewSnapshot(fsrsCard, rating)`; the snapshot defined in `lib/fsrs.ts` stores memory/rating fields without those behavioral values. | On history produced by this writer, accumulation and RT-trajectory history cannot work as described. Inspect stored records and alternate writers, then establish one typed history contract or read authoritative ReviewLogs. Verify with consecutive different questions on the same concept. History is appended oldest-to-newest, while consumers assume newest-first; address ordering too. |
| P1 | **“Confidence interval schedules review” is not the current implementation.** Wilson mastery/hypercorrection is labeled shadow in the review service and returned read-only. | Keep public copy at confidence estimates. Before using uncertainty for scheduling, specify its statistical target, calibrate coverage, and evaluate policy outcomes. |
| P1 | **Wilson history is item-keyed and may double-count the current review.** The query filters by `questionId` after the transaction has created the current real ReviewLog, then appends `isCorrect` again. No current-ID exclusion appears in the inspected query. | Reproduce with a database-backed test before changing this path. Use appropriate concept/task history and include each review once. Same-item hypercorrection also becomes sparse under fresh-question practice. This currently affects shadow signals, not FSRS directly. |
| P1 | **Fresh-item guarantees have failure and coverage gaps.** The shared seen-history helper returns an empty list after lookup errors; exposure recording catches failures. Some fetch paths cap seen-history queries. The inspected shared `fetchUnseenQuestions` accepts `conditionId` but does not apply it in its query. | Audit each active route, identity namespace, concurrency, exhaustion, offline retry, and near-duplicate handling. When no suitable unseen question exists, show a clear alternative instead of silently serving a repeat or another concept. Confirm caller reachability for the helper before assigning production impact. |
| P1 | **Variant difficulty is not the same as a learner-level challenge setting.** `difficultyCalibrator.ts` tunes an easy/medium/hard mix using rolling accuracy. No per-item difficulty correction was found in the inspected canonical grade path. | Separate item/case difficulty, reading load, and learner memory. Evaluate a hierarchical model or calibrated item-family effects, with held-out variants. |
| P2 | **Concept grain needs an explicit contract.** The primary memory state is condition-level with separate task progress. Risk factors, diagnosis, and management can have different retention. | Document the knowledge-component taxonomy and which state actually selects the next concept. Do not infer entire-condition mastery from one narrow success. |
| P2 | **Relearning savings uses a question-level lookup.** The reviewed `getOriginalLearningRt` call takes `questionId`. | Establish concept/task and comparable-variant history before promoting cross-context relearning savings as a working differentiator. |
| P2 | **Many modifiers need ablation evidence.** Research citations in function comments motivate ideas; they do not validate the chosen thresholds or combined multipliers. | Compare correctness-only, personal timing, and added telemetry incrementally. Check missing telemetry, devices, accessibility accommodations, and reading-speed differences. Remove inputs that add burden or systematic error without predictive benefit. |

The supplied brief was useful as a hypothesis list, but its treatment of `lib/fsrsQuestionLinking.ts` as the verified production engine is not supported by the inspected call graph. That file describes question-specific tracking and was found referenced by a demo script; the canonical production write path is `drillReviewService`. For the exact varied-versus-identical question comparison, Butler **2017** is the direct source used here.

## What can set PANaCEa apart

Current official documentation already describes adaptive memory scheduling in Anki/FSRS [10], and AMBOSS describes performance-based study recommendations [11]. HLR and DAS3H also predate this project. These checks establish overlapping capabilities; they are not an exhaustive market review and do not establish that competitors lack any particular feature.

The stronger position is a coherent PA study experience built around the following combination:

| Feature direction | Status | Student-facing value / next step |
| --- | --- | --- |
| Concept memory with fresh clinical cases | Partly implemented; selection and measurement gaps above | Learn PE risk factors across different cases without needing to recognize a repeated stem. Make concept tagging and variant QA reliable first. |
| Automatic grading and scheduling | Implemented source path; requires outcome validation | Answer normally; let the system organize review. Explain the timing decision in one readable sentence. |
| Recall estimates that acknowledge uncertainty | Confidence score exists; calibrated uncertainty-aware scheduling proposed | “We need another observation” can be more useful than a falsely precise mastery percentage. Show a range only when its interpretation is validated. |
| Confusion-pair practice | Interference/confusion heuristics exist; complete intervention efficacy unverified | When two diagnoses repeatedly get confused, choose cases that teach the distinguishing feature. Validate targeted contrast questions and transfer. |
| Retention per study minute | Proposed objective; current code contains timing and retention inputs | Rank useful review opportunities within a short session budget. Evaluate delayed knowledge retained per minute, rather than streaks or questions completed. |
| Deadline-aware retention with concept/task coverage | Deadline/context inputs exist; full experience needs route validation | Balance near-term exam preparation with longer retention and expose neglected clinical tasks. Present readiness as learning evidence, not a pass probability. |
| Relearning that recognizes prior knowledge | Heuristic exists; item-keyed history needs work | After a lapse, recover efficiently without assuming all prior learning has disappeared. Compare response trajectories on calibrated variants of the same concept. |

Suggested public positioning: **“Study the concept. Let PANaCEa plan the next encounter.”** Supporting copy: “Your answers, timing, and response patterns guide a personalized review schedule. Practice the same knowledge through fresh questions, with less planning between sessions.”

## Validation plan tied to the product promise

**First fix measurement.** Record concept/task identity, item family, exposure identity, review context, timestamps, correctness, telemetry availability, model version, and the prediction made before the outcome. Define concept boundaries and a reviewed variant set. Resolve history-shape and current-event duplication issues before interpreting calibration graphs.

**Then evaluate prediction.** Use temporal holdouts and held-out learners and question families. Score future unseen-variant correctness with Brier score and log loss; inspect calibration by delay, concept, item difficulty, and available telemetry. For intervals, report empirical coverage and width under a specified target. Prediction must precede the event it predicts.

**Then evaluate learning and effort.** Compare against correctness-only scheduling and a reasonable spaced-review baseline at equal study time. Predefine delayed tests (for example, 14 and 30 days) using previously unseen, balanced variants. Measure retention and transfer separately, along with actual study minutes and workload. Randomize at a level that limits intervention spillover; choose sample size from a power analysis and the intended meaningful effect, not an invented target.

**Keep the complexity earned.** Run ablations for timing, answer revisions, and additional telemetry. A feature is valuable when it improves calibrated predictions or learner outcomes after accounting for missing data and confounds. More behavioral signals alone are not a scientific advantage.

## Primary sources and current product documentation

1. Cepeda et al. (2006), *Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis*. [Author institution record](https://digitalcommons.usf.edu/psy_facpub/1771/). DOI: 10.1037/0033-2909.132.3.354.
2. Karpicke & Blunt (2011), *Retrieval Practice Produces More Learning than Elaborative Studying with Concept Mapping*. [Author-hosted paper](https://learninglab.psych.purdue.edu/downloads/2011/2011_Karpicke_Blunt_Science.pdf). DOI: 10.1126/science.1199327.
3. Butler, Black-Maier, Raley & Marsh (2017), *Retrieving and applying knowledge to different examples promotes transfer of learning*. [Duke record](https://scholars.duke.edu/publication/1292911). DOI: 10.1037/xap0000142.
4. Lindsey, Shroyer, Pashler & Mozer (2014), *Improving Students' Long-Term Knowledge Retention Through Personalized Review*. [Author-hosted paper](https://laplab.ucsd.edu/articles/LindseyShroyerPashlerMozer2014.pdf). DOI: 10.1177/0956797613504302.
5. Settles & Meeder (2016), *A Trainable Spaced Repetition Model for Language Learning*. [ACL paper](https://aclanthology.org/P16-1174/). DOI: 10.18653/v1/P16-1174.
6. Choffin et al. (2019), *DAS3H: Modeling Student Learning and Forgetting for Optimally Scheduling Distributed Practice of Skills*. [Author preprint](https://arxiv.org/abs/1905.06873), EDM 2019.
7. Benjamin, Bjork & Schwartz (1998), *The Mismeasure of Memory: When Retrieval Fluency Is Misleading as a Metamnemonic Index*. [Author institution record](https://experts.illinois.edu/en/publications/the-mismeasure-of-memory-when-retrieval-fluency-is-misleading-as-/). DOI: 10.1037/0096-3445.127.1.55.
8. Westacott et al. (2023), *Automated Item Generation: impact of item variants on performance and standard setting*. [Full research article](https://link.springer.com/article/10.1186/s12909-023-04457-0). DOI: 10.1186/s12909-023-04457-0.
9. Wilson et al. (2019), *The Eighty Five Percent Rule for optimal learning*. [Research article](https://www.nature.com/articles/s41467-019-12552-4). DOI: 10.1038/s41467-019-12552-4.
10. [Anki manual: deck options and FSRS](https://docs.ankiweb.net/deck-options.html), accessed September 23, 2026.
11. [AMBOSS official product description](https://www.amboss.com/int/group-discount/so-pe-enam-0326), performance analytics and personalized study recommendations, accessed September 23, 2026.
