# PANaCEa Production Sprint Plan
## 12-Week Sprint Roadmap (6 Sprints)

---

## Overview

| Sprint | Focus | Duration | Priority |
|--------|-------|----------|----------|
| **Sprint 1** | Content Foundation | Weeks 1-2 | 🔴 Critical |
| **Sprint 2** | Database & Normal References | Weeks 3-4 | 🔴 Critical |
| **Sprint 3** | Admin Tools & Security | Weeks 5-6 | 🟠 High |
| **Sprint 4** | Offline & Performance | Weeks 7-8 | 🟠 High |
| **Sprint 5** | Social & Analytics | Weeks 9-10 | 🟡 Medium |
| **Sprint 6** | Polish & Launch | Weeks 11-12 | 🟢 Launch |

---

# 🏃 Sprint 1: Content Foundation
**Weeks 1-2 | Priority: 🔴 CRITICAL**

## Goals
- Complete image import with AI verification
- Fill content gaps for high-yield conditions
- Set up physical exam finding images

---

### Week 1: Image Completion

#### Day 1-2: Monitor & Complete Image Upload
- [ ] **S1.1** Monitor current image upload (PID running)
  ```bash
  tail -f /Users/aaronullger/Documents/GitHub/StudyPANaCEa/image-upload-*.log
  ```
- [ ] **S1.2** Run gap analysis when complete
  ```bash
  npx tsx scripts/analysis/comprehensive-pance-image-gap-analysis.ts
  ```
- [ ] **S1.3** Review upload summary report

#### Day 3-4: Image Gap Remediation
- [ ] **S1.4** Identify top 50 PANCE conditions missing images
- [ ] **S1.5** Source additional images from:
  - DermNet NZ (CC-licensed dermatology)
  - Radiopaedia (radiology)
  - Life in the Fast Lane (ECG)
  - OpenStax Anatomy (anatomy/pathology)
- [ ] **S1.6** Run targeted upload for gap conditions

#### Day 5: Physical Exam Finding Setup
- [ ] **S1.7** Add `findingId` FK to MediaAsset schema
  ```prisma
  model MediaAsset {
    findingId           String?
    PhysicalExamFinding PhysicalExamFinding? @relation(fields: [findingId], references: [id])
  }
  ```
- [ ] **S1.8** Create migration: `npx prisma migrate dev --name add_finding_fk`
- [ ] **S1.9** Map physical exam findings to image needs

---

### Week 2: Content Generation

#### Day 1-2: Content Audit & Generation Setup
- [ ] **S1.10** Audit current MedicalContent completeness
  ```bash
  npx tsx scripts/analysis/content-completeness-audit.ts
  ```
- [ ] **S1.11** Create content generation script
  ```bash
  # scripts/content/generate-condition-content.ts
  npx tsx scripts/content/generate-condition-content.ts --priority high-yield
  ```
- [ ] **S1.12** Set up content review workflow

#### Day 3-4: Generate High-Yield Content
- [ ] **S1.13** Generate content for top 100 PANCE conditions
- [ ] **S1.14** Validate against UpToDate/authoritative sources
- [ ] **S1.15** Populate explanation fields for all questions

#### Day 5: Sprint 1 Review
- [ ] **S1.16** Run comprehensive content validation
- [ ] **S1.17** Document remaining gaps for Sprint 2
- [ ] **S1.18** Update SPRINT_PLAN.md with actuals

---

### Sprint 1 Acceptance Criteria
- ✅ 5,000+ images uploaded with AI verification
- ✅ 95%+ of high-yield PANCE conditions have images
- ✅ All conditions have at least basic MedicalContent
- ✅ Physical exam FK structure ready

### Sprint 1 Deliverables
- Image upload complete with manifest
- Content generation script operational
- Gap analysis report

---

# 🏃 Sprint 2: Database & Normal References
**Weeks 3-4 | Priority: 🔴 CRITICAL**

## Goals
- Implement NormalReference tables (labs, imaging, vitals, PE)
- Seed 50+ normals per modality
- Deepen FK relationships across schema

---

### Week 1: Normal Reference Infrastructure

#### Day 1-2: Schema Implementation
- [x] **S2.1** Create NormalLabValue table (DONE)
- [x] **S2.2** Create NormalImagingFinding table (DONE)
- [x] **S2.3** Create NormalVitalSign table (DONE)
- [x] **S2.4** Create NormalPhysicalExamFinding table (DONE)
- [x] **S2.5** Push schema changes (DONE)

