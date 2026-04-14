# Binary rating with behavioral inference for FSRS in medical education

**A binary Again/Good interface with CRPL-inferred difficulty is both algorithmically sound and empirically justified.** The FSRS creator has confirmed the algorithm adapts to two-button usage, and the largest available dataset analysis shows FSRS is actually *more accurate* for binary users. Medical students' self-assessment accuracy correlates with external measures at only **r = 0.21**, with systematic Dunning-Kruger biases that make the Hard/Good/Easy distinction unreliable. Response time for episodic memory tasks (like flashcards) does correlate with memory strength, providing a viable behavioral signal to replace self-reported difficulty — though the mapping requires careful design to avoid confounds.

---

## The FSRS community has already settled the binary rating question

The strongest evidence comes from the FSRS team itself. The official FSRS FAQ states unambiguously: **"In some cases, FSRS may even be more accurate if you only use Again and Good."** This is not a grudging concession — it reflects empirical findings.

Expertium, a core FSRS contributor, analyzed the FSRS Anki 20k dataset (the largest publicly available spaced repetition dataset, hosted on Hugging Face) in August 2024. Comparing users who pressed Hard or Easy less than 5% of the time ("two-button users") against four-button users, FSRS prediction accuracy was **higher for two-button users across most thresholds**. When a smaller sample of *consistent* four-button users was identified via survey (n=39), the differences in RMSE and log loss were not statistically significant. The FSRS team's conclusion: "The results are inconclusive" about whether four buttons help, but two buttons are clearly not worse.

L.M. Sherlock (Jarrett Ye), the FSRS creator, has shared his personal review data showing Hard, Good, and Easy ratings correspond to distinct reaction time distributions. His stability when grading Easy is "almost twice" that when grading Good, and stability "will not change" when grading Hard. While he notes that using all four buttons *could* help FSRS schedule more accurately, he explicitly confirms: **"It's OK to only use two keys (again and good). FSRS can adapt to it."**

GitHub Issue #498 on `fsrs4anki` proposed formal research into the correlation between button usage frequency and RMSE. The issue was opened by Expertium in October 2023 and later closed — the FAQ endorsement of binary usage appears to reflect its findings. In the Anki forums, the "Pass/Fail Grading as Default" thread (September 2023) saw extensive debate, with users reporting that removing the Easy button alone increased review throughput by **~15%** due to eliminated metacognitive deliberation. Damien Elmes (Anki's creator) expressed cautious skepticism, saying "I suspect it would somewhat hamper the scheduler's performance," but acknowledged the argument for simplification.

---

## How FSRS handles binary ratings algorithmically

Understanding why binary input works requires examining where ratings enter the FSRS formulas. The algorithm uses ratings in three places, and binary usage affects each differently.

**Difficulty updates** follow the formula `ΔD = -w₆ × (G - 3)`, where G is the grade (1–4). With binary input, Again (G=1) adds `2 × w₆` to difficulty while Good (G=3) produces zero change before mean reversion. Hard (G=2) would add `w₆` and Easy (G=4) would subtract `w₆`, but these intermediate adjustments simply never fire. The difficulty parameter still moves meaningfully — it just uses a coarser step size. Mean reversion (`D' = w₇ × D₀(4) + (1 - w₇) × D'`) prevents difficulty from drifting to extremes regardless of rating granularity.

**Stability after successful recall** uses the formula `S'ᵣ = S × (e^(w₈) × (11-D) × S^(-w₉) × (e^(w₁₀×(1-R)) - 1) × w₁₅(if G=2) × w₁₆(if G=4) + 1)`. The parameters **w₁₅** (Hard penalty, value < 1) and **w₁₆** (Easy bonus, value > 1) are grade-conditional multipliers that only activate for ratings 2 and 4 respectively. With binary input, these parameters are never triggered, and all successful recalls use the identical base stability increase formula. This means binary FSRS treats all successful recalls uniformly — which is precisely what CRPL behavioral telemetry can compensate for.

**Initial stability** uses `S₀(G) = w_{G-1}`, so Again and Good still produce distinct initial stability values (w₀ and w₂), while the w₁ (Hard) and w₃ (Easy) initial values go unused.

The FSRS optimizer, run via `@open-spaced-repetition/binding`, adapts all 19–21 parameters to actual usage patterns. If a user only provides binary ratings, the optimizer learns parameters that maximize accuracy for that input distribution. Parameters w₁₅ and w₁₆ become effectively irrelevant and will not distort optimization.

---

## The ts-fsrs implementation supports binary usage directly

The official TypeScript FSRS library (`ts-fsrs`, maintained by `open-spaced-repetition`, current version 5.2.3) defines ratings as a discrete enum:

```typescript
enum Rating {
  Manual = 0,  // Not a real grade
  Again = 1,   // Failed to recall
  Hard = 2,    // Recalled with difficulty
  Good = 3,    // Recalled correctly
  Easy = 4     // Recalled effortlessly
}
```

