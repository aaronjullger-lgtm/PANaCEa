# PANaCEa: Research vs. Implementation Gap Analysis

**Date**: April 12, 2026
**Scope**: Comparison of four research bodies (three from current conversation + prior roadmap) against actual codebase state derived from 30+ skill files, past conversation analysis, and architecture documentation.

**Scoring key**:
- ✅ **IMPLEMENTED** — Feature exists in production code and is wired into the pipeline
- 🟡 **PARTIAL** — Some aspect is built, but the research-recommended version is more sophisticated
- ❌ **NOT IMPLEMENTED** — Research recommends it; no evidence of it in the codebase
- 🔵 **AHEAD OF RESEARCH** — PANaCEa's implementation exceeds or predates what the literature recommends

---

## 1. SPACED REPETITION CORE (FSRS)

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| FSRS v6 with 21 trainable parameters | ✅ | `lib/fsrs.ts` (639 lines). Full DSR model with R = (1 + t/(9·S))^(−1). 21 w-params, state machine (New/Learning/Review/Relearning). |
| Personalized parameter optimization via ML on review history | ✅ | `fsrsOptimizerService.ts` — coordinate descent optimizer. Also `gcp-fsrs-optimizer/main.py` for batch training. Circadian-aware parameter training per phase. |
| Default desired retention of 0.90 | ✅ | Configured as default. |
| Mean-reversion on difficulty to prevent ease-hell | ✅ | Difficulty pulls toward 5.0 via w[7], per FSRS v6 spec. |
| Minimum 400–1,000 reviews before optimization | 🟡 | Optimizer exists but minimum-data gating threshold not confirmed in skill docs. |
| FSRS-7 fractional intervals | ❌ | Research roadmap flagged FSRS-7's 29-parameter model with fractional intervals. PANaCEa is on v6/ts-fsrs v5.2.3. Prior audit recommended waiting and auditing Prisma schema for integer-only fields. |
| Implicit behavioral ratings (no rating buttons) | 🔵 | **Ahead of research.** PANaCEa's CRPL system with `deriveContinuousRating()` is more advanced than anything in published FSRS literature. Binary Again/Good only — no student-facing rating buttons. The research consensus still recommends 4-button systems; PANaCEa bypassed this entirely. |
| Rapid-guess filtering (MVRT thresholds) | ✅ | Per-question-type MVRT thresholds (3000ms vignette, 1500ms recall, 2000ms image). Server enforces 2000ms floor. Responses below threshold skip FSRS updates. |

**Gap summary**: The FSRS core is production-quality and in several areas exceeds published research. The primary gap is FSRS-7 readiness, which is a "wait for upstream" dependency, not a development gap.

---

