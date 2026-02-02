-- Add Study Companion fields to EducationalResource for "Chat with your Textbook"
-- storagePath: bucket-relative path in Supabase for PDF download
-- geminiCacheName: Gemini cachedContents name (e.g. cachedContents/xxx)
-- geminiCacheExpiresAt: when the cache expires
-- adobeDataPath: path to Adobe Extract JSON in Supabase for citation highlight coordinates

-- Add Study Companion fields to EducationalResource for "Chat with your Textbook"
ALTER TABLE "EducationalResource" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "EducationalResource" ADD COLUMN "geminiCacheName" TEXT;
ALTER TABLE "EducationalResource" ADD COLUMN "geminiCacheExpiresAt" TIMESTAMP(3);
ALTER TABLE "EducationalResource" ADD COLUMN "adobeDataPath" TEXT;
