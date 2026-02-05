-- Anatomy Painter (Phase 3): Firefly-generated anatomy image metadata. Asset stored in Supabase (visualizer/).
CREATE TABLE IF NOT EXISTS "VisualizerGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conditionId" TEXT,
    "prompt" TEXT NOT NULL,
    "contentClass" TEXT NOT NULL DEFAULT 'art',
    "storagePath" TEXT NOT NULL,
    "storageUrl" TEXT,
    "referenceAnatomyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualizerGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VisualizerGeneration_userId_idx" ON "VisualizerGeneration"("userId");
CREATE INDEX IF NOT EXISTS "VisualizerGeneration_conditionId_idx" ON "VisualizerGeneration"("conditionId");
CREATE INDEX IF NOT EXISTS "VisualizerGeneration_createdAt_idx" ON "VisualizerGeneration"("createdAt");

ALTER TABLE "VisualizerGeneration" ADD CONSTRAINT "VisualizerGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
