-- Add image URL fields to ImagingStudy
ALTER TABLE "ImagingStudy" ADD COLUMN "exampleImageUrls" TEXT[] DEFAULT '{}';
ALTER TABLE "ImagingStudy" ADD COLUMN "annotatedImageUrls" TEXT[] DEFAULT '{}';
ALTER TABLE "ImagingStudy" ADD COLUMN "thumbnailUrl" TEXT;

-- Create junction table for MedicalContent to MediaAsset many-to-many relationship
CREATE TABLE IF NOT EXISTS "MedicalContentMedia" (
    "id" TEXT NOT NULL,
    "medicalContentId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'illustration',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalContentMedia_pkey" PRIMARY KEY ("id")
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "MedicalContentMedia_medicalContentId_idx" ON "MedicalContentMedia"("medicalContentId");
CREATE INDEX IF NOT EXISTS "MedicalContentMedia_mediaAssetId_idx" ON "MedicalContentMedia"("mediaAssetId");
CREATE UNIQUE INDEX IF NOT EXISTS "MedicalContentMedia_medicalContentId_mediaAssetId_key" ON "MedicalContentMedia"("medicalContentId", "mediaAssetId");

-- Add foreign key constraints
ALTER TABLE "MedicalContentMedia" ADD CONSTRAINT "MedicalContentMedia_medicalContentId_fkey" 
    FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicalContentMedia" ADD CONSTRAINT "MedicalContentMedia_mediaAssetId_fkey" 
    FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add imagingStudyId field to MediaAsset for direct linking
ALTER TABLE "MediaAsset" ADD COLUMN "imagingStudyId" TEXT;
CREATE INDEX IF NOT EXISTS "MediaAsset_imagingStudyId_idx" ON "MediaAsset"("imagingStudyId");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_imagingStudyId_fkey" 
    FOREIGN KEY ("imagingStudyId") REFERENCES "ImagingStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
