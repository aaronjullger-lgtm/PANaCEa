# Audit 10 — Frontend Data Contracts & API Response Handling

**Date:** 2026-04-01
**Scope:** Frontend consumption of API responses, type safety across the fetch boundary, null/undefined handling, offline sync correctness, and alignment between declared TypeScript interfaces and actual server payloads.
**Methodology:** Traced every major API call from frontend hook/service → HTTP request → backend handler → `toResponse` serialization → frontend parse → component render. Cross-referenced `types/api.ts` declarations against actual endpoint return shapes.

---

## Executive Summary

PANaCEa has a sophisticated frontend with safe-fetch wrappers, defensive `useSafeData` utilities, and a well-designed offline retry queue. However, the **response envelope is inconsistent** — some endpoints use `jsonSuccess()` (wrapping in `{ success, data, timestamp }`), others return plain `{ data }` objects through `toResponse()`, and a few return raw `Response` objects. The frontend compensates with `data?.data ?? data` fallback patterns everywhere, but this creates a fragile contract that silently degrades when the wrong wrapper is used. Additionally, several frontend TypeScript interfaces declare fields the backend never sends, and the `AttemptResponse` client type omits fields the server actually returns.

**15 findings:** 1 Critical, 5 High, 6 Medium, 3 Low

---

## Section 1: Response Envelope & Serialization

### Finding 10-1: Dual Response Envelope — No Single Contract (HIGH)

**Files:**
- `functions/api/_shared/response.ts` — `jsonSuccess()` returns `{ success: true, data: T, timestamp }`
- `functions/api/_shared/middleware.ts:144-148` — `toResponse()` serializes `result.data ?? result` (no `success` or `timestamp` wrapper)
- `functions/api/drills/submit-review.ts:216-222` — Returns `{ data: { ...result, isRapidGuess, nextReview } }` (uses middleware path)
- `functions/api/content/[conditionId].ts:77-79` — Returns `{ data: content, headers }` (uses middleware path)

**Root Cause:** Two independent response helpers exist. `jsonSuccess()` in `response.ts` creates a `{ success, data, timestamp }` envelope. `toResponse()` in `middleware.ts` strips the outer object and serializes `result.data` directly. Endpoints using `authenticatedEndpoint`/`publicEndpoint` go through `toResponse()`, which means the `success` and `timestamp` fields from `jsonSuccess()` are only present when handlers explicitly return a `Response` object (not a plain `{ data }` object).

**User Impact:** Frontend code must handle both shapes. The `data?.data ?? data` pattern found in `useSemanticSearch`, `useFSRSOptimizationCheck`, `usePatientVitals`, and `syncManager` compensates for this, but any hook that doesn't use this pattern breaks silently when an endpoint switches between the two helpers.

**Production Blocking:** No — defensive patterns compensate, but this is a maintenance hazard.

---

### Finding 10-2: `toResponse` Fallback Leaks Internal Shape (MEDIUM)

**File:** `functions/api/_shared/middleware.ts:148`
```typescript
body = result.error != null
  ? JSON.stringify({ error: result.error })
  : JSON.stringify(result.data ?? result);
```

**Root Cause:** When a handler returns `{ data: payload }`, the client receives `payload`. When a handler returns `{ status: 404, error: 'Not found' }`, the client receives `{ error: 'Not found' }`. But when a handler returns `{ status: 200, someField: 'x' }` (no `.data` key), the fallback `?? result` serializes the **entire handler return** including `status` as a data field. This leaks internal control-flow fields into the API response.

**Example:** `functions/api/questions/attempt.ts:106` returns `{ data: { error: 'User not found', message: '...' }, status: 404 }` — here `status` is correctly stripped. But any handler that forgets to nest under `.data` leaks `status` to the client.

**Severity:** MEDIUM — Not observed in current code paths, but any new handler written without `.data` nesting will silently break the contract.

---

