# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/content-gaps` | Lists detected blueprint/content gaps with aggregation and pagination (admin only). |
| POST | `/api/reflection` | Saves or updates post-session metacognitive reflection for the authenticated user. |

## Endpoint Contracts

### `GET /api/admin/content-gaps`

**Auth:** Required (admin-authenticated endpoint)

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `system` | string | — | Filter by organ system (e.g. `CV`, `PULM`). |
| `gapType` | string | — | Filter by gap type (e.g. `blueprint`, `accuracy`, `coverage`). |
| `resolved` | `"true"` \| `"false"` | — | Filter by resolution state (`resolvedAt` set vs. null). |
| `limit` | number | `50` | Page size (1–200). |
| `offset` | number | `0` | Pagination offset. |

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "data": {
    "gaps": [
      {
        "id": "string",
        "userId": "string | null",
        "system": "string",
        "taskCategory": "string | null",
        "conditionId": "string | null",
        "topic": "string",
        "gapType": "string",
        "severity": 0,
        "questionCount": 0,
        "avgAccuracy": 0,
        "lastReviewAt": "2026-01-01T00:00:00.000Z | null",
        "detectedAt": "2026-01-01T00:00:00.000Z",
        "resolvedAt": "2026-01-01T00:00:00.000Z | null",
        "metadata": {}
      }
    ],
    "aggregation": {
      "bySystem": [
        {
          "system": "string",
          "count": 0,
          "avgSeverity": 0
        }
      ],
      "byGapType": [
        {
          "gapType": "string",
          "count": 0
        }
      ]
    },
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 0,
      "hasMore": false
    }
  }
}
```

**Error responses**

- `403` → `{ "error": "Admin access required" }`
- `500` → `{ "error": "Failed to fetch content gaps" }`

**Notes**

- Gaps are ordered by `severity` (desc), then `detectedAt` (desc).
- Aggregation counts default to unresolved gaps when no `resolved` filter is applied.
- `userId` is `null` for global/platform gaps; non-null for per-user gaps.

---

### `POST /api/reflection`

**Auth:** Required (authenticated endpoint)

**Request body**

```json
{
  "reflection": {
    "patternsNoticed": "string (1–5000 chars)",
    "improvementPlan": "string (1–5000 chars)",
    "topicsToReview": ["string"],
    "sessionId": "string (optional, max 100 chars)"
  }
}
```

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

`message` is `"Reflection updated"` when a reflection already exists for the given `sessionId`.

**Error responses**

- `400` → `{ "error": "Validation failed: ..." }` (missing/invalid fields, invalid JSON)
- `401` → `{ "error": "Authentication required" }`
- `500` → `{ "error": "Reflection POST failed: ..." }`

**Notes**

- **No `confidenceRating` in request.** PANaCEa uses implicit-only confidence derived from behavioral telemetry (`lib/confidence/**`). The API persists `confidenceRating: 0` (unknown sentinel) server-side.
- When `sessionId` is provided and a reflection already exists for that session, the record is updated (upsert-by-session).
- Called from `SessionEndSummary` → `MetacognitiveReflection` after main study sessions.
