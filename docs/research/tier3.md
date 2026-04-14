# Six experimental features for PANaCEa: research and implementation plan

PANaCEa's Tier 3 feature roadmap represents a genuinely ambitious integration of learning science with modern AI infrastructure. Across all six proposed features, the research reveals a consistent pattern: strong theoretical foundations exist in cognitive psychology, practical implementations are emerging in adjacent domains, and the FSRS v6 algorithm provides unusually rich learner-state data that most educational apps lack. The most immediately impactful features are the Socratic ZPD tutor and fatigue detection (both leverage existing infrastructure with moderate effort), while the pedagogically fine-tuned LLM and semantic confusion detection represent deeper technical investments with the highest long-term payoff. What follows is a feature-by-feature synthesis of evidence, architecture, and implementation strategy.

---

## 1. AI-generated visual mnemonics for leech cards

### The evidence base is solid but effect sizes are moderate

Allan Paivio's dual coding theory — that memory is enhanced when information is encoded both verbally and visually — has accumulated decades of support. A 2021 meta-analysis of the method of loci (a related visual mnemonic technique) across 13 RCTs found a **medium effect size of g = 0.65** (95% CI [0.45, 0.85]). In medical education specifically, Meenu et al. (2022) found that first-year medical students using mnemonics scored **8.4 ± 0.24 vs. 4.8 ± 0.37** for controls (p < 0.0001). A 2024 BMC Health Services Research meta-analysis of 28 studies (5,347 participants) confirmed that visual-based interventions are the most effective modality for enhancing comprehension of health-related material.

The critical nuance: generic images do not help. The mnemonic must create a meaningful, memorable association between the visual and the concept. A 2025 JMIR Medical Education tutorial paper describes a framework for AI-generated medical mnemonics using GPT-4 + DALL-E 3, reporting that **2–5 minutes per concept with 1–3 iterations** produces optimal results. This establishes that prompt engineering for medical mnemonics is a solved problem at the individual level — the challenge is automating it.

### Leech detection maps cleanly onto FSRS parameters

Anki's leech detection uses a simple heuristic: a card is flagged after **8 lapses** (configurable), with subsequent warnings at half-threshold intervals. In FSRS v6, leech identification can be considerably more sophisticated. A card is a leech candidate when it exhibits high difficulty (D approaching 10), low stability after multiple reviews (S failing to grow despite reviews), and repeated lapses resetting stability via the post-lapse formula S'_f = w11 × D^(−w12) × ((S+1)^w13 − 1) × e^(w14×(1−R)). The query is straightforward in Prisma: cards where `lapseCount > threshold AND stability < stabilityFloor AND reviewCount > minimumReviews`.

### Existing tools validate the architecture

Two GitHub projects demonstrate the pipeline end-to-end. **AnkiAIUtils** (thiswillbeyourgithub) is a comprehensive suite tested through medical school that generates explanations, mnemonics, and illustrations for failed cards using LiteLLM. **anki-mnemonic-imagegen** (aamin-labs) implements a two-step process — an LLM designs the mnemonic concept and crafts an image prompt, then an image model generates the PNG. Both projects confirm that the pipeline works and that the two-step approach (concept design → image generation) produces better results than direct image generation.

### Technical implementation approach

**Image generation API selection:** Gemini's Imagen 3 or GPT Image 1 Mini ($0.005/image at low quality) are the most cost-effective options. At $0.005/image, processing 500 leech cards costs roughly **$2.50**. DALL-E 3 at $0.04/image serves as a higher-quality fallback. All APIs have content policies around medical imagery, but educational mnemonics (cartoon-style associations, not clinical photos) fall well within acceptable use.

**Architecture:** A Cloudflare Pages Function receives the leech card content, calls Gemini to generate a mnemonic concept and image prompt (step 1), then calls the image generation API (step 2). Generated images are stored in **Cloudflare R2** (zero egress fees, 10 GB free tier) with keys structured as `mnemonics/{userId}/{cardId}.png`. The React component overlays the mnemonic on the card's back side with a toggle for show/hide. After mnemonic attachment, the card's FSRS parameters should **not** be reset — instead, track pre/post-mnemonic stability growth rates to measure effectiveness.

