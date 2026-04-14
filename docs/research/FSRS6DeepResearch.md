# Behavioral signals to FSRS grades: a technical foundation for PANaCEa

PANaCEa's behavioral analysis system requires converting implicit signals — response time, confidence, streaks, fatigue — into the four-grade input that FSRS-6 expects. **FSRS-6 uses 21 trainable parameters (w0–w20)**, accepts grades 1–4 (Again/Hard/Good/Easy), and models memory stability through a power-law forgetting curve with a newly trainable decay parameter. The cognitive science literature validates response time as a confidence proxy with important caveats, answer-change patterns carry a robust 3:1 signal ratio, and Wilson score lower bounds provide small-sample mastery detection — but Brier score is not what FSRS actually optimizes (it uses log loss and a custom binned RMSE). This report provides the exact formulas, validated thresholds, and API specifications needed to build the grade-mapping layer.

---

## FSRS-6 uses 21 parameters and a trainable forgetting curve

FSRS-6 is the current production algorithm, available in Anki since version 25.07. Its key innovation over FSRS-5 is a **trainable forgetting curve decay parameter w₂₀**, replacing the previously hardcoded value of −0.5. The algorithm accepts exactly four grades and computes three core quantities: retrievability (probability of recall), stability (the interval at which R = 90%), and difficulty (card-intrinsic learning resistance on a 1–10 scale).

**Grade definitions are strict.** Rating 1 (Again) is the only failing grade. Ratings 2 (Hard), 3 (Good), and 4 (Easy) are all passing grades — a critical design constraint for any behavioral-to-grade mapping system. The FSRS wiki explicitly warns against using Hard as a failing grade.

**The forgetting curve** in FSRS-6 follows a power law:

```
R(t, S) = (1 + factor · t/S)^(−w₂₀)
where factor = 0.9^(−1/w₂₀) − 1
```

This ensures R(S, S) = 0.9 for any w₂₀ value, meaning stability S always equals the interval at which recall probability is **90%**. The default w₂₀ = 0.1542 (constrained to [0.1, 0.8]). For FSRS-5 compatibility, setting w₂₀ = 0.5 recovers the classic formula R = (1 + t·19/81/S)^(−0.5).

**Default parameters (w0–w20)**, optimized across several hundred million reviews from ~10,000 users:

