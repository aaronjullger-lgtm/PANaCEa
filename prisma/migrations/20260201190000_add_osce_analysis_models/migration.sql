-- CreateTable
CREATE TABLE "CaseRubric" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsceResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "checklist" JSONB NOT NULL,
    "redFlagsMissed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clinicalReasoningScore" DOUBLE PRECISION NOT NULL,
    "billingCodeSuggestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OsceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptGap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseRubric_caseId_key" ON "CaseRubric"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "OsceResult_sessionId_key" ON "OsceResult"("sessionId");

-- CreateIndex
CREATE INDEX "ConceptGap_userId_idx" ON "ConceptGap"("userId");

-- CreateIndex
CREATE INDEX "ConceptGap_userId_system_idx" ON "ConceptGap"("userId", "system");

-- AddForeignKey
ALTER TABLE "CaseRubric" ADD CONSTRAINT "CaseRubric_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PatientEncounterCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsceResult" ADD CONSTRAINT "OsceResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientEncounterSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptGap" ADD CONSTRAINT "ConceptGap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
