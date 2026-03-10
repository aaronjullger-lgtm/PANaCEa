# API Overview

This document is the current API surface reference for recently changed OSCE endpoints.

## OSCE request body convention (production)

All OSCE POST endpoints (Cloudflare Pages Functions) expect a **wrapped** body shape. The client must send:

```json
{ "body": { ... } }
```

Inner fields (e.g. `sessionId`, `caseId`, `messages`, `diagnosis`, `treatmentPlan`) go inside `body`. The client in `services/domain/osceService.ts` sends this shape for session, chat, complete, and grade.

## OSCE grade flow

1. Session must be **completed** before grading: `session.status === 'completed'`.
2. Client must call **in order**: `POST /api/osce/complete` with diagnosis/treatmentPlan, then `POST /api/osce/analysis/grade` with the same `sessionId`.
3. **Re-grading**: Calling the grade endpoint again for the same session **updates** the existing `OsceResult`; it does **not** create duplicate `ConceptGap` records (deduplication in `persistGradeAndConceptGap` by `userId`, `system`, `sourceType: 'osce'`, `sourceId`).

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/osce/session` | Create or get active OSCE session for a case. Request body: `{ "body": { "caseId": "string" } }`. |
| POST | `/api/osce/chat` | Save chat messages for a session. Request body: `{ "body": { "sessionId": "string", "messages": [{ "role": "user" \| "assistant" \| "system", "content": "string" }] } }`. |
| POST | `/api/osce/complete` | Marks an OSCE session complete (idempotent) and optionally persists analytics to `CaseFile`. |
| POST | `/api/osce/analysis/grade` | Grades a completed OSCE transcript against rubric/fallback checklist and persists `OsceResult` (+ optional `ConceptGap`). |

## Endpoint Contracts

### `POST /api/osce/complete`

**Auth:** Required (Bearer token via Clerk middleware)

**Request body**

```json
{
  "body": {
    "sessionId": "string",
    "diagnosis": "string (optional)",
    "treatmentPlan": "string (optional)",
    "soapComparison": {},
    "timingAnalytics": {},
    "infographics": ["string"]
  }
}
```

**Success responses**

- `200 OK` → `{ "success": true }`
- `200 OK` (idempotent repeat) → `{ "success": true, "alreadyCompleted": true }`

**Error responses**

- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- Creates `CaseFile` on a best-effort basis when `soapComparison` or `timingAnalytics` is provided.
- `CaseFile` creation failure is logged but does not fail completion.

---

### `POST /api/osce/analysis/grade`

**Auth:** Required (Bearer token via Clerk middleware)

**Request body**

```json
{
  "body": {
    "sessionId": "string"
  }
}
```

**Success response (`200 OK`)**

```json
{
  "resultId": "string",
  "score": 0,
  "checklist": [
    {
      "item": "string",
      "status": "PASS",
      "feedback": "string"
    }
  ],
  "redFlagsMissed": ["string"],
  "clinicalReasoningScore": 0,
  "billingCodeSuggestion": "string",
  "softSkillsReport": {
    "empathy": { "score": 1, "feedback": "string" },
    "professionalism": { "score": 1, "feedback": "string" },
    "pacing": { "score": 1, "feedback": "string" }
  },
  "conceptGapCreated": false
}
```

**Error responses**

- `400` → `{ "error": "Session must be completed before grading" }`
- `404` → `{ "error": "User not found" }` or `{ "error": "Session not found" }` or `{ "error": "Case record not found" }`
- `429` → `{ "error": "Rate limit exceeded" }` (Gemini limiter)
- `502` → `{ "error": "Grading service failed" }` or `{ "error": "Invalid grading response format" }`
- `500` → `{ "error": "Internal server error" }`

**Notes**

- If no `CaseRubric` exists, the endpoint builds a fallback checklist from case `essentialQuestions` and `idealWorkup`.
- Persists/updates `OsceResult` and may create `ConceptGap` when clinical reasoning fails or red flags are missed.
- Checklist items are validated with Zod (`GRADE_CHECKLIST_ITEM`) before persistence; malformed Gemini output is dropped or rejected.

---

## OSCE tables: API-layer security

The following tables are used by the OSCE module and are **protected at the API layer** (ownership enforced in each handler), not by Supabase RLS:

- `PatientEncounterSession` — session ownership enforced in session, chat, complete, history, and grade handlers (e.g. `where: { id: sessionId, userId: user.id }`).
- `OsceResult` — created/updated only after session ownership is verified; linked to session by `sessionId`.
- `ConceptGap` — created with `userId` from the authenticated user when grading indicates a gap.

RLS is not currently applied to these tables. If you enable RLS for OSCE later, add policies that constrain `userId` (or equivalent) by `auth.uid()` / Clerk mapping so that API and RLS are aligned.

---

## Admin + Shared API updates (March 2026)

These routes changed under `functions/api/admin/`, `functions/api/questions/`, and `functions/api/reference/`.

### Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/cache-metrics` | Returns KV cache hit/miss/error counters and computed hit rate (admin-only). |
| GET | `/api/admin/content-audit` | Audits `MedicalContent` completeness and prioritizes missing high-yield fields (admin-only). |
| GET | `/api/admin/curated-passages` | Lists curated passages with optional `conditionId` / `system` / `limit` filtering (admin-only). |
| POST | `/api/admin/curated-passages` | Creates, updates, or deletes a curated passage via an `action` mutation body (admin-only). |
| POST | `/api/admin/generate-draft` | Generates AI draft condition content and saves as `status: "draft"` (content editors/admin). |
| POST | `/api/admin/generate-question` | Generates taxonomy-driven PANCE-style questions using Gemini (admin-only). |
| POST | `/api/admin/knowledge/ingest` | Creates/refreshes Gemini cached context from text or Gemini `fileUri` (admin-only). |
| GET | `/api/admin/platform-stats` | Returns date-scoped historical `PlatformStatistics` plus summary metrics (admin-only). |
| GET | `/api/admin/question-review` | Lists pre-generated questions for review/triage with filters and pagination (admin + content creators). |
| POST | `/api/admin/question-review` | Updates validation status and review metadata for one pre-generated question (admin + content creators). |
| GET | `/api/admin/stats` | Returns aggregate platform counters (or placeholder data when DB env is missing). |
| GET | `/api/admin/system-mappings` | Lists taxonomy/subcategory mappings with search + pagination (admin-only). |
| POST | `/api/admin/system-mappings` | Creates a new system mapping and invalidates content cache (admin-only). |
| PUT | `/api/admin/system-mappings/:taxonomyCode/:subcategory` | Updates mapping fields and invalidates content cache (admin-only). |
| DELETE | `/api/admin/system-mappings/:taxonomyCode/:subcategory` | Deletes one mapping and invalidates content cache (admin-only). |
| GET | `/api/admin/taxonomies` | Lists taxonomies with optional `activeOnly` filter + pagination (admin-only). |
| POST | `/api/admin/taxonomies` | Creates a taxonomy code/name record (admin-only). |
| PUT | `/api/admin/taxonomies/:code` | Updates one taxonomy (admin-only). |
| DELETE | `/api/admin/taxonomies/:code` | Soft deletes (`isActive=false`) or hard deletes with `?hard=true` (admin-only). |
| POST | `/api/questions/generate-batch` | Authenticated batch generation of pre-generated questions with distractor-quality gating. |
| GET | `/api/reference/normal-labs` | Authenticated lookup of normal lab ranges for session/library UI panels. |

