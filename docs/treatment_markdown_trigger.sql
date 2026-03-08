-- PostgreSQL trigger function to standardize Markdown formatting in Treatment.description
-- Applied BEFORE INSERT OR UPDATE on the Treatment table.
-- Uses the existing helper function `standardize_markdown_text` (must exist).
-- If the helper does not exist, run medical_content_markdown_trigger.sql first.

-- Create the trigger function for Treatment
CREATE OR REPLACE FUNCTION standardize_treatment_markdown()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Apply Markdown standardization to the description column
    NEW.description = standardize_markdown_text(NEW.description);
    -- Optionally add other columns that may contain Markdown:
    -- NEW.clinicalPearls = standardize_markdown_text(NEW.clinicalPearls);
    -- NEW.commonMistakes = standardize_markdown_text(NEW.commonMistakes);
    -- NEW.testQuestionTips = standardize_markdown_text(NEW.testQuestionTips);
    RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS treatment_markdown_trigger ON "Treatment";

-- Create the trigger
CREATE TRIGGER treatment_markdown_trigger
    BEFORE INSERT OR UPDATE ON "Treatment"
    FOR EACH ROW
    EXECUTE FUNCTION standardize_treatment_markdown();

-- Add a comment
COMMENT ON FUNCTION standardize_treatment_markdown() IS 'Enforces consistent Markdown formatting in Treatment.description column.';
COMMENT ON TRIGGER treatment_markdown_trigger ON "Treatment" IS 'Trigger that normalizes Markdown in description before insert/update.';