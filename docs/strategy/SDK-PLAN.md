# PANaCEa Internal SDK — Plan

## Problem

The frontend makes **487+ raw `fetch()` calls** across 55+ files. Every call site independently handles auth tokens, `Content-Type` headers, error parsing, and response unwrapping. The existing `fetchWithAuth()` in `lib/apiClient.ts` is used in almost none of them — components call `fetch()` directly with inline `Bearer ${token}` headers.

This means:
- No type safety on request or response shapes
- Duplicated error handling (or missing error handling)
- Auth pattern copy-pasted everywhere via `useAuth().getToken()`
- Response unwrapping inconsistencies (`json.data` vs `json` vs `json.data ?? json`)
- No single place to add retry, logging, or circuit-breaking later

## SDK Brief

### Domains to Cover (first slice)

| Domain | Prefix | Endpoints in Slice | Why First |
|--------|--------|-------------------|-----------|
| **Drills** | `/api/drills/*` | `submit-review`, `submit-reviews` | Highest-traffic write path; used by all drill hooks and offline/sync queues |
| **Sessions** | `/api/questions/session`, `/api/study/session/*` | `GET/POST questions/session`, `generate` | Critical session-start path; question identity must survive client transforms |
| **SRS** | `/api/srs/*` | `due`, `submit`, `sync` | Core spaced-repetition loop |
| **User** | `/api/user/*` | `profile`, `stats`, `fsrs-params`, `preferences` | Read on every page load |
| **Content** | `/api/content/*`, `/api/library/*` | `search`, `semantic-search` | Library and search flows |

### Endpoints to Wrap First

```
POST /api/drills/submit-review        → drillsClient.submitReview(payload)
POST /api/drills/submit-reviews       → drillsClient.submitReviews(batch)
GET  /api/questions/session           → questionsClient.fetchSession(params)
POST /api/questions/fetch             → questionsClient.fetchPoolQuestions(filters)
POST /api/study/session/generate      → sessionsClient.generate(opts)
GET  /api/srs/due                     → srsClient.getDueItems()
POST /api/srs/submit                  → srsClient.submitReview(payload)
GET  /api/user/profile                → userClient.getProfile()
GET  /api/user/stats                  → userClient.getStats()
GET  /api/user/fsrs-params            → userClient.getFSRSParams()
PUT  /api/user/preferences            → userClient.updatePreferences(prefs)
GET  /api/content/search?q=           → contentClient.search(query)
GET  /api/library/semantic-search     → contentClient.semanticSearch(query)
```

### Files to Create

```
lib/sdk/
├── core.ts                 ← Base client: auth, fetch, error handling, retry
├── types.ts                ← Shared response envelope, error types
├── drillsClient.ts         ← Drills domain (submit-review)
├── sessionsClient.ts       ← Session generation domain
├── srsClient.ts            ← SRS due/submit/sync domain
├── userClient.ts           ← User profile/stats/prefs domain
├── contentClient.ts        ← Content search domain
├── index.ts                ← Barrel export + factory
└── __tests__/
    └── core.test.ts        ← Tests for base client + mocks
    └── drillsClient.test.ts
```

### Call Sites to Migrate (proving the pattern)

| # | File | Current Pattern | SDK Replacement |
|---|------|-----------------|-----------------|
| 1 | `hooks/useDrillFSRS.ts:225` | Raw `fetch('/api/drills/submit-review', ...)` with inline auth | `drillsClient.submitReview(payload)` |
| 2 | `services/core/mainSessionService.ts` | Raw `fetch('/api/questions/session?...')` with manual envelope unwrapping | `questionsClient.fetchSession(params)` |
| 3 | `services/client/questionApi.ts` | Raw `fetch('/api/questions/fetch', ...)` and local pre-generated identity transform | `questionsClient.fetchPoolQuestions(filters)` |
| 4 | `hooks/useSessionGenerator.ts:80` | Raw `fetch('/api/study/session/generate', ...)` | `sessionsClient.generate(opts)` |
| 5 | `hooks/useSRSItems.ts:45` | Raw `fetch('/api/srs/due', ...)` | `srsClient.getDueItems()` |
| 6 | `hooks/useFSRSOptimizationCheck.ts:64` | Raw `fetch('/api/user/fsrs-params', ...)` | `userClient.getFSRSParams()` |
| 7 | `hooks/useSemanticSearch.ts:122` | Raw `fetch('/api/library/semantic-search', ...)` | `contentClient.semanticSearch(query)` |

### Architecture Decisions

**Auth strategy:** The SDK core accepts a `getToken: () => Promise<string | null>` function at construction time. This keeps Clerk as an injected dependency — no React hook coupling inside the SDK. Each hook passes its `getToken` once when creating/calling the client.

**Response unwrapping:** The SDK normalizes the inconsistent server patterns (`{ data }` vs `{ success, data }` vs bare object) into a consistent `Result<T, E>` type so call sites never have to guess.

**Question identity preservation:** Session and pool question clients must keep
`questionSource`, `canonicalQuestionId`, and `sourceQuestionId` intact. These
fields route `/api/drills/submit-review(s)` to the correct source table
(`Question`, `PreGeneratedQuestion`, or generated/seed fallback) and prevent
successful-looking submissions that cannot persist durable review state.

**Error model:** A typed `ApiError` class with `status`, `code`, `message`, and optional `details` — thrown on non-2xx. Call sites can catch and inspect without parsing JSON.

**No singletons:** Client instances are created per-call or per-hook-lifecycle — no global state. This avoids stale token issues and makes testing trivial.

**Existing code preserved:** `lib/apiClient.ts` and `lib/utils/apiConfig.ts` are NOT modified. The SDK is additive. Migration is incremental — old `fetch()` calls continue to work.

### Scope Boundary

This first slice covers **12 endpoints** across **5 domains** and migrates **7 call sites**. After proving the pattern, the remaining ~170 endpoints can be folded in domain-by-domain without changing the SDK core.

## Next Endpoints to Fold In (post-MVP)

| Priority | Domain | Endpoints |
|----------|--------|-----------|
| P1 | Drills | `contrastive/generate`, `contrastive/submit`, `pharm`, `elaboration/*` |
| P1 | User | `behavior-metrics`, `calibration`, `topic-progress/*`, `confusion-pairs` |
| P2 | Analytics | `profile`, `session`, `calibration`, `confusion-pairs`, `peer-stats` |
| P2 | Questions | `pool`, `flag`, `condition-drill` |
| P3 | Conditions | `search`, `[conditionId]`, `pearls` |
| P3 | OSCE | `live/*`, `chat`, `stats`, `analytics` |
| P4 | Admin | `taxonomies`, `media/*`, `staging/*`, `pool-health` |
| P4 | References | `guidelines`, `normal-labs`, `quick-ref` |
