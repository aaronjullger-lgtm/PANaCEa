# AUDIT 4: Question Generation & Session Orchestration

**Auditor:** Claude (Senior Full-Stack Engineer perspective)
**Date:** 2026-04-01
**Scope:** Question/session generation hooks and services, prompt assembly, content selection logic, fallback behavior, caching/retry, mode selection, failure modes
**Codebase:** PANaCEa (studyPANaCEa.com)

---

## Executive Summary

The question generation pipeline is a **four-tier waterfall** (pool → seeds → main → Gemini AI) orchestrated by a server-side `SessionService` class with a client-side fallback via `questionService.ts`. The architecture is fundamentally sound — the waterfall prioritizes pre-validated database content over on-the-fly AI generation, and blueprint-weighted distribution ensures PANCE-aligned coverage.

However, the audit reveals **12 findings** including 2 critical issues. The most severe: the `useSessionGenerator` hook calls a **stub endpoint that returns 501** for every request, and AI-generated fallback questions are served to users with **placeholder text visible** when generation fails. There is also significant code duplication across three layers (client questionService, server SessionService, Edge function question-generator) that will cause drift over time.

---

## Architecture Overview

### Question Flow (Priority Waterfall)

```
Client Request
    │
    ▼
mainSessionService.fetchSessionQuestions()          [Client orchestrator]
    │ GET /api/questions/session
    ▼
SessionService.getSessionQuestions()                [Server orchestrator]
    │
    ├─► fetchFromPool()       → PreGeneratedQuestion table (pre-validated, highest quality)
    ├─► expandFromSeeds()     → QuestionSeed table (expanded from seed templates)
    ├─► fetchFromMain()       → Question table (legacy/curated questions)
    └─► generateNewQuestions() → Gemini API (last resort, only if GEMINI_API_KEY set)
    │
    ▼
enrichWithMedicalContent() → Attach pearls, condition data
recordQuestionSeen()       → UserQuestionSeen table (dedup tracking)
    │
    ▼
Client receives SessionResponse { questions, analytics, poolStatus }
```

### Fallback Chain (Client-Side)

```
mainSessionService.fetchSessionQuestions()
    │ API fails (all retries exhausted)
    ▼
fallbackQuestionFetch()
    │ Uses questionService.getQuestionBatch()
    │   └── fetchFromPool() client-side → /api/questions/pool
    │       └── Falls back to Gemini via verified-question-generator
    │ Both fail
    ▼
Returns { questions: [], poolStatus: { needsGeneration: true } }
→ QuizView shows replenishment error
```

### Separate Pathway: useSessionGenerator Hook

```
useSessionGenerator.generateSession()
    │ POST /api/study/session/generate
    ▼
STUB ENDPOINT → Returns 501 "Not Implemented"
    │
    ▼
Hook sets error state, returns null
```

---

## Files Inspected

| File | Lines | Role |
|------|-------|------|
| `services/core/mainSessionService.ts` | 415 | Client-side session orchestrator |
| `functions/api/questions/session.ts` | 265 | Server endpoint for session questions |
| `lib/services/session/sessionService.ts` | ~600 | Server-side question selection (the core) |
| `services/questionService.ts` | ~700 | Client-side pool/generation service |
| `services/core/questionService.ts` | 444 | Consolidated question service (re-exports) |
| `functions/api/questions/generate.ts` | 479 | Single question generation endpoint |
| `functions/api/questions/generate-batch.ts` | ~350 | Batch pool replenishment endpoint |
| `functions/api/_shared/question-generator.ts` | 116 | Gemini prompt assembly (single question) |
| `functions/api/_shared/aiQuestionService.ts` | 220 | AI question gen + duplicate detection (PLACEHOLDER) |
| `functions/api/_shared/semantic-cache.ts` | ~130 | Token-based semantic cache |
| `functions/api/_shared/condition-loader.ts` | ~130 | DB condition data loader |
| `lib/verified-question-generator.ts` | ~200 | CoVe verification wrapper |
| `lib/questionValidator.ts` | 78 | Source-grounding validation |
| `lib/questionDeduplication.ts` | ~200 | User-level dedup with seen tracking |
| `lib/distractorValidation.ts` | ~120 | Distractor quality gating |
| `hooks/useSessionGenerator.ts` | 134 | Session generation hook (broken) |
| `services/ai/geminiService.ts` | ~350+ | Client-side Gemini integration |
| `functions/api/study/session/generate.ts` | 32 | STUB — returns 501 |