### Disabled routes in this change set

The following files are currently disabled (`.ts.disabled`) and are not active API routes:

- `GET /api/admin/library-enrichment-logs`
- `GET /api/admin/library-enrichment-priority`

### Request/Response snapshots (changed routes)

#### `GET /api/admin/cache-metrics`

- **Query:** none
- **200:** `{ "success": true, "metrics": { "hits": 0, "misses": 0, "errors": 0, "total": 0, "hitRate": "0%", "lastUpdated": "ISO" } }`
- **403:** `{ "error": "Admin access required" }`
- **503:** `{ "error": "Cache not available", "message": "KV namespace is not configured" }`

#### `GET /api/admin/content-audit`

- **Query:** `system?: string`, `limit?: string` (default `100`), `includeComplete?: "true" | "false"`
- **200 keys:** `timestamp`, `totalConditions`, `fullyComplete`, `partiallyComplete`, `criticalMissing`, `byField`, `incompleteConditions`, `topPriorityToFix`

#### `POST /api/admin/curated-passages`

```json
{
  "body": {
    "action": "create | update | delete",
    "id": "string (required for update/delete)",
    "title": "string",
    "body": "string",
    "source": "string",
    "sourceUrl": "https://...",
    "license": "string",
    "systemCodes": ["CV"],
    "conditionIds": ["cv__general__acute_myocardial_infarction"]
  }
}
```

- **Create:** requires `title`, `body`, and non-empty `conditionIds`
- **200:** `{ "success": true, "passage": { ... } }` (create/update) or `{ "success": true, "deleted": true }` (delete)

#### `POST /api/admin/generate-draft`

