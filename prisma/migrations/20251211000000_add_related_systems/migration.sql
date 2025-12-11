-- AlterTable: Add relatedSystems array field to MedicalContent
-- This enables conditions like Sarcoidosis to appear in multiple system quizzes
-- while maintaining a single source of truth

ALTER TABLE "MedicalContent" 
ADD COLUMN IF NOT EXISTS "relatedSystems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index on relatedSystems for efficient multi-system queries
CREATE INDEX IF NOT EXISTS "MedicalContent_relatedSystems_idx" 
ON "MedicalContent" USING GIN ("relatedSystems");

-- Update comment on system column to clarify it's the primary system
COMMENT ON COLUMN "MedicalContent"."system" IS 'Primary system code (CV, PULM, GI, etc.)';
COMMENT ON COLUMN "MedicalContent"."relatedSystems" IS 'Array of additional system codes this condition is relevant for (e.g., Sarcoidosis in PULM with relatedSystems: [DERM, HEENT])';
