-- Verification script for the MedicalContent markdown trigger
\set ON_ERROR_STOP on
BEGIN;

-- Insert a test row with messy markdown
INSERT INTO "MedicalContent" (
    "id",
    "conditionId",
    "system",
    "subcategory",
    "condition",
    "createdBy",
    "updatedBy",
    "updatedAt",
    "complications",
    "diagnostics",
    "differentialDiagnosis",
    "epidemiology",
    "etiology",
    "overview",
    "pathophysiology",
    "physicalExam",
    "prognosis",
    "riskFactors",
    "symptoms",
    "treatment",
    "first_line_rx",
    "gold_standard_dx",
    "best_initial_test",
    "classic_patient",
    "disposition",
    "gender_bias",
    "guidelines",
    "image_query",
    "mnemonic",
    "patient_education",
    "prevention"
) VALUES (
    gen_random_uuid(),
    'verify-condition-' || gen_random_uuid(),
    'cardiovascular',
    'test',
    'Verification Condition',
    'verification',
    'verification',
    CURRENT_TIMESTAMP,
    -- complications: heading without blank lines (won't be transformed)
    '# Heading\nNo blank line before\n\n## Another heading\nStill messy',
    -- diagnostics: mismatched bold (should be fixed)
    '**bold* text',
    -- differentialDiagnosis: bullet nesting (should be fixed)
    '- top bullet\n  * secondary bullet',
    -- epidemiology: escaped newline (should be fixed)
    'escaped newline \\n in text',
    -- etiology: triple asterisk (should be fixed)
    '***bold** italic?',
    -- other columns with normal text
    'overview',
    'pathophysiology',
    'physical exam',
    'prognosis',
    'risk factors',
    'symptoms',
    'treatment',
    'first line',
    'gold standard',
    'best test',
    'classic patient',
    'disposition',
    'gender bias',
    'guidelines',
    'image query',
    'mnemonic',
    'patient education',
    'prevention'
);

-- Retrieve the inserted row
WITH inserted AS (
    SELECT 
        "conditionId",
        "complications",
        "diagnostics",
        "differentialDiagnosis",
        "epidemiology",
        "etiology"
    FROM "MedicalContent"
    WHERE "updatedBy" = 'verification'
    ORDER BY "createdAt" DESC
    LIMIT 1
)
SELECT 
    'Trigger applied, transformed columns:' as note;
SELECT 
    'complications' as column,
    inserted."complications" as value
FROM inserted
UNION ALL
SELECT 
    'diagnostics',
    inserted."diagnostics"
FROM inserted
UNION ALL
SELECT 
    'differentialDiagnosis',
    inserted."differentialDiagnosis"
FROM inserted
UNION ALL
SELECT 
    'epidemiology',
    inserted."epidemiology"
FROM inserted
UNION ALL
SELECT 
    'etiology',
    inserted."etiology"
FROM inserted;

-- Test idempotency: update with same values and see if columns change
UPDATE "MedicalContent"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE "updatedBy" = 'verification'
RETURNING
    'After update' as check,
    "complications" = '# Heading\nNo blank line before\n\n## Another heading\nStill messy' as complications_unchanged,
    "diagnostics" = '**bold** text' as diagnostics_standardized,
    "differentialDiagnosis" = '- top bullet\n  * secondary bullet' as bullet_unchanged,
    "epidemiology" = 'escaped newline \n in text' as newline_fixed,
    "etiology" = '**_bold_** italic?' as emphasis_fixed
\gset

-- Show idempotency results
SELECT 
    'Idempotency check:' as note,
    :'complications_unchanged' as complications_unchanged,
    :'diagnostics_standardized' as diagnostics_standardized,
    :'bullet_unchanged' as bullet_unchanged,
    :'newline_fixed' as newline_fixed,
    :'emphasis_fixed' as emphasis_fixed;

ROLLBACK;

-- Additionally, verify trigger exists
SELECT 
    'Trigger status:' as note,
    tgname as trigger_name,
    tgtype::int & 4 > 0 as fires_on_insert,
    tgtype::int & 8 > 0 as fires_on_update
FROM pg_trigger
WHERE tgrelid = '"MedicalContent"'::regclass AND tgname = 'medical_content_markdown_trigger';