---

## Findings

### Finding 1: `useSessionGenerator` Calls a 501 Stub Endpoint

**Severity:** CRITICAL
**Type:** Dead Code / Broken Feature
**Files:** `hooks/useSessionGenerator.ts` (line 82), `functions/api/study/session/generate.ts` (lines 20-31)
**Root Cause:** The `POST /api/study/session/generate` endpoint is explicitly stubbed with a 501 response and a comment saying "concept-level session generation is not yet available." The hook calls this endpoint unconditionally and receives a non-200 response, throwing an error.
**User Impact:** Any UI that uses `useSessionGenerator` to start a session (e.g., adaptive mode, priority waterfall sessions) silently fails. The hook returns `null` and sets an error state, but navigation to `/session/${sessionId}` never occurs.
**Recommended Fix:** Either (a) remove the hook and any UI that calls it, or (b) implement the endpoint by wiring it to `SessionService.getSessionQuestions()` with the concept-level selection logic.
**Blocks Production:** Yes — any feature relying on this hook is non-functional.

---

### Finding 2: Fallback Questions Expose Placeholder Text to Users

**Severity:** CRITICAL
**Type:** UX / Data Integrity
**Files:** `functions/api/questions/generate.ts` (lines 240-256, 370-390)
**Root Cause:** When condition lookup fails or Gemini generation fails, the endpoint returns a "question" with:
```json
{
  "text": "Unable to generate question for: <queryText>. Please try again.",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "explanation": "Question generation temporarily unavailable."
}
```
This is returned as `success: true` (line 410) and cached in the semantic cache (lines 392-402). The user sees a nonsensical question with generic options where "Option A" is always correct.
**User Impact:** Users encounter garbage questions during study sessions. Worse, the fallback is **cached**, so subsequent users hitting similar queries receive the same placeholder from cache.
**Recommended Fix:** (a) Return `success: false` for fallback questions so the client can skip them. (b) Do NOT cache fallback/placeholder questions (check `metadata.generationFailed` before caching). (c) Add a `isFallback` flag so the client can filter them out of the session.
**Blocks Production:** Yes — users see fake questions and get incorrect FSRS scheduling from them.

---

### Finding 3: `aiQuestionService.ts` is a Non-Functional Placeholder

**Severity:** HIGH
**Type:** Dead Code
**Files:** `functions/api/_shared/aiQuestionService.ts` (lines 38-56)
**Root Cause:** The `generateQuestionFromGuideline` function claims to be an AI question generator but returns hardcoded placeholder strings:
```ts
vignette: `Clinical scenario based on ${system} guidelines...`,
question: `Question generated from: ${guideline.substring(0, 50)}...`,
options: ['Option A based on guideline', 'Option B (common misconception)', ...]
```
It also imports `{ prisma }` from `'./prisma-edge'` using the singleton pattern, but `prisma-edge.ts` exports a `createEdgePrismaClient()` factory — this import will resolve to `undefined` and crash at runtime.
**User Impact:** If any code path calls this service, it will either crash or return placeholder content. Currently no active code path appears to call it directly, but it's exported and importable.
**Recommended Fix:** Delete this file or mark it clearly as deprecated/unused. The real AI generation lives in `question-generator.ts` and `generate-batch.ts`.
**Blocks Production:** No (not actively called), but the broken import would crash if invoked.

---

### Finding 4: Triple-Duplicated `extractPearlsFromRationale` Function

