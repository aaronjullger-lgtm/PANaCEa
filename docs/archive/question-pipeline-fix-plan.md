# Question Generation Pipeline — Fix Implementation Plan
**Date:** 2026-04-06
**Scope:** Addresses all C/H/M/L findings from the full pipeline audit
**Phases:** 6 (ordered by impact and dependency)

---

## Overview

Fixes are grouped into six phases. Each phase is independently deployable, with later phases building on earlier ones. The QuestionVariant migration already exists on disk (`20260406140000_add_question_variant_table`); Phase 1 focuses on verifying it's applied and wiring it safely.

---

## Phase 1 — Critical: Deploy & Safely Wire QuestionVariant Table

**Addresses:** C1, C2
**Files:** `prisma/migrations/20260406140000_add_question_variant_table/migration.sql`, `lib/services/secondChanceEngine.ts`, `services/core/variantQueueService.ts`

### 1.1 Verify migration is applied

```bash
npx prisma migrate deploy
# or verify with:
npx prisma migrate status
```

The migration file already exists at `prisma/migrations/20260406140000_add_question_variant_table/migration.sql`. Confirm it has been applied to production via `prisma migrate status` before proceeding to 1.2.

### 1.2 Fix `secondChanceEngine.ts` — Guard Strategy 1 with try/catch

**File:** `lib/services/secondChanceEngine.ts` ~line 207
**Problem:** `prisma.questionVariant.findFirst()` throws a runtime Prisma error on every call if the table doesn't exist, silently forcing Strategy 2 via error propagation. Even after the migration, this code needs defensive wrapping since table availability at runtime can't be assumed during deployments.

**Change:** Wrap Strategy 1 in its own try/catch so that any Prisma error (table missing, schema mismatch) cleanly falls through to Strategy 2 with an explicit log — not a thrown exception.

```typescript
// BEFORE (line ~207):
const unusedVariant = await prisma.questionVariant.findFirst({
  where: { ... },
  select: { id: true, baseQuestionId: true },
});

// AFTER:
let unusedVariant: { id: string; baseQuestionId: string } | null = null;
try {
  unusedVariant = await prisma.questionVariant.findFirst({
    where: {
      baseQuestion: { conditionId },
      taskType,
      NOT: { usedByUsers: { has: userId } },
      id: { notIn: [...excludeQuestionIds] },
    },
    select: { id: true, baseQuestionId: true },
  });
} catch (variantTableErr) {
  // Table not yet deployed or schema mismatch — fall through to Strategy 2
  logger?.warn('[SecondChance] QuestionVariant query failed, falling back to Strategy 2', {
    error: variantTableErr instanceof Error ? variantTableErr.message : String(variantTableErr),
    conditionId,
  });
}
```

### 1.3 `variantQueueService.ts` — Now usable, but wire it correctly

With the table deployed, `variantQueueService` is no longer dead code. However, it has a gap: it calls `generateVariant()` without passing an API key (relying on `process.env`), which fails silently in Edge. Update the constructor to accept an optional `apiKey` and thread it through:

```typescript
// BEFORE:
export class VariantQueueService {
  constructor(private prisma: PrismaClient) {}

// AFTER:
export class VariantQueueService {
  constructor(
    private prisma: PrismaClient,
    private apiKey?: string
  ) {}

  // ... in queueVariantForReview:
  const newVariantData = await generateVariant({
    originalQuestion: originalQuestion.question,
    originalOptions: options,
    originalAnswer: originalQuestion.correctAnswer,
    originalExplanation: originalQuestion.explanation,
    targetType,
  }, this.apiKey);  // <-- pass apiKey
```

**Also note:** `variantQueueService` references `weaknessPattern` table. Verify this model exists in `prisma/schema.prisma` before wiring. If it doesn't, remove that branch and rely only on `confusionPair` for adaptive strategy selection.

---

## Phase 2 — High: Generation Reliability & Error Handling

