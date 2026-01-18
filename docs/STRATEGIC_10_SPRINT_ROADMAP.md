# StudyPANaCEa: Strategic 10-Sprint Roadmap

> **Version:** 1.0.0  
> **Created:** January 8, 2026  
> **Goal:** Production-ready PANCE/PANRE-LA simulation platform

Each sprint is 1-2 weeks and builds toward the ultimate goal. Sprints are dependency-ordered - complete them in sequence for best results.

---

## 🏁 SPRINT 1: "Launch Foundation"

**Goal:** Go live with core functionality working reliably  
**Duration:** 1 week  
**Status:** [ ] Not Started

### Tasks

- [ ] **Deploy to Cloudflare Pages** - Basic deployment with environment variables
- [ ] **Health Check Endpoint** - `/api/health` returns DB, cache, auth status
- [ ] **Global Error Boundaries** - Catch React errors gracefully, log to console
- [ ] **Rate Limiting (Basic)** - Protect Gemini API with 60 req/min per user
- [ ] **Fix Critical Bugs** - Any blockers preventing basic quiz flow
- [ ] **Smoke Test Checklist** - Manual QA of login → quiz → results flow

### Acceptance Criteria

- [ ] Site is live at production URL
- [ ] Users can sign up, start a quiz, and see results
- [ ] No uncaught errors crash the app
- [ ] Gemini API is protected from abuse

### Files to Create/Modify

- `functions/api/health.ts` (verify complete)
- `components/error/GlobalErrorBoundary.tsx` (verify complete)
- `functions/api/_shared/rateLimiter.ts` (verify complete)
- `deployment/DEPLOYMENT_CHECKLIST.md`

---

## 🔒 SPRINT 2: "Security Hardening"

**Goal:** Production-grade security before inviting users  
**Duration:** 1 week  
**Status:** [ ] Not Started  
**Depends On:** Sprint 1

### Tasks

- [ ] **Supabase RLS Policies** - User can only access their own data
- [ ] **RBAC Implementation** - Admin vs User roles via Clerk metadata
- [ ] **API Authentication Audit** - Every `/api/*` endpoint checks auth
- [ ] **Input Validation** - Zod schemas on all POST/PUT endpoints
- [ ] **Secrets Audit** - Confirm no VITE\_ prefix on secrets, all in CF dashboard
- [ ] **Admin Access Control** - Protect `/admin/*` routes with role check

### Acceptance Criteria

- [ ] RLS enabled on all user-facing tables
- [ ] Admin endpoints reject non-admin users with 403
- [ ] All endpoints validate input with Zod
- [ ] Security audit checklist passes

### Files to Create/Modify

- `prisma/migrations/XXXXXX_add_rls_policies/migration.sql`
- `functions/api/admin/check-access.ts`
- `docs/security/SECURITY_AUDIT_CHECKLIST.md`

---

## 📊 SPRINT 3: "Data Completion Engine"

**Goal:** Fill gaps in medical content database  
**Duration:** 2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 2

### Tasks

- [ ] **PANCE Gap Analysis** - Script identifies missing conditions per system
- [ ] **AutoAuthor Pipeline** - Batch generate missing content with Gemini
- [ ] **Deepen Foreign Keys** - Link Conditions → Labs, Procedures, Imaging
- [ ] **NormalFindings Table** - 50+ entries per modality (Labs, Vitals, Imaging)
- [ ] **Data Quality Scoring** - Track completion % per table in admin dashboard
- [ ] **Remove Static Files** - Delete any remaining JSON arrays, use DB only

### Acceptance Criteria

- [ ] 95% condition coverage (vs NCCPA blueprint)
- [ ] All conditions linked to relevant Labs, Procedures, Imaging
- [ ] NormalFindings table has 200+ entries
- [ ] No static JSON/TS arrays for medical content

### Files to Create/Modify

