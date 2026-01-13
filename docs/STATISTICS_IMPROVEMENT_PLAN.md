# 📊 PANaCEa Statistics Collection - 10-Step Improvement Plan

**Date:** January 13, 2026  
**Status:** ✅ Sprint A Complete (Steps 1-2) - Ready for Sprint B  
**Focus:** Statistics collection, aggregation, and monitoring

---

## Executive Summary

This plan focuses specifically on improving statistics collection across the PANaCEa platform, enabling better user insights, content quality tracking, and platform health monitoring.

---

## Current Statistics Infrastructure

### ✅ What's Working
| Component | Location | Status |
|-----------|----------|--------|
| User Streak Tracking | `userStatistics.ts` | ✅ Hourly job |
| FSRS Due Card Calculation | `userStatistics.ts` | ✅ Hourly job |
| DAU/Retention Metrics | `userStatistics.ts` | ✅ Daily job |
| Weekly Progress Reports | `userStatistics.ts` | ✅ Weekly job |
| Session Analytics | `StudySession` model | ✅ Recording |
| Question Attempts | `QuestionAttempt` model | ✅ Recording |
| Cognitive State | `advancedUserAnalyticsEngine.ts` | ✅ In-memory |
| Circadian Analytics | `circadianAnalyticsService.ts` | ✅ Client-side |

### ⚠️ Gaps Identified
| Gap | Impact | Current State |
|-----|--------|---------------|
| No **Platform-wide Statistics Table** | Can't track trends over time | Calculated on-demand |
| No **Question Quality Statistics** | Can't identify bad questions | Only `flagCount` tracked |
| **Content Usage Statistics** missing | Don't know which conditions are studied | No tracking |
| **System-level Aggregate Stats** not persisted | Recalculated every request | Slow dashboard loads |
| No **Cohort Comparison Statistics** | Can't compare user groups | Schema exists, not populated |
| **Real-time Analytics Stream** missing | No live dashboard | Polling only |
| **Historical Snapshots** not stored | Can't show progress over months | Only current state |
| No **Question Difficulty Calibration** | Difficulty ratings may be wrong | Static labels |

---

## 🔟 10-Step Improvement Plan

### **Step 1: Create Platform Statistics Table** ✅ COMPLETE

**Problem**: Platform-wide stats (DAU, retention, questions answered) are calculated on-demand, making dashboards slow.

**Solution**: Daily cron job collecting platform-wide metrics.

**Implementation**: `scripts/automation/jobs/platformStatistics.ts` (420+ lines)
- `calculateActiveUsers()`: DAU/WAU/MAU from QuestionAttempt.createdAt
- `calculateUserCohorts()`: New vs. returning users
- `calculateRetention()`: 7-day and 30-day retention rates
- `calculateQuestionMetrics()`: Questions answered, accuracy
- `calculateSessionMetrics()`: Session starts, completions, duration
- `calculateFSRSMetrics()`: Cards reviewed, mature cards, retention

**Schema**: `PlatformStatistics` table (already exists)
```prisma
model PlatformStatistics {
  id                      String    @id
  date                    DateTime  @unique @db.Date
  dau                     Int
  wau                     Int
  mau                     Int
  newUsers                Int
  returningUsers          Int
  retention7Day           Decimal?
  retention30Day          Decimal?
  questionsAnswered       Int
  questionsCorrect        Int
  questionsIncorrect      Int
  averageAccuracy         Decimal?
  sessionsStarted         Int
  sessionsCompleted       Int
  averageSessionDuration  Int?
  totalStudyTime          Int
  fsrsCardsReviewed       Int
  fsrsCardsMature         Int
  fsrsAverageRetention    Decimal?
  // ...
}
```

**Schedule**: Daily at 2 AM UTC
**Command**: `npm run stats:platform`

**Status**: ✅ Job created, uses createdAt timestamps, ready to deploy

---

### **Step 2: Add Content Usage Statistics** ✅ COMPLETE

**Problem**: No tracking of which conditions/systems are being studied.

**Solution**: Daily cron job collecting per-condition usage metrics.

**Implementation**: `scripts/automation/jobs/contentStatistics.ts` (350+ lines)
- `getActiveConditions()`: Finds conditions with activity
- `calculateQuestionMetrics()`: Questions answered, accuracy, time spent
- `calculateViews()`: Approximate views from attempts
- `calculateBookmarkCount()`: Bookmarks added
- `calculateFlagCount()`: Questions flagged
- `processCondition()`: Batch processing with validation

**Schema**: `ContentStatistics` table (already exists)
```prisma
model ContentStatistics {
  id                String          @id
  conditionId       String
  date              DateTime        @db.Date
  views             Int
  questionsAnswered Int
  questionsCorrect  Int
  uniqueUsers       Int
  averageAccuracy   Decimal?
  averageTimeSpent  Int?
  bookmarkCount     Int
  flagCount         Int
  // ...
}
```

**Benefits**: 
- Know which conditions need more questions
- Identify trending topics
- Find under-studied high-yield conditions
- Track content quality per condition

