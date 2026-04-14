# PANaCEa Tier 1 feature implementation plan

Seven features spanning algorithmic upgrades, AI-generated pedagogy, metacognitive interventions, and adaptive learning — each grounded in primary research — form the next phase of PANaCEa's evolution. **FSRS-7 is not yet available in ts-fsrs** (the library supports through FSRS-6 with 21 parameters), so the upgrade requires either contributing upstream or implementing the 29-parameter model directly. The remaining six features rest on strong evidence bases, from the JOL reactivity effect (Double et al., 2018) to the expertise reversal effect (Kalyuga et al., 2003), and each has a clear integration path with the existing FSRS pipeline and Gemini generation layer.

---

## 1. FSRS-7 brings fractional intervals and short-term memory modeling

### Research and current state

FSRS has evolved through seven major versions, each adding parameters and refining the forgetting curve model. The progression from FSRS-5 (19 parameters) through FSRS-6 (21 parameters) to FSRS-7 (29 parameters) represents increasingly sophisticated memory modeling. **FSRS-7 exists only in the srs-benchmark repository** — it has not been integrated into Anki or ts-fsrs (currently at v5.2.3, supporting FSRS-6).

The three critical changes in FSRS-7:

**Fractional intervals.** All prior FSRS versions round intervals to integer days. FSRS-7 supports fractional intervals (e.g., 2.5 days), which is essential for sub-day scheduling in a flashcard app where students may review multiple times daily. This eliminates the artificial quantization that distorts same-day review predictions.

**Eight-parameter forgetting curve.** FSRS-6 introduced a single trainable decay parameter (w₂₀) to its power-law forgetting curve: R(t,S) = (1 + factor·t/S)^(−w₂₀). FSRS-7 expands this to **8 optimizable parameters**, enabling a much more flexible curve shape that better captures individual forgetting patterns. The specific formula has not yet been publicly documented on the fsrs4anki wiki.

**Short-term stability model.** FSRS-5 introduced same-day review handling with parameters w₁₇ and w₁₈. FSRS-6 refined it with w₁₉. FSRS-7's short-term stability model properly handles the transition from within-session learning to between-session forgetting — the only version that gives "realistic same-day review predictions" according to Expertium's benchmark analysis. This matters enormously for PANaCEa, where students do multiple sessions per day.

### Technical implementation

**Schema changes for fractional intervals:**

```typescript
// Prisma schema migration
model Card {
  // CHANGE: interval from Int to Float
  interval        Float    @default(0)    // was Int
  stability       Float    @default(0)
  difficulty      Float    @default(0)
  scheduledDays   Float    @default(0)    // was Int
  elapsedDays     Float    @default(0)    // was Int
  // NEW: track FSRS version per card for migration
  fsrsVersion     Int      @default(6)
}

model FSRSParameters {
  id              String   @id
  userId          String
  // CHANGE: expand from 21 to 29 parameters
  weights         Float[]  // length 29 for FSRS-7
  version         Int      @default(7)
}
```

**Implementation strategy** given ts-fsrs does not yet support FSRS-7:

- **Option A (recommended):** Fork ts-fsrs and implement FSRS-7 against the srs-benchmark reference, contributing upstream. The fsrs-rs Rust implementation can serve as the authoritative reference via the `@open-spaced-repetition/binding` WASM package.
- **Option B:** Use the `@open-spaced-repetition/binding` (v0.1.1) package, which wraps fsrs-rs via napi-rs and supports WASM. If fsrs-rs implements FSRS-7 before ts-fsrs does, this gives immediate access. Monitor the fsrs-rs release cycle.
- **Option C (interim):** Ship on FSRS-6 now, store intervals as floats from day one, and upgrade the algorithm in-place when FSRS-7 lands in ts-fsrs. This avoids blocking the other six features.

**Migration path:**

```typescript
// Migration function for existing cards
async function migrateToFSRS7(card: Card, oldParams: number[]) {
  // 1. Convert integer intervals to float (lossless)
  card.interval = parseFloat(card.interval.toString());
  
  // 2. Extend parameter array from 21 → 29
  // New params get FSRS-7 defaults (from srs-benchmark)
  const newParams = [...oldParams, ...FSRS7_DEFAULT_EXTENSION];
  
  // 3. Re-derive stability using FSRS-7 forgetting curve
  // Card state (S, D) carries forward; R recalculated
  card.fsrsVersion = 7;
  return card;
}
```

### FSRS pipeline integration

The FSRS pipeline in PANaCEa currently flows: CRPL behavioral signals → rating derivation → FSRS scheduling → next review date. FSRS-7 changes affect the scheduling step only. The CRPL layer remains untouched. The key integration point is ensuring the scheduler accepts and returns fractional intervals, and that the UI displays sub-day scheduling naturally ("Review in 4 hours" rather than "Review tomorrow").

### Pitfalls