- `scripts/analysis/pance-gap-analysis.ts`
- `lib/services/autoAuthor/batchGenerator.ts`
- `prisma/schema.prisma` (NormalFindings model)
- `scripts/seed/seed-normal-findings.ts`

---

## 🖼️ SPRINT 4: "Image Pipeline Maturation"

**Goal:** Robust image management system  
**Duration:** 1-2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 3

### Tasks

- [ ] **Admin Image Review UI** - Approve/reject processed images
- [ ] **Bulk Image Import** - Process local photos (PE findings, derm, etc.)
- [ ] **Automated Cropping** - Smart crop to focus area using Gemini Vision
- [ ] **Giveaway Detection** - Flag images with text that reveals diagnosis
- [ ] **MediaAsset Cleanup** - Remove orphaned/rejected images from storage
- [ ] **Image Gap Report** - Dashboard showing missing images per condition

### Acceptance Criteria

- [ ] Admin can review and approve/reject images in UI
- [ ] Automated cropping reduces manual work by 80%
- [ ] No images with diagnostic "giveaways" in approved set
- [ ] Image coverage dashboard shows current status

### Files to Create/Modify

- `pages/admin/ImageReviewDashboard.tsx`
- `scripts/images/smart-cropper.ts`
- `scripts/images/giveaway-detector.ts`
- `functions/api/admin/media/review.ts`

---

## 📝 SPRINT 5: "Simulated PANCE Architecture"

**Goal:** Build the exam simulation infrastructure  
**Duration:** 2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 4

### Tasks

- [ ] **ExamConfig Table** - Store PANCE vs PANRE-LA settings (300 vs 240 Qs)
- [ ] **Blueprint-Weighted Pool** - Select questions matching NCCPA percentages
- [ ] **Timed Exam Mode** - 5 blocks × 60 questions, block-level timing
- [ ] **Exam Progress Persistence** - Resume interrupted exams
- [ ] **Exam Review Mode** - Post-exam review with flagged questions
- [ ] **Score Report Generation** - System-by-system breakdown, pass probability

### Acceptance Criteria

- [ ] Users can take a full 300-question practice PANCE
- [ ] Exam follows NCCPA blueprint distribution
- [ ] Users can pause and resume exams
- [ ] Score report shows detailed breakdown

### Database Models

```prisma
model ExamConfig {
  id              String   @id @default(cuid())
  name            String   // "PANCE", "PANRE-LA"
  totalQuestions  Int      // 300 or 240
  timeMinutes     Int      // 300 or 240
  blocks          Int      // 5 or 4
  questionsPerBlock Int    // 60
  blueprintWeights Json    // NCCPA percentages
  createdAt       DateTime @default(now())
}

model ExamAttempt {
  id              String   @id @default(cuid())
  userId          String
  configId        String
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  currentBlock    Int      @default(1)
  currentQuestion Int      @default(1)
  answers         Json     // Array of {questionId, selectedAnswer, flagged}
  status          String   // "in_progress", "completed", "abandoned"
  score           Float?
  systemScores    Json?    // {cardiovascular: 85, pulmonary: 72, ...}

  config          ExamConfig @relation(fields: [configId], references: [id])
  user            User       @relation(fields: [userId], references: [id])
}
```

### Files to Create/Modify

- `prisma/schema.prisma` (ExamConfig, ExamAttempt models)
- `components/exam/SimulatedPANCE.tsx`
- `components/exam/ExamBlock.tsx`
- `components/exam/ScoreReport.tsx`
- `functions/api/exam/start.ts`
- `functions/api/exam/submit-block.ts`
- `functions/api/exam/complete.ts`
- `services/examService.ts`

---

## 🎯 SPRINT 6: "Exam Polish & DDx Enhancement"

**Goal:** Exam mode feels authentic, clinical reasoning deepened  
**Duration:** 1-2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 5

### Tasks

