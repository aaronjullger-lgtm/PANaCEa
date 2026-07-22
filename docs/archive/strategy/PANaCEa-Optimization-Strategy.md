# PANaCEa Feature & AI Optimization Strategy

**Date:** 2026-04-03
**Author:** Principal AI Product Architect
**Scope:** Full-stack feature optimization + AI model routing strategy
**Grounded in:** PANaCEa codebase audit, current architecture, actual AI usage patterns

---

## A. Optimization Principles

These twelve principles govern every recommendation in this document. They are derived directly from PANaCEa's architecture, its educational mission, and the constraints of running AI-powered medical education at scale on Cloudflare Edge + PostgreSQL + Gemini.

**1. Deterministic first, AI only when it adds irreplaceable value.**
FSRS, implicit metrics, circadian modulation, confidence calibration, and the 8-step confidence pipeline are already deterministic and fast. This is correct. Never replace a working algorithm with a model call. AI should only enter the path when the task requires natural language understanding, generation, or judgment that no formula can replicate.

**2. The submission hot path is sacred.**
`drillReviewService.ts` (803 lines) handles correctness resolution, implicit rating, par-time, circadian adjustment, FSRS update, and database writes with zero AI calls. This is PANaCEa's most latency-sensitive path (target: <200ms p95). No AI model, embedding lookup, or network call should ever be added to this synchronous pipeline. Any enrichment (confusion pairs, sibling propagation, insight generation) must happen asynchronously after the response is returned.

**3. Use the cheapest method that meets the quality bar.**
The escalation order is: deterministic rule > cached result > embedding/retrieval > small/fast model > medium reasoning model > frontier model > human review. Move right only when the method to the left demonstrably fails the quality requirement.

**4. Cache aggressively, generate lazily.**
Question explanations, mnemonics, study path suggestions, and dashboard insights are all re-requestable. Every AI output should be cached with a content-addressable key. The existing semantic cache (Jaccard 85% in `semanticCacheService.ts`) is a good start but should be extended to all AI endpoints, not just question generation.

**5. Batch what isn't time-sensitive.**
Question generation, content freshness checks, image grading, embedding computation, and dashboard insight synthesis are all tolerant of minutes-to-hours latency. These should run in background jobs (Cloudflare Cron Triggers or reservoir-maintenance-style workers), not in user-facing request paths.

**6. Validate all AI outputs deterministically.**
Every model output that enters the educational pipeline must pass through a deterministic validator: schema validation for structured JSON, medical taxonomy checks against `pa-curriculum.ts` constants, PANCE blueprint alignment checks against `nccpa-question-weighting.ts`, and answer-key verification. The Chain of Verification (CoVe) pattern already used in question generation should be the standard, not the exception.

**7. Right-size models to tasks.**
`gemini-2.5-pro` should only be used for tasks requiring complex clinical reasoning (multi-step differential diagnosis, nuanced SOAP note grading, novel question generation for underrepresented blueprint areas). `gemini-2.5-flash` handles most generation tasks well. `gemini-2.0-flash` is sufficient for mnemonics, simple summarization, and hint generation. Embedding calls (`text-embedding-005`) are cheap and should be used freely for retrieval.

**8. Degrade gracefully, never silently.**
If a Gemini API call fails, the user should get a useful fallback (cached content, rule-based hint, simplified explanation) rather than an error screen. The existing 503 fallback on missing API keys is a good pattern. Extend it: every AI-dependent feature should have a non-AI fallback defined.

**9. Measure before optimizing.**
Add token-counting middleware to all Gemini proxy endpoints. Track cost-per-feature-per-user. The current rate limiter (`rateLimiter.ts`) controls volume but doesn't measure cost. Without per-endpoint token telemetry, you cannot make informed model-routing decisions.

**10. Separate content authoring from content serving.**
Question generation, explanation writing, and content enrichment are authoring tasks (high cost, low frequency, quality-critical). Serving those outputs to students is a retrieval task (low cost, high frequency, latency-critical). Never conflate them. Author once, cache, serve many.

**11. Trust requires provenance.**
For medical education, every AI-generated explanation, grading rationale, or clinical reference should carry metadata: which model generated it, when, what source context was provided, and whether it has been human-reviewed. This is non-negotiable for educational trustworthiness and future accreditation conversations.

**12. Design for the PA-S2 workflow, not generic "AI features."**
Every optimization should map to a real workflow: cramming before EOR exams, drilling weak blueprint areas, reviewing OSCE encounters, checking clinical references during rotations. If an optimization doesn't serve one of these workflows, it's engineering waste.

---

## B. Feature Optimization Matrix

### B1. Main Study Session

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Complete a timed session of PANCE-style questions with immediate feedback, implicit FSRS scheduling, and progress tracking |
| **Current bottleneck** | `QuizView.tsx` (2,274 lines) is monolithic; syncManager queues answers to `/api/questions/attempt`; no blocking AI in the path (good); UI consistency debt from hybrid routing |
| **AI needed?** | No for core flow. Partial for post-session insights |
| **Best method** | Deterministic (FSRS + implicit metrics + circadian). Post-session summary can use cached AI |
| **Latency sensitivity** | **High** — answer submission must be <200ms; question rendering <100ms |
| **Cost sensitivity** | **Low** — no AI in hot path |
| **Risk if wrong** | **High** — incorrect FSRS updates corrupt the entire spacing schedule |
| **Recommended pattern** | Keep current deterministic pipeline. Add async post-session insight generation (batch after session ends). Refactor QuizView into composable hooks |
| **Fallback** | If syncManager fails, offline queue with retry (already implemented) |