- **FSRS-7 is a moving target.** The algorithm is benchmark-only with undocumented forgetting curve internals. Building against it now risks rework when the formula is finalized.
- **Parameter optimization.** FSRS-7's 29 parameters require more training data per user to converge. New users with few reviews will need robust defaults, and the optimizer may overfit with sparse data.
- **Cloudflare Workers constraints.** The WASM binding for fsrs-rs is ~2MB. Verify this fits within Cloudflare's bundle size limits (currently 10MB for paid plans). The optimization step (computing personalized parameters) should run as a scheduled Durable Object or off-platform cron, not inline.
- **Float precision.** Storing intervals as floats in Prisma/Postgres introduces IEEE 754 precision issues. Use `Decimal` type or store as integer milliseconds for sub-day precision.

---

## 2. Validating CRPL against self-report requires careful calibration

### Research and current state

The FSRS community has a clear position on implicit ratings: **FSRS deliberately excludes response time from its core model**, using only interval lengths and grades. However, the evidence that response time carries predictive information is strong. In the srs-benchmark, LSTM and RWKV neural networks that incorporate review duration as an input feature consistently outperform FSRS — indicating untapped signal in behavioral telemetry.

**Validated behavioral signals:**

**Response time** correlates with memory strength via cognitive strength theory — stronger memories are retrieved faster (PMC3348658). The `@squeakyrobot/fsrs` npm package implements an `autoRating()` function that maps response time to a continuous 1.0–4.0 grade, and Anki's "Pass/Fail 3" add-on uses per-card historical baselines (mean ± standard deviation) to auto-assign Easy/Good/Hard. However, response time is noisy: pauses, distractions, and cognitive state variations (fatigue, ADHD) all introduce confounds.

**Binary grading works surprisingly well with FSRS.** The FSRS FAQ confirms that using only Again/Good (2 buttons) performs comparably to 4-button grading because consistent grading offsets the reduced granularity. This suggests CRPL doesn't need to perfectly discriminate all four grades — distinguishing "fail vs. pass" and roughly estimating confidence within "pass" may suffice.

**No published research exists on "ghost grading" as a named concept.** The closest analog is Duolingo's Half-Life Regression (Settles & Meeder, 2016), which uses binary correct/incorrect outcomes without response time, achieving a 12% increase in user activity compared to Leitner.

### Technical implementation

**CRPL signal architecture:**

```typescript
interface CRPLSignals {
  // Confidence signals
  responseTimeMs: number;        // raw response latency
  normalizedRT: number;          // z-score vs. card's historical mean
  hesitationEvents: number;      // answer changes before commit
  timeToFirstInteraction: number; // delay before engaging
  
  // Pattern signals
  streakLength: number;          // consecutive correct for this card
  lapseRecency: number;          // reviews since last lapse
  
  // Learning signals (for MCQ)
  distractorEngagement: number;  // time spent on wrong options
  correctOnFirst: boolean;       // no answer changes
  
  // Derived
  implicitRating: number;        // 1.0-4.0 continuous
  confidence: number;            // 0-1 probability estimate
}
```

**Calibration approach — logistic regression with per-card baselines:**

```typescript
function deriveImplicitRating(signals: CRPLSignals, cardHistory: ReviewHistory[]): number {
  // Step 1: Compute per-card z-score for response time
  const cardMeanRT = mean(cardHistory.map(r => r.responseTimeMs));
  const cardStdRT = std(cardHistory.map(r => r.responseTimeMs));
  const rtZScore = (signals.responseTimeMs - cardMeanRT) / cardStdRT;
  
  // Step 2: Multi-signal logistic model
  // P(recall) = σ(β₀ + β₁·rtZScore + β₂·hesitations + β₃·streak + ...)
  const logit = CALIBRATED_WEIGHTS.intercept
    + CALIBRATED_WEIGHTS.rt * rtZScore
    + CALIBRATED_WEIGHTS.hesitation * signals.hesitationEvents
    + CALIBRATED_WEIGHTS.streak * Math.log1p(signals.streakLength)
    + CALIBRATED_WEIGHTS.lapseRecency * signals.lapseRecency;
  
  const pRecall = sigmoid(logit);
  
  // Step 3: Map probability to FSRS rating
  // Again: P < 0.3, Hard: 0.3-0.6, Good: 0.6-0.85, Easy: > 0.85
  return mapToRating(pRecall);
}
```

**Validation methodology:**

The gold standard is comparing predicted recall probability (from FSRS using implicit ratings) against actual binary outcomes (recalled or not) on future reviews. Key metrics:

- **Log-loss** (cross-entropy) between predicted R and actual outcome — the same metric FSRS uses internally for optimization
- **Calibration curves:** Bin predictions by decile and plot predicted vs. actual recall rate. Perfect calibration = diagonal line
- **RMSE(bins):** Root mean square error of binned calibration, the primary FSRS benchmark metric
- **A/B design:** Run a cohort with implicit-only ratings vs. a cohort with explicit ratings (4-button). Compare log-loss and calibration after ≥500 reviews per user. FSRS benchmarks show meaningful differences emerge at ~1,000 reviews

The minimum viable validation requires collecting both explicit and implicit ratings simultaneously for a calibration period (the "shadow mode"), then comparing which input produces lower log-loss when fed through FSRS scheduling.

### FSRS pipeline integration

CRPL sits upstream of FSRS as a rating translator. The integration point is clean: CRPL outputs a rating (1–4, continuous or discrete), which feeds into FSRS's standard `repeat()` function. No changes to the FSRS algorithm itself are needed. The confidence slider (Item 5) provides a cross-validation signal — explicit confidence can be regressed against CRPL's implicit rating to detect calibration drift.

