# StudyPANaCEa deep-dive audit: FSRS v6, AI variants, and session orchestration

StudyPANaCEa is positioned at the intersection of three fast-moving research areas — FSRS v6 scheduling, LLM-generated medical MCQs, and interleaved session orchestration — and the competitive landscape has a genuine gap this PWA can exploit: **none of UWorld, AMBOSS, Rosh, Osmosis, Kaplan, or Picmonic schedules vignettes on a forgetting curve with AI-generated variants**, and none expose calibration plots or offline-first review submission. The highest-leverage audit targets are (1) correctness of the FSRS v6 integration (21 params, short-term branch, idempotent review submit, optimizer run out-of-edge), (2) separation of a FSRS-only `ReviewLog` from a rich `QuestionAttempt` telemetry table so implicit signals never corrupt the optimizer, and (3) a variant-generation pipeline with structured Gemini output, independent fact-check, isomorphism verification, and NCCPA blueprint tagging. This report delivers framework-based audit checklists for each of these areas plus recommended schemas, telemetry signals, dashboard visualizations, and a prioritized impact/effort matrix.

---

## 1. The three-layer mental model you should audit against

Before inspecting files, verify that the codebase embodies this separation of concerns. It is the single most common architectural mistake in SRS apps at StudyPANaCEa's stage.

| Layer | What it owns | What it must not touch |
|---|---|---|
| **FSRS layer** (`ts-fsrs` scheduler + `ReviewLog`) | Card state (stability, difficulty, due, state, reps, lapses, last_review), explicit user ratings, 21-parameter vector, desired retention | Implicit telemetry, behavioral confidence, dashboard rollups, Gemini calls |
| **Telemetry layer** (`QuestionAttempt`, `SessionLog`, event bus) | Response time, hover, scroll, tab blur, answer changes, confidence self-rating, session fatigue | FSRS grades, scheduling math |
| **Content layer** (`Question`, Gemini pipeline, RAG grounding) | Stems, options, rationales, blueprint tags, IRT b, provenance (model/prompt hash, RAG source ids) | User scheduling state, session orchestration |

If a single row crosses two layers, or if a Gemini call fires inside a review-submit handler, or if `ReviewLog` columns carry mouse-event payloads, you have architectural debt. Fix this first; everything downstream compounds.

---

## 2. FSRS v6 pipeline: the deep technical audit

### 2.1 What v6 actually is, and what to verify

FSRS v6 adds two trainable parameters to FSRS-5's 19, totaling **21**. `w19` tapers the short-term (same-day) stability update so mature cards are less affected by within-day re-reviews, and `w20` becomes a trainable **decay exponent** on the power forgetting curve `R(t, S) = (1 + factor · t/S)^(−w20)` with `factor = 0.9^(−1/w20) − 1`. Constraints to encode: `w15 ∈ (0, 1)`, `w16 ∈ (1, 6)`, `w20 ∈ [0.1, 0.8]`, `D ∈ [1, 10]`, `S ≥ 0.01`. Canonical default vector (Expertium/fsrs4anki wiki):

```
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

**Benchmark context (Expertium, 2025)**: FSRS-6 (recency-weighted) beats Anki SM-2 on 99.6% of Anki collections, SM-17 on 83.3%, FSRS-5 on 88.2%. Optimized FSRS-6 beats default FSRS-6 on 84.3% of collections — **optimization matters but is not mandatory** to ship.

### 2.2 FSRS code checklist (run against your repo)

**Parameters and configuration**

1. `user.fsrsParams.w.length === 21` and `fsrsVersion === 6` are enforced at the ORM/zod boundary; rows with `length ∈ {17, 19}` are migration-flagged, not silently reinterpreted.
2. Every call site that constructs `fsrs(params)` passes the user's `w[]` via `generatorParameters({ w, request_retention, enable_fuzz, enable_short_term, maximum_interval, learning_steps, relearning_steps })`, never the library defaults.
3. `enable_short_term: true` is plumbed through; misconfig silently disables FSRS-5/6 same-day logic.
4. `desired_retention` is a per-user (or per-preset) `FsrsParams.desiredRetention`, not hardcoded 0.9. Medical-student sweet spot is **0.88–0.92**; above 0.94 the review load explodes.
5. `learning_steps` ≤ 1 day (recommended `['10m', '30m']`); `relearning_steps: ['10m']`. Longer steps break FSRS's scheduling assumptions.

**Card state and review submit**

6. `Card` persists **all 10 fields**: `due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review`.
7. `state` stored as enum `{NEW, LEARNING, REVIEW, RELEARNING}` and mapped to ts-fsrs numeric `State` in exactly one adapter.
8. New cards are initialized with `createEmptyCard()`, not manual construction.
9. The review path uses `scheduler.next(card, now, rating)` — `scheduler.repeat()` is **preview-only** and must never write.
10. `now` is `new Date()` on the server; client-supplied timestamps are rejected.
11. `elapsed_days` is server-computed from `floor((now − last_review) / 86_400_000)`; the browser never supplies it.
12. The `UserCard` update and `ReviewLog` insert are atomic — either a Prisma interactive transaction (on Neon WebSocket or Prisma Postgres) or a single CTE statement (works on Neon HTTP, which does not support interactive transactions).
13. `ReviewLog` is inserted on **every** rating including `Again`. Grep every call site of `scheduler.next` to verify.
14. Idempotency: `@@unique([userId, clientId])` on `ReviewLog`, with `clientId = UUIDv7` generated client-side, so Workbox retries on reconnect never double-apply.
15. `reviewedAt` defaults to `now()` server-side (`DEFAULT now()`), not client-supplied.

**Time, units, fuzz**

16. All timestamps are `timestamptz` in Postgres (Prisma `DateTime` maps correctly). Verify by `\d+ "ReviewLog"` at psql.
17. Intervals are **days (integer)** everywhere — never mixed with seconds/ms as Anki's legacy `ivl` field does.
18. Fuzz is applied **server-side only**. If the client shows interval previews, it calls `fsrs({ enable_fuzz: false })` for the preview; the server re-runs with `enable_fuzz: true` to produce the authoritative `due`. Alternatively use `GenSeedStrategyWithCardId('id')` for deterministic seeded fuzz so client/server agree.
19. User IANA timezone stored on `User.tz`; used for the "today's due" day-boundary display only. FSRS math stays UTC.

**Content edits**

20. Editing a Question's stem/options/explanation does **not** touch UserCard fields. Add a `contentVersion` column instead.
21. An explicit "Reset card" action calls `scheduler.forget(card, now)` and writes a ReviewLog with `rating = MANUAL` for audit.

**Optimizer**

22. Optimizer does **not** run inside a Cloudflare Pages Function. The `@open-spaced-repetition/binding` NAPI package and `fsrs-rs` both require WASI, which Workers/Pages Functions do not support. Run via:
   - GitHub Actions cron (Python `fsrs-optimizer` or `fsrs-rs-python`), or
   - Railway/Fly.io Node worker triggered by Cloudflare Queues, or
   - Cloudflare Cron Trigger → fetch to an external Node-runtime serverless function.
23. Gate optimizer UI behind **~400 reviews** (Anki's 24.06+ threshold). Below that, ship defaults; the auto-param-subset-selection the optimizer does below this floor is not worth the UX complexity.
24. Re-optimize cadence: monthly, or every doubling of review count (100 → 200 → 400 → 800). Not on every login.
25. Filter same-day duplicates (keep first chronological rating per card per day) and `rating = MANUAL` before feeding to the optimizer.
26. Optimizer writes `w[]`, `desiredRetention` (if you auto-tune it), `optimizedAt`, `reviewCountAtOpt`, and persists **log-loss and RMSE(bins)** so you can refuse to apply a worse optimization and keep a rollback snapshot.

**Edge runtime**

27. `PrismaClient` is instantiated per request inside the handler, not module-scoped (Prisma issue #20566).
28. Database transport is known and correct for your use case: Prisma Postgres (`@prisma/adapter-ppg`, HTTP/WS, full edge support) or Neon (`@prisma/adapter-neon`, HTTP for single statements, WebSocket for interactive transactions). Hyperdrive + `@prisma/adapter-pg` is the third viable path.
29. Bundle size is under your Cloudflare plan limit; `@prisma/client` with a driver adapter is typically the largest chunk.
30. `ts-fsrs` import is top-level (tree-shakable), not dynamic-per-request.

### 2.3 Recommended `FsrsParams` + `ReviewLog` Prisma shape

```prisma
enum CardState { NEW LEARNING REVIEW RELEARNING }
enum Rating    { AGAIN HARD GOOD EASY }

