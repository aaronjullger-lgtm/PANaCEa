-- Add fsrs_weights to User for denormalized FSRS v6 parameters (21 params)
-- Empty array = use defaults. Populated by nightly FSRS optimization job.
ALTER TABLE "User" ADD COLUMN "fsrs_weights" DOUBLE PRECISION[] NOT NULL DEFAULT '{}';