### B2. FSRS / Telemetry / Scoring Pipeline

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Invisibly schedule reviews at optimal intervals based on behavioral signals |
| **Current bottleneck** | Correctness/trust issues in parts of the telemetry path; rapid-guess filter thresholds (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms) may need calibration per user |
| **AI needed?** | **No.** This must remain fully deterministic |
| **Best method** | Pure algorithm (FSRS v6, 21 params) + deterministic implicit metrics + Bayesian confidence accumulator |
| **Latency sensitivity** | **Critical** — runs synchronously in every answer submission |
| **Cost sensitivity** | **Zero** — no API calls |
| **Risk if wrong** | **Very high** — mis-scheduling corrupts long-term retention |
| **Recommended pattern** | Add per-user MVRT calibration (percentile-based rather than fixed thresholds). Add unit tests for edge cases in the 8-step confidence pipeline. Add observability (log rating distributions per user to detect drift) |
| **Fallback** | If implicit metrics produce anomalous ratings, clamp to nearest valid rating and flag for review |

### B3. Drill Modes (13 Active Drills)

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Focused practice on specific question types or weak areas |
| **Current bottleneck** | All 11 drill hooks use `useDrillFSRS` → `/api/drills/submit-review` (good). DrillShell.tsx wraps all drills. Content selection may not be optimally personalized |
| **AI needed?** | **Partial** — drill question selection can use embeddings for confusion-pair targeting; drill content itself should be pre-generated |
| **Best method** | Deterministic selection (FSRS due dates + confusion-pair graph) + pre-cached content |
| **Latency sensitivity** | **High** — drill sessions feel snappy or they feel broken |
| **Cost sensitivity** | **Low** — no real-time AI needed |
| **Risk if wrong** | **Medium** — poor drill targeting wastes study time but doesn't corrupt data |
| **Recommended pattern** | Pre-compute drill queues per user (reservoir pattern already exists). Use confusion-pair recurrence data to weight drill selection. No real-time AI |
| **Fallback** | Random selection from due items if personalized queue is empty |

### B4. OSCE / Patient Encounter Mode

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Simulate a clinical encounter, write a SOAP note, receive structured feedback |
| **Current bottleneck** | SOAP grading via `soapGradingService.ts` calls gemini-2.5-flash per submission. This is the highest per-interaction AI cost in the app. Grading quality depends heavily on prompt engineering |
| **AI needed?** | **Yes** — SOAP note evaluation requires NLU; no deterministic approach is sufficient |
| **Best method** | **Hybrid: rubric-based deterministic scoring + medium model for qualitative feedback.** Score structural completeness (all SOAP sections present, chief complaint stated, differential listed) deterministically. Use AI only for clinical reasoning quality assessment |
| **Latency sensitivity** | **Medium** — users expect feedback within 5-10 seconds, not instantly |
| **Cost sensitivity** | **High** — every OSCE submission triggers a model call |
| **Risk if wrong** | **High** — incorrect grading of clinical reasoning undermines educational trust |
| **Recommended pattern** | Split grading: (1) Deterministic rubric checker scores structure (instant, free). (2) `gemini-2.5-flash` scores clinical reasoning quality (async, 3-8s). (3) For edge cases (scores near pass/fail boundary), escalate to `gemini-2.5-pro`. Cache grading rubric templates. Batch-generate exemplar feedback for common scenarios |
| **Fallback** | If AI grading fails, return deterministic structural score only with message "detailed feedback temporarily unavailable" |

### B5. Clinical Reference Library

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Look up conditions, treatments, differentials during study |
| **Current bottleneck** | Content loading inconsistencies (noted in audit). FTS via `search_vector` with ILIKE fallback. KV cache with 1h TTL. Content freshness unknown |
| **AI needed?** | **Partial** — semantic search (embeddings) improves discovery; content itself should be human-authored or human-reviewed |
| **Best method** | PostgreSQL FTS (primary) + embedding similarity (secondary) + KV cache |
| **Latency sensitivity** | **High** — reference lookup must feel instant (<500ms) |
| **Cost sensitivity** | **Low** — embeddings are cheap; FTS is free |
| **Risk if wrong** | **High** — incorrect medical reference content is dangerous |
| **Recommended pattern** | Pre-compute embeddings for all `MedicalContent` rows at ingestion. Use FTS for exact/keyword matches, fall back to embedding similarity for semantic queries. Cache hot content aggressively (extend TTL to 24h for stable content). Add provenance metadata (source, last verified date) |
| **Fallback** | ILIKE substring search (already implemented) |

### B6. Search and Content Retrieval

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Find relevant questions, content, or references across the platform |
| **Current bottleneck** | Search is fragmented: library search, question search, and drill content selection use different mechanisms |
| **AI needed?** | **Partial** — unified embedding-based search improves cross-content discovery |
| **Best method** | Unified search index: PostgreSQL FTS + pre-computed embeddings (`text-embedding-005`) with cosine similarity |
| **Latency sensitivity** | **High** — search must return in <500ms |
| **Cost sensitivity** | **Low** — embeddings computed at ingestion, search is vector math |
| **Risk if wrong** | **Low** — poor search results are annoying but not educationally harmful |
| **Recommended pattern** | Build a unified search service that queries across MedicalContent, Questions, and DrillContent using a shared embedding space. Cache popular queries. Use FTS for high-precision keyword matches, embeddings for semantic "I don't know the exact term" queries |
| **Fallback** | FTS-only search |

