# PANaCEa Production Readiness Master Plan

## Comprehensive Implementation Roadmap - December 2025

---

## Executive Summary

This document outlines **every step required** to take PANaCEa from current state to production-ready medical education platform. Each section includes:

- Current state assessment
- Detailed implementation steps
- Estimated effort
- Dependencies
- Acceptance criteria

---

## Table of Contents

1. [Phase 1: Content Completion](#phase-1-content-completion)
2. [Phase 2: Database & Data Architecture](#phase-2-database--data-architecture)
3. [Phase 3: Admin Tools & Content Management](#phase-3-admin-tools--content-management)
4. [Phase 4: Security & RBAC](#phase-4-security--rbac)
5. [Phase 5: Performance & Offline](#phase-5-performance--offline)
6. [Phase 6: Quality Assurance & Maintenance](#phase-6-quality-assurance--maintenance)
7. [Phase 7: User Experience Enhancements](#phase-7-user-experience-enhancements)
8. [Phase 8: Analytics & Social Features](#phase-8-analytics--social-features)
9. [Phase 9: Production Infrastructure](#phase-9-production-infrastructure)
10. [Phase 10: Launch Checklist](#phase-10-launch-checklist)

---

# Phase 1: Content Completion

**Priority: CRITICAL | Estimated: 2-3 weeks**

## 1.1 Finish Importing Medical Images

**Status: IN PROGRESS (currently at 273/7657 images)**

### Current State

- Background process running with AI verification
- 240 conditions being processed
- AI filtering out garbage (memes, logos, text slides)
- Misclassified images being rerouted

### Tasks

- [ ] **1.1.1** Monitor image upload until completion (~6-8 hours at current rate)
  ```bash
  # Monitor command
  tail -f /Users/aaronullger/Documents/GitHub/StudyPANaCEa/image-upload-*.log
  ```
- [ ] **1.1.2** Review upload summary and identify gaps
- [ ] **1.1.3** Run gap analysis to identify conditions still missing images
  ```bash
  npx tsx scripts/analysis/comprehensive-pance-image-gap-analysis.ts
  ```
- [ ] **1.1.4** Source additional images for high-priority PANCE conditions missing coverage

### Physical Exam Finding Images

**Current State:** No dedicated physical exam finding images

### Tasks

- [ ] **1.1.5** Create physical exam findings image mapping
  - Map `PhysicalExamFinding` table to image sources
  - Physical exam findings to capture:
    - Inspection findings (edema, cyanosis, jaundice, pallor)
    - Palpation landmarks (lymph nodes, thyroid, masses)
    - Percussion patterns (dullness, tympany)
    - Auscultation (heart sounds, lung sounds - may need audio)
- [ ] **1.1.6** Add `findingId` foreign key to MediaAsset table
- [ ] **1.1.7** Upload physical exam images with proper categorization

## 1.2 Generate Condition Information Fields

**Status: PARTIALLY COMPLETE**

### Current State

- `MedicalContent` table has JSONB `content` field
- Many conditions have minimal or AI-placeholder content
- `description` field exists on `Condition` table

### Tasks

- [ ] **1.2.1** Audit current content completeness
  ```bash
  npx tsx -e "
  const {PrismaClient} = require('@prisma/client');
  const p = new PrismaClient();
  (async() => {
    const conditions = await p.condition.findMany({ include: { medicalContent: true }});
    const withContent = conditions.filter(c => c.medicalContent?.content);
    const withoutContent = conditions.filter(c => !c.medicalContent?.content);
    console.log('With content:', withContent.length);
    console.log('Without content:', withoutContent.length);
  })();
  "
  ```
- [ ] **1.2.2** Create content generation script for missing conditions
  - Use PANCE blueprint weights to prioritize
  - Generate structured JSON content:
    ```typescript
    interface ConditionContent {
      overview: string;
      epidemiology: {
        prevalence: string;
        riskFactors: string[];
        demographics: string;
      };
      pathophysiology: string;
      clinicalPresentation: {
        symptoms: string[];
        signs: string[];
        history: string;
      };
      diagnosticWorkup: {
        labTests: LabTestOrder[];
        imaging: ImagingOrder[];
        specialTests: string[];
      };
      differentialDiagnosis: string[];
      treatment: {
        firstLine: string;
        alternatives: string[];
        emergencyManagement?: string;
      };
      complications: string[];
      prognosis: string;
      panCePearls: string[]; // High-yield exam points
    }
    ```
- [ ] **1.2.3** Validate generated content against authoritative sources
- [ ] **1.2.4** Add explanation fields to question/drill responses
  - Enhance `PreGeneratedQuestion.explanation` population
  - Ensure explanations reference specific medical content

## 1.3 Import Resources from Local and Google Drive

**Status: NOT STARTED**

### Tasks

- [ ] **1.3.1** Audit available local resources
  ```bash
  find /Users/aaronullger/PANaCEa/DATA -type f \( -name "*.pdf" -o -name "*.docx" -o -name "*.pptx" \) | head -50
  ```
- [ ] **1.3.2** Set up Google Drive API integration
  - Create service account credentials
  - Add to `.env`: `GOOGLE_DRIVE_CREDENTIALS_JSON`
  - Implement `services/googleDriveService.ts`
- [ ] **1.3.3** Create resource import pipeline
  ```typescript
  // scripts/import/google-drive-resources.ts
  interface ResourceImport {
    driveFileId: string;
    conditionId?: string;
    resourceType: 'guideline' | 'study_guide' | 'lecture' | 'article';
    visibility: 'public' | 'premium';
  }
  ```
- [ ] **1.3.4** Add `Resource` table to schema if not exists
- [ ] **1.3.5** Build resource browser UI component

---

# Phase 2: Database & Data Architecture

**Priority: HIGH | Estimated: 1-2 weeks**

## 2.1 Deepen Foreign Key Links

**Status: PARTIALLY COMPLETE**

### Current State

- `MediaAsset.conditionId` links to `Condition`
- Missing: `findingId`, `procedureId`, `anatomyId` FK links

### Tasks

- [ ] **2.1.1** Add additional foreign keys to MediaAsset

  ```prisma
  model MediaAsset {
    // Existing
    conditionId    String?
    Condition      Condition? @relation(fields: [conditionId], references: [id])

    // Add these
    findingId      String?
    PhysicalExamFinding PhysicalExamFinding? @relation(fields: [findingId], references: [id])

    procedureId    String?
    Procedure      Procedure? @relation(fields: [procedureId], references: [id])

    anatomyId      String?
    AnatomyStructure AnatomyStructure? @relation(fields: [anatomyId], references: [id])

    drugId         String?
    Drug           Drug? @relation(fields: [drugId], references: [id])
  }
  ```

- [ ] **2.1.2** Create migration
  ```bash
  npx prisma migrate dev --name add_media_asset_fks
  ```
- [ ] **2.1.3** Update image processing script to populate new FKs
- [ ] **2.1.4** Create junction tables for many-to-many media relationships

## 2.2 Normal Lab/Imaging Reference System

**Status: NOT IMPLEMENTED**

### Problem Statement

Students shouldn't be able to recognize "normal" results by memorizing specific images. Need diverse normal examples.

### Tasks

- [ ] **2.2.1** Create NormalReference table
  ```prisma
  model NormalReference {
    id              String   @id @default(cuid())
    modality        String   // 'CBC', 'CMP', 'CXR', 'CT_HEAD', 'ECG', etc.
    mediaAssetId    String?
    MediaAsset      MediaAsset? @relation(fields: [mediaAssetId], references: [id])
    description     String   // "Normal 12-lead ECG, 72 yo male"
    demographicTags String[] // ["male", "elderly", "athletic"]
    values          Json?    // For lab normals: { "WBC": 7.5, "Hgb": 14.2, ... }
    imageVariant    Int      @default(0) // For visual variety tracking
    createdAt       DateTime @default(now())
  }
  ```
- [ ] **2.2.2** Populate with 50+ normals per modality
  - **Labs:** CBC, CMP, LFTs, Coags, UA, Lipid Panel, Thyroid Panel
  - **Imaging:** CXR, CT Head, CT Abdomen, X-ray extremity, Ultrasound
  - **ECG:** Normal sinus rhythm variants
- [ ] **2.2.3** Update case generation to pull random normals
  ```typescript
  async function getRandomNormalForModality(modality: string): Promise<NormalReference> {
    const normals = await prisma.normalReference.findMany({
      where: { modality },
      take: 50,
    });
    return normals[Math.floor(Math.random() * normals.length)];
  }
  ```
- [ ] **2.2.4** Add "Normal vs Abnormal" drill type

## 2.3 Improve Clinical Cases

**Status: PARTIAL**

### Current State

- `PatientEncounterCase` exists
- `FluidCase`, `LabCase` exist
- Missing: comprehensive workup knowledge, normal result handling

### Tasks

- [ ] **2.3.1** Enhance PatientEncounterCase schema

  ```prisma
  model PatientEncounterCase {
    // Existing fields...

    // Add
    appropriateWorkup     Json     // { labs: [...], imaging: [...], procedures: [...] }
    unnecessaryWorkup     Json     // Tests that shouldn't be ordered
    normalExpectedResults String[] // Which tests should return normal
    criticalFindings      String[] // "Don't miss" findings
    dispositionOptions    Json     // ED: admit/discharge criteria
  }
  ```

- [ ] **2.3.2** Create case workup validation service

  ```typescript
  // services/caseWorkupService.ts
  interface WorkupValidation {
    orderedTest: string;
    isAppropriate: boolean;
    rationale: string;
    costImpact: 'low' | 'medium' | 'high';
    timeDelay: number; // minutes
  }

  function validateWorkupOrder(caseId: string, orderedTests: string[]): WorkupValidation[];
  ```

- [ ] **2.3.3** Generate 200+ comprehensive cases using AI
- [ ] **2.3.4** Add case "branches" for different workup paths

---

# Phase 3: Admin Tools & Content Management

**Priority: HIGH | Estimated: 1 week**

## 3.1 Image Review Admin UI

**Status: EXISTS BUT NEEDS ENHANCEMENT**

### Current State

- `MediaApprovalDashboard.tsx` exists (814 lines)
- Basic approve/reject functionality
- No keyboard shortcuts for rapid review

### Tasks

- [ ] **3.1.1** Add keyboard shortcut support
  ```typescript
  // Keyboard shortcuts for rapid review
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'a') approveCurrentImage();
      if (e.key === 'r') rejectCurrentImage();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') previousImage();
      if (e.key === 'f') flagForReview();
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentImageIndex]);
  ```
- [ ] **3.1.2** Add image comparison view (side-by-side duplicates)
- [ ] **3.1.3** Add batch operations with filters
  - "Approve all ECGs from curated_images"
  - "Reject all with low confidence"
- [ ] **3.1.4** Add image quality scoring display
- [ ] **3.1.5** Add "reclassify" action to move to different condition

## 3.2 Unified Admin Feedback Queue

**Status: SEPARATE DASHBOARDS EXIST**

### Current State

- `FlaggedQuestionsDashboard.tsx` for questions
- `MediaApprovalDashboard.tsx` for images
- No unified view

### Tasks

- [ ] **3.2.1** Create `AdminFeedbackHub.tsx`
  ```typescript
  interface FeedbackItem {
    type: 'question' | 'image' | 'content' | 'case';
    id: string;
    status: 'pending' | 'in_review' | 'resolved';
    priority: 'low' | 'medium' | 'high' | 'critical';
    reportedBy?: string;
    reportedAt: Date;
    details: string;
    relatedConditionId?: string;
  }
  ```
- [ ] **3.2.2** Add "Flag Error" button to all drill components
  ```typescript
  // components/common/FlagErrorButton.tsx
  function FlagErrorButton({ contentType, contentId, context }: FlagErrorProps) {
    // Opens modal with error type selection
    // Submits to /api/admin/feedback
  }
  ```
- [ ] **3.2.3** Create feedback API endpoint
  ```typescript
  // functions/api/admin/feedback.ts
  export const onRequestPost = async ({ request, env }) => {
    // Insert into FeedbackItem table
    // Notify admins via webhook if critical
  };
  ```
- [ ] **3.2.4** Add notification system for new feedback items

---

# Phase 4: Security & RBAC

**Priority: CRITICAL | Estimated: 1-2 weeks**

## 4.1 Supabase RLS Policies

**Status: NOT IMPLEMENTED**

### Current State

- Authentication via Clerk
- No row-level security at database level
- Relies on application-level checks only

### Tasks

- [ ] **4.1.1** Create RLS migration file

  ```sql
  -- prisma/migrations/XXXXXX_add_rls_policies/migration.sql

  -- Enable RLS on user-specific tables
  ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "SRSItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "QuestionHistory" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "SavedQuestion" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "Achievement" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "DailyStreak" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;

  -- User can only see their own data
  CREATE POLICY "Users can view own data" ON "User"
    FOR SELECT USING (auth.uid()::text = id);

  CREATE POLICY "Users can view own SRS items" ON "SRSItem"
    FOR ALL USING (auth.uid()::text = "userId");

  CREATE POLICY "Users can view own question history" ON "QuestionHistory"
    FOR ALL USING (auth.uid()::text = "userId");

  -- Public read access for medical content
  CREATE POLICY "Public read medical content" ON "Condition"
    FOR SELECT USING (true);

  CREATE POLICY "Public read media assets" ON "MediaAsset"
    FOR SELECT USING ("approvalStatus" = 'approved');

  -- Admin full access
  CREATE POLICY "Admin full access" ON "User"
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM "User"
        WHERE id = auth.uid()::text
        AND role IN ('ADMIN', 'SUPERADMIN')
      )
    );
  ```

- [ ] **4.1.2** Test RLS policies in Supabase dashboard
- [ ] **4.1.3** Update Prisma client to pass auth context
  ```typescript
  // lib/prisma-rls.ts
  export function createRLSClient(userId: string) {
    return new PrismaClient().$extends({
      query: {
        $allOperations({ args, query }) {
          // Set the auth.uid() for RLS
          return prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`.then(
            () => query(args)
          );
        },
      },
    });
  }
  ```
- [ ] **4.1.4** Document RLS bypass for admin operations

## 4.2 Rate Limiting Enhancement

**Status: BASIC IMPLEMENTATION EXISTS**

### Current State

- Express rate limiter: 100 requests per 15 minutes
- Redis rate limiting for Gemini API calls

### Tasks

- [ ] **4.2.1** Implement tiered rate limiting
  ```typescript
  // lib/rateLimiter.ts
  const RATE_LIMITS = {
    anonymous: { windowMs: 15 * 60 * 1000, max: 20 },
    authenticated: { windowMs: 15 * 60 * 1000, max: 100 },
    premium: { windowMs: 15 * 60 * 1000, max: 500 },
    admin: { windowMs: 15 * 60 * 1000, max: 1000 },
  };
  ```
- [ ] **4.2.2** Add per-endpoint rate limits
  ```typescript
  const ENDPOINT_LIMITS = {
    '/api/ai/*': { windowMs: 60 * 1000, max: 10 }, // AI endpoints: 10/min
    '/api/questions/generate': { windowMs: 60 * 1000, max: 5 },
    '/api/coaching/*': { windowMs: 60 * 1000, max: 20 },
  };
  ```
- [ ] **4.2.3** Implement cost tracking per user
  ```prisma
  model UserUsage {
    id          String   @id @default(cuid())
    userId      String
    User        User     @relation(fields: [userId], references: [id])
    date        DateTime @db.Date
    aiTokensUsed Int     @default(0)
    apiCalls    Int      @default(0)
    estimatedCost Float  @default(0)
    @@unique([userId, date])
  }
  ```
- [ ] **4.2.4** Add budget alerts
  ```typescript
  // Check after each AI call
  if (dailyUsage.estimatedCost > DAILY_BUDGET_ALERT_THRESHOLD) {
    await notifyAdmins('Budget alert', { userId, cost: dailyUsage.estimatedCost });
  }
  ```

## 4.3 API Cost Management

**Status: PARTIAL**

### Tasks

- [ ] **4.3.1** Audit all Gemini API call sites
  ```bash
  grep -r "generateContent\|getGenerativeModel" --include="*.ts" --include="*.tsx" | wc -l
  ```
- [ ] **4.3.2** Ensure all AI-generated content is cached/seeded
  - Questions should be pre-generated, not generated on-demand
  - Explanations should be stored, not regenerated
  - Hints should be cached per question
- [ ] **4.3.3** Implement response caching layer

  ```typescript
  // lib/aiCache.ts
  async function getCachedOrGenerate(
    cacheKey: string,
    generator: () => Promise<string>,
    ttlSeconds: number = 86400
  ): Promise<string> {
    const cached = await kv.get(cacheKey);
    if (cached) return cached;

    const result = await generator();
    await kv.set(cacheKey, result, { expirationTtl: ttlSeconds });
    return result;
  }
  ```

- [ ] **4.3.4** Add cost tracking to all AI calls
  ```typescript
  async function trackAICost(userId: string, tokens: number, model: string) {
    const costPerToken = MODEL_COSTS[model] || 0.0001;
    await prisma.userUsage.upsert({
      where: { userId_date: { userId, date: today() } },
      update: {
        aiTokensUsed: { increment: tokens },
        estimatedCost: { increment: tokens * costPerToken },
      },
      create: { userId, date: today(), aiTokensUsed: tokens, estimatedCost: tokens * costPerToken },
    });
  }
  ```

---

# Phase 5: Performance & Offline

**Priority: HIGH | Estimated: 1-2 weeks**

## 5.1 Cloudflare Edge Caching

**Status: NOT IMPLEMENTED**

### Current State

- Using Cloudflare Pages Functions
- No KV or Durable Objects integration

### Tasks

- [ ] **5.1.1** Set up Cloudflare KV namespace
  ```bash
  wrangler kv:namespace create PANACEA_CACHE
  ```
- [ ] **5.1.2** Add KV binding to wrangler.toml
  ```toml
  [[kv_namespaces]]
  binding = "PANACEA_CACHE"
  id = "xxx"
  ```
- [ ] **5.1.3** Cache frequent queries

  ```typescript
  // functions/api/conditions/index.ts
  export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
    const cacheKey = 'conditions:all';

    // Try cache first
    const cached = await env.PANACEA_CACHE.get(cacheKey, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    // Fetch from DB
    const conditions = await prisma.condition.findMany();

    // Cache for 1 hour
    await env.PANACEA_CACHE.put(cacheKey, JSON.stringify(conditions), {
      expirationTtl: 3600,
    });

    return new Response(JSON.stringify(conditions), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  };
  ```

- [ ] **5.1.4** Add cache invalidation on content updates
- [ ] **5.1.5** Implement stale-while-revalidate pattern

## 5.2 Enhanced Offline Strategy

**Status: BASIC PWA EXISTS**

### Current State

- Service worker with multi-tier caching
- `OfflineSyncService` with delta sync
- Basic offline indicator

### Tasks

- [ ] **5.2.1** Pre-cache Daily Prescription data

  ```typescript
  // In service worker
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-daily-prescription') {
      event.waitUntil(preCacheDailyPrescription());
    }
  });

  async function preCacheDailyPrescription() {
    const userId = await getUserIdFromIDB();
    const prescription = await fetch(`/api/daily-prescription/${userId}`);
    const cache = await caches.open('daily-prescription-v1');
    await cache.put(`/api/daily-prescription/${userId}`, prescription);
  }
  ```

- [ ] **5.2.2** Implement background sync for study sessions
  ```typescript
  // Register sync when offline
  if ('sync' in navigator.serviceWorker) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-study-session');
  }
  ```
- [ ] **5.2.3** Add conflict resolution UI
  ```typescript
  // Show user when there are conflicts
  interface ConflictResolution {
    localVersion: StudySession;
    serverVersion: StudySession;
    conflictFields: string[];
    resolution: 'keep-local' | 'keep-server' | 'merge';
  }
  ```
- [ ] **5.2.4** Add IndexedDB size management
  ```typescript
  async function pruneOldCacheData() {
    const db = await openIDB();
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete('study-sessions', IDBKeyRange.upperBound(cutoffDate));
  }
  ```

---

# Phase 6: Quality Assurance & Maintenance

**Priority: HIGH | Estimated: 1-2 weeks**

## 6.1 Automated Testing Bot

**Status: NOT IMPLEMENTED**

### Tasks

- [ ] **6.1.1** Create E2E test suite with Playwright
  ```typescript
  // tests/e2e/user-journey.spec.ts
  test('complete study session', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="start-drill"]');
    await page.click('[data-testid="answer-option-1"]');
    await expect(page.locator('[data-testid="feedback"]')).toBeVisible();
    await page.click('[data-testid="next-question"]');
    // Continue through 10 questions
  });
  ```
- [ ] **6.1.2** Create random drill tester

  ```typescript
  // scripts/testing/random-drill-tester.ts
  async function testRandomDrills(count: number) {
    for (let i = 0; i < count; i++) {
      const condition = getRandomCondition();
      const question = await generateQuestion(condition.id);

      // Verify question has all required fields
      assert(question.stem, 'Question missing stem');
      assert(question.options.length === 5, 'Question should have 5 options');
      assert(question.correctAnswer, 'Question missing correct answer');
      assert(question.explanation, 'Question missing explanation');

      // Verify answer is in options
      assert(question.options.includes(question.correctAnswer));

      // Verify no duplicate options
      const uniqueOptions = new Set(question.options);
      assert(uniqueOptions.size === 5, 'Duplicate options detected');
    }
  }
  ```

- [ ] **6.1.3** Schedule nightly test runs
  ```yaml
  # .github/workflows/nightly-tests.yml
  name: Nightly E2E Tests
  on:
    schedule:
      - cron: '0 3 * * *'
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: npm ci
        - run: npx playwright test
  ```
- [ ] **6.1.4** Create test result dashboard

## 6.2 Drift Detection for Stale Content

**Status: NOT IMPLEMENTED**

### Tasks

- [ ] **6.2.1** Add `lastReviewedAt` and `guidelineVersion` to MedicalContent
  ```prisma
  model MedicalContent {
    // Existing...
    lastReviewedAt    DateTime?
    guidelineVersion  String?    // e.g., "AHA 2023", "IDSA 2024"
    needsReview       Boolean    @default(false)
    reviewNotes       String?
  }
  ```
- [ ] **6.2.2** Create drift detection script

  ```typescript
  // scripts/automation/driftDetection.ts
  const STALE_THRESHOLD_DAYS = 180; // 6 months

  async function detectStalContent() {
    const staleDate = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    const staleContent = await prisma.medicalContent.findMany({
      where: {
        OR: [{ lastReviewedAt: { lt: staleDate } }, { lastReviewedAt: null }],
      },
      include: { condition: true },
    });

    // Flag for review
    for (const content of staleContent) {
      await prisma.medicalContent.update({
        where: { id: content.id },
        data: { needsReview: true },
      });

      // Create admin notification
      await createAdminNotification({
        type: 'STALE_CONTENT',
        title: `Content Review Needed: ${content.condition?.displayName}`,
        message: `Last reviewed: ${content.lastReviewedAt || 'Never'}`,
        priority: isPANCEHighYield(content.conditionId) ? 'high' : 'medium',
      });
    }

    return staleContent.length;
  }
  ```

- [ ] **6.2.3** Add to daily tasks
  ```typescript
  // scripts/automation/dailyTasks.ts
  await detectStaleContent();
  ```
- [ ] **6.2.4** Create admin dashboard for stale content review

## 6.3 Daily Grand Rounds Enhancement

**Status: EXISTS BUT NEEDS ENHANCEMENT**

### Current State

- Basic Grand Rounds challenge exists
- Generated daily

### Tasks

- [ ] **6.3.1** Verify Grand Rounds generates for ALL users

  ```typescript
  // scripts/automation/dailyTasks.ts
  async function generateDailyGrandRounds() {
    const users = await prisma.user.findMany({
      where: { isActive: true },
    });

    for (const user of users) {
      await grandRoundsService.generateDailyChallenge(user.id, {
        targetWeakAreas: true,
        difficultyLevel: user.currentLevel,
      });
    }
  }
  ```

- [ ] **6.3.2** Add personalization based on weak areas
- [ ] **6.3.3** Add "Clinical Pearl of the Day" to Grand Rounds
- [ ] **6.3.4** Add streak bonuses for consecutive Grand Rounds completion

---

# Phase 7: User Experience Enhancements

**Priority: MEDIUM | Estimated: 1-2 weeks**

## 7.1 Socratic Hint Service Enhancement

**Status: EXISTS - NEEDS ENHANCEMENT**

### Current State

- `SocraticHintService.ts` exists with 3-tier hints
- Uses Gemini Flash

### Tasks

- [ ] **7.1.1** Add hint usage tracking
  ```typescript
  // Track how many hints user needed
  await prisma.questionHistory.update({
    where: { id: questionHistoryId },
    data: {
      hintsUsed: { increment: 1 },
      hintLevel: currentHintLevel,
    },
  });
  ```
- [ ] **7.1.2** Add "Why was this wrong?" button
  ```typescript
  async function explainWhyWrong(
    questionId: string,
    selectedAnswer: string,
    correctAnswer: string
  ): Promise<string> {
    // Generate targeted explanation of misconception
  }
  ```
- [ ] **7.1.3** Add comparison to correct answer after reveal
- [ ] **7.1.4** Cache hints per question to avoid regeneration

## 7.2 Differential Diagnosis Ranking

**Status: NOT IMPLEMENTED**

### Tasks

- [ ] **7.2.1** Create DDx ranking component

  ```typescript
  // components/drill/DifferentialRanking.tsx
  interface DifferentialRankingProps {
    possibleDiagnoses: string[];
    onSubmit: (rankings: RankedDiagnosis[]) => void;
  }

  interface RankedDiagnosis {
    conditionId: string;
    rank: 1 | 2 | 3;
    justification: string;
  }
  ```

- [ ] **7.2.2** Add DDx ranking to case simulations
- [ ] **7.2.3** Score DDx accuracy (partial credit for close rankings)
- [ ] **7.2.4** Track most commonly confused conditions

## 7.3 Error Boundaries

**Status: EXISTS - NEEDS ENHANCEMENT**

### Current State

- `ErrorBoundary.tsx` exists
- `GeminiErrorBoundary.tsx` exists

### Tasks

- [ ] **7.3.1** Add Sentry integration

  ```typescript
  // lib/errorReporting.ts
  import * as Sentry from '@sentry/react';

  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });

  export function captureError(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, { extra: context });
  }
  ```

- [ ] **7.3.2** Add error boundary to all major routes
- [ ] **7.3.3** Add graceful degradation for API failures
  ```typescript
  // If Gemini fails, show cached content
  try {
    const hint = await socraticService.getHint(question);
    return hint;
  } catch (error) {
    captureError(error);
    return FALLBACK_HINTS[question.category];
  }
  ```
- [ ] **7.3.4** Add "Report this error" button to error boundary

---

# Phase 8: Analytics & Social Features

**Priority: MEDIUM | Estimated: 1-2 weeks**

## 8.1 PANCE-Ready Cohort Comparison

**Status: PARTIAL**

### Current State

- Analytics services exist
- `PeerStatistic` table exists
- Basic cohort comparison

### Tasks

- [ ] **8.1.1** Define "PANCE-Ready" benchmarks
  ```typescript
  const PANCE_READY_BENCHMARKS = {
    overallAccuracy: 0.75, // 75% accuracy
    systemCoverage: 0.9, // 90% of systems studied
    questionCount: 2000, // 2000+ questions attempted
    weakAreaThreshold: 0.6, // No system below 60%
  };
  ```
- [ ] **8.1.2** Create percentile ranking system
  ```typescript
  async function calculatePercentile(userId: string, category: string): Promise<number> {
    const userScore = await getUserCategoryScore(userId, category);
    const allScores = await getAllUserScoresForCategory(category);
    const rank = allScores.filter((s) => s < userScore).length;
    return Math.round((rank / allScores.length) * 100);
  }
  ```
- [ ] **8.1.3** Add comparison UI widget
  ```tsx
  // components/analytics/PeerComparisonWidget.tsx
  <PeerComparisonWidget
    userId={userId}
    category="Cardiology"
    percentile={85}
    panceReadyThreshold={75}
  />
  // "You are in the 85th percentile for Cardiology compared to PANCE-ready students"
  ```
- [ ] **8.1.4** Add "PANCE Readiness Score" to dashboard

## 8.2 Study Groups & Leaderboards

**Status: SCHEMA EXISTS - UI NEEDS WORK**

### Current State

- `StudyGroup`, `StudyGroupMember` tables exist
- `StudyGroupService.ts` exists with basic functions
- `StudyGroupHub.tsx` component exists

### Tasks

- [ ] **8.2.1** Enhance study group features
  ```typescript
  // New features to add
  interface StudyGroupEnhancements {
    sharedGoals: GroupGoal[];
    weeklyChallenge: Challenge;
    groupStreak: number;
    privateLeaderboard: LeaderboardEntry[];
    discussionThread: Discussion[];
  }
  ```
- [ ] **8.2.2** Add group streak tracking

  ```typescript
  async function updateGroupStreak(groupId: string) {
    const members = await prisma.studyGroupMember.findMany({
      where: { studyGroupId: groupId },
      include: { user: { include: { dailyStreaks: true } } },
    });

    // Group streak = minimum of all member streaks
    const streaks = members.map((m) => m.user.dailyStreaks[0]?.currentStreak || 0);
    const groupStreak = Math.min(...streaks);

    await prisma.studyGroup.update({
      where: { id: groupId },
      data: { groupStreak },
    });
  }
  ```

- [ ] **8.2.3** Add private leaderboard component
- [ ] **8.2.4** Add group challenge creation
- [ ] **8.2.5** Add notification system for group activity

## 8.3 Daily Prescription Enhancement

**Status: EXISTS - NEEDS ENHANCEMENT**

### Tasks

- [ ] **8.3.1** Add trend analysis to prescriptions
  ```typescript
  interface DailyPrescription {
    userId: string;
    date: Date;
    weakAreas: WeakArea[];
    recommendedQuestions: number;
    suggestedTopics: Topic[];
    // New fields
    trends: {
      improving: string[];
      declining: string[];
      plateaued: string[];
    };
    personalizedTips: string[];
    estimatedPANCEImpact: number; // Projected score improvement
  }
  ```
- [ ] **8.3.2** Add maintenance check integration

  ```typescript
  // scripts/automation/dailyTasks.ts
  async function generateAllDailyPrescriptions() {
    const users = await prisma.user.findMany({ where: { isActive: true } });

    for (const user of users) {
      const analytics = await analyzeUserPerformance(user.id);
      const trends = await calculateTrends(user.id);

      await prescriptionService.generate({
        userId: user.id,
        analytics,
        trends,
        panCeBlueprint: PANCE_BLUEPRINT_WEIGHTS,
      });
    }
  }
  ```

- [ ] **8.3.3** Pre-cache for offline access
- [ ] **8.3.4** Add push notification for daily prescription

---

# Phase 9: Production Infrastructure

**Priority: CRITICAL | Estimated: 1 week**

## 9.1 Environment Configuration

**Status: NEEDS REVIEW**

### Tasks

- [ ] **9.1.1** Audit all environment variables
  ```bash
  # Required production variables
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  DATABASE_URL=
  DIRECT_DATABASE_URL=
  VITE_CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  CLERK_WEBHOOK_SECRET=
  GEMINI_API_KEY=
  VITE_SENTRY_DSN=
  ```
- [ ] **9.1.2** Set up Cloudflare secrets
  ```bash
  wrangler secret put DATABASE_URL
  wrangler secret put GEMINI_API_KEY
  wrangler secret put CLERK_SECRET_KEY
  ```
- [ ] **9.1.3** Configure production CSP headers
- [ ] **9.1.4** Set up staging environment

## 9.2 Monitoring & Alerting

**Status: NOT IMPLEMENTED**

### Tasks

- [ ] **9.2.1** Set up Sentry for error tracking
- [ ] **9.2.2** Set up Cloudflare Analytics
- [ ] **9.2.3** Create health check endpoint

  ```typescript
  // functions/api/health.ts
  export const onRequestGet = async ({ env }) => {
    const checks = {
      database: await checkDatabase(env),
      supabase: await checkSupabase(env),
      gemini: await checkGemini(env),
      cache: await checkKV(env),
    };

    const healthy = Object.values(checks).every((c) => c.status === 'ok');

    return new Response(
      JSON.stringify({
        status: healthy ? 'healthy' : 'degraded',
        checks,
        timestamp: new Date().toISOString(),
      }),
      {
        status: healthy ? 200 : 503,
      }
    );
  };
  ```

- [ ] **9.2.4** Set up uptime monitoring (e.g., BetterUptime)
- [ ] **9.2.5** Create alerting for:
  - Error rate spikes
  - API latency increases
  - Budget threshold exceeded
  - Database connection issues

## 9.3 Backup & Recovery

**Status: PARTIAL**

### Tasks

- [ ] **9.3.1** Configure Supabase automated backups
- [ ] **9.3.2** Create manual backup script
  ```bash
  # scripts/backup/database-backup.sh
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```
- [ ] **9.3.3** Test restore procedure
- [ ] **9.3.4** Document disaster recovery plan

---

# Phase 10: Launch Checklist

**Priority: CRITICAL | Final Pre-Launch**

## Pre-Launch Verification

### Content

- [ ] All PANCE conditions have images
- [ ] All conditions have medical content
- [ ] Question pool has 10,000+ questions
- [ ] All questions have explanations
- [ ] No flagged content pending review

### Security

- [ ] RLS policies tested and active
- [ ] Rate limiting configured
- [ ] CORS configured correctly
- [ ] CSP headers in place
- [ ] No exposed API keys in client code

### Performance

- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Edge caching active
- [ ] Service worker deployed

### Monitoring

- [ ] Sentry configured
- [ ] Uptime monitoring active
- [ ] Budget alerts configured
- [ ] Health check endpoint responding

### Legal/Compliance

- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Medical disclaimer visible
- [ ] Cookie consent implemented
- [ ] HIPAA considerations documented (if applicable)

### User Experience

- [ ] Onboarding flow complete
- [ ] Error boundaries on all routes
- [ ] Offline mode functional
- [ ] Mobile responsive
- [ ] Accessibility audit passed

---

# Appendix A: Estimated Timeline

| Phase                     | Duration  | Dependencies |
| ------------------------- | --------- | ------------ |
| Phase 1: Content          | 2-3 weeks | None         |
| Phase 2: Database         | 1-2 weeks | None         |
| Phase 3: Admin Tools      | 1 week    | Phase 2      |
| Phase 4: Security         | 1-2 weeks | Phase 2      |
| Phase 5: Performance      | 1-2 weeks | Phase 2      |
| Phase 6: QA/Maintenance   | 1-2 weeks | Phase 3      |
| Phase 7: UX Enhancements  | 1-2 weeks | Phase 6      |
| Phase 8: Analytics/Social | 1-2 weeks | Phase 4      |
| Phase 9: Infrastructure   | 1 week    | Phase 4      |
| Phase 10: Launch          | 1 week    | All phases   |

**Total Estimated Time: 10-16 weeks**

---

# Appendix B: Priority Order

## Immediate (This Week)

1. ✅ Finish image upload (in progress)
2. Implement RLS policies
3. Set up error monitoring (Sentry)

## Short-term (2-4 Weeks)

4. Complete content generation for all conditions
5. Build admin feedback hub
6. Implement rate limiting enhancements
7. Set up edge caching

## Medium-term (4-8 Weeks)

8. Enhance offline capabilities
9. Implement drift detection
10. Build study group features
11. Add PANCE readiness scoring

## Long-term (8-16 Weeks)

12. Full E2E testing suite
13. Advanced analytics
14. Premium features
15. Mobile app (if planned)

---

# Appendix C: Key Files Reference

## Database

- `prisma/schema.prisma` - Main schema
- `prisma/migrations/` - Migration history

## API Endpoints

- `functions/api/` - All serverless functions
- `server.ts` - Legacy Express server

## Services

- `services/` - Business logic
- `lib/` - Utility functions

## Components

- `components/admin/` - Admin UI
- `components/analytics/` - Analytics dashboards
- `components/drill/` - Quiz/drill components

## Scripts

- `scripts/automation/` - Scheduled tasks
- `scripts/images/` - Image processing
- `scripts/analysis/` - Gap analysis tools

---

_Document generated: December 31, 2025_
_Last updated: [AUTO-UPDATE ON SAVE]_