#### Day 3-4: Lab Value Seeding
- [ ] **S2.6** Create lab value seed script
  ```bash
  # scripts/seed/seed-normal-lab-values.ts
  npx tsx scripts/seed/seed-normal-lab-values.ts
  ```
- [ ] **S2.7** Seed CBC normals (10+ variations by age/sex)
  - WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, MCH, MCHC, RDW
- [ ] **S2.8** Seed BMP normals (10+ variations)
  - Na, K, Cl, CO2, BUN, Creatinine, Glucose, Calcium
- [ ] **S2.9** Seed LFT normals
  - AST, ALT, ALP, GGT, Total Bilirubin, Direct Bilirubin, Albumin
- [ ] **S2.10** Seed additional panels
  - Lipid Panel, Coagulation, Thyroid, Cardiac Markers, UA

#### Day 5: Imaging Normals
- [ ] **S2.11** Create imaging normals seed script
- [ ] **S2.12** Seed CXR normal findings (PA, Lateral)
- [ ] **S2.13** Seed CT Head normal findings
- [ ] **S2.14** Seed Echo normal values
- [ ] **S2.15** Seed X-ray normals (extremity, spine, abdomen)

---

### Week 2: FK Deepening & Case Enhancement

#### Day 1-2: Additional Foreign Keys
- [ ] **S2.16** Add procedureId FK to MediaAsset
- [ ] **S2.17** Add anatomyId FK to MediaAsset
- [ ] **S2.18** Add drugId FK to MediaAsset
- [ ] **S2.19** Create migration and apply
- [ ] **S2.20** Update image processing to populate new FKs

#### Day 3-4: Case Generation Enhancement
- [ ] **S2.21** Enhance PatientEncounterCase schema
  ```prisma
  model PatientEncounterCase {
    appropriateWorkup     Json     // { labs: [...], imaging: [...] }
    unnecessaryWorkup     Json     // Tests that shouldn't be ordered
    normalExpectedResults String[] // Which tests return normal
    criticalFindings      String[] // "Don't miss" findings
  }
  ```
- [ ] **S2.22** Create case workup validation service
- [ ] **S2.23** Generate 100 comprehensive cases with workup knowledge
- [ ] **S2.24** Integrate random normal selection into case generation

#### Day 5: Sprint 2 Review
- [ ] **S2.25** Validate all normal reference data
- [ ] **S2.26** Test case generation with normals
- [ ] **S2.27** Performance test database queries

---

### Sprint 2 Acceptance Criteria
- ✅ 50+ normal values per lab category
- ✅ 20+ normal imaging findings per modality
- ✅ All vital signs with age/sex variations
- ✅ MediaAsset linked to 5+ entity types
- ✅ Case generation pulls random normals

### Sprint 2 Deliverables
- Normal reference seeding scripts
- Enhanced case generation system
- FK relationship documentation

---

# 🏃 Sprint 3: Admin Tools & Security
**Weeks 5-6 | Priority: 🟠 HIGH**

## Goals
- Complete admin image review UI
- Implement Supabase RLS policies
- Set up rate limiting for API protection

---

### Week 1: Admin Tools

#### Day 1-2: Image Review UI Enhancement
- [ ] **S3.1** Add keyboard shortcuts to MediaApprovalDashboard
  - `A` = Approve, `R` = Reject, `F` = Flag, `→/←` = Navigate
- [ ] **S3.2** Add bulk selection and batch operations
- [ ] **S3.3** Add image condition reassignment dropdown
- [ ] **S3.4** Add quality score slider

#### Day 3-4: Admin Feedback Queue
- [ ] **S3.5** Create FlaggedContent table
  ```prisma
  model FlaggedContent {
    id          String   @id @default(cuid())
    contentType String   // 'question', 'image', 'content'
    contentId   String
    flagType    String   // 'error', 'outdated', 'inappropriate', 'unclear'
    description String
    userId      String
    status      String   @default("pending") // pending, resolved, dismissed
    resolvedBy  String?
    resolvedAt  DateTime?
    resolution  String?
    createdAt   DateTime @default(now())
  }
  ```
- [ ] **S3.6** Implement "Flag Error" button on all content
- [ ] **S3.7** Create AdminFeedbackQueue component
- [ ] **S3.8** Add notification system for new flags

