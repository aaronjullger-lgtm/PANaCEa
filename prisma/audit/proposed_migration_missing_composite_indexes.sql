-- ============================================================================
-- Proposed migration: add missing composite indexes (hot-path coverage)
-- Date: 2026-04-18
-- Status: DRAFT — awaiting Aaron's approval to apply.
--
-- Context (DATABASE_AUDIT_2026-04-17.md finding #8 and §2.2):
--   Current coverage is single-column on each predicate, forcing seq-scans on
--   growing tables once filters combine. Each index below backs a specific
--   query pattern audited in §2.2.
--
-- After apply:
--   1. `npx prisma db pull` OR mirror with @@index declarations in schema.prisma
--      (matching declarations are being added in the same commit so pull is
--       not strictly required).
--   2. `npx prisma migrate resolve --applied <dir>` to register with
--      _prisma_migrations.
--
-- Apply strategy:
--   * All CREATE INDEX statements use IF NOT EXISTS for idempotency.
--   * CONCURRENTLY is omitted because these tables are small at audit date
--     (PreGeneratedQuestion ~thousands, Question ~thousands, ConfusionPair
--     low-hundreds). Add CONCURRENTLY if re-applying against a live hot
--     replica.
--
-- Coverage rationale per index:
--   1. PreGeneratedQuestion (validationStatus, qualityScore) —
--        auto-author quality filter: `WHERE validationStatus = 'pending'
--        AND qualityScore >= ...`. Existing single-col `validationStatus`
--        idx scans all pending rows before applying range on qualityScore.
--   2. PreGeneratedQuestion (validationStatus, flagCount) —
--        companion filter: `WHERE validationStatus = 'pending' AND
--        flagCount >= ...` (quarantine sweep).
--   3. Question (lifecycleStatus, contentHealthScore) —
--        health scans across 4 sites: `WHERE lifecycleStatus = 'PUBLISHED'
--        AND contentHealthScore < ...`. Drives the content-hygiene queue.
--   4. ConfusionPair (userId, count DESC, lastOccurrence DESC) —
--        dashboard order: `ORDER BY count DESC, lastOccurrence DESC` scoped
--        to userId. No existing index on sort keys — the dashboard is
--        currently scanning-and-sorting per user.
-- ============================================================================

-- ── PreGeneratedQuestion quality filter ────────────────────────────────────
CREATE INDEX IF NOT EXISTS "PreGeneratedQuestion_validationStatus_qualityScore_idx"
  ON "PreGeneratedQuestion" ("validationStatus", "qualityScore");

-- ── PreGeneratedQuestion flag-sweep filter ─────────────────────────────────
CREATE INDEX IF NOT EXISTS "PreGeneratedQuestion_validationStatus_flagCount_idx"
  ON "PreGeneratedQuestion" ("validationStatus", "flagCount");

-- ── Question content-health scan ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Question_lifecycleStatus_contentHealthScore_idx"
  ON "Question" ("lifecycleStatus", "contentHealthScore");

-- ── ConfusionPair dashboard order ──────────────────────────────────────────
-- Index columns mirror the Prisma @@index directive:
--   @@index([userId, count(sort: Desc), lastOccurrence(sort: Desc)])
-- Postgres btree indexes use ASC by default; DESC is specified per-column.
CREATE INDEX IF NOT EXISTS "ConfusionPair_userId_count_lastOccurrence_idx"
  ON "ConfusionPair" ("userId", "count" DESC, "lastOccurrence" DESC);

-- ── Deferred (not in this batch; tracked for Sprint N+1) ───────────────────
-- The audit also flags these as medium-value but out of scope for this
-- migration; they are deferred pending query-frequency check or because they
-- require a partial-index predicate that needs explicit Aaron approval:
--
--   * Question (lifecycleStatus, qaStatus)
--   * PreGeneratedQuestion (system, usedAt) WHERE "usedAt" IS NULL   (partial)
--   * StudentReservoirItem (reservedBy) WHERE "reservedBy" IS NOT NULL (partial)
--   * ReviewLog (review_type, sessionType)