## 2. IMPLICIT BEHAVIORAL TELEMETRY & CONFIDENCE SCORING

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| Response time as primary confidence proxy | ✅ | `timeToFirstClick` weighted 0.30–0.50 depending on question type. Per-type weight profiles in `QUESTION_TYPE_WEIGHTS`. |
| Answer revision behavior tracking | ✅ | `answerSwitches` tracked as a primary signal (weight 0.20–0.40). |
| Hesitation/dwell time signals | ✅ | `totalDwellTime`, `commitmentGapMs`, `hoverOscillationCount` all tracked. |
| Mouse/cursor movement entropy | ✅ | `cursorEntropy` via `useMicroKinetics.ts` — measures movement randomness. |
| Touch-equivalent behavioral signals | ✅ | `useTouchKinetics.ts` + `useUnifiedKinetics.ts` device-detecting adapter. |
| Lognormal RT distribution modeling (Van der Linden) | 🟡 | RT is normalized against par time and per-user baselines, but not formally modeled as lognormal with joint (θ, τ) estimation. The `userTimingProfileService.ts` tracks personal baselines, which is the practical equivalent. |
| Multi-signal weighted fusion into continuous rating | ✅ | `deriveContinuousRating()` in `implicit-metrics.ts` (767 lines). Produces continuous grade 1.0–4.0 from weighted signal combination. |
| Per-question-type signal weight profiles | ✅ | Vignette/Recall/Image/Rapid Recall each have distinct weight vectors for RT, switches, trajectory, and hesitation. |
| Bayesian confidence accumulation over review history | ✅ | `lib/confidence/bayesianAccumulator.ts` — blends current confidence with exponentially-decayed history. Quality-aware. Prior weight capped at 0.40. |
| Metacognitive calibration (Brier score-based) | ✅ | `lib/services/calibrationService.ts` — per-user dampener based on Brier analysis. Overconfident students dampened (factor < 1.0), underconfident boosted (factor > 1.0). Range 0.7–1.3×. Requires ≥30 review pairs. |
| Fluency illusion dampener for massed practice | ✅ | Same-day reviews get 30% confidence reduction: `dampener = 0.7 + 0.3 × clamp(elapsedDays, 0, 1)`. Based on Kornell & Bjork (2008). |
| Graduated stability multiplier from confidence | ✅ | Sigmoid: `stabilityMult = 0.7 + 0.6 × σ((confidence − 0.6) × 5)`. High confidence → 1.28× stability, low → 0.72×. |
| Ghost Grader behavioral honesty enforcement | 🔵 | **Ahead of research.** Bidirectional v2 Ghost Grader: downgrade path (oscillations, drift, tremor → Again) AND boost path (clean signals + fast latency → +0.25 grade_continuous). Elimination velocity scoring. Z-score normalization against per-user baselines. Nothing comparable in published literature. |
| Telemetry quality tagging (full/partial/minimal) | ✅ | Three tiers. Optimizer weights: full=100%, partial=60%, minimal=30%. |
| Dunning-Kruger detection and correction | 🟡 | Metacognitive calibration service detects over/underconfidence bias globally. But does not implement the specific research-recommended per-topic DKE detection (fast RT → incorrect → systematic overconfidence in weak domains). |
| Confidence-modulated FSRS stability updates (w₂₁–w₂₃) | ❌ | Research Report 3 proposed extending FSRS with response-time and confidence parameters (w₂₁–w₂₅). Not implemented — the stability multiplier approach is a softer version of this, but doesn't train additional FSRS parameters. |
| ECE (Expected Calibration Error) per-learner tracking | 🟡 | Brier score analysis exists. Full ECE binned by implicit confidence level not confirmed. |

**Gap summary**: This is PANaCEa's strongest domain. The 4-step confidence pipeline (multi-signal → Bayesian accumulation → metacognitive calibration → fluency dampener → stability multiplier) is genuinely novel. The Ghost Grader v2 with bidirectional adjustment and z-score normalization against personal baselines is ahead of anything in published educational data mining literature. Remaining gaps are at the edges: formal DKE detection per-topic, and FSRS parameter extension with auxiliary behavioral features.

---

## 3. RAG / VECTOR SEARCH / SEMANTIC RETRIEVAL

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| Vector embeddings for clinical content | ✅ | `MedicalContent` table with 768-dim Gemini `text-embedding-005` vectors. HNSW index (migration `20260207230000`). |
| Semantic search over clinical library | ✅ | `services/ai/semanticSearchService.ts` — query embedding vs HNSW index (top-20). |
| Hybrid search (BM25 + vector via RRF) | ✅ | PostgreSQL `to_tsvector` keyword search + HNSW vector search combined with hybrid ranking. |
| Cross-encoder reranking after retrieval | ❌ | Research Report 2 recommended ms-marco-MiniLM-L12 or Cohere Rerank 4.0 for 2× precision improvement. Not implemented. |
| RAG-grounded question generation | ❌ | Current question generation uses Gemini directly with prompts, not retrieval-augmented from clinical guidelines. Research showed RAG-grounded generation reduces hallucination and improves clinical accuracy. |
| RAG for personalized wrong-answer explanations | ❌ | When students answer incorrectly, explanations come from Gemini directly, not from retrieved clinical content. |
| Corrective RAG (CRAG) with retrieval evaluation | ❌ | No retrieval quality evaluation step. Research showed naive RAG can degrade performance by 2–8% without CRAG guardrails. |
| Self-RAG with reflection tokens | ❌ | No self-reflective retrieval-generation loop. |
| Content gap detection via failed retrievals | ❌ | No logging of queries where retrieval similarity falls below threshold to identify missing knowledge base content. |
| Adaptive chunking for clinical content | 🟡 | Content exists in `MedicalContent` table, but chunking strategy not confirmed as adaptive/structure-aware vs fixed-size. |
| Medical ontology tagging (SNOMED, ICD-10, MeSH) | ❌ | Content has category/type metadata but no UMLS/SNOMED/MeSH concept linking for cross-referencing synonyms. |
| PubMed enrichment pipeline | ✅ | `lib/services/question/pubmedEnricher.ts` — citations, evidence grounding. |
| Content health scoring | ✅ | `functions/api/cron/compute-content-health.ts` — scores currency, completeness, relevance. |
| Cloudflare Vectorize for edge-local vector search | ❌ | All vector search routes through Supabase pgvector (50–150ms round-trip). No edge-local vector cache. |
| Semantic caching via Cloudflare KV | ❌ | KV exists for rate limiting but not for caching RAG results. |
| OSCE simulation grounded in clinical presentations via RAG | ❌ | OSCE uses Gemini 3 with extended thinking but patient responses are not grounded in retrieved clinical presentation data. |
| Embedding model evaluation (Gemini vs PubMedBERT vs MedCPT) | 🟡 | Using `text-embedding-005` (768-dim). No evidence of comparative evaluation against medical-specific models. |

