# Architecture Reorganization Plan - Step 5

**Date:** January 23, 2026  
**Status:** READY FOR EXECUTION  
**Phase:** Service Consolidation & Migration

---

## Executive Summary

This document outlines the complete migration plan for consolidating 79 scattered service files from a flat structure into 4 well-organized category directories. This completes the architectural reorganization initiated in Phase 1 (January 2026).

### Current State
- **79 service files** in flat root structure (`services/*.ts`)
- **4 category directories** partially populated:
  - `services/core/` (3 files migrated)
  - `services/analytics/` (3 files migrated)
  - `services/ai/` (1 barrel export only)
  - `services/domain/` (1 barrel export only)
- **Barrel exports** created but incomplete
- **Import paths** inconsistent across codebase

### Target State
- **0 service files** in root (except index.ts and test files)
- **All services** organized into categorical subdirectories
- **Unified barrel exports** for clean import patterns
- **Consistent imports** using `@/services/core`, `@/services/analytics`, etc.

---

## Service Categorization Matrix

### CORE (21 services) - Question Management, Sessions, Drills, Content

**Already Migrated:**
- ✅ `conditionContentService.ts` → `services/core/`
- ✅ `conditionService.ts` → `services/core/`
- ✅ `questionService.ts` → `services/core/`

**Needs Migration:**
```
attemptService.ts              → services/core/
conditionDataLoader.ts         → services/core/
customSessionService.ts        → services/core/
drillService.ts                → services/core/
drillStatsService.ts           → services/core/
mainSessionService.ts          → services/core/
sessionService.ts              → services/core/
dailyTriadService.ts           → services/core/
noRepeatService.ts             → services/core/
poolMonitorService.ts          → services/core/
questionPoolService.ts         → services/core/
questionQualityService.ts      → services/core/
questionSeedService.ts         → services/core/
stagingQuestionService.ts      → services/core/
variantQueueService.ts         → services/core/
wordleService.ts               → services/core/
CoachingService.ts             → services/core/
feedbackService.ts             → services/core/
```

**Rationale:** These services handle core educational operations - question retrieval, session orchestration, drill logic, and content management. They form the foundation of the learning engine.

---

### ANALYTICS (19 services) - Performance Tracking, Predictions, Behavioral Analysis

**Already Migrated:**
- ✅ `performanceService.ts` → `services/analytics/`
- ✅ `advancedUserAnalyticsEngine.ts` → `services/analytics/`
- ✅ `circadianAnalyticsService.ts` → (referenced but may need relocation)

**Needs Migration:**
```
answerPatternService.ts          → services/analytics/
behavioralConfidenceService.ts   → services/analytics/
calibrationService.ts            → services/analytics/
deepAnalyticsStore.ts            → services/analytics/
learningPatternEngine.ts         → services/analytics/
masteryVelocityPredictor.ts      → services/analytics/
panaceScorePredictor.ts          → services/analytics/
panceScorePredictorService.ts    → services/analytics/
performancePredictionService.ts  → services/analytics/
predictiveAnalyticsEngine.ts     → services/analytics/
researchBackedAnalytics.ts       → services/analytics/
sessionAnalyticsSyncService.ts   → services/analytics/
sessionMomentumService.ts        → services/analytics/
studentInsightsService.ts        → services/analytics/
userContextService.ts            → services/analytics/
userProfileService.ts            → services/analytics/
```

**Rationale:** These services analyze user behavior, predict performance, track learning patterns, and provide data-driven insights. Critical for adaptive learning and the "Cognitive Prosthetic" mission.

---

### AI (13 services) - Gemini Integration, Content Generation, AI Tutoring

**Already Migrated:**
- ✅ None (directory has barrel export only)

**Needs Migration:**
```
adaptiveQuestionEngine.ts       → services/ai/
automatedContentPipeline.ts     → services/ai/
batchGeneratorService.ts        → services/ai/
enhancedQuestionService.ts      → services/ai/
geminiService.ts                → services/ai/
intelligentQuestionService.ts   → services/ai/
socraticHintService.ts          → services/ai/
virtualAttendingService.ts      → services/ai/
virtualPreceptorService.ts      → services/ai/
contextAwareOrchestrator.ts     → services/ai/
realTimeSessionOptimizer.ts     → services/ai/
semanticSearchService.ts        → services/ai/
StudyGuideGenerator.ts          → services/ai/
```

**Rationale:** These services leverage AI/ML for question generation, adaptive difficulty, content enrichment, and Socratic tutoring. All interact with Gemini or implement AI-driven learning strategies.

---

### DOMAIN (26 services) - FSRS Algorithm, Exam Simulation, Reference Data, Media

**Already Migrated:**
- ✅ None (directory has barrel export only)

