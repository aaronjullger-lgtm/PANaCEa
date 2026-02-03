-- Add implicitConfidence to QuestionAttempt for metacognition / Calibration (Illusion of Competence)
-- 0-1; high+right=mastered, high+wrong=dangerous, low+right=lucky, low+wrong=unconfident
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "implicitConfidence" DOUBLE PRECISION;

COMMENT ON COLUMN "QuestionAttempt"."implicitConfidence" IS '0-1 implicit confidence from behavior; used for calibration quadrants (mastered, dangerous misconception, lucky guess, unconfident wrong)';