**Schedule**: Daily at 3 AM UTC
**Command**: `npm run stats:content`

**Status**: ✅ Job created, uses createdAt timestamps, ready to deploy

---

### **Step 3: Implement Question Quality Statistics** 🟠 P1

**Problem**: Can't identify problematic questions systematically.

**Implementation**:
- Track `timesServed`, `timesCorrect`, `avgTimeMs` on each question
- Auto-flag questions with `flagRate > 0.1` or `accuracy < 0.2`
- Weekly quality report

---

### **Step 4: Create User Statistics Snapshot Table** 🟠 P1

**Problem**: Can't show user progress over time.

**Schema**: `UserStatisticsSnapshot` table
**Cron Job**: Weekly snapshot for all active users
**Use Case**: Show "Your progress over the last 3 months" charts

---

### **Step 5: Add Real-Time Session Statistics Endpoint** 🟠 P1

**Problem**: Dashboard relies on polling; no real-time updates.

**Implementation**: Server-Sent Events (SSE) endpoint
**API**: `GET /api/analytics/live-stats`

---

### **Step 6: Implement Cohort Statistics Aggregation** 🟡 P2

**Problem**: `Cohort` and `CohortMember` tables exist but no statistics.

**Use Case**: Compare "Class of 2026" vs "Class of 2027" performance
**API**: `GET /api/cohorts/:id/statistics`

---

### **Step 7: Add Question Difficulty Auto-Calibration** 🟡 P2

**Problem**: Question difficulty is static but doesn't reflect actual performance.

**Implementation**:
- Weekly job analyzes actual accuracy
- Recalibrates difficulty: >80% = easy, 50-80% = medium, <50% = hard
- Minimum 20 attempts required for calibration

---

### **Step 8: Create Admin Analytics Dashboard API** 🟡 P2

**Problem**: Admin needs comprehensive stats view but endpoints are scattered.

**API**: `GET /api/admin/analytics-dashboard`
**Returns**: Platform, content, user, and quality metrics in one call

---

### **Step 9: Implement Time-Series Statistics Export** 🟢 P3

**Problem**: Can't export historical data for analysis/reporting.

**API**: `GET /api/admin/export-stats?start=&end=&format=csv|json`
**Use Case**: Monthly reports, board presentations

---

### **Step 10: Add Statistics Health Monitoring** 🟢 P3

**Problem**: No alerts when statistics jobs fail or anomalies occur.

**Implementation**:
- Check platform stats are up to date
- DAU anomaly detection (50%+ drops)
- Question stats integrity checks
- Slack/email alerts

---

## Implementation Priority Matrix

| Step | Effort | Impact | Priority | Sprint |
|------|--------|--------|----------|--------|
| 1. Platform Statistics Table | Medium | Very High | 🔴 P0 | A |
| 2. Content Usage Statistics | Medium | Very High | 🔴 P0 | A |
| 3. Question Quality Statistics | Low | High | 🟠 P1 | B |
| 4. User Statistics Snapshots | Medium | High | 🟠 P1 | B |
| 5. Real-Time Stats Endpoint | Medium | Medium | 🟠 P1 | B |
| 6. Cohort Statistics | Medium | Medium | 🟡 P2 | C |
| 7. Difficulty Calibration | Low | High | 🟡 P2 | C |
| 8. Admin Dashboard API | Medium | Medium | 🟡 P2 | C |
| 9. Time-Series Export | Low | Low | 🟢 P3 | D |
| 10. Statistics Health Monitor | Medium | Medium | 🟢 P3 | D |

---

## Sprint Plan

**Sprint A (1 week)**: Steps 1-2 - Core statistics tables  
**Sprint B (1 week)**: Steps 3-5 - Quality tracking & real-time  
**Sprint C (1 week)**: Steps 6-8 - Cohorts & admin dashboard  
**Sprint D (1 week)**: Steps 9-10 - Export & monitoring  

---

## Files Created

| File | Purpose |
|------|---------|
| `prisma/migrations/add_platform_statistics.sql` | Schema for Steps 1, 2, 4 |
| `scripts/automation/jobs/platformStatistics.ts` | Daily aggregation job |
| `scripts/automation/jobs/questionQuality.ts` | Question quality tracking |
| `scripts/automation/jobs/userSnapshots.ts` | Weekly user snapshots |
| `functions/api/admin/analytics-dashboard.ts` | Unified admin stats API |
| `functions/api/analytics/live-stats.ts` | Real-time SSE endpoint |
| `scripts/automation/jobs/statisticsHealthCheck.ts` | Health monitoring |

---

## Related Documentation

- [AUTOMATION_JOBS_GUIDE.md](./AUTOMATION_JOBS_GUIDE.md) - Existing automation jobs
- [DATABASE_IMPROVEMENT_PLAN.md](./DATABASE_IMPROVEMENT_PLAN.md) - Database improvements

---

**Report Generated:** January 13, 2026