### Finding 10-3: `useDrillFSRS` Unsafe Type Cast Skips Runtime Validation (MEDIUM)

**File:** `hooks/useDrillFSRS.ts:251`
```typescript
const result = (await response.json()) as DrillFSRSResponse;
```

**Server returns (via toResponse):** The `submit-review.ts` handler returns `{ data: { ...result, isRapidGuess, nextReview } }`. `toResponse` serializes `result.data`, so the client receives the inner object directly. The `drillReviewService` result (line 836-856) includes `success: true, isCorrect, quality, parTimeMs, implicitMetrics, circadian, fsrsSchedule`. The spread adds `isRapidGuess` and `nextReview`.

**Current alignment:** All fields in `DrillFSRSResponse` are present in the server response — the type matches today. `success: true` is included because `drillReviewService` explicitly returns it.

**Problem:** The cast `as DrillFSRSResponse` performs no runtime validation. If `drillReviewService` changes its return shape (e.g., renames `quality` to `grade`, removes `circadian`), the frontend silently receives different fields with no error. There is also no handling for the case where `toResponse` wraps the result differently (e.g., if the endpoint migrates to `jsonSuccess()`, adding a `{ success, data, timestamp }` envelope that would push the real data one level deeper).

**User Impact:** Low today; high maintenance risk. Any refactor to the service layer or response helpers silently breaks the frontend contract.

**Production Blocking:** No — types match today, but fragile.

---

## Section 2: Type Definition Mismatches

### Finding 10-4: `AttemptResponse` Client Type Omits Server Fields (HIGH)

**Files:**
- `services/core/attemptService.ts:22-34` — Client `AttemptResponse` type
- `functions/api/questions/attempt.ts:453-461` — Actual server response

**Client declares:**
```typescript
interface AttemptResponse {
  success: boolean;
  attemptId?: string;
  systemStats?: { system, totalAttempts, correctAttempts, accuracy, recentTrend };
  error?: string;
}
```

**Server actually returns:**
```typescript
{
  success: true,
  attemptId: string,
  stats: { totalQuestionsAnswered, correctAnswers, overallAccuracy },  // MISSING from client type
  systemStats: { system, totalAttempts, correctAttempts, accuracy, recentTrend },
  nextReviewDate?: string  // MISSING from client type
}
```

**Missing fields:**
1. `stats` — global accuracy aggregate (the O(N) query from Audit 8) — never consumed by the client type
2. `nextReviewDate` — FSRS next review ISO string — never consumed

**Also:** Server `systemStats` uses `correctAttempts` (line 505), but the client type says `correctAttempts` too — this one matches. However, `getUserStats()` (line 228) returns `result.stats` which accesses the field correctly.

**User Impact:** FSRS next review date from the attempt path is computed server-side but discarded client-side. The `stats` aggregate (which costs O(N) per request) is also never displayed.

---

### Finding 10-5: `QuestionResponse` Type Does Not Match Any Endpoint (HIGH)

**Files:**
- `types/api.ts:96-107` — `QuestionResponse` interface
- `types/question-bank.ts:1-30` — `QuestionDTO` interface
- `functions/api/drills/submit-review.ts` — No question-fetch endpoint, only review submission
- `hooks/game/use-condition-drill.ts` — Uses `QuestionDTO`, maps to internal `ConditionQuestion`

**`QuestionResponse` declares:**
```typescript
interface QuestionResponse {
  question: string;
  options: string[];
  correctAnswerIndex: number;  // Integer index
  rationale: string;
  topic: string;
  system?: string;
  conditionId: string;
  condition: string;
  pearls: string[];
}
```

**`QuestionDTO` declares:**
```typescript
interface QuestionDTO {
  id: string;
  vignette: string;
  question: string;
  options: string[];
  correctAnswer: string;  // String answer text, NOT index
  explanation: string;     // NOT "rationale"
  system: string;
  difficulty: string;
  // ...
}
```

