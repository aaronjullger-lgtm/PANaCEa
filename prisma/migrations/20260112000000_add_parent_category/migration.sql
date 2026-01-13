-- Add parent_category column to Condition table
ALTER TABLE "Condition" ADD COLUMN "parent_category" TEXT;

-- Add parent_category column to MedicalContent table
ALTER TABLE "MedicalContent" ADD COLUMN "parent_category" TEXT;

-- Create indexes for efficient hierarchy queries
CREATE INDEX "Condition_parent_category_idx" ON "Condition"("parent_category");
CREATE INDEX "MedicalContent_parent_category_idx" ON "MedicalContent"("parent_category");

-- Create composite indexes for common hierarchy queries
CREATE INDEX "Condition_system_parent_category_idx" ON "Condition"("system", "parent_category");
CREATE INDEX "Condition_system_subcategory_parent_category_idx" ON "Condition"("system", "subcategory", "parent_category");
CREATE INDEX "MedicalContent_system_parent_category_idx" ON "MedicalContent"("system", "parent_category");
CREATE INDEX "MedicalContent_system_subcategory_parent_category_idx" ON "MedicalContent"("system", "subcategory", "parent_category");
