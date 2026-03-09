-- Test the updated helper function with sample inputs
SELECT 'Heading spacing' as test,
    standardize_markdown_text('# Heading\nNo blank line before\n\n## Another heading\nStill messy') as result,
    standardize_markdown_text('# Heading\nNo blank line before\n\n## Another heading\nStill messy') = '# Heading\n\nNo blank line before\n\n## Another heading\n\nStill messy' as pass;

SELECT 'Mismatched bold' as test,
    standardize_markdown_text('**bold* text') as result,
    standardize_markdown_text('**bold* text') = '**bold** text' as pass;

SELECT 'Bullet nesting' as test,
    standardize_markdown_text('- top bullet\n  * secondary bullet') as result,
    standardize_markdown_text('- top bullet\n  * secondary bullet') = '- top bullet\n  * secondary bullet' as pass;

SELECT 'Escaped newline' as test,
    standardize_markdown_text('escaped newline \\n in text') as result,
    standardize_markdown_text('escaped newline \\n in text') = 'escaped newline \n in text' as pass;

SELECT 'Triple asterisk' as test,
    standardize_markdown_text('***bold** italic?') as result,
    standardize_markdown_text('***bold** italic?') = '**_bold_** italic?' as pass;