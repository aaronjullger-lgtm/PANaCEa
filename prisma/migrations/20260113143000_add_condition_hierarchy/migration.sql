-- AlterTable
ALTER TABLE "MedicalContent" ADD COLUMN "parentId" TEXT,
ADD COLUMN "relationshipType" TEXT,
ADD COLUMN "canonicalName" TEXT;

-- CreateIndex
CREATE INDEX "MedicalContent_parentId_idx" ON "MedicalContent"("parentId");

-- CreateIndex
CREATE INDEX "MedicalContent_canonicalName_idx" ON "MedicalContent"("canonicalName");

-- AddForeignKey
ALTER TABLE "MedicalContent" ADD CONSTRAINT "MedicalContent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MedicalContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
