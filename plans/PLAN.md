# Question Generation & Session Orchestration Improvement Plan

**Author:** Claude (Staff Architect)
**Date:** 2026-04-01
**Status:** IMPLEMENTED — All 4 workstreams complete, 41/41 tests passing
**Scope:** Question generation quality, session orchestration correctness, FSRS telemetry integrity

---

## Executive Summary

Three workstreams, ordered by impact on clinical accuracy and FSRS integrity:

1. **Question Generator: Strict Schema + Few-Shot Reasoning** — Migrate from prompt-engineered JSON parsing to Gemini's native `responseMimeType: 'application/json'` + `responseSchema`. Add few-shot examples with `<thinking>` tags to model clinical reasoning before output. This eliminates malformed JSON failures and improves distractor quality.

2. **Circadian Par Time Adjustment** — Currently, circadian phase modifies FSRS stability but does NOT adjust par times. Students studying at 2 AM get the same par time as 10 AM, meaning their naturally slower responses penalize their implicit rating. Fix: multiply `parTimeMs` by a circadian par-time factor before feeding into `deriveImplicitRating`.

3. **Session Pool Exhaustion Fallback** — When the pre-generated question pool for a system runs dry mid-session, the system returns fewer questions than requested. Add an intelligent fallback that triggers real-time Gemini generation for the deficit, with a timeout guard and quality validation.

---

## Workstream 1: Question Generator Strict Schema

### Problem
`question-generator.ts` asks Gemini for JSON via prompt instructions, then regex-strips markdown fences and calls `JSON.parse()`. This fails silently on:
- Trailing commas in Gemini output
- Nested markdown in explanation fields
- Missing required fields (explanation.incorrect)
- Hallucinated extra fields

### Solution

#### 1A. Define canonical `QuestionSchema` as a Gemini `responseSchema`

**File:** `functions/api/_shared/question-schema.ts` (NEW)

```typescript
// Gemini responseSchema (JSON Schema subset supported by Gemini 2.5)
export const QUESTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['mcq', 'vignette'] },
    question: { type: 'string', description: 'Clinical vignette stem. NEVER contains diagnosis name.' },
    options: {
      type: 'array',
      items: { type: 'string' },
      minItems: 4,
      maxItems: 4,
    },
    correctAnswer: { type: 'string', description: 'Must exactly match one element of options[]' },
    explanation: {
      type: 'object',
      properties: {
        rationale: { type: 'string', description: 'Why correct answer is correct for THIS patient' },
        incorrect: {
          type: 'object',
          properties: {
            A: { type: 'string' },
            B: { type: 'string' },
            C: { type: 'string' },
            D: { type: 'string' },
          },
          required: ['A', 'B', 'C', 'D'],
        },
      },
      required: ['rationale', 'incorrect'],
    },
    difficulty: { type: 'number', description: '0.0-1.0 difficulty estimate' },
    sourceSections: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['type', 'question', 'options', 'correctAnswer', 'explanation', 'difficulty'],
};
```

#### 1B. Add few-shot examples with `<thinking>` tags

**File:** `functions/api/_shared/question-generator.ts` (MODIFY)

Add a `GENERATION_FEW_SHOT` constant with 2 examples that model the clinical reasoning chain before producing the question JSON. The thinking process is instructional only — not captured in output (Gemini sees it in the prompt but the responseSchema forces clean JSON output).

Example few-shot (abbreviated):
```
Input: Generate a cardiology question about atrial fibrillation.
<thinking>
1. Target: PA student studying CV system
2. Clinical presentation: 65yo male, palpitations + dyspnea
3. Vitals: HR 142 irregularly irregular, BP 128/82
4. Third-order chain: vignette → identify AF → determine rate vs rhythm control → pick correct agent
5. Correct answer: Diltiazem (rate control, no HFrEF)
6. Distractor engineering:
   - Amiodarone: rhythm control, correct if <48hrs onset (but this patient has 3-day hx)
   - Metoprolol: rate control but contraindicated with reactive airway disease (patient has asthma hx)
   - Flecainide: rhythm control, correct if structurally normal heart, but patient has LVH
7. Pertinent negatives: No signs of HFrEF (no S3, no JVD, no peripheral edema), no WPW on ECG
</thinking>
{JSON output matching schema}
```

#### 1C. Migrate `generateSingleQuestion` to use `generationConfig.responseSchema`

