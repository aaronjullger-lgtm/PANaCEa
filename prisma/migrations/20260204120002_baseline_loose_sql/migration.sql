-- Consolidated migration: applies DDL from loose SQL files (add_fulltext_search, add_guideline_table, add_platform_statistics, add_user_statistics).
-- All statements are idempotent (IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO NOTHING) so safe if already applied.

-- =============================================================================
-- Full-text search (from add_fulltext_search.sql)
-- =============================================================================
ALTER TABLE "MedicalContent" ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_medical_content_search ON "MedicalContent" USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_medical_content_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.condition, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.buzzwords, ' '), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.classic_patient, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.symptoms, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.gold_standard_dx, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.first_line_rx, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.overview, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.diagnostics, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.treatment, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.pathophysiology, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.etiology, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_update_medical_content_search_vector ON "MedicalContent";
CREATE TRIGGER trig_update_medical_content_search_vector
  BEFORE INSERT OR UPDATE ON "MedicalContent"
  FOR EACH ROW EXECUTE FUNCTION update_medical_content_search_vector();

UPDATE "MedicalContent" SET search_vector =
  setweight(to_tsvector('english', COALESCE(condition, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(buzzwords, ' '), '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(classic_patient, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(symptoms, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(gold_standard_dx, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(first_line_rx, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(overview, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(diagnostics, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(treatment, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(pathophysiology, '')), 'D') ||
  setweight(to_tsvector('english', COALESCE(etiology, '')), 'D')
WHERE search_vector IS NULL;

CREATE OR REPLACE FUNCTION search_medical_content(
  search_query text,
  max_results integer DEFAULT 20
)
RETURNS TABLE (
  id text,
  condition text,
  system text,
  rank real,
  headline text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.condition,
    mc.system,
    ts_rank(mc.search_vector, websearch_to_tsquery('english', search_query)) AS rank,
    ts_headline('english',
      COALESCE(mc.overview, mc.symptoms, mc.classic_patient, ''),
      websearch_to_tsquery('english', search_query),
      'MaxWords=50, MinWords=20, ShortWord=3, HighlightAll=FALSE, MaxFragments=1'
    ) AS headline
  FROM "MedicalContent" mc
  WHERE mc.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Guideline table and seed data (from add_guideline_table.sql)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Guideline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "organization" TEXT,
  "conditionId" TEXT,
  "criteria" JSONB,
  "grade" TEXT,
  "frequency" TEXT,
  "targetPopulation" TEXT,
  "evidenceLevel" TEXT,
  "panceYield" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Guideline_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Guideline_type_idx" ON "Guideline" ("type");
CREATE INDEX IF NOT EXISTS "Guideline_organization_idx" ON "Guideline" ("organization");
CREATE INDEX IF NOT EXISTS "Guideline_panceYield_idx" ON "Guideline" ("panceYield");
CREATE INDEX IF NOT EXISTS "Guideline_conditionId_idx" ON "Guideline" ("conditionId");

INSERT INTO "Guideline" ("id", "name", "type", "organization", "grade", "targetPopulation", "frequency", "panceYield", "createdAt", "updatedAt")
VALUES
  ('guideline_screening_lung_cancer', 'Lung Cancer Screening', 'screening', 'USPSTF', 'B', 'Adults aged 50-80 years with 20 pack-year smoking history', 'Annual low-dose CT', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guideline_screening_aaa', 'Abdominal Aortic Aneurysm Screening', 'screening', 'USPSTF', 'B', 'Men aged 65-75 who have ever smoked', 'One-time ultrasound', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guideline_screening_colorectal', 'Colorectal Cancer Screening', 'screening', 'USPSTF', 'A', 'Adults aged 45-75 years', 'Colonoscopy every 10 years or FIT annually', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('guideline_screening_osteoporosis', 'Osteoporosis Screening', 'screening', 'USPSTF', 'B', 'Women ≥65 years or postmenopausal women <65 at increased risk', 'DEXA scan', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- =============================================================================
-- Platform and user statistics tables (from add_platform_statistics.sql, add_user_statistics.sql)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "PlatformStatistics" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "dau" INTEGER NOT NULL DEFAULT 0,
  "wau" INTEGER NOT NULL DEFAULT 0,
  "mau" INTEGER NOT NULL DEFAULT 0,
  "newUsers" INTEGER NOT NULL DEFAULT 0,
  "returningUsers" INTEGER NOT NULL DEFAULT 0,
  "retention7Day" DECIMAL(5,4),
  "retention30Day" DECIMAL(5,4),
  "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
  "questionsCorrect" INTEGER NOT NULL DEFAULT 0,
  "questionsIncorrect" INTEGER NOT NULL DEFAULT 0,
  "averageAccuracy" DECIMAL(5,4),
  "sessionsStarted" INTEGER NOT NULL DEFAULT 0,
  "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
  "averageSessionDuration" INTEGER,
  "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsReviewed" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsMature" INTEGER NOT NULL DEFAULT 0,
  "fsrsAverageRetention" DECIMAL(5,4),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformStatistics_date_idx" ON "PlatformStatistics"("date");
CREATE INDEX IF NOT EXISTS "PlatformStatistics_dau_idx" ON "PlatformStatistics"("dau");
CREATE INDEX IF NOT EXISTS "PlatformStatistics_createdAt_idx" ON "PlatformStatistics"("createdAt");

CREATE TABLE IF NOT EXISTS "ContentStatistics" (
  "id" TEXT PRIMARY KEY,
  "conditionId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
  "questionsCorrect" INTEGER NOT NULL DEFAULT 0,
  "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
  "averageAccuracy" DECIMAL(5,4),
  "averageTimeSpent" INTEGER,
  "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
  "flagCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conditionId") REFERENCES "MedicalContent"("conditionId") ON DELETE CASCADE,
  UNIQUE("conditionId", "date")
);

CREATE INDEX IF NOT EXISTS "ContentStatistics_conditionId_idx" ON "ContentStatistics"("conditionId");
CREATE INDEX IF NOT EXISTS "ContentStatistics_date_idx" ON "ContentStatistics"("date");
CREATE INDEX IF NOT EXISTS "ContentStatistics_views_idx" ON "ContentStatistics"("views");
CREATE INDEX IF NOT EXISTS "ContentStatistics_questionsAnswered_idx" ON "ContentStatistics"("questionsAnswered");
CREATE INDEX IF NOT EXISTS "ContentStatistics_uniqueUsers_idx" ON "ContentStatistics"("uniqueUsers");

CREATE TABLE IF NOT EXISTS "UserStatisticsSnapshot" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "snapshotDate" DATE NOT NULL,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "correctAnswers" INTEGER NOT NULL DEFAULT 0,
  "accuracy" DECIMAL(5,4),
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
  "conditionsMastered" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsTotal" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsMature" INTEGER NOT NULL DEFAULT 0,
  "fsrsAverageRetention" DECIMAL(5,4),
  "weakestSystem" TEXT,
  "strongestSystem" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE("userId", "snapshotDate")
);

CREATE INDEX IF NOT EXISTS "UserStatisticsSnapshot_userId_idx" ON "UserStatisticsSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "UserStatisticsSnapshot_snapshotDate_idx" ON "UserStatisticsSnapshot"("snapshotDate");
CREATE INDEX IF NOT EXISTS "UserStatisticsSnapshot_accuracy_idx" ON "UserStatisticsSnapshot"("accuracy");

CREATE TABLE IF NOT EXISTS "UserStatistics" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "correctAnswers" INTEGER NOT NULL DEFAULT 0,
  "avgTimePerQuestion" DOUBLE PRECISION,
  "systemStats" JSONB,
  "rushedSystems" TEXT[] NOT NULL DEFAULT '{}',
  "overthinkingSystems" TEXT[] NOT NULL DEFAULT '{}',
  "diagnosisBias" JSONB,
  "strongestSystems" TEXT[] NOT NULL DEFAULT '{}',
  "weakestSystems" TEXT[] NOT NULL DEFAULT '{}',
  "peakStudyHours" INTEGER[] NOT NULL DEFAULT '{}',
  "avgSessionLength" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE "UserStatistics" ADD CONSTRAINT "UserStatistics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "UserStatistics_userId_idx" ON "UserStatistics"("userId");

ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "systemsTargeted" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "sessionType" TEXT;