| Dimension | Assessment |
|---|---|
| Implementation complexity | Medium |
| External dependencies | Image generation API (Gemini Imagen or DALL-E), Cloudflare R2 |
| Privacy considerations | Low — generated images are not personal data; card content is sent to API |
| A/B testing approach | Compare stability growth curves for leech cards with vs. without mnemonics |
| Suggested priority | Phase 2 — after core SRS features are stable |

---

## 2. Socratic questioning calibrated to the zone of proximal development

### ZPD has been operationalized for intelligent tutoring systems

Vygotsky's Zone of Proximal Development — the space between what a learner can do alone and what they can do with guidance — has been computationally operationalized in several ways. Murray and Arroyo (2002) proposed the **Statistical ZPD (SZPD)**: students are in their ZPD when they succeed **50–80% of the time** with current scaffolding. Chounta et al. (2017, Carnegie Mellon) refined this with the "Grey Area" model, defining ZPD as the region where a predictive model cannot confidently predict whether the student will answer correctly without support. A 2024 machine learning approach using XGBoost achieved AUC of **0.83 for predicting "above ZPD"** and 0.79 for "below ZPD."

The key insight for PANaCEa is that FSRS already provides the inputs needed for ZPD estimation. **Retrievability (R)** directly maps to predicted success probability. Cards with R between ~0.4–0.75 are in the ZPD — challenging enough to require effort but not so forgotten that scaffolding cannot bridge the gap. Cards with R > 0.9 are mastered (above ZPD), and cards with R < 0.3 combined with high D may be below ZPD, requiring prerequisite review rather than Socratic questioning.

### Paul and Elder's taxonomy provides the question framework

The Paul and Elder (2006/2007) taxonomy defines six types of Socratic questions that map naturally to different learner states: clarification questions ("What do you mean by...?"), assumption-probing ("What are you assuming?"), evidence-probing ("What evidence supports that?"), perspective questions ("What's an alternative view?"), implication questions ("If that's true, what follows?"), and meta-questions ("Why is this question important?"). For PANaCEa, these map to FSRS states as follows: low R → clarification and assumption questions (rebuild foundations), medium R → evidence and perspective questions (strengthen connections), high R → implication and meta-questions (deepen understanding).

### LearnLM provides a production-ready pedagogical layer

Google's LearnLM — now infused directly into Gemini 2.5 and 3.1 — was preferred over GPT-4o in **82% of blind comparisons** by 189 educators across 2,666 interactions. It encodes five principles: managing cognitive load, inspiring active learning, deepening metacognition, stimulating curiosity, and adapting to the learner. Critically, LearnLM capabilities are accessible through the standard Gemini API with system instructions using the **PARTS framework** (Persona, Act, Recipient, Theme, Structure) — no fine-tuning required.

The Eedi randomized controlled trial found that students using LearnLM tutoring were **5.5 percentage points more likely to solve novel problems**, with only 0.1% of messages containing factual errors.

### Implementation design

The system prompt should incorporate the student's FSRS state for the current card:

```
You are a medical education tutor for PA students. The student is reviewing 
a card about [topic]. Their current recall probability is [R], card difficulty 
is [D], and they have reviewed this [n] times with [lapses] lapses.

Based on their knowledge state:
- If R < 0.4: Use clarification questions, provide scaffolding hints
- If 0.4 ≤ R < 0.75: Use evidence-probing and perspective questions  
- If R ≥ 0.75: Challenge with implication and application questions

Never give the answer directly. Guide through Socratic questioning.
```

Progressive hint implementation uses a 4-step escalation: (1) open-ended Socratic question, (2) narrowing question with a constraint, (3) partial answer with fill-in-the-blank, (4) full explanation with clinical context. Conversation state is managed in React via `useReducer` with the hint level tracked per interaction. Gemini 2.5 Flash at **$0.30/1M input tokens** makes this affordable — a 10-turn tutoring session costs approximately **$0.006**.

| Dimension | Assessment |
|---|---|
| Implementation complexity | Medium-High |
| External dependencies | Gemini API (LearnLM system instructions) |
| Privacy considerations | Card content and performance data sent to Gemini — anonymize user IDs |
| A/B testing approach | Compare FSRS stability growth for cards where Socratic tutoring was used vs. standard review |
| Suggested priority | **Phase 1 — highest impact, leverages existing Gemini integration** |

