# Automation Jobs Guide

This document describes the comprehensive automation system for PANaCEa, covering hourly, daily, and weekly automated tasks.

## Overview

The automation system consists of:

1. **GitHub Actions Workflows** - Scheduled workflows in `.github/workflows/`
2. **Automation Scripts** - TypeScript scripts in `scripts/automation/`
3. **Job Modules** - Reusable job functions in `scripts/automation/jobs/`

## Schedule Summary

| Frequency | Time            | Tasks                                                 |
| --------- | --------------- | ----------------------------------------------------- |
| Hourly    | :00             | Health checks, streak updates, leaderboard cache      |
| Daily     | 3 AM EST        | Content validation, DAU metrics, recommendations      |
| Weekly    | Sunday 2 AM EST | Progress reports, retention analysis, DB optimization |

## Job Modules

### User Statistics (`scripts/automation/jobs/userStatistics.ts`)

Handles all user-specific calculations and analytics.

#### Hourly Jobs

```typescript
import { updateUserStreaks, calculateDueCards, updateLeaderboardCache } from './jobs';

// Update user streaks (check for breaks)
await updateUserStreaks();

// Calculate FSRS due cards
await calculateDueCards();

// Update hourly leaderboard
await updateLeaderboardCache();
```

#### Daily Jobs

```typescript
import {
  generateDailyRecommendations,
  calculateDAUMetrics,
  aggregateConfusionPatterns,
} from './jobs';

// Generate personalized study recommendations
await generateDailyRecommendations();

// Calculate Daily Active Users
await calculateDAUMetrics();

// Find common mistake patterns
await aggregateConfusionPatterns();
```

#### Weekly Jobs

```typescript
import {
  generateWeeklyProgressReports,
  calculateWeeklyRetention,
  updatePANCEReadinessEstimates,
} from './jobs';

// Generate user progress reports
await generateWeeklyProgressReports();

// Calculate retention metrics
await calculateWeeklyRetention();

// Update PANCE readiness estimates
await updatePANCEReadinessEstimates();
```

### Health Checks (`scripts/automation/jobs/healthChecks.ts`)

Monitors system health and infrastructure.

#### Available Checks

| Check                        | Description                     |
| ---------------------------- | ------------------------------- |
| `checkDatabaseConnection()`  | Verify DB connectivity          |
| `checkDatabasePerformance()` | Test query latency              |
| `checkGeminiAPI()`           | Verify Gemini API access        |
| `checkClerkAuth()`           | Check Clerk authentication      |
| `checkSupabaseStorage()`     | Verify Supabase storage         |
| `checkErrorRates()`          | Monitor background job failures |
| `checkFlaggedQuestions()`    | Count pending question flags    |
| `checkContentAvailability()` | Verify medical content          |
| `checkQuestionPool()`        | Check question availability     |
| `runSmokeTest()`             | Simulate basic user workflow    |
| `checkSSLExpiry()`           | Verify SSL certificate          |

#### Aggregate Functions

```typescript
import { runHourlyHealthChecks, runDailyHealthChecks, summarizeResults } from './jobs';

// Run all hourly checks
const hourlyResults = await runHourlyHealthChecks();

// Run all daily checks
const dailyResults = await runDailyHealthChecks();

// Get summary
const summary = summarizeResults(dailyResults);
console.log(`${summary.passed}/${summary.total} checks passed`);
```

## GitHub Actions Workflows

### Hourly Automation (`.github/workflows/hourly-automation.yml`)

Runs every hour at :00:

- Database connectivity check
- Gemini API health check
- Content availability check
- Basic smoke test

### Daily Automation (`.github/workflows/daily-automation.yml`)

Runs at 3 AM EST:

- Full health check suite
- Content accuracy validation
- User recommendation generation
- DAU metrics calculation
- Database cleanup (old jobs/sync items)

### Weekly Automation (`.github/workflows/weekly-automation.yml`)

Runs Sundays at 2 AM EST:

- Comprehensive health audit
- Weekly progress reports for all users
- Retention analysis
- PANCE readiness updates
- Database optimization
- Full content maintenance

## Manual Execution

### Run Individual Jobs