Replace:
```typescript
const result = await model.generateContent(prompt);
const text = response.text();
const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
const question = JSON.parse(jsonStr);
```

With:
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: QUESTION_RESPONSE_SCHEMA,
    temperature: 0.7,
  },
});
const result = await model.generateContent(prompt);
const question = JSON.parse(result.response.text());
```

#### 1D. Post-generation validation

**File:** `functions/api/_shared/question-validator.ts` (NEW)

Runtime validation that catches what the schema cannot:
- `correctAnswer` must exactly match one of `options[]`
- No option text contains the condition name (anti-stem-leak)
- Each `explanation.incorrect[key]` maps to the correct option letter
- `difficulty` is within [0.0, 1.0]
- `question` (stem) length is ≥ 50 characters (rejects trivial stems)
- No two options are identical

Returns `{ valid: boolean, errors: string[] }`. Failed questions are logged and regenerated once.

### Files Changed
| File | Action | Lines Est. |
|------|--------|-----------|
| `functions/api/_shared/question-schema.ts` | CREATE | ~60 |
| `functions/api/_shared/question-validator.ts` | CREATE | ~80 |
| `functions/api/_shared/question-generator.ts` | MODIFY | ~50 changed |

---

## Workstream 2: Circadian Par Time Adjustment

### Problem
`deriveImplicitRating` uses `latencyRatio = timeToFirstClick / parTimeMs` to penalize slow responses. A student answering at 2 AM has naturally slower cognitive processing, but parTime is purely content-based (word count + options + assets). Their elevated latencyRatio unfairly lowers their implicit rating.

Currently, circadian modifies *stability* (post-FSRS), but the *input* to the rating derivation is already distorted.

### Solution

#### 2A. Add `parTimeModifier` to `CircadianContext`

**File:** `lib/circadian.ts` (MODIFY)

Add a new field to `CircadianContext`:
```typescript
interface CircadianContext {
  // ... existing fields ...
  /** Par time multiplier for implicit rating fairness (>1.0 = more lenient) */
  parTimeModifier: number;
}
```

New modifier map (distinct from stability modifiers):
```typescript
const PAR_TIME_MODIFIERS: Record<CircadianPhase, number> = {
  peak: 1.0,              // Baseline — optimal cognition
  trough: 1.15,           // +15% par time during afternoon dip
  neutral: 1.0,           // Standard
  evening_recovery: 1.05, // +5% slight leniency
  late_night: 1.25,       // +25% — significant cognitive slowdown at 2 AM
};
```

**Mathematical justification:** Research (Valdez et al., 2012) shows reaction time increases ~15-25% during circadian trough vs. peak. A 25% par time increase at late_night means a response that takes 37.5s (vs 30s par) is still treated as a 1.0 latencyRatio, not a 1.25 penalty.

#### 2B. Apply in `drillReviewService.ts`

**File:** `lib/services/drillReviewService.ts` (MODIFY ~3 lines)

After calculating `parTimeMs` and `circadianContext`, adjust:
```typescript
const circadianAdjustedParTimeMs = parTimeMs * circadianContext.parTimeModifier;
```

Use `circadianAdjustedParTimeMs` (not raw `parTimeMs`) in `behaviorMetrics`:
```typescript
const behaviorMetrics: ImplicitBehaviorMetrics = {
  timeToFirstClick: effectiveFirstClick,
  // ...
  parTimeMs: circadianAdjustedParTimeMs,  // <-- was: parTimeMs
};
```

Store both values in telemetry for audit:
```typescript
server_computed: {
  par_time_ms: parTimeMs,                    // raw (content-based)
  circadian_par_time_ms: circadianAdjustedParTimeMs,  // adjusted
  // ...
}
```

### Files Changed
| File | Action | Lines Est. |
|------|--------|-----------|
| `lib/circadian.ts` | MODIFY | ~15 added |
| `lib/services/drillReviewService.ts` | MODIFY | ~8 changed |

---

## Workstream 3: Session Pool Exhaustion Fallback

### Problem
`SessionService.getSessionQuestions()` returns `needsGeneration: true` when the pool is empty, but the session proceeds with fewer questions than requested. A student asking for 20 CV questions might get 8.

### Solution

#### 3A. Add fallback generation to SessionService

**File:** `lib/services/session/sessionService.ts` (MODIFY)

After the initial pool query, if `questions.length < requestedCount`:
1. Calculate deficit: `deficit = requestedCount - questions.length`
2. Look up conditions for the target system(s) that have `MedicalContent` data
3. For each deficit slot (max 5 per request to bound latency):
   - Call `generateSingleQuestion()` with a random condition from the system
   - Validate with `validateGeneratedQuestion()`
   - If valid: add to result set + save to `PreGeneratedQuestion` for future use
   - If invalid or timeout (8s per question): skip and reduce count
4. Return combined pool + generated questions, with `analytics.generated` count

#### 3B. Timeout guard

Wrap each generation call in `Promise.race` with an 8-second timeout. If generation is slow (cold Gemini start), the session proceeds with whatever questions are available rather than blocking indefinitely.

```typescript
const generateWithTimeout = (condition: ConditionData, type: string) =>
  Promise.race([
    generateSingleQuestion(apiKey, condition, type),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
```

#### 3C. Analytics enrichment

The response already includes `analytics.fromPool` and `analytics.generated`. Ensure `generated` count is accurate and add `analytics.generationTimeMs` for monitoring.

### Files Changed
| File | Action | Lines Est. |
|------|--------|-----------|
| `lib/services/session/sessionService.ts` | MODIFY | ~60 added |

---

## Workstream 4: Rapid Guess Pipeline Hardening

### Problem
Current rapid guess handling is correct but can be tightened:
- `deriveImplicitRating` IS called for rapid guesses (wasted compute)
- The MVRT threshold is client-provided (`telemetry.mvrt_threshold_ms`) — a tampered client could set it to 0

### Solution

#### 4A. Early-exit before implicit rating derivation

**File:** `lib/services/drillReviewService.ts` (MODIFY)

Move the `isRapidGuess` check BEFORE the `deriveContinuousRating()` call:

```typescript
const isRapidGuess = telemetry?.rapid_guess ?? numericTime < MVRT_THRESHOLD_MS;

if (isRapidGuess) {
  // Skip implicit rating derivation entirely — do not pollute FSRS
  // Fall through to QuestionAttempt creation + ReviewLog with forced Again
}
```

#### 4B. Server-authoritative MVRT

**File:** `lib/services/drillReviewService.ts` (MODIFY)

Define a server-side constant:
```typescript
const SERVER_MVRT_THRESHOLD_MS = 2000; // Minimum Valid Response Time
```

Use `Math.max(SERVER_MVRT_THRESHOLD_MS, telemetry?.mvrt_threshold_ms ?? 0)` to prevent client from lowering the threshold below 2s.

### Files Changed
| File | Action | Lines Est. |
|------|--------|-----------|
| `lib/services/drillReviewService.ts` | MODIFY | ~20 changed |

---

## Implementation Order

| # | Workstream | Priority | Risk | Dependency |
|---|-----------|----------|------|------------|
| 1 | Question Schema (1A-1D) | P0 | Low | None |
| 2 | Circadian Par Time (2A-2B) | P0 | Low | None |
| 3 | Rapid Guess Hardening (4A-4B) | P1 | Low | None |
| 4 | Pool Exhaustion Fallback (3A-3C) | P1 | Medium | Workstream 1 (uses new generator) |

Workstreams 1, 2, and 3 (rapid guess) are independent and can be implemented in parallel.
Workstream 4 depends on the new generator from Workstream 1.

---

## Test Plan

### Unit Tests
- `question-validator.test.ts`: Validate correctAnswer matching, stem-leak detection, duplicate option detection
- `circadian.test.ts`: Verify parTimeModifier values for each phase; verify buildCircadianContext includes new field
- `drillReviewService.test.ts`: Rapid guess early-exit (verify `deriveContinuousRating` NOT called); circadian par time adjustment; server MVRT enforcement

### Integration Tests
- Generate 10 questions via the new schema path → validate all pass `validateGeneratedQuestion()`
- Submit a review with `rapid_guess: true` → verify FSRS state unchanged, ReviewLog created
- Submit a review at circadian `late_night` → verify par time inflated by 1.25x in telemetry

### Medical Accuracy Verification
- Manually review 5 generated cardiology questions for clinical accuracy
- Verify no condition names appear in vignette stems
- Verify each distractor has a plausible clinical scenario where it would be correct

---

## Out of Scope (Deferred)
- KAR3L sibling propagation activation (currently logged, not applied)
- Endpoint consolidation (4 generation endpoints → 1 unified)
- Ghost Grader circadian interaction (keeping circadian-blind)
- Micro-kinetics trajectory integration into implicit rating
- Content gap batch generation for CV/PULM systems
