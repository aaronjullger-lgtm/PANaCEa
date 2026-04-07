# Beyond FSRS v6: a research roadmap for building a cognitive prosthetic

PANaCEa already implements a sophisticated architecture — FSRS v6 with 21-parameter optimization, CRPL behavioral telemetry, Chain of Verification for AI content, and a Metacognitive HUD with Goldilocks toggle. **The most transformative finding from this research is that the next competitive frontier is not better scheduling math but content-aware, semantically-intelligent scheduling** — algorithms like KARL (EMNLP 2024) that use NLP to exploit relationships between cards, and LECTOR (2025) that use LLM in-context learning to address semantic confusion between similar concepts. These represent a paradigm shift from treating flashcards as independent statistical objects to understanding them as nodes in a knowledge graph. Below is a complete roadmap of validated, underutilized techniques organized by implementation priority and evidence strength.

---

## A. The scheduling algorithm frontier has moved past forgetting curves

### FSRS-7 and fractional intervals

FSRS-7 is now the newest version, representing the most significant architectural change since v4. Unlike v6's 21 parameters, FSRS-7 uses approximately **29 parameters** and was designed from the ground up for **fractional interval lengths** — it gives realistic predictions for same-day reviews (something v6 handles crudely with a bolted-on formula). It introduces 8 optimizable parameters controlling forgetting curve shape, allowing far more flexible per-user curve fitting. FSRS-7 is available in Anki since version 25.07. For PANaCEa, upgrading to FSRS-7 would improve same-day review handling — critical for cramming sessions PA students inevitably do before exams. **Evidence: Strong** (benchmarked on 1.7 billion reviews from 20,000 Anki users on HuggingFace).

### KARL: content-aware scheduling via NLP

**KARL** (Knowledge-Aware Retrieval and Representations, Shu et al., EMNLP 2024, University of Maryland) is the first spaced repetition scheduler that exploits flashcard text content, not just review history. It uses a BERT retriever to find semantically similar cards from a student's study history, then feeds embeddings through a classifier to predict whether the student knows the answer. In an online study (27 users, 32 six-day study paths), KARL **improved learning efficiency over state-of-the-art schedulers**. This matters enormously for medical education — knowing a student confused "nephritic" and "nephrotic" syndrome means the system can proactively schedule both for review, even if only one is "due." Current FSRS treats every card as statistically independent, which is a fundamental limitation. **Evidence: Moderate** (small online study, but strong computational framework). **Implementation: High priority** — integrate BERT-based semantic similarity into scheduling decisions alongside FSRS memory predictions.

### LECTOR: LLM-enhanced scheduling for semantic confusion

LECTOR (LLM-Enhanced Concept-based Test-Oriented Repetition, Zhao, arXiv 2508.03275, August 2025) uses LLM in-context learning to assess semantic similarity between vocabulary/concept pairs, specifically targeting the problem of "semantic confusion" — when learners confuse similar items. In simulation (100 learners, 100 days), LECTOR achieved **90.2% success rate vs. 88.4% for the best baseline**, outperforming SM-2, HLR, FSRS, and ANKI. The tradeoff is higher learning burden by design — it prioritizes success rate for exam preparation. **Evidence: Preliminary** (simulation-only, not peer-reviewed at a major venue). **Implementation: Monitor** — the concept of using LLMs for semantic confusion detection is immediately implementable even without adopting the full LECTOR algorithm.

### Binary grading is the emerging consensus