model FsrsParams {
  userId              String   @id
  w                   Float[]                  // length 21 for v6
  desiredRetention    Float    @default(0.9)
  enableFuzz          Boolean  @default(true)
  enableShortTerm     Boolean  @default(true)
  maximumInterval     Int      @default(36500)
  fsrsVersion         Int      @default(6)
  optimizedAt         DateTime?
  reviewCountAtOpt    Int      @default(0)
  lossAtOptimization  Float?
  updatedAt           DateTime @updatedAt
}

model UserCard {
  id              String    @id @default(cuid())
  userId          String
  questionId      String
  due             DateTime
  stability       Float
  difficulty      Float
  elapsedDays     Int       @default(0)
  scheduledDays   Int       @default(0)
  learningSteps   Int       @default(0)
  reps            Int       @default(0)
  lapses          Int       @default(0)
  state           CardState @default(NEW)
  lastReview      DateTime?
  suspended       Boolean   @default(false)
  @@unique([userId, questionId])
  @@index([userId, due])
  @@index([userId, state])
  @@index([userId, state, due])
}

model ReviewLog {
  id               BigInt    @id @default(autoincrement())
  userId           String
  userCardId       String
  rating           Rating
  stateBefore      CardState
  dueBefore        DateTime
  stabilityBefore  Float
  difficultyBefore Float
  elapsedDays      Int
  lastElapsedDays  Int
  scheduledDays    Int
  learningSteps    Int
  reviewedAt       DateTime  @default(now())
  clientId         String?                      // UUIDv7 idempotency key
  attemptId        String?                      // FK to QuestionAttempt (forensic)
  @@index([userId, reviewedAt])
  @@unique([userId, clientId])
}
```

Add a partial index for the hot due-queue path via a raw migration:

```sql
CREATE INDEX user_due_active ON "UserCard" (userId, due)
  WHERE state != 0 AND suspended = false;
```

### 2.4 FSRS antipatterns to grep for

| Smell | Fix |
|---|---|
| `Date.now()` in client to compute elapsed days | Server-side only |
| Only persisting latest state, no ReviewLog | Optimizer dies; append-only ReviewLog on every rating |
| `Rating.Hard` used as "failed" | FSRS models Hard as a pass; always use Again for fails |
| Mixing FSRS states with "archived"/"flagged" | Separate boolean columns |
| Fuzz client-side without seed | Client/server diverge on `due` |
| Missing `enable_short_term` | Same-day branch silently off |
| N+1 loop on due queue | `findMany({ include: { question } })` |
| Optimizer in a Page Function | Nightly cron elsewhere |
| Hard-coded `desired_retention = 0.9` | Per-user |
| Treating new-state card with `last_review = null` then `now - null` | Branch on `state = NEW` first-review path |

---

## 3. Data collection, analytics, and presentation

### 3.1 Signal catalog (add any missing)

| Signal | Capture | Storage | Use | Research basis |
|---|---|---|---|---|
| Response time (first-look, decision, total) | `performance.now()` between render → first submit | `QuestionAttempt.responseMs`, `hesitationMs` | Par-time z-scores, fatigue detection | van der Linden lognormal RT-IRT (Psychometrika 2007) |
| Hesitation | Render → first option tap | `hesitationMs` | Effort classification | Beck (2004) engagement tracing; ASSISTments |
| Option hover | Throttled `pointerover` with dwell | `hoverSequence` (jsonb) | Hypothesis-generation proxy | Shih/Koedinger hint-read time |
| Scroll behavior | Depth + reversal count on vignette | `scrollReversals` | Reread/struggle proxy | Heffernan assistance model |
| Tab blur / visibility | `visibilitychange` accumulates away_ms | `awayMs` | Subtract from RT; flag lookup | Baker/Corbett/Koedinger gaming detection |
| Answer changes | Each option click before submit | `answerChanges` | Refines BKT slip parameter | Corbett-Anderson BKT |
| Self-rating | Optional 4-point confidence | `confidenceSelf` | Calibration input | Dunlosky/Koriat metacognition |
| Behavioral confidence (predicted) | Logistic on RT/hover/changes | `confidencePred` | Weak-topic surface, readiness | Separate secondary model |
| Time-of-day | `Date.now()` + user IANA tz | `tod` (0–23) | Circadian heatmap | Pavlik LKT |
| Session position | Ordinal within session | `SessionLog.nReviews` + position | Fatigue slope | Beck RT-disengagement |

**Critical architectural rule**: behavioral confidence runs as a parallel model (logistic regression or gradient boost) that predicts `P(correct | features)` using log-transformed RT z-scored within user × item-type. Its output feeds dashboards and weak-topic surfacing, but **never overwrites or augments the FSRS `rating` stream** — doing so corrupts the MLE on S/D and poisons future optimization.

### 3.2 Prisma schemas for the data layer

Use the `UserCard`, `FsrsParams`, `ReviewLog` shapes from §2.3, plus:

```prisma
model QuestionAttempt {
  id              String   @id @default(cuid())
  userId          String
  questionId      String
  sessionId       String
  startedAt       DateTime
  submittedAt     DateTime
  responseMs      Int
  hesitationMs    Int
  awayMs          Int
  selectedOption  String
  correct         Boolean
  answerChanges   Int
  hoverSequence   Json
  scrollReversals Int
  confidenceSelf  Int?
  confidencePred  Float?
  kcTags          String[]
  blueprintArea   String
  tod             Int
  @@index([userId, submittedAt])
  @@index([userId, questionId])
  @@index([blueprintArea])
}