**Problem:** Two competing type definitions exist. `QuestionResponse` uses `correctAnswerIndex` (number) and `rationale`. `QuestionDTO` uses `correctAnswer` (string) and `explanation`. The drill hooks use `QuestionDTO` and manually compute the index: `dto.options.indexOf(dto.correctAnswer)`. The `QuestionResponse` type appears unused in actual API consumption.

**User Impact:** Dead type creates confusion. New contributors may use `QuestionResponse` expecting an index-based answer and get undefined behavior.

---

### Finding 10-6: `SRSItem` Hook Type Missing `data` Envelope Unwrap (MEDIUM)

**File:** `hooks/useSRSItems.ts:55-65`
```typescript
const data = (await response.json()) as {
  items?: Array<{ dueDate: string; [k: string]: unknown }>;
  totalDue?: number;
};
```

**Server (`functions/api/srs/due.ts`) returns through `toResponse`:** `{ data: { items, totalDue, timestamp } }` → serialized as `{ items, totalDue, timestamp }` (inner data).

**The hook correctly accesses `data.items` and `data.totalDue`** — this works because `toResponse` unwraps `.data`. However, the cast uses an inline anonymous type rather than a shared interface, and there's no runtime validation. If the endpoint ever switches to `jsonSuccess()`, the shape becomes `{ success, data: { items, totalDue }, timestamp }` and `data.items` becomes `undefined`.

---

## Section 3: Null/Undefined Handling

### Finding 10-7: Retrievability Computed on Stale/Missing UserProgress Data (HIGH)

**Files:**
- `components/library/ClinicalReferenceLibrary.tsx:398-407` — Computes `retrievabilityMap`
- `functions/api/user/progress-map.ts` — Returns `{ stability, lastReviewAt }` per condition
- From Audit 9: `UserProgress.conditionId` FK mismatch causes silent write failures

**Chain of failure:**
1. Drill submission → `drillReviewService` → `updateUserProgressWithHistory(conditionId)` where `conditionId` is `Condition.id`
2. `UserProgress.conditionId` FK references `MedicalContent.id` (random UUID) → P2003 FK violation
3. `userProgressService.ts:149-162` catches P2003 silently → **UserProgress row never created**
4. `progress-map.ts` queries `UserProgress` → returns empty map for that condition
5. `ClinicalReferenceLibrary` computes `retrievabilityMap[conditionId] = null`
6. `RetrievabilityBadge` shows gray "No data" instead of actual study progress

**User Impact:** Students who have studied a condition see "No data" on the library card instead of their actual retrievability. This undermines trust in the spaced repetition system — the core product feature.

**Production Blocking:** Yes — this is the downstream effect of the Audit 9 FK mismatch. Fixing the FK (Audit 9, Finding 9-1) automatically fixes this.

---

### Finding 10-8: `fsrsNextReview` Defaults to Zero Instead of Null (MEDIUM)

**File:** `hooks/useDrillFSRS.ts:306-313`
```typescript
const fsrsNextReview: FSRSNextReview | null = lastFSRSResponse?.nextReview
  ? {
      intervalDays: lastFSRSResponse.nextReview.intervalDays ?? 0,
      nextDueDate: lastFSRSResponse.nextReview.nextDueDate ?? new Date().toISOString(),
      stability: lastFSRSResponse.nextReview.stability ?? 0,
      difficulty: lastFSRSResponse.nextReview.difficulty ?? 0,
    }
  : null;
```

**Problem:** When the server returns `nextReview` but with a missing field (e.g., `stability: undefined` due to a `drillReviewService` edge case), the hook defaults to `0`. A stability of `0` in FSRS means "completely forgotten" — this would make the `RetrievabilityBadge` show critically low retention even though the real issue is a missing value, not low stability.

**Better pattern:** Default to `null` and let the UI show "No data" instead of misleading zero values.

