# API Overview

This document tracks the request/response contracts for the most recently changed API routes.

## Changed Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/mapping-enrichment/gaps` | Returns unmapped medical taxonomy nodes (gaps), with optional inclusion of inactive taxonomy items. |
| POST | `/api/mapping-enrichment/suggest` | Generates and persists mapping suggestions for unmapped taxonomy nodes, optionally scoped by taxonomy codes. |
| GET | `/api/mapping-enrichment/suggestions` | Returns persisted mapping suggestions with filtering, sorting, and pagination. |

## Endpoint Contracts

### `GET /api/mapping-enrichment/gaps`

**Auth:** Required (admin-authenticated endpoint)

**Query params**

- `includeInactive` (optional, `true`/`false`, default `false`)  
  When `true`, includes inactive taxonomy rows in gap detection.

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "gaps": [
    {
      "taxonomyCode": "CV-HTN",
      "taxonomyName": "Hypertension",
      "description": "Optional taxonomy description",
      "weight": 0.75,
      "isActive": true,
      "missingMappingsCount": 1
    }
  ]
}
```

**Error responses**

- `401` → `{ "error": "Unauthorized" }`
- `500` → `{ "error": "DATABASE_URL environment variable is not set" }`
- `500` → `{ "error": "Internal server error", "details": "error message" }`

**Notes**

- Gap detection returns taxonomy rows with zero `SystemMapping` records.
- `missingMappingsCount` is currently always `1` for returned rows.

---

### `POST /api/mapping-enrichment/suggest`

**Auth:** Required (admin-authenticated endpoint)

**Request body**

```json
{
  "taxonomyCodes": ["CV-HTN", "PULM-ASTHMA"],
  "limit": 10
}
```

- `taxonomyCodes` is optional. If omitted, the route processes all detected gaps.
- `limit` is optional. Default is `10`; max is `50` (values above 50 are clamped).

**Success response (`200 OK`)**

```json
{
  "suggestions": [
    {
      "id": "clx123...",
      "taxonomyCode": "CV-HTN",
      "taxonomyName": "Hypertension",
      "suggestedSystemCode": "CV",
      "confidence": 0.84,
      "reason": "Semantic similarity 91.2%, keyword match yes",
      "alternativeSystems": [
        {
          "systemCode": "RENAL",
          "confidence": 0.63,
          "reason": "Semantic similarity 78.0%, keyword match no"
        }
      ],
      "status": "PENDING",
      "createdAt": "2026-03-18T12:34:56.000Z",
      "updatedAt": "2026-03-18T12:34:56.000Z"
    }
  ],
  "total": 27,
  "limitApplied": 10,
  "note": "Suggestions are based on semantic similarity and keyword matching. Confidence scores range 0-1."
}
```

`total` is the number generated before applying `limitApplied`.

**Error responses**

- `401` → `{ "error": "Unauthorized" }`
- `500` → `{ "error": "DATABASE_URL environment variable is not set" }`
- `500` → `{ "error": "GEMINI_API_KEY environment variable is not set" }`
- `500` → `{ "error": "Internal server error", "details": "error message" }`

**Notes**

- This endpoint may call Gemini embeddings and can incur external API usage/cost.
- Generated suggestions are persisted to `MappingSuggestion` with default status `PENDING`.

---

### `GET /api/mapping-enrichment/suggestions`

**Auth:** Required (admin-authenticated endpoint)

**Query params**

- `status` (optional): `PENDING` | `APPROVED` | `REJECTED` | `IGNORED`
- `confidenceMin` (optional number)
- `confidenceMax` (optional number)
- `taxonomyCode` (optional string; case-insensitive partial match)
- `systemCode` (optional string; exact match against `suggestedSystemCode`)
- `page` (optional integer, default `1`, must be `>= 1`)
- `limit` (optional integer, default `50`, valid range `1..100`)
- `sortBy` (optional): `confidence` | `createdAt` | `taxonomyCode` | `suggestedSystemCode` (default `confidence`)
- `sortOrder` (optional): `asc` | `desc` (default `desc`)

**Request body:** None

**Success response (`200 OK`)**

```json
{
  "suggestions": [
    {
      "id": "clx123...",
      "taxonomyCode": "CV-HTN",
      "taxonomyName": "Hypertension",
      "taxonomyDescription": "Optional taxonomy description",
      "taxonomyIsActive": true,
      "suggestedSystemCode": "CV",
      "confidence": 0.84,
      "reason": "Semantic similarity 91.2%, keyword match yes",
      "alternativeSystems": [
        {
          "systemCode": "RENAL",
          "confidence": 0.63,
          "reason": "Semantic similarity 78.0%, keyword match no"
        }
      ],
      "status": "PENDING",
      "reviewedBy": null,
      "reviewedAt": null,
      "createdAt": "2026-03-18T12:34:56.000Z",
      "updatedAt": "2026-03-18T12:34:56.000Z",
      "reviewedByUser": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

When present, `reviewedByUser` includes:

```json
{
  "id": "user_id",
  "email": "admin@example.com",
  "firstName": "Admin",
  "lastName": "User"
}
```

**Error responses**

- `401` → `{ "error": "Unauthorized" }`
- `400` → `{ "error": "Page must be greater than 0" }`
- `400` → `{ "error": "Limit must be between 1 and 100" }`
- `500` → `{ "error": "DATABASE_URL environment variable is not set" }`
- `500` → `{ "error": "Internal server error", "details": "error message" }`

**Notes**

- Returns joined taxonomy metadata and reviewer user metadata when available.
- Pagination uses `skip = (page - 1) * limit` and `take = limit`.
