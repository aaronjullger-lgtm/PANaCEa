# 👤 User Data Collection & Storage - 10-Step Improvement Plan

**Date:** January 13, 2026  
**Status:** ✅ Sprint A & B Complete (Steps 1-5) - Ready for Sprint C  
**Focus:** User-specific data collection, storage, and personalization

---

## Executive Summary

This plan improves how PANaCEa collects, stores, and uses user-specific data to enable better personalization, adaptive learning, and GDPR compliance.

---

## Current User Data Infrastructure

### ✅ What's Working

| Model                    | Purpose                                   | Status                          |
| ------------------------ | ----------------------------------------- | ------------------------------- |
| `User`                   | Core user record (Clerk-synced)           | ✅ Working                      |
| `UserProgress`           | Per-condition FSRS state + review history | ✅ Working                      |
| `UserLearningProfile`    | Aggregated learning metrics               | ⚠️ Partially used               |
| `QuestionAttempt`        | Individual answer records                 | ✅ Working                      |
| `StudySession`           | Session-level analytics                   | ✅ Working                      |
| `UserQuestionSeen`       | No-repeat tracking                        | ✅ Working                      |
| `UserStatisticsSnapshot` | Periodic snapshots                        | ⚠️ Schema exists, not populated |

### ⚠️ Critical Gaps Identified

| Gap                                     | Impact                       | Current State        |
| --------------------------------------- | ---------------------------- | -------------------- |
| **Implicit metrics not persisted**      | Losing behavioral signals    | Client-side only     |
| **No study preferences storage**        | Can't personalize experience | localStorage only    |
| **UserLearningProfile sparse**          | Recommendations weak         | Many fields null     |
| **No learning style tracking**          | Can't adapt to user          | Not implemented      |
| **Time-of-day data fragmented**         | Circadian insights lost      | Spread across tables |
| **No goal tracking**                    | Can't measure progress       | No schema            |
| **Confusion patterns per-user missing** | DDx suggestions generic      | Global only          |
| **No device/session tracking**          | Can't analyze context        | Anonymous            |

---

## 🔟 10-Step Improvement Plan

### **Step 1: Persist Implicit Behavioral Metrics** ✅ COMPLETE

**Problem**: Rich behavioral data (response time, hesitation, answer changes) collected but only stored ephemerally.

**Solution**: Created UserBehaviorMetrics table and API endpoint.

**Current Libraries** (client-side only):

- `lib/implicit-metrics.ts` - Core metric types
- `lib/fluency-scoring.ts` - Typing fluency
- `lib/typing-rhythm.ts` - Keystroke patterns
- `hooks/useImplicitMetrics.ts` - Collection hook

**Schema**: `UserBehaviorMetrics` table (✅ created)

```prisma
model UserBehaviorMetrics {
  id                  String   @id
  userId              String
  questionId          String
  questionType        String?

  // Core timing metrics
  timeToFirstClick    Int      // ms
  dwellTime           Int      // ms
  totalResponseTime   Int      // ms

  // Interaction patterns
  answerChanges       Int
  optionHovers        Int
  scrollDepth         Int?

  // Behavioral signals
  hesitationEvents    Int
  backtrackCount      Int

  // Context
  timeOfDay           Int      // 0-23
  deviceType          String?
  wasCorrect          Boolean
  confidenceLevel     Int?

  // FSRS derivation
  derivedRating       Int?
  ratingConfidence    Float?

  // Advanced metrics (optional)
  trajectoryData      Json?
  typingRhythm        Json?

  createdAt           DateTime
  // ...
}
```

**API Endpoints** (✅ created):

- `POST /api/user/behavior-metrics` - Store metrics
- `GET /api/user/behavior-metrics` - Retrieve metrics

**Implementation**: `functions/api/user/behavior-metrics.ts` (250+ lines)

- Stores all implicit metrics from client
- Auto-detects device type from user agent
- Captures time of day automatically
- Supports optional trajectory and typing rhythm data

**Status**: ✅ Table created, API deployed, ready for client integration

---

### **Step 2: Create User Preferences Table** ✅ COMPLETE

**Problem**: User settings in localStorage, lost on device change.

**Solution**: Created UserPreferences table with comprehensive settings storage.

**Schema**: `UserPreferences` table (✅ created)