A strong movement within the FSRS community pushes toward reducing the 4-button rating system (Again/Hard/Good/Easy) to binary Pass/Fail. The FSRS FAQ explicitly states that "in some cases, FSRS may even be more accurate if you only use Again and Good." Multiple Anki Forum threads, a formal AnkiDroid feature request (GitHub #15700), and an existing Anki add-on ("Pass/Fail 2") reflect this trend. Users report binary feedback "greatly reduces decision fatigue." This directly supports PANaCEa's existing CRPL telemetry vision — if you can infer difficulty from behavioral signals (hesitation, time-to-answer, hover patterns on distractors), the explicit rating buttons become vestigial. **Evidence: Strong** (FSRS accuracy is maintained or improved; user experience benefit is anecdotal but widespread). **Implementation: High priority** — default to Again/Good binary interface, use CRPL to infer what would have been Hard/Easy.

---

## B. Retrieval practice and desirable difficulties have actionable new refinements

### Successive relearning and the S2D2 framework

The retrieval practice effect remains among the most robust in learning science (**g ≈ 0.50**, Rowland 2014 meta-analysis; **d ≈ 0.40** for transfer, Pan & Rickard 2018). The practical frontier is now about ensuring students *actually use* effortful strategies. The **S2D2 framework** (Start and Stick to Desirable Difficulties, de Bruin et al., 2023) directly addresses this — it provides scaffolding for health professions students to adopt and persist with retrieval practice despite the discomfort. A key insight from Serfaty (2024-2025): easy retrieval (immediately after feedback) produces **no better retention than simply copying** — the difficulty must be genuine to be desirable.

The transfer limitation is important: Corral & Kurtz (2025) theorize that retrieval practice benefits transfer when recognition demands are low but fails when learners cannot recognize when to apply knowledge. For PANCE preparation, this means practice questions must vary surface features (different patient demographics, presentation contexts) while testing the same underlying concept. **Implementation:** Vary question framing for the same illness script — different chief complaints, different patient backgrounds — to build transfer-ready knowledge.

### Prediction error as a memory supercharger

The dual-route model of emotional memory (ScienceDirect, 2023-2024) identifies two distinct pathways: (1) an "affect route" via arousal/norepinephrine that enhances memory vividness, and (2) a "prediction route" via **dopamine-mediated prediction errors** that enhances memory integration. When the brain encounters something unexpected — a surprising lab result, a counterintuitive treatment — the prediction error signal triggers dopamine release that strengthens encoding. The curiosity-driven encoding work by Gruber et al. shows that **states of high curiosity enhance memory not just for the curiosity-triggering material, but for incidental information encountered during that state**.

**Implementation:** Before presenting the answer to a practice question, show the student's confidence rating alongside performance statistics ("You were 90% confident, but only 40% of students answer this correctly"). The resulting prediction error — realizing their calibration is wrong — should enhance encoding of the correct answer. Deliberately design "surprising" explanations that violate common misconceptions.

### JOL reactivity is a free encoding boost

West et al. (2025, QJEP) found that metamemory accuracy increases with practice but **does not require explicit metamemory training** — spaced repetition naturally improves calibration through exposure to retrieval success/failure signals. Even more useful: Yang et al. (Memory & Cognition) demonstrated that simply **making a judgment of learning (JOL) reactively facilitates memory**. The act of monitoring memory itself strengthens encoding, and this effect extends to judgments of forgetting (JOFs) equally. **Implementation:** Add a quick confidence slider before revealing the answer — not primarily for the data it generates, but because the metacognitive act of predicting your own performance enhances the learning event itself.

---

## C. Sleep, breaks, and timing yield surprisingly specific recommendations

### Targeted memory reactivation works — but with constraints

The TMR meta-analysis (Hu et al., 2020; 91 experiments, N = 2,004) shows an overall effect of **Hedges' g = 0.29** — small but reliable. TMR is effective during NREM Stage 2 (g = 0.32) and slow-wave sleep (g = 0.27), but **not during REM sleep or wakefulness**. A 2025 personalized TMR protocol (npj Science of Learning) that adjusts stimulation frequency based on individual retrieval performance showed enhanced slow wave-spindle synchronization and significantly reduced memory decay.

While PANaCEa can't control a student's sleep environment, it can optimize **pre-sleep review timing**. The evidence suggests that material reviewed shortly before sleep receives preferential consolidation. **Implementation:** Track when users typically go to sleep (inferred from last app usage times), and schedule a brief "consolidation review" of the day's most challenging items 30-60 minutes before predicted bedtime. Flag this as "Sleep Boost" review.

### Micro-breaks have strong, specific evidence for study apps

Sustained attention declines after approximately **25 minutes** (Risko et al., 2012; confirmed by a 2025 Frontiers in Psychology study of 253 undergraduates showing vigilance decline beginning after just 5 minutes). The optimal break research reveals a clear hierarchy of break activities:

- **Nature-based microbreaks** increased task performance by **15%** and reduced work withdrawal in a 10-day employee study (2024). Even **40 seconds** of viewing green rooftop images sustained attention for up to 50 minutes (Lee et al., 2015).
- **5-minute mindfulness breaks** provide superior cognitive restoration compared to passive rest (2025 research).
- **3-minute walking breaks** after 30 minutes of sitting elevate mood and energetic arousal more effectively than merely standing (2024 study).
- **Systematic breaks outperform self-regulated breaks**: Biwer et al. (2023, British Journal of Educational Psychology) found that students using systematic breaks (e.g., Pomodoro) showed lower fatigue, less distraction, and higher concentration than self-regulators, completing the same work in less total time.

**Implementation:** Enforce 25-30 minute study blocks with 5-minute breaks. During breaks, display nature imagery (costs nothing to implement) and suggest brief physical movement. Track performance decline within sessions to detect when individual students need earlier breaks.

### The synchrony effect is real but weaker than popularly claimed

May & Hasher (2023, Perspectives on Psychological Science) confirmed that cognitive performance is superior when task timing aligns with individual chronotype — but a systematic review (Chronobiology International, 2025) found **only ~45% of studies in young adults showed significant synchrony effects**. A large-scale study (N = 446) found weak evidence at individual task level and no robust general synchrony effect at the latent variable level. The effect is strongest for effortful analytical processing and weakest for crystallized knowledge. Intriguingly, **creative/insight tasks actually benefit from non-optimal times** because weakened attentional control allows more divergent thinking (Wieth & Zacks, 2011).

**Implementation:** Offer optional chronotype assessment (MEQ questionnaire) and use it to suggest — not enforce — study timing. Schedule difficult analytical material (new pathophysiology, complex pharmacology calculations) at optimal times; schedule review of well-known material at any time. Evidence strength: **Moderate** — useful as a feature but shouldn't be central to the value proposition.

---

## D. AI-enabled features that weren't possible when Anki was built

### Google LearnLM proves pedagogical fine-tuning beats prompting

Google's LearnLM (2024-2025), fine-tuned on Gemini architecture specifically for learning, demonstrated in an RCT with UK classrooms (Eedi partnership) that students receiving LearnLM tutoring were **5.5 percentage points more likely to solve novel problems** on subsequent topics compared to students with human tutors alone, with only a **0.1% factual error rate**. LearnLM was preferred over GPT-4o by **31%** across diverse scenarios evaluated by 168 pedagogy experts. Five embedded principles: inspire active learning, manage cognitive load, adapt to the learner, stimulate curiosity, and deepen metacognition.

The key insight for PANaCEa: **pedagogical fine-tuning dramatically outperforms prompt engineering for educational LLM applications.** PANaCEa's current CoVe pipeline uses prompted general-purpose LLMs. The trajectory should move toward either fine-tuning a model on medical tutoring transcripts or leveraging LearnLM/Gemini 2.5 Pro (which now includes LearnLM capabilities). **Evidence: Strong** (RCT, expert evaluation, deployed at scale).

### Stealth assessment has matured into a validated framework

Stealth assessment — inferring learning states from behavioral data without explicit testing — received a dedicated **2026 JRTE Special Issue** (11 papers), marking its transition from concept to validated methodology. The standard framework is Evidence-Centred Design (ECD). A key validation study (Lu et al., Journal of Learning Analytics, 2025) demonstrated that "adaptive stealth assessment can provide sufficient and reliable information about learning growth" using gameplay logs and computational models.

For PANaCEa, this validates the CRPL telemetry direction but suggests going further. A behavioral biometrics framework (EURASIP, 2025) cross-references mouse click patterns, movement dynamics, and MCQ interaction behaviors for assessment. **Implementation:** Expand CRPL to include scrolling speed through explanations (did they actually read it?), time spent on each distractor option, and pattern of answer changes — all signals that can feed into the Ghost Grader system to eliminate explicit ratings entirely.

### AI-generated multimodal mnemonics achieve 85-95% success rates

Elabd et al. (JMIR Medical Education, May 2025) documented a systematic approach to creating Personalized Multimodal Mnemonics (PMMs) using GPT-4 for text + DALL-E 3 for visuals, grounded in Paivio's dual-coding theory. Initial success rate was **85%**, improving to **95%** after 1-3 iterations, with 2-5 minutes per concept. Separately, Bland et al. (Technologies, May 2025) tested AI-generated mnemonic images for ECG interpretation in 275 first-year medical students, marking one of the first studies investigating "generative AI as a human-centered educational aid designed to enhance long-term retention." The MIT Media Lab also has an active project on customized digital mnemonics including method of loci.

**Implementation:** When a student repeatedly fails a card (leech detection), automatically generate a visual mnemonic using image generation APIs. Combine with a text-based mnemonic story. This is a high-value, low-effort feature — the generation pipeline is straightforward and the educational theory (dual coding) is among the most robust in learning science.

### Knowledge graph + deep RL for adaptive learning paths

A Nature Scientific Reports (2025) paper demonstrated a system that encodes prerequisite (directed) and semantic (undirected) relations between concepts, uses resource-to-knowledge mapping, and updates learner mastery in real-time via interaction feedback and exponential forgetting. Graph-based architectures now dominate knowledge tracing research at **26.2%** of published models (systematic review of 84 studies, Preprints.org, Oct 2025), having overtaken sequence models (RNNs) and attention-based models.

For PANaCEa specifically, this means the system should maintain a knowledge graph of PANCE concepts where nodes are medical concepts and edges represent prerequisites ("must understand cardiac output before understanding heart failure management"). When a student fails a question, the system traces backward through prerequisites to find the root knowledge gap, then schedules those foundational concepts for review. **Evidence: Strong** for the approach (dominant research paradigm), **Moderate** for specific implementations.

---

## E. Medical education has specific techniques Anki and UWorld don't implement

### Illness script contrast training produces dramatic gains

A 2024 study of Thai medical students using dual-process theory, illness scripts, and "contrasting competing illness scripts" as a contrastive learning strategy showed **post-intervention scores of 8.95 vs. pre-intervention 1.68** (p < 0.001). Spahic et al. (2023, Diagnosis) confirmed that "meta-memory techniques" encouraging systematic illness script building promoted broader differential diagnosis generation. The MedEdPORTAL approach using case-based illness script worksheets emphasizes compare-and-contrast of plausible hypotheses.

This is fundamentally different from how Anki or UWorld present information. They test one condition at a time. **What PANaCEa should do:** After a student answers a question about, say, acute pancreatitis, immediately present a brief "contrast table" showing how pancreatitis differs from cholecystitis, peptic ulcer disease, and mesenteric ischemia across key discriminating features (pain location, lab findings, imaging). This contrastive format accelerates illness script differentiation — the core skill tested on the PANCE.

### Basic science integration via causal reasoning improves diagnostic accuracy

Woods et al. (Advances in Health Sciences Education) demonstrated that causal knowledge of pathophysiology helps novice learners create stronger memory representations for clinical features. Al-Eyd et al. (2025, Diagnosis) validated a Clinicopathologic Correlations (CPCOR) process linking clinical findings to pathophysiologic changes. Schmidt & Mamede (2015) proposed the progression: develop causal explanations → encapsulate pathophysiological knowledge → build illness scripts.

**Implementation:** In AI-generated explanations for incorrect answers, always include a "Why?" chain: pathophysiology → clinical finding → management rationale. Instead of "The answer is B. First-line treatment for community-acquired pneumonia is amoxicillin," generate: "Streptococcus pneumoniae colonizes the nasopharynx → aspiration introduces bacteria to lower respiratory tract → bacterial replication triggers inflammatory cascade → alveolar consolidation → the productive cough and focal crackles in this patient. Amoxicillin targets the cell wall of S. pneumoniae, making it first-line."

### Interleaving clinical topics improves differential diagnosis

Carvalho & Goldstone (2014) showed that active interleaved study promotes attending to differences between categories — precisely what differential diagnosis requires. A 2003 study (one of the earliest in medical education) showed interleaving helped medical students produce more accurate ECG diagnoses than blocking. The key caveat: an adequate knowledge foundation must exist before interleaving is effective (Lecturio review; PMC12108632, 2025), and interleaving benefits high-similarity category discrimination while blocking may benefit low-similarity/rule-based categories.

**Implementation:** PANaCEa should default to interleaved presentation once a topic reaches a minimum mastery threshold. For new topics, use blocked study first. This requires per-topic mastery tracking — which the FSRS stability parameter already provides. When S > threshold, switch that topic to interleaved mode.

---

## F. Personalization and prediction systems with concrete implementation paths

### IRT/CAT principles applied to learning require critical modifications

Wauters et al. identified critical differences between CAT for testing versus learning: in learning, ability changes over sessions; items may be seen multiple times; feedback is provided; and motivation matters more. Standard CAT targets ~50% success probability to maximize information gain, but this frustrates learners. Learning environments should target **60-75% success rate** to balance information gain with motivation. An Elo Rating System adaptation (originally from chess) enables real-time updating of both student ability and item difficulty.

For PANaCEa, the optimal approach is a **hybrid FSRS + IRT system**: use FSRS to determine *when* a card is due, and use IRT-based item selection to determine *which* due cards to present first within a session. Cards whose difficulty parameter most closely matches the student's current ability estimate (via Elo-style updates) should be prioritized because they maximize learning per minute. **Evidence: Strong** for the theory (decades of IRT research), **Moderate** for the specific learning application.

### Expertise reversal demands adaptive scaffolding

Kalyuga et al. (2003) established that instructional techniques highly effective for novices can have **negative consequences** when used with experienced learners. Worked examples help novices but become redundant for experts; integrated formats help novices but hinder experts. The mechanism: experts' internal schemas conflict with redundant external guidance, increasing cognitive load. Renkl (2014) proposed the fading strategy — gradually transitioning from fully guided explanations to independent problem-solving.

**Implementation:** Track per-topic expertise via FSRS stability and accuracy trends. For topics where the student is a novice (low S, low accuracy), provide full pathophysiological explanations, worked examples, and step-by-step reasoning. As mastery increases, progressively fade: full explanation → key points only → "Why is B correct?" prompt → no explanation (just confirmation). This prevents the common failure mode of study apps providing the same level of detail regardless of the learner's expertise.

### Self-assessment bias detection and correction

Dunning-Kruger patterns are well-documented in medical students: a 2024 BMC Medical Education study found bottom-quartile first-semester students significantly overestimated their performance, while top-quartile students underestimated. Davis et al. (JAMA, 2006) found limited correlation between physician self-assessment and actual competence. A striking data point: in one study, 100% of interns felt competent at venipuncture, but only **10% of tutors agreed**.

PANaCEa already captures confidence data. The next step is a **calibration index** — plotting the student's confidence against their actual accuracy across topics, updated in real-time. When systematic over-confidence is detected in a topic domain (e.g., student rates 85% confident but scores 55% on cardiology questions), the system should: (1) display the calibration gap explicitly, (2) increase the proportion of difficult questions in that domain, and (3) surface the student's error patterns. **Evidence: Strong** for the phenomenon, **Moderate** for specific correction interventions.

### Learning analytics predict exam outcomes with 78-90% accuracy

Machine learning models using behavioral engagement data achieve **78-90% prediction accuracy** for student outcomes (Frontiers in Education, 2024; International Journal of Ed Tech in HE). Random Forest and XGBoost consistently outperform simpler models. For spaced repetition specifically, the strongest predictive features are: percentage of mature cards (interval ≥ 21 days), consistency of daily reviews, total content coverage relative to blueprint, and temporal patterns of study behavior. A French medical entrance exam study (PMC12255137, 2025; N = 523) found spaced repetition use was independently associated with exam success (44.8% of passers vs. 20.3% of failers, p < 0.001). Critically, the minimum effective dose appears to be **at least 6 months** of sustained use — studies of 1-month interventions showed no association with exam scores.

**Implementation:** Build a "PANCE Readiness Score" using a gradient boosting model trained on: % mature cards per blueprint category, review consistency (coefficient of variation of daily reviews), accuracy trend slope, and coverage of the NCCPA blueprint. Display this as a dashboard metric with confidence intervals — but only after the 90-day mark, since predictions are unreliable earlier.

---

## Implementation priority matrix

The following features are ranked by a composite of evidence strength, implementation feasibility, and competitive differentiation from existing apps:

**Tier 1 — Implement immediately (strong evidence, high impact, feasible):**
- Upgrade to FSRS-7 for fractional interval support and better same-day review handling
- Binary (Again/Good) interface with CRPL-inferred difficulty replacing Hard/Easy buttons
- Illness script contrast tables after each question
- Causal reasoning chains in AI-generated explanations
- Confidence slider before answer reveal (JOL reactivity effect)
- Enforced systematic micro-breaks with nature imagery
- Expertise-adaptive scaffolding with explanation fading

**Tier 2 — Build in next development cycle (strong-to-moderate evidence, high differentiation):**
- Semantic similarity-based scheduling (KARL-inspired BERT embeddings for card relationships)
- Knowledge graph prerequisite mapping for error-driven concept remediation
- Calibration index dashboard tracking over/under-confidence per topic domain
- PANCE Readiness Score via gradient boosting model
- Pre-sleep "consolidation review" session timed to user's sleep patterns
- IRT/Elo hybrid for within-session card prioritization

**Tier 3 — Experimental features (moderate-to-preliminary evidence, high potential):**
- AI-generated visual mnemonics for leech cards (dual coding via image generation)
- LLM-based Socratic questioning calibrated to zone of proximal development
- Semantic confusion detection between commonly confused medical terms (LECTOR-inspired)
- Chronotype-aligned scheduling suggestions
- Fatigue detection and optimal session termination from performance decline curves
- Pedagogically fine-tuned LLM (LearnLM-inspired) replacing prompted general-purpose model

---

## Conclusion: what actually differentiates PANaCEa

The core insight from this research is that the competitive moat for a next-generation study app is not in the spacing algorithm itself — FSRS-7 is open-source and anyone can implement it. The defensible advantage lies in three capabilities that require engineering sophistication and medical domain expertise to combine:

First, **content-aware intelligence** — understanding that "nephritic syndrome" and "nephrotic syndrome" cards are semantically related and should be scheduled and presented contrastively. KARL demonstrates this is technically feasible and measurably effective. Second, **implicit mastery inference** — the Ghost Grader vision of eliminating self-rating entirely, using behavioral signals (CRPL telemetry, response latency, scrolling patterns, answer revision sequences) to derive mastery estimates. The FSRS community's move toward binary grading validates this direction; stealth assessment's maturation into a validated framework (2026 JRTE Special Issue) provides the methodological foundation. Third, **adaptive pedagogical depth** — knowing when a student needs a full pathophysiological explanation versus a brief confirmation, automatically fading scaffolding as expertise grows, and generating contrastive illness script tables when differential diagnosis skill needs strengthening.

None of these capabilities exist in Anki, UWorld, Osmosis, or any current commercial competitor. Each is individually validated by recent research. Together, they transform PANaCEa from a flashcard app into what your architecture document correctly calls a "cognitive prosthetic."