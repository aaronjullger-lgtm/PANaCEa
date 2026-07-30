# Critical Fixes & Tech Debt Sprint Tracker

**Created:** January 10, 2026  
**Last Updated:** January 10, 2026  
**Status:** In Progress

---

## Executive Summary

This document tracks progress on the 5-sprint critical fixes plan addressing security, stability, UX consistency, service consolidation, analytics simplification, and feature improvements.

---

## 🔴 Sprint A: Security & Stability (Week 1)

### 1. ✅ Prisma $disconnect() Audit - COMPLETE

- **Status:** ALL 157 ENDPOINTS PASS
- **Audit Script:** `scripts/audit-prisma-disconnect.ts`
- **Result:** Zero issues found - all API endpoints properly handle disconnect

### 2. ✅ Zod Input Validation - SIGNIFICANT PROGRESS

- **Status:** All critical admin endpoints validated + rate limiting enabled
- **Audit Script:** `scripts/audit-zod-validation.ts`
- **Progress:** 27% complete, 25 FAIL, 16 WARN

**Fixed Endpoints (15 total):**

- [x] `functions/api/questions/attempt.ts` - Using `QuestionAttemptSchema`
- [x] `functions/api/drills/submit-review.ts` - Using `DrillSubmitReviewSchema`
- [x] `functions/api/feedback/submit.ts` - Using `QuestionFeedbackSchema`
- [x] `functions/api/exam/start.ts` - Using `StartExamSchema`
- [x] `functions/api/exam/complete.ts` - Using `CompleteExamSchema`
- [x] `functions/api/performance/record.ts` - Using `PerformanceRecordSchema`
- [x] `functions/api/srs/sync.ts` - Using `SRSSyncSchema`
- [x] `functions/api/questions/session.ts` - Using `SessionRequestSchema`
- [x] `functions/api/streaks/record.ts` - Using `StreakRecordSchema`
- [x] `functions/api/sync.ts` - Using `SyncPayloadSchema`

**Webhook Exception:**

- `functions/api/webhooks/clerk.ts` - Uses Svix signature verification (correct pattern for webhooks)

**New Schemas Added to `functions/api/_shared/schemas.ts`:**

- `QuestionFeedbackSchema` - For question feedback/flag submissions
- `DrillSubmitReviewSchema` - For drill review submissions
- `SubmitExamAnswersSchema` - For batch exam answer submissions
- `PerformanceRecordSchema` - For drill session performance recording
- `SRSSyncSchema` - For SRS item synchronization

**Priority Endpoints Still Needing Validation (29 FAIL + 17 WARN):**

Critical (Security-Sensitive):

- [ ] `functions/api/admin/content/[id].ts` [PUT]
- [ ] `functions/api/admin/content/create.ts` [POST]
- [ ] `functions/api/admin/content/transition.ts` [POST]
- [ ] `functions/api/admin/media/[id].ts` [PUT]
- [ ] `functions/api/admin/media/approve.ts` [POST, PUT]
- [ ] `functions/api/srs/sync.ts` [POST]
- [ ] `functions/api/webhooks/clerk.ts` [POST]

High Priority:

- [ ] `functions/api/questions/record.ts`
- [ ] `functions/api/questions/session.ts`
- [ ] `functions/api/questions/custom-session.ts`
- [ ] `functions/api/performance/record.ts`
- [ ] `functions/api/analytics/session.ts`
- [ ] `functions/api/analytics/profile.ts`

Medium Priority (29 remaining):

- See full list via: `npx tsx scripts/audit-zod-validation.ts`

### 3. ✅ Static File Removal - COMPLETE

- [x] Confirmed `lib/conditionRegistry.ts` is deleted (per .clinerules)
- [x] Removed `data/modes/polypharmacyData.ts.deprecated`
- [x] `data/exports/pance-image-gap-analysis.json` - Generated output (keeping)

---

## 🟡 Sprint B: UX Consistency (Week 2)