### Pitfalls

- **Cold start problem.** Per-card baselines require ≥5 reviews (per the Anki Pass/Fail 3 add-on). New cards must fall back to global or per-user baselines, which are less accurate.
- **Response time confounds.** Students who read explanations mid-review, look away, or use text-to-speech will have inflated response times unrelated to memory strength. CRPL needs an outlier clamp (e.g., cap at 3× card median).
- **Expertise conflation.** Fast responses can indicate either strong recall or shallow pattern matching. Combining RT with accuracy and hesitation patterns helps disambiguate.
- **Self-fulfilling prophecy.** If CRPL consistently maps a card to "Easy," FSRS will schedule long intervals, reducing review frequency. If the rating was miscalibrated, the error compounds silently. Regular calibration checks against actual recall outcomes are essential.

---

## 3. Illness script contrast tables leverage contrastive learning for diagnostic reasoning

### Research and current state

Illness scripts — cognitive structures containing enabling conditions, pathophysiological fault, and clinical consequences — are the dominant framework for understanding clinical diagnostic reasoning (Feltovich & Barrows, 1984; Custers, 2015, *Med Teach*). Schmidt and Boshuizen's knowledge encapsulation theory (1993, 2007) describes how medical expertise develops through stages: novices accumulate causal biomedical knowledge, which becomes encapsulated into diagnostic labels, which integrate into illness scripts.

**The evidence for contrastive instruction is compelling.** Hautz and Kämmer (2020, *Med Educ*) synthesized evidence showing traditional disease-organized tables produced only **29% diagnostic accuracy**, while worked examples highlighting discriminating features achieved **60%**. Hatala, Brooks, and Norman (2003, *Adv Health Sci Educ*) found students who learned by contrasting ECGs from different diagnostic categories achieved **50% higher diagnostic accuracy** than those who studied by category. Alfieri, Nokes-Malach, and Schunn's meta-analysis (2013, *Educ Psychol*) confirmed that case comparisons support far transfer by promoting schema abstraction.

**AI generation is viable.** Yanagita et al. (2024, *BMC Med Educ*) tested GPT-4's ability to generate illness scripts for 184 diseases. **84.3% were rated acceptable** by expert reviewers, with cardiovascular and psychiatric domains showing the highest error rates.

### Technical implementation

**Data structures:**

```typescript
interface ContrastTable {
  id: string;
  questionId: string;           // linked to the triggering question
  presentingComplaint: string;   // "acute chest pain"
  primaryCondition: string;      // the correct answer condition
  conditions: ContrastCondition[];  // 3-5 conditions to compare
  discriminatingFeatures: string[]; // highlighted differentiators
  generatedAt: Date;
  geminiModelVersion: string;
  reviewStatus: 'auto' | 'expert-reviewed';
}

interface ContrastCondition {
  name: string;                   // "Pulmonary Embolism"
  enablingConditions: string;     // "DVT hx, immobility, OCP use"
  pathophysiology: string;        // 1-2 sentence mechanism
  keyPresentingFeatures: string[];// discriminating signs/symptoms
  diagnosticApproach: string;     // "CT-PA, D-dimer"
  management: string;             // "Anticoagulation, thrombolysis if massive"
  isCorrectAnswer: boolean;
}
```

**Gemini prompt engineering:**

```typescript
const contrastTablePrompt = `
You are generating a clinical contrast table for PA student education.
The student just answered a question about: {questionContext}
The correct diagnosis was: {correctDiagnosis}
The presenting complaint was: {chiefComplaint}

Generate a contrast table comparing {correctDiagnosis} against 3-4 
close differential diagnoses that present similarly.

REQUIREMENTS:
1. Choose differentials that share key presenting features with the 
   correct diagnosis — focus on conditions students commonly confuse
2. For each condition, provide:
   - Enabling conditions (epidemiologic risk factors, 2-3 key items)
   - Core pathophysiology (1 sentence, mechanistic)
   - DISCRIMINATING features that distinguish THIS condition from the 
     others (NOT shared features). Bold the most distinctive finding.
   - Diagnostic approach (first-line test)
   - Management (first-line treatment)
3. Explicitly highlight which features DISCRIMINATE between conditions, 
   not which features are shared
4. Use Bordage's semantic qualifiers where appropriate (acute/chronic, 
   localized/diffuse, constant/intermittent)
5. Format as structured JSON matching the ContrastCondition schema

CRITICAL: Focus on DISCRIMINATING features per Hautz & Kämmer (2020). 
The pedagogic value comes from contrast, not enumeration.
`;
```

**Condition selection algorithm:** Rather than random differentials, the system should select conditions the student has previously confused (from response history) or conditions sharing the same chief complaint in the question bank. Store a confusion matrix per student tracking which condition pairs generate errors.

### FSRS pipeline integration

Contrast tables are post-answer pedagogic content — they don't feed into FSRS scheduling directly. However, engagement with the contrast table (time spent, expansion of rows, revisits) can feed into CRPL as a learning signal. If a student spends significant time on the contrast table, this suggests uncertainty about the differentials, which could modestly increase the implicit difficulty estimate for related cards.

