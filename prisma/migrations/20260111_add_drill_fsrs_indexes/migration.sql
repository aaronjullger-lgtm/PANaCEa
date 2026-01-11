-- Performance Optimization: Drill Generation & FSRS Lookup Indexes
-- Task: Backend Performance Engineer - Edge Caching & Database Indexing

-- ============================================================================
-- DRILL GENERATION INDEXES
-- ============================================================================

-- MedicalContent: system + pance_yield (difficulty)
-- Used by drill generation to filter questions by system and difficulty level
-- Composite index improves query performance for: WHERE system = ? AND pance_yield = ?
CREATE INDEX IF NOT EXISTS "MedicalContent_system_pance_yield_idx" 
  ON "MedicalContent"("system", "pance_yield");

-- ============================================================================
-- FSRS (Spaced Repetition) INDEXES
-- ============================================================================

-- UserProgress: userId + conditionId
-- Used by FSRS lookups to fetch user's progress for specific content
-- Composite index improves query performance for: WHERE userId = ? AND conditionId = ?
-- Note: This is in addition to the existing UNIQUE constraint which already creates an index
-- The explicit composite index here ensures optimal query planning for lookups
CREATE INDEX IF NOT EXISTS "UserProgress_userId_conditionId_idx" 
  ON "UserProgress"("userId", "conditionId");