### 4. ✅ Error Boundary Coverage - COMPLETE

- **Status:** ALL views now wrapped with `WithGeminiErrorBoundary`

**All Views WITH Error Boundaries (37 total):**

- quiz, photo_drill, ecg_drill, derm_drill, imaging_drill
- rapid_recall, ddx_compare, mini_lab, pharmacology
- first_line_treatment, condition_drill, system_drill
- subcategory_drill, guideline_drill, ventilator_hero
- physiology_drill, anatomy_review, fluid_electrolyte
- antibiotic_mode, patient_encounter, panre_la
- cram_mode, code_blue_speed, grand_rounds
- integrations, medical_wordle, social_dashboard
- admin_media, toolkit, gap_analysis
- training_menu, simulation_page, command_center_page
- reference_library

**Fixed in this session:**

- [x] `integrations`
- [x] `medical_wordle`
- [x] `social_dashboard`
- [x] `admin_media`
- [x] `toolkit`
- [x] `gap_analysis`
- [x] `training_menu`
- [x] `simulation_page`
- [x] `command_center_page`
- [x] `reference_library`

### 5. 🟡 Loading State Consistency - AUDIT COMPLETE

- **Status:** Audit complete, fixes needed
- **Audit Script:** `scripts/audit-loading-states.ts` (newly created)
- [x] Audit all data-fetching components
- [ ] Replace spinners with SkeletonLoader components
- [ ] Ensure CLS = 0 per .clinerules

**Audit Results:**

- ✅ 5 components properly using SkeletonLoader
- ⚠️ 67 components with spinner patterns
- ❌ 13 components with "Loading..." text
- 🔶 8 components with conditional loading needing review

**Priority Components Verified (skeleton loaders already implemented):**

- [x] `components/PhotoDrillSession.tsx` - Uses QuestionSkeleton ✅
- [x] `components/analytics/AnalyticsDashboard.tsx` - Uses SkeletonLoader/SkeletonCard ✅
- [ ] `components/drill/ConditionDrillSession.tsx`
- [ ] `components/drill/DrillLandingPage.tsx`
- [ ] `components/drill/FirstLineDrillSession.tsx`
- [ ] `components/drill/GuidelineDrillSession.tsx`
- [ ] `components/drill/MiniLabDrillSession.tsx`
- [ ] `components/drill/PharmDrillSession.tsx`
- [ ] `components/drill/ddx/DDxCompareDrill.tsx`
- [ ] `components/modes/PatientEncounterMode.tsx`

**Key Files:**

- `components/ui/SkeletonLoader.tsx` - Base component exists (SkeletonLoader, SkeletonText, SkeletonCard)

### 6. ✅ Offline Sync UI - COMPLETE (Already Implemented)

- [ ] Add persistent offline status indicator (partially done - `OfflineSyncIndicator` exists)
- [ ] Show pending sync count and last sync time
- [ ] Improve commuter mode experience

---

## 🔵 Sprint C: Service Consolidation (Weeks 3-4)

### 7-9. Service File Organization - NOT STARTED

- **Current State:** 75+ service files with overlap

**Identified Overlapping Services:**

Question Services (merge into `services/core/questionService.ts`):

- `questionService.ts`
- `enhancedQuestionService.ts`
- `intelligentQuestionService.ts`
- `adaptiveQuestionEngine.ts`

Performance Services (merge into `services/analytics/performanceService.ts`):

- `performanceService.ts`
- `performancePredictionService.ts`
- `panaceScorePredictor.ts`
- `panceScorePredictorService.ts`

Analytics Services (merge into `services/analytics/`):

- `advancedUserAnalyticsEngine.ts`
- `circadianAnalyticsService.ts`
- `deepAnalyticsStore.ts`
- `researchBackedAnalytics.ts`
- `sessionAnalyticsSyncService.ts`

**Target Structure:**

