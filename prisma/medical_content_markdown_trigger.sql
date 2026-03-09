-- PostgreSQL trigger function to standardize Markdown formatting in MedicalContent columns
-- Applied BEFORE INSERT OR UPDATE on the MedicalContent table.
-- Columns: overview, treatment, symptoms, diagnostics, prevention
-- Note: The column 'diagnosis' does not exist in MedicalContent; using 'diagnostics' instead.
-- If you need a different column, adjust accordingly.

-- This trigger uses the existing helper function `standardize_markdown_text` which implements
-- the four required transformations (heading spacing, list standardization, emphasis cleanup,
-- excess whitespace removal). If that function does not exist, it will be created below.

-- First, ensure the helper function exists (copied from migration 20260308220000).
CREATE OR REPLACE FUNCTION standardize_markdown_text(input text)
RETURNS text AS $$
DECLARE
    lines text[];
    i int;
    line text;
    prev_line text;
    next_line text;
    result_lines text[];
    indent_len int;
    bullet_match text[];
    after_bullet text;
    new_bullet text;
BEGIN
    IF input IS NULL THEN
        RETURN NULL;
    END IF;

    -- 1. Replace escaped newline literals '\n' with actual newline
    input = regexp_replace(input, E'\\\\n', E'\n', 'g');

    -- Split into lines
    lines = string_to_array(input, E'\n');
    result_lines = '{}';

    -- 2. Heading spacing: ensure exactly one blank line before and after any heading
    FOR i IN 1 .. array_length(lines, 1) LOOP
        line = lines[i];
        prev_line = CASE WHEN i > 1 THEN lines[i-1] ELSE '' END;
        next_line = CASE WHEN i < array_length(lines, 1) THEN lines[i+1] ELSE '' END;

        IF line ~ E'^#{1,6} ' THEN
            -- Ensure blank line before (unless previous line already blank)
            IF i > 1 AND prev_line !~ E'^\\s*$' THEN
                result_lines = array_append(result_lines, '');
            END IF;
            result_lines = array_append(result_lines, line);
            -- Ensure blank line after (unless next line already blank)
            IF i < array_length(lines, 1) AND next_line !~ E'^\\s*$' THEN
                result_lines = array_append(result_lines, '');
            END IF;
        ELSE
            result_lines = array_append(result_lines, line);
        END IF;
    END LOOP;

    input = array_to_string(result_lines, E'\n');

    -- Collapse multiple blank lines (3 or more) to two
    input = regexp_replace(input, E'\n{3,}', E'\n\n', 'g');

    -- 3. List bullets: convert top‑level bullets to '- ', secondary to '  * '
    lines = string_to_array(input, E'\n');
    result_lines = '{}';

    FOR i IN 1 .. array_length(lines, 1) LOOP
        line = lines[i];
        -- Detect bullet line: optional spaces, then bullet char, then space
        IF line ~ E'^\\s*[-*+•]\\s' THEN
            -- Extract indentation length (number of leading spaces)
            SELECT regexp_matches(line, E'^(\\s*)[-*+•]\\s') INTO bullet_match;
            IF bullet_match IS NOT NULL THEN
                indent_len = COALESCE(char_length(bullet_match[1]), 0);
                -- Determine nesting level (assuming 2 spaces per level)
                CASE indent_len / 2
                    WHEN 0 THEN new_bullet = E'- ';
                    WHEN 1 THEN new_bullet = E'  * ';
                    ELSE new_bullet = repeat(' ', indent_len) || E'- ';
                END CASE;
                after_bullet = substring(line from E'^\\s*[-*+•]\\s(.*)$');
                line = repeat(' ', indent_len) || new_bullet || COALESCE(after_bullet, '');
            END IF;
        END IF;
        result_lines = array_append(result_lines, line);
    END LOOP;

    input = array_to_string(result_lines, E'\n');

    -- 4. Emphasis fixes using E'' strings for proper backslash handling
    -- ***text** → **_text_**
    input = regexp_replace(input, E'\\*\\*\\*([^*]+)\\*\\*', E'**_\\1_**', 'g');
    -- **text* (missing closing *) → **text**
    input = regexp_replace(input, E'\\*\\*([^*]+)\\*', E'**\\1**', 'g');
    -- *text** (missing opening *) → **text**
    input = regexp_replace(input, E'\\*([^*]+)\\*\\*', E'**\\1**', 'g');
    -- __text_ (missing closing _) → __text__
    input = regexp_replace(input, E'__([^_]+)_', E'__\\1__', 'g');
    -- _text__ (missing opening _) → __text__
    input = regexp_replace(input, E'_([^_]+)__', E'__\\1__', 'g');

    RETURN input;
END;
$$ LANGUAGE plpgsql;

-- Now create the requested trigger function that applies the helper to the five columns.
CREATE OR REPLACE FUNCTION standardize_medical_content_markdown()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.overview = standardize_markdown_text(NEW.overview);
    NEW.treatment = standardize_markdown_text(NEW.treatment);
    NEW.symptoms = standardize_markdown_text(NEW.symptoms);
    NEW.diagnostics = standardize_markdown_text(NEW.diagnostics);
    NEW.prevention = standardize_markdown_text(NEW.prevention);
    RETURN NEW;
END;
$$;

-- Create the trigger (replace existing one with the same name if any)
DROP TRIGGER IF EXISTS medical_content_markdown_trigger ON "MedicalContent";
CREATE TRIGGER medical_content_markdown_trigger
    BEFORE INSERT OR UPDATE ON "MedicalContent"
    FOR EACH ROW
    EXECUTE FUNCTION standardize_medical_content_markdown();

-- Optional: add a comment
COMMENT ON FUNCTION standardize_medical_content_markdown() IS 'Enforces consistent Markdown formatting in MedicalContent columns (overview, treatment, symptoms, diagnostics, prevention).';
COMMENT ON FUNCTION standardize_markdown_text(text) IS 'Helper that performs Markdown normalization (heading spacing, list standardization, emphasis cleanup, whitespace collapse).';