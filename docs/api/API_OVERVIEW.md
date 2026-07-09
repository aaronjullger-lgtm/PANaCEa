# API Overview

This document tracks the request/response contracts for the most recently changed API routes and related shared modules.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/content/library/extract` | Start an Adobe PDF Extract job for an `EducationalResource` (CMS). |
| GET | `/api/content/library/extract` | Poll extract job status; on completion, upload `structuredData.json` and set `adobeDataPath`. |
| POST | `/api/content/library/ingest` | Store Adobe Extract `structuredData` for a resource in Supabase (CMS). |
| DELETE | `/api/osce/cleanup` | Clear OSCE chat messages for a session owned by the authenticated user. |
| POST | `/api/osce/cleanup` | Same as DELETE; accepts `sessionId` via query or JSON body. |

## Endpoint Contracts

### `POST /api/content/library/extract`

**Auth:** Required — CMS role (`EDITOR`, `APPROVER`, `ADMIN`, or `SUPERADMIN`) via `cmsEndpoint`.

**Request body**

```json
{
  "resourceId": "string",
  "pdfUrl": "https://example.com/textbook.pdf"
}
```

Flat `{ resourceId, pdfUrl }` and wrapped `{ "body": { resourceId, pdfUrl } }` are both accepted.

**Success response (`202 Accepted`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "jobId": "string",
    "resourceId": "string",
    "statusUrl": "https://pdf-services.adobe.io/operation/extractpdf/{jobId}/status",
    "message": "Poll GET /api/content/library/extract?jobId=...&resourceId=... for status."
  }
}
```

**Error responses**

- `404` → resource not found
- `422` / validation → PDF exceeds 100MB limit or invalid body
- `502` → upstream PDF fetch or Adobe Extract start failed
- `503` → `ADOBE_CLIENT_ID` / `ADOBE_CLIENT_SECRET` not configured

**Notes**

- Fetches the PDF from `pdfUrl`, uploads to Adobe PDF Services, and returns a job ID for polling.
- Max PDF size: 100 MB.

---

### `GET /api/content/library/extract`

**Auth:** Required — CMS role via `cmsEndpoint`.

**Query parameters**

| Param | Required | Description |
|---|---|---|
| `jobId` | Yes | Adobe Extract job ID from the POST response |
| `resourceId` | Yes | `EducationalResource` ID |

**Success responses (`200 OK`)**

Completed job:

```json
{
  "ok": true,
  "success": true,
  "data": {
    "status": "done",
    "adobeDataPath": "extracts/{resourceId}/structuredData.json"
  }
}
```

Still running (server polls Adobe for up to ~90s per request):

```json
{
  "ok": true,
  "success": true,
  "data": {
    "status": "in progress",
    "message": "Polling timeout; call again to continue polling.",
    "lastStatus": "in progress"
  }
}
```

Failed job:

```json
{
  "ok": true,
  "success": true,
  "data": {
    "status": "failed",
    "errorCode": "string",
    "errorMessage": "Extract job failed"
  }
}
```

**Error responses**

- `503` → Adobe or Supabase env not configured
- `502` → Supabase upload failed after extract completed

**Notes**

- On `status: "done"`, downloads the Adobe result zip, extracts `structuredData.json`, uploads to Supabase bucket `educational-resources`, and updates `EducationalResource.adobeDataPath`.
- Poll repeatedly until `status` is `done` or `failed`.

---

### `POST /api/content/library/ingest`

**Auth:** Required — CMS role via `cmsEndpoint`.

**Request body**

```json
{
  "resourceId": "string",
  "structuredData": {}
}
```

`structuredData` is the Adobe PDF Extract JSON (text, tables, figures, bounds). Flat and `{ "body": { ... } }` shapes are both accepted.

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "resourceId": "string",
    "adobeDataPath": "extracts/{resourceId}/structuredData.json"
  }
}
```

**Error responses**

- `404` → resource not found
- `502` → Supabase storage upload failed
- `503` → `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing

**Notes**

- Use when Extract JSON is already available (e.g. offline Node job with `@adobe/pdfservices-node-sdk`) instead of the in-app extract poll flow.
- Storage path: `educational-resources/extracts/{resourceId}/structuredData.json`.

---

### `DELETE /api/osce/cleanup`

**Auth:** Required — authenticated user via `authenticatedEndpoint`.

**Query parameters**

| Param | Required | Description |
|---|---|---|
| `sessionId` | Yes | `PatientEncounterSession` ID |

**Success response (`200 OK`)**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "deleted": 1,
    "message": "Cleared chat messages for session {sessionId}"
  }
}
```

**Error responses**

- `400` → missing or invalid `sessionId`
- `404` → user not found, or session not found / not owned by caller
- `500` → cleanup failed

**Notes**

- Clears `PatientEncounterSession.messages` only when `sessionId` belongs to the authenticated user.
- Does not delete the session row — only empties chat history.

---

### `POST /api/osce/cleanup`

**Auth:** Required — authenticated user via `authenticatedEndpoint`.

**Request**

- Preferred: `?sessionId={sessionId}` query parameter (same as DELETE).
- Fallback: JSON body `{ "sessionId": "string" }` when the query param is omitted.

**Response:** Same as `DELETE /api/osce/cleanup`.

**Notes**

- Client helper `clearSession()` in `services/domain/osceService.ts` uses POST with a query `sessionId`.
- Ownership is enforced server-side; callers cannot clear another user's session.

---

## Related Shared Module

### `lib/study/renderStructuredRationale.ts`

Not an HTTP route. Converts structured question rationale objects into plain-text strings for display and downstream AI prompts.

**Exports**

| Function | Purpose |
|---|---|
| `renderStructuredRationale(rationale)` | Full text block: bottom line → why correct → distractors → pearl → high-yield → pitfalls |
| `renderBriefRationale(rationale)` | Bottom line + why correct only |
| `renderDistractorRationale(rationale, userAnswerIndex?)` | Distractor analysis; highlights the student's wrong choice when index provided |
| `resolveStructuredRationale(rationale)` | Normalize `string`, JSON string, or object into `StructuredRationaleInput` |

**Input shape (`StructuredRationaleInput`)**

- `bottomLine`, `whyCorrect`, `whyIncorrectA`–`whyIncorrectE`, `clinicalPearl`, `highYieldImageOrTable`
- Optional: `commonPitfalls[]`, `groundingSources[]`, `pubmedCitations[]`

Used by Socratic Tutor, alternate-explanation generation, and `conceptQuestionSelector` normalization. See `docs/AUDIT_STANDARDIZED_RATIONALE.md` for the UI schema alignment.