### B7. Dashboard / Analytics / Learner Insights

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Understand study progress, identify weak areas, see trends over time |
| **Current bottleneck** | Dashboard trust/theming issues (audit finding). Rolling 360 metrics exist but may not surface actionable insights. No AI-generated study recommendations |
| **AI needed?** | **Partial** — aggregate analytics are deterministic; natural-language insight summaries benefit from AI |
| **Best method** | Deterministic aggregation (SQL queries) + cached AI summaries (generated daily, not per-request) |
| **Latency sensitivity** | **Medium** — dashboard loads can take 1-2s acceptably |
| **Cost sensitivity** | **Medium** — daily batch generation is cheap; per-request generation is expensive |
| **Risk if wrong** | **Medium** — misleading analytics could misdirect study effort |
| **Recommended pattern** | Compute all metrics via SQL aggregations (daily cron). Generate natural-language insight summary once per day per user using `gemini-2.0-flash` (cheapest). Cache the summary. Only regenerate when underlying data changes meaningfully (>5% shift in any metric) |
| **Fallback** | Show raw metrics without natural-language summary |

### B8. Question Generation

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Generate high-quality, PANCE-aligned clinical vignette questions |
| **Current bottleneck** | Highest cost driver. `gemini-2.5-flash` (default) / `gemini-2.5-pro` (fallback). ~2,000-3,000 tokens per question. Rate limited to 10/min. Semantic cache at 85% Jaccard helps but coverage is limited |
| **AI needed?** | **Yes** — clinical vignette generation requires NLU/NLG |
| **Best method** | **Frontier model for novel generation, batch-only.** Real-time generation should be eliminated for most users |
| **Latency sensitivity** | **Low** — generation can happen in background (reservoir pattern) |
| **Cost sensitivity** | **Very high** — this is the #1 cost driver |
| **Risk if wrong** | **Very high** — medically inaccurate questions are actively harmful |
| **Recommended pattern** | (1) Pre-generate question pools per blueprint area in nightly batches using `gemini-2.5-pro`. (2) Each question passes through CoVe + deterministic PANCE blueprint validator + taxonomy checker. (3) Store validated questions in reservoir. (4) Serve from reservoir at session time (zero AI cost). (5) Only trigger real-time generation when reservoir runs dry for a specific blueprint area. (6) Flag all AI-generated questions for eventual human review |
| **Fallback** | Serve from existing question pool; notify admin that reservoir is low |

### B9. Explanations / Tutoring / Hinting

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Understand why an answer is correct/incorrect; get hints without revealing the answer |
| **Current bottleneck** | Explanations likely generated per-request (expensive) or stored statically (stale). Mnemonic generation uses `gemini-2.0-flash` at 30/min |
| **AI needed?** | **Yes** for rich explanations; **No** for simple answer-key reveals |
| **Best method** | **Pre-generate and cache.** Explanations are tied to questions; generate them at question-creation time, not at serving time |
| **Latency sensitivity** | **Medium** — 2-3s acceptable for explanation; hints should be <1s |
| **Cost sensitivity** | **High** if generated per-request; **Low** if pre-generated |
| **Risk if wrong** | **High** — incorrect explanations teach wrong information |
| **Recommended pattern** | (1) Generate explanation + 3 hints at question creation time (batch, `gemini-2.5-flash`). (2) Store with question record. (3) Serve from cache. (4) For "why was my specific answer wrong" tutoring, use `gemini-2.0-flash` with the question context + user's answer as a lightweight real-time call. (5) Cache per (question, wrong-answer) pair |
| **Fallback** | Show static explanation text; hide tutoring feature if AI unavailable |

### B10. Study Path / Personalization

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Get a recommended study plan based on current progress, rotation schedule, and EOR exam dates |
| **Current bottleneck** | Rotation and wellness signals need to feed the adaptive dashboard mode classifier and load guardrail directly. `useStudyWellness` is not yet fully wired to real session history. |
| **AI needed?** | **Partial** — path computation is algorithmic; natural-language study advice benefits from AI |
| **Best method** | Deterministic optimizer (PANCE blueprint gaps × FSRS due dates × rotation calendar × EOR dates) + AI for natural-language framing |
| **Latency sensitivity** | **Low** — study path recalculated daily or on-demand |
| **Cost sensitivity** | **Low** — one AI call per recalculation |
| **Risk if wrong** | **Medium** — bad study advice wastes time but doesn't teach wrong content |
| **Recommended pattern** | (1) Deterministic algorithm computes priority scores per blueprint area (already partially done in `nccpa-question-weighting.ts`). (2) Algorithm outputs ordered list of focus areas. (3) `gemini-2.0-flash` wraps this in a natural-language daily study brief (one call, cached). (4) Recalculate only when: new session completed, rotation changes, or daily cron |
| **Fallback** | Show raw priority list without natural-language wrapper |

### B11. Admin Curation / Taxonomies / Mappings

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | (Admin) Curate questions, manage PANCE blueprint mappings, review AI-generated content |
| **Current bottleneck** | Manual curation is time-intensive; taxonomy in `pa-curriculum.ts` (12 courses, 10 rotations) is static |
| **AI needed?** | **Partial** — AI can suggest taxonomy mappings; humans must approve |
| **Best method** | Embedding similarity for auto-tagging suggestions + human approval workflow |
| **Latency sensitivity** | **Low** — admin tools can be slower |
| **Cost sensitivity** | **Low** — low frequency |
| **Risk if wrong** | **High** — taxonomy errors propagate to all users |
| **Recommended pattern** | (1) When new questions are ingested, auto-suggest blueprint mapping using embedding similarity to existing tagged questions. (2) Present suggestions to admin with confidence scores. (3) Admin approves/corrects. (4) Use corrections to fine-tune future suggestions |
| **Fallback** | Manual tagging only |

