-- Add taskType to SavedQuestion for Due Cards sibling lookup (concept + task category)
ALTER TABLE "SavedQuestion" ADD COLUMN IF NOT EXISTS "taskType" TEXT;

-- Index for sibling lookup: same condition + task, exclude original question
CREATE INDEX IF NOT EXISTS "SavedQuestion_conditionId_taskType_idx" ON "SavedQuestion"("conditionId", "taskType");