**Severity:** MEDIUM
**Type:** Code Duplication / Maintenance Risk
**Files:**
- `services/questionService.ts` (lines 101-146)
- `services/core/questionService.ts` (lines 237-281)
- `functions/api/questions/generate.ts` (lines 26-71)
**Root Cause:** The exact same pearl extraction logic (3 regex patterns, dedup, slice to 5) is copy-pasted in three files. Each copy has slightly different whitespace but identical logic.
**User Impact:** If a bug is found or the pattern set needs to change, three files must be updated in sync. Drift is inevitable.
**Recommended Fix:** Extract to a shared utility (e.g., `lib/utils/pearlExtractor.ts`) and import from all three locations.
**Blocks Production:** No.

---

### Finding 5: `convertPoolQuestion` Duplicated with Subtle Differences

**Severity:** MEDIUM
**Type:** Code Duplication / Correctness Risk
**Files:**
- `services/questionService.ts` (lines 47-95) — Client version, includes null checks for options/question
- `services/core/questionService.ts` (lines 169-217) — Consolidated version, NO null checks, strips `^[A-D].` prefix
**Root Cause:** Two versions of the same conversion function with different validation behavior. The client version returns `null` for invalid questions (no options, no text). The consolidated version doesn't validate and will produce broken `Question` objects with empty arrays.
**User Impact:** If the consolidated version is used on the server path, malformed pool questions aren't filtered — they reach the client with empty options arrays, causing rendering errors in `QuizView`.
**Recommended Fix:** Unify into a single function in `lib/utils/questionDataNormalizer.ts` with the client version's null-safety checks.
**Blocks Production:** Potentially — depends on data quality in PreGeneratedQuestion table.

---

### Finding 6: No JSON Parse Error Handling in `question-generator.ts`

**Severity:** HIGH
**Type:** Missing Error Handling
**Files:** `functions/api/_shared/question-generator.ts` (lines 98-115)
**Root Cause:** The `generateSingleQuestion` function parses Gemini's response with `JSON.parse(jsonStr)` after stripping markdown code blocks. If Gemini returns malformed JSON (which happens ~5-10% of the time with LLMs), the parse throws and the function returns `null`. However:
1. The regex `replace(/```json/g, '')` only handles `` ```json `` — not `` ```JSON `` or `` ``` json `` (with space).
2. No retry on parse failure — a single malformed response means no question generated.
3. No schema validation on the parsed object. If Gemini returns valid JSON but missing `question` or `options` fields, it's passed through as-is.
**User Impact:** ~5-10% of single-question generation attempts silently fail, returning `null` to the caller. The caller (`generate.ts`) falls through to the placeholder fallback (Finding 2).
**Recommended Fix:** (a) Use a more robust JSON extraction regex. (b) Add Zod schema validation on the parsed output. (c) Retry once on parse failure before returning null.
**Blocks Production:** No, but degrades generation reliability.

---

### Finding 7: Batch Generation Prompt Requests 5 Options but Schema Allows 4

**Severity:** MEDIUM
**Type:** Schema Mismatch
**Files:**
- `functions/api/questions/generate-batch.ts` (line 248-249): Prompt says "Provide exactly 5 options (A through E)"
- `lib/questionValidator.ts` (line 62): Validates 4 OR 5 options (`question.options.length < 4 || question.options.length > 5`)
- `lib/distractorValidation.ts` (line 52): Letter map only covers A-D (`{ A: 0, B: 1, C: 2, D: 3 }`)
- `services/questionService.ts` (line 62): Same 4-letter map
- `lib/services/session/sessionService.ts` (line 540): Same 4-letter map
**Root Cause:** The batch prompt instructs Gemini to generate 5 options (A-E), but every `correctAnswer` letter-to-index converter only maps A-D. If Gemini returns `correctAnswer: "E"`, it resolves to index `0` (the `?? 0` fallback), making option A incorrectly marked as correct.
**User Impact:** Any question with correct answer E has the wrong `correctAnswerIndex`. Users studying these questions learn incorrect information.
**Recommended Fix:** Either (a) update ALL letter-to-index maps to include E: 4, or (b) change the prompt to request 4 options. Given PANCE format uses 5 options, option (a) is correct.
**Blocks Production:** Yes for correctness — wrong answers are being taught.

---