### B12. Notifications / Reminders / Due Queue Planning

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Get reminded when reviews are due; know what to study today |
| **Current bottleneck** | Reservoir maintenance runs every 2h via cron. Due queue planning is deterministic (FSRS). No push notifications implemented |
| **AI needed?** | **No** — scheduling is purely algorithmic |
| **Best method** | Deterministic (FSRS retrievability thresholds + reservoir priority scores) |
| **Latency sensitivity** | **Low** — notifications are async by nature |
| **Cost sensitivity** | **Zero** — no AI |
| **Risk if wrong** | **Low** — missed notification is minor |
| **Recommended pattern** | Cron job computes daily due counts. Push via web notification API or email digest. Use reservoir priority scores (OVERDUE_REVIEW=100, DUE_REVIEW=80, etc.) to rank items |
| **Fallback** | In-app badge count only |

### B13. Import/Export / Ingestion Workflows

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | Import question banks, export progress, ingest new content |
| **Current bottleneck** | No standardized import pipeline. Content loading inconsistencies |
| **AI needed?** | **Partial** — AI helps with format normalization and taxonomy mapping during ingestion |
| **Best method** | Deterministic parsing + AI-assisted taxonomy mapping (batch) |
| **Latency sensitivity** | **Low** — import is a background operation |
| **Cost sensitivity** | **Low** — one-time per import |
| **Risk if wrong** | **High** — corrupted imports affect all downstream features |
| **Recommended pattern** | (1) Deterministic parser extracts structured data. (2) Validator checks schema, required fields, PANCE alignment. (3) `gemini-2.5-flash` suggests taxonomy mappings for untagged content (batch). (4) Admin reviews flagged items. (5) Embeddings computed for all new content |
| **Fallback** | Import with "untagged" status; admin manually classifies |

### B14. Collaboration / Future SDK-Powered Workflows

| Dimension | Assessment |
|-----------|-----------|
| **User-facing job** | (Future) Study groups, shared question sets, peer review |
| **Current bottleneck** | Not yet implemented |
| **AI needed?** | **Minimal** — collaboration is mostly data sharing + permissions |
| **Best method** | Standard CRUD + real-time sync (WebSocket or SSE) |
| **Latency sensitivity** | **Medium** |
| **Cost sensitivity** | **Low** |
| **Risk if wrong** | **Low** |
| **Recommended pattern** | Defer until core features are optimized. When built, use deterministic sharing logic. AI only for optional features like "summarize group performance" |
| **Fallback** | N/A (not yet built) |

---

## C. AI Model Routing Strategy

### C1. The Escalation Ladder

Every AI-adjacent task in PANaCEa should be evaluated against this ladder. Use the lowest rung that meets the quality bar.

```
Level 0: Deterministic Logic (rules, formulas, SQL)
  ↓ only if rules can't express the task
Level 1: Cached Results (content-addressable lookup)
  ↓ only if cache misses
Level 2: Embeddings / Retrieval (text-embedding-005 + cosine similarity)
  ↓ only if retrieval alone isn't sufficient
Level 3: Small/Fast Model (gemini-2.0-flash)
  ↓ only if output quality is insufficient
Level 4: Medium Reasoning Model (gemini-2.5-flash)
  ↓ only if task requires deep clinical reasoning
Level 5: Frontier Model (gemini-2.5-pro)
  ↓ only if stakes are high and output will be widely seen
Level 6: Human Review (admin curation queue)
```

### C2. Task Routing Table

#### Level 0 — Deterministic Logic Only (No AI)
- FSRS scheduling (all calculations)
- Implicit metrics derivation (behavioral → rating)
- Confidence pipeline (8-step Bayesian)
- Circadian modulation
- Session fatigue correction
- Par-time calculation
- Rapid-guess filtering (MVRT thresholds)
- Correctness resolution (answer key matching)
- Due queue computation
- Notification scheduling
- Rate limiting / quota enforcement
- Blueprint gap analysis (SQL aggregation)
- Drill question selection (FSRS due dates + priority scores)
- Reservoir queue management (priority ordering, TTL expiry)
- Study session state machine
- Progress export (data serialization)

#### Level 1 — Cached Results (Serve Pre-Generated Content)
- Question explanations (generated at authoring time)
- Hint text (generated at authoring time, 3 per question)
- Mnemonic suggestions (cached per concept)
- Dashboard insight summaries (regenerated daily)
- Study path recommendations (regenerated on state change)
- OSCE grading rubric templates (pre-authored)
- Common wrong-answer tutoring responses (cached per question×answer pair)

#### Level 2 — Embeddings / Retrieval
- Clinical reference search (semantic query → content)
- Confusion-pair detection (embedding distance between related concepts)
- Question similarity deduplication (embedding cosine similarity)
- Auto-taxonomy suggestion (new content → nearest tagged content)
- Study group content recommendation (user progress embedding → content embedding)
- "Related topics" suggestions (embedding neighbors)

#### Level 3 — Small/Fast Model (gemini-2.0-flash)
- Mnemonic generation (first-time creation, then cached)
- Simple hint generation (when pre-generated hints unavailable)
- Dashboard insight natural-language wrapper
- Study path natural-language summary
- Notification text personalization (optional)
- Content summarization (for reference library cards)
- Format normalization during content ingestion