**Addresses:** H1, H2, H3
**Files:** `functions/api/_shared/question-generator.ts`, `functions/api/questions/generate-enhanced.ts`, `functions/api/questions/generate-batch.ts`

### 2.1 Wrap `enrichWithPubMed()` in try/catch

**File:** `functions/api/_shared/question-generator.ts` ~line 199
**Problem:** PubMed API failure throws, crashing entire generation.

```typescript
// BEFORE (approximately):
const citations = await enrichWithPubMed(condition, apiKey);

// AFTER:
let citations: PubMedCitation[] = [];
try {
  citations = await enrichWithPubMed(condition, apiKey);
} catch (pubmedErr) {
  logger?.warn('[QuestionGen] PubMed enrichment failed — continuing without citations', {
    condition,
    error: pubmedErr instanceof Error ? pubmedErr.message : String(pubmedErr),
  });
}
```

**Rationale:** PubMed enrichment is additive context, not generation-critical. A timeout or 503 from PubMed should never block question generation.

### 2.2 Block CoVe-failed questions from staging DB write

**File:** `functions/api/questions/generate-enhanced.ts` ~line 335+
**Problem:** After all retry attempts fail CoVe, the code logs a warning but continues to write the unverified question to `stagingQuestion`. Unverified questions must not enter the pipeline.

Locate the retry loop exit point and add an explicit gate before the DB write:

```typescript
// After the retry loop exits with all attempts failed:
if (!coveResult || coveResult.overallConfidence < MIN_CONFIDENCE_FOR_STAGING) {
  logger.error('[CoVe] All verification attempts failed — aborting DB write', {
    attempts: maxAttempts,
    lastConfidence: coveResult?.overallConfidence,
    condition: requestBody.condition,
    userId: auth.userId,
  });
  return new Response(
    JSON.stringify({
      error: 'Question could not be verified after maximum attempts',
      code: 'COVE_VERIFICATION_FAILED',
    }),
    { status: 422 }
  );
}

// Only proceed to stagingQuestion.create() if we reach here
const staged = await prisma.stagingQuestion.create({ ... });
```

Define `MIN_CONFIDENCE_FOR_STAGING = 0.5` (below the 0.7 `pending` threshold) to catch truly unverifiable questions while still allowing borderline-pending questions through for admin review.

### 2.3 Per-item retry with exponential backoff in batch generation

**File:** `functions/api/questions/generate-batch.ts`
**Problem:** A single Gemini timeout or 429 in `generateQuestionsWithGemini()` kills the entire batch.

The existing code processes questions sequentially with a 1200ms delay. Add a per-attempt retry wrapper:

```typescript
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1500;

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  label = 'operation'
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('429') ||
          err.message.includes('timeout') ||
          err.message.includes('503'));

      if (!isRetryable || attempt === maxRetries) {
        logger.warn(`[Batch] ${label} failed after ${attempt} attempts`, {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
      logger.info(`[Batch] ${label} retry ${attempt}/${maxRetries} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}
```

Then wrap each item in the generation loop:

```typescript
// In the per-item processing section:
const generated = await withRetry(
  () => generateSingleQuestion(apiKey, item, logger),
  MAX_RETRIES,
  `question[${i}/${total}]`
);

