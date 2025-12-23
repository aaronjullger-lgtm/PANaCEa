-- AlterTable
ALTER TABLE "MedicalContent" ADD COLUMN     "classic_triad" JSONB,
ADD COLUMN     "clinical_pearls" JSONB,
ADD COLUMN     "first_line_rx" TEXT,
ADD COLUMN     "gold_standard_dx" TEXT;
