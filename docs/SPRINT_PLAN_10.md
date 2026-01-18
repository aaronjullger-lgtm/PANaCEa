# PANaCEa 10-Sprint Development Plan

**Created:** January 4, 2026  
**Goal:** Production-ready medical education platform with AI intelligence, robust security, and engaging social features

---

## 📋 Overview

| Sprint | Focus                                   | Estimated Days |
| ------ | --------------------------------------- | -------------- |
| 1      | Critical Bug Fixes & Stability          | 2-3            |
| 2      | Admin Dashboard & RBAC/RLS              | 3-4            |
| 3      | Content Pipeline & Missing Conditions   | 3-4            |
| 4      | Enhanced Cases & Normal Values Database | 4-5            |
| 5      | Differential Ranking & Socratic Hints   | 3-4            |
| 6      | Daily Prescription Intelligence         | 3-4            |
| 7      | Study Groups & Social Features          | 4-5            |
| 8      | Offline-First & Cloudflare Caching      | 4-5            |
| 9      | QA Automation & Drift Detection         | 3-4            |
| 10     | Rate Limiting & Error Resilience        | 3-4            |

---

## 🚀 Sprint 1: Critical Bug Fixes & Stability (Days 2-3)

### Objective

Fix all known production bugs and stabilize core study experience.

### Tasks

#### 1.1 Fix Remaining API Issues

- [x] **1.1.1** Audit all FK constraint errors - verify clerkId→userId lookup pattern everywhere
- [x] **1.1.2** Fix any remaining 401/500 errors in question pool/session endpoints
- [x] **1.1.3** Ensure generate-batch works without authentication (scheduled job) - Added CRON_SECRET support

#### 1.2 Console & Debug Cleanup

- [x] **1.2.1** Audit ALL console.log statements - gate behind DEBUG flags
- [x] **1.2.2** Remove development-only logging from production builds
- [x] **1.2.3** Add structured logging with levels (error, warn, info, debug) - Created lib/logger.ts

#### 1.3 UI/UX Bug Fixes

- [ ] **1.3.1** Fix difficulty selector options display
- [ ] **1.3.2** Fix loading state not clearing on API failures
- [x] **1.3.3** Fix question answer options not displaying (options/answers/choices normalization)

#### 1.4 Performance Quick Wins

- [x] **1.4.1** Split vendor chunk (already done)
- [ ] **1.4.2** Audit lazy loading - ensure large components load on demand
- [ ] **1.4.3** Add suspense boundaries to prevent cascading loading states

### Exit Criteria

- [ ] No 500 errors in production logs for 24 hours
- [ ] Console is clean in production (no dev logs)
- [ ] Core study flow works without interruption

---

## 🛡️ Sprint 2: Admin Dashboard & RBAC/RLS (Days 3-4)

### Objective

Get admin dashboard fully functional with proper security via Supabase RLS.

### Tasks

#### 2.1 Admin Dashboard Completion

- [x] **2.1.1** Wire up all admin stats endpoints:
  ```typescript
  // functions/api/admin/stats.ts
  - totalUsers, activeUsersToday ✅
  - totalStudySessions, averageAccuracy
  - pendingFlags, contentGaps
  ```
- [x] **2.1.2** Created admin check-access endpoint (functions/api/admin/check-access.ts)
- [ ] **2.1.3** Complete FlaggedQuestionsDashboard - review & resolve workflow
- [ ] **2.1.4** Add QuestionPerformanceDashboard - identify low-performing questions
- [ ] **2.1.5** Add ContentManagement panel - CRUD for MedicalContent

#### 2.2 Supabase RLS Implementation

- [x] **2.2.1** Enable RLS on all user tables:
  ```sql
  ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "UserQuestionHistory" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "SRSItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "QuestionAttempt" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
  ```
- [ ] **2.2.2** Create policies for user data isolation:
  ```sql
  CREATE POLICY "Users can only read own data" ON "UserQuestionHistory"
    FOR SELECT USING (auth.uid()::text = "userId");
  ```
- [ ] **2.2.3** Create policies for public content (MedicalContent, Condition, Drug)
- [ ] **2.2.4** Add admin bypass policy for superusers

#### 2.3 Role-Based Access Control

- [ ] **2.3.1** Verify Clerk→Prisma role sync (webhook)
- [ ] **2.3.2** Add role checks to all admin endpoints
- [ ] **2.3.3** Add UI indicators for role-restricted features

### Exit Criteria

- [ ] Admin dashboard loads with real data
- [ ] Non-admin users cannot access /admin routes
- [ ] RLS prevents users from querying other users' data

