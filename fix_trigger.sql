-- Fix column case in the trigger function
DROP TRIGGER IF EXISTS medical_content_markdown_trigger ON "MedicalContent";
DROP FUNCTION IF EXISTS standardize_markdown();

CREATE OR REPLACE FUNCTION standardize_markdown()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply to each Markdown column (list derived from the JavaScript script)
    NEW.complications = standardize_markdown_text(NEW.complications);
    NEW.diagnostics = standardize_markdown_text(NEW.diagnostics);
    NEW."differentialDiagnosis" = standardize_markdown_text(NEW."differentialDiagnosis");
    NEW.epidemiology = standardize_markdown_text(NEW.epidemiology);
    NEW.etiology = standardize_markdown_text(NEW.etiology);
    NEW.overview = standardize_markdown_text(NEW.overview);
    NEW.pathophysiology = standardize_markdown_text(NEW.pathophysiology);
    NEW."physicalExam" = standardize_markdown_text(NEW."physicalExam");
    NEW.prognosis = standardize_markdown_text(NEW.prognosis);
    NEW."riskFactors" = standardize_markdown_text(NEW."riskFactors");
    NEW.symptoms = standardize_markdown_text(NEW.symptoms);
    NEW.treatment = standardize_markdown_text(NEW.treatment);
    NEW.first_line_rx = standardize_markdown_text(NEW.first_line_rx);
    NEW.gold_standard_dx = standardize_markdown_text(NEW.gold_standard_dx);
    NEW.best_initial_test = standardize_markdown_text(NEW.best_initial_test);
    NEW.classic_patient = standardize_markdown_text(NEW.classic_patient);
    NEW.disposition = standardize_markdown_text(NEW.disposition);
    NEW.gender_bias = standardize_markdown_text(NEW.gender_bias);
    NEW.guidelines = standardize_markdown_text(NEW.guidelines);
    NEW.image_query = standardize_markdown_text(NEW.image_query);
    NEW.mnemonic = standardize_markdown_text(NEW.mnemonic);
    NEW.patient_education = standardize_markdown_text(NEW.patient_education);
    NEW.prevention = standardize_markdown_text(NEW.prevention);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER medical_content_markdown_trigger
    BEFORE INSERT OR UPDATE ON "MedicalContent"
    FOR EACH ROW
    EXECUTE FUNCTION standardize_markdown();