```prisma
model UserPreferences {
  id                  String   @id
  userId              String   @unique

  // Study preferences
  dailyGoal           Int      @default(40)
  preferredSystems    String[]
  sessionLength       Int      @default(20)
  difficulty          String   @default("adaptive")

  // Timing preferences
  wakeTime            String?
  studyReminders      Boolean  @default(true)
  reminderTime        String?
  reminderDays        Int[]

  // UI preferences
  theme               String   @default("light")
  soundEnabled        Boolean  @default(true)
  hapticFeedback      Boolean  @default(true)
  animationsEnabled   Boolean  @default(true)
  fontSize            String   @default("medium")

  // Learning preferences
  showHints           Boolean  @default(true)
  autoAdvance         Boolean  @default(false)
  explanationDepth    String   @default("standard")
  showPearls          Boolean  @default(true)
  showRelatedConcepts Boolean  @default(true)

  // Review preferences
  fsrsEnabled         Boolean  @default(true)
  reviewBeforeExam    Boolean  @default(true)
  mixNewAndReview     Boolean  @default(true)

  // Advanced settings
  keyboardShortcuts   Boolean  @default(true)
  developerMode       Boolean  @default(false)
  betaFeatures        Boolean  @default(false)

  // Notification preferences
  emailDigest         Boolean  @default(true)
  emailFrequency      String   @default("weekly")
  pushNotifications   Boolean  @default(false)

  // Privacy preferences
  shareAnonymousData  Boolean  @default(true)
  showOnLeaderboard   Boolean  @default(true)

  // Custom JSON for extensibility
  customSettings      Json?

  createdAt           DateTime
  updatedAt           DateTime
  // ...
}
```

**API Endpoints** (✅ created):

- `GET /api/user/preferences` - Fetch preferences (auto-creates if missing)
- `POST /api/user/preferences` - Create/update all preferences
- `PATCH /api/user/preferences` - Partial update
- `DELETE /api/user/preferences` - Reset to defaults

**Implementation**: `functions/api/user/preferences.ts` (300+ lines)

- Full CRUD operations
- Automatic default creation on first access
- Cross-device sync
- Upsert support for easy updates

**Benefits**:
✅ Preferences persist across devices  
✅ No data loss on browser clear  
✅ Enables server-side personalization  
✅ Foundation for recommendation algorithms

**Status**: ✅ Table created, API deployed, ready for client migration from localStorage

---

### **Step 3: Enrich UserLearningProfile** ✅ COMPLETE

**Problem**: UserLearningProfile exists but many fields empty.

**Solution**: Created daily aggregation job `userProfileEnrichment.ts`.

**Implementation**: `scripts/automation/jobs/userProfileEnrichment.ts` (450+ lines)

**Fields Populated**:

- **chronotype**: Determined from hourly performance (morning/afternoon/evening/night/variable)
- **peakLearningHour**: Hour with highest accuracy (0-23)
- **avgSessionDuration**: Average questions per session
- **preferredDifficulty**: Adaptive analysis (challenging/adaptive/foundation)
- **learningVelocity**: Improvement rate (questions per day)
- **metacognitionScore**: Judgment of Learning accuracy (0-1)
- **cognitiveLoadThreshold**: Optimal session length before fatigue
- **rushingTendency**: Tendency to rush through questions (0-1)
- **optimalTimeRange**: Recommended time per question range
- **fatigueOnsetQuestion**: When accuracy typically drops
- **bestStudyHour/worstStudyHour**: Peak and low performance hours

**Job Schedule**: Daily at 3 AM UTC

**Data Sources**:

- StudySession: Session patterns, stamina, duration
- QuestionAttempt: Performance, timing, confidence
- UserBehaviorMetrics: Behavioral patterns, answer changes

**Algorithms**:

1. Chronotype Detection: Analyzes hourly performance to determine best time of day
2. Learning Velocity: Linear regression on daily accuracy trends
3. Metacognition Score: Compares confidence levels to actual performance
4. Cognitive Load Threshold: Detects accuracy drop point in rolling windows

**CLI Usage**:

```bash
npx tsx scripts/automation/jobs/userProfileEnrichment.ts
```

**Status**: ✅ Job created, ready for scheduling in cron

---

### **Step 4: Add Learning Style Detection** ✅ COMPLETE

**Problem**: App doesn't adapt to how users learn best.

**Solution**: Created comprehensive learning style detection system.

**Implementation**: `lib/learningStyleDetection.ts` (480+ lines)

**Dimensions Analyzed**:

1. **Pace Preference**:
   - fast-decider: Quick first click (<3s), few changes (<0.3)
   - thorough-analyzer: Long deliberation (>8s), extended dwell time (>60s)
   - balanced: In between

2. **Explanation Engagement**:
   - deep-dive: High view rate (>70%), long durations (>45s), proactive
   - moderate: Balanced viewing behavior
   - minimal: Low view rate (<20%) or short durations (<10s)

3. **Repetition Pattern**:
   - spaced-repetition: Increasing intervals, high variance
   - mass-practice: Short intervals (<2 days), low variance
   - mixed: Combination of patterns

4. **Error Recovery**:
   - reflective: Takes time after errors (>5 min), shows improvement (>70%)
   - persistent: Quick return (<2 min), pushes through

**Output**: `LearningStyleProfile` object with:

- Style classification for each dimension
- Confidence scores (0-1) for each
- Overall style label (e.g., "Intuitive Deep Processor")
- Personalized recommendations array
- Data quality metrics (questions, sessions, days)

**Functions**:

- `detectLearningStyle(data)`: Main detection function
- `hasSufficientDataForDetection(data)`: Checks if enough data available
- `updateUserLearningStyle(userId, data, prisma)`: Updates database

**Storage**: Results stored in `UserLearningProfile.learningInsights` and `recommendations` fields

**Minimum Data Requirements**:

- 20+ question attempts
- 3+ study sessions
- 3+ days of activity

**Confidence Levels**:

- High: 100+ attempts, 10+ sessions, 7+ days
- Medium: 50+ attempts, 5+ sessions, 5+ days
- Low: Below medium thresholds

**Status**: ✅ Library created, integrated with userProfileEnrichment job

---

### **Step 5: Implement User Goal Tracking** ✅ COMPLETE

**Problem**: Users can't set and track PANCE prep goals.

**Solution**: Created UserGoal table and full CRUD API.

**Schema**: `UserGoal` table (✅ created)

```prisma
model UserGoal {
  id                  String   @id
  userId              String

  // Goal identification
  title               String
  description         String?
  goalType            String   // 'daily' | 'weekly' | 'exam_date' | 'mastery'

  // Goal targets
  targetValue         Int?
  targetUnit          String?  // 'questions' | 'minutes' | 'conditions' | 'accuracy'
  targetDate          DateTime?
  targetSystem        String?  // For mastery goals
  targetStability     Float?   // For FSRS mastery goals

  // Progress tracking
  currentValue        Int      @default(0)
  progressPercentage  Float    @default(0)

  // Status
  status              String   @default("active")  // 'active' | 'completed' | 'paused' | 'failed'
  isRecurring         Boolean  @default(false)

  // Milestones
  milestones          Json?

  // Streak tracking
  currentStreak       Int      @default(0)
  bestStreak          Int      @default(0)
  lastMetDate         DateTime?

  // Motivation
  motivationNotes     String?
  rewardMessage       String?

  createdAt           DateTime
  updatedAt           DateTime
  completedAt         DateTime?
  // ...
}
```

**API Endpoints** (✅ created): `functions/api/user/goals.ts` (420+ lines)

1. **GET /api/user/goals**
   - List all goals with filtering
   - Query params: status, goalType, limit
   - Returns goals array with count

2. **POST /api/user/goals**
   - Create new goal
   - Supports all goal types
   - Auto-validates goalType

3. **PATCH /api/user/goals/:id**
   - Update goal progress or any field
   - Auto-calculates progressPercentage
   - Auto-completes when target reached
   - Resets recurring goals after completion
   - Updates streak tracking

4. **DELETE /api/user/goals/:id**
   - Delete goal with ownership check

**Goal Types**:

1. **Daily**: "Complete 40 questions today"
   - targetValue: 40
   - targetUnit: "questions"
   - isRecurring: true
   - Auto-resets at completion

2. **Weekly**: "Study 300 minutes this week"
   - targetValue: 300
   - targetUnit: "minutes"
   - isRecurring: true

3. **Exam Date**: "Reach 85% accuracy by May 1"
   - targetValue: 85
   - targetUnit: "accuracy"
   - targetDate: "2026-05-01"

4. **Mastery**: "Master CV system (90% stability)"
   - targetSystem: "CV"
   - targetStability: 0.9
   - Tracks FSRS stability for system