---

## 3. Semantic confusion detection between commonly confused terms

### LECTOR validates the core concept with measurable gains

The LECTOR system (LLM-Enhanced Concept-based Test-Oriented Repetition), published as arXiv:2508.03275 in August 2025, is the most directly relevant prior work. LECTOR builds a **semantic similarity matrix** where S[i,j] captures pairwise relationships between concepts using LLM-powered similarity assessment, then extends the classical forgetting curve to incorporate semantic interference effects. In simulations with 100 learners over 100 days, LECTOR achieved a **90.2% success rate** versus FSRS at 89.6% and SM-2 at 47.1%. The improvement over FSRS is modest but the architecture is sound — the real value is in identifying and surfacing confusion pairs.

### Medical term confusion is a patient safety issue with established databases

Look-Alike Sound-Alike (LASA) medication errors contribute to up to **25% of all reported medication errors** according to ISMP data. Classic confusion pairs include hydrALAzine/hydrOXYzine, DOBUTamine/DOPamine, and morphine/HYDROmorphone. The WHO has published extensive LASA pair databases. For PANCE preparation, confusion extends beyond medications to conditions (Cushing's syndrome vs. disease, systolic vs. diastolic heart failure), anatomical structures, and lab value interpretations. This is not a theoretical problem — it is a well-documented cause of clinical errors.

### Two complementary detection approaches

**Embedding-based detection** uses Gemini's text embedding API or specialized medical embeddings (BioSentVec, PubMedBERT) to compute cosine similarity between card contents. Card pairs with similarity above a threshold (e.g., > 0.85) are flagged as potential confusion pairs. This bootstraps the confusion graph before user data accumulates.

**Co-failure mining** from FSRS review logs identifies empirical confusion pairs: when a student fails Card A and subsequently fails Card B within the same session or short time window, the co-failure is logged. Association rule mining (support, confidence, lift metrics) surfaces statistically significant confusion pairs from accumulated review data. This personalizes the confusion graph beyond generic similarity.

### FSRS integration leverages interleaving research

Research on interleaving in medical education (systematic review of 8 RCTs in radiology education, 2023) confirms that interleaving similar concepts forces **discriminative contrast** — exactly the cognitive process needed to distinguish confusable items. When a confusion pair is detected, the scheduling engine should present both cards in the same session, separated by 2–5 intervening cards, to force active discrimination. This is the opposite of what naive spacing would suggest. The LECTOR approach modulates the effective half-life by a semantic interference factor, which could be implemented as a modifier on FSRS's stability increase calculation.

The database schema requires a `confusion_pairs` table with columns for `card_a_id`, `card_b_id`, `similarity_score`, `co_failure_count`, and `source` (embedding vs. empirical). A React component presents side-by-side comparison cards highlighting distinctions, generated via Gemini when a confusion pair is first identified.

| Dimension | Assessment |
|---|---|
| Implementation complexity | High |
| External dependencies | Gemini Embedding API, significant data pipeline work |
| Privacy considerations | Medium — requires mining individual error patterns |
| A/B testing approach | Track discrimination accuracy (correct responses on confusion-pair cards) over time |
| Suggested priority | Phase 3 — requires accumulated review data to be effective |

---

## 4. Chronotype-aligned scheduling suggestions

### The synchrony effect is real but smaller than commonly claimed

The Morningness-Eveningness Questionnaire (MEQ, Horne & Östberg, 1976) is the gold standard for chronotype assessment, with Cronbach's alpha > 0.80 and validated against objective circadian markers. The **reduced MEQ (rMEQ)** uses only 5 items, making it practical for in-app assessment. About 70–80% of people fall in the intermediate chronotype, with pure morning and evening types each representing only 10–15% of the population. Chronotype is approximately **54% heritable** and shifts significantly with age — medical students (ages 22–30) tend toward evening chronotypes.

The synchrony effect — superior performance when testing time matches chronotype — receives mixed evidence. A 2025 systematic review across 65 studies found that **>80% showed no main effect of chronotype on overall cognitive performance**, but approximately **45% of studies in young adults found a synchrony effect** specifically for memory, attention, and inhibition tasks. A well-powered 2023 study (N=446) using structural equation modeling found no robust synchrony effect at the latent-variable level, calling it "most likely a methodological artefact." However, a large Italian study of **104,552 oral university exams** found that passing rates peaked at midday (11 AM–1 PM), suggesting time-of-day effects exist at scale even if the chronotype-specific mechanism is debated.

The practical implication: chronotype-aligned scheduling is more likely a **nice-to-have comfort feature** than a scientifically robust performance optimizer. The evidence supports it enough to implement but not enough to make strong claims about learning gains.

### FSRS has no time-of-day component — this is a gap

FSRS schedules at the day level (intervals in days), not at specific times within a day. The algorithm's creator (L-M-Sherlock/Jarrett Ye) has not published plans for circadian modifiers. The most practical integration approach is **priority scheduling within daily queues** rather than modifying FSRS parameters: sort the daily review queue to present high-difficulty cards during estimated peak cognitive windows and easier cards during off-peak times. This adds value without touching the well-validated FSRS core.

### Technical implementation

The rMEQ can be implemented as a simple 5-question React form during onboarding. For passive chronotype inference, log timestamped review performance (accuracy and response time by hour) and fit a cosine curve or compute hourly performance averages after 2–4 weeks of data collection. PWA push notifications can suggest optimal review windows. The privacy concern is real — circadian data may be classified as health data under GDPR Article 9, requiring explicit consent and purpose limitation. The questionnaire-based approach minimizes data sensitivity compared to continuous behavioral monitoring.

| Dimension | Assessment |
|---|---|
| Implementation complexity | Low-Medium |
| External dependencies | None — fully client-side |
| Privacy considerations | **High** — chronotype/sleep patterns may be health data under GDPR |
| A/B testing approach | Compare retention rates for reviews done during suggested vs. non-suggested times |
| Suggested priority | Phase 3 — interesting but weakest evidence base of the six features |

---

## 5. Fatigue detection and optimal session termination

### Cognitive fatigue is detectable within 10–15 minutes

Mackworth's foundational research established that sustained attention declines by 10–15% after 30 minutes. Modern research shows measurable decrement can occur **within 5 minutes** under high-demand conditions and reliably appears within **10–15 minutes** under typical conditions. A 2019 study found that during an 80-minute sustained attention task, performance declined rapidly and even monetary incentives at the 60-minute mark could not restore performance to initial levels. This has direct implications for SRS sessions: **reviews conducted while fatigued are less effective and potentially counterproductive** if they create false "lapse" signals in FSRS.

For medical study sessions specifically, practitioner consensus from platforms like UWorld and BoardVitals recommends **20–30 minutes** as the optimal SRS review duration, with 10–20 new items per day as sustainable. A 2025 Frontiers in Psychology study found that micro-breaks during academic sessions explained **30–32% of variance** in quiz performance improvement.

### Behavioral signals are sufficient for detection without sensors

A flashcard app can detect fatigue through four behavioral signals without any wearable sensors. **Response time drift** — mean RT increasing by >35% over session baseline — is a robust indicator (TDCommons, 2025). **Response time variability** — increasing trial-to-trial coefficient of variation — has been validated as a cognitive fatigue marker across multiple studies. **Accuracy decline** — measured as rolling window accuracy versus session baseline — captures performance degradation directly. **Engagement changes** — increasing time between card presentations and higher "Again" button usage on previously mature cards — signal motivational fatigue.

A composite fatigue score can be computed as:
```
FatigueScore = w1×RT_drift + w2×RT_variability + w3×accuracy_decline + w4×duration_factor
```
where `duration_factor` is a sigmoid function that ramps up after 15–20 minutes, reflecting the research on vigilance decrement timing.

### FSRS-5-F is planned but not yet released

FSRS contributor Expertium proposed **FSRS-5-F** (F for Fatigue) as a variant incorporating fatigue as an input feature. FSRS creator L-M-Sherlock described plans for "a version that supports workload and hours as input features" — specifically tracking time since session start and cumulative workload before each review. This variant would modify the stability increase factor based on accumulated session fatigue. Until FSRS-5-F is released, the practical approach is to **flag fatigued reviews in the database** and analyze whether they should be excluded from FSRS parameter optimization, or whether fatigued lapses should carry reduced weight.

### Session health UX

The UI should present a "session stamina" indicator that is visible but not anxiety-inducing. At mild fatigue (score 0.3–0.5), suggest a 2-minute micro-break and shift to easier cards. At moderate fatigue (0.5–0.7), recommend a 5–10 minute break. At high fatigue (>0.7), strongly recommend ending the session but never force termination — autonomy is critical for sustained motivation. Post-session summaries should show the performance trajectory and identify when fatigue onset occurred, building metacognitive awareness.

The minimum data needed before fatigue detection is reliable is approximately **15–20 card reviews** (to establish a session baseline in the first 5–10 minutes and detect deviation over the next 10+ minutes).

| Dimension | Assessment |
|---|---|
| Implementation complexity | Medium |
| External dependencies | None — fully client-side computation |
| Privacy considerations | Low — session-level performance metrics, not personal health data |
| A/B testing approach | Compare retention at 24-hour follow-up for sessions ended at suggested vs. extended times |
| Suggested priority | **Phase 1 — high impact, no external dependencies, protects FSRS data quality** |

---

## 6. Pedagogically fine-tuned LLM replacing prompted general-purpose model

### LearnLM sets the benchmark at 82% preference over GPT-4o

Google's LearnLM, now infused into Gemini 2.5 and 3.1, represents the state of the art for pedagogically-aligned AI. Trained through a novel "pedagogical instruction following" approach — SFT data focused on pedagogical behavior co-trained with Gemini's standard training to prevent catastrophic forgetting, followed by RLHF with pedagogically-informed human preference data — LearnLM was preferred over GPT-4o in **82% of match-ups**, over Claude 3.7 Sonnet in 71%, and over base Gemini 1.5 Pro in 56% of interactions by 189 educators across 2,666 blind comparisons. The Eedi classroom RCT showed a **5.5 percentage point improvement** in novel problem-solving with only 0.1% factual error rate.

### Fine-tuning produces meaningful gains over prompting — but prompting is the right starting point

Recent research reveals a clear hierarchy. A May 2025 paper (arXiv:2505.15607) demonstrated that a **7B model trained with online RL outperformed proprietary LearnLM** on student solve rates while nearly matching solution leakage rates. DPO fine-tuning of Llama 3.1 8B on just 9,662 preference pairs matched GPT-4o quality in tutoring while being pedagogically superior to SFT alone (arXiv:2503.06424). SFT on 40,000 domain-specific examples significantly boosted smaller models' pedagogical quality (arXiv:2507.05305).

However, prompting remains the pragmatic starting point. The research also shows that well-prompted models only "marginally mimic the adaptivity of ITS" and that GPT-4o tends to provide "overly direct feedback" despite Socratic system prompts. This gap justifies eventual fine-tuning but does not justify delaying the feature.

### A three-phase approach balances cost against quality

**Phase 1 (weeks 1–4): Gemini with LearnLM system instructions.** Use Gemini 2.5 Flash ($0.30/1M input tokens) with pedagogically-structured system prompts following Google's PARTS framework. A 10-turn tutoring session costs approximately **$0.006**, making 10,000 sessions/day cost ~$1,800/month. This gets pedagogical AI behavior live immediately with no fine-tuning infrastructure.

**Phase 2 (months 2–4): Collect data, fine-tune with DPO.** Accumulate student interaction data, have medical educators label preferred/rejected tutoring responses, and fine-tune Llama 3.1 8B with LoRA + DPO on these preference pairs. LoRA fine-tuning costs approximately **$15–40 per training run** on cloud GPUs. Deploy alongside Gemini for A/B testing.

**Phase 3 (months 4–8): Online RL alignment.** Implement reinforcement learning using simulated student-tutor interactions with a multi-dimensional reward model scoring medical accuracy, pedagogical quality, and solution leakage prevention. This follows the architecture proven in arXiv:2505.15607 where a 7B RL-tuned model outperformed LearnLM.

### Evaluation must use multiple layers

Google's Learning Arena methodology provides the gold standard: educators role-play learners in blind interactions, then pedagogy experts score conversations on a rubric covering the five learning science principles. For PANaCEa, a practical evaluation stack combines **automated LLM-as-judge scoring** (scalable, validated in arXiv:2507.05305), **periodic expert review** by medical educators, and **student outcome tracking** through FSRS metrics (stability growth rate, retention improvements, time-to-mastery for specific topics). The factual accuracy target should be below **0.5% error rate** per LearnLM's benchmark.

**Cloudflare Workers AI** offers edge inference for open-source models (Llama 3.1 8B, Qwen, DeepSeek) with low latency and no GPU management, but currently does not support deploying custom fine-tuned models easily. For Phase 2+, self-hosted inference via vLLM on cloud GPUs (~$0.50–1.50/hour for A10G) or Vertex AI model tuning provides more flexibility.

| Dimension | Assessment |
|---|---|
| Implementation complexity | Low (Phase 1) → Very High (Phase 3) |
| External dependencies | Gemini API (Phase 1), GPU compute for fine-tuning (Phase 2+) |
| Privacy considerations | Student interaction data must be anonymized before fine-tuning |
| A/B testing approach | Blind comparison of tutoring quality + downstream retention metrics |
| Suggested priority | **Phase 1 (prompting) is immediate; Phase 2–3 are long-term investments** |

---

## Implementation priority matrix and phasing

Ranking the six features by impact-to-effort ratio, accounting for evidence strength, technical dependencies, and user value, the recommended implementation order is:

| Priority | Feature | Phase | Rationale |
|---|---|---|---|
| 1 | Fatigue detection | Phase 1 | No external dependencies, protects FSRS data integrity, immediate UX value |
| 2 | Socratic ZPD tutor | Phase 1 | LearnLM via Gemini API is ready now, highest pedagogical impact |
| 3 | Visual mnemonics for leeches | Phase 2 | Requires image API integration and R2 storage, but well-validated approach |
| 4 | Pedagogically fine-tuned LLM | Phase 1→3 | Start with prompting immediately, invest in fine-tuning over time |
| 5 | Semantic confusion detection | Phase 3 | Highest complexity, requires accumulated user data, but unique differentiator |
| 6 | Chronotype scheduling | Phase 3 | Weakest evidence base, privacy complications, smallest expected effect size |

### Cross-cutting considerations

**FSRS as the integration backbone.** All six features ultimately feed into or are informed by FSRS's DSR model. The algorithm's 21 parameters, combined with per-card difficulty, stability, and retrievability, provide a richer learner state signal than most educational apps possess. Features 1, 2, 3, and 5 directly use FSRS metrics for triggering or calibration. Feature 4 would benefit from a circadian extension to FSRS that does not yet exist. Feature 6 uses FSRS outcomes as evaluation metrics.

**Data flywheel effect.** Features 3 (confusion detection) and 5 (fatigue detection) generate data that improves Features 2 (Socratic calibration) and 4 (chronotype inference). As the system accumulates review data with fatigue flags, confusion pair annotations, and time-stamped performance metrics, the ML models underlying each feature become more personalized. This argues for building the data collection infrastructure early even if the features that consume that data come later.

**Gemini API as the shared AI layer.** Features 1, 2, 3, and 6 all use Gemini — for mnemonic design, Socratic dialogue, confusion pair explanation generation, and general tutoring. A shared API client with rate limiting, cost tracking, and response caching (via Cloudflare KV or R2) prevents cost surprises and ensures consistent behavior across features.

## Conclusion

The most striking finding across this research is that **FSRS's DSR model provides a computational bridge between learning science theory and practical implementation** that most educational AI systems lack. ZPD becomes operationalizable because retrievability is a direct proxy for success probability. Fatigue detection becomes actionable because FSRS parameters can be flagged or adjusted for reviews conducted during detected fatigue. Confusion detection produces scheduling changes because FSRS's stability calculations can be modified with semantic interference terms following the LECTOR architecture.

The least certain feature is chronotype scheduling, where the synchrony effect has moderate-to-weak evidence and the >80% intermediate chronotype prevalence limits practical impact. The highest-potential feature that no competitor currently offers is semantic confusion detection — LECTOR's architecture is published but not yet implemented in any production medical education tool, and the LASA medication error literature provides a compelling clinical justification beyond exam preparation. The pragmatic recommendation is to ship fatigue detection and Socratic tutoring (LearnLM-powered) first, as they provide immediate value with moderate effort, then invest in the confusion detection infrastructure that will become PANaCEa's most defensible technical moat.