**Gap summary**: The vector infrastructure is built (pgvector + HNSW + hybrid search), but the RAG layer on top of it is almost entirely missing. The embeddings and search work for the clinical reference library, but none of the AI generation pipelines (question generation, explanations, OSCE) use retrieval-augmented approaches. This is the single largest untapped opportunity — the infrastructure is 70% there, but the last 30% (RAG orchestration, CRAG guardrails, grounded generation) isn't wired in.

---

## 4. CONTEXT-AWARE SCHEDULING & KNOWLEDGE GRAPHS

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| Semantic sibling propagation (cross-concept mastery) | ✅ | `semanticSiblingService.ts` — propagates recall effects to related concepts after each review. |
| Concept-level mastery tracking | ✅ | `conceptMasteryIntegration.ts` — tracks mastery at the concept level, not just card level. |
| Concept-based question selection | ✅ | `conceptQuestionSelector.ts` — selects questions based on concept mastery. |
| Confusion pair tracking | ✅ | Confusion pairs generated and stored during review pipeline (part of `drillReviewService.ts` flow). |
| Knowledge graph with prerequisite edges (FIRe-style) | ❌ | Research Report 3 recommended FIRe-style encompassing graphs where reviewing "cardiac pharmacology" credits "cardiac physiology." No prerequisite graph structure exists. Semantic siblings are similarity-based, not prerequisite-based. |
| FIRe implicit review compression | ❌ | No credit/penalty propagation through prerequisite hierarchies to reduce total review load. |
| Contextual bandits for item selection (LinUCB/Thompson) | ❌ | Question selection uses concept mastery scores, not explore-exploit optimization. |
| ZPDES learning-progress-based sequencing | ❌ | No learning progress (ΔP(correct)) as a reward signal for item selection. |
| Interleaving vs blocking based on learning phase | 🟡 | Phase-based question order distribution exists (`didactic → 50% first-order`, `pance_prep → 45% third-order`), but this is Bloom's level mixing, not interleaving of similar/confusable concepts. |
| KAR³L content-aware scheduling using BERT embeddings | ❌ | Research (EMNLP 2024) showed BERT-based semantic card similarity improves scheduling efficiency over FSRS. Not implemented — cards are scheduled independently. |
| LECTOR LLM-enhanced semantic confusion scheduling | ❌ | No LLM-based assessment of which cards a student likely confuses. |
| PSI-KT joint prerequisite + cognitive trait inference | ❌ | No data-driven prerequisite graph discovery. |
| Circadian-aware scheduling | ✅ | `lib/circadian.ts` with `buildCircadianContext()` and `applyCircadianModifier()`. Four phases (Morning/Afternoon/Evening/Night). Circadian-aware optimizer trains separate FSRS parameters per phase. |
| Session fatigue correction | ✅ | `sessionFatigueService.ts` — adjusts par time based on position within session. |
| Anti-gaming distribution checks | ✅ | `antiGamingDistribution.ts` — prevents gaming via answer distribution analysis. |
| Learner-stage-aware session blueprints | ✅ | `learnerStageBlueprint.ts` — session composition varies by didactic/clinical/pance_prep phase. |
| Retrievability calibration with drift detection | ✅ | `retrievabilityCalibrationService.ts` — predicted R vs actual recall, stability correction factors (0.7–1.4), rolling-window drift detection (last 200 vs last 50 reviews). |

**Gap summary**: PANaCEa has strong concept-level tracking and some cross-concept propagation (semantic siblings, confusion pairs), but lacks the structural/prerequisite knowledge graph that research identifies as the next frontier. The scheduling is still fundamentally per-card FSRS with concept-level overlays, not graph-aware. Contextual bandits, ZPDES, and content-aware scheduling (KAR³L, LECTOR) are all absent.

---

