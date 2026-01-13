# 👤 User Data Collection & Storage - 10-Step Improvement Plan

**Date:** January 13, 2026  
**Status:** 📋 Planning Complete - Ready for Implementation  
**Focus:** User-specific data collection, storage, and personalization

---

## Executive Summary

This plan improves how PANaCEa collects, stores, and uses user-specific data to enable better personalization, adaptive learning, and GDPR compliance.

---

## Current User Data Infrastructure

### ✅ What's Working
| Model | Purpose | Status |
|-------|---------|--------|
| `User` | Core user record (Clerk-synced) | ✅ Working |
| `UserProgress` | Per-condition FSRS state + review history | ✅ Working |
| `UserLearningProfile` | Aggregated learning metrics | ⚠️ Partially used |
| `QuestionAttempt` | Individual answer records | ✅ Working |
| `StudySession` | Session-level analytics | ✅ Working |
| `UserQuestionSeen` | No-repeat tracking | ✅ Working |
| `UserStatisticsSnapshot` | Periodic snapshots | ⚠️ Schema exists, not populated |

### ⚠️ Critical Gaps Identified

| Gap | Impact | Current State |
|-----|--------|---------------|
| **Implicit metrics not persisted** | Losing behavioral signals | Client-side only |
| **No study preferences storage** | Can't personalize experience | localStorage only |
| **UserLearningProfile sparse** | Recommendations weak | Many fields null |
| **No learning style tracking** | Can't adapt to user | Not implemented |
| **Time-of-day data fragmented** | Circadian insights lost | Spread across tables |
| **No goal tracking** | Can't measure progress | No schema |
| **Confusion patterns per-user missing** | DDx suggestions generic | Global only |
| **No device/session tracking** | Can't analyze context | Anonymous |

---

## 🔟 10-Step Improvement Plan

### **Step 1: Persist Implicit Behavioral Metrics** 🔴 P0

**Problem**: Rich behavioral data (response time, hesitation, answer changes) collected but only stored ephemerally.

**Current Libraries** (client-side only):
- `lib/implicit-metrics.ts` - Core metric types
- `lib/fluency-scoring.ts` - Typing fluency
- `lib/typing-rhythm.ts` - Keystroke patterns
- `hooks/useImplicitMetrics.ts` - Collection hook

**Schema**: `UserBehaviorMetrics` table

**Fields**:
- timeToFirstClick, dwellTime, totalResponseTime
- answerChanges, optionHovers, scrollDepth
- hesitationEvents, backtrackCount
- timeOfDay, deviceType

---

### **Step 2: Create User Preferences Table** 🔴 P0

**Problem**: User settings in localStorage, lost on device change.

**Schema**: `UserPreferences` table

**Fields**:
- Study: dailyGoal, preferredSystems, sessionLength, difficulty
- Timing: wakeTime, studyReminders, reminderTime
- UI: theme, soundEnabled, hapticFeedback
- Learning: showHints, autoAdvance, explanationDepth

---

### **Step 3: Enrich UserLearningProfile** 🟠 P1

**Problem**: UserLearningProfile exists but many fields empty.

**Fields to Populate**:
- chronotype (from performance by time)
- peakLearningHour (from session data)
- avgSessionDuration (from StudySession)
- preferredDifficulty (from performance)
- learningVelocity (improvement rate)
- metacognitionScore (JOL accuracy)
- cognitiveLoadThreshold (optimal session length)

**Implementation**: Daily aggregation job.

---

### **Step 4: Add Learning Style Detection** 🟠 P1

**Problem**: App doesn't adapt to how users learn best.

**Dimensions**:
- Pace preference (fast/moderate/thorough)
- Explanation engagement depth
- Repetition pattern preference
- Error recovery pattern

**Storage**: `UserLearningProfile.learningStyle` JSONB field

---

### **Step 5: Implement User Goal Tracking** 🟠 P1

**Problem**: Users can't set and track PANCE prep goals.

**Schema**: `UserGoal` table

**Goal Types**:
- daily (X questions/day)
- weekly (X questions/week)
- exam-date (reach Y% by date)
- mastery (reach stability Z for system)

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

| Step | Effort | Impact | Priority | Sprint |
|------|--------|--------|----------|--------|
| 1. Persist Implicit Metrics | Medium | Very High | 🔴 P0 | A |
| 2. User Preferences Table | Low | Very High | 🔴 P0 | A |
| 3. Enrich UserLearningProfile | Medium | High | 🟠 P1 | B |
| 4. Learning Style Detection | High | High | 🟠 P1 | B |
| 5. Goal Tracking | Medium | High | 🟠 P1 | B |
| 6. Per-User Confusion Patterns | Low | Medium | 🟡 P2 | C |
| 7. Session Context Tracking | Low | Medium | 🟡 P2 | C |
| 8. Circadian Performance Storage | Medium | Medium | 🟡 P2 | C |
| 9. Activity Timeline | Medium | Low | 🟢 P3 | D |
| 10. Data Export API | Medium | Medium | 🟢 P3 | D |

---

## Sprint Plan

**Sprint A (1 week)**: Steps 1-2 - Core data persistence  
**Sprint B (1 week)**: Steps 3-5 - Learning personalization  
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

| File | Purpose |
|------|---------|
| `prisma/migrations/add_user_data_tables.sql` | Schema for Steps 1-2, 5-9 |
| `functions/api/user/preferences.ts` | Sync preferences |
| `functions/api/user/behavior-metrics.ts` | Store implicit data |
| `functions/api/user/goals.ts` | Goal CRUD |
| `functions/api/user/export-data.ts` | GDPR export |
| `scripts/automation/jobs/userProfileAggregation.ts` | Daily enrichment |

---

## Related Documentation

- [STATISTICS_IMPROVEMENT_PLAN.md](./STATISTICS_IMPROVEMENT_PLAN.md) - Platform statistics
- [DATABASE_IMPROVEMENT_PLAN.md](./DATABASE_IMPROVEMENT_PLAN.md) - Database improvements
- [QUESTION_GENERATION_IMPROVEMENT_PLAN.md](./QUESTION_GENERATION_IMPROVEMENT_PLAN.md) - Question quality

---

**Report Generated:** January 13, 2026