**Gemini integration:** The contrast table generation happens asynchronously after the answer is revealed. Use Gemini's structured output mode (JSON schema enforcement) to ensure the response matches `ContrastTable` schema. Cache generated tables by question ID — the same question should produce the same contrast table for all students, with personalization limited to highlighting the student's specific error pattern.

### Pitfalls

- **Medical accuracy.** Yanagita et al. found **15.8% of AI-generated illness scripts were deficient**. Cardiovascular and psychiatric conditions had the highest error rates. Implement a content review pipeline: auto-generate → expert review queue → approved content cache. Never ship unreviewed contrast tables for high-stakes clinical content.
- **Cognitive overload.** A contrast table with 6 conditions × 5 features = 30 cells of information after every question will overwhelm students. Limit to **4 conditions × 4 features** and make the table collapsible/scrollable.
- **Condition selection bias.** Always including the most dangerous differential (e.g., always showing MI for any chest complaint) trains students to anchor on zebras. Weight condition selection toward the most commonly confused pairs from aggregate error data.

---

## 4. Causal reasoning chains produce deeper and more durable learning than declarative explanations

### Research and current state

The evidence that causal mechanistic explanations outperform declarative fact lists in medical education is robust. **Woods, Brooks, and Norman (2005, 2007, *Adv Health Sci Educ*)** conducted the foundational experiments: novice diagnosticians taught with causal mechanism explanations significantly outperformed controls on diagnostic tasks both immediately and one week later. Critically, causal mechanism knowledge helped most on **difficult cases with irrelevant findings and unfamiliar terminology** — precisely the transfer scenario medical students face.

Schmidt, Norman, and Boshuizen's knowledge encapsulation theory (1990, *Acad Med*) provides the developmental framework: biomedical causal knowledge is the substrate that eventually becomes encapsulated into expert diagnostic reasoning. Teaching the causal chain explicitly accelerates this encapsulation process.

**Chi's self-explanation effect** (Chi et al., 1994, *Cogn Sci*; Chi, 2000) provides the cognitive mechanism: generating causal explanations engages constructive processing — inference generation and mental model repair — producing effect sizes of **d = 0.63–0.95** compared to passive reading. Dunlosky et al.'s (2013) comprehensive review of learning techniques rated elaborative interrogation ("why does this make sense?") as having **moderate utility** with broad applicability.

**Causal structure dominates memory organization.** Delarazan et al. (2024, *J Cogn Neurosci*) demonstrated that causal relationships override even temporal and presentation order in memory organization — the effect is "strong enough to override even task instruction."

**Critical caveat about AI generation:** Mathur et al. (2025, OpenReview) found LLMs "rely on statistical correlations rather than causal understanding, making them prone to blending genuine causal relationships with spurious associations." The educational value lies not in the LLM having causal understanding, but in the LLM scaffolding the student's own causal reasoning through structured chain presentation.

### Technical implementation

**Causal chain data structure:**

```typescript
interface CausalChain {
  id: string;
  questionId: string;
  links: CausalLink[];
  branchPoints: BranchPoint[];   // where chains diverge for differentials
  clinicalCorrelation: string;   // "This is why the patient presented with X"
}

interface CausalLink {
  order: number;
  entity: string;          // "Streptococcus pyogenes"
  mechanism: string;       // "produces M protein that cross-reacts with cardiac myosin"
  consequence: string;     // "autoimmune inflammation of myocardium"
  linkType: 'causes' | 'leads_to' | 'results_in' | 'treated_by' | 'prevented_by';
}

interface BranchPoint {
  afterLink: number;       // which link this branches from
  alternativePath: CausalLink[];  // what would happen if different
  condition: string;       // "if left untreated for >2 weeks"
}
```

**Gemini prompt for causal chain generation:**

```typescript
const causalChainPrompt = `
Generate a causal reasoning chain for the following clinical question explanation.

Question: {questionText}
Correct Answer: {correctAnswer}

INSTRUCTIONS:
1. Build a MECHANISTIC chain from underlying cause → pathophysiology → 
   clinical finding → diagnosis → treatment rationale
2. Use the format: "Entity/Process → [mechanism verb] → Consequence"
3. Each link must explain WHY, not just WHAT
4. Include 4-6 links in the primary chain
5. Mark one branch point showing where the chain diverges for the 
   most commonly confused differential diagnosis
6. End with a clinical correlation sentence connecting the chain 
   to the patient's actual presentation

EXAMPLE FORMAT:
"Group A Strep pharyngitis → [molecular mimicry: M protein cross-reacts 
with cardiac tissue] → Autoimmune myocardial inflammation → [inflammatory 
infiltrate disrupts conduction system] → New-onset heart block and 
murmur → [diagnosed by] Jones criteria + evidence of prior strep → 
[treated with] Penicillin (eradication) + Anti-inflammatory therapy"

CRITICAL: Each arrow must contain a MECHANISTIC explanation in brackets. 
Do not simply list facts. The student should understand WHY each step 
leads to the next.
`;
```

