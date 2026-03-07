-- Add EOR and rotation date columns to User for EOR module (time-blocked FSRS, profile persistence)
ALTER TABLE "User" ADD COLUMN "eorTestDate" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "rotationStartDate" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "rotationEndDate" TIMESTAMP(3);