if (!generated) {
  results.push({ status: 'failed', index: i, reason: 'max_retries_exceeded' });
  continue;
}
results.push({ status: 'success', index: i, question: generated });
```

**Also add partial success reporting** to the response so callers know which items failed:

```typescript
return new Response(JSON.stringify({
  data: {
    succeeded: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    total: results.length,
    failures: results.filter(r => r.status === 'failed'),
  }
}), { status: 200 });
```

---

## Phase 3 — High: Adaptive Variant Strategy

**Addresses:** H4, H5
**Files:** `lib/ensureDueVariant.ts`, `lib/questionVariantGenerator.ts`

### 3.1 Replace `Math.random()` variant selection with confusion-pair driven logic

**File:** `lib/ensureDueVariant.ts` ~line 84
**Problem:** Variant type is picked randomly, ignoring available confusion pair data.

Update `ensureDueVariant` to accept the Prisma client (already passed in) and query `confusionPair` to determine the best variant strategy:

```typescript
// Add helper function before ensureDueVariant:
async function selectVariantType(
  prisma: PrismaClient,
  userId: string | undefined,
  conditionId: string
): Promise<VariantType> {
  if (!userId) return 'different_scenario'; // No user context → safe default

  try {
    // Check if user has a recorded confusion for this condition
    const confusion = await prisma.confusionPair.findFirst({
      where: {
        userId,
        OR: [
          { realCondition: conditionId },
          { confusedWithCondition: conditionId },
        ],
        count: { gt: 1 },
      },
      orderBy: { count: 'desc' },
    });

    if (confusion) return 'different_distractors'; // Target the specific confusion

    // Check consecutive incorrect attempts
    const recentAttempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        question: { conditionId },
        isCorrect: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (recentAttempts.length >= 3) return 'decomposition'; // Break it down
    if (recentAttempts.length >= 2) return 'different_scenario'; // Change context

    return 'rephrased'; // First miss → just rephrase
  } catch {
    return 'rephrased'; // Fallback on any DB error
  }
}

// Then update the variant type selection in ensureDueVariant:
// BEFORE (line 84-85):
const targetType: VariantType =
  VARIANT_TYPES[Math.floor(Math.random() * VARIANT_TYPES.length)] ?? 'rephrased';

// AFTER:
const targetType: VariantType = await selectVariantType(prisma, userId, conditionId);
```

**Important:** `ensureDueVariant` needs to accept `userId` as an optional parameter. Update the function signature:

```typescript
export async function ensureDueVariant(
  prisma: PrismaClient,
  question: PreGenQuestionForVariant,
  apiKey: string | undefined,
  log?: { ... },
  userId?: string          // NEW — for adaptive strategy selection
): Promise<void>
```

Update callers in `submit-review.ts` and `due-siblings.ts` to pass `auth.userId`.

### 3.2 Increase sibling threshold for high-confusion conditions

**File:** `lib/ensureDueVariant.ts` ~line 70
**Problem:** `siblingCount >= 1` means generation stops after a single variant, which is insufficient for frequently-missed concepts.

```typescript
// BEFORE:
if (siblingCount >= 1) {
  log?.info('Due variant: sibling already exists', { conditionId, siblingCount });
  return;
}

// AFTER:
// Dynamic threshold: high-confusion conditions need more variants
const confusionCount = userId
  ? await prisma.confusionPair.count({
      where: {
        userId,
        OR: [{ realCondition: conditionId }, { confusedWithCondition: conditionId }],
      },
    }).catch(() => 0)
  : 0;

const siblingThreshold = confusionCount > 2 ? 3 : 1;

if (siblingCount >= siblingThreshold) {
  log?.info('Due variant: sufficient siblings exist', {
    conditionId, siblingCount, siblingThreshold,
  });
  return;
}
```

---

## Phase 4 — Medium: Validation & Model Constants

**Addresses:** M4, M6, M1, L3, L4, L5

### 4.1 Add field validation in `generate-deep.ts`

**File:** `functions/api/questions/generate-deep.ts` ~line 143
**Problem:** Questions pass through without required field checks.

```typescript
// After JSON.parse, add field filtering:
const REQUIRED_FIELDS = ['question', 'options', 'correctAnswerIndex'] as const;