model SessionLog {
  id           String   @id @default(cuid())
  userId       String
  startedAt    DateTime
  endedAt      DateTime?
  deviceType   String
  nReviews     Int
  nCorrect     Int
  meanRtMs    Int
  fatigueSlope Float?
  tod          Int
  @@index([userId, startedAt])
}

model BlueprintCoverage {
  userId        String
  area          String
  subArea       String?
  nccpaWeight   Float
  questionsSeen Int
  questionsDue  Int
  questionsMast Int
  accuracy      Float
  meanStability Float
  predTheta     Float
  updatedAt     DateTime
  @@id([userId, area, subArea])
}

model UserProgress {
  userId           String   @id
  totalReviews     Int
  retention7d      Float
  retention30d     Float
  retention90d     Float
  avgStabilityDays Float
  brierScore       Float
  ece              Float
  examReadiness    Float
  lastSyncedAt     DateTime
}
```

### 3.3 Telemetry pipeline to verify

Events emitted client-side as `{v, user_id, session_id, card_id, event_type, t_client, monotonic_ms, payload}`. Buffer in-memory, flush every 5 s or 50 events; on `visibilitychange=hidden` use `navigator.sendBeacon` to drain. Offline-queued via `idb` in an `outbox` store; Workbox `BackgroundSyncPlugin` drains to `POST /v1/events:batch`. Server validates, de-dupes on `(user_id, event_id)`, inserts into a `telemetry_event(event_id uuid, user_id, session_id, ts, kind, payload jsonb)` table. Nightly `REFRESH MATERIALIZED VIEW CONCURRENTLY` produces `mv_retention_7_30_90`, `mv_topic_mastery`, `mv_calibration_bins`, `mv_due_forecast`, `mv_tod_performance` for dashboards — keeping user-facing reads O(1).

### 3.4 Dashboards to build (ranked by impact)

| Rank | Visualization | Data source | Why it wins |
|---|---|---|---|
| 1 | **NCCPA blueprint heatmap + coverage %** (organ system × task category grid) | `BlueprintCoverage` | Maps directly to the exam; no competitor ties this to FSRS memory state |
| 2 | **30-day due-load forecast** (bar + "what if DR = 0.85/0.90/0.92" simulation) | Anki FSRS Simulator port | Manages cram anxiety; unique outside Anki |
| 3 | **Exam-readiness prediction with CI** | Ensemble of FSRS R(t) average over blueprint + Elo θ + behavioral confidence, isotonic-calibrated | The "one number" students want; matches Rosh/AMBOSS/UWorld but with uncertainty band |
| 4 | **Empirical vs predicted retention curve** (7/14/30/60/90-day bins) | `ReviewLog` grouped by elapsed_days bucket | Diagnostic; triggers auto-reoptimize if gap > 3% |
| 5 | **Weak-topic surface** (blueprint-weighted priority list) | `BlueprintCoverage` + FSRS R(t) | Analogous to AMBOSS priority bars |
| 6 | **Calibration plot + Brier trajectory** (reliability diagram, 10 bins; Brier over time) | `mv_calibration_bins`; rolling 500-attempt Brier | **Differentiator — no competitor ships this** |
| 7 | **Time-of-day performance heatmap** (7×24 grid, accuracy + RT z-score) | `QuestionAttempt.tod, dayOfWeek` | Behavioral nudge; uncontested in med-ed |
| 8 | **Forgetting curve per topic drill-down** (`R(t) = (1 + t/(9S))^(−w20)` overlay) | per-card S from `UserCard` | Power users |
| 9 | **GitHub-style streak calendar** | `ReviewLog` daily counts | Habit formation |
| 10 | **Peer percentile** (defer until n large enough) | Cross-user aggregates | Privacy/cohort constraints |

**ECE pitfall**: a model predicting the base-rate scores ECE = 0 with zero accuracy; always report Brier alongside. Use Platt scaling or isotonic regression if you find systematic miscalibration.

### 3.5 Learner-modeling stack to add on top of FSRS

FSRS is a card-level memory model — it does not estimate KC-level mastery. Layer on:

- **Elo per-KC × per-user**, online on every `QuestionAttempt.correct`, K adaptive (start 0.4, decay to 0.1 by n ≥ 30) — cold-start friendly.
- **PFA or LKT nightly batch** as a second-opinion mastery estimate with spacing/answer-change features.
- **Stacked logistic** blending (FSRS R, Elo θ, behavioral ŷ) → isotonic-calibrated against historical PANCE pass/fail once data exists.

Cite: Corbett & Anderson 1994 (BKT); Piech et al. 2015 (DKT, AUC 0.86 vs BKT 0.69 on ASSISTments); Pavlik, Cen, Koedinger 2009 (PFA); Pavlik, Eglington, Harrell-Williams 2021 (LKT); Pelánek 2016 (Elo in education).

---

## 4. Question generation and variant pipeline

### 4.1 PANCE blueprint weight table (NCCPA, effective January 2025)

| Category | 2025 Weight |
|---|---|
| Cardiovascular | 13% |
| Pulmonary | 10% |
| Gastrointestinal / Nutrition | 9% |
| Musculoskeletal | 8% |
| EENT | 7% |
| Reproductive | 7% |
| Endocrine | 7% |
| Neurologic | 7% |
| Genitourinary/Renal | 6% |
| Infectious Diseases | 6% |
| Psychiatry/Behavioral | 6% |
| Professional Practice | 6% |
| Dermatologic | 5% |
| Hematologic | 5% |
| Surgery (overlay, cross-cutting) | 8–10% |
| Pediatrics (overlay, cross-cutting) | 12–15% |

Task axis (each medical item is also tagged): History & Physical, Diagnostic & Laboratory Studies, Diagnosis, Clinical Intervention, Pharmaceutical Therapeutics, Health Maintenance/Patient Education, Professional Practice. A generator must sample {system, task, surgical_flag, pediatric_flag} proportionally and audit the batch distribution against these weights within ±2% before ingesting.

### 4.2 Variant taxonomy

| Type | Preserves | Typical trigger | Risk |
|---|---|---|---|
| Isomorphic | Construct, difficulty, reasoning path | Spaced re-exposure to same concept | Accidental answer change if demographics alter diagnosis probability |
| Parametric | Construct, mostly difficulty | Formula/threshold items (Wells, CHADS-VASc, anion gap) | Out-of-range values creating implausible vignette |
| Distractor rotation | Construct, correct-answer identity | Drill stem-locked fact recall | Recycled distractors still cue the right answer |
| Clinical reskinning | Construct | Mitigate demographic bias / stem memorization | Cultural stereotype injection |
| Stem paraphrase | Construct, answer, difficulty | Robust cue-encoding | Paraphrase too aggressive → different concept |
| Adversarial near-miss | Construct; ↑ difficulty | Edge-of-competency probing | Unfair difficulty spike; feedback becomes essential |

**Isomorphism verification gate** (must all pass before shipping a variant as "same concept"):
1. Schema/knowledge-graph equivalence — both items map to the same (disease, task, action) triple.
2. Answer-key invariance after option shuffle.
3. Embedding cosine distance in a medical embedding (MedCPT, BioLORD) within `[0.2, 0.8]` — novel enough, same enough.
4. Independent LLM-judge (different model) confirms "same objective at same cognitive level."
5. If calibrated, IRT `b` drift across variants < 0.3 logits.

### 4.3 Pipeline stages to audit

1. **Seed retrieval** — sample blueprint coordinate weighted by NCCPA + underserved-coverage bonus; retrieve 3–8 grounding chunks from a curated corpus (StatPearls is open-access on NCBI Bookshelf — safe to index; UpToDate requires a license, plan accordingly) into a RAG prompt, stamping each chunk with a provenance hash.
2. **Generation** — Gemini 2.5 **Pro** for novel items, **Flash** for variants. Use `responseMimeType: application/json` + `responseJsonSchema` enforcing `{stem, options[], correct_index, per_option_rationales[], blueprint_tags, difficulty_guess, source_ids[], bloom_level}`. Bake Haladyna constraints into the system prompt.
3. **Schema validation** — reject on invalid JSON, wrong option count, empty rationales, or missing tags.
4. **Independent-model fact-check** — a separate Gemini 2.5 Flash call with a different RAG slice asked to verify each atomic claim in stem, correct answer, and each distractor via NLI; contradiction → reject.
5. **Flaw detection** — deterministic linter encoding Haladyna rules: grammatical cueing, length-based convergence, absolute terms, negative stems without bolded `NOT`, "all/none of the above", option overlap, complex-MC (Type K), culturally insensitive content.
6. **Blueprint tag verification** — classifier (structured enum output) re-tags and must agree with generator's tag; mismatch → manual review queue.
7. **Difficulty estimation** — pre-calibration LLM proxy (reading level + concept rarity + reasoning depth); post-calibration live IRT `b` updated nightly.
8. **Expert review queue** — PA/MD reviewers see items ranked by `risk × blueprint-gap` to maximize reviewer leverage.
9. **Monitoring** — per-item p-value, point-biserial, time-to-answer, flag rate, IRT residuals; auto-quarantine on `a < 0.2` OR flag-rate > 5% OR source retraction.

**Provenance** — every row stores `{model_version, prompt_hash, rag_chunk_hashes, reviewer_id, timestamps, irt_revision}`. This is non-negotiable if a guideline changes or a source is retracted.

### 4.4 Model comparison (2024–2026 medical MCQ generation)

| Model | MedQA | Strengths | Weaknesses |
|---|---|---|---|
| Gemini 2.5 Pro | ~86–88% est. | 1M-token context; `responseJsonSchema` with property-order preservation; 90%-off prompt caching (~$0.125–0.25/M cached vs $1.25–2.50/M regular) | Structured-output quirks on earlier 2.5-pro-preview builds |
| Gemini 2.5 Flash | ~70–78% est. | Cost/latency leader; same JSON schema support | Weaker multi-step clinical reasoning |
| GPT-4o / o1 | ~88–91% | Reasoning + tool use | Aligned-model drop vs GPT-4-base noted in Med-PaLM 2 paper |
| Claude 3.5/4 Sonnet/Opus | mid-80s to ~89% | Careful clinical style; low-hallucination tone | Higher cost |
| Med-PaLM 2 | 86.5% | Medical fine-tuning; physician-preferred on 8/9 axes | Google Cloud partners only |
| MedGemma 27B / 4B | 87.7% / 64.4% | Open-weight; multimodal rad/path | Requires safety fine-tuning |

**Tiered routing pattern to audit**: cheap-first cascade — Flash generates candidates, Pro only escalates on (a) low fact-check confidence, (b) failed isomorphism, (c) blueprint-tag disagreement, (d) complex reasoning path. Cache stable system prompts (Haladyna rules + blueprint + few-shot exemplars) so per-variant marginal cost is near-zero.

### 4.5 Variants vs repeats — evidence summary

Roediger & Karpicke's testing effect is robust; Bjork's desirable-difficulties framework predicts that harder successful retrievals yield better long-term retention. Repeated identical items produce **stem memorization** — surface-pattern matching instead of concept encoding. Isomorphic variants defeat this by forcing reconstruction from a new surface form (transfer-appropriate processing). Repeated retrieval of varied isomorphs also drives the **forward testing effect**, improving learning of subsequent material.

**Caveat that constrains the pipeline**: overly hard variants without feedback can break the testing effect, especially for low-working-memory learners — per-distractor rationales are not optional.

### 4.6 IRT → FSRS bridge

3PL: `P(θ) = c + (1 − c) / (1 + e^(−a(θ − b)))`. NBME uses 3PL for USMLE scoring and equating. To seed FSRS D before per-user data accumulates:

```
D_init = clamp(1, 10, 5.5 + 1.5 · b)   // b = 0 → D = 5.5; b = +3 → D = 10
```

This gives cold-start scheduling intelligence without waiting for the ~400-review optimizer threshold.

### 4.7 AI-generation audit checklist (30 items)

1. JSON schema valid and all required fields populated.
2. Stem contains central idea; no irrelevant filler.
3. No negative stems unless `NOT`/`EXCEPT` is bolded and justified.
4. Configured option count (4 or 5), all grammatically parallel.
5. No "all/none of the above"; no Type K complex MC.
6. Options homogeneous in length (max/min ratio < 1.6).
7. No absolute terms (always/never) in distractors.
8. No repeated words between stem and **only** the correct option (grammatical cueing).
9. Correct-answer position balanced across batch (χ² p > 0.05).
10. Each distractor has a specific, non-generic rationale.
11. Correct answer has explicit evidence citation to a RAG source id.
12. Blueprint tag `{system, task, ped_flag, surg_flag}` present and verified by classifier.
13. Blueprint distribution of batch matches NCCPA within ±2%.
14. Difficulty estimate present; post-calibration IRT `b` in `[-3, +3]`.
15. Discrimination `a > 0.3` (flag `a < 0.2`).
16. Pseudo-guessing `c ≈ 1/k ± 0.1`.
17. No PHI / identifiable patient data.
18. Culturally neutral: names/demographics rotated; no stereotype triggers.
19. Ped/surg overlay flags consistent with content.
20. Dose/unit values medically plausible and within guideline ranges.
21. Lab values with units and reference ranges.
22. No off-label drug recommendations without disclosure.
23. Fact-check agent entailment score ≥ threshold.
24. Second-model adversarial probe did not flip correct answer.
25. Provenance hash chain intact (`model_version, prompt_hash, RAG_ids`).
26. Variant isomorphism verified if derived item.
27. Embedding distance to existing items above near-duplicate floor.
28. Reviewer sign-off with structured reason code stored.
29. Monitoring metrics scheduled (p-value, point-biserial, flag rate, time-to-answer).
30. Retirement rule defined (auto-quarantine on `a < 0.2` OR flag-rate > 5% OR source retraction).

### 4.8 Gen antipatterns to grep for

Unvalidated raw LLM output shipped to learners; missing per-distractor rationales; consistent correct-answer position bias (LLMs cluster at B/C); no provenance hash linking items to source text; drift (model upgrades silently changing style without recalibration); prompt injection via user-submitted custom-topic prompts escaping into system context; using the same model for generation and fact-check (self-consistency collapse); calibrating difficulty on < 200 exposures; model inventing citations (25–50% fabrication rates observed for base GPT-4/Bard).

---

## 5. Interleaving and session orchestration

### 5.1 Evidence base (cite these when defending defaults)

| Study | Finding | Effect size |
|---|---|---|
| Rohrer & Taylor 2007 | Interleaved math problems, delayed test | d ≈ 1.5 |
| Rohrer, Dedrick & Stershic 2015 | Interleaved 7th-grade math, 30-day test | d ≈ 0.79 |
| Rohrer et al. 2020 preregistered RCT | 7th-grade math, 1-month unannounced test | d ≈ 0.83 (61% vs 38%) |
| Kornell & Bjork 2008 | Category induction (painters); "spacing enemy of induction" overturned | d ≈ 0.99 (61% vs 35%) |
| Brunmair & Richter 2019 meta-analysis | 59 studies, 238 effect sizes | Overall g = 0.42; higher with similarity |
| Hatala, Brooks & Norman 2003 | ECG contrastive vs non-contrastive in med students | 46% vs 30% on novel ECGs |
| Monteiro et al. 2017 | ECG in novices | Blocked > interleaved for novices — design caveat |
| Dunlosky et al. 2013 PSPI | Effective learning techniques | Retrieval + distributed = high utility; interleaving = moderate |

For PANCE specifically — a massive discriminate-confusable-categories task (pneumonia vs CHF vs PE vs COPD; RA vs SLE vs psoriatic) — interleaving is the theoretical home-field advantage. The Monteiro novice caveat suggests a blended default: interleaved across confusable clusters rather than random across all 14 systems.

### 5.2 Session orchestration checklist

**Queue generation**

1. Gather order: intraday learning → interday learning → review → new (Anki v3 convention).
2. Within review, sort by ascending retrievability (FSRS ordering).
3. **Sibling burying** within session (closely-related cards from same note cooldown).
4. **Sibling dispersal** across days (FSRS Helper `Disperse Siblings` pattern).
5. Anti-clustering pass: ≤ 2 consecutive cards share primary topic tag (unless < 3 cards remain).
6. New-card insertion weighted toward **first 60% of session**, never in cool-down.
7. Deterministic tie-break (seeded PRNG by card-id + date) for reproducibility.
8. Configurable priority weight (must-know / high-yield / nice-to-know) off-by-default but exposed.
9. Session size user-configurable; default target 25–45 min, hard cap 60 min.

**Session phases**

10. Warm-up first 2–4 cards = high-retrievability reviews.
11. Ramp next ~20% = medium-difficulty reviews.
12. Peak middle ~60% = full mix including new + low-retrievability.
13. Cool-down last ~10% = high-retrievability reviews; no new cards.
14. Break nudge at ~25 min, never forced.
15. End-of-session summary uses accuracy-per-topic (not raw fails) to avoid demoralization.

**FSRS integration**

16. Learning steps < 1 day (10m, 30m recommended).
17. Short-term/same-day step honored.
18. Desired retention user-adjustable 0.70–0.97.
19. Client FSRS code matches server FSRS code (same version, same params) — snapshot-test determinism.

**Offline and sync**

20. Reviews atomically written to IndexedDB **before** network call.
21. Each review carries a client-generated UUIDv7 idempotency key.
22. Workbox `BackgroundSyncPlugin` on a named queue (`review-outbox`, `maxRetentionTime ≈ 72h`).
23. Fallback paths: `visibilitychange`, `online` event, app-foreground — Background Sync is Chromium-only.
24. Server dedupes by idempotency key.
25. FSRS state reconciliation is **server-authoritative** (recomputed from merged ordered ReviewLog).
26. Settings last-write-wins with `version` field.
27. Dead-letter path after N failed retries; user-visible affordance.
28. `navigator.storage.persist()` requested to prevent IDB eviction.
29. Multiple-tab coordination via Web Locks (`navigator.locks.request('review-sync')`) or BroadcastChannel leader election.
30. `navigator.sendBeacon` drains buffer on `visibilitychange=hidden`.

**Content and caching**

31. App shell precached with content-hashed filenames.
32. Card media cache-first with LRU (`maxEntries ≈ 2000`, 30-day max age).
33. Card content stale-while-revalidate with content-hash freshness.
34. Service Worker update strategy is **prompt** (not auto-`skipWaiting`) — don't reload mid-session.

**UX**

35. Rating buttons thumb-reachable; keyboard shortcuts 1/2/3/4.
36. Time-to-next-review hint above each rating button.
37. "Just got it wrong" UX is soft (no forced re-read modal) — brief highlight + "Next review in 10 min" hint.
38. Non-blocking sync status affordance ("N pending, last synced Xs ago, Retry now").

### 5.3 Offline conflict scenarios to test

| Scenario | Resolution |
|---|---|
| Offline review submitted twice (SW retry + foreground retry) | Idempotency key dedupes at server; second call returns first result |
| Same card reviewed on two devices offline | Both POSTs accepted (distinct UUIDv7s); server recomputes canonical FSRS state from merged log |
| Client clock skewed by hours | Store `client_reported_at` and `server_received_at`; flag skew; trust server order for placement |
| Card deleted on server while user rating offline | Server responds 410/409 with tombstone; client archives review as `orphaned` |
| Content edited server-side mid-session | Stale-while-revalidate updates `contentHash`; apply on next card |
| User changes retention target offline | Local apply; on sync server last-write-wins by `settingsVersion`; reschedules re-derived |
| Network drops after send, response lost | Client retries with same idempotency key; server returns cached result |
| User uninstalls PWA with unsynced reviews | Proactive flush on `visibilitychange=hidden` via `sendBeacon` (best effort) |
| Two tabs both drain queue | Web Locks or BroadcastChannel leader election |
| SW update during session | Show "Update ready — apply after session"; call `skipWaiting()` only on user confirmation |

### 5.4 Top 10 things to verify in the reservoir/queue/session code

1. Idempotency end-to-end: simulate 3× retry → exactly one state change.
2. FSRS determinism client-vs-server: `client_fsrs_state === server_fsrs_state` to numerical tolerance.
3. Sibling burying correctness: 4-sibling note → at most one appears per session.
4. Anti-clustering window: 100 random sessions → no 3+ consecutive cards share primary topic.
5. Ascending-retrievability ordering: snapshot test with fake cards → strictly ascending, deterministic ties.
6. Reveal-unrated discard: abandon mid-reveal → no phantom review persisted.
7. Background Sync end-to-end: throttle offline → rate 20 → reconnect → all 20 reach server with correct timestamps and distinct keys.
8. Conflict reconciliation: two offline devices rate same card differently → server merged state matches canonical recomputation.
9. Session phase unit test: 40-card session → [0..3] high-retrievability warm-up, [32..39] no new cards.
10. Learning-step FSRS contract: new card Again → Good → Good → each due matches learning-step params, not long-term interval.

---

## 6. Competitor feature matrix (what to beat, what to copy)

Legend: ✅ shipped/strong · ◐ partial/opt-in · ❌ not available · ? unverifiable.

| Feature | UWorld PA | AMBOSS | Rosh / Blueprint PA | Osmosis | Anki + AnKing | Kaplan PA | Picmonic |
|---|---|---|---|---|---|---|---|
| True question-level SRS | ❌ | ❌ | ❌ | ❌ | ✅ (SM-2 / FSRS) | ❌ | ✅ facts |
| AI-generated variants | ❌ | ◐ copilot | ❌ | ◐ on-demand | ❌ | ❌ | ❌ |
| Interleaving default | ◐ opt-in | ◐ opt-in | ◐ opt-in | ◐ | ✅ auto | ◐ | ✅ Daily Quiz |
| Tutor + Exam mode | ✅ | ✅ (Pause/Lock/Reverse/Zoom) | ✅ | ◐ UI not exam-like | n/a | ✅ | ❌ |
| % peers picking each choice | ✅ | ✅ | ✅ vs national avg | ❌ | n/a | ◐ median | ❌ |
| **Calibration plot (confidence vs correct)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Blueprint heatmap | ✅ system/subject | ✅ system/discipline/hammer | ✅ system/task | ◐ | n/a | ✅ | ❌ |
| Retention/forgetting curve UI | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Peer percentile | ✅ | ✅ | ✅ | ◐ | ❌ | ✅ | ❌ |
| Predicted score + pass probability | ✅ "Chance of Passing" + UWSA | ✅ 3-digit + pass prob | ✅ Projected + 98.8% validated | ❌ | ❌ | ❌ | ❌ |
| AI tutor / chat | ❌ | ✅ AMBOSS GPT + LiSA AI Mode | ❌ | ✅ Osmosis AI (Elsevier-grounded) | ❌ | ❌ | ❌ |
| **Offline mobile** | ❌ (known gripe) | ✅ | ✅ | ◐ | ✅ native | ◐ | ✅ |
| UpToDate refs in explanations | ❌ | ❌ | ✅ | ❌ | n/a | ❌ | ❌ |
| Anki integration | ◐ ReadyDecks | ✅ AnKing bridge | ❌ | ❌ | ✅ native | ❌ | ◐ |

### 6.1 UX patterns worth copying

1. **Per-choice % selected** + hammer-style difficulty badge (AMBOSS, Rosh) — immediate social calibration.
2. **"One Step Further" micro-Q** after each explanation (Rosh) — cheap second retrieval pass on the same concept.
3. **"Rapid Review" bullet recap** at bottom of every explanation (Rosh) — 80% of the learning object in 5 seconds.
4. **Projected 3-digit score + probability of passing** validated against real exam scores (Rosh, AMBOSS) — motivational anchor.
5. **"Search won't spoil unseen content"** safeguard (Rosh) — small but delightful.
6. **Split-view Qbank ↔ Library** with hover pop-ups on every medical term (AMBOSS).
7. **Attending Tip** (opt-in hint logged as "answered with help," filterable) (AMBOSS) — unstucks users without corrupting analytics.
8. **NBME-faithful exam chrome** (Pause, Lock for break, Reverse color, Text zoom, Rule-out X, Lab Values modal) — PANCE uses the same Pearson VUE shell.
9. **Daily Quiz with forgetting-curve rationale + streak** on home (Picmonic) — compelling surface UX even if the underlying algorithm is simpler.
10. **"Chance of Passing" categorical pill** (Very High/High/Borderline/Low) (UWorld 2025) — categorical is less anxiety-inducing than a naked number.
11. **Offline block download** (AMBOSS) — verified UWorld gripe.
12. **On-demand flashcards/summaries/mnemonics from same corpus** (Osmosis AI).
13. **AnKing tagging convention** (First Aid refs, UWorld IDs, textbook chapters) — apply to PANCE with NCCPA task+system tags.

### 6.2 Direct market gaps StudyPANaCEa can own

1. **True SRS at the question level** with AI-generated variants that defeat stem memorization — no incumbent does this for vignettes.
2. **Calibration plots** and Brier trajectory — metacognition is absent from the market.
3. **Offline-first PANCE PWA** — UWorld's #1 App Store complaint.
4. **"Give me 5 more on this objective" button** — student-facing AI Q-gen that respects NCCPA tags.
5. **Blueprint heatmap on the true 2-axis NCCPA matrix** (task × organ) — no one overlays both axes.
6. **Predicted score with CI + calibration history** (not a false-precision point estimate).
7. **Session fatigue engineering** for the real 5×60 PANCE block day.

### 6.3 Reddit / forum voice-of-customer signals

- **UWorld offline gripe (App Store)**: *"Lacks truly 'mobile' capabilities because it does not work offline… This is an inferior product to Amboss which allows you to download question sets to your device."*
- **Rosh workflow** (thepaplatform.com): *"For general studying, I prefer the 'Tutor' mode with immediate explanations, but for hardcore board studying, I want it to be like the real thing and will set a one minute timer for each question and complete 60 questions at a time."*
- **AMBOSS hammer system** (Jesse Simon DO): *"During the first few days of a rotation, I would only do 1–3 hammer questions. When I noticed I was getting 1-hammer questions correct nearly all the time, I would then start doing 2–4 hammer questions only."*
- **Rosh "probability of passing"** (PA Forum): *"How do they come up with this percentage and how accurate is it? I've been using solely Rosh Review for my PANCE preparation."* — signal that students deeply want this number but don't understand it.
- **UWorld plateau insight** (MedBoardTutors): *"A student who starts at 40% and reaches 65% by the end of their prep is in a very different position than a student who has plateaued at 55% for three weeks."* — motivates trajectory dashboards.

---

## 7. Prioritized impact/effort matrix

Rank = Impact × (1 / Effort). Scope `S` small (< 1 week), `M` medium (1–3 weeks), `L` large (> 3 weeks).

| Rank | Improvement | Impact | Effort | Why |
|---|---|---|---|---|
| 1 | Idempotent review submit with UUIDv7 + server dedupe | Critical | S | Eliminates the #1 class of silent FSRS corruption bugs |
| 2 | Atomic `UserCard` update + `ReviewLog` insert (CTE or transaction) | Critical | S | Prevents partial-state on crash / network drop |
| 3 | Verify `w.length === 21`, `fsrsVersion = 6`, `enable_short_term = true` plumbing | High | S | Fixes silent-defaults-bug class |
| 4 | Separate `QuestionAttempt` from `ReviewLog`; stop mixing implicit signals into FSRS ratings | High | M | Protects optimizer; unlocks behavioral confidence model |
| 5 | Server-authoritative fuzz + `elapsed_days` computation | High | S | Eliminates client/server drift on `due` |
| 6 | Move optimizer out of Pages Functions (GitHub Actions cron + `fsrs-optimizer`) | High | M | Only reliable path; Workers can't run WASI |
| 7 | Sibling burying within session + sibling dispersal across days | High | M | Huge UX+retention win; aligns with Rohrer/Brunmair |
| 8 | Workbox `BackgroundSyncPlugin` on review-outbox + persistent storage request | High | M | Delivers the offline-first differentiator |
| 9 | Structured Gemini output with `responseJsonSchema` + schema validator | High | S | Kills unvalidated free-text class of bugs |
| 10 | Per-distractor rationales required by schema | High | S | Core learning value + Haladyna compliance |
| 11 | Independent-model fact-check stage (Flash verifying Pro output) | High | M | Main hallucination mitigation lever |
| 12 | NCCPA blueprint heatmap dashboard (system × task) | High | M | #1 differentiator on the dashboard axis |
| 13 | Isomorphism verification gate for variants (5 checks) | High | M | Protects the AI-variant value proposition |
| 14 | Correct-answer position χ² guard across generated batch | Medium | S | Eliminates known LLM B/C bias |
| 15 | Haladyna flaw linter (grammatical cueing, absolutes, option length) | Medium | S | Item-quality floor |
| 16 | Exam-readiness score (ensemble FSRS R + Elo θ + ŷ, isotonic-calibrated, with CI) | High | L | "One number" students want; done right beats Rosh |
| 17 | Calibration plot + Brier trajectory | High | M | Unique differentiator |
| 18 | 30-day due-load forecast with DR scenarios | Medium | M | Anxiety management; port FSRS Simulator |
| 19 | Tiered Gemini routing (Flash generate → Pro escalate) + prompt caching | Medium | M | Cost discipline at scale |
| 20 | Provenance columns on `Question` (`model_version, prompt_hash, rag_chunk_hashes, reviewer_id`) | Medium | S | Auditability when guidelines change |
| 21 | Session phase orchestration (warm-up, ramp, peak, cool-down) | Medium | M | Fatigue-aware sessions |
| 22 | Anti-clustering pass (no 3+ consecutive same-topic cards) | Medium | S | Implements interleaving discrimination benefit |
| 23 | Weak-topic surface (blueprint-weighted priority list) | Medium | M | Analogous to AMBOSS priority bars |
| 24 | Time-of-day performance heatmap | Medium | S | Behavioral nudge; uncontested |
| 25 | NBME-faithful exam mode chrome (Pause/Lock/Reverse/Zoom/Rule-out) | Medium | M | Copy AMBOSS faithfully for PANCE |
| 26 | Per-user `FsrsParams.desiredRetention` (no hardcode) | Medium | S | Basic configurability |
| 27 | IRT-seeded FSRS D cold-start mapping | Low | M | Nice-to-have; only helps before optimizer runs |
| 28 | "One Step Further" micro-Q after each explanation | Low | S | Copy Rosh UX |
| 29 | GitHub-style streak calendar | Low | S | Habit formation |
| 30 | Peer percentile (defer until n ≥ 1k/cycle) | Low | L | Privacy/cohort-size constraints |

---

## 8. Closing: the three things to do this week

The audit surface is wide, but the project's durability rests on three small-effort, critical-impact investments that should precede everything else: **(1) make every review submission idempotent, atomic, and server-authoritative for time and fuzz — fix this before shipping another feature**; **(2) separate the `ReviewLog` (FSRS-only) from the `QuestionAttempt` (rich telemetry) tables so that behavioral confidence models can grow without ever corrupting the FSRS optimizer**; **(3) enforce structured Gemini output with `responseJsonSchema` plus an independent Flash fact-check pass, so the AI pipeline's failure modes are visible in JSON validation rather than buried in learner frustration**. These three moves protect every downstream bet — the variant-generation pipeline, the calibration dashboards, the exam-readiness model — and they are all small-to-medium effort.

The long game is the market gap nobody has closed: **true FSRS-scheduled vignettes with AI-generated variants, calibration metacognition, and offline-first operation**, tied to an honest NCCPA blueprint heatmap. UWorld has the content but not the scheduler; AMBOSS has the AI but not the PA focus; Rosh has PANCE authority but no SRS; Anki has the scheduler but no vignettes. StudyPANaCEa sits on the only square of this 2×2 that is open — provided the foundation is correct.

---

## Primary sources and reference implementations

**FSRS**: Expertium algorithm writeup (https://expertium.github.io/Algorithm.html), fsrs4anki wiki (https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm), ts-fsrs (https://github.com/open-spaced-repetition/ts-fsrs), py-fsrs (https://pypi.org/project/fsrs/), fsrs-rs with Burn (https://github.com/open-spaced-repetition/fsrs-rs), fsrs-optimizer (https://github.com/open-spaced-repetition/fsrs-optimizer), srs-benchmark (https://github.com/open-spaced-repetition/srs-benchmark), Anki rslib (https://github.com/ankitects/anki), FSRS4Anki Helper (https://github.com/open-spaced-repetition/fsrs4anki-helper), Ye 2022 (ACM KDD) and Ye 2023 (IEEE TKDE). **Cloudflare/Prisma**: Prisma edge deployment docs (https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare), Neon serverless driver (https://neon.com/docs/serverless/serverless-driver), Cloudflare Hyperdrive + Prisma (https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/). **Cognitive science**: Rohrer & Taylor 2007 (Instr Sci 35), Rohrer et al. 2020 (JEP 112, doi:10.1037/edu0000367), Brunmair & Richter 2019 (Psychol Bull 145, doi:10.1037/bul0000209), Dunlosky et al. 2013 (PSPI 14, doi:10.1177/1529100612453266), Bjork & Bjork 1992/2011, Kornell & Bjork 2008, Hatala et al. 2003, Monteiro et al. 2017. **AI Q-gen**: NCCPA PANCE Blueprint (https://www.nccpa.net/wp-content/uploads/PANCE-Blueprint.pdf), Haladyna/Downing/Rodriguez 2002 (https://www.tandfonline.com/doi/abs/10.1207/S15324818AME1503_5), Med-PaLM 2 (Nature Medicine, https://www.nature.com/articles/s41591-024-03423-7), Gemini structured outputs (https://ai.google.dev/gemini-api/docs/structured-output), Cloudflare Workers AI prompt caching (https://developers.cloudflare.com/workers-ai/features/prompt-caching/). **Learner modeling**: Corbett & Anderson 1994 (BKT), Piech et al. 2015 (DKT, https://stanford.edu/~cpiech/bio/papers/deepKnowledgeTracing.pdf), Pavlik/Cen/Koedinger 2009 (PFA, https://pact.cs.cmu.edu/koedinger/pubs/AIED%202009%20final%20Pavlik%20Cen%20Keodinger%20corrected.pdf), Pelánek 2016 (Elo in education, https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf), van der Linden 2007 (lognormal RT-IRT, Psychometrika). **Competitors**: AMBOSS features (https://www.amboss.com/us/features), AMBOSS GPT (https://www.amboss.com/us/gpt), Rosh/Blueprint PANCE prediction tool (https://blog.blueprintprep.com/pa/updated-pance-panre-prediction-tool-likelihood-passing-pance-panre/), UWorld PA (https://pa.uworld.com/), Osmosis AI (https://www.elsevier.com/products/osmosis/osmosis-ai), Picmonic spaced repetition (https://www.picmonic.com/pages/spaced-repetition/). **PWA**: Workbox BackgroundSync (https://developer.chrome.com/docs/workbox/modules/workbox-background-sync), MDN Background Sync (https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).