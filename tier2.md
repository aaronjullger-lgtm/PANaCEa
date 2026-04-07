# PANaCEa Tier 2 Features: Implementation Research and Architecture Plan

Six advanced features stand ready to transform PANaCEa from a capable spaced repetition platform into an intelligent, adaptive medical education system. **The highest-value implementation path begins with calibration tracking (Feature 3) and IRT/Elo ordering (Feature 6)**, which require the least new infrastructure, then layers on semantic similarity (Feature 1) and knowledge graphs (Feature 2) as the data backbone for the more ambitious readiness score (Feature 4) and consolidation review (Feature 5). Below is a complete technical blueprint for each feature — algorithms, schemas, integration points, risks, and interdependencies.

---

## Feature 1: Semantic similarity scheduling draws on the KARL algorithm

### Algorithm and theory

The **KAR³L (Knowledge-Aware Retrieval and Representations aid Retention and Learning)** system was published by Matthew Shu et al. (arXiv:2402.12291, February 2024) and represents the first content-aware spaced repetition scheduler. KARL uses a **BERT retriever** to find semantically similar cards in a student's study history, then feeds these into a **Deep Knowledge Tracing** model to predict recall probability. The key insight is that reviewing "cardiac output" creates interference with "cardiac index" — semantically similar cards compete for the same neural pathways. KARL uses **FAISS** for efficient embedding retrieval and demonstrated improved testing throughput over state-of-the-art schedulers in a 27-user online evaluation with 123,143 study logs.

The cognitive basis is well-established. Cepeda et al. (2006) showed spaced practice outperformed massed practice in **259 of 271 cases**. Crucially, **interleaving** related concepts (mixing them rather than blocking) produces nearly **2× the learning** compared to blocked practice when tested after one week (Rohrer & Taylor, 2007). The optimal strategy is to space semantically similar cards apart within a session while interleaving related topics across sessions — reducing interference while building discrimination ability.

### Embedding model options

For PANaCEa's Cloudflare Pages Functions architecture, **API-based embeddings are the practical choice**:

| Model | Dimensions | Cost | Latency | Notes |
|-------|-----------|------|---------|-------|
| Gemini `text-embedding-004` | 768 | Free tier available | ~100ms | Native to existing stack |
| OpenAI `text-embedding-3-small` | 1536 (reducible) | $0.02/1M tokens | ~80ms | Supports dimension reduction to 256/512 |
| OpenAI `text-embedding-3-large` | 3072 (reducible) | $0.13/1M tokens | ~100ms | Best quality, reducible to 256 |

**Recommendation**: Use **Gemini embeddings** since PANaCEa already integrates Gemini AI, keeping the dependency graph simple. Embed all cards at creation time, then store vectors. For a card bank of ~10,000 cards at 768 dimensions, storage is approximately **30MB** — trivial for PostgreSQL.

### pgvector storage and querying

The **pgvector** PostgreSQL extension enables native vector storage and approximate nearest neighbor (ANN) search. Two index types matter:

- **IVFFlat**: Faster to build, slightly lower recall. Best for < 100K vectors.
- **HNSW**: Higher recall, more memory, slower to build. Better for > 100K vectors with high query frequency.

For PANaCEa's scale (~10K–50K cards), IVFFlat suffices. **Prisma does not natively support pgvector** — all vector operations require `prisma.$queryRaw` with raw SQL. The Prisma team has an open feature request but no timeline.

```prisma
model Card {
  id          String   @id @default(cuid())
  // ... existing FSRS fields ...
  // embedding stored via raw SQL as vector(768)
}
```

```sql
-- Add after migration
ALTER TABLE "Card" ADD COLUMN embedding vector(768);
CREATE INDEX ON "Card" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Find 10 most similar cards
SELECT id, 1 - (embedding <=> $1) AS similarity
FROM "Card" WHERE id != $2
ORDER BY embedding <=> $1 LIMIT 10;
```

### FSRS v6 integration strategy

The cleanest integration is a **post-filter queue reorderer**. FSRS determines *which* cards are due; semantic similarity determines *presentation order*:

1. FSRS generates the day's review queue (all cards where retrievability ≤ desired_retention)
2. Compute pairwise cosine similarity between queued cards (cached, not real-time)
3. Apply a **greedy spacing algorithm**: select the next card that maximizes minimum similarity distance from the last N presented cards
4. Optionally flag "confusion pairs" — cards where a student consistently confuses semantically similar items — and explicitly interleave them for discrimination training

This approach **does not modify FSRS intervals or parameters**, avoiding any risk of disrupting the core scheduling algorithm. It only reorders within a session.

### Complexity and risks

**Implementation estimate**: 3–4 weeks (embedding pipeline, pgvector setup, queue reorderer, similarity cache).

**Key risks**: (1) pgvector requires PostgreSQL extensions — verify your hosted PostgreSQL provider supports it (Supabase, Neon, and Railway all do; some managed services restrict extensions). (2) Prisma's lack of native pgvector support means maintaining raw SQL alongside the ORM. (3) Embedding API costs scale with card creation volume, though at $0.02/1M tokens the cost for 50K cards is approximately **$0.50 total**. (4) Cold start: no similarity data exists until all cards are embedded; batch-embed existing cards on first deployment.

---

## Feature 2: Knowledge graphs enable error-driven prerequisite remediation

### Theory and medical ontology foundations

**Knowledge Tracing** dates to Corbett & Anderson's (1995) **Bayesian Knowledge Tracing (BKT)**, which models student mastery as a hidden Markov model. Modern approaches include **Deep Knowledge Tracing** (Piech et al., Stanford, 2015), which used RNNs to automatically discover prerequisite relationships from student performance data — producing coherent exercise-influence graphs that matched expert-identified prerequisites.

The **Fractional Implicit Repetition (FIRe)** model from Justin Skycak (Math Academy, 2023) provides the most practical framework for hierarchical spaced repetition. FIRe maintains two graph structures: a **prerequisite DAG** (concept A must precede concept B) and an **encompassing graph** (practicing concept B implicitly reviews concept A). When a student successfully reviews an advanced concept, credit flows downward through encompassing edges with fractional weights, reducing the need for explicit prerequisite review.

For medical concepts, existing ontologies provide scaffolding:

- **SNOMED-CT**: ~350,000 concepts with hierarchical `is-a` relationships, finding site, and causative agent links
- **UMLS Metathesaurus**: Maps across 200+ source vocabularies, includes semantic relationships
- **MeSH**: Hierarchical tree structure useful for topic categorization

However, none of these directly encode *pedagogical* prerequisites. The practical approach is to **use Gemini AI to generate prerequisite relationships** from card content, then have domain experts validate critical paths. A prompt like "Given this medical concept [cardiac output], list its prerequisite concepts that a PA student must understand first" can bootstrap the graph rapidly.

### PostgreSQL graph modeling

An **adjacency list with a closure table** is the recommended pattern — it balances write simplicity with read performance for ancestor/descendant queries:

```prisma
model Concept {
  id              String   @id @default(cuid())
  name            String
  domain          String   // PANCE organ system
  description     String?
  prerequisiteOf  ConceptEdge[] @relation("prerequisite")
  dependsOn       ConceptEdge[] @relation("dependent")
  cards           Card[]
  studentMastery  StudentConceptMastery[]
}

model ConceptEdge {
  id                  String  @id @default(cuid())
  prerequisiteId      String
  dependentId         String
  prerequisite        Concept @relation("prerequisite", fields: [prerequisiteId], references: [id])
  dependent           Concept @relation("dependent", fields: [dependentId], references: [id])
  encompassingWeight  Float   @default(0) // FIRe fractional credit
  confidence          Float   @default(1.0)
  source              String  @default("ai_generated") // "expert" | "ai_generated" | "data_mined"
  @@unique([prerequisiteId, dependentId])
}

model StudentConceptMastery {
  id            String   @id @default(cuid())
  userId        String
  conceptId     String
  concept       Concept  @relation(fields: [conceptId], references: [id])
  masteryLevel  Float    @default(0)
  lastAssessed  DateTime?
  @@unique([userId, conceptId])
}
```