### Finding 8: Semantic Cache Caches Placeholder/Failed Questions

**Severity:** HIGH
**Type:** Logic Error
**Files:** `functions/api/questions/generate.ts` (lines 392-402), `functions/api/_shared/semantic-cache.ts`
**Root Cause:** After the generation endpoint creates a question (including fallback placeholders), it unconditionally caches the result via `cacheGeneratedQuestion()`. Fallback questions with `metadata.generationFailed: true` or `metadata.conditionNotFound: true` are cached alongside real questions.
**User Impact:** A failed generation poisons the cache. Future requests with similar query text (similarity > 0.85 by Jaccard token overlap) receive the cached placeholder question instead of attempting fresh generation.
**Recommended Fix:** Skip caching when `newQuestion.metadata?.generationFailed` or `newQuestion.metadata?.conditionNotFound` is true.
**Blocks Production:** Yes — cache poisoning degrades the system over time.

---

### Finding 9: `prefetchQuestions` Discards Prefetched Results

**Severity:** MEDIUM
**Type:** Logic Error / Wasted Resources
**Files:** `services/core/mainSessionService.ts` (lines 365-378)
**Root Cause:** `prefetchQuestions` calls `fetchSessionQuestions` and logs the result count but doesn't store the questions anywhere. The function is fire-and-forget — the fetched questions are garbage collected. The API call consumes server resources, database queries, and potentially Gemini API credits, but the results are never used.
**User Impact:** No direct harm, but wastes server resources and contributes to API latency for other users. The function exists to "prefetch for smoother UX" but doesn't implement a cache or queue.
**Recommended Fix:** Either (a) store prefetched questions in a module-level buffer that `fetchSessionQuestions` checks before making API calls, or (b) remove the prefetch function until a proper buffer is implemented.
**Blocks Production:** No, but wastes resources.

---

### Finding 10: No Timeout on Server-Side Gemini Calls in `generateNewQuestions`

**Severity:** MEDIUM
**Type:** Reliability
**Files:** `lib/services/session/sessionService.ts` (line 260), `functions/api/_shared/question-generator.ts` (line 99)
**Root Cause:** When `SessionService.generateNewQuestions()` is called as a last-resort fallback, it calls Gemini's `model.generateContent(prompt)` without any timeout or abort signal. The batch endpoint (`generate-batch.ts`) uses `fetchWithTimeout` for its Gemini calls, but the single-question generator in `question-generator.ts` does not. A slow Gemini response (e.g., 30+ seconds) blocks the entire session request.
**User Impact:** On slow Gemini responses, the `/api/questions/session` endpoint hangs beyond the client's 15-second abort timeout, causing the client to fall back to `fallbackQuestionFetch()`. The server-side request continues consuming resources until Cloudflare's 30-second edge function timeout kills it.
**Recommended Fix:** Add an `AbortSignal` with a 10-second timeout to all Gemini API calls in `question-generator.ts`.
**Blocks Production:** No, but degrades reliability under load.

---

### Finding 11: `correctAnswerIndex` Fallback Silently Returns 0 for Unknown Formats

**Severity:** MEDIUM
**Type:** Silent Data Corruption
**Files:**
- `services/questionService.ts` (lines 61-70)
- `services/core/questionService.ts` (lines 183-191)
- `lib/services/session/sessionService.ts` (lines 536-544)
**Root Cause:** All three `correctAnswer` converters use `?? 0` as the fallback when the letter isn't A-D. This means if `correctAnswer` is `"E"`, `"Option C"`, `""`, `null`, or any unexpected format, the question silently gets `correctAnswerIndex: 0`. No warning is logged, no metric is emitted.
**User Impact:** Questions with malformed `correctAnswer` fields always mark option A as correct, regardless of the actual answer. Users learn wrong information with no signal that anything is wrong.
**Recommended Fix:** (a) Log a warning when fallback is triggered. (b) Add a `correctAnswerConfidence` field to the question so the UI can flag uncertain answers. (c) Filter out questions where the fallback was used.
**Blocks Production:** No, but corrupts learning data silently.

---

