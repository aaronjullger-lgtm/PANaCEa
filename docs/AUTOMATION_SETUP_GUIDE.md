# PANaCEa Automation Setup Guide

This document explains how to set up automated background jobs for data analysis, user analytics, daily study prescriptions, and maintenance tasks.

---

## 📋 Overview of Available Automations

| Job                        | Frequency    | Purpose                                    | Setup Required  |
| -------------------------- | ------------ | ------------------------------------------ | --------------- |
| Question Pool Replenish    | Daily        | Keep question pool above minimum threshold | Cloudflare Cron |
| User Analytics Aggregation | Daily        | Compile performance metrics                | Cloudflare Cron |
| Daily Study Prescription   | Daily (6 AM) | Generate personalized study plans          | Cloudflare Cron |
| Drift Detection            | Weekly       | Flag stale AI content                      | GitHub Actions  |
| Database Cleanup           | Weekly       | Remove orphaned records                    | GitHub Actions  |
| Full Analytics Report      | Monthly      | Comprehensive user insights                | GitHub Actions  |

---

## 🔧 Part 1: Cloudflare Cron Triggers (You Must Configure)

Cloudflare Pages Functions can run on a schedule via Cron Triggers. You need to set these up in your Cloudflare dashboard.

### Step 1: Create Scheduled Functions

Your `wrangler.toml` should include cron triggers. If not present, add:

```toml
# wrangler.toml
[triggers]
crons = [
  "0 6 * * *",   # Daily at 6 AM UTC - Study Prescription
  "0 2 * * *",   # Daily at 2 AM UTC - Analytics Aggregation
  "0 3 * * *",   # Daily at 3 AM UTC - Question Pool Replenish
]
```

### Step 2: Create the Scheduled Handler

Create `functions/_scheduler.ts`:

```typescript
/**
 * Cloudflare Scheduled Handler
 * Runs daily cron jobs for PANaCEa
 */

export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const hour = new Date(event.scheduledTime).getUTCHours();

  switch (hour) {
    case 2:
      // 2 AM UTC - Analytics Aggregation
      await aggregateDailyAnalytics(env);
      break;
    case 3:
      // 3 AM UTC - Question Pool Replenish
      await replenishQuestionPool(env);
      break;
    case 6:
      // 6 AM UTC - Daily Study Prescription
      await generateStudyPrescriptions(env);
      break;
  }
}

async function aggregateDailyAnalytics(env: Env) {
  await fetch(`${env.APP_URL}/api/cron/aggregate-analytics`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
}

async function replenishQuestionPool(env: Env) {
  await fetch(`${env.APP_URL}/api/cron/replenish-pool`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
}

async function generateStudyPrescriptions(env: Env) {
  await fetch(`${env.APP_URL}/api/cron/daily-prescription`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
}
```

### Step 3: Add Cron Secret to Environment

In Cloudflare Pages dashboard:

1. Go to Settings → Environment Variables
2. Add `CRON_SECRET` with a secure random string
3. This prevents unauthorized cron endpoint access

---

## 🔄 Part 2: GitHub Actions (Copy & Configure)

### Drift Detection (Weekly)

Create `.github/workflows/drift-detection.yml`:

```yaml
name: AI Content Drift Detection

on:
  schedule:
    - cron: '0 4 * * 0' # Every Sunday at 4 AM UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  drift-detection:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run drift detection
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx ts-node scripts/cron/drift-detector.ts

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: drift-report
          path: drift-report.json
          retention-days: 30
```

### Weekly Database Cleanup

Create `.github/workflows/weekly-cleanup.yml`:

```yaml
name: Weekly Database Cleanup

on:
  schedule:
    - cron: '0 3 * * 1' # Every Monday at 3 AM UTC
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run cleanup scripts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          npx ts-node scripts/cleanup-orphaned-conditions.ts
          npx ts-node scripts/maintenance/autoRepair.ts
```

### Monthly Analytics Report

Create `.github/workflows/monthly-analytics.yml`:

```yaml
name: Monthly Analytics Report

on:
  schedule:
    - cron: '0 5 1 * *' # First day of month at 5 AM UTC
  workflow_dispatch:

jobs:
  analytics:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate monthly report
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npx ts-node scripts/analysis/comprehensive-table-analyzer.ts
```

---

## 🔐 Part 3: Required Secrets Setup

### GitHub Secrets (Required for GitHub Actions)

Go to your GitHub repo → Settings → Secrets and variables → Actions:

| Secret Name        | Description                  | Where to Get                             |
| ------------------ | ---------------------------- | ---------------------------------------- |
| `DATABASE_URL`     | PostgreSQL connection string | Supabase dashboard → Settings → Database |
| `GEMINI_API_KEY`   | Google AI API key            | Google AI Studio                         |
| `CLERK_SECRET_KEY` | Clerk backend key            | Clerk dashboard                          |

### Cloudflare Environment Variables

Go to Cloudflare Pages → Your project → Settings → Environment Variables:

| Variable      | Description                                             |
| ------------- | ------------------------------------------------------- |
| `CRON_SECRET` | Random string for cron auth                             |
| `APP_URL`     | Your production URL (e.g., `https://panacea.pages.dev`) |

---

## 📊 Part 4: API Endpoints for Cron Jobs

Create these API endpoints to handle cron requests:

### `functions/api/cron/aggregate-analytics.ts`

```typescript
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Verify cron secret
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Aggregate daily user statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      const attempts = await prisma.questionAttempt.count({
        where: {
          userId: user.id,
          createdAt: { gte: today },
        },
      });

      const correct = await prisma.questionAttempt.count({
        where: {
          userId: user.id,
          createdAt: { gte: today },
          isCorrect: true,
        },
      });

      // Store daily stats (create DailyUserStats table if needed)
      await prisma.sessionAnalytics.create({
        data: {
          userId: user.id,
          sessionDate: today,
          questionsAnswered: attempts,
          correctAnswers: correct,
          accuracy: attempts > 0 ? (correct / attempts) * 100 : 0,
        },
      });
    }

    return new Response(JSON.stringify({ success: true, usersProcessed: users.length }));
  } finally {
    await prisma.$disconnect();
  }
}
```

### `functions/api/cron/daily-prescription.ts`

```typescript
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Verify cron secret
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get active users (logged in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeUsers = await prisma.user.findMany({
      where: {
        lastActiveAt: { gte: weekAgo },
      },
      include: {
        userProgress: true,
      },
    });

    for (const user of activeUsers) {
      // Calculate weak areas based on UserProgress
      const weakSystems = user.userProgress
        .filter((p) => p.stability < 2 || p.retrievability < 0.8)
        .slice(0, 5);

      // Generate daily prescription
      await prisma.dailyPrescription.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: new Date(),
          },
        },
        update: {
          weakAreas: weakSystems.map((s) => s.system),
          recommendedQuestions: 20,
          focusSystems: weakSystems.map((s) => s.system).slice(0, 3),
        },
        create: {
          userId: user.id,
          date: new Date(),
          weakAreas: weakSystems.map((s) => s.system),
          recommendedQuestions: 20,
          focusSystems: weakSystems.map((s) => s.system).slice(0, 3),
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        prescriptionsGenerated: activeUsers.length,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}
```

### `functions/api/cron/replenish-pool.ts`

```typescript
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Verify cron secret
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const MIN_POOL_SIZE = 100;

    // Count active questions by system
    const systems = [
      'cardiovascular',
      'pulmonary',
      'gastrointestinal',
      'neurological',
      'musculoskeletal',
    ];

    const poolStats: Record<string, number> = {};

    for (const system of systems) {
      const count = await prisma.question.count({
        where: {
          system,
          status: 'active',
        },
      });
      poolStats[system] = count;

      if (count < MIN_POOL_SIZE) {
        // Flag for generation (actual generation would call Gemini)
        console.log(`[Cron] ${system} pool low: ${count}/${MIN_POOL_SIZE}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        poolStats,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}
```

---

## ✅ Setup Checklist

### Must Do (Manual Steps)

- [ ] **GitHub Secrets**: Add `DATABASE_URL`, `GEMINI_API_KEY`, `CLERK_SECRET_KEY`
- [ ] **Cloudflare Env Vars**: Add `CRON_SECRET`, `APP_URL`
- [ ] **Create Workflow Files**: Copy the 3 GitHub Actions YAML files above
- [ ] **Create Cron Endpoints**: Create the 3 API endpoint files above
- [ ] **Test Manually**: Run each GitHub Action manually via `workflow_dispatch`

### Optional Enhancements

- [ ] Add Slack/Discord notifications on job completion
- [ ] Add email alerts for drift detection findings
- [ ] Set up Sentry monitoring for cron job failures

---

## 🧪 Testing Automations Locally

```bash
# Test drift detection
npx ts-node scripts/cron/drift-detector.ts

# Test analytics aggregation (requires DATABASE_URL)
curl -X POST http://localhost:8788/api/cron/aggregate-analytics \
  -H "Authorization: Bearer your-cron-secret"

# Test daily prescription
curl -X POST http://localhost:8788/api/cron/daily-prescription \
  -H "Authorization: Bearer your-cron-secret"
```

---

## 📈 Monitoring

After setup, monitor automation health via:

1. **GitHub Actions**: Check Actions tab for workflow runs
2. **Cloudflare Analytics**: View cron trigger invocations
3. **Database**: Query `AuditLog` table for `DRIFT_DETECTION` entries
4. **Admin Dashboard**: Check `/admin` for system health metrics

---

## 🚨 Troubleshooting

### Cron jobs not running

- Verify `CRON_SECRET` is set in Cloudflare
- Check Cloudflare Pages deployment logs
- Ensure `wrangler.toml` has correct cron syntax

### GitHub Actions failing

- Check secrets are correctly named and valued
- Verify `DATABASE_URL` allows external connections
- Check Node.js version matches local dev

### Missing data in analytics

- Ensure `SessionAnalytics` table exists in schema
- Run Prisma migrations: `npx prisma migrate deploy`
- Check user IDs exist in `User` table