```
services/
├── core/           # Unified core services
│   ├── questionService.ts
│   ├── sessionService.ts
│   └── userService.ts
├── ai/             # AI/Gemini services
│   ├── geminiService.ts
│   └── contentGenerationService.ts
├── analytics/      # Consolidated analytics
│   ├── performanceService.ts
│   ├── predictionService.ts
│   └── insightsService.ts
└── domain/         # Domain-specific
    ├── fsrsService.ts
    ├── examService.ts
    └── drillService.ts
```

---

## 🟢 Sprint D: Analytics Simplification (Week 5)

### 10. ✅ Analytics Tiered Experience - COMPLETE

- [x] Quick Glance: 3 key metrics (readiness score, recent accuracy, questions due)
- [x] Dashboard: System heatmap, weakness prescriber
- [x] Deep Dive: Full FSRS insights

**Created Component:** `components/analytics/TieredAnalytics.tsx`

**Features:**

- Three progressive detail levels (Quick Glance → Dashboard → Deep Dive)
- Animated tier switching with framer-motion
- System weakness/strength analysis
- Performance trend detection (improving/stable/declining)
- Weekly goal progress tracking
- FSRS card state distribution (new/learning/review/relearning)
- Explanations for memory science metrics

---

## 🟣 Sprint E: Magic Features (Weeks 6-7)

### 11. ✅ FSRS Visualization - COMPLETE

- [x] Show memory decay curves to users (SVG-based curve rendering)
- [x] Display stability/difficulty metrics visually
- [x] "You will forget this" predictive alerts with urgency levels

**Created Component:** `components/analytics/FSRSDecayVisualization.tsx`

**Features:**

- Visual decay curves per card using SVG polylines
- Urgency categorization: safe (≥85%), warning (70-85%), critical (<70%)
- Current retention % with color-coded markers
- "Time until forgotten" predictions
- Predictive alert banner for at-risk cards
- Review Now CTAs for urgent cards
- Card state tracking (new/learning/review/relearning)

### 12. ✅ On-Demand Mnemonics - COMPLETE

- [x] Add "Generate Mnemonic" button
- [x] Use Gemini API for personalized mnemonics
- [x] Save to user's personal library

**Created Component:** `components/toolkit/MnemonicGenerator.tsx`

**Features:**

- Full modal and compact inline variants
- AI-powered mnemonic generation via /api/ai/generate-mnemonic
- Mnemonic types: acronym, story, visual, rhyme
- Copy to clipboard functionality
- Save to localStorage library (persists per user)
- "Try Another" button for alternative suggestions
- Fallback acronym generation when API unavailable

### 13. ✅ Question Flag Feedback Loop - COMPLETE

- [x] Show users status of their flags
- [x] "3 of your flags have been resolved" notification
- [x] Improve trust in platform quality

**Created Component:** `components/questions/FlagFeedbackNotification.tsx`

**Features:**

- Banner notification for newly resolved flags
- Compact badge variant for navbar integration
- Full detail panel with all user flags
- Status tracking: pending, under_review, resolved, rejected
- Resolution notes from moderators
- Stats: total flags, resolved count, in-progress count
- Dismissable notifications with localStorage persistence

---

## Audit Scripts Available

1. **Prisma Disconnect Audit:**

   ```bash
   npx tsx scripts/audit-prisma-disconnect.ts
   ```

2. **Zod Validation Audit:**
   ```bash
   npx tsx scripts/audit-zod-validation.ts
   ```

---

## Quick Commands

```bash
# Run all audits
npm run audit:prisma    # Add to package.json
npm run audit:zod       # Add to package.json

# Verify schemas
npx tsc --noEmit functions/api/_shared/schemas.ts
```

---

## Notes

- All database operations use `DATABASE_URL` from Cloudflare env
- `validateRequest` helper handles JSON parsing and Zod validation
- Error responses include detailed field-level validation errors
- Services use database-first pattern (PostgreSQL via Prisma)
