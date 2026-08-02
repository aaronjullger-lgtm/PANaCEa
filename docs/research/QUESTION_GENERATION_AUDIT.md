# Question Generation Pipeline — Full Audit

**Date:** 2026-04-06
**Scope:** Request → prompt → AI call → validation → storage → serving → answer submission → statistics → variant generation
**Files audited:** 35+
**Total lines reviewed:** ~8,500+

---

## 1. Pipeline Architecture Overview

The question generation system has **four tiers** of generation, **two variant pathways**, and a **multi-stage answer processing pipeline** that feeds statistics back into scheduling. Here's the end-to-end flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ GENERATION (4 tiers)                                                    │
│                                                                         │
│  Tier 1: Semantic Cache → instant return if cache hit                   │
│  Tier 2: Staging Lake  → reuse pre-vetted StagingQuestion               │
│  Tier 3: AI Generation → Gemini + Google Search grounding + PubMed      │
│  Tier 4: Deep Gen      → Gemini cached context (1M+ tokens), stateless  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ VALIDATION & QUALITY                                                    │
│                                                                         │
│  Schema validator   → structure, option count, diagnosis leak detection  │
│  CoVe pipeline      → claim extraction → verify → answer check → dist.  │
│  Quality scorer     → vignette, explanation, accuracy range, flag rate   │
│  Review gate        → auto-approve ≥0.9, pending ≥0.7, else revision    │
│  Semantic dedup     → hash + Jaccard similarity                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ STORAGE (6 tables)                                                      │
│                                                                         │
│  Question              → canonical, reviewed questions                   │
│  PreGeneratedQuestion  → pool of AI-generated, pending or approved       │
│  StagingQuestion       → AI drafts awaiting admin review                 │
│  QuestionSeed          → parameterized templates for permutation gen     │
│  QuestionVariant       → reactive variants (TABLE NOT DEPLOYED)          │
│  QuestionVersion       → version history / change tracking               │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ SERVING                                                                 │
│                                                                         │
│  questionPoolService   → per-user no-repeat from PreGeneratedQuestion    │
│  secondChanceEngine    → subdomain-level variant selection               │
│  due-siblings endpoint → sibling fetch with on-demand generation         │
│  Proactive Reservoir   → background queue, SKIP LOCKED                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ ANSWER SUBMISSION (/api/drills/submit-review)                           │
│                                                                         │
│  Correctness → Implicit Rating → Par Time → Circadian →                 │
│  FSRS Update → QuestionAttempt → ReviewLog → UserProgress →             │
│  ConfusionPair → ensureDueVariant (on incorrect)                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ VARIANT GENERATION (2 pathways)                                         │
│                                                                         │
│  Hot path: ensureDueVariant() on incorrect → PreGeneratedQuestion        │
│  Cold path: /api/cron/generate-variants daily → PreGeneratedQuestion     │
│  (Legacy): variantQueueService → QuestionVariant (table missing)         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Generation Endpoints Audit

### 2.1 `functions/api/questions/generate.ts` (478 lines)
**Role:** Primary single-question generation with 3-tier cache strategy.

**Flow:** Semantic cache → staging lake lookup → AI generation (Gemini + grounding) → clinical pearl extraction → cache result.

**DB writes:** `medicalContent` (pearls), `semanticCache` (via helper).

**Issues found:**
- PubMed enrichment call (`enrichWithPubMed`) in `_shared/question-generator.ts` is **unguarded** — if PubMed API fails, the entire generation fails. Should be wrapped in try/catch with fallback.
- Rate limited at 60 req/min (good).

### 2.2 `functions/api/questions/generate-batch.ts` (373 lines)
**Role:** Bulk pre-generation seeding the `PreGeneratedQuestion` pool.

**DB writes:** `preGeneratedQuestion.createMany()`

**Issues found:**
- **No per-item retry logic.** A single Gemini timeout or 429 kills the entire batch. Items processed sequentially with 1200ms delay but no individual error recovery.
- **No partial success reporting.** If item 25 of 50 fails, the caller doesn't know which succeeded.
- Distractor validation gate at 70% threshold (good).
- Max 50 per batch (good safety bound).

