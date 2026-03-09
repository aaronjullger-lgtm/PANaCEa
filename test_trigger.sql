-- Test the markdown standardization trigger
BEGIN;

-- Insert a row with messy Markdown in various columns
INSERT INTO "MedicalContent" (
    "id",
    "conditionId",
    "system",
    "subcategory",
    "condition",
    "createdBy",
    "updatedBy",
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
    'test-condition-123',
    'cardiovascular',
    'test',
    'Test Condition',
    'trigger-test',
    'trigger-test',
    -- complications: heading without blank lines
    '# Heading\nNo blank line before\n\n## Another heading\nStill messy',
    -- diagnostics: mismatched bold
    '**bold* text',
    -- differentialDiagnosis: bullet nesting
    '- top bullet\n  * secondary bullet',
    -- epidemiology: escaped newline
    'escaped newline \\n in text',
    -- etiology: triple asterisk
    '***bold** italic?',
    -- overview: normal text
    'overview',
    -- pathophysiology: normal text
    'pathophysiology',
    -- physicalExam: normal text
    'physical exam',
    -- prognosis: normal text
    'prognosis',
    -- riskFactors: normal text
    'risk factors',
    -- symptoms: normal text
    'symptoms',
    -- treatment: normal text
    'treatment',
    -- first_line_rx: normal text
    'first line',
    -- gold_standard_dx: normal text
    'gold standard',
    -- best_initial_test: normal text
    'best test',
    -- classic_patient: normal text
    'classic patient',
    -- disposition: normal text
    'disposition',
    -- gender_bias: normal text
    'gender bias',
    -- guidelines: normal text
    'guidelines',
    -- image_query: normal text
    'image query',
    -- mnemonic: normal text
    'mnemonic',
    -- patient_education: normal text
    'patient education',
    -- prevention: normal text
    'prevention'
);

-- Retrieve the inserted row to see the standardized values
SELECT 
    "conditionId",
    "complications",
    "diagnostics",
    "differentialDiagnosis",
    "epidemiology",
    "etiology"
FROM "MedicalContent"
WHERE "conditionId" = 'test-condition-123';

ROLLBACK;