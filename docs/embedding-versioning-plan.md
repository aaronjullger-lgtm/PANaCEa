# Embedding Backfill & Versioning Plan

**Date:** 2026-07-09
**Blocker (deep-research 2026-05-22):** "Embedding backfill/versioning still separate." — Medical
Knowledge 66/100.

## 1. Verified current state

| Piece | State | Evidence |
|---|---|---|
| `QuestionEmbedding` model | ✅ Exists, with a **`model String @default("text-embedding-004")`** version field | `prisma/schema.prisma:5049-5053`; vector(768) column managed via raw SQL (pgvector). |
| `MedicalContentEmbedding` model | ✅ Exists | `prisma/schema.prisma:1845`. |
| Embedding generation endpoint | ✅ `functions/api/embeddings/generate-questions.ts` | — |
| Consistent version tagging across all embeddings | ⚠️ Partial | `QuestionEmbedding.model` exists; a single source-of-truth `EMBEDDING_MODEL` constant + drift check is not clearly centralized. |
| Backfill / re-embed pipeline | ⚠️ Separate / ad-hoc | No single "backfill + verify + version" lane found. |
| Drift / health check | ❌ | No embedding-freshness/version health check found. |

So versioning has a **foothold** (`QuestionEmbedding.model`), but the deep-research concern —
a *coordinated* backfill + version discipline + health check — is the real gap.

## 2. Proposed design (for approval where it touches data)

1. **Single source of truth:** a `lib/embeddings/version.ts` exporting `EMBEDDING_MODEL` +
   `EMBEDDING_DIM`, imported by both write paths so `QuestionEmbedding.model` /
   `MedicalContentEmbedding` are always tagged consistently.
2. **Drift detection (read-only, safe):** a health check that counts embeddings whose `model` ≠ current
   `EMBEDDING_MODEL`, and rows missing embeddings. Surfaced via `db:health` / a cron sanity lane.
3. **Backfill lane (Ask-First — writes + AI cost):** a bounded, resumable script that re-embeds stale/
   missing rows in batches, tagging `model` + timestamp. Must respect the Gemini/embedding cost guardrail
   in `.cursor/rules/autonomous-behavior.mdc` (bulk AI calls = STOP AND ASK).

## 3. Safe preparatory work (no approval, no bulk AI)

- Add the `EMBEDDING_MODEL`/`EMBEDDING_DIM` constant module and refactor write paths to import it
  (no data change; type-safe consolidation).
- Add a **read-only** drift-count query (no re-embedding) to report staleness.
- Write the backfill script as a **dry-run-only** first (reports what *would* be re-embedded).

## 4. Approval gates

- Running the backfill (bulk embedding generation) = **paid AI batch → STOP AND ASK** per the cost
  guardrail, and touches data → **Ask First**.
- Any migration to add version/timestamp columns beyond what exists = **Ask First**.
- Do not run bulk re-embedding or mutate embedding rows without explicit approval.