### 2.3 `functions/api/questions/generate-enhanced.ts` (636 lines)
**Role:** High-quality generation with CoVe (Chain of Verification).

**DB writes:** `stagingQuestion.create()`, `question.create()` (promotion), `stagingQuestion.update()`

**Issues found:**
- **CoVe failure still saves to DB.** After 3 retry failures, the code logs a warning but continues to write the unverified question to the staging table. This means questions that failed all verification attempts can still enter the pipeline.
- This is the only edge function using the full CoVe pipeline.

### 2.4 `functions/api/questions/generate-deep.ts`
**Role:** Admin-only preview generation using AI Gateway + Gemini cached PANCE blueprint context.

**DB writes:** None — returns preview JSON only (`submissionReady: false`, `persistence: "admin_preview_only"`).

**Current behavior:**
- Routes through `lib/ai/aiGateway.ts` (`task: 'generation'`, `tier: 'balanced'`, `grounded: true`) with `cachedContent`.
- Filters malformed items (required fields, ≥4 options, valid `correctAnswerIndex`) before responding.
- Optional `ENABLE_QUALITY_GATE=true` runs `runQualityGate()` and drops quarantined previews.

**Remaining gaps:**
- Gateway text path does not force `responseMimeType: application/json` (markdown fence stripping still required).
- Preview output is not yet on the canonical generated-question schema adapter.

### 2.5 `functions/api/admin/generate-question.ts` (182 lines)
**Role:** Admin taxonomy-driven generation.

**Issues found:**
- Admin role check exists but **never refreshes token/session** — stale role cache risk (low severity).

### 2.6 `functions/api/admin/generate-draft.ts` (214 lines)
**Role:** AI draft medical content generation.

**Issues found:**
- **No schema validation on AI response.** Parses AI JSON without checking required fields.
- 409 response on duplicate could leak condition IDs (minor info disclosure).

---

## 3. Shared Generation Modules Audit

### 3.1 `functions/api/_shared/question-generator.ts` (304 lines)
**Role:** Core generation logic with few-shot examples, Google Search grounding, PubMed enrichment.

**Issues found:**
- `fetchGroundingContext()` **silently swallows all errors** — network failures hidden from caller. Logs a warning but returns empty context.
- `enrichWithPubMed()` call has **no try/catch** — if PubMed API fails, entire generation fails.
- Few-shot examples are hardcoded inline (no versioning or A/B testing).

### 3.2 `functions/api/_shared/question-schema.ts` (124 lines)
**Role:** Zod schema for Gemini structured output.

**Status:** Clean. Enforces minimum 50-char vignette, diagnosis name exclusion from stem.

### 3.3 `functions/api/_shared/question-validator.ts` (274 lines)
**Role:** Post-generation validation — diagnosis leak detection, duplicate options, explanation structure.

**Issues found:**
- Validation returns `{ valid, errors }` but **never throws** — callers must explicitly check the `valid` flag. If a caller ignores it, invalid questions pass through.
- 13 test cases exist (good coverage).

---

## 4. Library-Level Generation Modules Audit

### 4.1 `lib/questionGenerator.ts` (167 lines)
**Role:** Base Gemini generation for Node.js scripts.

**Issues found:**
- Has a **mock path for tests** (`NODE_ENV === 'test'` returns mock questions). This is correct but the mock data quality should be periodically reviewed.
- Uses `GEMINI_PRO_MODEL` from constants.
- Calls `validateQuestion()` before returning (good).

### 4.2 `lib/questionVariantGenerator.ts` (81 lines)
**Role:** Variant generation via Gemini with structured JSON schema.

**Issues found:**
- Uses **hardcoded model** `gemini-2.0-flash-exp` instead of importing from constants. If the model name changes, this file won't update.
- Supports both Edge (from `context.env`) and Node (`process.env`) API key — good dual-environment support.
- **No production caller imports this directly** except `ensureDueVariant.ts` and `variantQueueService.ts`.