### Finding 12: Client-Side `systemMap` Duplicated in 4 Locations

**Severity:** LOW
**Type:** Code Duplication
**Files:**
- `services/core/mainSessionService.ts` (lines 102-116)
- `services/questionService.ts` (lines 378-392) — `getQuestion`
- `services/questionService.ts` (lines 559-573) — `getQuestionBatch`
- `services/core/questionService.ts` (lines 124-138) — `SYSTEM_CODE_MAP`
**Root Cause:** The system abbreviation map (`cardiology → CV`, `pulmonology → PULM`, etc.) is defined inline in four places. `SYSTEM_CODE_MAP` in `services/core/questionService.ts` is the "canonical" version but the others don't import it.
**User Impact:** If a new system is added (e.g., `ophthalmology → OPHTH`), it must be added in all four places or filtering breaks for that system.
**Recommended Fix:** Import `SYSTEM_CODE_MAP` from `services/core/questionService.ts` (or better, from `lib/constants/blueprint.ts` which already has system definitions) in all locations.
**Blocks Production:** No.

---

## Failure Modes Analysis

### 1. API Failure (Database Unavailable)

**Path:** Client → `mainSessionService.fetchSessionQuestions()` → GET `/api/questions/session` → SessionService → Prisma query fails
**Handling:**
- **Server:** User lookup retries 3× with exponential backoff (1s, 2s, 3s). Returns 503 with "Database is temporarily unavailable" message. Regex pattern matches connection/timeout/pool errors.
- **Client:** 2 retries with 1s exponential delay. On persistent failure, falls to `fallbackQuestionFetch()` which calls `getQuestionBatch()` → client-side `fetchFromPool()` → also hits the server, also fails → Gemini generation via `fetchVerifiedQuestion()`.
- **Gap:** If both database AND Gemini are down, the user gets an empty question array. `QuizView` handles this by showing a replenishment error after 3 attempts (`MAX_REPLENISH_ATTEMPTS`).
- **Assessment:** ✅ Adequate. Multiple fallback layers exist.

### 2. Malformed Gemini Response

