# API Overview

This document tracks the request/response contracts for the most recently changed API routes and related shared services.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/osce/live-engine` | Returns Gemini Live API WebSocket config, dynamic OSCE persona setup, and an ephemeral session token. |
| POST | `/api/questions/generate-enhanced` | Generates a PANCE question with Chain of Verification (CoVe), writes staging provenance, and conditionally promotes to live. |
| POST | `/api/reflection` | Creates or updates a post-session metacognitive reflection for the authenticated user (implicit confidence only). |
| POST | `/api/agents/invoke` | Dispatches a typed payload to a registered encounter-tier agent via `lib/agents/registry.encounter.ts`. |

## Related Service Change (not HTTP)

| Service | Location | Description |
|---|---|---|
| Auto-author pipeline | `lib/services/autoAuthor/index.ts` | Optional LLM quality gate (`ENABLE_QUALITY_GATE=true`) quarantines generated condition content before database save. |

---

## Endpoint Contracts

### `GET /api/osce/live-engine`

**Auth:** Required (`aiEndpoint`, Clerk)

**Rate limit:** 25 requests/minute (AI bucket)

**Query parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| `caseId` | string | OSCE case identifier |
| `sessionId` | string | Patient encounter session ID |
| `patientName` | string | Persona display name (default: `Marcus`) |
| `painLevel` | number (0–10) | Current simulated pain level |
| `mood` | string | Persona mood (default: `Anxious`) |
| `voiceId` | string | Gemini voice name (default: `Aoede`) |
| `voiceRate` | number (0.5–2.0) | Speech rate modifier |
| `voicePitch` | number (-12–12) | Pitch shift |
| `toneDescriptors` | string | Comma-separated tone hints |
| `vocalStrain` | `"true"` \| `"false"` | Strained-voice persona flag |
| `clinicalContext` | string | Extra clinical-state context for the persona |

**Success response (`200 OK`)**

```json
{
  "data": {
    "wsUrl": "wss://generativelanguage.googleapis.com/ws/...?access_token=...",
    "setup": {
      "model": "models/gemini-2.0-flash-exp",
      "systemInstruction": { "parts": [{ "text": "..." }] },
      "generationConfig": {
        "responseModalities": ["AUDIO", "TEXT"],
        "speechConfig": { "voiceName": "Aoede" },
        "temperature": 0.8
      },
      "tools": [{ "functionDeclarations": [] }],
      "realtimeInputConfig": { "activityHandling": "START_OF_ACTIVITY_INTERRUPTS" }
    },
    "sessionId": "string-or-null",
    "tokenUsed": true
  }
}
```

**Error responses**

- `503` → `{ "error": "Unable to create a temporary Live API session token. Please retry." }` (fail-closed; server `GEMINI_API_KEY` is never returned to the client)
- `500` → `{ "error": "Failed to get live engine config" }`

**Notes**

- Flow logic lives in `lib/agents/strategies/liveEngineStrategy.ts` (`runLiveEngineFlow`); the endpoint owns only the HTTP envelope.
- Client connects to `wsUrl`, sends `setup` first, then streams `realtimeInput` (audio) and `clientContent` (text). Barge-in is enabled.
- Setup tools: `get_current_vitals`, `reveal_lab_result(test_name)`.

---

### `POST /api/questions/generate-enhanced`

**Auth:** Required (`aiEndpoint`, Clerk)

**Rate limit:** 25 requests/minute (AI bucket)

**Request body**

```json
{
  "body": {
    "context": "string (min 1 char — condition content for grounding)",
    "conditionId": "string",
    "conditionName": "string",
    "system": "string",
    "task": "string (PANCE task category, e.g. \"Using Diagnostic Studies\")",
    "difficulty": "easier | same | harder"
  }
}
```

**Success responses**

- `200 OK` — CoVe passed; question promoted to live `Question` table:

```json
{
  "data": {
    "success": true,
    "question": {
      "id": "enh-...",
      "vignette": "string",
      "question": "string",
      "options": ["string"],
      "correctAnswerIndex": 0,
      "rationale": {},
      "pearls": ["string"],
      "conditionId": "string",
      "conditionName": "string",
      "system": "string",
      "task": "string",
      "difficulty": "same"
    },
    "verification": {
      "verified": true,
      "confidence": 0.92,
      "attempts": 1,
      "verificationId": "string-or-null",
      "recommendation": "accept",
      "flags": [],
      "summary": "string-or-null"
    }
  }
}
```

- `202 Accepted` — Generated but held for review (verification did not pass; staging record created, no live promotion):

```json
{
  "status": 202,
  "data": {
    "success": false,
    "submissionReady": false,
    "requiresApproval": true,
    "stagingQuestionId": "stg-...",
    "message": "Question generated but held for review because verification did not pass.",
    "verification": {
      "verified": false,
      "confidence": 0.0,
      "attempts": 3,
      "verificationId": "string-or-null",
      "recommendation": "review",
      "flags": [{ "severity": "warning", "code": "...", "message": "..." }],
      "summary": "string-or-null"
    }
  }
}
```

**Error responses**

- `500` → `{ "error": "Failed to generate enhanced question" }` (includes fail-closed paths: staging write failure before live promotion, or confidence below staging threshold after max CoVe retries)

**Notes**

- Flow logic lives in `lib/agents/strategies/generateEnhancedStrategy.ts` (`runGenerateEnhancedFlow`); the endpoint owns only the HTTP envelope.
- Gateway mapping: main generation `task='generation'`, `tier='powerful'` (gemini-2.5-pro); CoVe verification `task='grading'`, `tier='balanced'`.
- Staging provenance write is mandatory before live `question.create`.

---

### `POST /api/reflection`

**Auth:** Required (`authenticatedEndpoint`, Clerk)

**Request body**

```json
{
  "reflection": {
    "patternsNoticed": "string (1–5000 chars)",
    "improvementPlan": "string (1–5000 chars)",
    "topicsToReview": ["string (max 50 items)"],
    "sessionId": "string (optional, max 100 chars)"
  }
}
```

`confidenceRating` is **not accepted** in the request. Confidence is derived implicitly from behavioral telemetry (`lib/confidence/**`). The server persists `confidenceRating: 0` (unknown sentinel) in the database.

**Success response (`200 OK`)**

```json
{
  "data": {
    "success": true,
    "message": "Reflection saved",
    "reflection": {
      "id": "string",
      "completedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

When `sessionId` matches an existing reflection, the entry is updated and `message` is `"Reflection updated"`.

**Error responses**

- `500` → `{ "error": "Reflection POST failed: <message>" }`

---

### `POST /api/agents/invoke`

**Auth:** Required (`aiEndpoint`, Clerk)

**Rate limit:** 25 requests/minute

**Request body**

```json
{
  "agent": "standardized-patient",
  "input": {}
}
```

| Field | Type | Constraints |
|---|---|---|
| `agent` | string | Must be a registered **encounter-tier** agent name (see allowlist below) |
| `input` | object | Agent-specific payload; max ~256 KB serialized; validated by the agent's `inputSchema` |

**Encounter-tier allowlist** (from `lib/agents/registry.encounter.ts`)

| Agent name | Purpose |
|---|---|
| `standardized-patient` | OSCE standardized patient persona |
| `intent-router` | Classify student intent during encounter |
| `spbench-grader` | SPBench rubric grading (persists to `SpbenchScore` when `input.sessionId` is provided) |
| `soap-note-grader` | SOAP note evaluation |
| `feedback-summarizer` | Post-encounter feedback summary |
| `diagnostic-workup-advisor` | Workup recommendations |
| `ddx-generator` | Differential diagnosis generation |

Ops-tier agents (e.g. `generate-enhanced`, `callgemini-auditor`) are **not** callable from production. The `preceptor` graph agent is temporarily disabled in the encounter registry pending an esbuild resolution fix.

**Success response (`200 OK`)**

```json
{
  "data": {
    "agent": "spbench-grader",
    "status": "ok",
    "output": {},
    "durationMs": 1234,
    "telemetry": {}
  }
}
```

**Error responses**

- `400` → schema validation failure (`schema_invalid`, `no_input`)
- `403` → `{ "error": "Agent \"<name>\" is not callable from production." }`
- `404` → `{ "error": "Agent not found: <name>" }`
- `422` → safety-blocked agent output
- `429` → rate limited
- `500` → internal agent error (sanitized message; no provider URLs or internal `cause` fields)

**Notes**

- Distinct from `POST /api/agents/run` (legacy open-ended Gemini tool loop in `lib/services/agents/`).
- `spbench-grader` results are upserted to `SpbenchScore` when `input.sessionId` is provided and the session belongs to the caller.

---

## Auto-Author Quality Gate (service, not HTTP)

**Location:** `lib/services/autoAuthor/index.ts`

When `ENABLE_QUALITY_GATE=true`, generated condition content passes through `runQualityGate()` (`lib/agents/quality/qualityGate.ts`) with a clinical LLM validator before `validateGeneratedContent()` and database save. Quarantined content increments `validationFailed` in `AutoAuthorStats` and is not persisted.

See [Auto-Author Guide](../guides/AUTO_AUTHOR_GUIDE.md) for CLI usage and environment variables.