**UI component:** Render as a horizontal chain with expandable nodes. Each link shows the entity and consequence by default; clicking expands the mechanism detail. This supports progressive disclosure and interacts with the scaffolding fading system (Item 7) — experts see just the chain, novices see expanded mechanisms.

### FSRS pipeline integration

Causal chain explanations replace or augment existing post-answer explanations. They don't directly modify FSRS scheduling, but they interact with two other systems: (1) **CRPL learning signals** — time spent engaging with the causal chain (expanding nodes, re-reading) indicates depth of processing and uncertainty, (2) **Scaffolding fading** (Item 7) — as expertise increases, the chain progressively collapses from full mechanism display to abbreviated links to just the key clinical correlation.

### Pitfalls

- **Causal oversimplification.** Medical pathophysiology often involves parallel, bidirectional, and feedback-loop causation. Linear A→B→C chains can misrepresent complex pathophysiology. Include branch points and mark where the chain simplifies reality.
- **LLM hallucination in mechanism details.** LLMs may invent plausible-sounding mechanisms that are biochemically incorrect. Implement RAG grounding against a curated pathophysiology knowledge base (e.g., Pathoma, First Aid content mapped to mechanisms).
- **Cognitive load from chain complexity.** Chains longer than 6 links exceed working memory capacity. Cap at 6 links with optional expansion for deep dives. This aligns with Miller's 7±2 heuristic and cognitive load theory.

---

## 5. Pre-answer confidence judgments improve learning through JOL reactivity and the hypercorrection effect

### Research and current state

**JOL reactivity** — the finding that making a Judgment of Learning can itself improve memory — was meta-analyzed by Double, Birney, and Walker (2018, *Memory*). The overall effect was **non-significant** (g = 0.054), but this masks a critical moderator: **for meaningfully related material** (word pairs, integrated content), reactivity was moderate and significant (g = 0.32–0.38). Medical flashcards with integrated clinical concepts fall squarely in this category, suggesting the reactivity effect will benefit PANaCEa users.

The mechanisms are complementary: making a JOL forces **elaborative processing** (searching for cues, assessing associative strength), reduces **mind wandering**, and engages **metacognitive monitoring** — all of which deepen encoding.

**The hypercorrection effect** (Butterfield & Metcalfe, 2001) is even more directly relevant: high-confidence errors are corrected more readily than low-confidence errors. The mechanism is **surprise-driven attention capture** — fMRI shows enhanced anterior cingulate and medial frontal activity during high-confidence error correction (Metcalfe et al., 2012, *J Cogn Neurosci*). The effect persists over one-week delays (Butler, Fazio, & Marsh, 2010). This means a confidence slider **before** answer reveal sets up a prediction that, when violated, produces enhanced learning of the correct answer.

**Medical student overconfidence is well-documented.** A 2024 BMC Medical Education study (N=426 first-year students) found **35.5% overestimated their performance**, with a correlation of ρ = −0.590 between actual scores and self-assessment — the classic Dunning-Kruger pattern. Confidence sliders generate calibration data that helps students recognize and correct overconfidence.

### Technical implementation

**Scale design decision:** Research comparing Likert scales and visual analog scales (VAS) suggests **a 5-point categorical scale** optimizes the tradeoff between granularity and speed for a mobile flashcard app. Ferrando et al. (2025, *Psicothema*) found that beyond 7 categories, labels cause confusion. For finer-grained analysis, a continuous 0–100 VAS captures more information but adds response burden. Recommendation: **5-point tap buttons** (Not confident → Somewhat → Moderate → Confident → Certain) for speed, with the option to upgrade to a slider in settings.

```typescript
interface ConfidenceJudgment {
  cardId: string;
  reviewId: string;
  preAnswerConfidence: number;   // 1-5 or 0-100
  postAnswerCorrect: boolean;
  calibrationError: number;      // |confidence - accuracy|
  timestamp: Date;
}

// Calibration tracking per user
interface CalibrationProfile {
  userId: string;
  overconfidenceIndex: number;   // mean(confidence - accuracy) when positive
  underconfidenceIndex: number;  // mean(accuracy - confidence) when positive
  brierScore: number;            // mean((confidence - outcome)²)
  calibrationByDifficulty: Map<DifficultyBin, number>;
  updatedAt: Date;
}
```

**Confidence-to-CRPL integration:**

```typescript
function integrateConfidenceWithCRPL(
  crplSignals: CRPLSignals, 
  preConfidence: number
): AugmentedSignals {
  // Confidence serves as both:
  // 1. An independent signal for rating derivation
  // 2. A calibration target for CRPL's implicit signals
  
  // If confidence and implicit signals agree → high certainty rating
  // If they disagree → flag for calibration analysis
  const agreement = Math.abs(
    normalizeToUnit(preConfidence) - crplSignals.confidence
  );
  
  return {
    ...crplSignals,
    explicitConfidence: preConfidence,
    signalAgreement: 1 - agreement,
    // Weight explicit confidence into final rating
    implicitRating: CONFIDENCE_WEIGHT * mapConfidenceToRating(preConfidence)
      + (1 - CONFIDENCE_WEIGHT) * crplSignals.implicitRating
  };
}
```

### FSRS pipeline integration

