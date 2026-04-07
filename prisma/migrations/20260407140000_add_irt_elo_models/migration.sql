-- Tier 2, Feature 6: IRT/Elo Models for Adaptive Session Ordering
-- Creates ItemDifficulty and StudentAbility tables for the Elo rating system

-- ItemDifficulty: Per-item difficulty estimate (logit scale)
CREATE TABLE "ItemDifficulty" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "eloDifficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discrimination" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "uncertainty" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemDifficulty_pkey" PRIMARY KEY ("id")
);

-- StudentAbility: Per-student, per-domain ability estimate (logit scale)
CREATE TABLE "StudentAbility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "eloAbility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uncertainty" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudentAbility_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "ItemDifficulty_cardId_key" ON "ItemDifficulty"("cardId");
CREATE UNIQUE INDEX "StudentAbility_userId_domain_key" ON "StudentAbility"("userId", "domain");

-- Performance indexes
CREATE INDEX "ItemDifficulty_eloDifficulty_idx" ON "ItemDifficulty"("eloDifficulty");
CREATE INDEX "ItemDifficulty_responseCount_idx" ON "ItemDifficulty"("responseCount");
CREATE INDEX "StudentAbility_userId_idx" ON "StudentAbility"("userId");
CREATE INDEX "StudentAbility_userId_domain_idx" ON "StudentAbility"("userId", "domain");

-- Foreign keys
ALTER TABLE "StudentAbility" ADD CONSTRAINT "StudentAbility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
