-- Migration: Add Full-Text Search to MedicalContent
-- This migration adds PostgreSQL full-text search capabilities to the MedicalContent table

-- Step 1: Add search_vector column
ALTER TABLE "MedicalContent" ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Step 2: Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_medical_content_search ON "MedicalContent" USING GIN(search_vector);

-- Step 3: Create function to update search vector
CREATE OR REPLACE FUNCTION update_medical_content_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    -- Condition name (highest weight - A)
    setweight(to_tsvector('english', COALESCE(NEW.condition, '')), 'A') ||
    
    -- Buzzwords (highest weight - A)
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.buzzwords, ' '), '')), 'A') ||
    
    -- Classic patient presentation (high weight - B)
    setweight(to_tsvector('english', COALESCE(NEW.classic_patient, '')), 'B') ||
    
    -- Symptoms (high weight - B)
    setweight(to_tsvector('english', COALESCE(NEW.symptoms, '')), 'B') ||
    
    -- Gold standard diagnosis (high weight - B)
    setweight(to_tsvector('english', COALESCE(NEW.gold_standard_dx, '')), 'B') ||
    
    -- First line treatment (high weight - B)
    setweight(to_tsvector('english', COALESCE(NEW.first_line_rx, '')), 'B') ||
    
    -- Overview (medium weight - C)
    setweight(to_tsvector('english', COALESCE(NEW.overview, '')), 'C') ||
    
    -- Diagnostics (medium weight - C)
    setweight(to_tsvector('english', COALESCE(NEW.diagnostics, '')), 'C') ||
    
    -- Treatment (medium weight - C)
    setweight(to_tsvector('english', COALESCE(NEW.treatment, '')), 'C') ||
    
    -- Pathophysiology (low weight - D)
    setweight(to_tsvector('english', COALESCE(NEW.pathophysiology, '')), 'D') ||
    
    -- Etiology (low weight - D)
    setweight(to_tsvector('english', COALESCE(NEW.etiology, '')), 'D');
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to auto-update search_vector on INSERT or UPDATE
DROP TRIGGER IF EXISTS trig_update_medical_content_search_vector ON "MedicalContent";
CREATE TRIGGER trig_update_medical_content_search_vector
  BEFORE INSERT OR UPDATE ON "MedicalContent"
  FOR EACH ROW EXECUTE FUNCTION update_medical_content_search_vector();

-- Step 5: Populate search_vector for existing records
UPDATE "MedicalContent" SET search_vector = 
  -- Condition name (highest weight - A)
  setweight(to_tsvector('english', COALESCE(condition, '')), 'A') ||
  
  -- Buzzwords (highest weight - A)
  setweight(to_tsvector('english', COALESCE(array_to_string(buzzwords, ' '), '')), 'A') ||
  
  -- Classic patient presentation (high weight - B)
  setweight(to_tsvector('english', COALESCE(classic_patient, '')), 'B') ||
  
  -- Symptoms (high weight - B)
  setweight(to_tsvector('english', COALESCE(symptoms, '')), 'B') ||
  
  -- Gold standard diagnosis (high weight - B)
  setweight(to_tsvector('english', COALESCE(gold_standard_dx, '')), 'B') ||
  
  -- First line treatment (high weight - B)
  setweight(to_tsvector('english', COALESCE(first_line_rx, '')), 'B') ||
  
  -- Overview (medium weight - C)
  setweight(to_tsvector('english', COALESCE(overview, '')), 'C') ||
  
  -- Diagnostics (medium weight - C)
  setweight(to_tsvector('english', COALESCE(diagnostics, '')), 'C') ||
  
  -- Treatment (medium weight - C)
  setweight(to_tsvector('english', COALESCE(treatment, '')), 'C') ||
  
  -- Pathophysiology (low weight - D)
  setweight(to_tsvector('english', COALESCE(pathophysiology, '')), 'D') ||
  
  -- Etiology (low weight - D)
  setweight(to_tsvector('english', COALESCE(etiology, '')), 'D')
WHERE search_vector IS NULL;

-- Create helper function for search queries
CREATE OR REPLACE FUNCTION search_medical_content(
  search_query text,
  max_results integer DEFAULT 20
)
RETURNS TABLE (
  id text,
  condition text,
  system text,
  rank real,
  headline text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.condition,
    mc.system,
    ts_rank(mc.search_vector, websearch_to_tsquery('english', search_query)) AS rank,
    ts_headline('english', 
      COALESCE(mc.overview, mc.symptoms, mc.classic_patient, ''),
      websearch_to_tsquery('english', search_query),
      'MaxWords=50, MinWords=20, ShortWord=3, HighlightAll=FALSE, MaxFragments=1'
    ) AS headline
  FROM "MedicalContent" mc
  WHERE mc.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN "MedicalContent".search_vector IS 'Full-text search vector with weighted terms. Auto-updated via trigger.';
COMMENT ON FUNCTION search_medical_content IS 'Search medical content using PostgreSQL full-text search. Returns ranked results with headlines.';
