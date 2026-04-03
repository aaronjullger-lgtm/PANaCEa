---
name: clinical-library-search
description: "Fix, improve, and extend the clinical reference library, knowledge base, and search system in PANaCEa — including condition pages, drug lookups, semantic search, embedding-based retrieval, and content enrichment pipelines. Use this skill whenever working on the knowledge base, clinical library, condition detail pages, drug search, semantic search quality, content loading, or any issue where 'the content isn't showing up' or 'search results are bad'. Also use when adding new content types, improving retrieval relevance, or debugging embedding pipelines."
---

# Clinical Library & Search System

## Purpose
The clinical library is how students learn reference material during study sessions. Search must be **fast** (sub-100ms for UI), **accurate** (top-3 results relevant), and **trustworthy** (properly sourced, current, clinically sound).

## Content Architecture

**Medical content hierarchy:**
- Conditions, drugs, anatomy, clinical guidelines, antibiotic guidelines
- Conditions have parent categories (stored in `condition_metadata.json`, migration 20260113)
- All content embedded in `MedicalContent` table (768-dim Gemini text-embedding-005)
- HNSW vector index for fast retrieval (migration 20260207230000)

**Content flow:**
```
Create/Update Content (API) 
  → Generate Embedding (Gemini text-embedding-005)
  → Store in MedicalContent + HNSW index
  → Enrich with PubMed/trials/guidelines
  → Score health (relevance, completeness, currency)
  → Serve via /api/search or condition detail endpoints
```

## Search Pipeline

1. **Keyword search** – PostgreSQL `to_tsvector` on title, content
2. **Semantic search** – Query embedding vs HNSW index (top-20)
3. **Hybrid ranking** – Combine keyword BM25 + semantic relevance
4. **Filtering** – By content type, category, recency
5. **Display** – Return snippet, source, confidence score

**Key files:**
- `services/ai/semanticSearchService.ts` – Search orchestration
- `functions/api/search/*` – Search endpoints (keyword, semantic, hybrid)
- `lib/constants/clinical-data.ts` – Content type constants

## Embedding Pipeline

1. Extract clean text from medical content
2. Call `text-embedding-005` → 768-dim vector
3. Store vector + metadata in `MedicalContent` + HNSW index
4. Update searchability metadata
5. Recompute content health score

**Files to check:**
- Migration `20260207230000_hnsw_index.sql`
- `MedicalContent` Prisma schema (`prisma/schema.prisma`)

## Content Enrichment

- **PubMed enrichment** – `lib/services/question/pubmedEnricher.ts` (citations, evidence)
- **Trial enrichment** – `lib/services/question/trialEnricher.ts` (clinical trial relevance)
- **Clinical guidelines** – Integrated from standard protocol databases
- **Content health** – `functions/api/cron/compute-content-health.ts` (scores currency, completeness)

## Known Issues & Priorities

**🚨 CRITICAL (Current Priority):**
- **Knowledge Base content loading is BROKEN** — Content not rendering in UI despite being in database

**Common failure modes:**
- Stale embeddings (content updated but vector not recomputed)
- Missing condition metadata or broken hierarchy links
- Search returning irrelevant results (embedding quality or ranking bug)
- Content health score drift (cron job failed or scoring formula off)
- Empty `MedicalContent` (embedding generation failed silently)

## Files to Inspect First

| File | Purpose |
|------|---------|
| `components/library/` | Library UI (broken content loading here) |
| `components/knowledge/` | Knowledge base UI |
| `functions/api/search/` | Search endpoints |
| `services/ai/semanticSearchService.ts` | Semantic search logic |
| `functions/api/clinical/`, `functions/api/conditions/`, `functions/api/drugs/` | Content APIs |
| `functions/api/cron/compute-content-health.ts` | Health scoring |
| `prisma/schema.prisma` | MedicalContent + HNSW schema |
| `lib/constants/clinical-data.ts` | Content type definitions |
| `lib/constants/blueprint.ts` | PANCE curriculum (for weighting) |

## Debugging Checklist

- [ ] Is embedding vector NULL in `MedicalContent`?
- [ ] Does HNSW index exist? `SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%hnsw%'`
- [ ] Are search endpoints returning `null` or empty array?
- [ ] Is condition hierarchy broken? Check `condition_metadata.json` parsing
- [ ] Did embedding job fail? Check `functions/api/cron/` logs
- [ ] Is content loading API called but returning empty? Trace `components/library/` props

## Composes With

- **ai-generation-safety** – Content moderation before indexing
- **clinical-content-gen** – Creating new conditions/drugs/guidelines
- **cf-edge-api** – Edge function deployment & caching