## 5. AI QUESTION GENERATION & CONTENT PIPELINE

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| LLM-based clinical vignette generation | ✅ | Gemini Flash batch generation (25 Qs/request). NCCPA blueprint-aligned with organ system, task category, and Bloom's level targeting. |
| Structured output schema enforcement | ✅ | JSON schema with stem, options, rationale, system, taskCategory, questionOrder, difficulty, tags, relatedConditions. |
| Distractor quality rules | ✅ | No "all/none of the above," plausible distractors, randomized answer position, no negative stems. |
| Phase-based question order distribution | ✅ | Didactic: 50/35/15, Clinical: 20/50/30, PANCE prep: 15/40/45 (first/second/third order). |
| Chain-of-thought prompting for clinical alignment | 🟡 | Gemini generation uses structured prompts but explicit CoT chaining for vignette construction not confirmed. |
| Self-refine loop (draft → critique → rewrite) | ❌ | No iterative refinement pipeline. Questions generated in a single pass. |
| RAG-grounded generation from clinical guidelines | ❌ | Generation is prompt-only, not retrieval-augmented from the clinical reference library. |
| Psychometric item analysis (discrimination index, point-biserial) | ❌ | No automated item quality metrics computed from student response data. Research recommends flagging items with D < 0.10 or negative point-biserials. |
| IRT calibration of question difficulty (2PL model) | ❌ | Difficulty is a static 1–5 rating set at generation time. Not recalibrated from student response patterns. Research recommends continuous IRT estimation. |
| Elo-based dynamic difficulty updating | ❌ | No Elo-style rating system where each student-question interaction updates both student ability and item difficulty estimates. |
| A/B testing framework for educational interventions | ❌ | No infrastructure for randomized comparison of generation strategies, explanation formats, or scheduling variants. |
| Content gap analysis by NCCPA blueprint weight | 🟡 | Skill docs note CV and PULM are under-represented. Blueprint weights exist in `lib/constants/blueprint.ts`. But automated gap detection and prioritized generation is not confirmed. |

**Gap summary**: Question generation is solid for single-pass production but lacks the self-improving feedback loops the research demands. No psychometric analysis feeds back into question quality; no IRT recalibrates difficulty from student responses; no RAG grounds vignettes in clinical evidence. The content pipeline is open-loop — it generates but doesn't learn from how students perform on generated content.

---

## 6. OSCE / CLINICAL SIMULATION

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| AI-powered patient encounter simulation | ✅ | `functions/api/osce/live-engine.ts` — real-time patient interaction via Gemini 3 with extended thinking. Transcript pipeline, session state management. |
| Multi-dimensional grading rubrics | ✅ | `functions/api/osce/analysis/` — history depth, exam thoroughness, differential reasoning, rubric compliance. |
| Clinical reasoning scaffold | ✅ | `lib/osce/clinicalReasoningScaffold.ts` — decision tree validation, missing reasoning detection. |
| SOAP note trainer | ✅ | `components/osce/SOAPNoteTrainer.tsx` — real-time SOAP note feedback. |
| Differential diagnosis ranker | ✅ | `components/osce/DifferentialDiagnosisRanker.tsx` — guides reasoning, surfaces omissions. |
| Audio/voice interface | ✅ | `components/osce/AudioInterface.tsx` — voice capture for natural interaction. |
| Adaptive personality selection | ✅ | `services/domain/adaptivePersonalitySelector.ts` — targets weakness areas, progressive difficulty, rotation-specific personalities. |
| RAG-grounded patient responses | ❌ | Patient responses generated by Gemini, not grounded in retrieved clinical presentation data. |
| Illness script builder integrated with SRS | ❌ | Research Report 1 identified this as the #1 differentiator no competitor offers. No illness script data structure or builder exists. |
| Dual-process clinical reasoning scaffolding (System 1/System 2) | ❌ | Clinical reasoning scaffold validates decision trees but doesn't explicitly scaffold the transition from analytical (System 2) to pattern-recognition (System 1) reasoning. |

**Gap summary**: OSCE implementation is remarkably complete — live engine, grading, SOAP notes, differential ranker, audio interface, adaptive personalities. The gaps are in grounding (RAG) and the illness script builder, which the research identifies as PANaCEa's single most defensible differentiator.

---

