-- Test the helper function with a sample Markdown
SELECT standardize_markdown_text(
'# Heading
No blank line before
## Another heading
Still messy
**bold* text
- top bullet
  * secondary bullet
escaped newline \n in text
***bold** italic?') AS formatted;

-- Test idempotency: apply twice should give same result
WITH first AS (
    SELECT standardize_markdown_text(
'# Heading
No blank line before
## Another heading
Still messy') AS f
)
SELECT standardize_markdown_text(f) = f AS is_idempotent FROM first;