#### Day 5: Content Drift Detection
- [ ] **S3.9** Create drift detection service
  ```typescript
  // services/driftDetectionService.ts
  interface DriftCheck {
    conditionId: string;
    lastVerified: Date;
    guidelines: GuidelineReference[];
    needsReview: boolean;
    staleDays: number;
  }
  ```
- [ ] **S3.10** Add `lastVerifiedAt` field to MedicalContent
- [ ] **S3.11** Create weekly drift detection cron job

---

### Week 2: Security Implementation

#### Day 1-2: Supabase RLS Policies
- [ ] **S3.12** Create RLS policy for User table
  ```sql
  -- Users can only read/update their own record
  CREATE POLICY user_self_access ON "User"
    FOR ALL USING (auth.uid()::text = id);
  ```
- [ ] **S3.13** Create RLS policy for UserProgress
- [ ] **S3.14** Create RLS policy for QuestionAttempt
- [ ] **S3.15** Create RLS policy for StudySession
- [ ] **S3.16** Enable RLS on all user-specific tables

#### Day 3-4: Rate Limiting
- [ ] **S3.17** Implement Cloudflare rate limiting rules
  ```typescript
  // functions/api/_shared/rateLimiter.ts
  const RATE_LIMITS = {
    gemini: { requests: 60, window: '1m' },
    api: { requests: 100, window: '15m' },
    auth: { requests: 10, window: '1m' },
  };
  ```
- [ ] **S3.18** Add Redis-backed rate limiter for Gemini API
- [ ] **S3.19** Implement cost tracking dashboard
- [ ] **S3.20** Set up budget alerts in Google Cloud

#### Day 5: Sprint 3 Review
- [ ] **S3.21** Security audit of all endpoints
- [ ] **S3.22** Test RLS policies with different user roles
- [ ] **S3.23** Load test rate limiting

---

### Sprint 3 Acceptance Criteria
- ✅ Admin can review 100 images in <10 minutes (keyboard shortcuts)
- ✅ All user data protected by RLS
- ✅ Rate limiting prevents budget blowout
- ✅ Content flagging operational

### Sprint 3 Deliverables
- Enhanced admin dashboard
- RLS policy documentation
- Rate limiting configuration

---

# 🏃 Sprint 4: Offline & Performance
**Weeks 7-8 | Priority: 🟠 HIGH**

## Goals
- Full PWA with pre-cached daily prescription
- Background sync with conflict resolution
- Cloudflare KV for fast queries

---

### Week 1: PWA Enhancement

#### Day 1-2: Service Worker Upgrade
- [ ] **S4.1** Audit current service worker caching strategy
- [ ] **S4.2** Implement stale-while-revalidate for API responses
- [ ] **S4.3** Pre-cache Daily Prescription on login
  ```typescript
  // Prefetch on authentication
  async function prefetchDailyPrescription(userId: string) {
    const prescription = await api.getDailyPrescription(userId);
    await cacheStore.set(`daily_prescription_${userId}`, prescription);
  }
  ```
- [ ] **S4.4** Cache condition content for offline study

#### Day 3-4: Background Sync
- [ ] **S4.5** Implement IndexedDB queue for offline actions
  ```typescript
  interface OfflineAction {
    id: string;
    action: 'answer_question' | 'complete_session' | 'update_bookmark';
    payload: Record<string, unknown>;
    timestamp: Date;
    retryCount: number;
  }
  ```
- [ ] **S4.6** Create background sync handler
- [ ] **S4.7** Implement conflict resolution strategy
  - Server wins for SRS data (most recent)
  - Client wins for bookmarks (merge)
  - Alert user for session conflicts
- [ ] **S4.8** Add sync status indicator to UI

#### Day 5: Offline Testing
- [ ] **S4.9** Test complete offline workflow
- [ ] **S4.10** Test sync after 24hr offline
- [ ] **S4.11** Test conflict resolution scenarios

---

### Week 2: Performance Optimization

#### Day 1-2: Cloudflare KV Implementation
- [ ] **S4.12** Set up Cloudflare KV namespaces
  ```toml
  # wrangler.toml
  [[kv_namespaces]]
  binding = "CONDITION_CACHE"
  id = "xxx"
  
  [[kv_namespaces]]
  binding = "QUESTION_CACHE"
  id = "xxx"
  ```