### 4.3 `lib/verified-question-generator.ts` (397 lines)
**Role:** CoVe wrapper around base generation.

**Issues found:**
- `AUTO_ACCEPT_CONFIDENCE = 0.85` — questions above this threshold bypass full verification. This is a reasonable threshold.
- **Graceful degradation** — returns best available question even if all verification attempts fail (good).

### 4.4 `lib/cove-verification.ts` (809 lines — largest file)
**Role:** 4-step Chain of Verification pipeline.

**Issues found:**
- **Dead code:** Commented-out AI blending logic at lines ~446-453.
- JSON sanitization handles markdown code blocks (good).
- `minVerificationRate: 0.7` — 30% of claims can be unverified and still pass. This is intentional for claims that reference specialized knowledge not in the DB.

### 4.5 `lib/questionQuality.ts` (98 lines)
**Role:** Scoring formula for quality gating.

**Issues found:**
- Scoring formula is simple (max 45 points from 5 checks). The `passesQualityGate(threshold=70)` default means a question needs at least 4 of 5 checks passing. But the scoring doesn't weight clinical accuracy heavily enough — a question with a good vignette, explanation, conditionId, and no flags scores 45 even without accuracy data.

### 4.6 `services/core/questionQualityService.ts` (409 lines)
**Role:** Semantic hashing, Jaccard dedup, distractor quality scoring.

**Issues found:**
- **Dead code:** Commented-out AI blending logic at lines 283-289 (same pattern as cove-verification).
- `generateSemanticHash()` uses a browser-compatible hash function (not SHA-256). This is fine for dedup but collision rate is higher than crypto hashes.
- **Dedup is post-hoc only** — not checked at generation time.

### 4.7 `services/core/questionPoolService.ts` (445 lines)
**Role:** Per-user question serving from PreGeneratedQuestion pool.

**Issues found:**
- `checkAndTriggerGeneration()` calls `POST /api/questions/generate-batch` via fetch when pool is low. **This is an HTTP self-call** from the pool service — works but adds latency and could fail if the endpoint is rate-limited.
- `POOL_LOW_THRESHOLD = 20`, `POOL_REFILL_COUNT = 50` — reasonable.
- Pool service is used by **Express routes only** (`routes/questions.ts`), not Edge functions. Edge functions use different serving paths.

### 4.8 `services/core/questionSeedService.ts` (317 lines)
**Role:** Template-based parameterized question generation (Task 111: Vignette Permutation).

**Issues found:**
- **Appears incomplete/unused.** No production caller found. The seed → assemble → serve pipeline exists but isn't wired to any endpoint or cron.
- `assembleQuestionFromSeed()` does Fisher-Yates shuffle on options, increments usage stats — well-implemented but dormant.

### 4.9 `lib/services/questionReviewGate.ts` (135 lines)
**Role:** Auto-approve/review routing.

**Status:** Clean. Thresholds: auto-approve ≥0.9, pending ≥0.7, revision <0.7, rejected if flagCount ≥3.

---

## 5. Answer Submission Pipeline Audit

### 5.1 `functions/api/drills/submit-review.ts`
**Role:** Primary answer submission endpoint for both main sessions and drills.

**Flow:**
1. Validate request (Zod schema)
2. Resolve question via `resolveReviewQuestion()`
3. Call `submitDrillReview()` (core pipeline)
4. On incorrect: `ensureDueVariant()` (fire-and-forget)
5. Schedule concept review via `scheduleConceptReview()`
6. Return FSRS schedule + implicit metrics

**Issues found:**
- `ensureDueVariant()` is called **fire-and-forget** with `.catch()` — errors are logged but don't fail the request. This is intentional and correct (non-blocking variant generation).

### 5.2 `lib/services/drillReviewService.ts` (1291 lines)
**Role:** Core submission pipeline — the most complex file in the system.