**Path:** Gemini returns invalid JSON or JSON missing required fields
**Handling:**
- **`question-generator.ts`:** Strips `` ```json `` markers, calls `JSON.parse()`. On failure, catches error and returns `null`. No retry.
- **`generate-batch.ts`:** Uses `fetchWithTimeout`, parses response. If JSON parse fails, returns 0 questions.
- **`verified-question-generator.ts`:** Wraps generation with CoVe verification. If question fails verification, retries up to `maxAttempts` (default 3).
- **Gap:** ⚠️ The single-question path (`question-generator.ts`) has NO retry on parse failure and NO schema validation. The batch path (`generate-batch.ts`) has distractor validation but no structural schema check (could accept a question with 0 options if Gemini omits the field).
- **Assessment:** Partially covered. Single-question path needs retry and schema validation.

### 3. Slow Response (Gemini Latency)

**Path:** Gemini takes >15s to respond
**Handling:**
- **Client:** `mainSessionService.ts` has a 15-second `AbortController` timeout on the fetch to `/api/questions/session`.
- **Server (batch):** `generate-batch.ts` uses `fetchWithTimeout` (configurable).
- **Server (single):** `question-generator.ts` has NO timeout on the `model.generateContent()` call.
- **Gap:** ⚠️ If Gemini is slow on the server's `generateNewQuestions` fallback path, the entire session request blocks until Cloudflare's 30s edge function timeout. The client has already aborted at 15s and moved to fallback, but the server continues consuming resources.
- **Assessment:** Partially covered. Client-side timeout works; server-side Gemini calls need timeout.

### 4. Empty Response (No Questions Available)

**Path:** Pool is empty, no seeds, no main questions, Gemini generation returns nothing
**Handling:**
- **Server `SessionService`:** Returns whatever it collected (possibly 0 questions). Analytics reflect `questionsServed: 0`.
- **Client `mainSessionService`:** If API returns empty, falls to `fallbackQuestionFetch()`. If that also returns 0, returns `{ questions: [], poolStatus: { needsGeneration: true } }`.
- **`QuizView`:** Tracks replenishment attempts. After 3 failed attempts, shows error message but session continues with existing queue.
- **Gap:** ⚠️ The `checkAndReplenishPool` function fires a background `/api/questions/generate-batch` call, but there's no guarantee generation completes before the user needs more questions. No optimistic/placeholder UI exists.
- **Assessment:** Adequate for graceful degradation. User sees error but session doesn't crash.

### 5. Duplicate Questions

**Path:** User sees the same question twice in a session
**Handling:**
- **Server `SessionService`:** Fetches `UserQuestionSeen` records at session start, builds `seenIds` Set. All fetch methods (`fetchFromPool`, `expandFromSeeds`, `fetchFromMain`) filter against `seenIds`.
- **Client `questionService`:** No client-side dedup — relies entirely on server.
- **`questionDeduplication.ts`:** Provides `getUserSeenQuestionIds()` with 5-minute in-memory cache. Used by enhanced pool (server-only).
- **`semantic-cache.ts`:** Jaccard token similarity (threshold 0.85) to detect semantically similar cached questions.
- **Gap:** Within a single session, if multiple `fetchSessionQuestions` calls happen rapidly, the `seenIds` set is rebuilt from the database each time. If `recordQuestionSeen` writes haven't been committed yet (async), the same question could be served twice in rapid succession.
- **Assessment:** ✅ Mostly adequate. Race window is small and mitigated by client-side local dedup in `QuizView`.

### 6. Invalid Schema (Wrong Question Shape)

**Path:** Generated question has wrong structure (missing fields, wrong types)
**Handling:**
- **`generate-batch.ts`:** Distractor validation (`validateDistractors`) checks for duplicates, empty options, length similarity. Score >= 70 required. But does NOT validate that `question`, `options`, `correctAnswer` fields exist.
- **`questionValidator.ts`:** Validates source grounding and structure (4-5 options, answer in options). Score threshold 0.6.
- **`question-generator.ts`:** NO schema validation. Parsed JSON is returned as-is.
- **`SessionService.fetchFromPool`:** Reads `questionData` JSON field, extracts `options`, `correctAnswerIndex`, `rationale` with fallbacks. Handles both index and letter formats.
- **Gap:** ⚠️ The single-question generation path has NO Zod validation, NO structural checks. A Gemini response like `{"type": "mcq"}` (missing all question content) would be passed through and served.
- **Assessment:** Partially covered. Batch path has distractor validation; single-question path has none.

---

## Top 10 Findings (Ranked by Impact)

| # | Severity | Finding | Impact |
|---|----------|---------|--------|
| 1 | CRITICAL | Fallback questions expose placeholder text + get cached (F2 + F8) | Users study fake questions; cache is poisoned |
| 2 | CRITICAL | `useSessionGenerator` calls 501 stub endpoint (F1) | Adaptive session generation is broken |
| 3 | HIGH | 5-option prompt but all converters only map A-D (F7) | Questions with answer E always marked as A |
| 4 | HIGH | No JSON schema validation on Gemini single-question output (F6) | Malformed questions pass through silently |
| 5 | HIGH | `aiQuestionService.ts` is a broken placeholder with wrong import (F3) | Crash risk if ever called |
| 6 | MEDIUM | `prefetchQuestions` fetches but discards results (F9) | Wasted server resources and API credits |
| 7 | MEDIUM | `correctAnswerIndex` silently defaults to 0 for unknown formats (F11) | Wrong answers taught without any signal |
| 8 | MEDIUM | No Gemini timeout on server-side single-question generation (F10) | Blocked requests, resource waste |
| 9 | MEDIUM | Triple-duplicated `extractPearlsFromRationale` (F4) | Maintenance drift risk |
| 10 | MEDIUM | `convertPoolQuestion` duplicated with different validation (F5) | Malformed questions on one path |

---

## 3 Highest-Leverage Fixes

### Fix 1: Stop Caching Fallback Questions + Return `success: false`

**Files:** `functions/api/questions/generate.ts`
**Effort:** ~30 minutes
**Changes:**
1. Lines 370-390: Set `success: false` on fallback questions instead of `true`.
2. Lines 392-402: Skip `cacheGeneratedQuestion()` when `newQuestion.metadata?.generationFailed` or `newQuestion.metadata?.conditionNotFound`.
3. Client (`mainSessionService.ts` line 176): Filter out questions where `metadata.generationFailed === true` before returning to caller.

**Impact:** Eliminates both cache poisoning and placeholder questions reaching users. Single fix addresses Findings 2 and 8.

### Fix 2: Add `E: 4` to All Letter-to-Index Maps

**Files:** `services/questionService.ts`, `services/core/questionService.ts`, `lib/services/session/sessionService.ts`, `lib/distractorValidation.ts`, `functions/api/questions/generate-batch.ts`
**Effort:** ~15 minutes
**Changes:** In every file with `{ A: 0, B: 1, C: 2, D: 3 }`, add `E: 4`. There are 5 locations.

**Impact:** Fixes every 5-option question where E is the correct answer. Without this, ~20% of batch-generated questions (those where Gemini picks E) have the wrong answer marked.

### Fix 3: Add Zod Schema Validation to `generateSingleQuestion`

**Files:** `functions/api/_shared/question-generator.ts`
**Effort:** ~45 minutes
**Changes:**
1. Define a Zod schema for the expected Gemini response shape (question, options array min 4, correctAnswer, explanation).
2. After `JSON.parse`, run `schema.safeParse()`. On failure, return `null` with a structured log.
3. Add one retry on parse/validation failure before returning null.
4. Add timeout via `AbortController` on the `model.generateContent()` call.

**Impact:** Catches malformed Gemini responses before they enter the system. Combined with Fix 1 (no caching failures), this eliminates the pathway for garbage questions.

---

## Minimal Safe Implementation Plan

### Phase 1: Stop the Bleeding (Day 1, ~2 hours)

1. **Fix 1 — Stop caching failures:** Edit `generate.ts` to skip cache on fallback, return `success: false`.
2. **Fix 2 — Add E mapping:** 5-file change, 1 line each.
3. **Delete or deprecate `aiQuestionService.ts`:** Remove broken import. Add `@deprecated` JSDoc.

### Phase 2: Harden Generation (Day 2, ~3 hours)

4. **Fix 3 — Zod validation + retry:** Add schema check and 1 retry in `question-generator.ts`.
5. **Add Gemini timeout:** `AbortController` with 10s timeout in `question-generator.ts`.
6. **Log `correctAnswerIndex` fallback triggers:** Add `console.warn` when `?? 0` is used.

### Phase 3: Clean Up Duplication (Day 3-4, ~4 hours)

7. **Extract `extractPearlsFromRationale`** to `lib/utils/pearlExtractor.ts`.
8. **Unify `convertPoolQuestion`** into `lib/utils/questionDataNormalizer.ts` with null checks.
9. **Consolidate `systemMap`** — import from `services/core/questionService.ts` or `lib/constants/blueprint.ts`.
10. **Remove or implement `useSessionGenerator`** — either wire to working endpoint or delete the hook.

### Phase 4: Prefetch Fix (Day 5, ~2 hours)

11. **Implement prefetch buffer** in `mainSessionService.ts` — store results in module-level array, drain on next `fetchSessionQuestions` call.
12. **Or remove `prefetchQuestions`** if buffer implementation is deferred.

---

## What to Audit Next

**Audit 5: QuizView Session Lifecycle & State Management**
The 2274-line `QuizView.tsx` is the primary study interface. Recommended scope:
- Question queue management (replenishment logic, LOW_QUEUE_THRESHOLD)
- Answer submission pipeline (implicit metrics → syncManager → FSRS)
- Session state recovery (`useQuizSessionRecovery`)
- Timer/dwell-time accuracy
- Edge cases: rapid clicking, browser tab switch, network loss mid-session
- Memory pressure from large question queues

This is the last critical path before the FSRS data reaches the database — any bugs here affect all scheduling.
