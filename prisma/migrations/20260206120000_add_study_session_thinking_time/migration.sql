-- Add thinkingTimeMs to StudySession for Gemini 3 Deep Think Tutor latency logging
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "thinkingTimeMs" INTEGER;
