-- Simple verification of the markdown trigger
BEGIN;

-- Insert a test row with messy markdown
WITH inserted AS (
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
        "etiology"
    ) VALUES (
        gen_random_uuid(),
        'verify-condition-' || gen_random_uuid(),
        'cardiovascular',
        'test',
        'Verification Condition',
        'verification',
        'verification',
        CURRENT_TIMESTAMP,
        '# Heading\nNo blank line before\n\n## Another heading\nStill messy',
        '**bold* text',
        '- top bullet\n  * secondary bullet',
        'escaped newline \\n in text',
        '***bold** italic?'
    )
    RETURNING *
)
SELECT 
    'Transformed columns after INSERT:' as note,
    'complications' as column,
    complications as value,
    'Expected: heading spacing unchanged (limitation)' as expected
FROM inserted
UNION ALL
SELECT 
    '',
    'diagnostics',
    diagnostics,
    'Expected: **bold** text (bold fixed)'
FROM inserted
UNION ALL
SELECT 
    '',
    'differentialDiagnosis',
    differentialDiagnosis,
    'Expected: bullet nesting unchanged (limitation)'
FROM inserted
UNION ALL
SELECT 
    '',
    'epidemiology',
    epidemiology,
    'Expected: escaped newline replaced with actual newline'
FROM inserted
UNION ALL
SELECT 
    '',
    'etiology',
    etiology,
    'Expected: ***bold** → **_bold_** italic?'
FROM inserted;

ROLLBACK;

-- Verify trigger exists
SELECT 
    tgname as trigger_name,
    CASE WHEN tgtype::int & 4 > 0 THEN 'YES' ELSE 'NO' END as fires_on_insert,
    CASE WHEN tgtype::int & 8 > 0 THEN 'YES' ELSE 'NO' END as fires_on_update
FROM pg_trigger
WHERE tgrelid = '"MedicalContent"'::regclass 
  AND tgname = 'medical_content_markdown_trigger';