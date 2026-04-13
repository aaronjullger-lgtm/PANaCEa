# Context-aware confidence and adaptive scheduling for medical education platforms

**PANaCEa's fully implicit FSRS v6 architecture can be transformed into a multi-dimensional mastery estimation engine by layering confidence-calibration models, behavioral telemetry fusion, knowledge-graph-aware scheduling, and predictive readiness scoring atop its existing DSR memory model.** This report synthesizes research across seven domains — from psychometric calibration to reinforcement learning — to provide specific mathematical formulations, algorithm architectures, and open-source implementations that extend spaced repetition far beyond binary correct/incorrect scheduling. The findings draw on peer-reviewed work from EDM, LAK, AIED, KDD, ICLR, and NeurIPS (2019–2026), alongside production systems like Math Academy's FIRe and Duolingo's Half-Life Regression. The core insight: FSRS v6's 21-parameter DSR model serves as an excellent per-card memory engine, but realizing PANaCEa's potential requires a meta-scheduler layer that fuses behavioral signals, models inter-concept relationships, and aggregates card-level states into clinically meaningful readiness estimates.

---

## 1. Confidence-accuracy calibration turns metacognition into a scheduling signal

### Confidence-weighted mastery estimation

Standard Bayesian Knowledge Tracing (BKT) updates mastery probability using only binary correctness through the classic Corbett & Anderson (1994) equations: P(Lₜ | correct) = P(Lₜ)·(1−P(S)) / [P(Lₜ)·(1−P(S)) + (1−P(Lₜ))·P(G)]. Extending this with a confidence signal c ∈ [0,1] creates a richer update where high confidence + correct strongly increases mastery estimates, while **high confidence + incorrect** flags dangerous miscalibration — the "competency danger zone" identified in Toronto emergency medicine studies using confidence-based assessment.

Recent models formalize this multi-dimensional approach. **KeenKT** (Li et al., 2025) represents mastery states as Normal-Inverse-Gaussian distributions with four parameters (μ, δ, α, β) capturing mean mastery, confidence, tail-heaviness, and skewness — achieving up to **5.85% AUC improvement** by disambiguating volatile behavioral outliers from genuine mastery shifts. **Dynamic LENS** (Christie et al., 2024) tracks knowledge as Gaussian distributions with posterior covariance, providing calibrated uncertainty quantification across time. The Uncertainty-Aware KT framework (Cheng et al., 2025) uses Monte Carlo Dropout for Bayesian neural KT, quantifying total uncertainty via Shannon entropy H = −Σ r̄ᵢ log r̄ᵢ, where higher uncertainty reliably co-occurs with incorrect predictions.

For FSRS v6 integration, confidence signals most naturally modulate the stability increase factor (SInc). The current formula SInc = e^w₈ · (11−D) · S^(−w₉) · (e^(w₁₀(1−R))−1) already differentiates by grade via w₁₅ (Hard penalty) and w₁₆ (Easy bonus). A continuous implicit confidence measure could interpolate between these: **SInc_adjusted = SInc · (1 + α · (confidence − 0.5))**, where α is a learned parameter, allowing behavioral confidence proxies to smoothly modulate scheduling without discrete rating buttons.

### Dunning-Kruger detection and correction

The Dunning-Kruger effect presents a specific calibration challenge in medical education. A study of **898 clinicians** (Springer, 2023) found consistent poor statistics proficiency combined with high confidence, even for incorrect answers. In high-fidelity simulations with 80 medical students (Advances in Physiology Education, 2022), faculty-scored accuracy ranged **23–74%** while self-assessed confidence ranged **71–86%** — systematic overconfidence of 15–50 percentage points.

A Bayesian rational model published in *Nature Human Behaviour* (Jansen et al.) explains DKE through two mechanisms: influence of prior beliefs about ability, and a correlation between performance and metacognitive sensitivity (the ability to determine correctness). This suggests a detection algorithm: compute per-learner calibration bias = (1/N) Σ(confidence − accuracy), and resolution via Goodman-Kruskal gamma. Learners with bias > threshold AND gamma < threshold exhibit the DKE pattern. Correction uses Platt scaling: calibrated_confidence = σ(a · raw_confidence + b), fitted on held-out data.

For PANaCEa's fully implicit system, DKE detection translates to identifying learners whose **fast response times systematically mispredict actual retention**. The system should track a rolling calibration metric: does fast response time actually predict correct recall at the next review? If the correlation breaks down for a specific learner, down-weight response time as a scheduling signal and increase review frequency despite behavioral indicators of confidence.

### When metacognitive judgments are (un)reliable