- [ ] **Differential Ranking Step** - "List 3 DDx in order of likelihood"
- [ ] **Justification Prompt** - "Why did you choose X over Y?"
- [ ] **SocraticHintService** - Leading questions for wrong answers
- [ ] **Item Analysis Dashboard** - Which questions have poor discrimination
- [ ] **Exam History Log** - All past attempts with scores and trends
- [ ] **PANRE-LA Mode Toggle** - Shorter exam with different blueprint

### Acceptance Criteria

- [ ] DDx ranking appears on relevant questions
- [ ] Socratic hints guide learners without giving answers
- [ ] Admin can see question discrimination statistics
- [ ] Users can switch between PANCE and PANRE-LA modes

### Files to Create/Modify

- `components/drill/DDxRankingStep.tsx`
- `services/socraticHintService.ts`
- `pages/admin/ItemAnalysisDashboard.tsx`
- `components/exam/ExamHistoryList.tsx`

---

## 📈 SPRINT 7: "Analytics & Insights Revolution"

**Goal:** Users get actionable, beautiful performance data  
**Duration:** 2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 6

### Tasks

- [ ] **User Analytics Dashboard** - Redesign with visual charts (Recharts)
- [ ] **System Mastery Map** - Heat map of organ system performance
- [ ] **Peer Percentile Comparison** - "You're in the 75th percentile for Cardio"
- [ ] **Predicted PANCE Score** - Statistical model based on performance
- [ ] **Weakness Prescriber** - "Focus on Pulm + GI this week"
- [ ] **Study Time Tracking** - Daily/weekly study minutes logged

### Acceptance Criteria

- [ ] Dashboard shows beautiful, actionable visualizations
- [ ] Percentile comparison against "PANCE-ready" cohort
- [ ] Predicted score updates after each session
- [ ] Personalized study recommendations generated

### Files to Create/Modify

- `components/analytics/UserAnalyticsDashboard.tsx` (redesign)
- `components/analytics/SystemMasteryMap.tsx`
- `components/analytics/PredictedScoreCard.tsx`
- `services/panceScorePredictor.ts`
- `services/weaknessPrescriberService.ts`

---

## 🤝 SPRINT 8: "Social & Gamification"

**Goal:** Make studying less lonely, more engaging  
**Duration:** 2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 7

### Tasks

- [ ] **StudyGroupMember Activation** - Create/join study cohorts
- [ ] **Cohort Leaderboards** - Weekly rankings within your group
- [ ] **Shared Streaks** - Group streak that requires 3/5 members active
- [ ] **Daily Grand Rounds Challenge** - Shared challenge, compare answers
- [ ] **Achievement Badges** - "Cardiology Master", "100-Day Streak"
- [ ] **Notification System** - "Your cohort is #2 this week!"

### Acceptance Criteria

- [ ] Users can create/join study groups
- [ ] Leaderboards update weekly
- [ ] Achievement badges displayed on profile
- [ ] Users invite friends successfully

### Files to Create/Modify

- `components/social/StudyGroupManager.tsx`
- `components/social/CohortLeaderboard.tsx`
- `components/social/AchievementBadges.tsx`
- `services/studyGroupService.ts`
- `services/achievementService.ts`

---

## 🎧 SPRINT 9: "Multimodal Content Expansion"

**Goal:** Go beyond text - audio, anatomy, external sources  
**Duration:** 2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 8

### Tasks

- [ ] **Auscultation Mode** - Heart murmurs + lung sounds with audio clips
- [ ] **Anatomy Diagrams** - Interactive labeled diagrams
- [ ] **Textbook Ingestion** - Parse key textbooks into DB (via PDF extraction)
- [ ] **Anki Deck Import** - Convert .apkg files to question pool
- [ ] **Clinical Guidelines** - Link conditions to UpToDate/AAFP guidelines
- [ ] **Infographic Parser** - Extract text from medical infographics

### Acceptance Criteria

- [ ] 20+ heart sounds, 20+ lung sounds available
- [ ] 50+ anatomy diagrams with interactive labels
- [ ] At least one textbook ingested
- [ ] Anki import tool functional