**Features**:
✅ Automatic progress calculation  
✅ Auto-completion when target reached  
✅ Recurring goal support (daily/weekly)  
✅ Streak tracking (current, best)  
✅ Milestone support (JSON array)  
✅ Custom motivation notes and rewards  
✅ Ownership validation

**Status**: ✅ Table created, migration applied, API deployed

---

### **Step 6: Store Per-User Confusion Patterns** 🟡 P2

**Problem**: ConfusionPair table is global, not user-specific.

**Schema**: `UserConfusionPattern` table

**Fields**:

- conditionA, conditionB
- occurrences, lastOccurrence
- wasResolved, resolvedAt
- questionIds (triggers)

---

### **Step 7: Add Session Context Tracking** 🟡 P2

**Problem**: Don't know study context (device, environment).

**Extend StudySession**:

- deviceType (mobile/tablet/desktop)
- browserName, screenSize
- connectionType (wifi/cellular)
- likelyContext (commute/home/library)
- isQuickSession, wasInterrupted

---

### **Step 8: Implement Circadian Performance Storage** 🟡 P2

**Problem**: Time-of-day insights calculated on-demand, not stored.

**Schema**: `UserCircadianProfile` table

**Fields**:

- hourlyAccuracy (0-23 hours)
- hourlyAttempts
- peakHours, avoidHours
- chronotype
- studyDaysOfWeek
- avgDailyMinutes

---

### **Step 9: Create User Activity Timeline** 🟢 P3

**Problem**: Hard to reconstruct user journey.

**Schema**: `UserActivityLog` table

**Event Types**:

- session_start, session_end
- answer, review
- milestone_achieved
- settings_changed

**Retention**: 90 days, then aggregate.

---

### **Step 10: Add User Data Export API** 🟢 P3

**Problem**: GDPR compliance + users can't export data.

**Endpoint**: `GET /api/user/export-data`

**Export Contents**:

- All QuestionAttempts
- UserProgress records
- StudySession history
- Goals and achievements
- Preferences
- Activity log (90 days)

**Format**: JSON or ZIP with CSV files.

---

## Implementation Priority Matrix

| Step                             | Effort | Impact    | Priority | Sprint |
| -------------------------------- | ------ | --------- | -------- | ------ | ----------- |
| 1. Persist Implicit Metrics      | Medium | Very High | 🔴 P0    | A      | ✅ Complete |
| 2. User Preferences Table        | Low    | Very High | 🔴 P0    | A      | ✅ Complete |
| 3. Enrich UserLearningProfile    | Medium | High      | 🟠 P1    | B      | ✅ Complete |
| 4. Learning Style Detection      | High   | High      | 🟠 P1    | B      | ✅ Complete |
| 5. Goal Tracking                 | Medium | High      | 🟠 P1    | B      | ✅ Complete |
| 6. Per-User Confusion Patterns   | Low    | Medium    | 🟡 P2    | C      |
| 7. Session Context Tracking      | Low    | Medium    | 🟡 P2    | C      |
| 8. Circadian Performance Storage | Medium | Medium    | 🟡 P2    | C      |
| 9. Activity Timeline             | Medium | Low       | 🟢 P3    | D      |
| 10. Data Export API              | Medium | Medium    | 🟢 P3    | D      |

---

## Sprint Plan

**Sprint A** ✅ **COMPLETE**: Steps 1-2 - Core data persistence

- ✅ UserBehaviorMetrics table and API
- ✅ UserPreferences table and API
- Ready for client integration

**Sprint B (Next)**: Steps 3-5 - Learning personalization  
**Sprint C (1 week)**: Steps 6-8 - Context & patterns  
**Sprint D (1 week)**: Steps 9-10 - Timeline & compliance

---

## Files Created/Modified

### ✅ Sprint A Complete

| File                                     | Purpose                                            | Status      | Lines |
| ---------------------------------------- | -------------------------------------------------- | ----------- | ----- |
| `prisma/schema.prisma`                   | Added UserBehaviorMetrics & UserPreferences models | ✅ Modified | +150  |
| `functions/api/user/behavior-metrics.ts` | Store/retrieve implicit metrics                    | ✅ Created  | 250   |
| `functions/api/user/preferences.ts`      | Full CRUD for user preferences                     | ✅ Created  | 300   |

**Database Changes**:

- ✅ Migration `add_user_behavior_and_preferences` applied
- ✅ UserBehaviorMetrics table created with indexes
- ✅ UserPreferences table created with unique userId constraint
- ✅ Foreign keys to User table established