Judgment of Learning (JOL) research reveals critical asymmetries. The **delayed-JOL effect** (Rhodes & Tauber, 2011, meta-analysis) shows that metacognitive judgments made after a delay are substantially more accurate than immediate ones, because delayed JOLs rely on retrieval fluency rather than short-term memory availability. The **Underconfidence With Practice effect** (Koriat et al., 2002) demonstrates that repeated study leads to increasing underestimation of knowledge. Gender effects are also documented: males tend toward overconfidence, females toward underconfidence (Chiu & Klaasen, 2010).

For implicit measurement, this means behavioral signals collected during the recall attempt itself (not pre-study) will be more diagnostic. The system should weight behavioral signals from review sessions more heavily than from initial learning sessions, as JOL accuracy improves with practice.

### Calibration metrics that matter

The **Brier Score** BS = (1/N) Σ(pᵢ − yᵢ)² decomposes into three components: Reliability (calibration error), Resolution (discrimination ability), and Uncertainty (inherent difficulty). FSRS already implicitly optimizes a related metric — it minimizes log-loss between predicted retrievability R and actual binary outcomes. Extending to confidence-aware calibration, one can bin reviews by implicit confidence level (e.g., response time terciles), compute per-bin calibration curves, and use **Expected Calibration Error** ECE = Σ(|Bₘ|/n) · |acc(Bₘ) − conf(Bₘ)| to quantify how well implicit confidence tracks actual retention. Per-learner Brier decomposition identifies whether poor prediction stems from systematic bias (reliability) or inability to discriminate (resolution).

### Implicit versus explicit confidence measurement

The evidence on implicit versus explicit confidence measurement is nuanced. Response time is a validated confidence proxy — a study in *Frontiers in Education* (2024) found that for factual knowledge questions, students who knew the answer responded nearly **10× faster** (normalized RT of 0.03 vs. 0.28 for incorrect). The DynaViTE model (Rausch et al., 2024, *Computational Brain & Behavior*) formally demonstrates that confidence is negatively related to response time through evidence accumulation dynamics.

However, response time is less predictive for complex reasoning where slow responses may indicate deeper processing rather than lower confidence. A study in *eLife* (Frömer et al., 2021) found implicit behavioral signals and explicit confidence ratings capture **different aspects of metacognition** — implicitly learned biases affected decisions but did not influence decision confidence. Research from PISA assessments shows response time effort measures are less vulnerable to cultural differences and self-report limitations than verbalizations.

The optimal approach for PANaCEa combines multiple implicit signals into a composite confidence score:

- **Primary**: Response time normalized by item type and learner-specific baseline (z-score within learner's distribution)
- **Secondary**: Time-to-first-interaction, answer revision count, mid-response pauses
- **Validation**: Continuously track per-learner ECE between inferred ratings and actual future retention; fall back to conservative scheduling when implicit signals poorly predict outcomes

---

## 2. Multi-signal behavioral telemetry enables implicit mastery estimation

### Response time follows lognormal distributions with rich structure

Van der Linden's (2007, *Psychometrika*) hierarchical framework remains foundational. It models two levels: a response model (2PL IRT: P(X=1|θ) = Φ(a(θ−b))) and a response time model where log-response times are normally distributed: **ln(T_ij) = β_j − τ_i + ε_ij**, with ε ~ N(0, σ²). Person parameters θ (ability) and τ (speed) are jointly multivariate normal, with the covariance capturing the speed-accuracy tradeoff. The correlation between ability and speed is typically negative — faster students tend to be more able, but the relationship is nuanced.

Recent extensions include the three-parameter lognormal (Ranger, Kuhn & Ortner, 2020, *Educational & Psychological Measurement*) which adds a non-decision time threshold, bounding support away from zero — more realistic since cognitive processing demands a minimum time. Tang et al. (2025, *Behavior Research Methods*) proposed combining generalized IRT with log-normal RT models, including nonlinear speed-ability relationships.

For FSRS integration, the mapping is:

- **Fast + Correct** → High mastery (high θ, high τ) → FSRS "Easy"
- **Slow + Correct** → Moderate mastery with effort → "Good" or "Hard"
- **Fast + Incorrect** → Rapid guessing or slip → Flag as unreliable
- **Slow + Incorrect** → Genuine difficulty → "Again"

Log-transforming response times before analysis is essential. Normalize per-item to account for inherent time-intensity differences.

### Hesitation patterns encode uncertainty

Pause duration before answering is inversely related to confidence and knowledge (Ackerman & Zalmanov, 2012). Research on video learning environments (Yürüm et al., 2022, *Education and Information Technologies*) shows students who paused more and used slow backward navigation achieved better test performance — not all hesitation signals struggle. Baker et al. (LAK 2012) found that cumulative time-off-task matters for outcomes, but individual pause lengths do not significantly differentiate learning.

Extractable hesitation features for PANaCEa include: total response time (log-transformed), **time-to-first-action** (delay before any interaction), number of option selections/deselections before submission, dwell time on distractor versus correct options, and variance of response times across similar items (consistency indicates stable knowledge).

### Answer revision behavior reveals knowledge stability

The "first instinct fallacy" — that initial answers are best — is robustly debunked. Kruger, Wirtz & Miller (2005, *JPSP*) and a meta-analysis by Waddell & Blankenship (1994) of 75 studies found **57% of answer changes were incorrect→correct**, 21% correct→incorrect, and 22% incorrect→incorrect. Answer changing generally improves scores. Couchman et al. (2016, *Metacognition and Learning*) showed that revisions of low-confidence answers were more often correct than revisions of high-confidence answers. Castellano et al. (2022, *Cognition*) found that reporting confidence actually decreased revision frequency through a confirmation bias effect.

For FSRS rating inference: no revision + correct → "Easy"; revision wrong→right → "Good" (metacognitive monitoring working); revision right→wrong → "Again" or "Hard" (unstable knowledge); multiple revisions → "Hard" (high uncertainty).

### Multi-feature fusion architectures

**SAINT+** (Shin et al., LAK 2021) is the most directly relevant fusion model. Its encoder-decoder Transformer embeds response correctness alongside discretized elapsed time and lag time, achieving **1.25% AUC improvement** over SAINT on EdNet's 131M+ interactions. The key finding: temporal features contributed meaningfully when incorporated into the decoder rather than encoder.

**GCKT** (2025) uses a gated fusion mechanism to dynamically integrate exercise attributes, response correctness, response time, and hierarchical knowledge features. **DaTaKT** (2025, *Information Fusion*) employs a dual-attentional mechanism capturing relations from both temporal and question perspectives, achieving superior multi-step-ahead prediction. **Wide & Deep IRT** (JEDM, 2024) combines conventional IRT with deep learning using clickstream behavioral features, outperforming both traditional IRT and DKT while maintaining interpretability.

A practical fusion architecture for PANaCEa maps behavioral signals to continuous FSRS ratings:

```
M = σ(w₁·f(accuracy) + w₂·g(log_RT) + w₃·h(revision) + w₄·k(hesitation) + w₅·m(time_trend) + b)
```

Where M ∈ [0,1] maps to: M > 0.85 → "Easy", 0.60–0.85 → "Good", 0.35–0.60 → "Hard", M ≤ 0.35 → "Again". Each function normalizes its input: g() z-scores log-RT within item, h() encodes revision direction (+1 stable correct, −1 right→wrong), k() combines time-to-first-action and option change count.

---

## 3. Context-aware scheduling transcends isolated card performance

### Knowledge graphs enable implicit review compression

The most sophisticated production system for knowledge-graph-aware scheduling is **Fractional Implicit Repetition (FIRe)** by Justin Skycak (2023, Math Academy). FIRe distinguishes between prerequisite graphs (what you're ready to learn next) and **encompassing graphs** (how work on advanced topics should credit simpler ones). When a student successfully reviews "cardiac pharmacology," the encompassing graph awards fractional credit to "cardiac physiology," "drug mechanisms," and "autonomic nervous system" — effectively compressing multiple due reviews into one. Failed reviews propagate penalties upward through prerequisites: if you can't solve a complex clinical reasoning question, your mastery of underlying pathophysiology is called into question.

**Graph-based Knowledge Tracing (GKT)** by Nakagawa et al. (2019) reformulates KT as time-series node-level classification on a concept graph. When a student answers concept cᵢ, GKT aggregates neighboring node features, updates knowledge states for related concepts using MLP with erase-add gates, and outperforms DKT and DKVMN on ASSISTments. The learned graph structure reveals meaningful concept relationships without expert annotation.

**PSI-KT** (Zhou et al., ICLR 2024 Spotlight) jointly infers learner-specific cognitive traits AND prerequisite knowledge graph structure using a hierarchical probabilistic state-space model. It models Ebbinghaus-style temporal decay combined with prerequisite structure, learning the prerequisite graph from data alone while inferring **four learner-specific traits** per student. This is the strongest candidate for PANaCEa integration, as it bridges memory science and knowledge structure discovery.

For medical education, the integration approach is: build a medical knowledge graph (anatomy → physiology → pathology → pharmacology → clinical reasoning), assign encompassing weights between concept pairs, use FSRS v6 per-card scheduling as the base, then apply FIRe-style compression to reduce total review load.

### Semantic similarity determines whether to interleave or block

The interleaving effect has robust meta-analytic support. Brunmair & Richter (2019) found an overall effect size of **Hedges' g = 0.42** for interleaving versus blocking. Firth (2021, *Review of Education*) found the greatest benefit when differences between items are subtle — precisely the medical education scenario of distinguishing similar pathologies or drug classes. The mechanism is discriminative contrast: mixing similar items forces learners to notice distinguishing features.

However, the effect is **phase-dependent**. Early learning benefits from blocking (initial schema formation), while advanced learning benefits strongly from interleaving (differential diagnosis skills). The optimal strategy is initial blocking → later interleaving.

**KAR³L** (Shu, Balepur, Feng & Boyd-Graber, 2024) is the first content-aware flashcard scheduler. It uses BERT embeddings to retrieve semantically similar cards from a student's study history, then predicts P(recall) informed by performance on similar cards. An online RCT showed **improved testing throughput over FSRS**. Its delta-based teaching policy selects cards where predicted recall improvement over a time delta is maximized.

**Similarity-Weighted Interleaved Learning (SWIL)** (Flesch et al., 2022, *PNAS*) demonstrates in neural network continual learning that interleaving more exemplars from similar old classes when learning a new class produces faster learning with less interference — a principle directly applicable to scheduling similar medical concepts.

### Contextual bandits optimize what to study next

Lan & Baraniuk (2016, EDM) established the contextual bandits framework for personalized learning: student knowledge profile (estimated via SPARFA) serves as context, possible learning actions as arms, and assessment performance as reward. The LinUCB algorithm selects actions as a_t = argmax_a [θ̂ₐᵀxₜ + α√(xₜᵀAₐ⁻¹xₜ)], where the second term is the uncertainty bonus driving exploration. Belfer, Kochmar & Serban (2022, AIED) validated this approach in an RCT showing superior completion rates versus baselines.

**ZPDES** (Clément, Roy, Oudeyer & Lopes, 2015, *JEDM*) uses **learning progress** — the change in success rate rather than the success rate itself — as the bandit reward. This naturally targets the Zone of Proximal Development: activities providing the highest learning progress keep the learner at optimal challenge. Validated with 400 children across 11 schools, both ZPDES and RiARiT outperformed expert-designed sequences.

For PANaCEa, the context vector should include: FSRS card states (S, D, R), time of day, session fatigue, topic category, prerequisite mastery levels. Arms represent which card/topic to present next. Reward combines recall success with improvement in related concept mastery. The **hierarchical MAB** extension (arXiv:2408.07208, 2024) uses higher-level bandits to select concept areas and lower-level bandits to select specific problems within each area.

### Zone of Proximal Development from behavioral data

The ZPD can be operationalized through FSRS's retrievability. Items with R ≈ **0.85–0.90** are in the optimal recall zone (matching Wilson et al.'s "85% rule" for maximizing learning rate). Items with R much higher are too easy; items with R much lower need relearning rather than review. E-Gotsky (2019) deployed this approach in 8 schools, achieving **17% time savings** while maintaining learning outcomes through ZPD-targeted exercise selection.

Murray & Arroyo (2002, ITS) define ZPD for intelligent tutoring as the range where P(correct | no help) < threshold_upper AND P(correct | with scaffolding) > threshold_lower. Using IRT (SAGE Advance, 2024), individual ZPD boundaries are computed as ZPD_lower = θ (actual level) and ZPD_upper = θ + δ(θ) where δ depends on learning rate parameters.

---

## 4. Pattern recognition in learning data reveals hidden dynamics

### Learning curves follow power laws in aggregate but exponentials individually

The debate between power-law and exponential learning curves has been decisively clarified. Heathcote, Brown & Mewhort (2000, *Psychonomic Bulletin & Review*) demonstrated that the power law observed in averaged data is an **artifact of aggregation** — individual-level data is better fit by exponential functions. Murre & Chessa (2011) provided mathematical proof: when individual exponential curves have gamma-distributed learning rates, the average converges exactly to a power function via Laplace transform: p̄(t) = (1 + t/β)^(−α). This directly explains why FSRS chose a power-law forgetting curve — the platform serves many learners with heterogeneous rates.

**Piecewise Power Laws (PPL)** (Donner & Hardy, 2015, *Psychonomic Bulletin & Review*) capture **plateau and breakthrough transitions** by fitting k−1 transition points between k power-law pieces. Model selection via AIC/BIC determines optimal piece count; 2–3 pieces are most common. For PANaCEa, tracking per-knowledge-component accuracy over review count and fitting PPL models can detect when learners plateau (S stops increasing despite correct answers) versus break through (sudden S increases after plateau).

### Temporal patterns affect retention predictably

Circadian effects are well-documented. **Declarative learning acquisition is significantly higher in the morning** (Kvint et al., 2011), while motor performance peaks in late afternoon. The circadian trough (2–6 AM) shows maximum error vulnerability and increased intra-individual variability (Goel et al.). The synchrony effect means performance peaks when testing time matches chronotype.

Within-session fatigue can be modeled as P(correct)ᵢ = β₀ + β₁·positionᵢ, where a significantly negative β₁ indicates performance decline. An exponential decay variant P(correct)ᵢ = α·e^(−λ·positionᵢ) + floor captures the characteristic leveling-off. For PANaCEa, monitoring response time trends and accuracy slopes within sessions enables automatic session-termination suggestions when fatigue exceeds a threshold.

### Medical education has systematic error signatures

Graber, Franklin & Gordon (2005, *Archives of Internal Medicine*) found cognitive factors implicated in **74% of diagnostic errors**, with **premature closure** as the most common (65% of cognitive errors). Other prevalent biases include confirmation bias (21.2%), overconfidence (22.5%), availability bias (12.4%), and anchoring (11.4% per Kunitomo et al., 2022, *BMC Emergency Medicine*).

These biases have detectable behavioral signatures: premature closure manifests as consistently fast, high-confidence responses on complex multi-step diagnostic questions with incorrect answers; anchoring shows as maintained initial answers despite contradicting data in evolving clinical vignettes; availability bias produces elevated selection of recently-encountered rare diagnoses on unrelated cases (detectable via time-decay weighted frequency analysis).

### Slip and guess detection separates noise from signal

BKT's slip parameter P(S) (mastered but answers incorrectly) and guess parameter P(G) (unmastered but answers correctly) must satisfy the constraint 1 − P(S) ≥ P(G) for mastery to be informative. Baker, Corbett & Aleven (2008, ITS) showed that **contextual slip/guess estimation** — using features like time spent, hint requests, and recent history — significantly outperforms fixed-rate parameters. The 4PL IRT model extends this: P(correct|θ) = c + (u−c)/(1 + e^(−a(θ−b))), where c is guessing and u is (1 − slip) as the upper asymptote.

For FSRS integration: when a card with high Stability receives "Again" with very short response time → flag as potential slip rather than genuine forgetting; reduce the Difficulty penalty. When a card with low Stability receives "Easy" with very short response time → flag as potential guess; reduce the Stability increment. Baker's detection heuristic: flag slips when P(L) > 0.95 AND incorrect AND RT < expected_RT × 0.5.

### Anomaly detection catches gaming and disengagement

Gaming detection (Baker et al., 2004–2025) identifies behaviors like hint abuse (0.5–1 second intervals between sequential hints), systematic guessing (rapidly trying all options), and rapid answer copying. Random Forest classifiers using features including response time, hint requests, and action sequences achieve ~80% detection accuracy. Beck's (2005, AIED) IRT-based engagement model separates P(correct) into engaged and disengaged components, with response time as the strongest signal — very fast responses with poor accuracy indicate disengagement.

For PANaCEa: if review time falls below 2 SD of a card's historical mean → flag for gaming; if >60% of session responses are <2 seconds with random accuracy → flag the entire session. Longitudinal engagement tracking via Hidden Markov Models with 3 states (engaged, intermediate, disengaged) can identify "troubled" trajectories — Jovanović et al. (2021, *Computers & Education*) found **27.4% of students** follow such trajectories with early disengagement.

### Learner clustering reveals behavioral archetypes

Dynamic Time Warping + graph clustering (Perez Ortiz et al., 2019, *npj Science of Learning*) identifies clusters from distributed to massed learning, with massed learners significantly more likely to underperform. K-means on LMS behavioral features consistently reveals 3–6 clusters: high-engagement/distributed (best outcomes), moderate/strategic (adequate), low-engagement/massed (at-risk), and surface/passive (browse without interaction).

For FSRS-based clustering, relevant behavioral signatures include: review regularity (inter-review-interval coefficient of variation), average Difficulty across cards, average Stability growth rate, session duration patterns, and rating distribution proportions. Expected medical student archetypes: "consistent reviewers" (regular sessions, high retention), "crammers" (burst sessions near exams), "perfectionists" (very high desired retention, frequent reviews), "efficient learners" (optimal spacing), and "struggling learners" (high lapse rate, declining Stability).

---

## 5. Advanced scheduling algorithms offer complementary strengths to FSRS

### DASH trades state for history features

DASH (Lindsey, Shroyer, Pashler & Mozer, 2014, *Psychological Science*) uses additive logistic regression: **logit(P(correct)) = θ_student + θ_item + h(history)**, where h() summarizes previous attempts using time-window features. For windows W = {1/24 days, 1 day, 7 days, 30 days, ∞}, it counts successful and unsuccessful attempts within each window: h = Σ_w [β_w · count(attempts_w) + γ_w · count(wins_w)]. DAS3H (Choffin et al., 2019, EDM) extends DASH with per-skill learning/forgetting — the **seminal bridge paper** between knowledge tracing and spaced repetition traditions.

Unlike FSRS's stateful DSR model with recursive updates, DASH is stateless — recomputing recall probability from raw history each time. In the open-spaced-repetition benchmark, FSRS-6 consistently outperforms DASH on both log-loss and RMSE. However, DASH's explicit student ability parameter and time-window features could augment FSRS as auxiliary inputs.

### ACT-R provides spreading activation for inter-concept effects

The ACT-R memory model (Pavlik & Anderson, 2005, *Cognitive Science*) centers on base-level activation: **B_i(t) = ln(Σ_k (t − t_k)^(−d_k))**, where the critical innovation makes decay rate activation-dependent: d_k = c · e^(m_k) + α. This produces the spacing effect — massed practice yields high activation at each repetition, producing higher decay rates and faster forgetting; spaced practice produces lower activation, lower decay rates, and more durable memory.

Total activation includes spreading activation from context: **A_i(t) = B_i(t) + Σ_j W_j · S_ji + ε**. This models how learning about "cardiac physiology" activates related concepts like "ECG interpretation" — a capability FSRS entirely lacks. Recall probability: P(recall) = 1/(1 + e^(−(A−τ)/s)). The Adaptive Fact Learning system (Sense et al., 2016) demonstrates production viability, finding that an individual's rate of forgetting is stable over time but differs across materials.

For FSRS extension, ACT-R's spreading activation concept suggests adding a context term that adjusts predicted retrievability based on inter-card relationships: R_adjusted = R_base · (1 + Σ_related w_j · ΔR_j), where ΔR_j captures recent review activity on related cards.

### MCM models dual memory stores in continuous time

The Multiscale Context Model (Mozer, Pashler, Cepeda, Lindsey & Vul, 2009, *NeurIPS*) uses a double-exponential forgetting curve: **R(t) = a₁·e^(−λ₁·t) + a₂·e^(−λ₂·t)**, where λ₁ ≫ λ₂ represents fast (hippocampal) and slow (neocortical) memory stores. Tabibian et al. (2019, *PNAS*) formulate MCM using stochastic differential equations with jumps and find optimal review schedules by solving a Hamilton-Jacobi-Bellman equation. Murre & Dros (2015) found MCM's double-exponential fits forgetting data slightly better than power functions (AIC difference ~0.5).

MCM's dual-timescale concept suggests splitting FSRS stability into short-term and long-term components, with a consolidation term that gives a stability boost after sleep.

### Reinforcement learning optimizes globally but at high cost

**DRL-SRS** (Xiao & Wang, 2024, *Applied Sciences*) combines a Transformer-based Half-Life Regression (THLR) for recall estimation with a DQN+LSTM agent. State = (recall_prob, review_count, interval_history_embedding); action space = discrete intervals; reward = recall_success − λ·review_cost. **TADS** (Yang et al., 2020, *SIGIR*) uses Dyna-style planning combining model-based and model-free RL with Time-LSTM networks.

RL's advantage is global optimization — maximizing cumulative retention over sequences rather than FSRS's greedy/myopic single-interval decisions. But RL requires a simulator for training (possibly FSRS itself), significant compute, and careful reward engineering. The practical recommendation: use RL as a **meta-scheduler** atop FSRS, selecting which FSRS-scheduled cards to present given a daily time budget, while FSRS handles per-card memory state tracking.

### Extending FSRS v6 with behavioral features

FSRS v6's 21 parameters (w₀–w₂₀) provide clear extension points. The forgetting curve R(t,S) = (1 + factor·t/S)^(−w₂₀) where factor = 0.9^(−1/w₂₀) − 1 could gain response-time modulation:

- **w₂₁–w₂₂ for RT**: RT_factor = e^(w₂₁ · (log(RT) − w₂₂)), so S'ᵣ = S · SInc · RT_factor
- **w₂₃ for confidence**: S'ᵣ = S · SInc · (1 + w₂₃ · (confidence − 0.5))
- **Circadian modulation**: R_adjusted = R · (1 + w₂₄ · cos(2π·hour/24 + w₂₅))

However, the FSRS team (Expertium, Jarrett Ye) has found that auxiliary features like time-of-day and review time have not yet provided sufficient log-loss improvement to justify added complexity. Response time is noisy — affected by distractions, typing speed, card format, and interface latency. The recommendation: use RT as a **soft signal** with heavy regularization, applied only when signal-to-noise is high (within-session, relative to learner baseline, for recall-type cards).

| Feature | FSRS-6 | DASH | ACT-R | MCM | RL-based |
|---|---|---|---|---|---|
| Parameters | 21 | ~9–15 | 3–5 | 4–6 | Thousands |
| State model | S, D per card | Stateless | Activation | Dual-store | Learned |
| Forgetting curve | Power law | Logistic | Power law | Double exponential | Learned |
| Inter-concept modeling | None | None | Spreading activation | None | Emergent |
| Production readiness | Excellent | Moderate | Moderate | Low | Low |

---

## 6. Predictive models aggregate card-level data into exam readiness

### Multidimensional IRT estimates per-topic mastery

Multidimensional IRT (MIRT) models a vector of latent abilities θ = (θ₁, ..., θ_K) across K topics. The compensatory 2PL MIRT: **P(Y=1|θ) = 1/(1 + exp(−(aᵀθ + d)))**, where a is the item discrimination vector and d the intercept. Between-item MIRT constrains each item to load on exactly one dimension — natural for medical questions tagged to organ systems.

Person parameter estimation via Expected A Posteriori yields posterior distributions with standard deviations as confidence measures: θ̂_k^EAP ± 1.96·PSD_k. The `mirt` R package (Chalmers, 2012) handles 8+ dimensions reliably using MH-RM estimation (Cai, 2010). Minimum ~200 responses per dimension ensures stable estimation. For USMLE prep with ~20 organ systems, a confirmatory between-item model is tractable.

### Knowledge Space Theory reveals prerequisite structures

Doignon & Falmagne's (1985, 1999) Knowledge Space Theory defines a domain Q of concepts and a collection 𝒦 of feasible knowledge states (subsets of Q), closed under union. A surmise relation q ≤ t means mastery of t implies mastery of q. The **Inductive Item Tree Analysis (IITA)** algorithm (Sargin & Ünlü, 2009) learns prerequisites from response data by counting violations — instances where a student answers the advanced concept correctly but the prerequisite incorrectly — and minimizing the Discrepancy Index.

The **Fringe Theorem** automatically identifies the outer fringe: items the learner is ready to learn next. ALEKS (based on KST) uses ~350 concepts with Markov assessment procedures gauging state in 25–30 questions. For PANaCEa, initializing the surmise relation from medical curriculum prerequisite maps and refining with IITA from response data enables "what to learn next" recommendations grounded in both domain expertise and empirical evidence.

### Aggregating FSRS card-level data into domain readiness scores

The critical challenge: translating per-card FSRS retrievability into meaningful domain-level readiness with calibrated confidence intervals. Five methods offer increasing sophistication:

**Weighted Average Retrievability**: R_T = Σ(wᵢ · Rᵢ) / Σwᵢ, where weights reflect clinical importance or exam frequency. Simple but treats cards independently.

**Harmonic Mean Stability**: S_T = n / Σ(1/Sᵢ) — appropriate because the weakest cards dominate topic readiness, then R_T ≈ (1 + factor·t/S_T)^(−w₂₀).

**Beta-Binomial Model**: For n cards with k "mastered" (R > threshold), P(mastery) ~ Beta(α₀ + k, β₀ + n − k). The posterior mean (α₀ + k)/(α₀ + β₀ + n) with 95% credible intervals handles small sample sizes gracefully through prior shrinkage.

**Hierarchical Bayesian Model**: Cards nested within topics, topics within domains: μ_topic ~ N(μ_domain, σ²_topic). This naturally handles varying numbers of cards per topic, shrinks noisy estimates toward domain means, and produces calibrated intervals at each level.

**FSRS-Native Readiness**: Readiness = Π_T (R̄_T)^(α_T), where α_T weights topics by USMLE content distribution. The product form ensures all topics must be adequate — no compensation between strong and weak areas.

The recommended pipeline: FSRS provides per-card R, S, D → weighted average R per topic with Wilson score CIs → system-level average weighted by USMLE content blueprint → overall readiness with hierarchical Bayesian CIs → temporal projection using per-topic effective stability. Decision rules: "Exam Ready" = Readiness ≥ 0.85 with 95% CI lower bound ≥ 0.75.

### Early warning systems for at-risk learners

Course Signals (Arnold & Pistilli, 2012, LAK) pioneered EWS using LMS data. For FSRS-based platforms, key risk features include: **retrievability trajectory** (slope of average R), review compliance (% of due cards reviewed), difficulty distribution shift, lapse rate, topic coverage, and session regularity (entropy of inter-session intervals). KNN achieves 89% accuracy for predicting unsuccessful students (Akçapınar et al., 2019); models trained on week-3 data correctly identify ~74% of at-risk students. The critical insight: prediction alone is insufficient — must be paired with targeted intervention directing students to their weakest topics.

---

## 7. Open-source ecosystem provides building blocks for implementation

### Core FSRS repositories

The **open-spaced-repetition** GitHub organization maintains the definitive FSRS ecosystem: `fsrs-rs` (Rust, core implementation with training support), `py-fsrs` (Python), `ts-fsrs` (TypeScript), `fsrs4anki` (Anki integration), and `srs-benchmark` (algorithm comparison). The `awesome-fsrs` repository catalogs **50+ implementations** across Rust, Python, TypeScript, Go, Ruby, Swift, Dart, C/C++, Java, and Clojure. The `maimemo/SSP-MMC-Plus` repository provides the original IEEE TKDE paper implementation with 220 million memory behavior logs — the first open dataset with time-series information for spaced repetition.

A critical finding: **no existing repository extends FSRS with behavioral auxiliary features**. This represents a clear research gap and PANaCEa's opportunity for novel contribution.

### Knowledge tracing toolkits

**pyKT** (Liu et al., 2022, NeurIPS D&B) implements 20+ deep learning KT models including DKT, AKT, SAINT, simpleKT, LPKT, AT-DKT, and GKT — a critical benchmarking resource. **DKT-Forget** (Nagatani et al., 2019, WWW) demonstrates incorporating temporal features including inter-attempt intervals into neural KT. **AKT** (Ghosh, Heffernan & Lan, 2020, KDD) uses monotonic attention with exponential decay for context-aware KT. The **XES3G5M** dataset (NeurIPS 2023) shows that augmenting models with auxiliary information (text content, KC relations) improves AUC by **0.85–1.14%**.

### Knowledge graph and bandit implementations

**PSI-KT** (mlcolab/psi-kt, ICLR 2024 Spotlight) jointly infers prerequisite graph structure and learner cognitive traits — the strongest candidate for knowledge-graph-aware scheduling in PANaCEa. **adaptive-knowledge-graph** (MysterionRise) provides a Neo4j-based architecture combining knowledge graphs with BKT/IRT tracking. **hierarchical-mab-tutoring** (b-castleman) implements hierarchical multi-armed bandits for concurrent concept/problem tutoring using BKT, evaluated with 1500 simulated students. **OATutor** (CAHLR, CHI 2023) offers a production-ready adaptive tutoring system with pluggable selection heuristics.

### Key bridging papers

- **DAS3H** (Choffin et al., 2019, EDM): First model jointly accounting for memory decay and multiple skill relationships for SR scheduling
- **KAR³L** (Shu et al., 2024): First content-aware flashcard scheduler using BERT embeddings, outperforming FSRS in an online RCT
- **LECTOR** (Zhao, 2025): LLM-enhanced SR using semantic confusion matrices, achieving 90.2% success rate versus 88.4% for SSP-MMC
- **Half-Life Regression** (Settles & Meeder, 2016, ACL): Foundation for FSRS, modeling half-life as a function of features including correct/incorrect counts

---

## Conclusion: a layered architecture for PANaCEa

The research converges on a six-layer architecture that preserves FSRS v6's proven per-card scheduling while adding the intelligence PANaCEa requires.

**Layer 1 — Card memory**: FSRS v6 maintains per-card (S, D, R) states. Behavioral telemetry (response time, hesitation, revision patterns) maps to continuous implicit ratings via a trained fusion model, replacing discrete button presses.

**Layer 2 — Confidence calibration**: Per-learner ECE tracking validates that implicit signals predict actual retention. Dunning-Kruger detection flags learners whose fast responses systematically mispredict outcomes, triggering conservative scheduling overrides.

**Layer 3 — Knowledge graph**: Medical concept graph with prerequisite and encompassing edges, initialized from curriculum maps and refined via IITA from response data. FIRe-style credit/penalty propagation after each review compresses redundant reviews. PSI-KT or GKT infers missing prerequisite relationships.

**Layer 4 — Meta-scheduler**: Contextual bandit (LinUCB or Thompson Sampling) selects which card to present next given context = (student mastery profile, session fatigue, time of day, cluster health, prerequisite satisfaction). ZPDES-style learning progress as reward targets the ZPD automatically.

**Layer 5 — Pattern detection**: Learning curve analysis (PPL fitting, change-point detection), temporal pattern monitoring (circadian, fatigue), error pattern classification (bias signatures), slip/guess detection, anomaly detection (gaming, disengagement), and learner clustering run continuously on the behavioral stream.

**Layer 6 — Readiness estimation**: Hierarchical Bayesian aggregation from card-level R → topic-level mastery → organ-system readiness → overall exam preparedness, with calibrated confidence intervals at each level. Forward-projected decay curves estimate readiness at any future exam date. Early warning triggers when risk scores exceed thresholds.

Three novel contributions emerge from this synthesis. First, the finding that **no FSRS extension currently incorporates behavioral auxiliary features** positions PANaCEa to make a genuine contribution to the open-spaced-repetition ecosystem. Second, the combination of FIRe-style encompassing graphs with FSRS per-card scheduling has never been implemented for medical education, yet the efficiency gains from implicit review compression could be transformative for the 10,000+ card collections typical of board exam preparation. Third, the integration of contextual bandits as a meta-scheduler atop FSRS — using knowledge graph topology, ZPD estimation, and semantic similarity as context features — represents an architecture not present in any existing system, yet each component has individually demonstrated efficacy in peer-reviewed research.