---

## 📚 Sprint 3: Content Pipeline & Missing Conditions (Days 3-4)

### Objective

Ensure complete PANCE blueprint coverage and automated content quality.

### Tasks

#### 3.1 Content Gap Analysis

- [ ] **3.1.1** Run audit against PANCE blueprint:
  ```typescript
  // scripts/audit/pance-coverage-audit.ts
  - Compare MedicalContent conditions vs PANCE blueprint
  - Generate gap report by system/category
  ```
- [ ] **3.1.2** Identify <10 condition systems (current gaps)
- [ ] **3.1.3** Prioritize high-yield missing conditions

#### 3.2 Automated Content Generation

- [ ] **3.2.1** Create orchestrator for missing conditions:
  ```typescript
  // scripts/orchestrate-missing-conditions.ts
  - Run condition-doctor for missing conditions
  - Auto-populate treatment, buzzwords, differentials
  ```
- [ ] **3.2.2** Run content fillers for incomplete entries
- [ ] **3.2.3** Generate questions for new conditions

#### 3.3 Content Validation

- [ ] **3.3.1** Add health-check for content completeness
- [ ] **3.3.2** Flag placeholder content for review
- [ ] **3.3.3** Add content quality scoring

### Exit Criteria

- [ ] 100% PANCE blueprint coverage
- [ ] No conditions with placeholder content
- [ ] Automated report of content health

---

## 🏥 Sprint 4: Enhanced Cases & Normal Values Database (Days 4-5)

### Objective

Improve case simulations with realistic lab/imaging ordering and create normal values reference.

### Tasks

#### 4.1 Normal Values Database

- [ ] **4.1.1** Create NormalValue schema:

  ```prisma
  model NormalLabValue {
    id              String   @id
    testName        String
    normalRange     String
    units           String
    modality        String   // "CBC", "BMP", "LFTs", "UA", etc.
    sampleValue     Float    // A specific "normal" value
    description     String?
    criticalLow     Float?
    criticalHigh    Float?
  }

  model NormalImagingFinding {
    id              String   @id
    modality        String   // "CXR", "CT", "MRI", "US"
    region          String   // "Chest", "Abdomen", "Head"
    finding         String   // "Normal cardiac silhouette"
    description     String
    variants        String[] // Normal variants
  }
  ```

- [ ] **4.1.2** Seed 50+ normal lab values per panel
- [ ] **4.1.3** Seed 50+ normal imaging findings per modality
- [ ] **4.1.4** Add "normal result" generator that varies within range

#### 4.2 Case Enhancement

- [ ] **4.2.1** Add "ordering" step to case simulations:
  ```typescript
  interface CaseOrderingStep {
    availableTests: string[]; // Labs, imaging, procedures
    optimalOrders: string[]; // What should be ordered
    unnecessaryOrders: string[]; // Penalize these
    pertinentNegatives: string[]; // Important normals
  }
  ```
- [ ] **4.2.2** Integrate normal values into case results
- [ ] **4.2.3** Add "not pertinent" responses for irrelevant orders
- [ ] **4.2.4** Score ordering efficiency (avoid unnecessary tests)

#### 4.3 Case Data Enrichment

- [ ] **4.3.1** Enhance labCasesData with ordering metadata
- [ ] **4.3.2** Add imaging case templates
- [ ] **4.3.3** Create "virtual patient" data generator

### Exit Criteria

- [ ] Cases include realistic ordering step
- [ ] Normal values can't be memorized (50+ per modality)
- [ ] Scoring penalizes shotgun ordering

---

## 🧠 Sprint 5: Differential Ranking & Socratic Hints (Days 3-4)

### Objective

Require clinical reasoning with differential ranking and provide guided learning when wrong.

### Tasks

#### 5.1 Differential Ranking Step

- [ ] **5.1.1** Add DDxRanking component to case workflow:
  ```typescript
  interface DifferentialRankingStep {
    presentingComplaint: string;
    clinicalFindings: string[];
    candidateDiagnoses: string[]; // 6-8 options
    requiredRanking: 3; // Top 3
    justificationRequired: boolean;
  }
  ```
- [ ] **5.1.2** Score ranking (partial credit for correct dx in wrong position)
- [ ] **5.1.3** Require brief justification for each ranked differential
- [ ] **5.1.4** Show final case outcome AFTER ranking submission

#### 5.2 Socratic Hint Enhancement

- [ ] **5.2.1** Verify SocraticHintService works in all drill modes:
  - Condition Drill ✅ (already implemented)
  - DDx Drill
  - Case Simulations
  - Photo Drill
