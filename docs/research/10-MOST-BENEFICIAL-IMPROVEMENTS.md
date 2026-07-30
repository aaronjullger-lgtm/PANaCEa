# 10 Most Beneficial Improvements for PANaCEa

*Synthesized from tier1.md, tier2.md, tier3.md, tier1augment.md, top-10-behavioral-signal-additions.md, aistack.md, HIGH_LEVERAGE_PRODUCT_IDEAS.md, and external sources (ts-fsrs, open-spaced-repetition, Anki community, competitor analysis). Ranked by expected impact × feasibility for a solo developer on Cloudflare edge.*

---

## Scoring Rubric

Each improvement is scored on three axes (1–5 scale, 5 = best):

| Axis | Definition |
|------|------------|
| **Impact** | How much does this move the needle for PANCE pass rates, study efficiency, or user retention? |
| **Feasibility** | Can this be built in ≤4 weeks by a solo dev on Cloudflare Pages Functions + Prisma? |
| **Evidence** | How strong is the published research or community validation? |

**Composite = Impact × Feasibility × Evidence** (max 125). Ties broken by PANCE domain coverage.

---

## 1. Hybrid Search (pgvector + BM25) for Clinical Library

**Composite: 125 (5 × 5 × 5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | Every user query goes through search; 49–67% retrieval failure reduction (Anthropic benchmarks) |
| Feasibility | 5 | PostgreSQL extension; no new infra; `prisma.$queryRaw` for vector ops |
| Evidence | 5 | Anthropic RAG benchmarks; ParadeDB pg_search; pgvector maturity |

**What it is:** Combine vector semantic search with BM25 lexical search via Reciprocal Rank Fusion (RRF) in a single SQL query. Medical content has exact-match failure modes (drug names, ICD-10 codes, abbreviations like STEMI) that pure vector search misses.

**Why it matters for PANCE:** Students searching "metoprolol succinate" need exact matches, not semantic approximations. Hybrid search reduces retrieval failures by 49%, rising to 67% with reranking.

**Implementation path:**
1. Enable `pg_vector` extension (Supabase already supports it)
2. Add BM25 via `pg_textsearch` (Timescale) or `pg_search` (ParadeDB)
3. Embed all clinical chunks using Gemini `text-embedding-005` (768-dim)
4. Create composite RRF query:
```sql
WITH bm25 AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY content <@> to_bm25query($1)) as rank
  FROM clinical_chunks LIMIT 20
),
vector AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $2) as rank
  FROM clinical_chunks LIMIT 20
)
SELECT id, 1.0/(60+bm25.rank) + 1.0/(60+vector.rank) as score
FROM bm25 FULL JOIN vector USING (id)
ORDER BY score DESC LIMIT 10;
```

**Sources:** aistack.md § Hybrid search; Anthropic RAG benchmarks; ParadeDB docs

---

## 2. Vercel AI SDK v6 Migration (Replace Direct Gemini SDK)

**Composite: 125 (5 × 5 × 5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | Unlocks streaming, structured outputs, tool calling, multi-model routing for every AI feature |
| Feasibility | 5 | Incremental migration; each endpoint converts independently |
| Evidence | 5 | 20M+ monthly npm downloads; production at Thomson Reuters, Clay; Cloudflare Workers native |

**What it is:** Replace `@google/generative-ai` with `ai` + `@ai-sdk/google` as the core LLM interface. Provides `streamText()`, `generateObject()` with Zod schemas, tool calling, and model registry (`createProviderRegistry`) for routing flash→pro.

**Why it matters for PANCE:** Enables streaming tutor responses (instead of waiting for full generation), structured OSCE grading (Zod-validated output), and cost optimization by routing simple lookups to Flash and complex reasoning to Pro.

**Implementation path:**
1. `npm install ai @ai-sdk/google`
2. Create provider registry: `createProviderRegistry({ google: createGoogle({ apiKey }) })`
3. Convert endpoints one-by-one:
   - Tutor: `streamText()` + `toDataStreamResponse()` → React `useChat`
   - Ghost Grader: `generateObject()` with Zod schema
   - OSCE: `tool()` functions with `stopWhen: stepCountIs(5)`
4. Model routing: `registry.languageModel('google:gemini-2.5-flash')` for factual, `google:gemini-2.5-pro` for reasoning

**Sources:** aistack.md § Vercel AI SDK; Vercel AI SDK docs; @ai-sdk/google README

---

## 3. Lapse Severity Index (Behavioral Signal #1)

**Composite: 100 (5 × 4 × 5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | Lapses after long stability are the strongest signal of fragile knowledge; current FSRS treats all lapses identically |
| Feasibility | 4 | Single function in `drillReviewService.ts`; log to existing telemetry |
| Evidence | 5 | Bjork & Bjork (2011); FSRS v4 paper acknowledges lapse handling as weakest part; Kornell et al. (2015) |

**What it is:** When a card that was previously recalled correctly is now answered incorrectly, compute severity based on pre-lapse streak length and stability. A lapse after 8 correct reviews across months is qualitatively different from a lapse after 2.

**Why it matters for PANCE:** Cards that "look mastered" but fail are the most dangerous for exam day. Lapse severity triggers more aggressive rescheduling, preventing false confidence.

**Implementation path:**
```typescript
// In drillReviewService.ts, when isCorrect === false and card was in review state:
const lapseSeverity = Math.log2(1 + card.reps) * Math.log2(1 + card.stability);
const difficultyPenalty = 1 + 0.15 * lapseSeverity;
newCard.difficulty = clamp(newCard.difficulty * difficultyPenalty, 1, 10);
// Store in ReviewLog.telemetry.server_computed
```

**Sources:** top-10-behavioral-signal-additions.md §1; Bjork & Bjork (2011); Ye (2024) FSRS v4

---

## 4. Socratic ZPD Tutor (Leveraging LearnLM)

**Composite: 100 (5 × 4 × 5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | Addresses "why not B?" explanations — the #1 user need in medical Q&A; 5.5pp improvement on novel problems |
| Feasibility | 4 | Gemini API with system instructions; no fine-tuning required; ~$0.006/session |
| Evidence | 5 | Eedi RCT: 5.5pp improvement; LearnLM preferred over GPT-4o in 82% of blind comparisons; Paul & Elder taxonomy |

**What it is:** A Socratic tutor calibrated to the Zone of Proximal Development (ZPD) using FSRS retrievability (R). Cards with R 0.4–0.75 are in the ZPD — challenging enough to require effort but not so forgotten that scaffolding cannot bridge the gap.

**Why it matters for PANCE:** Students don't just want the answer — they want to understand *why* option B is wrong. Socratic questioning builds deep understanding, not just recognition.

**Implementation path:**
1. Compute ZPD from FSRS state: `R ∈ [0.4, 0.75]` → in ZPD
2. Generate system prompt with student's FSRS state:
```
You are a medical education tutor. The student is reviewing [topic].
Their recall probability is [R], difficulty is [D], reviews: [n], lapses: [lapses].
- If R < 0.4: Use clarification questions, provide scaffolding
- If 0.4 ≤ R < 0.75: Use evidence-probing and perspective questions
- If R ≥ 0.75: Challenge with implication and application questions
Never give the answer directly. Guide through Socratic questioning.
```
3. Progressive hint escalation: (1) open-ended → (2) narrowing → (3) fill-in-blank → (4) full explanation
4. Use LearnLM via Gemini 2.5/3.1 system instructions (PARTS framework)

**Sources:** tier1.md §3; tier3.md §2; Eedi RCT (2024); Google LearnLM docs; Murray & Arroyo (2002)

---

## 5. Distractor Interaction Chronometry (Behavioral Signal #2)

**Composite: 96 (4 × 4 × 6)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Captures decision topology beyond switch count; identifies "knew it but second-guessed" pattern |
| Feasibility | 4 | Client-side event logging + server-side derivation; no new infrastructure |
| Evidence | 6 | Sherbina (2022): chronometry reproduces process-of-elimination information; Gierl et al. (2017) meta-analysis |

**What it is:** Log which answer options the learner interacted with (hovered, clicked, changed) and for how long, before settling on their final answer. Derive: `uniqueOptionsConsidered`, `finalOptionRank`, `correctOptionEverSelected`, `longestDistractorDwellMs`.

**Why it matters for PANCE:** If a student selected the correct answer then switched away, that's a strong signal of fragile knowledge (partial understanding susceptible to interference). If they never considered more than 1 option and got it right, that's either mastery or a lucky guess — distinguishable by response time.

**Implementation path:**
1. Client-side: Log `{ optionId, selectedAt, deselectedAt }` into `optionInteractions[]`
2. Server-side: Derive features:
   - `uniqueOptionsConsidered`: count of distinct options tried
   - `finalOptionRank`: was final answer the 1st, 2nd, or 3rd option tried?
   - `correctOptionEverSelected`: boolean — did they ever select correct then switch?
3. Feed into confidence: more unique options → lower confidence; `correctOptionEverSelected && !isCorrect` → strong negative signal
4. Store as `telemetry.option_interactions` array

**Sources:** top-10-behavioral-signal-additions.md §2; Sherbina (2022); Gierl et al. (2017)

---

## 6. Contextual Retrieval for Clinical Content (RAG Enhancement)

**Composite: 96 (4 × 4 × 6)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | 35% retrieval failure reduction with one-time preprocessing; every subsequent query benefits |
| Feasibility | 4 | LLM prepend at ingestion time; ~$1.02/M document tokens; Gemini prompt caching makes it cheaper |
| Evidence | 6 | Anthropic contextual retrieval benchmarks; proven at scale; one-time cost |

**What it is:** Before embedding each chunk at ingestion time, an LLM prepends context explaining where the chunk fits in the source document. A chunk about "daily subcutaneous injections" becomes "This section from the Type 2 Diabetes management guidelines describes the insulin therapy protocol..."

**Why it matters for PANCE:** Medical content loses critical context when chunked. "The treatment protocol involves daily subcutaneous injections" means nothing without knowing it's about Type 2 Diabetes insulin therapy. Contextual retrieval preserves this.

**Implementation path:**
1. At ingestion time, for each chunk:
   - LLM generates 1-sentence context prefix
   - Prepend to chunk before embedding
   - Store both raw and contextualized versions
2. Use Gemini with prompt caching (75% discount on cached content)
3. Batch process existing content library (~$1.02/M tokens)

**Sources:** aistack.md § Advanced RAG; Anthropic contextual retrieval benchmarks

---

## 7. Explanation Engagement Depth (Behavioral Signal #3)

**Composite: 80 (4 × 4 × 5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Post-answer engagement is the strongest predictor of retention; currently unmeasured |
| Feasibility | 4 | Client-side telemetry in ExplanationPanel; no backend changes needed |
| Evidence | 5 | Rawson & Dunlosky (2007): elaborative interrogation improves retention; explanation engagement predicts re-learning savings |

**What it is:** After a learner submits an answer and views the explanation, measure how deeply they engage: scroll depth, time spent, expandable sections clicked.

**Why it matters for PANCE:** Students who skim explanations retain less than those who deeply engage. Measuring engagement depth enables: (1) identifying students who need prompting to engage, (2) calibrating explanation length/complexity, (3) feeding engagement data into FSRS stability.

**Implementation path:**
1. In `ExplanationPanel`, log:
   - `explanationViewedMs`: time from answer reveal to next-question click
   - `explanationScrollDepth`: 0.0–1.0 (fraction scrolled)
   - `expandedSections`: count of expandable rationale sections clicked
2. Compute `engagementDepth = (scrollDepth × 0.4) + (min(viewedMs / 30000, 1) × 0.4) + (min(expandedSections / 3, 1) × 0.2)`
3. Feed into stability: low engagement → reduce stability multiplier by 0.1–0.2

**Sources:** top-10-behavioral-signal-additions.md §3; Rawson & Dunlosky (2007)

---

## 8. Longitudinal Patient (Chronic Care Simulation)

**Composite: 80 (5 × 4 × 4)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 5 | Addresses the #1 gap in PANCE prep: continuity of care across visits |
| Feasibility | 4 | Gemini Live API Session Resumption; store `new_handle` in DB per user/simulation |
| Evidence | 4 | PANCE Domain: Managing Patients (~16%); no direct competitor offers longitudinal state |

**What it is:** A patient who returns weeks later, remembering exactly what was prescribed and developing new complications based on that specific treatment. Session 1: student prescribes Lisinopril → `new_handle` encodes state. Session 2: patient presents with dry cough (ACE inhibitor side effect).

**Why it matters for PANCE:** Most simulators reset after every session. Continuity of care — connecting cause and effect across visits — is a major PANCE domain and a failure point for students.

**Implementation path:**
1. Use Gemini Live API `SessionResumptionUpdate` + `new_handle`
2. Store `new_handle` per user/simulation in DB
3. Design prompts so resumed character references prior prescriptions and timeline
4. Start with hypertension → heart failure progression (high-yield PANCE topic)

**Sources:** HIGH_LEVERAGE_PRODUCT_IDEAS.md §1; Gemini Live API docs; PANCE Blueprint Managing Patients

---

## 9. Knowledge Graph Prerequisite Remediation (FIRe Model)

**Composite: 72 (4 × 3 × 6)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Error-driven prerequisite review; prerequisite failures cascade to advanced topics |
| Feasibility | 3 | Requires graph structure + credit flow; moderate schema changes |
| Evidence | 6 | FIRe model (Skycak, Math Academy, 2023); Deep Knowledge Tracing (Piech et al., 2015); prerequisite DAGs validated in medical education |

**What it is:** When a student fails a card, the system traverses the prerequisite graph to identify which foundational concepts need review. Successful review of advanced concepts flows credit downward through encompassing edges with fractional weights.

**Why it matters for PANCE:** A student failing "Heart Failure Management" may actually lack understanding of "Cardiac Output Physiology." Without prerequisite tracing, they keep reviewing the advanced topic while the real gap goes unaddressed.

**Implementation path:**
1. Define prerequisite DAG in `conditionRegistry.ts` (medical prerequisite relationships)
2. On failure, traverse backward to find lowest-confidence prerequisite
3. Inject prerequisite review cards into session queue
4. On success, flow credit forward through encompassing graph

**Sources:** tier2.md § Feature 2; Skycak (2023) FIRe model; Piech et al. (2015) DKT

---

## 10. AI-Generated Visual Mnemonics for Leech Cards

**Composite: 72 (4 × 4 × 4.5)**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Impact | 4 | Leech cards are the biggest efficiency drain; visual mnemonics have medium effect size (g=0.65) |
| Feasibility | 4 | Two-step pipeline (LLM concept → image generation); $0.005/image; store in R2 |
| Evidence | 4.5 | Paivio dual coding theory; 2021 meta-analysis g=0.65; Meenu et al. (2022) 8.4 vs 4.8 scores; AnkiAIUtils validates pipeline |

**What it is:** When a card is identified as a leech (high difficulty, low stability, repeated lapses), generate a visual mnemonic: the LLM designs a memorable association, then an image model generates the illustration.

**Why it matters for PANCE:** Leech cards waste disproportionate study time. Visual mnemonics create dual encoding (verbal + visual), improving retention by 8.4 points in medical students.

**Implementation path:**
1. Detect leeches: `lapseCount > threshold AND stability < stabilityFloor AND reviewCount > minimumReviews`
2. Step 1: Gemini generates mnemonic concept + image prompt
3. Step 2: Image generation (Gemini Imagen 3 or DALL-E 3 at $0.04/image)
4. Store in Cloudflare R2: `mnemonics/{userId}/{cardId}.png`
5. Overlay on card back with show/hide toggle

**Sources:** tier3.md §1; Paivio (1986) dual coding; 2021 meta-analysis g=0.65; AnkiAIUtils; anki-mnemonic-imagegen

---

## Summary Table

| Rank | Improvement | Composite | Impact | Feasibility | Evidence | Primary PANCE Domain |
|------|-------------|-----------|--------|-------------|----------|---------------------|
| 1 | Hybrid Search (pgvector + BM25) | 125 | 5 | 5 | 5 | All (search quality) |
| 2 | Vercel AI SDK v6 Migration | 125 | 5 | 5 | 5 | All (AI infrastructure) |
| 3 | Lapse Severity Index | 100 | 5 | 4 | 5 | Applying Basic Science |
| 4 | Socratic ZPD Tutor (LearnLM) | 100 | 5 | 4 | 5 | Clinical Intervention |
| 5 | Distractor Interaction Chronometry | 96 | 4 | 4 | 6 | Clinical Intervention |
| 6 | Contextual Retrieval (RAG) | 96 | 4 | 4 | 6 | All (content quality) |
| 7 | Explanation Engagement Depth | 80 | 4 | 4 | 5 | Applying Basic Science |
| 8 | Longitudinal Patient | 80 | 5 | 4 | 4 | Managing Patients |
| 9 | Knowledge Graph Prereq Remediation | 72 | 4 | 3 | 6 | Managing Patients |
| 10 | AI Visual Mnemonics (Leech Cards) | 72 | 4 | 4 | 4.5 | Applying Basic Science |

---

## Implementation Phasing

### Phase 1 (Weeks 1–4): Infrastructure + Highest-ROI Signals
- **Week 1–2:** Vercel AI SDK v6 migration (unlocks streaming, structured outputs, tool calling)
- **Week 3–4:** Hybrid search (pgvector + BM25) for clinical library

### Phase 2 (Weeks 5–8): Behavioral Telemetry
- **Week 5–6:** Lapse Severity Index + Distractor Interaction Chronometry
- **Week 7–8:** Explanation Engagement Depth

### Phase 3 (Weeks 9–12): AI-Powered Features
- **Week 9–10:** Socratic ZPD Tutor with LearnLM
- **Week 11–12:** Contextual Retrieval pipeline for clinical content

### Phase 4 (Weeks 13–16): Advanced Features
- **Week 13–14:** Longitudinal Patient (Gemini Live Session Resumption)
- **Week 15–16:** Knowledge Graph Prerequisite Remediation

### Phase 5 (Weeks 17–20): Polish + Visual Learning
- **Week 17–18:** AI-Generated Visual Mnemonics for leech cards
- **Week 19–20:** Integration testing, A/B testing, calibration

---

## Cross-Cutting Concerns

| Concern | Notes |
|---------|-------|
| **Edge runtime** | All logic in `functions/` must use Web APIs only; no Node `fs`/`path`/`process.cwd` |
| **Auth & privacy** | Longitudinal patient state, uploaded PDFs, and procedure videos are PII/sensitive |
| **Cost** | Gemini Live resumption, high-thinking calls, and image generation have per-use cost; rate limit, cache, scope |
| **PANCE alignment** | Each improvement maps to a content area; tag analytics so progress reports by domain |
| **Binary ratings** | All improvements respect the binary (Again/Good) constraint; CRPL behavioral telemetry compensates for missing Hard/Easy signals |

---

## Sources

1. **tier1.md** — FSRS-7 upgrade, semantic similarity, knowledge graphs, metacognitive interventions
2. **tier2.md** — KARL algorithm, FIRe model, readiness score, consolidation review, calibration, IRT/Elo
3. **tier3.md** — Visual mnemonics, Socratic ZPD tutor, LearnLM tutoring, semantic confusion, fatigue detection
4. **tier1augment.md** — Binary rating with CRPL behavioral inference
5. **top-10-behavioral-signal-additions.md** — Lapse Severity, Distractor Chronometry, Explanation Engagement, etc.
6. **aistack.md** — Vercel AI SDK v6, hybrid search, Mastra, medical APIs (RxNorm, NPI, RxImage)
7. **HIGH_LEVERAGE_PRODUCT_IDEAS.md** — Longitudinal Patient, Polypharmacy Synthesizer, Sterile Field Guardian
8. **ts-fsrs** (open-spaced-repetition) — FSRS v6 implementation, `fsrsForcingSplit`, v6.0.0 release
9. **open-spaced-repetition/fsrs4anki** — FSRS-7 research, srs-benchmark reference
10. **Anki community** — Binary rating debate, leech detection, review throughput data
11. **Competitor analysis** — Neural Consult, BEYOND PANCE, BoardVitals, Lecturio, UWorld PA, UMock
12. **Research papers** — Bjork & Bjork (2011), Sherbina (2022), Gierl et al. (2017), Paivio (1986), Eedi RCT (2024)