**API Endpoints**:

- `POST /api/user/behavior-metrics` - Store behavior data
- `GET /api/user/behavior-metrics` - Retrieve behavior data
- `GET /api/user/preferences` - Fetch preferences
- `POST /api/user/preferences` - Create/update preferences
- `PATCH /api/user/preferences` - Partial update
- `DELETE /api/user/preferences` - Reset to defaults

### ✅ Sprint B Complete

| File                                               | Purpose                                 | Status      | Lines |
| -------------------------------------------------- | --------------------------------------- | ----------- | ----- |
| `scripts/automation/jobs/userProfileEnrichment.ts` | Daily enrichment of UserLearningProfile | ✅ Created  | 450   |
| `lib/learningStyleDetection.ts`                    | Detect learning style from behavior     | ✅ Created  | 480   |
| `functions/api/user/goals.ts`                      | Goal tracking CRUD                      | ✅ Created  | 420   |
| `prisma/schema.prisma`                             | Added UserGoal model                    | ✅ Modified | +50   |

**Database Changes**:

- ✅ Migration `add_user_goals` applied
- ✅ UserGoal table created with 3 indexes
- ✅ Foreign key to User table with CASCADE delete

**API Endpoints**:

- `GET /api/user/goals` - List goals with filtering
- `POST /api/user/goals` - Create new goal
- `PATCH /api/user/goals/:id` - Update goal (auto-complete, streak tracking)
- `DELETE /api/user/goals/:id` - Delete goal

**Jobs Created**:

- `enrichAllUserProfiles()` - Daily job to populate UserLearningProfile fields
  - Processes active users in batches of 50
  - Calculates 12+ aggregated metrics
  - Updates chronotype, learning velocity, metacognition score

**Libraries Created**:

- Learning style detection with 4 dimensions
- Confidence scoring for each dimension
- Personalized recommendations generator
- Data sufficiency checker

### 🔄 Sprint C To-Do

| File                                                   | Purpose                                                                 | Status   |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | -------- |
| `prisma/schema.prisma`                                 | Add UserConfusionPattern, extend StudySession, add UserCircadianProfile | 🔄 Ready |
| `scripts/automation/jobs/confusionPatternDetection.ts` | Track per-user confusion pairs                                          | 🔄 Ready |
| `scripts/automation/jobs/circadianAnalysis.ts`         | Analyze hourly performance patterns                                     | 🔄 Ready |

---

## Sprint Plan

**Sprint A** ✅ **COMPLETE**: Steps 1-2 - Core data persistence

- ✅ UserBehaviorMetrics table and API
- ✅ UserPreferences table and API
- Ready for client integration

**Sprint B (Next)**: Steps 3-5 - Learning personalization  
**Sprint C (1 week)**: Steps 6-8 - Context & patterns  
**Sprint D (1 week)**: Steps 9-10 - Timeline & compliance

---

## Data Flow Diagram

```
User Action → Client Collection → API Submission → DB Storage → Aggregation Job → UserLearningProfile
     ↓              ↓                  ↓                ↓              ↓
  Implicit      Preferences      QuestionAttempt    UserProgress   Recommendations
  Metrics       Sync             + BehaviorMetrics  + ReviewHistory
```

---

## Files to Create/Modify

| File                                                | Purpose                   |
| --------------------------------------------------- | ------------------------- |
| `prisma/migrations/add_user_data_tables.sql`        | Schema for Steps 1-2, 5-9 |
| `functions/api/user/preferences.ts`                 | Sync preferences          |
| `functions/api/user/behavior-metrics.ts`            | Store implicit data       |
| `functions/api/user/goals.ts`                       | Goal CRUD                 |
| `functions/api/user/export-data.ts`                 | GDPR export               |
| `scripts/automation/jobs/userProfileAggregation.ts` | Daily enrichment          |

---

## Related Documentation

- [STATISTICS_IMPROVEMENT_PLAN.md](./STATISTICS_IMPROVEMENT_PLAN.md) - Platform statistics
- [DATABASE_IMPROVEMENT_PLAN.md](./DATABASE_IMPROVEMENT_PLAN.md) - Database improvements
- [QUESTION_GENERATION_IMPROVEMENT_PLAN.md](./QUESTION_GENERATION_IMPROVEMENT_PLAN.md) - Question quality

---

**Report Generated:** January 13, 2026
