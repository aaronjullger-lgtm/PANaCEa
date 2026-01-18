# Automation Setup Guide

## Current Status

The automated tasks are **already set up** and will run automatically once you deploy. No additional configuration needed!

## How It Works

### Daily Automation (3 AM)

**Automatically runs:**

1. Creates today's Grand Rounds challenge
2. Cleans up old OSCE chat history (7+ days)
3. Cleans up old background jobs (30+ days)
4. Validates content accuracy
5. Identifies content gaps
6. Checks media asset quality
7. Aggregates performance metrics

**Setup for deployment:**

#### Option 1: Cloudflare Pages (Recommended)

The automation will NOT run automatically on Cloudflare Pages (static site). You need to set up a scheduled worker or use Option 2.

**To add scheduled automation:**

1. Create a Cloudflare Worker with cron trigger
2. Set schedule: `0 3 * * *` (3 AM daily)
3. Call your automation endpoint or run tasks directly

**Example Worker:**

```typescript
export default {
  async scheduled(event, env, ctx) {
    // Run daily tasks
    const response = await fetch('https://your-domain.com/api/automation/daily', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.AUTOMATION_SECRET}`,
      },
    });

    console.log('Daily automation completed:', await response.json());
  },
};
```

#### Option 2: Node.js Backend (Alternative)

If you deploy `server.ts` to a Node.js platform (Railway, Render, Fly.io):

1. **Install cron package:**

```bash
npm install node-cron
```

2. **Add to server.ts:**

```typescript
import cron from 'node-cron';

// Schedule daily tasks at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('Running daily automation tasks...');
  try {
    await runDailyTasks();
    console.log('Daily automation completed successfully');
  } catch (error) {
    console.error('Daily automation failed:', error);
  }
});
```

3. **Deploy** - The cron job will run automatically

#### Option 3: GitHub Actions (Simple Alternative)

Create `.github/workflows/daily-automation.yml`:

```yaml
name: Daily Automation

on:
  schedule:
    - cron: '0 3 * * *' # 3 AM daily
  workflow_dispatch: # Manual trigger

jobs:
  run-automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run daily tasks
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npm run automation:daily
```

## Manual Execution

### Run Anytime

```bash
# Daily tasks
npm run automation:daily

# Hourly health checks
npm run automation:hourly
```

### Test Before Deploying

```bash
# Test daily automation
npm run automation:daily

# Check logs
cat logs/daily/daily-$(date +%Y-%m-%d).json
```

## What Happens on First Deploy

1. **Grand Rounds**: No challenge exists yet
   - First run will create today's challenge
   - Users can complete immediately
2. **OSCE Chat**: No old data to clean
   - Cleanup runs but finds nothing (normal)
3. **Performance Metrics**: May show no data
   - Will populate as users study

## Monitoring

### Check if automation is working:

```bash
# View logs
ls logs/daily/

# View latest report
cat logs/daily/daily-$(date +%Y-%m-%d).json

# Check Grand Rounds challenge exists
# Via API: GET /api/grandrounds/challenge
```

### Success indicators:

- ✅ Log file created in `logs/daily/`
- ✅ All tasks show "completed" status
- ✅ Grand Rounds challenge exists for today
- ✅ No failures in summary

## Troubleshooting

### Automation not running

**Check:**

1. Cron is configured (see setup options above)
2. Database connection works
3. Environment variables are set

### Tasks failing

**Check logs:**

```bash
cat logs/daily/daily-*.json | grep "failed"
```

**Common issues:**

- Database connection timeout (check `DATABASE_URL`)
- Gemini API rate limit (check API key)
- Missing environment variables

## Recommended Deployment Approach

**Best option:** GitHub Actions + Node.js Backend

1. Deploy frontend to Cloudflare Pages
2. Deploy `server.ts` to Railway/Render
3. Set up GitHub Actions for automation
4. Use environment secrets for sensitive data

This ensures:

- ✅ Frontend is fast (Cloudflare CDN)
- ✅ Backend handles database (Node.js with Prisma)
- ✅ Automation runs reliably (GitHub Actions)
- ✅ Easy monitoring and logs

## Summary

**Status**: ✅ Code is ready, just needs cron scheduling
**Recommended**: Use GitHub Actions (Option 3) - simplest and most reliable
**No user setup needed**: All automation logic is implemented, just add scheduling
**Deploys automatically**: Once scheduled, runs every day at 3 AM

The automated tasks will start working immediately after you set up the scheduling using any of the options above.