Confidence data integrates at two points: (1) **As an input to CRPL** — explicit confidence is weighted alongside implicit signals to derive the FSRS rating. A student who reports high confidence but responds slowly (implicit signals suggest uncertainty) triggers a "disagreement" flag that defaults to the more conservative (lower) rating. (2) **As a scheduling modifier** — high-confidence errors should receive shorter intervals than standard lapses because the hypercorrection effect means the student is primed to learn the correct answer. This can be implemented as a post-lapse stability multiplier: `S_lapse *= (1 + hypercorrection_boost * preConfidence)`.

### Pitfalls

- **JOL fatigue.** Asking for confidence on every single card creates friction. Research suggests the reactivity effect occurs even with intermittent JOLs. Implement a sampling strategy: request confidence on ~30% of cards, with higher probability for cards near the decision boundary (FSRS retrievability 0.7–0.9).
- **Slider anchoring.** The default position of a slider (left? center?) biases responses. Use no default — require active selection to prevent satisficing.
- **Overconfidence reinforcement.** If overconfident students consistently rate high confidence and get questions right (because the questions are too easy), the system reinforces miscalibration. Cross-reference confidence against card difficulty — flag when confidence stays high but difficulty is low.
- **Double, Birney, and Walker's (2018) age caveat.** The JOL reactivity effect may be negative for some individuals and populations. Monitor for users whose performance decreases after implementing the confidence slider and offer an opt-out.

---

## 6. Forty seconds of nature imagery measurably restores sustained attention

### Research and current state

Kaplan's Attention Restoration Theory (1995) posits that directed attention fatigues during effortful cognitive work and is restored by environments that engage "soft fascination" — involuntary attention requiring no effort. Natural environments possess the four restorative qualities: being away, extent, fascination, and compatibility.

**The most directly relevant study for PANaCEa is Lee et al. (2015, *J Environ Psychol*).** In this experiment (N=150), participants viewing a flowering green roof image for just **40 seconds** showed a **6% increase in concentration** and significantly fewer omission errors, while those viewing a bare concrete roof showed an **8% decline**. This demonstrates that even extremely brief nature image exposure during digital tasks measurably restores sustained attention.

**Optimal break frequency.** Multiple studies converge on **25–30 minutes** as the natural ceiling for sustained directed attention (Risko et al., 2012; Sharpe et al., 2025, *Front Psychol*). Sharpe et al. found 90-second micro-breaks every 10 minutes during seminars led to sustained quiz performance. However, a PLOS ONE meta-analysis (2025, 22 samples, N=2,335) found micro-breaks have **small effects** on cognitive performance (d = 0.16, non-significant) — significant effects were limited to **less cognitively demanding tasks**. Flashcard review falls closer to vigilance/sustained attention than deep reasoning, where micro-break evidence is strongest.

**Interruption timing is critical.** Bailey and Konstan (2006, *Comput Hum Behav*) found interruptions during active task execution increased errors by **100%**, time by **3–27%**, and annoyance by **31–106%** compared to interruptions at task boundaries. **Breaks must trigger between cards, never during recall.**

### Technical implementation

```typescript
interface MicroBreakConfig {
  // Trigger conditions (OR logic)
  cardInterval: number;          // break every N cards (default: 25)
  timeInterval: number;          // break every N minutes (default: 15)
  errorSpike: boolean;           // trigger if error rate spikes >2σ
  
  // Break parameters
  minDuration: number;           // 40 seconds (Lee et al. minimum)
  maxDuration: number;           // 90 seconds default
  extendable: boolean;           // user can opt for longer break
  
  // Content
  imagePool: NatureImage[];      // curated nature images
  imageCategory: 'green' | 'water' | 'sky' | 'mixed';
}

interface NatureImage {
  url: string;
  category: string;
  artProperties: {
    fascination: number;     // soft fascination score (curated)
    beingAway: number;       // psychological distance score
    extent: number;          // scene richness score
  };
  attribution: string;
}

// Break trigger logic
function shouldTriggerBreak(session: StudySession): boolean {
  const cardsSinceBreak = session.cardsReviewed - session.lastBreakAtCard;
  const timeSinceBreak = Date.now() - session.lastBreakTimestamp;
  const recentErrorRate = computeRecentErrorRate(session, windowSize: 10);
  
  return (
    cardsSinceBreak >= session.config.cardInterval ||
    timeSinceBreak >= session.config.timeInterval * 60000 ||
    (session.config.errorSpike && recentErrorRate > session.baselineErrorRate + 2 * session.errorStd)
  );
}
```

**UI implementation:**

The break screen should: (1) fade in smoothly after the current card's answer is revealed and processed (never interrupt mid-recall), (2) display a full-bleed nature image with a countdown timer, (3) show session progress ("You've reviewed 25 cards — 73% correct"), (4) frame the break positively ("Your brain is consolidating what you just learned"), (5) auto-resume when the timer ends with a gentle transition, (6) allow the user to extend the break but not skip it (for enforced breaks).

### FSRS pipeline integration

Micro-breaks don't interact with FSRS scheduling directly. They interact with CRPL: the first 2–3 cards after a break may show artificially altered response times (faster from restored attention, or slower from context-switching). CRPL should flag post-break cards and optionally exclude them from response time baselines or apply a post-break normalization factor.