```
w = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
     1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
     1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

The first four parameters directly set initial stability per grade: **S₀(Again) = 0.212 days, S₀(Hard) = 1.29 days, S₀(Good) = 2.31 days, S₀(Easy) = 8.30 days**. This 39× spread between Again and Easy initial stabilities is the leverage point that makes grade assignment consequential for scheduling.

**Stability after successful recall** (G ∈ {2, 3, 4}):

```
S'ᵣ(D, S, R, G) = S · (e^(w₈) · (11−D) · S^(−w₉) · (e^(w₁₀·(1−R)) − 1) · hard_penalty · easy_bonus + 1)
```

Where hard_penalty = w₁₅ if G=2, else 1; easy_bonus = w₁₆ if G=4, else 1. Three key properties govern the learning dynamics: higher difficulty → slower stability growth; higher existing stability → diminishing returns (saturation); **lower retrievability → greater stability gain** (the spacing effect — reviewing when you've almost forgotten yields the largest memory benefit).

**Stability after forgetting** (G = 1):

```
S'f(D, S, R) = w₁₁ · D^(−w₁₂) · ((S+1)^(w₁₃) − 1) · e^(w₁₄·(1−R))
```

Post-lapse stability is clamped: S_new = min(S'f, S), ensuring it never exceeds pre-lapse stability.

**Difficulty initialization and update** follows a three-step process. Initial difficulty D₀(G) = w₄ − e^(w₅·(G−1)) + 1, clamped to [1, 10]. Updates apply a linear damping term D' = D + ΔD·(10−D)/9 where ΔD = −w₆·(G−3), followed by weak mean reversion: D'' = w₇·D₀(4) + (1−w₇)·D'. With default w₇ ≈ 0.001, mean reversion is nearly absent.

**Same-day (short-term) stability** uses a separate formula new to FSRS-5 and refined in FSRS-6:

```
S'(S, G) = S · e^(w₁₇·(G−3+w₁₈)) · S^(−w₁₉)
```

Unlike the main formula, same-day reviews with Hard or Again *can* decrease stability. Good and Easy cannot.

---

## The ts-fsrs package exposes a clean four-grade API

The TypeScript implementation **ts-fsrs** (latest version ~5.2–5.3, MIT license) implements FSRS-6 with full type safety. The API surface is the contract PANaCEa's behavioral layer must target.

**The Rating enum and Grade type** are the critical interface:

```typescript
enum Rating { Manual = 0, Again = 1, Hard = 2, Good = 3, Easy = 4 }
type Grade = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;  // excludes Manual
const Grades: Readonly<Grade[]> = [1, 2, 3, 4];
```

**The Card interface** tracks all scheduling state:

```typescript
interface Card {
  due: Date;              // next review date
  stability: number;      // memory stability (days where R=90%)
  difficulty: number;     // card difficulty [1, 10]
  elapsed_days: number;   // days since last review
  scheduled_days: number; // scheduled interval
  reps: number;           // total review count
  lapses: number;         // times forgotten (Again count)
  state: State;           // New=0, Learning=1, Review=2, Relearning=3
  last_review?: Date;
  learning_steps: number; // v5.x: current (re)learning step
}
```

**The core scheduling flow** uses two methods. `repeat(card, now)` returns an `IPreview` mapping all four grades to their scheduling outcomes — the card's next state if rated Again, Hard, Good, or Easy. `next(card, now, grade)` applies a single grade and returns a `RecordLogItem` containing the updated card and a review log. The factory function `fsrs(params?)` creates a configured scheduler:

```typescript
const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 36500 });
const card = createEmptyCard();
const result = scheduler.next(card, new Date(), Rating.Good);
// result.card.due → next review date
// result.card.stability → updated stability
```

The FSRS class also exposes low-level algorithm methods directly: `init_stability(g)`, `init_difficulty(g)`, `next_recall_stability(d, s, r, g)`, `next_forget_stability(d, s, r)`, and `next_short_term_stability(s, g)` — useful for PANaCEa if it needs to compute grade effects before committing to a rating.

---

## Response time is a valid but fragile confidence proxy

The cognitive science literature strongly supports using response time as a learning signal, but with three critical constraints that PANaCEa must encode.

**Fast correct responses reliably indicate strong knowledge.** Ackerman and Koriat (2012, Psychonomic Bulletin & Review) confirmed that for knowledge questions, "answers retrieved quickly have a greater chance of being correct than those provided after a long memory search." Chen, Zhang, and Liu (2019, Frontiers in Psychology) found that retrieval RT and retrieval confidence **simultaneously and independently** mediate the relationship between judgments of learning and final accuracy. The fluency-confidence association is robust across domains.

**The RT-confidence link is accuracy-dependent.** A lifespan study (PMC9799236) found participants reported higher confidence after faster responses in correct trials only — not incorrect trials. Benjamin, Bjork, and Schwartz's seminal 1998 study in the Journal of Experimental Psychology: General demonstrated that retrieval fluency is a "potent but not necessarily reliable" metacognitive cue. Fast retrieval from semantic memory actually predicted *worse* subsequent recall, a counterintuitive finding that matters for spaced repetition: **fast-correct may reflect shallow retrieval rather than durable encoding in some contexts.**

**RT distributions are lognormal, not normal.** Van der Linden's (2006, Journal of Educational and Behavioral Statistics) lognormal model, validated on ASVAB-CAT data, showed that RT distributions exhibit characteristic right-skew that normal models cannot accommodate. This means **log-transforming RT before normalization** is the validated approach. The model uses person-level speed parameters and item-level time-intensity parameters — directly analogous to what PANaCEa would need (per-user baseline speed and per-question expected time).

**Fatigue degrades the RT signal progressively.** Sievertsen, Gino, and Piovesan (2016, PNAS) found that for every hour later in the day, standardized test performance decreased by **0.9% of a standard deviation**, with 20–30 minute breaks restoring **1.7% of a standard deviation**. The rapid-guessing literature (Wise & DeMars, 2006, Journal of Educational Measurement) identifies a critical threshold: responses below ~10% of mean item RT are classified as rapid guesses (non-effortful), showing accuracy near chance (25.5% for 4-option MC). Wise and Kingsbury (2016) document that rapid-guessing increases as assessments progress — a "decreasing effort" pattern that directly confounds RT-based confidence estimation in longer study sessions.

**Practical RT normalization for PANaCEa** should therefore: (1) log-transform raw RT, (2) z-score against per-user, per-question-type baselines, (3) apply a rapid-guess filter at ~10% of median item RT, and (4) apply session-position detrending to remove fatigue drift before interpreting RT as a confidence signal.

---

## FSRS optimizes log loss, not Brier score

A critical finding for PANaCEa's calibration layer: **the FSRS benchmark does not use Brier score**. The three metrics FSRS tracks are log loss (binary cross-entropy), a custom binned RMSE, and AUC. Log loss is the optimizer's objective function, computed as −(1/N) Σ [y·log(R) + (1−y)·log(1−R)] where y is binary recall outcome and R is predicted retrievability.

The custom RMSE(bins) metric bins reviews by interval length, review count, and lapse count, then computes squared error between average predicted and actual recall rates per bin, weighted by sample size. FSRS-6 with recency weighting achieves **log loss ≈ 0.337, RMSE(bins) ≈ 0.049, AUC ≈ 0.691** on 9,999 user collections (~350 million reviews). FSRS-6 shows **88.2% superiority** over FSRS-5 and **99.6% superiority** over SM-2 on these metrics.

The Brier score formula — BS = (1/N) Σ (yᵢ − p̂ᵢ)² — is a strictly proper scoring rule related to but distinct from log loss. Log loss penalizes confident wrong predictions far more heavily (approaching infinity as confidence approaches 1.0 on an incorrect prediction, versus a maximum of 1.0 for Brier score). For PANaCEa's validation pipeline, **log loss is the appropriate primary metric** for consistency with FSRS's own optimization target, with RMSE(bins) as a secondary calibration diagnostic. A 2025 paper (arXiv:2504.04906) warns that low Brier scores do not necessarily indicate good calibration — they are also influenced by outcome base rates.

AUC scores across all SRS algorithms are "rather unimpressive" at **0.65–0.75**, indicating that discriminating recalled from forgotten cards is inherently difficult. This sets realistic expectations for PANaCEa's grade prediction accuracy.

---

## Wilson score lower bound enables conservative mastery detection

The Wilson score lower bound provides a statistically principled mastery threshold that handles small sample sizes — essential for early-stage learners with few reviews per topic.

**The formula** (Wilson, 1927):

```
w⁻ = (1/(1 + z²/n)) · (p̂ + z²/(2n) − z·√(p̂(1−p̂)/n + z²/(4n²)))
```

Where p̂ = observed success proportion, n = total trials, z = z-score for desired confidence (1.96 for 95%, 1.645 for 90%). The lower bound is always in [0, 1], performs well with small samples and extreme proportions, and naturally penalizes items with few observations — preventing 5/5 correct from being treated identically to 50/50 correct.

**Recency-weighted Wilson scores** have no established standard formulation, but the validated approach uses Kish's effective sample size. Given observations x₁…xₙ with exponential decay weights wᵢ = λ^(n−i):

1. Weighted proportion: p̂_w = Σ(wᵢ·xᵢ) / Σwᵢ
2. Effective sample size: n_eff = (Σwᵢ)² / Σwᵢ²
3. Substitute p̂_w and n_eff into the Wilson formula

Olivier and May (2006) and Nawa (2022) provide theoretical justification for applying weights to score intervals via design-effect adjustment. The coverage properties may deviate from nominal confidence levels with aggressive decay rates or very small effective sample sizes, so **a conservative z-value (90% rather than 95%)** is advisable when combining with exponential recency weighting.

**Mastery thresholds** from the educational literature converge on **80–90% correct** for competency-based advancement (Bloom, 1968). Using Wilson lower bound, a practical implementation would require w⁻ ≥ 0.80 at 90% confidence, which means a student needs approximately 8/9 correct or 12/13 correct (depending on total n) to cross the threshold — much more demanding than a raw proportion check at small sample sizes.

---

## Answer-change patterns provide a 3:1 signal for knowledge quality

Research on answer-change behavior yields one of the most robust effect sizes in educational measurement, directly applicable to PANaCEa's behavioral layer.

**Wrong-to-right changes outnumber right-to-wrong by approximately 3:1** across dozens of studies spanning decades. A large-scale analysis of 26,323 initial answers found **62% of changes were wrong-to-right**, producing a **13.73% accuracy increase** among changed items (ScienceDirect, 2022). In medical education specifically, Bauer, Kopp, and Fischer (BMC Medical Education, 2007) found 55% WR, 25% RW, and 20% WW changes in high-stakes medical exams, with an average net gain of 1.1% per first change.

**Skill level modulates the signal.** Top-tier students change answers less frequently but more accurately (higher WR ratio). Bottom-tier students show elevated wrong-to-wrong change rates. Freshmen change answers 2.4× more frequently than seniors (6.95 vs 2.92 changes per student), suggesting metacognitive development. For PANaCEa, **a right-to-wrong change is a strong signal of weak knowledge** (suggesting the initially correct answer may have been lucky), while a wrong-to-right change indicates active metacognitive monitoring and partial knowledge recovery.

**Second and subsequent changes carry no positive signal.** Research consistently finds that only the first answer change improves scores; additional changes approach guessing probability. PANaCEa should therefore weight the first revision heavily and discount subsequent revisions.

**Streak effects are small but real in cognitive tasks.** A 2025 Stanford study of Jeopardy! data found contestants were **1–8% more likely to answer correctly during winning streaks**, but the effect faded after breaks, suggesting it reflects sustained focus rather than skill change. Confidence increases linearly during winning streaks and decreases linearly during losing streaks (PMC, 2015). However, learners systematically overestimate streak significance — the hot hand "belief" substantially exceeds the hot hand "reality." PANaCEa should use streak information conservatively: as a modifier (±0.5 grade levels at most) rather than a primary grade determinant.

**Confidence-based marking** (Gardner-Medwin, UCL, since 1994) provides a validated framework for integrating confidence with correctness. The CBM system uses a 3-point confidence scale (~50%, ~67%, ~80% sure) and penalizes high-confidence errors while rewarding high-confidence correct responses. Over 135,000 anonymous sessions at UCL demonstrate its reliability. A notable finding: **the worst self-evaluators are both the bottom and top achievers** (U-shaped calibration curve), with mid-range students showing the best metacognitive calibration.

---

## Conclusion: concrete implementation constraints for the grade-mapping layer

The research converges on several non-negotiable design constraints for PANaCEa's behavioral-to-FSRS-grade pipeline. FSRS-6 treats Again (1) as the sole failing grade, meaning the behavioral layer's most critical decision is the binary pass/fail threshold — not the fine-grained distinction between Hard, Good, and Easy. Initial stability varies **39× between Again and Easy**, making grade assignment highly consequential for scheduling.

Response time should be log-transformed and z-scored against per-user baselines before interpretation, with a rapid-guess filter at 10% of median item RT and session-position detrending. The RT-confidence link works only for correct responses. Answer-change patterns provide a surprisingly strong signal (3:1 WR:RW ratio) but only the first change is informative. Wilson score with Kish effective sample size enables recency-weighted mastery detection that respects small-sample uncertainty. FSRS's own optimizer targets log loss, not Brier score — PANaCEa's calibration pipeline should use the same metric for consistency. The ts-fsrs `next(card, date, grade)` function is the terminal API call, accepting exactly one of the four `Rating` enum values that the behavioral layer must produce.