if (Array.isArray(parsed.questions)) {
  questions = parsed.questions
    .filter((q): q is typeof questions[number] => {
      const hasRequired = REQUIRED_FIELDS.every(
        (f) => f in q && q[f] !== null && q[f] !== undefined
      );
      if (!hasRequired) {
        logger.warn('generate-deep: filtered question missing required fields', {
          presentFields: Object.keys(q),
        });
      }
      return hasRequired && Array.isArray(q.options) && q.options.length >= 4;
    })
    .slice(0, count);
}
```

### 4.2 Fix hardcoded model in `questionVariantGenerator.ts`

**File:** `lib/questionVariantGenerator.ts` line 35
**Problem:** `'gemini-2.0-flash-exp'` is hardcoded. When constants update, this won't.

First, check whether a model constants file exists (search for `GEMINI_VARIANT_MODEL` or similar). If not, add the constant to wherever `gemini-2.5-flash` is defined (likely `lib/constants/models.ts` or `functions/api/_shared/constants.ts`):

```typescript
// In your model constants file:
export const GEMINI_GENERATION_MODEL = 'gemini-2.5-flash';
export const GEMINI_VARIANT_MODEL = 'gemini-2.0-flash';  // Fast, structured output
```

Then update `questionVariantGenerator.ts`:

```typescript
// BEFORE:
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  ...
});

// AFTER:
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GEMINI_VARIANT_MODEL } from '../constants/models'; // adjust import path

const model = genAI.getGenerativeModel({
  model: GEMINI_VARIANT_MODEL,
  ...
});
```

### 4.3 Surface grounding context failures to callers

**File:** `functions/api/_shared/question-generator.ts`
**Problem:** `fetchGroundingContext()` already has a try/catch (line 55+) but returns empty context silently — callers have no visibility that grounding failed.

The current behavior is intentional (graceful degradation) but should be communicated:

```typescript
// Update the return type of fetchGroundingContext:
async function fetchGroundingContext(
  apiKey: string,
  condition: string
): Promise<{ context: string; sources: GroundingSource[]; groundingFailed?: boolean }> {
  try {
    // ... existing logic
    return { context, sources };
  } catch (err) {
    logger?.warn('[QuestionGen] Grounding context fetch failed', {
      condition,
      error: err instanceof Error ? err.message : String(err),
    });
    return { context: '', sources: [], groundingFailed: true };
  }
}