### Files to Create/Modify

- `components/modes/AuscultationMode.tsx`
- `components/anatomy/InteractiveDiagram.tsx`
- `scripts/ingest/textbook-parser.ts`
- `scripts/ingest/anki-importer.ts`

---

## 🛡️ SPRINT 10: "Automation & Long-Term Maintenance"

**Goal:** System runs itself, content stays fresh  
**Duration:** 2 weeks  
**Status:** [ ] Not Started  
**Depends On:** Sprint 9

### Tasks

- [ ] **Drift Detection Cron** - Flag AI content older than 6 months
- [ ] **User Simulator Bot** - Automated QA testing random question paths
- [ ] **Feedback Loop** - "Flag Error" button → Admin Review Queue
- [ ] **ServiceWorker Caching** - Offline mode for daily prescription
- [ ] **Content Versioning** - Track changes to medical content over time
- [ ] **Auto-Backup System** - Nightly DB snapshots to cold storage
- [ ] **Documentation Freeze** - All docs updated, onboarding guide finalized

### Acceptance Criteria

- [ ] Cron jobs running on schedule
- [ ] Automated QA catches regressions
- [ ] Offline mode works for daily tasks
- [ ] All documentation complete and accurate

### Files to Create/Modify

- `scripts/cron/drift-detector.ts`
- `scripts/qa/user-simulator.ts`
- `components/feedback/FlagErrorButton.tsx`
- `public/service-worker.js`
- `docs/ONBOARDING_GUIDE.md`

---

## 📊 Progress Tracking

| Sprint | Name                               | Status | Started    | Completed  |
| ------ | ---------------------------------- | ------ | ---------- | ---------- |
| 1      | Launch Foundation                  | ✅     | 2026-01-08 | 2026-01-08 |
| 2      | Security Hardening                 | ✅     | 2026-01-08 | 2026-01-08 |
| 3      | Data Completion Engine             | ✅     | 2026-01-08 | 2026-01-08 |
| 4      | Image Pipeline Maturation          | ✅     | 2026-01-08 | 2026-01-08 |
| 5      | Simulated PANCE Architecture       | ✅     | 2026-01-08 | 2026-01-08 |
| 6      | Exam Polish & DDx Enhancement      | ✅     | 2026-01-08 | 2026-01-08 |
| 7      | Analytics & Insights Revolution    | ✅     | 2026-01-08 | 2026-01-08 |
| 8      | Social & Gamification              | ✅     | 2026-01-08 | 2026-01-08 |
| 9      | Multimodal Content Expansion       | ✅     | 2026-01-08 | 2026-01-08 |
| 10     | Automation & Long-Term Maintenance | ✅     | 2026-01-08 | 2026-01-08 |

**Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## 🎯 Key Metrics to Track

### User Engagement

- Daily Active Users (DAU)
- Average session duration
- Questions answered per day
- Retention rate (7-day, 30-day)

### Content Quality

- Question pool size
- Image coverage percentage
- Average question discrimination index
- User-flagged errors resolved

### Learning Outcomes

- Average predicted PANCE score
- Mastery improvement rate
- Time to 80% system mastery
- Exam completion rate

---

## 📝 Notes & Decisions

### Architectural Decisions

1. **Database-First Only** - No static JSON/TS files for medical content
2. **FSRS v5** - Spaced repetition algorithm for optimal scheduling
3. **Cloudflare Pages Functions** - Serverless API architecture
4. **Supabase** - PostgreSQL with built-in RLS and storage

### Content Strategy

1. **NCCPA Blueprint** - All content weighted to exam distribution
2. **Interleaving** - Sessions mix organ systems for better retention
3. **Clinical Reasoning** - DDx ranking and justification steps

### Future Considerations (Post-Sprint 10)

- Mobile app (React Native)
- CME credit integration
- Institutional licensing
- AI tutor chat interface

---

_Last Updated: January 8, 2026_