**Needs Migration:**
```
adaptiveFSRSService.ts           → services/domain/
anatomyModelService.ts           → services/domain/
buzzwordService.ts               → services/domain/
clinicalBrowserService.ts        → services/domain/
clinicalPearlService.ts          → services/domain/
conceptDependencyService.ts      → services/domain/
ddxService.ts                    → services/domain/
drugService.ts                   → services/domain/
educationalResourceService.ts    → services/domain/
examService.ts                   → services/domain/
firstLineService.ts              → services/domain/
guidelineService.ts              → services/domain/
imageQualityService.ts           → services/domain/
knowledgeGraphService.ts         → services/domain/
labCaseService.ts                → services/domain/
labService.ts                    → services/domain/
mediaApprovalService.ts          → services/domain/
mediaStorageService.ts           → services/domain/
medicalSpanishService.ts         → services/domain/
osceScoringEngine.ts             → services/domain/
osceService.ts                   → services/domain/
panceDistributionService.ts      → services/domain/
patientEncounterGenerator.ts     → services/domain/
patientPersonalityEngine.ts      → services/domain/
referenceDataService.ts          → services/domain/
riskAssessmentEngine.ts          → services/domain/
scenarioService.ts               → services/domain/
smartPauseService.ts             → services/domain/
studyGroupService.ts             → services/domain/
```

**Rationale:** These services provide domain-specific functionality - FSRS spaced repetition, clinical reference data (labs, drugs, guidelines), exam simulation, OSCE scenarios, and media management. They represent the medical education domain model.

---

### KEEP IN ROOT (3 files) - Testing & Utilities

```
markdownParser.ts              → KEEP (utility, used by multiple services)
markdownParser.test.ts         → KEEP (test file)
CoachingService.test.ts        → KEEP (test file)
```

**Rationale:** Test files and cross-cutting utilities remain at root level for easier test discovery and shared utility access.

---

## Import Path Migration Strategy

### Before (Current State)
```typescript
// Scattered imports from flat structure
import { questionService } from '@/services/questionService';
import { performanceService } from '@/services/performanceService';
import { geminiService } from '@/services/geminiService';
import { fsrsService } from '@/services/adaptiveFSRSService';
```

### After (Target State)
```typescript
// Clean categorical imports
import { questionService, sessionService } from '@/services/core';
import { performanceService, analyticsService } from '@/services/analytics';
import { geminiService, virtualPreceptor } from '@/services/ai';
import { fsrsService, examService } from '@/services/domain';
```

### Import Pattern Rules

1. **Barrel Exports First**: Always import from category barrels (`@/services/core`)
2. **No Direct Imports**: Never import from individual service files
3. **Namespace Access**: Use `questionService.getQuestion()` pattern
4. **Named Exports**: For tree-shaking, export key functions explicitly

---

## Execution Plan

### Phase 1: File Migration (Est. 30 min)
1. Move CORE services (18 files)
2. Move ANALYTICS services (16 files)
3. Move AI services (13 files)
4. Move DOMAIN services (26 files)
5. Verify all files moved successfully

### Phase 2: Barrel Export Updates (Est. 15 min)
1. Update `services/core/index.ts` with new exports
2. Update `services/analytics/index.ts` with new exports
3. Update `services/ai/index.ts` with new exports
4. Update `services/domain/index.ts` with new exports
5. Verify barrel exports compile

### Phase 3: Import Path Updates (Est. 45 min)
Search and replace import patterns across:
- `components/` directory (React components)
- `hooks/` directory (Custom hooks)
- `pages/` directory (Route pages)
- `lib/` directory (Library utilities)
- `functions/` directory (Cloudflare Functions)
- `routes/` directory (API routes)

### Phase 4: Verification (Est. 15 min)
1. Run `npm run typecheck` - Must pass with 0 errors
2. Run `npm run lint` - Check for unused imports
3. Test critical paths manually
4. Verify Cloudflare Pages build

---

## Risk Mitigation

### High-Risk Areas
1. **Circular Dependencies**: Some services may have circular imports
   - **Mitigation**: Use type-only imports where possible
2. **Cloudflare Edge Runtime**: Some imports may break in Edge context
   - **Mitigation**: Test build after migration
3. **Dynamic Imports**: Code-split components may break
   - **Mitigation**: Update dynamic import paths

### Rollback Plan
- All changes are in version control
- Can revert via `git reset --hard` if catastrophic failure
- Incremental commits per phase allow partial rollback

---

## Success Criteria

✅ **Zero files in `services/` root** (except index.ts, test files, utilities)  
✅ **All barrel exports functional** (no missing exports)  
✅ **TypeScript compilation passes** (`npm run typecheck` exits 0)  
✅ **No broken imports** in any component/hook/page  
✅ **Cloudflare Pages build succeeds**  
✅ **Documentation updated** (README, .clinerules, INDEX.md)

---

## Post-Migration Tasks

1. **Update .clinerules** with new import patterns
2. **Update docs/INDEX.md** to reflect new structure
3. **Create migration guide** for team members
4. **Audit for dead code** - remove deprecated services
5. **Consider further consolidation** (merge similar services)

---

## Appendix: Category Decision Criteria

### CORE
- Manages questions, sessions, drills, or medical content
- Direct user interaction with learning materials
- Core educational workflow

### ANALYTICS
- Tracks performance, behavior, or learning patterns
- Predicts outcomes or provides insights
- Data analysis and visualization

### AI
- Uses Gemini or other AI/ML models
- Generates content or provides adaptive features
- AI-driven tutoring or explanations

### DOMAIN
- Provides domain-specific functionality (FSRS, PANCE, clinical data)
- Reference data (labs, drugs, guidelines)
- Exam simulation and OSCE scenarios
- Media management

---

**Ready for Execution:** This plan is ready to be executed sequentially. Proceed with Phase 1 (File Migration) upon approval.