**Critical Prisma limitation**: Prisma does not support recursive queries (GitHub issue #3725, still open). Graph traversal requires `prisma.$queryRaw` with PostgreSQL recursive CTEs:

```sql
WITH RECURSIVE prereqs AS (
  SELECT prerequisiteId, 1 as depth FROM "ConceptEdge" WHERE dependentId = $1
  UNION ALL
  SELECT ce.prerequisiteId, p.depth + 1
  FROM "ConceptEdge" ce JOIN prereqs p ON ce.dependentId = p.prerequisiteId
  WHERE p.depth < 10
)
SELECT DISTINCT c.* FROM "Concept" c JOIN prereqs p ON c.id = p.prerequisiteId;
```

### Error-driven remediation algorithm

When a student rates a card `Again` (FSRS lapse):

1. **Identify concepts** tagged on the failed card
2. **Traverse prerequisite graph** downward using recursive CTE (max depth ~5)
3. **Check mastery state** for each prerequisite: query `StudentConceptMastery` where `masteryLevel < 0.7`
4. **Rank weak prerequisites** by topological depth (deepest gaps first — fix foundations before superstructure)
5. **Inject remediation cards** into the session queue — either existing cards for weak concepts or AI-generated review cards via Gemini
6. **Update FSRS** for remediation cards: if a prerequisite card was previously "mature," reset its state to `Relearning` with reduced stability

### Complexity and risks

**Implementation estimate**: 5–7 weeks (concept model, graph construction, AI-assisted prerequisite generation, remediation algorithm, FIRe integration).

**Key risks**: (1) **Graph construction is the bottleneck** — building and maintaining accurate prerequisite relationships for thousands of medical concepts is a massive knowledge engineering task. AI-generation helps bootstrap but requires expert validation for safety. (2) Cycles in the graph create infinite loops — enforce DAG constraints with database triggers or application-level validation. (3) Overly aggressive remediation (surfacing too many prerequisite cards after a single failure) could frustrate students. Implement a **remediation budget** — maximum 3 prerequisite cards injected per failure.

---

## Feature 3: Calibration dashboards reveal metacognitive blind spots

### Two distinct calibration metrics

PANaCEa should track **two complementary calibration measures**, each revealing different information:

**FSRS Calibration** compares FSRS's predicted retrievability against actual recall outcomes. This measures *algorithm accuracy* — how well FSRS models each student's memory. The FSRS benchmark suite already uses **RMSE(bins)** for this: bin reviews by predicted R, compute actual pass rate per bin, then take the root mean squared difference. An RMSE of 0.05 means FSRS predictions are off by ~5% on average.

**Metacognitive Calibration** compares student self-reported confidence against actual performance. This measures *self-awareness* — students who rate themselves 80% confident but only answer 50% correctly are dangerously overconfident, a well-documented phenomenon in medical education.

### Computing calibration

The **Brier Score** is the gold-standard proper scoring rule: `BS = (1/N) × Σ(predicted - outcome)²`, where outcome is 0 (forgot) or 1 (recalled). It decomposes into **reliability** (calibration), **resolution** (discrimination), and **uncertainty** (base rate variance). Range [0, 1], lower is better.

**Expected Calibration Error (ECE)** provides more intuitive visualization: `ECE = Σ (|B_i|/N) × |accuracy(B_i) - confidence(B_i)|` across M bins. Use **adaptive/quantile binning** (equal samples per bin) rather than fixed-width bins — the calibration literature (Nixon et al., 2019) shows fixed-width binning is gameable and statistically unreliable.

For per-topic breakdowns, compute Brier scores and reliability diagrams filtered by each PANCE organ system (Cardiovascular, Pulmonary, GI, etc.). This reveals where students are overconfident (e.g., consistently rating Cardiology confidence at 4/5 but scoring 60%) versus appropriately calibrated.

### Data collection and schema

```prisma
model ReviewLog {
  id              String   @id @default(cuid())
  cardId          String
  userId          String
  rating          Int      // 1=Again, 2=Hard, 3=Good, 4=Easy
  predictedR      Float    // FSRS retrievability at review time
  selfConfidence  Int?     // 1-5 scale, optional per-review
  outcome         Boolean  // true=recalled, false=forgot
  domain          String?  // PANCE organ system
  reviewedAt      DateTime @default(now())
}
```

Add a **confidence prompt** that appears for a configurable percentage of reviews (e.g., every 5th card) to avoid survey fatigue while collecting sufficient data. Minimum **~400 reviews per bin** are needed for stable calibration estimates.

### Dashboard visualization

**Recharts** (24.8K GitHub stars, 3.6M+ weekly npm downloads) is the recommended React charting library. Core components:

- **Reliability diagram**: `<ScatterChart>` with `<ReferenceLine slope={1}>` showing the perfect calibration diagonal. Points above the line indicate underconfidence; below indicates overconfidence.
- **Per-topic heatmap**: Nivo's `<HeatMap>` showing calibration error magnitude across organ systems × time periods
- **Trend line**: `<LineChart>` plotting weekly Brier score to show metacognitive improvement
- **KPI cards**: Summary Brier Score, ECE, and over/under-confidence direction indicator

**Existing precedent**: The **Anki with Uncertainty** plugin (code: 694813595, quantifiedintuitions.org) turns flashcards into calibration training tools by having users enter confidence intervals. AMBOSS provides performance analytics with peer comparison but does not offer explicit calibration tracking — a differentiation opportunity.

### FSRS integration

FSRS v6 already computes retrievability as `R(t, S) = (1 + (19/81) × (t/S))^(-0.5)`. The dashboard can compare this predicted R against actual binary outcomes to generate a **model calibration** view with zero additional data collection — just aggregate existing review logs. Metacognitive calibration requires the additional `selfConfidence` field.

### Complexity and risks

**Implementation estimate**: 2–3 weeks (schema additions, calibration computation service, Recharts dashboard components).

**Key risks**: (1) Students may **game confidence ratings** if they believe the system uses them punitively — frame calibration as a learning tool, not an assessment. (2) Small sample sizes per topic early on produce noisy estimates — show confidence intervals and hide calibration data for domains with < 50 reviews. (3) **ECE is not a proper scoring rule** and can be minimized by always predicting the base rate — always pair it with the Brier Score.

---

## Feature 4: PANCE Readiness Score predicts exam performance from study behavior

### Evidence base for exam prediction

Published research demonstrates that study behavior data can meaningfully predict board exam performance. **AMBOSS Score Predictor** uses Bayesian statistics integrating QBank performance with NBME self-assessment scores, claiming **95% of students' real scores fall within their predicted range** (±7–10 points). **Qbankly** uses the same 3-Parameter Logistic (3PL) IRT model as the USMLE itself to estimate student ability and predict scores. Research shows QBank accuracy (especially in the **last 4–6 weeks** before the exam) is the strongest predictor, with a roughly **0.45 Step 1 point increase per 1% QBank accuracy improvement**.

However, a critical gap exists: **no prominent open-source or published model specifically predicts PANCE performance** from spaced repetition data. This would be a genuine innovation for PANaCEa.

### PANCE blueprint alignment (effective January 2025)

The NCCPA PANCE blueprint distributes 300 questions across organ systems: **Cardiovascular (11%)**, Pulmonary (9%), GI/Nutrition (8%), Musculoskeletal (8%), Infectious Disease (7%), Neurologic (7%), Psychiatry (7%), Reproductive (7%), Endocrine (6%), EENT (6%), Professional Practice (6%), Hematologic (5%), Renal (5%), Dermatologic (4%), Genitourinary (4%). Task areas span History/PE (16%), Diagnosis (18%), Clinical Intervention (16%), and Pharmaceuticals (15%).

Feature engineering should **weight metrics by blueprint percentages** — a student scoring 95% in Dermatology (4%) but 60% in Cardiovascular (11%) should see a readiness score that heavily penalizes the Cardiovascular weakness.

### Feature engineering from FSRS data

| Feature | Signal | Source |
|---------|--------|--------|
| Topic coverage | % of blueprint areas with ≥ N cards reviewed | Card-topic mapping |
| Accuracy trend | Rolling 14-day accuracy per organ system | Review logs |
| Stability distribution | % of cards with stability > 30 days ("mature") per topic | FSRS card state |
| Retrievability profile | Mean retrievability across all cards per topic | FSRS computation |
| Calibration score | Brier score per topic (from Feature 3) | Calibration service |
| Study consistency | Days studied per week, session count trend | Session logs |
| Lapse rate | Recent lapse frequency per topic | FSRS lapses |
| Difficulty profile | Mean FSRS difficulty per topic vs. population | FSRS card state |

### Edge inference via ONNX Runtime Web

A gradient boosting model (XGBoost or LightGBM) can be trained in Python, exported to ONNX format via `onnxmltools`, and run in the browser using `onnxruntime-web` with the WASM backend. For a tree ensemble with ~100 trees and ~20 features, the ONNX model file is typically **< 500KB** with **< 50ms inference latency** — comfortably within browser constraints and preserving data privacy since no study data leaves the device.

```
Train (Python) → onnxmltools.convert_xgboost() → .onnx file → 
  onnxruntime-web (WASM) → Browser-side inference
```

### Training data strategy

The cold start problem is severe: PANaCEa has no labeled data mapping study behavior to actual PANCE scores. A phased approach:

1. **Phase 1 — Heuristic score** (ship immediately): Weighted composite of coverage, accuracy, stability maturity, and calibration, using blueprint percentages. No ML required. Frame as "study progress" not "score prediction."
2. **Phase 2 — Proxy labels**: Collect self-reported PANCE scores from graduates (opt-in). Also use performance on timed practice exams within the platform as proxy labels.
3. **Phase 3 — ML model**: Once ~200+ labeled examples exist, train XGBoost. Minimum viable dataset for gradient boosting is approximately **500–1,000 samples** for reliable generalization.

### Complexity and risks

**Implementation estimate**: 4–6 weeks for Phase 1 heuristic; additional 4–8 weeks for Phase 3 ML pipeline.

**Key risks**: (1) **Regulatory and liability risk** — predicting a student will fail the PANCE carries serious consequences. Frame outputs as "readiness indicators" not "score predictions," include disclaimers, and avoid displaying pass/fail classifications. (2) Cold start may last 1–2 years before sufficient labeled data accumulates. (3) Without labeled data, the heuristic score's accuracy is unvalidated — publish no accuracy claims until validated. (4) Selection bias: students who self-report PANCE scores may not be representative.

---

## Feature 5: Pre-sleep consolidation sessions leverage sleep-dependent memory

### The evidence for pre-sleep review

Diekelmann & Born's landmark 2010 review in *Nature Reviews Neuroscience* (11, 114–126) established the **active systems consolidation** framework: during slow-wave sleep, coordinated hippocampal-cortical replay redistributes memories from hippocampal to neocortical storage. A minimum of **~90 minutes of sleep** is needed for significant declarative memory consolidation effects.

**Mazza et al. (2016)** in *Psychological Science* (27(10), 1321–1330) provided the most directly applicable evidence. Students who learned vocabulary in the evening, slept, then relearned the next morning needed **50% fewer practice trials** to reach criterion compared to those who learned in the morning and relearned in the evening (3 trials vs. 6 trials). At one week, the sleep group significantly outperformed, and at **six months the sleep group remembered approximately twice as much**. Crucially, the benefit of sleep was *amplified* by relearning — sleep and spaced practice have a synergistic interaction.

Gais, Lucas & Born (2006) confirmed that learning vocabulary close to sleep produced significantly less forgetting than morning learning (F₁,₁₁ = 9.8, P < 0.01), controlling for circadian effects. Meta-analytic effect sizes from Newbury et al. (2021) show **Hedges' g = 0.277** for sleep deprivation after learning, and **d = 0.72** for sleep consolidation of factual knowledge (Oxford Academic SLEEP, 2020) — a medium-to-large effect.

**Important caveat**: Newbury et al. flagged significant publication bias and low statistical power across individual studies. The evidence is supportive but not ironclad.

### Optimal session design

Based on the research synthesis, a consolidation session should follow these parameters:

- **Timing**: 60–120 minutes before bedtime (avoid screens within 30 minutes of sleep)
- **Duration**: 10–15 minutes maximum (Mazza used 16 items per session)
- **Content**: Active retrieval practice with feedback, not passive review
- **Difficulty**: Cards near the FSRS retrievability threshold (0.85–0.95 R) — challenging enough for retrieval effort but not so difficult they cause arousal that interferes with sleep onset
- **Priority order**: (1) Cards reviewed and failed earlier that day, (2) cards learned earlier that day (first sleep consolidation), (3) cards approaching their due date
- **Explicitly avoid**: New, highly difficult material that could cause stress or excessive cognitive arousal

### Sleep pattern detection

Three approaches, ordered by complexity:

1. **Explicit setting** (MVP): User sets bedtime in profile settings. Schedule notification for bedtime minus 90 minutes. Trivial to implement.
2. **Usage-based inference**: Track last app interaction time daily, compute 7-day rolling average. Research in *npj Digital Medicine* (2019) showed touchscreen interaction timing correlates with actigraphy sleep onset at **R² = 0.89**.
3. **Health API integration**: Apple HealthKit and Google Health Connect expose sleep data, but this requires native app capabilities not available to PWAs.

**Recommendation**: Ship with explicit bedtime setting, then add usage-based inference as an enhancement. Health API integration requires native mobile app development — out of scope for the current PWA architecture.

### Notification implementation

Web Push API with VAPID keys handles cross-browser notifications. A server-side cron job (Cloudflare Workers Cron Triggers, running every 15 minutes) groups users by timezone, matches against their notification preferences, and dispatches push notifications. **iOS PWA limitation**: push notifications only work from PWAs installed on the home screen (iOS 16.4+), and delivery timing is best-effort — browsers control when service workers wake.

### FSRS integration

Pre-sleep reviews should flow through the standard FSRS pipeline — `f.repeat(card, new Date())` with the student's rating. FSRS natively handles early reviews and adjusts stability calculations accordingly. The consolidation session is implemented as a **session-type wrapper** that selects specific cards and limits session length, while FSRS handles all scheduling math. Tag reviews with a `sessionType: "consolidation"` flag in ReviewLog to enable future analysis of whether pre-sleep reviews produce measurably better retention.

```prisma
model UserPreferences {
  id                    String   @id @default(cuid())
  userId                String   @unique
  bedtimeHour           Int?     // 0-23, user's local time
  bedtimeMinute         Int?     // 0-59
  timezone              String?  // IANA timezone
  consolidationEnabled  Boolean  @default(false)
  consolidationMinutes  Int      @default(15) // session length cap
  pushSubscription      Json?    // Web Push subscription object
}
```

### Complexity and risks

**Implementation estimate**: 3–4 weeks (preferences UI, notification infrastructure, session card selection, cron scheduling).

**Key risks**: (1) **Notification fatigue** — students receiving daily bedtime notifications may find them annoying and disable them. Make it easy to snooze or adjust frequency. (2) **Weak evidence base** for the specific claim that SRS review before sleep is better than SRS review at any other time — the research used word-pair learning, not medical flashcards. (3) **Blue light concern** — reviewing on a screen before sleep may counteract consolidation benefits. Recommend night mode/dark theme. (4) PWA notification timing is imprecise; notifications may arrive 5–15 minutes late on mobile.

---

## Feature 6: IRT/Elo hybrid optimizes within-session card ordering

### IRT fundamentals for item and student modeling

**Item Response Theory** models the probability of a correct response as a function of student ability (θ) and item parameters. The three main models:

- **1PL/Rasch**: `P(correct) = 1 / (1 + e^(-(θ - b)))` — only item difficulty (b)
- **2PL**: Adds discrimination (a): `P = 1 / (1 + e^(-a(θ - b)))` — how sharply the item differentiates ability levels
- **3PL**: Adds guessing (c): `P = c + (1-c) / (1 + e^(-a(θ - b)))` — lower asymptote for MCQs (typically c ≈ 0.20–0.25 for 4-option items)

The **information function** `I(θ) = a² × P(θ) × (1-P(θ))` peaks when θ ≈ b — items are most informative when matched to the student's ability level. This is the basis of **Computerized Adaptive Testing (CAT)**, where the next item is chosen to maximize information at the current ability estimate.

### Elo rating adaptation for education

Pelánek (2016) in *Computers & Education* (98, 169–179) established the framework for applying Elo ratings to education. Each student-item interaction is treated as a "match": the student's ability θ_student and item's difficulty θ_item are updated based on the outcome:

```
θ_student ← θ_student + K × (outcome - P_expected)
θ_item   ← θ_item   - K × (outcome - P_expected)
```

where `P_expected = 1 / (1 + e^(-(θ_student - θ_item)))` — mathematically equivalent to 1PL IRT but with **online, incremental updates** rather than batch estimation. Pelánek recommends **K ≈ 0.4** and notes that estimates converge to near-identical values as full Rasch model estimates after sufficient data (Wauters et al., 2012). Approximately **~100 students per item** yields reliable difficulty estimates.

Duolingo's **Birdbrain** system (described in IEEE Spectrum) validates this approach at scale, using "a generalization of the Elo rating system" where exercise difficulty equals the sum of component feature difficulties, updated via single-step SGD after each exercise. Their earlier **Half-Life Regression** model (Settles & Meeder, ACL 2016) improved daily engagement by **12%** over a Leitner system.

### The two-layer architecture with FSRS

The integration follows a clean separation of concerns:

- **FSRS** handles **inter-session scheduling**: determining *when* each card should next be reviewed (tomorrow, in 3 days, in 2 weeks). FSRS manages stability, retrievability, and the forgetting curve.
- **IRT/Elo** handles **intra-session ordering**: determining *which card to show next* from the pool of due cards. IRT/Elo manages item difficulty and student ability.

This avoids any conflict with FSRS's existing difficulty parameter (D, scale 1–10). FSRS D measures "how hard it is to increase memory stability" — an encoding property. IRT/Elo difficulty measures "how hard it is to answer correctly right now" — a performance property. These are related but distinct constructs. The Elo difficulty estimate can serve as a **population-level prior** for FSRS's initial D assignment for new cards.

Within a session, the ordering algorithm should:

1. Start with a medium-difficulty card (near estimated θ) as a warm-up
2. Apply **maximum information selection** — choose the card whose difficulty best matches current ability, maximizing learning efficiency
3. Interleave occasional easier cards (below θ) for confidence building and spacing
4. Track session-level fatigue: if accuracy drops below 60%, shift toward easier items

### Implementation with available libraries

**`@geekie/irt`** (npm, MIT license) provides 3PL IRT functions including `itemResponseFunction()`, `information()`, and `estimateAbilityEAP()`. It has only 16 GitHub stars and minimal maintenance, so wrapping or reimplementing the core functions (~200 lines of code) is prudent.

```prisma
model ItemDifficulty {
  id           String @id @default(cuid())
  cardId       String @unique
  eloDifficulty Float @default(0)    // Elo-estimated difficulty (logit scale)
  discrimination Float @default(1.0) // 2PL 'a' parameter
  responseCount Int   @default(0)    // observations for this item
  lastUpdated  DateTime @default(now())
}

model StudentAbility {
  id           String @id @default(cuid())
  userId       String
  domain       String  // per organ system
  eloAbility   Float   @default(0)     // Elo-estimated ability (logit scale)
  uncertainty  Float   @default(2.0)   // Glicko-style uncertainty
  responseCount Int    @default(0)
  @@unique([userId, domain])
}
```

The Elo update runs client-side for instant feedback (< 1ms computation), then syncs to the database. Cold start: initialize new items at `eloDifficulty = 0` (average) and new students at `eloAbility = 0`; uncertainty naturally decreases as data accumulates.

### Complexity and risks

**Implementation estimate**: 3–4 weeks (Elo engine, ability/difficulty tracking, session ordering algorithm, cold start handling).

**Key risks**: (1) **Parameter instability with small data** — Elo estimates are noisy until ~30 responses per item. Use Glicko-style uncertainty weighting (larger K for uncertain estimates, smaller K for well-established ones). (2) FSRS D and Elo difficulty could diverge confusingly — clearly separate these in the UI and data model. (3) **Adaptive selection bias**: if only optimal-difficulty items are presented, Elo estimates become biased toward the student's ability level (Brinkhuis et al., 2025). Periodically inject random-difficulty items (10–15% of session) for calibration. (4) Multi-dimensional ability (Cardiology θ ≠ Pharmacology θ) requires per-domain tracking, multiplying the parameter space.

---

## Cross-cutting architecture: how these six features interconnect

### Feature interaction map

The six features form a layered dependency graph where outputs from earlier features feed into later ones:

**Semantic similarity (F1) → Knowledge graph (F2)**: Embedding similarity scores can seed prerequisite relationships — if two concepts have high cosine similarity, they are candidates for prerequisite or related-concept edges. This bootstraps the knowledge graph construction.

**Calibration (F3) → Readiness score (F4)**: Per-topic Brier scores become direct input features for the readiness model. A student who is well-calibrated in Cardiovascular but poorly calibrated in Neurology presents a different risk profile than their raw accuracy alone would suggest.

**Knowledge graph (F2) → Readiness score (F4)**: Graph-derived metrics — prerequisite coverage gaps, remediation frequency, depth of mastery across prerequisite chains — are powerful predictive features for exam readiness.

**IRT/Elo (F6) → Calibration (F3)**: Elo's predicted P(correct) provides a second calibration signal alongside FSRS retrievability. Comparing three values — FSRS R, Elo P(correct), and student self-confidence — reveals whether miscalibration originates from the student's metacognition or from model error.

**All features → Consolidation review (F5)**: The pre-sleep session card selector benefits from IRT/Elo ordering (appropriate difficulty), semantic similarity (avoid presenting confusable cards before sleep), and calibration (prioritize topics where the student is overconfident and therefore at risk of forgetting).

### Recommended implementation sequence

| Phase | Feature | Weeks | Rationale |
|-------|---------|-------|-----------|
| 1 | Calibration Dashboard (F3) | 2–3 | Lowest complexity, immediate student value, foundational data collection |
| 2 | IRT/Elo Session Ordering (F6) | 3–4 | No new infrastructure, improves every study session immediately |
| 3 | Semantic Similarity (F1) | 3–4 | Requires pgvector setup; feeds into F2 |
| 4 | Knowledge Graph (F2) | 5–7 | Builds on F1's embeddings; highest knowledge engineering cost |
| 5 | Pre-sleep Consolidation (F5) | 3–4 | Leverages F6 ordering; notification infrastructure |
| 6 | PANCE Readiness Score (F4) | 4–8 | Depends on F3 calibration data; cold start requires time |

**Total estimated timeline**: 20–30 weeks for full implementation, with Phase 1–2 deliverable in **5–7 weeks** for rapid value.

### Privacy and PA student considerations

All features must respect FERPA (student educational records) and potentially HIPAA-adjacent concerns if health data (sleep patterns) is collected. Specific safeguards:

- **Readiness score** must never be shared with program directors or used for admissions decisions without explicit student consent. Frame as a personal study tool only.
- **Sleep data** should be processed client-side and stored minimally — only the notification time, not raw usage patterns.
- **Calibration data** reveals metacognitive weaknesses — ensure it's visible only to the individual student unless they opt into anonymized aggregate analytics.
- **Embedding vectors** can theoretically reconstruct card content — if cards contain patient scenarios, embeddings inherit the sensitivity of the source content.

### Medical education alignment

All features should map to the **NCCPA PANCE blueprint** for domain categorization. The distinction between **factual recall** (amenable to standard SRS) and **clinical reasoning** (requiring application, analysis, synthesis) should influence feature behavior. IRT/Elo should track separate ability parameters for recall-type versus application-type questions. The knowledge graph should encode both factual prerequisites (anatomy → pathology) and reasoning prerequisites (understanding pathophysiology → clinical decision-making). The readiness score should weight clinical reasoning items more heavily, as the PANCE increasingly emphasizes higher-order thinking over isolated fact recall.

## Conclusion

These six features represent a progression from **measurement** (calibration, IRT) through **modeling** (embeddings, knowledge graphs) to **prediction** (readiness score) and **optimization** (consolidation timing). The most strategic architectural decision is that **FSRS v6 remains the scheduling backbone** — every new feature either feeds data into FSRS, reorders its output, or wraps its sessions, but none modifies the core algorithm. This preserves the system's proven scheduling quality while layering intelligence on top. The knowledge graph and semantic similarity systems create a shared conceptual substrate that multiple features draw from, making the platform increasingly valuable as the concept graph matures. Starting with calibration and IRT/Elo — the two features requiring the least new infrastructure and delivering the most immediate per-session improvement — ensures rapid value delivery while the more ambitious graph and prediction systems are built underneath.