- [ ] **S4.13** Implement condition content caching in KV
- [ ] **S4.14** Implement question pool caching in KV
- [ ] **S4.15** Add cache invalidation hooks

#### Day 3-4: Query Optimization
- [ ] **S4.16** Add database indexes for common queries
- [ ] **S4.17** Implement pagination for large result sets
- [ ] **S4.18** Add response compression
- [ ] **S4.19** Optimize bundle chunking
  ```typescript
  // vite.config.ts - review and optimize
  manualChunks: {
    'vendor-core': ['react', 'react-dom'],
    'vendor-animation': ['framer-motion'],
    'data-conditions': [...],
  }
  ```

#### Day 5: Sprint 4 Review
- [ ] **S4.20** Lighthouse audit (target: 90+ all categories)
- [ ] **S4.21** Test offline functionality end-to-end
- [ ] **S4.22** Measure cold start times

---

### Sprint 4 Acceptance Criteria
- ✅ App works fully offline with cached content
- ✅ Sync resumes seamlessly when online
- ✅ Lighthouse performance score 90+
- ✅ API responses <200ms (cached)

### Sprint 4 Deliverables
- PWA offline capability
- Background sync implementation
- KV caching layer

---

# 🏃 Sprint 5: Social & Analytics
**Weeks 9-10 | Priority: 🟡 MEDIUM**

## Goals
- Study group cohorts with private leaderboards
- PANCE percentile comparisons
- Enhanced analytics dashboard

---

### Week 1: Social Features

#### Day 1-2: Study Group Implementation
- [ ] **S5.1** Create StudyGroup table
  ```prisma
  model StudyGroup {
    id          String   @id @default(cuid())
    name        String
    description String?
    code        String   @unique // Join code
    creatorId   String
    isPrivate   Boolean  @default(true)
    maxMembers  Int      @default(50)
    createdAt   DateTime @default(now())
    members     StudyGroupMember[]
  }
  
  model StudyGroupMember {
    id           String     @id @default(cuid())
    groupId      String
    userId       String
    role         String     @default("member") // admin, member
    joinedAt     DateTime   @default(now())
    StudyGroup   StudyGroup @relation(fields: [groupId], references: [id])
    @@unique([groupId, userId])
  }
  ```
- [ ] **S5.2** Implement group creation UI
- [ ] **S5.3** Implement join by code flow
- [ ] **S5.4** Create group leaderboard component

#### Day 3-4: Private Leaderboards
- [ ] **S5.5** Create GroupLeaderboard component
- [ ] **S5.6** Calculate group-relative percentiles
- [ ] **S5.7** Add weekly/monthly group challenges
- [ ] **S5.8** Implement group activity feed

#### Day 5: Social Polish
- [ ] **S5.9** Add group chat/comments (optional)
- [ ] **S5.10** Create group analytics view
- [ ] **S5.11** Test multi-user group scenarios

---

### Week 2: Analytics & Comparisons

#### Day 1-2: PANCE Percentile System
- [ ] **S5.12** Implement PANCE score estimation algorithm
  ```typescript
  interface PANCEEstimate {
    estimatedScore: number;    // 200-800 scale
    confidence: number;        // 0-1
    percentile: number;        // Compared to all users
    systemBreakdown: Record<string, number>;
    improvementAreas: string[];
  }
  ```
- [ ] **S5.13** Create percentile comparison visualization
- [ ] **S5.14** Add historical score tracking
- [ ] **S5.15** Generate personalized study recommendations

#### Day 3-4: Analytics Dashboard Enhancement
- [ ] **S5.16** Add system-by-system performance heatmap
- [ ] **S5.17** Add time-based performance trends
- [ ] **S5.18** Add question difficulty analysis
- [ ] **S5.19** Add study time optimization suggestions

#### Day 5: Sprint 5 Review
- [ ] **S5.20** Test group features with mock users
- [ ] **S5.21** Validate percentile calculations
- [ ] **S5.22** Performance test analytics queries

---

### Sprint 5 Acceptance Criteria
- ✅ Users can create/join study groups
- ✅ Private leaderboards show group rankings
- ✅ PANCE percentile shows user vs cohort
- ✅ Analytics dashboard comprehensive

### Sprint 5 Deliverables
- Study group functionality
- Percentile comparison system
- Enhanced analytics views