**Data written to 10 tables:**
1. `QuestionAttempt` — single row with full telemetry
2. `UserQuestionSeen` — upsert with avgTimeMs
3. `Question` — increment timesSeen/timesCorrect (non-fatal if pre-generated only)
4. `PreGeneratedQuestion` — increment timesServed/timesCorrect/timesIncorrect
5. `Rolling360` — upsert per system
6. `ReviewLog` — create (only if conditionId exists AND shouldLogReview=true)
7. `UserProgress` — update fsrsCard + reviewHistory (transactional)
8. `UserTopicProgress` — upsert per taskType (transactional)
9. `Card` — upsert per-question (non-fatal if fails)
10. `ConfusionPair` — upsert + increment count

**FSRS Gate (multi-layered, correct):**
```
shouldUpdateFSRS =
  sessionType !== 'cram' AND
  sessionType !== 'rapid_recall' AND
  question.conditionId exists AND
  NOT isRapidGuess
```

**Rapid Guess Detection:**
```
isRapidGuess = telemetry.rapid_guess ?? numericTime < effectiveMvrt
effectiveMvrt = max(SERVER_MVRT_THRESHOLD_MS=2000, userMvrtCalibration)
```

**Issues found:**
- **Non-transactional stats writes.** QuestionAttempt, UserQuestionSeen, Question stats, PreGeneratedQuestion stats, and Rolling360 are written **outside** the FSRS transaction. If the FSRS transaction fails after these writes, stats are recorded but FSRS isn't updated — creating a consistency gap.
- **Duplicate attempt guard** uses a 5-minute window — good.
- **KAR3L sibling propagation** is non-blocking (correct).

### 5.3 `lib/implicit-metrics.ts` (794 lines)
**Role:** Behavioral confidence derivation (zero-friction, no self-rated buttons).

**Signals used:** timeToFirstClick, answerSwitches, totalDwellTime, commitmentGapMs, cursorEntropy, hoverOscillationCount, hintViewed/Duration, questionType.

**Status:** Mature. Multi-wave pipeline (Sprint 1-7) with type-specific weighting, circadian adjustment, and Ghost Grader integration. No issues found.

### 5.4 `functions/api/questions/attempt.ts` (legacy)
**Role:** Stats-only endpoint for backward compatibility / offline answers.

**Critical note:** Does NOT write FSRS, ReviewLog, or Rolling360. Does NOT trigger variant generation. This is a **partial pipeline** — only records QuestionAttempt and UserQuestionSeen.

---

## 6. Variant Generation Pipeline Audit

### 6.1 `lib/ensureDueVariant.ts` (154 lines) — HOT PATH
**Role:** On-demand variant generation triggered by incorrect answers.

**Flow:**
1. Check if sibling PreGeneratedQuestion exists for the same condition
2. If sibling count ≥ 1, return (already covered)
3. Otherwise, generate variant via Gemini (`generateVariant()`)
4. Store as new `PreGeneratedQuestion`

**Issues found:**
- **Sibling threshold is only 1.** Once a single sibling exists, no more variants are generated. For high-confusion conditions, this may be insufficient.
- **Random variant type selection** (`Math.random()` from 3 types) — doesn't consider what types already exist. Could generate 3 "rephrased" variants and 0 "different_scenario".
- **No deduplication check.** The newly generated variant isn't checked against existing questions for similarity.
- Edge-safe: uses `crypto.randomUUID()` with fallback.
- Writes to `PreGeneratedQuestion` (not `QuestionVariant` table) — correct production behavior.

### 6.2 `lib/services/batchVariantService.ts` (453 lines) — COLD PATH
**Role:** Proactive bulk variant generation for pool health.

**Flow:**
1. `assessPoolHealth()` — SQL counts Q + PreGeneratedQuestion per condition
2. Identify thin conditions (< 3 total questions)
3. For each: find source, generate 1-3 variants cycling through types
4. Store as `PreGeneratedQuestion`

