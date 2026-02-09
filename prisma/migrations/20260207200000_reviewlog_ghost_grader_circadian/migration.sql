-- CreateEnum
CREATE TYPE "CircadianPhase" AS ENUM ('PEAK', 'TROUGH', 'NEUTRAL');

-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN "hover_oscillations" INTEGER;
ALTER TABLE "ReviewLog" ADD COLUMN "vignette_regressions" INTEGER;
ALTER TABLE "ReviewLog" ADD COLUMN "time_to_first_interaction" INTEGER;
ALTER TABLE "ReviewLog" ADD COLUMN "circadian_phase" "CircadianPhase";