---

### Finding 10-9: `contentService.ts` Treats API Response as Key-Value Map (HIGH)

**File:** `lib/api/contentService.ts:89-123`
```typescript
function transformToMedicalContent(data: Record<string, unknown>): MedicalContent[] {
  for (const [conditionId, raw] of Object.entries(data)) { ... }
}
```

**Server (`/api/content/all`) returns through `toResponse`:** A Prisma `findMany` result — an **array** of `MedicalContent` objects, not a key-value map.

**Problem:** `Object.entries()` on an array yields `['0', firstItem], ['1', secondItem], ...` — the `conditionId` variable becomes the array index string `"0"`, `"1"`, etc. Line 96: `id: conditionId` sets every item's ID to its array position. Line 98: `condition: condition.name || conditionId` falls back to `"0"` as the condition name.

**User Impact:** If `loadAllContent()` is called in the browser path, all medical content items get numeric string IDs and lose their actual condition identifiers. The `getContentById()` and `searchContent()` functions become useless. This function appears to be designed for a different API response shape (a registry object) than what the server actually returns.

**Production Blocking:** Yes — the browser-path content loading returns corrupted data.

---

## Section 4: Offline Sync & Retry

### Finding 10-10: Retry Queue Sends `wasCorrect` But Server Expects `body.wasCorrect` (MEDIUM)

**Files:**
- `services/core/attemptService.ts:153-157` — Sends `data` directly as JSON body
- `functions/api/questions/attempt.ts:68-90` — Schema expects `body: { questionId, wasCorrect, ... }`

**The `AttemptSchema` uses a nested `body` key:**
```typescript
const AttemptSchema = z.object({
  body: z.object({
    questionId: z.string().min(1),
    wasCorrect: z.boolean().optional(),
    // ...
  }),
});
```

**The middleware `withValidation` with source `'body'`** extracts the request body and places it under `validated.body`. The handler accesses `validated.body.questionId`.

**The `attemptService.ts` sends:**
```typescript
body: JSON.stringify(data)  // { questionId, wasCorrect, system, ... }
```

**This works** because the middleware's validation parses the POST body and maps it to `validated.body` automatically. The `z.object({ body: ... })` wrapper is the middleware's convention, not what the client sends. However, this is confusing and undocumented — a developer reading the schema would think the client must send `{ body: { questionId, ... } }`.

**Severity:** MEDIUM — Works correctly but the schema-as-documentation is misleading.

---

### Finding 10-11: `syncManager` Queues Answers Without `sessionType` (MEDIUM)

**Files:**
- `lib/services/sync/syncManager.ts` — `queueAnswer()` stores `OfflineAnswer` with no `sessionType` field
- `functions/api/questions/attempt.ts:87` — `isMainSession` defaults to `false`
- `functions/api/drills/submit-review.ts:81` — `sessionType` defaults to omitted (treated as `'main'`)

**Problem:** When `syncManager.queueAnswer()` is called from `QuizView.tsx` (the main study session), the queued answer doesn't include `isMainSession: true` or `sessionType: 'main'`. When the queue is replayed after coming back online, the server treats these as non-main-session attempts, which means:
1. Rolling 360 stats are NOT updated (line 433: `if (isMainSession && ...)`)
2. The attempt is recorded but doesn't contribute to the main session performance aggregate

**User Impact:** Students who study offline in main sessions lose their Rolling 360 stats for those questions when the queue syncs. Their dashboard shows lower study volume than actual.

---

### Finding 10-12: `sendAttemptToServer` Returns `null` on HTTP Error, Hides Status (LOW)

**File:** `services/core/attemptService.ts:159-163`
```typescript
if (!response.ok) {
  return null;
}
return await response.json();
```