## 7. COGNITIVE LOAD, HABIT SCIENCE & UX

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| Session length optimization (25–35 min blocks) | 🟡 | Session fatigue service exists, but no automatic session-termination recommendation based on performance decay. |
| Within-session fatigue detection | ✅ | `sessionFatigueService.ts` — fatigue correction applied to par time based on session position. |
| Circadian phase-aware scheduling | ✅ | Four phases with distinct FSRS parameter sets. Par time modification by phase. |
| EOR (End of Rotation) scheduling clamp | ✅ | `lib/fsrs/eorScheduler.ts` — clamps review intervals near rotation exam dates. |
| Progressive disclosure by learner stage | ✅ | Learner stage blueprints shift content complexity (didactic → clinical → pance_prep). |
| Gamification with mastery indicators | 🟡 | Streak counters, confidence meters on dashboard. Research warns leaderboards harm intrinsic motivation — unclear if leaderboards exist. |
| Push notification optimization (3–5/week, personalized timing) | ❌ | No push notification system documented. |
| Implementation intentions ("When X, do Y") for habit formation | ❌ | No habit formation scaffolding or implementation intention prompts. |
| Pomodoro/session timer integration | ❌ | No built-in study timer or break recommendations. |
| Daily study load recommendations (15–20 new cards/day) | ❌ | No evidence of new-card throttling or daily load guidance. |

**Gap summary**: The circadian and fatigue systems are strong. The habit formation layer — notifications, implementation intentions, session timers, daily load guidance — is entirely absent.

---

## 8. PREDICTIVE ANALYTICS & READINESS ESTIMATION

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| Per-topic mastery estimation (MIRT) | 🟡 | Concept mastery tracking exists, but not via formal Multidimensional IRT with posterior distributions and confidence intervals. |
| Topic-level readiness weighted by PANCE blueprint | 🟡 | Blueprint weights exist in constants. `CurriculumGrid` dashboard component suggests visual representation. But full readiness aggregation with CI is not confirmed. |
| Forgetting curve projection to exam date | ❌ | No forward-projection of retrievability to a target exam date ("If your exam is in 30 days, here's your projected readiness"). |
| Early warning system for at-risk performance | ❌ | No automated detection of declining performance trajectories or risk scoring. |
| Knowledge Space Theory prerequisite discovery (IITA) | ❌ | No data-driven prerequisite graph learning from response patterns. |
| Learner clustering by behavioral archetype | ❌ | No unsupervised clustering of students into behavioral profiles (consistent reviewers, crammers, perfectionists, etc.). |
| Learning curve analysis (PPL fitting) | ❌ | No per-knowledge-component learning curve tracking or plateau/breakthrough detection. |
| Error pattern classification (anchoring, premature closure) | ❌ | Confusion pairs exist, but no systematic classification of cognitive bias patterns in student errors. |
| Slip/guess detection in FSRS context | 🟡 | Rapid-guess filtering (MVRT) catches obvious guessing. Ghost Grader catches some slips. But no formal BKT-style slip/guess parameter estimation with contextual features. |

**Gap summary**: Analytics infrastructure exists (dashboards, charts, analytics services), but the predictive layer — readiness projection, early warning, learning curves, error pattern classification — is missing. The data to build these models is being collected (ReviewLog with telemetry quality, grade_continuous, retrievability), but the analysis layer isn't consuming it for forward-looking predictions.

---

## 9. SELF-IMPROVING SYSTEM / FEEDBACK LOOPS

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| Retrievability calibration (predicted R vs actual) | ✅ | `retrievabilityCalibrationService.ts` — rolling-window comparison, drift detection, stability correction factors. |
| FSRS parameter re-optimization on accumulated data | ✅ | `fsrsOptimizerService.ts` (coordinate descent) + `gcp-fsrs-optimizer/main.py` (batch). |
| Item difficulty recalibration from student responses | ❌ | Question difficulty is static (1–5 at generation). Not updated from accumulated response data via IRT or Elo. |
| Item quality detection (discrimination index < 0.10) | ❌ | No automated psychometric quality monitoring. |
| Distractor analysis (non-functioning distractor flagging) | ❌ | No analysis of which distractors students never select. |
| Content gap detection from failed retrievals | ❌ | No logging of search queries that return low-relevance results. |
| A/B testing for educational interventions | ❌ | No randomized experiment infrastructure. |
| xAPI event logging standard | ❌ | Events logged to Prisma tables (QuestionAttempt, ReviewLog, UserProgress), not in xAPI format. Functional but not interoperable. |
| Feedback loops from student interactions to content quality | ❌ | Student performance on individual questions doesn't feed back into question quality scores or regeneration triggers. |

**Gap summary**: The FSRS-level calibration loop is closed and working well (predicted R → actual outcome → correction factor → updated scheduling). But the content-level feedback loops are all open. Question quality, difficulty, distractor effectiveness — none of these self-improve from student interaction data.