- [ ] **5.2.2** Add hint tracking to analytics:
  ```typescript
  // Track hint usage per question
  await prisma.questionAttempt.update({
    where: { id: attemptId },
    data: {
      hintsUsed: { increment: 1 },
      hintLevel: currentHintLevel,
    },
  });
  ```
- [ ] **5.2.3** Add "Why was I wrong?" button after reveal
- [ ] **5.2.4** Cache hints per question (avoid regeneration)

#### 5.3 Coaching Integration

- [ ] **5.3.1** Integrate coaching into all wrong-answer flows
- [ ] **5.3.2** Add misconception tracking (common wrong answers)
- [ ] **5.3.3** Generate targeted review based on misconceptions

### Exit Criteria

- [ ] Cases require differential ranking before outcome
- [ ] All drills offer Socratic hints on wrong answers
- [ ] Hint usage tracked for analytics

---

## 📅 Sprint 6: Daily Prescription Intelligence (Days 3-4)

### Objective

Create intelligent, personalized daily study plans based on user performance.

### Tasks

#### 6.1 Daily Prescription Engine

- [ ] **6.1.1** Create DailyPrescriptionService:

  ```typescript
  interface DailyPrescription {
    userId: string;
    date: Date;
    recommendations: PrescriptionItem[];
    estimatedTime: number; // minutes
    focusAreas: string[];
    avoidAreas: string[]; // Already mastered
  }

  interface PrescriptionItem {
    type: 'review' | 'new' | 'weakness' | 'maintenance';
    conditionId?: string;
    drillMode: string;
    questionCount: number;
    reason: string;
    priority: number;
  }
  ```

- [ ] **6.1.2** Integrate FSRS due items (SRS review)
- [ ] **6.1.3** Add weakness detection from analytics
- [ ] **6.1.4** Add "maintenance" items for mastered topics (spaced out)

#### 6.2 Trend Analysis

- [ ] **6.2.1** Implement trend detection:
  ```typescript
  // Detect declining performance in a system
  function detectTrends(userId: string, days: number = 7) {
    // Compare last 7 days vs previous 7 days
    // Flag systems with >10% accuracy drop
  }
  ```
- [ ] **6.2.2** Generate "attention needed" alerts
- [ ] **6.2.3** Suggest content based on upcoming exam date (if set)

#### 6.3 Daily Grand Rounds

- [ ] **6.3.1** Enhance dailyTasks.ts to generate Grand Rounds:
  ```typescript
  // Daily challenge with leaderboard
  async function createDailyGrandRounds() {
    const todayCondition = await selectHighYieldCondition();
    const questions = await generateChallengeQuestions(todayCondition, 10);
    await prisma.dailyChallenge.create({
      data: {
        date: today,
        conditionId: todayCondition.id,
        questions: questions,
        leaderboardEnabled: true,
      },
    });
  }
  ```
- [ ] **6.3.2** Add Grand Rounds UI component
- [ ] **6.3.3** Add daily leaderboard

### Exit Criteria

- [ ] Each user gets personalized daily prescription
- [ ] Trend alerts surface declining areas
- [ ] Daily Grand Rounds generated automatically

---

## 👥 Sprint 7: Study Groups & Social Features (Days 4-5)

### Objective

Operationalize StudyGroupMember schema for cohorts, streaks, and private leaderboards.

### Tasks

#### 7.1 Study Group Management

- [ ] **7.1.1** Create study group APIs:
  ```typescript
  // functions/api/study-groups/
  - POST /create - Create new group
  - POST /join - Join via code
  - GET /my-groups - List user's groups
  - GET /:groupId - Group details
  - GET /:groupId/members - Member list
  - GET /:groupId/leaderboard - Private leaderboard
  ```
- [ ] **7.1.2** Add group creation UI:
  - Name, description, privacy setting
  - Generate unique join code
  - Set admin (owner)
- [ ] **7.1.3** Add join group flow (enter code)

#### 7.2 Streak Sharing

- [ ] **7.2.1** Add streak to user profile:
  ```typescript
  interface UserStreak {
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: Date;
    streakFreezesUsed: number;
  }
  ```
- [ ] **7.2.2** Display group member streaks
- [ ] **7.2.3** Add streak notifications (celebrate milestones)

#### 7.3 Private Leaderboards

- [ ] **7.3.1** Implement group leaderboard calculation:
  ```typescript
  // Weekly accuracy, questions answered, streak
  async function getGroupLeaderboard(groupId: string) {
    const members = await prisma.studyGroupMember.findMany({
      where: { groupId },
      include: { User: true },
    });
    // Calculate weekly stats for each member
    // Rank by composite score
  }
  ```