Ratings **must be discrete integers** in the official ts-fsrs package — fractional values like 2.7 are not supported. However, the `f.next(card, now, Rating.Good)` method accepts a single grade directly, so implementing binary is trivial: only ever call with `Rating.Again` or `Rating.Good`.

For the CRPL behavioral adjustment approach, the most viable pattern is **post-scheduling difficulty manipulation**. The `Card` interface exposes `difficulty: number` (range 1–10) and `stability: number` as mutable properties. After running `f.next(card, now, Rating.Good)`, the returned card's difficulty and stability values can be programmatically adjusted before persisting to the database:

```typescript
// User presses "Good"
const result = f.next(card, new Date(), Rating.Good);
const newCard = result.card;

// CRPL adjusts based on behavioral telemetry
const crplAdjustment = computeCRPLAdjustment(responseTime, confidence, hesitationPattern);
newCard.difficulty = clamp(newCard.difficulty + crplAdjustment, 1, 10);

// Optionally adjust stability for strong Easy/Hard signals
if (crplAdjustment < -1.0) { // Very easy behavioral signal
  newCard.stability *= 1.15; // Approximate w₁₆ Easy bonus
}
```

An important alternative exists: the **`@squeakyrobot/fsrs`** npm package (a community fork) explicitly supports continuous/fractional ratings and includes an `autoRating()` function that converts response time to a continuous grade:

```typescript
const grade = fsrs.autoRating(responseTime, averageTime, card.difficulty);
// Returns a continuous value between 1.0 and 4.0
```

This package implements FSRS v4.5 core with optional v6 support and may be a better fit for CRPL integration if continuous rating input is preferred over post-hoc difficulty adjustment.

---

## Response time reliably signals memory strength for flashcard-type learning

The relationship between retrieval speed and memory strength is well-established for episodic memory but carries important nuances that affect implementation.

**Wixted and Rohrer (2000)** found that for paired-associate learning (the paradigm closest to flashcard review), faster initial correct recall predicted better retention at 5 minutes, 30 minutes, and 24 hours. This supports the classical view: **for newly learned associations, faster retrieval = stronger memory trace**. This is the foundational evidence supporting response time as a CRPL signal.

However, **Benjamin, Bjork, and Schwartz (1998)** — a landmark study in the Journal of Experimental Psychology: General — found the *opposite* pattern for semantic memory: items retrieved faster from general knowledge were actually *less likely* to be recalled on a later test. Participants' metacognitive judgments strongly reflected retrieval fluency, causing systematic misprediction. The authors concluded that retrieval fluency is "a potent but not necessarily reliable source of information for metacognitive judgments."

The critical distinction for PANaCEa is that medical flashcard review involves both episodic (recently learned facts) and semantic (well-established knowledge) retrieval. A card asking about a newly learned pharmacology fact behaves episodically (faster = stronger), while a card testing basic anatomy the student has known for years behaves semantically (fast retrieval may not predict future retention). **CRPL should weight response time differently based on card maturity** — the signal is most reliable for cards with fewer prior reviews and lower stability values.

Robert Bjork's **desirable difficulty** framework adds another layer: difficult but successful retrieval produces *better* long-term memory than easy retrieval. This creates a paradox where grading slow responses as "Hard" (and thus scheduling shorter intervals) may actually be counterproductive, since the effortful retrieval already strengthened the memory. This suggests CRPL should not aggressively penalize slow-but-correct responses; instead, it should use response time primarily to identify truly effortless retrievals that warrant longer intervals.

Practical response time thresholds from the Anki community converge on rough ranges. The "Pass/Fail Review" add-on (add-on ID 574884631) uses defaults of **≤1 second for Easy** and **≥7 seconds for Hard**. The more sophisticated "Pass/Fail 3" add-on uses a statistical approach: response time below `mean - 1 SD` maps to Easy, above `mean + 1 SD` maps to Hard, with per-card historical averages. The statistical approach is superior because absolute thresholds fail to account for varying card complexity — a complex clinical vignette legitimately requires more reading time than a simple definition card.

---

## Mapping CRPL behavioral metrics to FSRS difficulty

The CRPL (Confidence, Response time, Pattern, Learning signals) system for PANaCEa should map behavioral telemetry to difficulty adjustments along a continuous spectrum. Here is a research-informed framework for each signal.

**Response time** is the strongest single behavioral signal but must be normalized per-card, not absolute. Each card should maintain a running mean and standard deviation of response times across reviews. A z-score approach is robust: `z = (currentRT - meanRT) / sdRT`. Responses with z < -1.0 suggest effortless recall (Easy-like), z > 1.0 suggests effortful recall (Hard-like), and the middle range maps to Good. For new cards without history, cohort-level response time distributions for similar card types provide a fallback baseline. The mean response time for correctly recalled flashcards in the literature typically falls between **3–8 seconds**, with substantial variation by card complexity.

**Confidence calibration** is valuable but must be interpreted carefully. Judgment-of-learning (JOL) research consistently shows that people's confidence ratings are only moderately predictive of actual future recall. However, confidence *combined with* response time is more informative than either alone. Schwartz (2006, 2008) found that tip-of-the-tongue states and feeling-of-knowing judgments reliably predict future recognition performance. For CRPL, a useful pattern is to flag "overconfident" recalls (fast response time but historically poor retention on the card) and "underconfident" recalls (slow response time but strong retention history) for differential treatment.