```json
{
  "body": {
    "conditionName": "Acute Myocardial Infarction",
    "system": "CV",
    "subcategory": "Cardiology"
  }
}
```

- **201:** `{ "message": "Draft content generated successfully", "content": { ...MedicalContent } }`
- **409:** `{ "error": "Content with this condition already exists" }`

#### `POST /api/admin/generate-question`

```json
{
  "body": {
    "taxonomyCode": "CV",
    "subcategory": "Cardiology",
    "type": "vignette",
    "count": 3
  }
}
```

- **200:** `{ "success": true, "data": { "questions": [...], "taxonomy": { "code": "...", "name": "...", "weight": 0.1 }, "subcategory": "..." } }`
- **404:** taxonomy not found

#### `POST /api/admin/knowledge/ingest`

```json
{
  "body": {
    "content": "optional extracted text",
    "fileUri": "optional Gemini file URI",
    "category": "Cardiology",
    "displayName": "cache_pance_master_v1",
    "ttlSeconds": 86400
  }
}
```

- Send at least one of `content` or `fileUri`.
- **200:** `{ "data": { "cacheName": "cachedContents/...", "displayName": "...", "expireTime": "ISO|null", "ttlSeconds": 86400 } }`
- **400:** when neither `content` nor `fileUri` is provided.

#### `GET /api/admin/platform-stats`

- **Query:** `start?: YYYY-MM-DD`, `end?: YYYY-MM-DD`, `limit?: string` (default `30`)
- **200:** `{ "success": true, "data": [...PlatformStatistics], "summary": {...}|null, "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }`

#### `GET /api/admin/question-review`

- **Query (all optional):** `validationStatus`, `system`, `minQualityScore`, `maxFlagRate`, `limit`, `offset`, `sortBy`, `sortOrder`
- Defaults: `validationStatus=pending`, `limit=50`, `offset=0`, `sortBy=generatedAt`, `sortOrder=desc`
- **200:** `{ "success": true, "data": [...], "pagination": { "total": 0, "limit": 50, "offset": 0, "hasMore": false, "pages": 0 } }`

#### `POST /api/admin/question-review`

```json
{
  "body": {
    "questionId": "string",
    "validationStatus": "approved | rejected | needs_revision",
    "validationNotes": "optional",
    "qualityScore": 0,
    "conditionAccuracy": 0.0,
    "contentRelevance": 0.0,
    "distracorQuality": 0.0
  }
}
```

- **200:** `{ "success": true, "data": { ...updatedQuestion }, "message": "Question approved|rejected|needs_revision" }`
- **404:** `{ "success": false, "error": "Question not found" }`

#### `GET /api/admin/stats`

- **200:** `{ "success": true, "data": { "totalUsers": 0, "activeUsersToday": 0, "totalStudySessions": 0, "averageAccuracy": 0, "popularSystems": [], "pendingFlags": 0 } }`
- If `DATABASE_URL` is missing, returns the same shape with zeroed placeholder values and `"note": "Database not configured"`.

#### `GET/POST/PUT/DELETE /api/admin/system-mappings`

- **GET query:** `taxonomyCode?`, `page?`, `limit?`, `search?`
- **POST body (`body`):**
  - `taxonomyCode` (2-10 chars), `subcategory`, `canonicalName`
  - optional: `aliases[]`, `searchKeywords[]`, `parentCategory`, `blueprintTags[]`
- **PUT params + body:** `taxonomyCode`, `subcategory` path params + partial mutable body fields
- **DELETE params:** `taxonomyCode`, `subcategory`

#### `GET/POST/PUT/DELETE /api/admin/taxonomies`

- **GET query:** `page?`, `limit?`, `activeOnly?`
- **POST body (`body`):** `code`, `name`, optional `description`, `weight` (`0..1`), `isActive`
- **PUT params + body:** `code` path param + partial mutable body fields
- **DELETE query:** optional `hard=true` for hard delete (default soft delete)

#### `POST /api/questions/generate-batch`

```json
{
  "system": "CV",
  "category": "diagnosis",
  "difficulty": "medium",
  "count": 10
}
```

- **Important:** body is flat (not wrapped in `body`).
- **200:** `{ "success": true, "generated": 8, "system": "CV", "category": "diagnosis", "difficulty": "medium" }`
- Questions are quality-gated before insert (`validateDistractors`, threshold 70).

#### `GET /api/reference/normal-labs`

- **Query:** `category?: string`, `limit?: integer-string` (clamped `1..500`, default `200`)
- **200:** `{ "success": true, "labs": [ { "labTestName": "...", "normalRangeLow": 0, "normalRangeHigh": 0, "units": "...", "isHighYield": true, ... } ] }`