- [ ] **7.3.2** Add leaderboard UI with rankings
- [ ] **7.3.3** Add time period filters (week, month, all-time)

#### 7.4 Group Activity Feed

- [ ] **7.4.1** Create activity feed for groups
- [ ] **7.4.2** Show member achievements
- [ ] **7.4.3** Add encouragement/reactions

### Exit Criteria

- [ ] Users can create/join study groups
- [ ] Streaks visible within groups
- [ ] Private leaderboards functional

---

## 📴 Sprint 8: Offline-First & Cloudflare Caching (Days 4-5)

### Objective

Full offline capability with smart caching and transparent sync.

### Tasks

#### 8.1 Enhanced ServiceWorker

- [ ] **8.1.1** Pre-cache user's Daily Prescription:
  ```typescript
  // In ServiceWorker
  async function preCacheDailyPrescription(userId: string) {
    const prescription = await fetch(`/api/daily-prescription/${userId}`);
    const cache = await caches.open('daily-prescription-v1');
    await cache.put(`/daily-prescription/${userId}`, prescription);
  }
  ```
- [ ] **8.1.2** Cache recent question batches for offline use
- [ ] **8.1.3** Cache condition content for offline reference

#### 8.2 Background Sync

- [ ] **8.2.1** Implement conflict resolution:

  ```typescript
  interface SyncConflict {
    local: PerformanceRecord;
    remote: PerformanceRecord;
    resolution: 'local' | 'remote' | 'merge';
  }

  function resolveConflict(conflict: SyncConflict): PerformanceRecord {
    // Prefer more recent timestamp
    // Merge if both have unique data
  }
  ```

- [ ] **8.2.2** Add transparent sync on reconnection
- [ ] **8.2.3** Show sync status indicator (non-intrusive)

#### 8.3 Cloudflare KV/Durable Objects

- [ ] **8.3.1** Cache GET /api/conditions in KV:
  ```typescript
  // functions/api/conditions/index.ts
  export async function onRequestGet(context: EventContext) {
    const cached = await context.env.CONDITION_CACHE.get('all-conditions');
    if (cached)
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });

    const conditions = await fetchConditions();
    await context.env.CONDITION_CACHE.put('all-conditions', JSON.stringify(conditions), {
      expirationTtl: 3600, // 1 hour
    });
    return new Response(JSON.stringify(conditions));
  }
  ```
- [ ] **8.3.2** Add KV caching for drugs, labs, imaging
- [ ] **8.3.3** Invalidate cache on admin content updates

### Exit Criteria

- [ ] Users can study in airplane mode
- [ ] Sync happens transparently on reconnect
- [ ] Condition queries return in <50ms globally

---

## 🔬 Sprint 9: QA Automation & Drift Detection (Days 3-4)

### Objective

Automated testing, content freshness monitoring, and error reporting.

### Tasks

#### 9.1 Synthetic User Testing

- [ ] **9.1.1** Create TestUserBot:
  ```typescript
  // scripts/qa/synthetic-user.ts
  class SyntheticUser {
    async runFullSession() {
      await this.login();
      await this.selectDrillMode('condition');
      await this.answerQuestions(10);
      await this.checkAnalytics();
      await this.testSettings();
    }
  }
  ```
- [ ] **9.1.2** Schedule synthetic tests (daily)
- [ ] **9.1.3** Alert on test failures

#### 9.2 Drift Detection

- [ ] **9.2.1** Track content freshness:
  ```typescript
  // scripts/automation/drift-detection.ts
  async function detectStaleContent() {
    const stale = await prisma.medicalContent.findMany({
      where: {
        updatedAt: { lt: sixMonthsAgo },
        // Content that references treatments (likely to change)
        treatment: { not: null },
      },
    });

    // Flag for admin review
    for (const content of stale) {
      await prisma.adminReviewQueue.create({
        data: {
          type: 'content_drift',
          entityType: 'MedicalContent',
          entityId: content.id,
          reason: `Treatment plan not updated since ${content.updatedAt}`,
          priority: 'medium',
        },
      });
    }
  }
  ```
- [ ] **9.2.2** Add guideline version tracking
- [ ] **9.2.3** Auto-flag outdated treatment plans

#### 9.3 Flag Error Button

- [ ] **9.3.1** Add "Flag Error" to all drill question cards:
  ```typescript
  interface QuestionFlag {
    questionId: string;
    userId: string;
    flagType: 'incorrect_answer' | 'outdated' | 'unclear' | 'typo' | 'other';
    description: string;
    timestamp: Date;
  }
  ```
