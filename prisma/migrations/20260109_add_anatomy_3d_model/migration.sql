-- CreateEnum
CREATE TYPE "AnatomySystem3D" AS ENUM (
  'SKELETAL',
  'MUSCULAR',
  'NERVOUS',
  'CARDIOVASCULAR',
  'RESPIRATORY',
  'DIGESTIVE',
  'REPRODUCTIVE',
  'ENDOCRINE',
  'LYMPHATIC',
  'INTEGUMENTARY',
  'URINARY'
);

-- CreateTable
CREATE TABLE "Anatomy3DModel" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayName" TEXT,
  "description" TEXT,
  "system" "AnatomySystem3D" NOT NULL,
  
  -- File URLs (hosted on Supabase Storage)
  "fileUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "format" TEXT NOT NULL DEFAULT 'glb',
  "fileSize" INTEGER,
  "isCompressed" BOOLEAN NOT NULL DEFAULT false,
  
  -- Auto-focus camera position for this model
  "cameraPosition" JSONB,
  "cameraTarget" JSONB,
  "defaultZoom" DOUBLE PRECISION DEFAULT 1.0,
  
  -- Educational metadata
  "structures" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "highlightableRegions" JSONB,
  "clinicalPearls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "clinicalRelevance" TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Citation/Attribution
  "sourceId" TEXT,
  "sourceName" TEXT DEFAULT 'NIH 3D Print Exchange',
  "sourceUrl" TEXT,
  "license" TEXT DEFAULT 'Public Domain',
  "author" TEXT,
  "institution" TEXT,
  
  -- Status and quality
  "status" TEXT NOT NULL DEFAULT 'pending',
  "qualityScore" DOUBLE PRECISION,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  
  -- High-yield metadata
  "isHighYield" BOOLEAN NOT NULL DEFAULT false,
  "panceYield" INTEGER,
  "boardYieldFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Timestamps
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Anatomy3DModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Junction for linking 3D models to conditions
CREATE TABLE "Anatomy3DModelConditionLink" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "anatomyStructureId" TEXT,
  "clinicalContext" TEXT,
  "viewingHint" TEXT,
  "highlightRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Anatomy3DModelConditionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Anatomy3DModel_name_key" ON "Anatomy3DModel"("name");
CREATE INDEX "Anatomy3DModel_system_idx" ON "Anatomy3DModel"("system");
CREATE INDEX "Anatomy3DModel_status_idx" ON "Anatomy3DModel"("status");
CREATE INDEX "Anatomy3DModel_isHighYield_idx" ON "Anatomy3DModel"("isHighYield");
CREATE INDEX "Anatomy3DModel_panceYield_idx" ON "Anatomy3DModel"("panceYield");

CREATE UNIQUE INDEX "Anatomy3DModelConditionLink_modelId_conditionId_key" ON "Anatomy3DModelConditionLink"("modelId", "conditionId");
CREATE INDEX "Anatomy3DModelConditionLink_modelId_idx" ON "Anatomy3DModelConditionLink"("modelId");
CREATE INDEX "Anatomy3DModelConditionLink_conditionId_idx" ON "Anatomy3DModelConditionLink"("conditionId");
CREATE INDEX "Anatomy3DModelConditionLink_anatomyStructureId_idx" ON "Anatomy3DModelConditionLink"("anatomyStructureId");

-- AddForeignKey
ALTER TABLE "Anatomy3DModelConditionLink" ADD CONSTRAINT "Anatomy3DModelConditionLink_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Anatomy3DModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Anatomy3DModelConditionLink" ADD CONSTRAINT "Anatomy3DModelConditionLink_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Anatomy3DModelConditionLink" ADD CONSTRAINT "Anatomy3DModelConditionLink_anatomyStructureId_fkey" FOREIGN KEY ("anatomyStructureId") REFERENCES "AnatomyStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