### Pitfalls

- **User annoyance.** The biggest risk is users disabling or circumventing enforced breaks. Mitigate by: (1) keeping breaks short (40–60 seconds), (2) making them feel rewarding (beautiful imagery, progress celebration), (3) showing evidence-based messaging ("Studies show a 40-second nature break boosts focus by 6%"), (4) allowing frequency customization within evidence-based bounds.
- **Mobile vs. desktop.** Nature images need to be high-resolution and optimized for both orientations. A library of ~200 curated images stored on Cloudflare R2 with responsive variants avoids bandwidth issues.
- **Pomodoro conflict.** The 2025 PMC study found Pomodoro's rigid schedule led to faster fatigue increase than self-regulated breaks. Offer an adaptive mode that adjusts break frequency based on error rate and session duration rather than fixed intervals.
- **Habituation.** The same 10 nature images will lose their restorative effect. Rotate images and vary scene types (forests, meadows, water, mountains). Ginns et al. (2023) used video rather than stills for stronger effect — consider short 10-second nature video clips.

---

## 7. FSRS parameters can drive expertise-adaptive scaffolding with explanation fading

### Research and current state

**The expertise reversal effect** (Kalyuga, Ayres, Chandler & Sweller, 2003, *Educ Psychol*) is one of the most robust findings in instructional design: techniques that help novices become **detrimental for experts**. Kalyuga's (2007) review of 26 studies found **consistent, large effect sizes (d = 0.45–2.99)** between low and high prior knowledge learners. The mechanism is cognitive load: novices need external guidance to compensate for absent schemas, but experts have internal schemas that make the same guidance redundant — forcing them to reconcile internal and external representations wastes cognitive resources.

**Explanation fading** is the solution. Renkl, Atkinson, and colleagues developed backward fading of worked examples: progressively removing solution steps as learners demonstrate competence. Atkinson, Renkl, and Merrill (2003, *J Educ Psychol*) found that fading combined with self-explanation prompts produced **medium to large effects on near and far transfer** without additional time on task. Renkl, Atkinson, and Große (2004, *Instr Sci*) showed fading triggers productive self-explanation activities.

**Adaptive fading outperforms fixed fading.** Salden, Aleven, Schwonke, and Renkl (2010, *Instr Sci*) compared fixed vs. adaptive fading in Cognitive Tutor: adaptive fading (triggered by knowledge tracing) produced **d = 0.91** vs. problem solving and **d = 0.74** vs. fixed fading on delayed posttests. The adaptive procedure used fewer examples in later sections (mean 4.71 vs. 8.43), demonstrating efficiency. The key: fading decisions were driven by real-time expertise assessment, not a fixed schedule.

### Technical implementation

**Expertise level derivation from FSRS parameters:**

```typescript
enum ExpertiseLevel {
  NOVICE = 1,      // Full scaffolding
  DEVELOPING = 2,  // Partial fading
  COMPETENT = 3,   // Significant fading
  EXPERT = 4       // Minimal scaffolding
}

function assessExpertise(card: FSRSCard, history: ReviewHistory[]): ExpertiseLevel {
  const stability = card.stability;
  const difficulty = card.difficulty;
  const consecutiveSuccesses = countConsecutiveSuccesses(history);
  const avgGrade = mean(history.slice(-5).map(r => r.rating));
  const lapseRate = countLapses(history, last: 10) / 10;
  
  // Composite expertise score
  const score = 
    0.3 * normalize(stability, min: 1, max: 365) +      // memory durability
    0.2 * (1 - normalize(difficulty, min: 1, max: 10)) + // ease of consolidation
    0.2 * normalize(consecutiveSuccesses, min: 0, max: 8) +
    0.2 * normalize(avgGrade, min: 1, max: 4) +
    0.1 * (1 - lapseRate);
  
  if (score < 0.25) return ExpertiseLevel.NOVICE;
  if (score < 0.50) return ExpertiseLevel.DEVELOPING;
  if (score < 0.75) return ExpertiseLevel.COMPETENT;
  return ExpertiseLevel.EXPERT;
}
```

**Scaffolding levels for explanations:**

| Level | Explanation Content | Causal Chain | Contrast Table | Confidence Prompt |
|-------|-------------------|-------------|----------------|-------------------|
| NOVICE | Full explanation + causal chain expanded + mnemonic | All mechanism brackets visible | Full table auto-displayed | Always shown |
| DEVELOPING | Full explanation + causal chain collapsed | Click to expand mechanisms | Table available on tap | 50% of cards |
| COMPETENT | Key facts only + causal chain skeleton | Entity → Consequence only | Available in menu | 25% of cards |
| EXPERT | One-line clinical pearl | Not shown unless requested | Not shown unless requested | Rare sampling |

**Regression detection and scaffold restoration:**

```typescript
function checkForRegression(
  card: FSRSCard, 
  currentLevel: ExpertiseLevel,
  latestReview: ReviewOutcome
): ExpertiseLevel {
  // Lapse detection: any "Again" rating restores one level of scaffolding
  if (latestReview.rating === Rating.Again) {
    return Math.max(ExpertiseLevel.NOVICE, currentLevel - 1);
  }
  
  // Stability drop detection
  if (card.stability < card.previousStability * 0.5) {
    return Math.max(ExpertiseLevel.NOVICE, currentLevel - 1);
  }
  
  // Confidence miscalibration: high confidence + wrong answer
  if (latestReview.preConfidence > 4 && !latestReview.correct) {
    return Math.max(ExpertiseLevel.NOVICE, currentLevel - 1);
  }
  
  return currentLevel;
}
```