**Issues found:**
- **Rate limiting is basic** — 1200ms delay between Gemini calls. No exponential backoff on 429s.
- **Max 50 per run** — good safety bound.
- Writes to `PreGeneratedQuestion` (correct).

### 6.3 `functions/api/cron/generate-variants.ts` (97 lines)
**Role:** Cloudflare cron trigger (daily 4 AM UTC).

**Issues found:**
- Requires `CRON_SECRET` for manual triggers (good).
- Returns pool health snapshot alongside generation results (good observability).

### 6.4 `services/core/variantQueueService.ts` (126 lines) — LEGACY/UNUSED
**Role:** Adaptive variant selection based on confusion pairs and weakness patterns.

**Status:** **DEAD CODE in production.** This service writes to the `QuestionVariant` table, which has no migration and doesn't exist in the database. The adaptive strategy selection (confusion → different_distractors, weakness ≥3 → decomposition, etc.) is sophisticated but completely unused.

**The active variant path (`ensureDueVariant.ts`) does NOT use any of this adaptive logic.** It picks a random variant type instead.

### 6.5 `lib/services/secondChanceEngine.ts` (499 lines)
**Role:** Subdomain-level review scheduling with variant selection.

**Strategy cascade:**
1. Unused `QuestionVariant` matching taskType → **BROKEN** (table doesn't exist)
2. Different `PreGeneratedQuestion` for same condition + taskType
3. Cross-task fallback
4. Canonical question fallback

**Issues found:**
- **Strategy 1 queries `QuestionVariant` table** which doesn't exist in production. This will throw a Prisma error at runtime, forcing fallback to Strategy 2 (which works). The engine is resilient due to the cascade, but Strategy 1 is dead weight that generates unnecessary errors.
- Integrates `recognitionRiskDetector` for variant forcing (good).
- Blueprint weighting for priority scoring (good).

### 6.6 `lib/services/recognitionRiskDetector.ts` (300 lines)
**Role:** Detects when students are recognizing answers rather than recalling knowledge.

**4 parallel signals:** repeat exposure (40%), fast response (25%), accuracy divergence (20%), high reps/low stability (15%).

**Status:** Well-implemented. Forces variant when composite risk ≥ 0.6. Research-backed (Kornell & Bjork 2008, Roediger & Karpicke 2006).

### 6.7 `functions/api/questions/due-siblings.ts` (263 lines)
**Role:** Fetch sibling questions for Due Cards sessions with on-demand generation.

**Flow:**
1. For each due item, find PreGeneratedQuestion siblings (excluding original)
2. Filter by taskType if provided
3. If no sibling found AND GEMINI_API_KEY set: call `ensureDueVariant()` then retry query

**Status:** Clean. This is the primary consumer of `ensureDueVariant()` alongside `submit-review.ts`.

---

## 7. Consolidated Findings

### CRITICAL (blocks functionality)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| C1 | `QuestionVariant` table has no migration | `prisma/schema.prisma` | `variantQueueService` and `secondChanceEngine` Strategy 1 fail at runtime |
| C2 | `secondChanceEngine` queries non-existent `QuestionVariant` table | `secondChanceEngine.ts:207` | Throws Prisma error on every Second Chance review; falls through to Strategy 2 |

### HIGH (degraded quality or reliability)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| H1 | CoVe failure still saves question to staging DB | `generate-enhanced.ts:~335-341` | Unverified questions enter the pipeline after 3 failed verification attempts |
| H2 | PubMed enrichment has no try/catch | `question-generator.ts:199` | PubMed outage crashes entire generation flow |
| H3 | Batch generation has no per-item retry | `generate-batch.ts` | Single Gemini timeout kills entire 50-question batch |
| H4 | `ensureDueVariant` uses random variant type | `ensureDueVariant.ts:102-103` | No adaptive strategy — doesn't use confusion pairs or weakness data |
| H5 | `variantQueueService` adaptive logic is dead code | `variantQueueService.ts` | Sophisticated confusion-based variant selection completely unused |

### MEDIUM (suboptimal behavior)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| M1 | Grounding context fetch silently swallows errors | `question-generator.ts:19-42` | Questions generated without current clinical evidence, no caller awareness |
| M2 | No dedup check at generation time | `ensureDueVariant.ts`, `generate-batch.ts` | Duplicate questions generated, wasting Gemini tokens and review time |
| M3 | Non-transactional stats writes before FSRS transaction | `drillReviewService.ts` | If FSRS fails, stats are recorded but scheduling isn't updated |
| M4 | ~~`generate-deep.ts` no field validation~~ | `generate-deep.ts` | **Addressed** — malformed items filtered; optional `ENABLE_QUALITY_GATE` |
| M5 | `questionSeedService` appears unused | `questionSeedService.ts` | 317 lines of well-implemented template permutation logic sitting dormant |
| M6 | Hardcoded model in variant generator | `questionVariantGenerator.ts` | `gemini-2.0-flash-exp` won't update with constants |
| M7 | `ensureDueVariant` sibling threshold is only 1 | `ensureDueVariant.ts:77` | High-confusion conditions get insufficient variant coverage |
| M8 | Pool service uses HTTP self-call for refill | `questionPoolService.ts` | Extra latency + possible rate limiting on self-request |

### LOW (cosmetic or minor)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| L1 | Dead code: commented-out AI blending | `questionQualityService.ts:283-289`, `cove-verification.ts` | Code clutter |
| L2 | Few-shot examples hardcoded in generator | `question-generator.ts` | No prompt versioning or A/B capability |
| L3 | Admin role check doesn't refresh token | `generate-question.ts:45-52` | Stale role cache (very low risk) |
| L4 | Validator never throws | `question-validator.ts` | Callers must remember to check `valid` flag |
| L5 | `generate-draft.ts` no schema validation on AI response | `generate-draft.ts:110-114` | AI-generated JSON may have missing required fields |

---

## 8. Data Flow Summary: Tables Written Per Path

| Path | QA | UQS | Q stats | PGQ stats | R360 | RL | UP | UTP | Card | CP | PGQ create | QV create |
|------|:--:|:---:|:-------:|:---------:|:----:|:--:|:--:|:---:|:----:|:--:|:----------:|:---------:|
| submit-review (correct) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| submit-review (incorrect) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* | — |
| submit-review (rapid guess) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓† | — | — | — | — | — | — |
| attempt.ts (legacy) | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| generate-batch | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| generate-enhanced | — | — | — | — | — | — | — | — | — | — | — | — |
| cron/generate-variants | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| due-siblings | — | — | — | — | — | — | — | — | — | — | ✓* | — |
| variantQueueService | — | — | — | — | — | — | — | — | — | — | — | ✓‡ |

**Legend:** QA=QuestionAttempt, UQS=UserQuestionSeen, RL=ReviewLog, UP=UserProgress, UTP=UserTopicProgress, CP=ConfusionPair, PGQ=PreGeneratedQuestion, QV=QuestionVariant
`*` = via ensureDueVariant (fire-and-forget)
`†` = review_type='rapid_guess', no FSRS update
`‡` = BROKEN — table doesn't exist in production

---

## 9. Relationship to Improvement List

This audit directly informs the previously proposed improvements:

| Audit Finding | Maps to Improvement # |
|---|---|
| C1, C2: QuestionVariant table missing | #1 Deploy QuestionVariant Migration (DONE) |
| H3: No batch retry logic | #7 Batch Generation Reliability Hardening |
| H4, H5: Random variant type, adaptive logic unused | #6 Structured Distractor Engineering from Confusion Pairs |
| M1, H2: Grounding/PubMed error handling | #3 Enrich Generation Prompts with MedicalContent Context |
| M2: No generation-time dedup | #9 Cross-Question Dedup at Generation Time |
| L2: Hardcoded few-shot examples | #4 Prompt Version Tracking & A/B Framework |
| M5: questionSeedService unused | #8 Question Seed → Generation Pipeline Completion |
| H1: CoVe failure saves to DB | New finding — recommend adding to list |