---

## 10. INFRASTRUCTURE & STACK

| Research Recommendation | Status | PANaCEa Reality |
|---|---|---|
| React + Vite frontend | ✅ | React 19 + Vite + TypeScript + TailwindCSS + Framer Motion. |
| Cloudflare Pages Functions (edge runtime) | ✅ | Production API layer. 160+ edge function files. |
| Supabase PostgreSQL with Prisma ORM | ✅ | 130+ tables, 4131-line schema, Prisma Accelerate proxy. |
| pgvector for vector search | ✅ | HNSW index, 768-dim Gemini embeddings. |
| Clerk authentication | ✅ | `@clerk/clerk-react` + `@clerk/backend`. |
| Gemini API (multi-model routing) | ✅ | Flash (default), 3-flash-preview (tutor), 1.5-pro (medical images), text-embedding-005 (search). |
| Cost-optimized model routing | ✅ | Flash → validate → Pro escalation pattern. Extended thinking for complex reasoning only. |
| Streaming for real-time UX | ✅ | Web Streams API in `gemini/stream.ts`. |
| Test suite | ✅ | 134+ tests across 6 files (Vitest). |

---

## EXECUTIVE SUMMARY

### Where PANaCEa leads the research

1. **Implicit behavioral rating system (CRPL)** — The 4-step confidence pipeline (multi-signal fusion → Bayesian accumulation → metacognitive calibration → fluency dampener → stability multiplier) with the bidirectional Ghost Grader is genuinely novel. No published system combines this many behavioral signals into FSRS scheduling without user-facing rating buttons.

2. **Circadian-aware FSRS** — Separate parameter optimization per circadian phase, with par time modification. Most SRS research treats time-of-day as noise; PANaCEa treats it as signal.

3. **OSCE simulation depth** — Live engine with audio, SOAP note trainer, differential diagnosis ranker, adaptive personality selection. This exceeds what any published PA education platform offers.

### Where the biggest gaps exist

1. **RAG is infrastructure-ready but not wired in** — pgvector, HNSW, hybrid search all exist. But no AI generation pipeline (questions, explanations, OSCE) uses retrieval-augmented approaches. This is the highest-ROI gap to close.

2. **Content feedback loops are open** — FSRS calibrates itself from student outcomes. Question quality does not. Difficulty is static. Distractors are never analyzed. The data to close these loops is being collected but not consumed.

3. **No knowledge graph / prerequisite structure** — Semantic siblings and confusion pairs exist, but the structural prerequisite graph (anatomy → physiology → pathology → pharmacology) that enables FIRe-style review compression and contextual item selection is absent.

4. **No predictive readiness model** — Card-level FSRS states are not aggregated into topic-level → organ-system-level → exam-readiness scores with confidence intervals and forward projection to exam dates.

5. **No illness script builder** — Identified across multiple research reports as PANaCEa's single most defensible differentiator vs UWorld/Blueprint/Smarty PANCE/AMBOSS. No implementation exists.

### Recommended implementation priority

| Priority | Feature | Rationale |
|---|---|---|
| **P0** | Wire RAG into question generation | Infrastructure exists. Grounds vignettes in clinical guidelines. Reduces hallucination. |
| **P0** | IRT/Elo dynamic difficulty calibration | Closes the biggest content feedback loop. Student data → better question difficulty estimates. |
| **P1** | Prerequisite knowledge graph (init from curriculum) | Enables FIRe review compression + contextual item selection. High impact on study efficiency. |
| **P1** | Exam readiness aggregation (card → topic → system → overall) | Students need "am I ready for PANCE?" answered with a number and confidence interval. |
| **P1** | RAG for wrong-answer explanations | High-frequency use case. Cache by (question_id, wrong_answer) for 40–60% hit rate. |
| **P2** | Illness script builder | Strategic differentiator. Complex UI/data model. |
| **P2** | Cross-encoder reranking for clinical search | 2× retrieval precision. Add ms-marco-MiniLM-L12 or Cohere Rerank. |
| **P2** | CRAG retrieval quality guardrails | Prevents hallucinated clinical content from reaching students. Safety requirement. |
| **P3** | Contextual bandits for item selection | Requires significant data accumulation. Build after prerequisite graph. |
| **P3** | Learner clustering and early warning | Requires multi-user scale. Valuable at 100+ active users. |
| **P3** | Push notifications + habit formation | Important for retention but orthogonal to core learning science. |
