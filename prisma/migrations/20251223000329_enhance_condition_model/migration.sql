-- AlterTable
ALTER TABLE "Condition" ADD COLUMN     "relatedSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN     "subcategory" TEXT;

-- CreateIndex
CREATE INDEX "Condition_status_idx" ON "Condition"("status");

-- CreateIndex
CREATE INDEX "Condition_subcategory_idx" ON "Condition"("subcategory");