#### Level 4 — Medium Reasoning Model (gemini-2.5-flash)
- SOAP note grading — clinical reasoning assessment
- Question generation — standard blueprint areas with good exemplar coverage
- Answer explanation generation (rich, at authoring time)
- Differential diagnosis tutoring (real-time, per-interaction)
- Wrong-answer tutoring ("why is B wrong?") when cache misses
- Content freshness assessment (compare existing content against new guidelines)
- Auto-author content generation for clinical reference library

#### Level 5 — Frontier Model (gemini-2.5-pro)
- Question generation for underrepresented blueprint areas (CV, PULM — priority #1)
- OSCE grading escalation (scores near pass/fail boundary)
- Complex differential diagnosis tutoring (multi-system, ambiguous presentations)
- Novel clinical scenario creation (cases not well-represented in training data)
- Content review for medical accuracy (high-stakes, batch)

#### Level 6 — Human Review Required
- All AI-generated questions before entering the permanent question bank
- PANCE blueprint taxonomy changes
- Clinical reference content accuracy verification
- OSCE rubric modifications
- Any AI output flagged by deterministic validators (schema failures, taxonomy mismatches)
- Content marked as "low confidence" by the generating model
- Edge cases where AI grading confidence is below threshold

### C3. Dynamic Routing Logic

For tasks at Level 4+, implement confidence-based escalation:

```
function routeTask(task, initialModel):
  result = callModel(initialModel, task)

  if result.confidence >= 0.85:
    return result                          // Accept Level 4 output

  if result.confidence >= 0.60:
    result2 = callModel(frontier, task)    // Escalate to Level 5
    if result2.confidence >= 0.75:
      return result2

  flagForHumanReview(task, result)         // Escalate to Level 6
  return result  // serve Level 4 output with "unverified" badge
```

This applies specifically to:
- Question generation (confidence = CoVe verification score)
- SOAP grading (confidence = rubric coverage completeness)
- Taxonomy auto-mapping (confidence = embedding similarity score)

---

## D. Highest-Value Optimizations (Top 15)

Ranked by composite score of product impact, engineering effort, performance gain, cost efficiency, and confidence level.

### Rank 1: Batch Question Generation with Reservoir Integration
- **Product impact:** Very High — eliminates wait times, ensures blueprint coverage
- **Engineering effort:** Medium — reservoir infrastructure exists; wire generation cron to it
- **Performance gain:** High — removes real-time AI from study sessions entirely
- **Cost efficiency:** High — batch generation uses lower per-token rates; eliminates redundant calls
- **Confidence:** Very High — reservoir pattern already proven in codebase

### Rank 2: Pre-Generate Explanations and Hints at Authoring Time
- **Product impact:** High — instant explanations, no loading spinners
- **Engineering effort:** Low — add fields to Question model; populate during generation batch
- **Performance gain:** Very High — eliminates per-request AI calls for explanations
- **Cost efficiency:** Very High — generate once, serve millions of times
- **Confidence:** Very High — straightforward caching pattern

### Rank 3: Split OSCE Grading into Deterministic + AI Layers
- **Product impact:** High — faster structural feedback, more reliable scores
- **Engineering effort:** Medium — refactor `soapGradingService.ts` into two phases
- **Performance gain:** Medium — structural score returns instantly
- **Cost efficiency:** High — AI only called for qualitative assessment
- **Confidence:** High — rubric-based structural scoring is well-defined

### Rank 4: Token Counting Middleware for All Gemini Endpoints
- **Product impact:** Medium (internal) — enables all future cost optimizations
- **Engineering effort:** Low — wrap existing Gemini proxy with token counter
- **Performance gain:** None directly — enables measurement
- **Cost efficiency:** Very High — you can't optimize what you can't measure
- **Confidence:** Very High — standard observability practice

### Rank 5: Extend Semantic Cache to All AI Endpoints
- **Product impact:** Medium — faster responses for repeated queries
- **Engineering effort:** Low — generalize existing `semanticCacheService.ts`
- **Performance gain:** High — cache hits bypass AI entirely
- **Cost efficiency:** High — estimated 30-50% reduction in redundant calls
- **Confidence:** High — semantic cache already works for question generation

### Rank 6: Daily Dashboard Insight Batch Generation
- **Product impact:** High — personalized study advice every morning
- **Engineering effort:** Medium — new cron job + `gemini-2.0-flash` call per active user
- **Performance gain:** High — dashboard loads with pre-computed insights
- **Cost efficiency:** High — one cheap model call per user per day vs. per-request
- **Confidence:** High

### Rank 7: Wire Rotation/Wellness Signals to Adaptive Dashboard
- **Product impact:** Very High — personalization becomes real instead of placeholder
- **Engineering effort:** Low — data sources exist; just need wiring into normalization, mode profiles, and the load guardrail
- **Performance gain:** Low — already fast
- **Cost efficiency:** N/A — no AI cost
- **Confidence:** Very High — priorities #3 and #4 in CLAUDE.md

### Rank 8: Unified Search Service (FTS + Embeddings)
- **Product impact:** High — one search box for everything
- **Engineering effort:** Medium — consolidate search endpoints, add embedding index
- **Performance gain:** Medium — embedding pre-computation makes search faster
- **Cost efficiency:** Medium — embeddings are cheap
- **Confidence:** Medium — requires careful index design

### Rank 9: Per-User MVRT Calibration
- **Product impact:** Medium — more accurate implicit metrics for fast/slow responders
- **Engineering effort:** Low — percentile-based calculation from user's own history
- **Performance gain:** None — already fast
- **Cost efficiency:** N/A — deterministic
- **Confidence:** High — addresses known trust issue in telemetry path

### Rank 10: Confusion-Pair-Weighted Drill Selection
- **Product impact:** High — drills target actual weak points instead of random due items
- **Engineering effort:** Medium — use confusion pair recurrence data + embedding distance
- **Performance gain:** Low — selection logic is fast
- **Cost efficiency:** N/A — deterministic
- **Confidence:** Medium — requires testing with real user data

### Rank 11: QuizView.tsx Decomposition
- **Product impact:** Medium — reduces maintenance burden, enables faster iteration
- **Engineering effort:** High — 2,274-line monolith requires careful refactoring
- **Performance gain:** Medium — smaller components = better code-splitting
- **Cost efficiency:** N/A — engineering efficiency, not AI cost
- **Confidence:** Medium — large refactor carries risk

### Rank 12: AI Output Provenance Metadata
- **Product impact:** Medium — builds trust, supports future accreditation
- **Engineering effort:** Low — add metadata fields to AI-generated content records
- **Performance gain:** None
- **Cost efficiency:** None directly
- **Confidence:** Very High — simple schema change

### Rank 13: Content Freshness Cron Job
- **Product impact:** Medium — ensures clinical references stay current
- **Engineering effort:** Medium — batch job comparing content against current guidelines
- **Performance gain:** None — background job
- **Cost efficiency:** Medium — batch AI calls, infrequent
- **Confidence:** Medium — medical guideline change detection is hard

### Rank 14: Gemini Model Downgrade for Mnemonic + Simple Tasks
- **Product impact:** Low — mnemonics already work; this just reduces cost
- **Engineering effort:** Very Low — change model constant for mnemonic endpoint
- **Performance gain:** Medium — `gemini-2.0-flash` is faster than `2.5-flash`
- **Cost efficiency:** High — 40-60% cost reduction for these calls
- **Confidence:** High — mnemonics don't need frontier reasoning

### Rank 15: Graceful Degradation Framework
- **Product impact:** Medium — prevents AI outages from breaking the app
- **Engineering effort:** Medium — define fallback for every AI-dependent feature
- **Performance gain:** High during outages
- **Cost efficiency:** N/A
- **Confidence:** High — standard resilience pattern

---

## E. Concrete Recommendations by Feature

### E1. Question Generation
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Blueprint gap analysis | Deterministic | SQL query against UserProgress × PANCE weights | Nightly cron |
| Question creation | Frontier model | `gemini-2.5-pro` for underrepresented areas; `gemini-2.5-flash` for well-covered areas | Nightly batch |
| Verification | Deterministic + AI | CoVe pipeline + schema validator + `pa-curriculum.ts` taxonomy check | Immediately after generation |
| Storage | Cache | PostgreSQL Question table + reservoir queue | After verification |
| Serving | Retrieval | `reserveFromReservoir()` with `FOR UPDATE SKIP LOCKED` | Real-time (zero AI cost) |
| Human review | Manual | Admin queue for flagged questions | Async, weekly |

**Escalation ladder:** `gemini-2.5-flash` → CoVe score < 0.85 → `gemini-2.5-pro` → CoVe score < 0.75 → flag for human review.

### E2. Answer Explanation Generation
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Generation | Medium model | `gemini-2.5-flash` with question context + correct answer + distractor analysis | At question creation time (batch) |
| Storage | Cache | Stored as field on Question record | Persistent |
| Serving | Retrieval | Direct database read | Real-time (zero AI cost) |
| Personalized tutoring | Small model | `gemini-2.0-flash` with question + user's wrong answer | Real-time, cached per (question, answer) pair |

### E3. Hint Generation
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Generation | Small model | `gemini-2.0-flash` — 3 progressive hints per question | At question creation time (batch) |
| Storage | Cache | JSON array on Question record | Persistent |
| Serving | Retrieval | Index into cached array | Real-time (zero AI cost) |
| Fallback | Deterministic | Show question category + "Think about [system]" template | If hints not yet generated |

### E4. Differential Diagnosis Tutoring
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Context assembly | Retrieval | Embedding search for related conditions from reference library | Pre-call |
| Tutoring conversation | Medium model | `gemini-2.5-flash` with case context + student's differential + reference content | Real-time (streaming) |
| Escalation | Frontier model | `gemini-2.5-pro` for multi-system or ambiguous cases | If flash output rated low-confidence |
| Caching | Cache | Store per (case, student-differential) pair | After generation |

### E5. OSCE Grading
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Structural scoring | Deterministic | Regex/NLP checks: SOAP sections present, chief complaint stated, vitals included, assessment has differential, plan has follow-up | Instant (<100ms) |
| Clinical reasoning | Medium model | `gemini-2.5-flash` with SOAP note + rubric + case context | Async (3-8s) |
| Borderline cases | Frontier model | `gemini-2.5-pro` when structural + reasoning scores disagree by >15 points | Async escalation |
| Feedback generation | Medium model | `gemini-2.5-flash` generates actionable feedback | Bundled with reasoning call |
| Template caching | Cache | Pre-generate feedback templates for common deficiencies | Nightly batch |

**Escalation ladder:** Deterministic structure score (instant) → `gemini-2.5-flash` reasoning score → borderline? → `gemini-2.5-pro` → still borderline? → flag for human review.

### E6. Content Summarization
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Card summaries | Small model | `gemini-2.0-flash` — 2-3 sentence summary per reference article | At ingestion (batch) |
| Storage | Cache | Summary field on MedicalContent record | Persistent |
| Serving | Retrieval | Direct read | Real-time (zero AI cost) |

### E7. Content Freshness / Provenance
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Change detection | Deterministic | Compare content timestamps against known guideline update dates | Weekly cron |
| Impact assessment | Medium model | `gemini-2.5-flash` — "has this guideline change affected this content?" | Batch, only for flagged items |
| Update generation | Frontier model | `gemini-2.5-pro` for rewriting content against new guidelines | Batch, human-reviewed |
| Provenance tracking | Deterministic | Metadata fields: source, model, generated_at, reviewed_at, reviewer_id | Schema change |

### E8. Personalized Study Path Generation
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Priority computation | Deterministic | PANCE blueprint weights × FSRS retrievability × rotation schedule × EOR dates | On session completion + daily cron |
| Natural-language brief | Small model | `gemini-2.0-flash` — "Today focus on pulmonary because..." | Daily, cached |
| Recalculation trigger | Deterministic | New session completed OR rotation changed OR EOR date approaching | Event-driven |

### E9. Confusion-Pair Detection
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Pattern detection | Deterministic | Track when user gets A wrong and picks B, then gets B wrong and picks A | On every QuestionAttempt write |
| Pair validation | Embeddings | Verify A and B are semantically related (cosine similarity > 0.7) | Batch, after pattern detected |
| Drill targeting | Deterministic | Boost confusion-pair items in drill queue priority | Real-time queue adjustment |
| Teaching intervention | Medium model | `gemini-2.5-flash` — "Here's how to distinguish A from B" | Generated once per pair, cached |

### E10. Dashboard Learner Insight Generation
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Metric computation | Deterministic | SQL: accuracy by system, trend over 7/30/360 days, session frequency, FSRS stats | Daily cron |
| Insight synthesis | Small model | `gemini-2.0-flash` — convert metrics into 3-5 actionable insights | Daily per user, cached |
| Anomaly detection | Deterministic | Flag: accuracy drop >10% in any system, missed 3+ days, FSRS backlog >50 | Real-time check |
| Alert generation | Deterministic | Template-based alert for anomalies | Real-time |

### E11. Reference Search
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Keyword search | Deterministic | PostgreSQL FTS via `search_vector` | Real-time |
| Semantic search | Embeddings | `text-embedding-005` query → cosine similarity against pre-computed content embeddings | Real-time |
| Result ranking | Deterministic | Combine FTS score + embedding similarity + PANCE yield score | Real-time |
| Fallback | Deterministic | ILIKE substring (already implemented) | If FTS + embedding both miss |

### E12. Flashcard / Review Recommendation Logic
| Layer | Method | Model/Tool | Timing |
|-------|--------|-----------|--------|
| Due items | Deterministic | FSRS retrievability < threshold | Real-time |
| Priority ordering | Deterministic | Reservoir priority scores (OVERDUE=100, DUE=80, BLUEPRINT_GAP=60, etc.) | Real-time |
| Confusion-pair boost | Deterministic | +20 priority for items in active confusion pairs | Real-time |
| Session sizing | Deterministic | Fatigue model (time of day + recent session count) determines session length | Real-time |

**No AI needed.** This is entirely algorithmic.

---

## F. Build Order

### Phase 1: NOW (Weeks 1-3) — Quick Wins + Measurement Foundation

These require low engineering effort, have high ROI, and unblock future optimizations.

**F1.1 — Token counting middleware** (Rank #4)
Add token usage logging to all Gemini proxy endpoints. Without this, every cost claim in this document is an estimate. Implementation: wrap `functions/api/gemini/` handlers with a counter that logs model, endpoint, input_tokens, output_tokens, and user_id.

**F1.2 — Wire rotation/wellness signals to the adaptive dashboard** (Rank #7)
Pure wiring, no AI. Feed rotation deadlines, session load, and wellness signals into dashboard normalization so EOR/didactic, overloaded, behind, and maintenance modes select the correct widgets.

**F1.3 — Model downgrade for mnemonics + simple tasks** (Rank #14)
Change `generate-mnemonic` endpoint from `gemini-2.0-flash` (already correct per codebase) to ensure no accidental upgrades. Audit all AI endpoints to confirm cheapest-viable model is used.

**F1.4 — AI output provenance metadata** (Rank #12)
Add `generated_by_model`, `generated_at`, `verification_score`, `human_reviewed` fields to Question and MedicalContent tables. Prisma migration, no logic change.

**F1.5 — Extend semantic cache to all AI endpoints** (Rank #5)
Generalize `semanticCacheService.ts` to cover mnemonic generation, SOAP grading (per-rubric), and explanation generation. Estimated 30-50% redundant call reduction.

**F1.6 — Per-user MVRT calibration** (Rank #9)
Replace fixed MVRT thresholds (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms) with user-percentile-based thresholds after 20+ attempts. Addresses known telemetry trust issue.

### Phase 2: NEXT (Weeks 4-8) — Core Architecture Improvements

These are medium-effort, high-impact changes that reshape how AI is used.

**F2.1 — Batch question generation with reservoir integration** (Rank #1)
Build a nightly cron job that: (1) identifies blueprint areas below target question count, (2) generates questions in batches using `gemini-2.5-pro`, (3) runs CoVe + deterministic validation, (4) inserts into reservoir. This is the single highest-impact optimization.

**F2.2 — Pre-generate explanations and hints** (Rank #2)
Extend the batch generation pipeline: for every new question, also generate explanation + 3 hints. Store on the Question record. Serve from cache at session time.

**F2.3 — Split OSCE grading** (Rank #3)
Refactor `soapGradingService.ts` into: (1) deterministic structural scorer (instant), (2) AI reasoning scorer (async), (3) confidence-based escalation to `gemini-2.5-pro`. Return structural score immediately; append AI score when ready.

**F2.4 — Daily dashboard insight generation** (Rank #6)
New cron job: per active user, compute SQL metrics → call `gemini-2.0-flash` for natural-language insights → cache. Dashboard reads from cache.

**F2.5 — Confusion-pair-weighted drill selection** (Rank #10)
Use existing confusion pair recurrence data to boost drill queue priority. Add embedding similarity validation to confirm pairs are genuinely related.

### Phase 3: LATER (Weeks 9-16) — Platform Maturity

These are higher-effort or depend on Phase 1-2 foundations.

**F3.1 — Unified search service** (Rank #8)
Consolidate library search, question search, and content discovery into a single embedding-powered search service. Requires pre-computing embeddings for all content types.

**F3.2 — QuizView.tsx decomposition** (Rank #11)
Refactor the 2,274-line monolith into composable components/hooks. Not AI-related but critical for velocity on all future session features.

**F3.3 — Content freshness cron** (Rank #13)
Weekly job that checks MedicalContent against known guideline update sources. Flags stale content for admin review. Uses `gemini-2.5-flash` for impact assessment.

**F3.4 — Graceful degradation framework** (Rank #15)
Define and implement fallback behavior for every AI-dependent feature. Test by simulating Gemini API outage. Ensure zero AI-dependent features cause hard failures.

**F3.5 — Dynamic model routing with confidence escalation**
Implement the `routeTask()` logic from Section C3. Start with question generation (flash → pro → human review based on CoVe confidence). Expand to OSCE grading and tutoring.

**F3.6 — Personalized study path with natural-language brief**
Wire the deterministic priority algorithm to a daily `gemini-2.0-flash` call that generates a personalized "study today" message. Depends on F1.2 (real rotation data) and F2.4 (insight generation infrastructure).

---

## Summary: Cost Impact Estimates

| Optimization | Estimated Monthly Savings (100 users) | Timeline |
|-------------|---------------------------------------|----------|
| Batch question generation (eliminate real-time gen) | $200-400 | Phase 2 |
| Pre-generated explanations/hints | $100-200 | Phase 2 |
| Semantic cache extension | $50-150 | Phase 1 |
| Model downgrades for simple tasks | $30-80 | Phase 1 |
| Split OSCE grading | $50-100 | Phase 2 |
| Dashboard insight batching | $20-50 | Phase 2 |
| **Total estimated savings** | **$450-980/month** | — |

Against an estimated current spend of $500-800/month at 100 users, this represents a 55-120% efficiency improvement — meaning you can serve 2-3x the users at the same cost, while improving response times and educational quality.

---

---

## G. Implementation Status (Updated 2026-04-06)

### Phase 1 — COMPLETE

| Item | Status | Files Changed |
|------|--------|---------------|
| F1.1 Token counting middleware | ✅ Done | `functions/api/_shared/tokenTracking.ts` (new), `functions/api/gemini/index.ts`, `functions/api/gemini/stream.ts`, `functions/api/ai/generate-mnemonic.ts` |
| F1.2 Wire rotation/wellness signals to adaptive dashboard | ⏳ Pending (wiring only) | — |
| F1.3 Model audit + downgrades | ✅ Done | `conditions/[identifier]/structured.ts`, `admin/generate-draft.ts`, `_shared/analyzeBehaviorGemini.ts`, `knowledge/cache.ts` — 4 endpoints downgraded from `-exp`/2.5 to stable `gemini-2.0-flash` |
| F1.4 AI output provenance metadata | ✅ Already done | (Migration `20260403100000`) |
| F1.5 Semantic cache extension | ✅ Already covered | Mnemonics, questions, library answers all cached |
| F1.6 Per-user MVRT calibration | ✅ Done | `types/telemetry.ts` (new `UserMVRTCalibration` type + `computeUserMVRTCalibration()`), `lib/services/drillReviewService.ts` |

**New artifacts:**
- `prisma/migrations/20260406120000_add_ai_token_usage_tracking/migration.sql` — AITokenUsage table + indexes
- `functions/api/_shared/tokenTracking.ts` — Non-blocking token persistence + cost estimation

### Phase 2 — COMPLETE

| Item | Status | Files Changed |
|------|--------|---------------|
| F2.1 Batch question generation | ✅ Done | `functions/api/cron/batch-generate-questions.ts` (new) — blueprint gap analysis + batch generation + CoVe validation |
| F2.2 Pre-generate explanations + hints | ✅ Done | Integrated into batch generation prompt (3 progressive hints per question) |
| F2.3 Split OSCE grading | ✅ Done | `lib/services/osceStructuralScorer.ts` (new) — deterministic SOAP/elements/communication/safety scoring (<50ms) |
| F2.4 Daily dashboard insights | ✅ Done | `functions/api/cron/generate-daily-insights.ts` (new) — per-user metrics + gemini-2.0-flash summary, cached in DailyStudyPlan |
| F2.5 Confusion-pair drill targeting | ✅ Done | `lib/services/reservoir/confusionPairBoost.ts` (new) — tiered priority boost (high=+4, medium=+2, low=+1) |

### Phase 3 — NOT STARTED

Pending Phase 1-2 deployment and monitoring.

---

*This strategy is grounded in PANaCEa's actual codebase as of 2026-04-06. All file references, model names, and architectural patterns reflect the current implementation. Recommendations should be re-evaluated as the codebase evolves.*
