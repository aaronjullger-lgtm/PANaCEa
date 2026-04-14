# Audit Corrections — April 13, 2026

A Perplexity-generated codebase audit produced 12 critical findings. Verification against the actual codebase confirmed that 7 of 12 are incorrect. This document records the corrections with evidence to prevent future re-investigation of false positives.

## Incorrect Findings (No Action Needed)

### 1. ENABLE_REVIEW_GATE "hardcoded true"
Claim: P0 bug, flag cannot be toggled without redeployment.
Reality: lib/services/mainSessionQuestionSelector.ts lines 46-59 reads from process.env.ENABLE_REVIEW_GATE (Edge) and import.meta.env.VITE_ENABLE_REVIEW_GATE (client), defaulting to true only if unset.

### 2. Admin auth "stubbed with TODO"
Claim: P0 security gap at lib/middleware/adminAuth.ts line 98.
Reality: adminAuth.ts is 342 lines, fully implemented. verifyAdminRole verifies Clerk JWT, calls getUserRole which queries the database via Prisma, checks role against ADMIN/SUPERADMIN enum, maps permissions. Both Express and CF middleware provided.

### 3. Mock data "in production code paths"
Claim: MOCK_PEARLS, MOCK_CASES, MOCK_CONDITIONS are un-gated.
Reality: All three gated behind VITE_USE_MOCK env var. MyPearlsPanel line 145, use-photo-drill line 433, mockSessionService line 384.

### 4. "21 P0 Express routes have no Edge equivalent"
Claim: Blocks Cloudflare deployment.
Reality: routes/index.ts comments were stale (now fixed). Production uses Edge Functions with 67 route groups and about 250 handlers. Express is local-dev only.

### 5. avgSessionLength "hardcoded 0"
Claim: Bug in generate-daily-insights cron.
Reality: Dynamically computed with session-clustering logic. Zero is fallback for fewer than 2 attempts.

### 6. FSRS retrievability "not wired" in scoringEngine.ts
Claim: Bug at scoringEngine.ts line 187.
Reality: Fully implemented with retrievability = Math.exp(-elapsedDays / stability), reading from UserProgress.

### 7. diagnosticPuzzleService.ts "fuzzy matching TODO"
Claim: TODO in services/domain/diagnosticPuzzleService.ts.
Reality: Wrong file path (it is in services/core/). Fuzzy matching is fully implemented with Levenshtein distance and threshold 0.75.

## Accurate Findings (Addressed)

### 1. Stale migration comments in routes/index.ts
Fixed: All 10 inaccurate comments updated.

### 2. types/index.ts imports deprecated file
Fixed: Changed from ../src/types to ../src/types/index.

### 3. src/ production coupling via constants
Fixed: Created config/topic-map.ts, updated 35 production imports.

### 4. src/ production coupling via logger
Fixed: Created lib/simple-logger.ts, updated 12 production imports.

### 5. src/ is a legacy tree
Status: After fixes, only scripts and tests import from src/. Can be archived when convenient.

## Findings Accurately Identified But Deferred

- App.tsx (44KB): Known God component, parked refactor branch exists
- index.css (80KB): Known debt, months-long Tailwind migration
- studyGroupService.ts: Dead code, no user-reachable path
