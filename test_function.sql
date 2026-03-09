-- Test the helper function with sample inputs
SELECT 'Heading spacing' as test,
    standardize_markdown_text('# Heading\nNo blank line before\n\n## Another heading\nStill messy') as result;

SELECT 'Mismatched bold' as test,
    standardize_markdown_text('**bold* text') as result;

SELECT 'Bullet nesting' as test,
    standardize_markdown_text('- top bullet\n  * secondary bullet') as result;

SELECT 'Escaped newline' as test,
    standardize_markdown_text('escaped newline \\n in text') as result;

SELECT 'Triple asterisk' as test,
    standardize_markdown_text('***bold** italic?') as result;