**Problem:** On any non-2xx response (401, 403, 404, 429, 500), the function returns `null` and the caller queues the attempt for retry. But a 401 should trigger re-authentication, a 429 should back off, and a 404 means the data is wrong (retrying won't help). Treating all failures identically means:
- 401s get retried 3 times then dropped (lost data)
- 404s get retried 3 times then dropped (wasted requests)
- 429s get retried immediately without backoff (makes rate limiting worse)

---

## Section 5: Component Contract Assumptions

### Finding 10-13: Condition Drill DTO Mapper Uses Unsafe Index Lookup (LOW)

**File:** `hooks/game/use-condition-drill.ts:96-115`
```typescript
function mapDtoToConditionQuestion(dto: QuestionDTO): ConditionQuestion {
  const correctIndex = dto.options.indexOf(dto.correctAnswer);
  return {
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    // ...
  };
}
```

**Problem:** When `correctAnswer` doesn't match any option string exactly (case mismatch, trailing whitespace, HTML entities), `indexOf` returns `-1` and the fallback sets `correctAnswerIndex: 0` — meaning option A is always "correct" for malformed questions. This silently marks the wrong answer as right.

**Better pattern:** Normalize both `correctAnswer` and `options` before comparison, and log a warning when fallback fires.

---

### Finding 10-14: `getUserStats` Accesses `result.stats` Without Envelope Check (LOW)

**File:** `services/core/attemptService.ts:228`
```typescript
const result = await response.json();
return result.stats;
```

**The server returns (through toResponse):** `{ success: true, attemptId, stats: { ... }, systemStats: { ... } }` — but this is the attempt *creation* response. The `getUserStats()` function calls a different endpoint (`/api/user/stats`) whose response shape is unknown and may not have a `.stats` key.

**Problem:** No type assertion, no shape validation. If `/api/user/stats` returns `{ data: { stats: ... } }` via `jsonSuccess()`, the correct access would be `result.data.stats`, not `result.stats`.

---

### Finding 10-15: `loadAllContent` Fetches Without Auth Token (CRITICAL)

**File:** `lib/api/contentService.ts:20-24`
```typescript
const response = await fetch(apiUrl);  // No Authorization header

if (response.ok) {
  const data = (await response.json()) as Record<string, unknown>;
  return transformToMedicalContent(data);
}
```

**Combined with Finding 10-9**, this creates a two-part failure:
1. The fetch has no auth token — works only because `/api/content/all` is a `publicEndpoint`
2. The response (an array) is cast as `Record<string, unknown>` and iterated with `Object.entries()`, corrupting all IDs

**Additionally:** There's no error handling for non-ok responses — the function silently returns `[]`, so the CMS admin panel shows no content with no error message.

**Server-side path (lines 27-61)** works correctly because it maps Prisma records directly. The bug is browser-only.

**User Impact:** Any browser-side call to `loadAllContent()` returns garbage data. If the CMS or any admin panel uses this function, content management is broken.

**Production Blocking:** Yes — browser-path content loading returns corrupted items.

---

## Top 10 Findings (Ranked by Impact)

| Rank | ID | Severity | Finding | Blocks Prod? |
|------|----|----------|---------|--------------|
| 1 | 10-7 | HIGH | Retrievability shows "No data" due to upstream FK mismatch (Audit 9 cascade) | Yes (UX) |
| 2 | 10-3 | MEDIUM | `useDrillFSRS` unsafe type cast — no runtime validation of server response | No |
| 3 | 10-15 | CRITICAL | `loadAllContent` browser path corrupts all content IDs via wrong type cast | Yes |
| 4 | 10-9 | HIGH | `transformToMedicalContent` treats array as key-value map | Yes |
| 5 | 10-4 | HIGH | `AttemptResponse` client type omits `stats` and `nextReviewDate` from server | No |
| 6 | 10-1 | HIGH | Dual response envelope — no single API contract | No |
| 7 | 10-5 | HIGH | Two competing question types (`QuestionResponse` vs `QuestionDTO`) | No |
| 8 | 10-11 | MEDIUM | Offline-synced main session answers skip Rolling 360 update | No |
| 9 | 10-8 | MEDIUM | FSRS fields default to 0 instead of null, showing false "forgotten" state | No |
| 10 | 10-2 | MEDIUM | `toResponse` fallback can leak internal fields | No |

---

## 3 Highest-Leverage Fixes

### Fix 1: Repair `contentService.ts` Browser Path (30 min)
**Files:** `lib/api/contentService.ts`
**Change:** Replace `transformToMedicalContent(data)` with proper array handling:
```typescript
const data = (await response.json()) as unknown;
const items = Array.isArray(data) ? data : (data as any)?.data ?? [];
return items.map((record: any) => ({
  id: record.id ?? record.conditionId,
  conditionId: record.conditionId,
  condition: record.condition ?? record.conditionId,
  // ... proper field mapping
}));
```
**Impact:** Fixes Findings 10-9 and 10-15. Unblocks any browser-side content loading.

### Fix 2: Add Runtime Validation to `useDrillFSRS` and Fix FSRS Defaults (20 min)
**Files:** `hooks/useDrillFSRS.ts`
**Change:**
1. Add minimal runtime shape check after `response.json()`:
```typescript
const raw = await response.json();
if (typeof raw?.isCorrect !== 'boolean') {
  throw new Error('Unexpected response shape from submit-review');
}
const result = raw as DrillFSRSResponse;
```
2. Change `?? 0` defaults to `?? null` for FSRS fields (stability, difficulty, intervalDays).
3. Update `FSRSNextReview` type to allow `null` fields, and let UI show "No data" instead of zero.
**Impact:** Fixes Findings 10-3 and 10-8. Prevents silent misinterpretation of drill results and guards against future response shape changes.

### Fix 3: Add `isMainSession` / `sessionType` to Offline Sync Queue (15 min)
**Files:** `lib/services/sync/syncManager.ts`
**Change:** Add `sessionType` and `isMainSession` to `OfflineAnswer` interface and `queueAnswer()`. Propagate from caller context (QuizView passes `isMainSession: true`).
**Impact:** Fixes Finding 10-11. Restores Rolling 360 stats for offline main session study.

---

## Recommended Implementation Plan (3 Days)

### Day 1: Content Loading & Type Safety (Findings 10-9, 10-15, 10-3, 10-8)
1. Fix `contentService.ts` browser path to handle array response correctly
2. Remove phantom `success` from `DrillFSRSResponse`, add runtime validation
3. Change FSRS field defaults from `0` to `null`
4. Test content loading in browser, drill submission flow

### Day 2: Sync & Offline (Findings 10-11, 10-12, 10-4)
1. Add `sessionType`/`isMainSession` to `OfflineAnswer` and sync queue
2. Differentiate HTTP error codes in `sendAttemptToServer` (401 → reauth, 429 → backoff, 404 → drop)
3. Update `AttemptResponse` client type to include `stats` and `nextReviewDate`
4. Test offline queue replay with main session context

### Day 3: Contract Standardization (Findings 10-1, 10-5, 10-2)
1. Document the response envelope convention (handlers return `{ data }`, `toResponse` unwraps)
2. Deprecate unused `QuestionResponse` type in `types/api.ts` (add `@deprecated` JSDoc)
3. Add a shared `ApiEnvelope<T>` type that both helpers conform to
4. Audit remaining `data?.data ?? data` patterns for correctness

---

## What to Audit Next

**Audit 11 — Dashboard Analytics & Visualization Correctness:** The dashboard consumes aggregate stats, Rolling 360 data, system breakdown, and FSRS retrievability to render charts and progress indicators. With the data integrity issues from Audits 9 and 10, the dashboard may be rendering stale or corrupted data. Verify that chart components handle null/empty gracefully, that aggregate stats match raw data, and that the system mastery heatmap correctly reflects actual study progress.
