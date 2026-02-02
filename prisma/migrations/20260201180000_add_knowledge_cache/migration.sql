-- CreateTable
CREATE TABLE "KnowledgeCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "geminiCacheName" TEXT NOT NULL,
    "geminiFileIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeCache_userId_idx" ON "KnowledgeCache"("userId");

-- CreateIndex
CREATE INDEX "KnowledgeCache_userId_source_idx" ON "KnowledgeCache"("userId", "source");

-- CreateIndex
CREATE INDEX "KnowledgeCache_userId_expiresAt_idx" ON "KnowledgeCache"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "KnowledgeCache" ADD CONSTRAINT "KnowledgeCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