// Then in the caller, log a note in the generated question metadata:
const groundingResult = await fetchGroundingContext(apiKey, condition);
if (groundingResult.groundingFailed) {
  generatedQuestion.metadata = {
    ...generatedQuestion.metadata,
    groundingSkipped: true,
    generatedAt: new Date().toISOString(),
  };
}
```

### 4.4 Minor fixes (L3, L4, L5)

**L4 — `question-validator.ts`:** Add a JSDoc note on `validateGeneratedQuestion` making clear callers must check the `valid` flag. Consider adding an exported `assertValidQuestion(result)` helper that throws if `!result.valid`, for use in non-graceful paths:

```typescript
export function assertValidQuestion(result: ValidationResult): void {
  if (!result.valid) {
    throw new Error(
      `Question validation failed: ${result.errors.join('; ')}`
    );
  }
}
```

**L5 — `generate-draft.ts`:** Add a basic field check after AI response parse:

```typescript
const REQUIRED_DRAFT_FIELDS = ['title', 'content'] as const; // adjust to actual schema
if (!REQUIRED_DRAFT_FIELDS.every((f) => f in parsedResponse)) {
  return new Response(JSON.stringify({ error: 'AI response missing required fields' }), {
    status: 502,
  });
}
```

**L3 — `generate-question.ts` (admin):** Low severity. No action needed immediately; add a TODO comment noting that Clerk's `auth()` caches roles and this endpoint should eventually use `auth().protect()` with a server-side role re-check on sensitive writes.

---

## Phase 5 — Medium: Dedup at Generation Time & Stats Consistency

**Addresses:** M2, M3

### 5.1 Dedup check in `ensureDueVariant`

**File:** `lib/ensureDueVariant.ts`
**Problem:** Newly generated variants aren't checked against existing questions for similarity, wasting Gemini tokens and reviewer time.

After generating the variant but before writing to DB, do a lightweight text similarity check against existing siblings:

```typescript
// After variant is generated (after line ~93):
if (variant?.question) {
  // Quick cosine-like token overlap check (no external library needed)
  const existingSiblings = await prisma.preGeneratedQuestion.findMany({
    where: { conditionId, id: { not: question.id } },
    select: { questionData: true },
    take: 10,
  });

  const newTokens = new Set(variant.question.toLowerCase().split(/\W+/).filter(t => t.length > 4));

  for (const sibling of existingSiblings) {
    const sibData = sibling.questionData as Record<string, unknown>;
    const sibText = String(sibData.question ?? sibData.vignette ?? '').toLowerCase();
    const sibTokens = sibText.split(/\W+/).filter(t => t.length > 4);

    const intersection = sibTokens.filter(t => newTokens.has(t)).length;
    const union = new Set([...newTokens, ...sibTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    if (jaccard > 0.65) { // 65% overlap → likely duplicate
      log?.warn('Due variant: generated variant too similar to existing sibling — skipping', {
        conditionId, jaccardSimilarity: jaccard,
      });
      return; // Skip writing; the existing sibling is sufficient
    }
  }
}
```

### 5.2 Stats/FSRS transaction consistency

**File:** `lib/services/drillReviewService.ts`
**Problem:** Non-transactional stats writes (QuestionAttempt, UserQuestionSeen, Question stats, PreGeneratedQuestion stats, Rolling360) can succeed even if the subsequent FSRS transaction fails, creating a stats-recorded-but-no-schedule-update gap.

A full transaction wrapping all 10 writes would be ideal but risks lock contention. The pragmatic fix is to **move the FSRS transaction earlier** and treat it as the authoritative gate, with stats writes following:

**Approach:** Restructure `drillReviewService.ts` so that:
1. The FSRS transaction (`UserProgress` + `UserTopicProgress`) runs first
2. All non-FSRS writes (`QuestionAttempt`, stats, `Rolling360`) run after in a single `$transaction([...])` call so they're atomic with each other
3. If the stats transaction fails after FSRS succeeds, log an error + alert but don't roll back FSRS (stats inconsistency is recoverable; schedule inconsistency is not)

```typescript
// Pseudocode structure:
// 1. Compute all derived values (rating, FSRS schedule, par time, etc.)
// 2. FSRS transaction (UP + UTP) — this is the source of truth
const fsrsResult = await prisma.$transaction(async (tx) => {
  // existing UserProgress + UserTopicProgress writes
});

// 3. Stats transaction (non-blocking, non-fatal)
try {
  await prisma.$transaction([
    prisma.questionAttempt.create({ ... }),
    prisma.userQuestionSeen.upsert({ ... }),
    prisma.rolling360.upsert({ ... }),
    // ... other stats
  ]);
} catch (statsErr) {
  logger.error('[DrillReview] Stats write failed after FSRS success', {
    userId, questionId,
    error: statsErr instanceof Error ? statsErr.message : String(statsErr),
  });
  // Don't throw — FSRS is committed, stats are recoverable
}
```

**Note:** This is a refactor with meaningful test coverage needed. The existing 254 tests should be run after this change. Only undertake this if a review session can be spared for re-verification.

---

## Phase 6 — Low: Dead Code, Seed Service, Pool Self-Call

**Addresses:** M5, M8, L1, L2

### 6.1 Remove dead code in `questionQualityService.ts` and `cove-verification.ts`

**File:** `services/core/questionQualityService.ts` lines 283-289; `lib/cove-verification.ts` lines ~446-453
These are commented-out AI blending blocks. Simply delete them. They add noise to already-complex files and there's no reason to keep the commented artifact — the intent can be recaptured from git history.

### 6.2 Wire `questionSeedService` to an endpoint or cron

**File:** `services/core/questionSeedService.ts`
**Problem:** 317 lines of well-implemented template permutation logic with no caller.

The minimum viable wiring is a new cron endpoint, parallel to `cron/generate-variants.ts`:

```typescript
// New file: functions/api/cron/generate-from-seeds.ts
// Called by Cloudflare cron on a low-frequency schedule (e.g., weekly)
// 1. Query QuestionSeed where usageCount < maxUsage (or a blueprint coverage gap)
// 2. For each: call assembleQuestionFromSeed() → validate → write PreGeneratedQuestion
// 3. Return stats: seeds processed, questions generated, seeds exhausted
```

This is a medium-effort feature addition. Prioritize only after Phase 1-4 are stable.

### 6.3 Replace HTTP self-call in `questionPoolService`

**File:** `services/core/questionPoolService.ts`
**Problem:** `checkAndTriggerGeneration()` calls `POST /api/questions/generate-batch` via fetch, adding latency and creating a potential loop if the endpoint is rate-limited.

This service is only used by Express routes (`routes/questions.ts`), not Edge functions. The fix is to import and call the batch generation logic directly instead of via HTTP:

```typescript
// BEFORE:
await fetch('/api/questions/generate-batch', {
  method: 'POST',
  body: JSON.stringify({ count: POOL_REFILL_COUNT, system }),
});

// AFTER: Import the core generation function directly
import { generateQuestionsWithGemini } from '../functions/api/questions/generate-batch';
// Or, if that file is Edge-only, extract the core logic into a shared lib

const questions = await generateQuestionsWithGemini(
  process.env.GEMINI_API_KEY!,
  system,
  'medium',
  POOL_REFILL_COUNT,
  logger
);
await prisma.preGeneratedQuestion.createMany({ data: questions });
```

**Note:** If `generateQuestionsWithGemini` is too tightly coupled to the Edge handler to extract easily, create a new `lib/services/batchGenerationService.ts` that holds the shared logic, imported by both the Edge function and the pool service.

---

## Execution Order Summary

| Phase | Severity | Estimated Effort | Deploy Risk | Notes |
|-------|----------|-----------------|-------------|-------|
| 1.1 | CRITICAL | 10 min | None | Verify migration already applied |
| 1.2 | CRITICAL | 30 min | Low | Defensive wrapper only |
| 1.3 | CRITICAL | 45 min | Low | Requires schema verification |
| 2.1 | HIGH | 15 min | None | Trivial try/catch |
| 2.2 | HIGH | 30 min | Low | Behavior change: 422 instead of silent staging write |
| 2.3 | HIGH | 2 hrs | Medium | Test with batch calls post-deploy |
| 3.1 | HIGH | 2 hrs | Medium | Requires caller signature updates |
| 3.2 | HIGH | 30 min | Low | Additive logic only |
| 4.1 | MEDIUM | 30 min | None | Additive filtering |
| 4.2 | MEDIUM | 20 min | None | Import swap |
| 4.3 | MEDIUM | 30 min | None | Metadata addition only |
| 4.4 | LOW | 30 min | None | JSDoc + helper |
| 5.1 | MEDIUM | 1 hr | Low | Additive dedup step |
| 5.2 | MEDIUM | 3 hrs | HIGH | Requires test re-run; do last |
| 6.1 | LOW | 15 min | None | Delete commented code |
| 6.2 | MEDIUM | 3 hrs | Medium | New cron endpoint |
| 6.3 | MEDIUM | 2 hrs | Medium | Extract shared logic |

**Start with Phase 1 + 2.1 + 2.2 in a single PR.** These are the lowest-risk, highest-impact changes with no behavioral regressions. Phase 3 (adaptive variant strategy) should be a separate PR with a flag to roll back if variant quality regresses. Phase 5.2 (FSRS transaction refactor) should be last and gated behind the 254-test suite passing.

---

## Test Coverage Gaps to Address

Before Phase 5.2:
- Unit test for `ensureDueVariant` covering: sibling-exists path, adaptive strategy selection, dedup rejection, generation failure graceful return
- Integration test for `generate-batch` retry logic (mock Gemini 429 → verify retry behavior)
- Unit test for `secondChanceEngine` Strategy 1 failure → Strategy 2 fallback

After Phase 1.3:
- Smoke test for `variantQueueService.queueVariantForReview()` end-to-end with a real `QuestionVariant` table present