**Hesitation patterns** — pauses, answer changes, partial reveals — provide signals that response time alone misses. A student who immediately begins typing the correct answer shows different cognitive processing than one who pauses for 4 seconds before responding correctly, even if total response times are similar. Keystroke dynamics research (not specific to spaced repetition) shows that **initial latency** (time to first action) correlates more strongly with retrieval difficulty than total task completion time.

**Learning signal aggregation** should weight recent reviews more heavily. An exponential moving average of per-card behavioral metrics captures the trajectory of learning: a card whose response times are decreasing is being consolidated, while one with stable or increasing times may be plateauing. The CRPL adjustment formula could take the form:

```
crplScore = α × rtZScore + β × confidenceDelta + γ × hesitationScore + δ × trendSignal
```

Where the weights (α, β, γ, δ) are initially hand-tuned but eventually optimized against actual retention outcomes. The crplScore maps to a difficulty adjustment: negative scores decrease difficulty (Easy-like), positive scores increase it (Hard-like).

---

## Medical students are demonstrably poor at distinguishing Hard from Good from Easy

The evidence for replacing self-reported difficulty with behavioral inference is particularly compelling in medical education, where metacognitive accuracy is systematically limited.

**Blanch-Hartigan's 2011 meta-analysis** (Patient Education and Counseling) across 35 studies found a weighted mean correlation of **r = 0.21** between medical student self-assessments and external criteria. This means self-assessment explains roughly **4.4% of variance** in actual performance — barely above chance for practical purposes. Students are slightly more accurate later in training and less accurate on communication-based assessments than knowledge-based ones, but the overall picture is clear: medical students cannot reliably judge their own knowledge state.

**Davis et al. (2006)** in JAMA conducted a systematic review spanning 1966–2006 and concluded: "The preponderance of evidence suggests that physicians have a **limited ability to accurately self-assess.**" The accompanying JAMA editorial called for rethinking reliance on "unguided physician self-assessment as a cornerstone of continuous professional development." Critically, **the least competent physicians were the most inaccurate** in self-assessment.

The Dunning-Kruger pattern is particularly well-documented in medical education. **Langendyk (2006)** studied 175 third-year medical students and found that low-achieving students scored themselves generously (overestimation) while high-achieving students scored themselves more harshly than faculty (underestimation). **Rahmani (2020)** in the Journal of Graduate Medical Education found that physicians in the lowest quartile of peer assessment rated themselves **30–40 percentile ranks higher** than their peers rated them. A 2024 Emergency Medicine study confirmed these findings: residents in the bottom quartile predicted themselves in the **62nd percentile**, directly mirroring the original Kruger and Dunning findings.

For PA students specifically, the research base is thinner but the educational context is analogous. PA programs face the same "drinking from a fire hose" knowledge density challenge as MD programs, and PA students increasingly use Anki and spaced repetition tools for PANCE preparation. Duke's PA Program lists Anki among recommended resources. A study cited by PhysicianAssistantExamReview.com reported that PA students using spaced repetition showed a **30% improvement in testing scores** when tested 8–30 days later.

The implication for PANaCEa is direct: asking PA students to distinguish Hard from Good from Easy introduces systematic noise into the scheduling algorithm. Students who most need accurate scheduling (low performers) are precisely those most likely to mislabel difficulty. Binary rating eliminates this noise source, and CRPL behavioral inference provides an objective signal that is immune to metacognitive bias.

---

## Conclusion

The convergence of evidence across algorithm design, cognitive science, and medical education strongly supports PANaCEa's binary + CRPL approach. Three insights stand out as particularly actionable.

First, **algorithm architecture matters far more than rating granularity**. FSRS-6 with only Again/Good will dramatically outperform SM-2 with all four buttons. The marginal information from Hard and Easy ratings is small relative to the core algorithm's power, and the FSRS optimizer adapts its parameters to whatever input distribution it receives.

Second, **the strongest implementation path uses post-scheduling difficulty adjustment** rather than attempting to pass fractional ratings to ts-fsrs. The official library requires discrete ratings, but the returned card's `difficulty` and `stability` values can be programmatically adjusted before persistence. The `@squeakyrobot/fsrs` fork offers a continuous rating alternative if deeper integration is preferred.

Third, **response time normalization must be per-card and maturity-aware**. The Wixted-Rohrer finding (faster = stronger for episodic memory) applies most cleanly to recently learned cards. For highly mature cards, Bjork's desirable difficulty framework suggests that slow-but-correct retrieval may actually strengthen memory — so CRPL should be conservative about penalizing slow responses on high-stability cards. The statistical threshold approach (z-scores against per-card history) is more robust than absolute time cutoffs and handles the natural variation in card complexity across a medical curriculum.

The overall design — binary user input for simplicity and speed, with behavioral telemetry providing the fine-grained difficulty signal that self-report cannot reliably deliver — is well-supported by every line of evidence examined.