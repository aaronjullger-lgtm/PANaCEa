-- Replace the helper function with corrected regex and logic
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