**Fading transition UI:** Use CSS transitions to smoothly collapse explanation sections over a 300ms animation. When scaffolding is restored, expand sections with a gentle pulse animation to draw attention. The transition should never feel jarring — students should barely notice the progressive simplification.

### FSRS pipeline integration

Expertise assessment runs after every review, using the FSRS-updated card parameters (S, D, R) plus review history. The scaffolding level is stored per card per user and determines what post-answer content is rendered. This creates a feedback loop: FSRS parameters → expertise level → scaffolding amount → student engagement → CRPL signals → FSRS rating → updated parameters. The loop is stable because FSRS parameters change gradually and expertise levels have hysteresis (regression requires explicit failure, not just borderline performance).

**Interaction with the confidence slider (Item 5):** Confidence miscalibration (high confidence + wrong answer) triggers scaffold restoration. This creates a productive interaction: overconfident students get more scaffolding, which addresses both the expertise reversal effect and the Dunning-Kruger pattern documented in medical students.

### Pitfalls

- **Premature fading.** Tawfik et al. (2018, *Comput Hum Behav*) found sustained scaffolding outperformed faded scaffolding when scaffolds were removed for assessment. In FSRS terms: a card with high stability might have been scaffolded so well that the student hasn't built independent understanding. Guard against this by requiring **multiple successful retrievals at low retrievability** (desirably difficult retrieval) before advancing expertise level.
- **Domain-specificity.** Expertise is topic-specific, not global. A student expert in cardiology may be a novice in endocrinology. Scaffolding levels must be per-card or per-topic, never global. FSRS's per-card S and D values naturally support this.
- **Threshold sensitivity.** The four-level cutoffs (0.25/0.50/0.75) are arbitrary starting points. These must be empirically tuned against actual learning outcomes. Start conservative (keep scaffolding longer) and fade gradually based on population-level regression analysis.
- **Student perception.** Some students may perceive fading as the app "giving up on them" or providing less value. Add optional transparency: "You've mastered this concept — we're showing you expert-level review" with the ability to manually request full explanations.

---

## Cross-cutting architecture and integration map

These seven features form an interconnected system with clear data flows:

```
Question Presented
    → Confidence Slider (Item 5) captures pre-answer JOL
    → Student responds
    → CRPL (Item 2) captures behavioral telemetry
    → Confidence + CRPL → Implicit Rating derived
    → Rating → FSRS-7 (Item 1) computes next S, D, R
    → S, D, history → Expertise Assessment (Item 7)
    → Expertise Level determines:
        ├── Explanation depth: Causal Chain (Item 4) display level
        ├── Contrast Table (Item 3) visibility
        └── Confidence Slider frequency
    → Micro-break check (Item 6) at card boundary
    → Next card presented
```

**Implementation priority order:** Start with Item 1 (FSRS-7 / schema migration to floats) since it's the foundation. Ship Item 5 (confidence slider) and Item 2 (CRPL validation) in parallel since they cross-validate each other. Follow with Items 3 and 4 (AI-generated content) since they're independent of the scheduling pipeline. Layer Item 7 (scaffolding fading) on top once expertise signals are flowing. Add Item 6 (micro-breaks) last as it's the most independent feature.

**Shared infrastructure needs:** A Gemini prompt management system with versioned prompts, A/B testing capability, and a content review queue serves both Items 3 and 4. A per-card expertise state store (likely a Prisma model with userId + cardId composite key) serves Items 5 and 7. A session telemetry pipeline collecting response times, confidence judgments, hesitation events, and engagement metrics serves Items 2, 5, 6, and 7.

## Conclusion

The strongest evidence bases among these seven features belong to the confidence slider (JOL reactivity + hypercorrection effect, with direct experimental support) and expertise-adaptive scaffolding (expertise reversal effect, d = 0.45–2.99, with the Salden et al. adaptive fading study showing d = 0.91). The contrastive illness script tables also rest on strong evidence (50% accuracy improvement in Hatala et al.; Hautz & Kämmer's synthesis), as does causal chain reasoning (Woods et al.'s experiments showing superior diagnostic accuracy and transfer). FSRS-7 is the most technically uncertain — it's still benchmark-only with undocumented internals — but the float-interval schema migration should proceed regardless since it benefits same-day scheduling under FSRS-6 too. The micro-breaks feature has the smallest direct evidence for cognitive performance (PLOS ONE meta-analysis: d = 0.16, non-significant overall) but the Lee et al. 40-second green roof study provides a compelling specific mechanism for sustained attention restoration during flashcard review. The CRPL validation is the highest-risk item: FSRS deliberately excludes response time, and the community favors simplicity. However, neural network models that incorporate review duration outperform FSRS in benchmarks, confirming the signal exists — the challenge is extracting it without introducing the noise that made the FSRS team exclude it in the first place.