---

# 🏃 Sprint 6: Polish & Launch
**Weeks 11-12 | Priority: 🟢 LAUNCH**

## Goals
- Error handling and monitoring
- SocraticHintService integration
- Final testing and deployment

---

### Week 1: Error Handling & Monitoring

#### Day 1-2: Error Boundary Enhancement
- [ ] **S6.1** Add granular error boundaries
  ```typescript
  // components/error/DrillErrorBoundary.tsx
  // components/error/APIErrorBoundary.tsx
  // components/error/QuizErrorBoundary.tsx
  ```
- [ ] **S6.2** Create graceful fallback UIs
- [ ] **S6.3** Implement automatic retry for transient errors
- [ ] **S6.4** Add user-friendly error messages

#### Day 3-4: Monitoring Setup
- [ ] **S6.5** Integrate Sentry for error tracking
  ```bash
  npm install @sentry/react @sentry/tracing
  ```
- [ ] **S6.6** Configure Sentry with source maps
- [ ] **S6.7** Set up error alerting thresholds
- [ ] **S6.8** Create operations dashboard

#### Day 5: SocraticHintService Integration
- [ ] **S6.9** Integrate hints into QuizView wrong answers
- [ ] **S6.10** Add "Get Hint" button to stuck questions
- [ ] **S6.11** Track hint usage analytics
- [ ] **S6.12** Add hint quality feedback

---

### Week 2: Final Testing & Launch

#### Day 1-2: Comprehensive Testing
- [ ] **S6.13** Run full E2E test suite
  ```bash
  npm test
  npm run health-check
  ```
- [ ] **S6.14** Manual QA of all critical paths
  - User signup → Quiz → Results → Progress
  - Admin → Content management → Approval
  - Offline → Sync → Conflict resolution
- [ ] **S6.15** Security penetration testing
- [ ] **S6.16** Load testing (simulate 1000 concurrent users)

#### Day 3-4: Production Deployment
- [ ] **S6.17** Review PRODUCTION_DEPLOYMENT_CHECKLIST.md
- [ ] **S6.18** Final environment variable audit
- [ ] **S6.19** Database backup before deployment
- [ ] **S6.20** Deploy to production
- [ ] **S6.21** Smoke test all endpoints
- [ ] **S6.22** Monitor error rates post-deployment

#### Day 5: Launch! 🚀
- [ ] **S6.23** Enable production traffic
- [ ] **S6.24** Monitor performance metrics
- [ ] **S6.25** Respond to initial user feedback
- [ ] **S6.26** Document known issues

---

### Sprint 6 Acceptance Criteria
- ✅ Zero critical errors in 24hr monitoring
- ✅ All E2E tests passing
- ✅ Load test passes (1000 concurrent)
- ✅ Production deployment successful

### Sprint 6 Deliverables
- Production-ready application
- Monitoring and alerting
- Launch documentation

---

# 📊 Sprint Progress Tracker

| Sprint | Status | Start | End | Notes |
|--------|--------|-------|-----|-------|
| Sprint 1 | 🟡 In Progress | Week 1 | Week 2 | Image upload running |
| Sprint 2 | 🟢 Started | Week 3 | Week 4 | Schema done |
| Sprint 3 | ⚪ Not Started | Week 5 | Week 6 | |
| Sprint 4 | ⚪ Not Started | Week 7 | Week 8 | |
| Sprint 5 | ⚪ Not Started | Week 9 | Week 10 | |
| Sprint 6 | ⚪ Not Started | Week 11 | Week 12 | |

---

# 🔗 Quick Links

- [PRODUCTION_READINESS_MASTER_PLAN.md](./PRODUCTION_READINESS_MASTER_PLAN.md) - Detailed implementation guide
- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Deploy checklist
- [DATABASE_IMPLEMENTATION.md](./DATABASE_IMPLEMENTATION.md) - Schema documentation
- [CLOUDFLARE_FUNCTIONS_GUIDE.md](./CLOUDFLARE_FUNCTIONS_GUIDE.md) - API patterns

---

## Daily Standup Template

```markdown
## Date: YYYY-MM-DD

### Yesterday
- [ ] Completed task X
- [ ] Completed task Y

### Today
- [ ] Working on task Z
- [ ] Blocked by: (if any)

### Blockers
- None / Description of blocker

### Notes
- Any observations or decisions
```
