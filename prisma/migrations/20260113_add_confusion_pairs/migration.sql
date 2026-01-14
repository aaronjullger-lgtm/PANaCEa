-- ConfusionPair enhancements: link to MedicalContent and add unique key
-- Note: existing data assumed valid; adjust/clean before applying if needed.

ALTER TABLE "ConfusionPair"
  ADD COLUMN IF NOT EXISTS "correctConditionId" TEXT,
  ADD COLUMN IF NOT EXISTS "selectedConditionId" TEXT;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS "ConfusionPair_correctConditionId_idx" ON "ConfusionPair" ("correctConditionId");
CREATE INDEX IF NOT EXISTS "ConfusionPair_selectedConditionId_idx" ON "ConfusionPair" ("selectedConditionId");

-- Unique constraint for user + precise pair
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConfusionPair_userId_correctConditionId_selectedConditionId_key'
  ) THEN
    ALTER TABLE "ConfusionPair"
      ADD CONSTRAINT "ConfusionPair_userId_correctConditionId_selectedConditionId_key"
      UNIQUE ("userId", "correctConditionId", "selectedConditionId");
  END IF;
END$$;

-- Foreign keys to MedicalContent (set null on delete to preserve history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConfusionPair_correctConditionId_fkey'
  ) THEN
    ALTER TABLE "ConfusionPair"
      ADD CONSTRAINT "ConfusionPair_correctConditionId_fkey"
      FOREIGN KEY ("correctConditionId") REFERENCES "MedicalContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConfusionPair_selectedConditionId_fkey'
  ) THEN
    ALTER TABLE "ConfusionPair"
      ADD CONSTRAINT "ConfusionPair_selectedConditionId_fkey"
      FOREIGN KEY ("selectedConditionId") REFERENCES "MedicalContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
