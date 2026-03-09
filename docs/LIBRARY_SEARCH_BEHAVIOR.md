# Clinical Library Search Behavior

The Condition Library (Knowledge Base → Condition Library) uses a **hybrid search** model:

- **List (results):** When the user types in the search box, the query is sent to the server as the `search` query parameter. The library API (`GET /api/content/library`) performs **full-text search (FTS)** on `MedicalContent.search_vector` and returns matching conditions. The list is always driven by this API (filtered by system, subcategory, high-yield, and optionally search).
- **Answer snippet:** When the user has entered a search query, the client also calls the **semantic search** pipeline (RAG/embeddings) to get a short, one-sentence answer. That snippet is shown above the result list when available.

There is no client-side filtering by search text; search is entirely server-side (FTS). Semantic search is used only for the optional answer snippet.

## Implementation

- **Client:** [components/library/ClinicalReferenceLibrary.tsx](components/library/ClinicalReferenceLibrary.tsx) — `fetchContent` includes `search: searchQuery.trim()` in the library request when the user has typed a query. `displayContent` is always `filteredContent` (from the library API). The semantic answer is rendered when `semanticAnswer && askedForAnswer && !semanticLoading`.
- **API:** [functions/api/content/library.ts](functions/api/content/library.ts) — Accepts `search` query param; runs `search_vector @@ websearch_to_tsquery('english', search)` and returns ranked results, with LIKE fallback if FTS fails or returns no rows.

## Prerequisites

- `MedicalContent.search_vector` must be populated for FTS to work. Run `npx tsx scripts/db/backfill-search-vector.ts` if needed; use `npx tsx scripts/db/audit-search-vector.ts --fail` to fail CI when nulls exist.