```bash
# Run hourly checks
npx tsx -e "import { runHourlyHealthChecks, summarizeResults } from './scripts/automation/jobs'; runHourlyHealthChecks().then(r => console.log(summarizeResults(r)));"

# Run user statistics update
npx tsx -e "import { generateDailyRecommendations, disconnect } from './scripts/automation/jobs/userStatistics'; generateDailyRecommendations().then(console.log).finally(disconnect);"
```

### Run Full Scripts

```bash
# Hourly tasks
npm run automation:hourly

# Daily tasks
npm run automation:daily

# Weekly tasks
npm run automation:weekly
```

### Trigger GitHub Actions Manually

1. Go to Actions tab in GitHub
2. Select workflow (Hourly/Daily/Weekly)
3. Click "Run workflow"
4. Optionally set inputs (e.g., skip_reports for weekly)

## Environment Variables Required

```bash
DATABASE_URL=postgresql://...
GEMINI_API_KEY=AIza...
CLERK_SECRET_KEY=sk_...
SUPABASE_URL=https://...
PRODUCTION_URL=https://studypanacea.com
```

## Adding New Jobs

1. Create function in appropriate file (`userStatistics.ts` or `healthChecks.ts`)
2. Export from `index.ts`
3. Add to appropriate workflow/script

Example:

```typescript
// In userStatistics.ts
export async function myNewJob(): Promise<{ result: string }> {
  console.log('🔄 Running my new job...');
  // Your logic here
  return { result: 'success' };
}

// In index.ts
export { myNewJob } from './userStatistics';
```

## Monitoring & Alerts

### Workflow Status

Check workflow status in GitHub Actions:

- ✅ Green = All tasks passed
- ⚠️ Yellow = Some warnings but no failures
- ❌ Red = Critical failures

### Reports

- Hourly: Console output in workflow logs
- Daily: Saved to `logs/daily/daily-YYYY-MM-DD.json`
- Weekly: Saved to `logs/weekly/weekly-YYYY-MM-DD.json` and `weekly-report-latest.txt`

### GitHub Artifacts

Weekly reports are uploaded as GitHub Actions artifacts and retained for 30 days.

## Troubleshooting

### Database Connection Failures

1. Check `DATABASE_URL` is set correctly
2. Verify IP allowlisting in Supabase
3. Check connection pool limits

### Gemini API Failures

1. Verify `GEMINI_API_KEY` is valid
2. Check API quotas in Google Cloud Console
3. Review rate limits

### Missing Content

1. Run content seeding if database is empty
2. Check MedicalContent table has published records
3. Verify migrations are up to date

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions                               │
├─────────────────┬─────────────────────┬─────────────────────────┤
│ hourly-auto.yml │   daily-auto.yml    │   weekly-auto.yml       │
│   (every hour)  │   (3 AM daily)      │   (2 AM Sunday)         │
└────────┬────────┴──────────┬──────────┴────────────┬────────────┘
         │                   │                       │
         ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   scripts/automation/                            │
├─────────────────┬─────────────────────┬─────────────────────────┤
│ hourlyTasks.ts  │   dailyTasks.ts     │   weeklyTasks.ts        │
└────────┬────────┴──────────┬──────────┴────────────┬────────────┘
         │                   │                       │
         └───────────────────┼───────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   scripts/automation/jobs/                       │
├─────────────────────────────┬───────────────────────────────────┤
│     userStatistics.ts       │       healthChecks.ts             │
│  - updateUserStreaks()      │  - checkDatabaseConnection()      │
│  - calculateDueCards()      │  - checkGeminiAPI()               │
│  - generateRecommendations()│  - runSmokeTest()                 │
│  - generateWeeklyReports()  │  - checkSSLExpiry()               │
│  - updatePANCEReadiness()   │  - summarizeResults()             │
└─────────────────────────────┴───────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL (via Prisma)                     │
│  - User, UserProgress, UserLearningProfile                       │
│  - PerformanceRecord, DailyStreak                                │
│  - MedicalContent, Question, BackgroundJob                       │
└─────────────────────────────────────────────────────────────────┘
```

## Related Documentation

- [docs/AUTOMATION_SETUP_GUIDE.md](./AUTOMATION_SETUP_GUIDE.md) - Initial setup guide
- [docs/QUERY_OPTIMIZATION_GUIDE.md](./QUERY_OPTIMIZATION_GUIDE.md) - Database optimization
- [.clinerules](../.clinerules) - AI coding standards
