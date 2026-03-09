-- AlterTable
ALTER TABLE "AnatomyStructure" ADD COLUMN     "anatomyModelId" TEXT;

-- AlterTable
ALTER TABLE "Drug" ADD COLUMN     "interactionsJsonb" JSONB,
ADD COLUMN     "sideEffectsJsonb" JSONB;

-- DropTable
DROP TABLE "medical_content_backup_20250308";

-- CreateTable
CREATE TABLE "AnatomyModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "citation" TEXT,
    "structures" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomyModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugSideEffect" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "visualization" TEXT,
    "description" TEXT,

    CONSTRAINT "DrugSideEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalContentStructured" (
    "id" TEXT NOT NULL,
    "medicalContentId" TEXT NOT NULL,
    "clinical_pearls" TEXT[],
    "history_key_features" TEXT[],
    "physical_exam_findings" TEXT[],
    "diagnostic_labs" TEXT[],
    "gold_standard" TEXT,
    "treatment_first_line" TEXT,
    "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" TEXT NOT NULL DEFAULT 'gemini‑1.5‑pro',
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "MedicalContentStructured_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alias" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyModel_name_key" ON "AnatomyModel"("name");

-- CreateIndex
CREATE INDEX "AnatomyModel_system_idx" ON "AnatomyModel"("system");

-- CreateIndex
CREATE INDEX "DrugSideEffect_drugId_idx" ON "DrugSideEffect"("drugId");

-- CreateIndex
CREATE INDEX "DrugSideEffect_severity_idx" ON "DrugSideEffect"("severity");

-- CreateIndex
CREATE INDEX "DrugSideEffect_system_idx" ON "DrugSideEffect"("system");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalContentStructured_medicalContentId_key" ON "MedicalContentStructured"("medicalContentId");

-- CreateIndex
CREATE INDEX "MedicalContentStructured_medicalContentId_idx" ON "MedicalContentStructured"("medicalContentId");

-- CreateIndex
CREATE INDEX "Alias_entityType_entityId_idx" ON "Alias"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Alias_alias_idx" ON "Alias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_entityType_entityId_alias_key" ON "Alias"("entityType", "entityId", "alias");

-- AddForeignKey
ALTER TABLE "AnatomyStructure" ADD CONSTRAINT "AnatomyStructure_anatomyModelId_fkey" FOREIGN KEY ("anatomyModelId") REFERENCES "AnatomyModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugSideEffect" ADD CONSTRAINT "DrugSideEffect_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalContentStructured" ADD CONSTRAINT "MedicalContentStructured_medicalContentId_fkey" FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;