- [ ] **9.3.2** Create Admin Feedback Queue viewer
- [ ] **9.3.3** Implement flag resolution workflow

### Exit Criteria

- [ ] Daily synthetic tests catch regressions
- [ ] Stale content automatically flagged
- [ ] Students can report errors easily

---

## 🔒 Sprint 10: Rate Limiting & Error Resilience (Days 3-4)

### Objective

Prevent budget blowout and graceful degradation on failures.

### Tasks

#### 10.1 Tiered Rate Limiting

- [x] **10.1.1** Implement per-user rate limits:
  ```typescript
  // functions/api/_shared/rateLimiter.ts ✅ CREATED
  const RATE_LIMITS = {
    gemini: { maxRequests: 20, windowSeconds: 3600 },
    questions: { maxRequests: 100, windowSeconds: 3600 },
    standard: { maxRequests: 300, windowSeconds: 3600 },
    auth: { maxRequests: 10, windowSeconds: 300 },
    admin: { maxRequests: 50, windowSeconds: 3600 },
  };
  ```
- [x] **10.1.2** Add rate limit headers to responses - X-RateLimit-Limit/Remaining/Reset
- [x] **10.1.3** Applied rate limiting to geminiProxy.ts
- [x] **10.1.4** Applied rate limiting to questions/generate.ts
- [ ] **10.1.5** Create "budget exceeded" graceful UI
- [ ] **10.1.6** Configure Cloudflare KV for distributed rate limiting

#### 10.2 Error Boundaries

- [x] **10.2.1** Add error boundaries around all major components:
  ```typescript
  // components/error/DrillErrorBoundary.tsx ✅ CREATED
  <DrillErrorBoundary fallback={<DrillOfflineFallback />}>
    <ConditionDrillSession />
  </DrillErrorBoundary>
  ```
- [x] **10.2.2** Create fallback UIs:
  - Offline mode fallback ✅
  - API error fallback (retry button) ✅
  - Budget exceeded fallback ✅
- [ ] **10.2.3** Add error recovery actions

#### 10.3 Graceful Degradation

- [ ] **10.3.1** Queue generation requests when rate limited:
  ```typescript
  // If rate limited, queue for later
  if (!rateLimitCheck.allowed) {
    await queueForLater(request);
    return { queued: true, retryAfter: rateLimitCheck.retryAfter };
  }
  ```
- [x] **10.3.2** Use cached questions when generation fails - DrillErrorBoundary has useCachedQuestions
- [ ] **10.3.3** Show degraded mode indicator

#### 10.4 Monitoring & Alerts

- [ ] **10.4.1** Add budget tracking:
  ```typescript
  // Track Gemini API usage
  await prisma.apiUsage.create({
    data: {
      endpoint: 'gemini/generateContent',
      userId,
      tokens: response.usage.totalTokens,
      cost: calculateCost(response.usage),
    },
  });
  ```
- [ ] **10.4.2** Alert when approaching budget limits
- [ ] **10.4.3** Dashboard for usage monitoring

### Exit Criteria

- [ ] Single user can't blow budget
- [ ] Site stays up when Gemini is down
- [ ] Rate limit errors are user-friendly

---

## 📊 Progress Tracking

### Sprint Completion Checklist

| Sprint                 | Started | Completed | Notes |
| ---------------------- | ------- | --------- | ----- |
| 1 - Bug Fixes          | [ ]     | [ ]       |       |
| 2 - Admin/RBAC         | [ ]     | [ ]       |       |
| 3 - Content Pipeline   | [ ]     | [ ]       |       |
| 4 - Cases/Normals      | [ ]     | [ ]       |       |
| 5 - DDx/Socratic       | [ ]     | [ ]       |       |
| 6 - Daily Prescription | [ ]     | [ ]       |       |
| 7 - Study Groups       | [ ]     | [ ]       |       |
| 8 - Offline/Caching    | [ ]     | [ ]       |       |
| 9 - QA/Drift           | [ ]     | [ ]       |       |
| 10 - Rate Limits       | [ ]     | [ ]       |       |

### Key Metrics to Track

- API error rate
- Average question load time
- User retention (daily active)
- Content coverage (% of PANCE blueprint)
- Gemini API costs

---

## 🎯 Post-Sprint Priorities

After completing these 10 sprints, consider:

1. Mobile app (React Native)
2. Voice-based study mode (commuter mode enhancement)
3. Integration with clinical rotation schedules
4. Predictive exam readiness scoring
5. Video content integration
