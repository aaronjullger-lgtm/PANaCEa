# Clinical Library Search Behavior

The Condition Library (Knowledge Base → Condition Library) uses a **hybrid search** model:

- **List (results):** When the user types in the search box, the query is sent to the server as the `search` query parameter. The library API (`GET /api/content/library`, authenticated) performs **full-text search (FTS)** on `MedicalContent.search_vector` and returns matching conditions. The list is always driven by this API (filtered by system, subcategory, high-yield, and optionally search).
- **Answer snippet:** When the user has entered a search query, the client also calls the **semantic search** pipeline (RAG/embeddings) to get a short, one-sentence answer. That snippet is shown above the result list when available.
- **Lazy detail loading:** The detail panel uses split condition endpoints for faster first paint:
  - `GET /api/content/condition/:conditionId/summary` (public, lightweight)
  - `GET /api/content/condition/:conditionId/details` (public, heavy relational payload)

There is no client-side filtering by search text; search is entirely server-side (FTS). Semantic search is used only for the optional answer snippet.

## Implementation

- **Client:** [components/library/ClinicalReferenceLibrary.tsx](components/library/ClinicalReferenceLibrary.tsx) — `fetchContent` includes `search: searchQuery.trim()` in the library request when the user has typed a query. `displayContent` is always `filteredContent` (from the library API). The semantic answer is rendered when `semanticAnswer && askedForAnswer && !semanticLoading`.
- **API list endpoint:** `functions/api/content/library.ts` — accepts `search`, `system`, `subcategory`, `highYield` (and currently schema-accepted `page`/`pageSize`) query params. `search` is trimmed and capped at 200 chars. Server flow: `search_vector @@ websearch_to_tsquery('english', search)` ranking first, then case-insensitive fallback on `condition`, `overview`, and `classic_patient` if FTS fails or returns no rows.
- **API systems endpoint:** `functions/api/content/systems.ts` — returns distinct systems + counts for filters.
- **API condition endpoints:** `functions/api/content/condition/[conditionId]/summary.ts` and `.../details.ts`.

## Runtime behavior notes

- Auth is required (`Authorization: Bearer <token>`).
- Successful list responses set `Cache-Control: public, max-age=3600`.
- KV response caching (TTL 1 hour) is used only when `search` is absent.
- On runtime failure, the endpoint returns `503` with:
  - `error: "failed_to_load_library"`
  - `error_code: "failed_to_load_library"`
  - `content: []`, `count: 0`

## Prerequisites

- `MedicalContent.search_vector` must be populated for FTS to work. Run `npx tsx scripts/db/backfill-search-vector.ts` if needed; use `npx tsx scripts/db/audit-search-vector.ts --fail` to fail CI when nulls exist.
