-- Create Guidelines table for screening/prevention recommendations
CREATE TABLE IF NOT EXISTS "Guideline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- 'screening', 'prevention', 'treatment'
  "organization" TEXT, -- 'USPSTF', 'AHA', 'IDSA', etc.
  "conditionId" TEXT,
  "criteria" JSONB, -- age, risk factors, frequency
  "grade" TEXT, -- A, B, C, D, I (USPSTF grading)
  "frequency" TEXT,
  "targetPopulation" TEXT,
  "evidenceLevel" TEXT,
  "panceYield" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Guideline_conditionId_fkey" FOREIGN KEY ("conditionId") 
    REFERENCES "Condition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Guideline_type_idx" ON "Guideline" ("type");
CREATE INDEX IF NOT EXISTS "Guideline_organization_idx" ON "Guideline" ("organization");
CREATE INDEX IF NOT EXISTS "Guideline_panceYield_idx" ON "Guideline" ("panceYield");
CREATE INDEX IF NOT EXISTS "Guideline_conditionId_idx" ON "Guideline" ("conditionId");

-- Insert the 4 orphaned screening guidelines
INSERT INTO "Guideline" ("id", "name", "type", "organization", "grade", "targetPopulation", "frequency", "panceYield", "createdAt", "updatedAt")
VALUES
  (
    'guideline_screening_lung_cancer',
    'Lung Cancer Screening',
    'screening',
    'USPSTF',
    'B',
    'Adults aged 50-80 years with 20 pack-year smoking history',
    'Annual low-dose CT',
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'guideline_screening_aaa',
    'Abdominal Aortic Aneurysm Screening',
    'screening',
    'USPSTF',
    'B',
    'Men aged 65-75 who have ever smoked',
    'One-time ultrasound',
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'guideline_screening_colorectal',
    'Colorectal Cancer Screening',
    'screening',
    'USPSTF',
    'A',
    'Adults aged 45-75 years',
    'Colonoscopy every 10 years or FIT annually',
    5,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'guideline_screening_osteoporosis',
    'Osteoporosis Screening',
    'screening',
    'USPSTF',
    'B',
    'Women ≥65 years or postmenopausal women <65 at increased risk',
    'DEXA scan',
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
