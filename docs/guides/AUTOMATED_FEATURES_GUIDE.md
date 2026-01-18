# PANaCEa Automated Features Guide

## Overview

PANaCEa now includes comprehensive automation and intelligent features to make medical education easier and more effective for PA students.

## Features

### 1. Grand Rounds Daily Competitive Mode

**What it does:**

- Automatically creates a new 5-question challenge every day at 3 AM
- Speed-weighted scoring system rewards both accuracy and speed
- Global leaderboard shows your rank against all students
- Fair competition with everyone getting the same questions each day

**API Endpoints:**

```typescript
// Get today's challenge
GET /api/grandrounds/challenge

// Check if you completed today
GET /api/grandrounds/completed?userId={userId}

// Submit your score
POST /api/grandrounds/submit
Body: {
  userId: string,
  date: string,
  score: number,
  completionTimeMs: number,
  correctAnswers: number,
  timeBonus: number
}

// Get leaderboard
GET /api/grandrounds/leaderboard?date={date}&limit=100

// Get your rank
GET /api/grandrounds/rank?userId={userId}&date={date}
```

**Scoring:**

- Base points: Depends on question difficulty
- Time bonus: 0-200 points (faster = more bonus)
- Rank calculation: Higher score wins; ties broken by speed

**Usage:**

```typescript
import { getTodaysChallenge, submitCompletion } from '@/services/grandRoundsService';

// Get challenge
const challenge = await getTodaysChallenge();

// Submit after completion
const rank = await submitCompletion(userId, score, timeMs, correctCount);
```

---

### 2. OSCE Chat History System

**What it does:**

- Stores conversation history during patient encounters
- Maintains context for AI to understand the full conversation
- Automatically cleans up chat after 7 days
- Supports both provider and patient messages

**API Endpoints:**

```typescript
// Save a chat message
POST /api/osce/chat
Body: {
  sessionId: string,
  userId: string,
  role: 'user' | 'patient',
  message: string,
  phase?: string,
  isRelevant?: boolean
}

// Get chat history
GET /api/osce/history?sessionId={sessionId}&limit=100

// Clean up after encounter
DELETE /api/osce/cleanup?sessionId={sessionId}
```

**Usage:**

```typescript
import {
  saveChatMessage,
  getChatHistory,
  cleanupChatHistory,
  buildConversationContext,
} from '@/services/osceService';

// Save messages during encounter
await saveChatMessage(sessionId, userId, 'user', 'What brings you in today?');
await saveChatMessage(sessionId, userId, 'patient', 'I have chest pain.');

// Get full conversation for AI context
const history = await getChatHistory(sessionId);
const context = buildConversationContext(history);

// Clean up when done
await cleanupChatHistory(sessionId);
```

---

### 3. Student Insights & Recommendations

**What it does:**

- Analyzes your performance automatically
- Identifies weak areas with specific recommendations
- Tracks performance trends (improving/declining/stable)
- Suggests optimal study strategies
- Warns you when to take breaks

**API Endpoint:**

```typescript
GET /api/student/insights?userId={userId}&period={period}
// period: '7d' | '30d' | '90d' | 'all' (default: '30d')
```

**Response includes:**

- Overall accuracy and trend
- Weak areas with recommendations
- Strong areas for confidence
- Time optimization feedback
- Personalized study suggestions
- Achievement level (Beginner → Master)

**Usage:**

```typescript
import {
  getStudentInsights,
  formatInsightMessage,
  getPriorityAction,
  needsBreak,
  getAchievementLevel,
} from '@/services/studentInsightsService';

// Get insights
const insights = await getStudentInsights(userId, '30d');

// Check if student needs a break
if (needsBreak(insights)) {
  console.log('Your performance is declining. Consider taking a break!');
}

// Get priority focus area
const priority = getPriorityAction(insights);
console.log(priority); // "Focus on Cardiology (62% accuracy) - try 2 more drills this week"

// Get achievement level
const { level, emoji, message } = getAchievementLevel(insights.summary.accuracy);
console.log(`${emoji} ${level}: ${message}`);
```

---

## Automation Tasks

### Daily Automation (runs at 3 AM)

**Tasks performed:**

1. **Create Grand Rounds Challenge** - Generates today's 5 questions
2. **Content Accuracy Validation** - Checks for placeholder content
3. **Content Gap Identification** - Finds systems with <10 conditions
4. **Media Asset Quality Check** - Validates images and media
5. **Performance Metrics Aggregation** - Summarizes yesterday's activity
6. **Database Cleanup**:
   - Old background jobs (30+ days)
   - Old OSCE chat history (7+ days)

**Run manually:**

```bash
npm run automation:daily
```

**Logs saved to:**

```
logs/daily/daily-YYYY-MM-DD.json
```

### Hourly Automation

**Tasks performed:**

1. Database connection check
2. Gemini API connectivity test
3. Background job monitoring
4. Content availability check
5. System resource monitoring

**Run manually:**

```bash
npm run automation:hourly
```

---

## Best Practices

### For Students

1. **Daily Grand Rounds:**
   - Complete the challenge every day for consistency
   - Try to improve your speed while maintaining accuracy
   - Check your rank to track progress against peers

2. **Study with Insights:**
   - Check insights weekly to identify weak areas
   - Follow the personalized recommendations
   - Take breaks when performance is declining

3. **OSCE Practice:**
   - Use realistic conversation in patient encounters
   - Review chat history to learn from mistakes
   - Practice regularly for best results

### For Developers

1. **API Integration:**
   - Always include error handling
   - Validate responses before using data
   - Use TypeScript types for safety

2. **Automation:**
   - Schedule daily tasks using cron: `0 3 * * *`
   - Monitor logs for failures
   - Set up alerts for critical errors

3. **Database:**
   - Prisma Accelerate required for Cloudflare deployment
   - Regular backups recommended
   - Monitor connection pool usage

---

## Troubleshooting

### Grand Rounds not creating challenges

**Check:**

1. Daily automation is scheduled: `0 3 * * *`
2. Database connection is active
3. Check logs: `logs/daily/daily-*.json`

**Fix:**

```bash
# Run manually to create today's challenge
npm run automation:daily
```

### OSCE chat not saving

**Check:**

1. SessionId is valid and consistent
2. Message length is 1-5000 characters
3. Role is 'user' or 'patient'

**Error codes:**

- 400: Invalid input (check validation)
- 401: Not authenticated
- 500: Server error (check logs)

### Student insights not loading

**Check:**

1. User has performance data in the period
2. PerformanceRecord table has data
3. UserId matches authenticated user

**Response when no data:**

```json
{
  "insights": {
    "hasData": false,
    "message": "No activity in this period. Start studying to get personalized insights!"
  }
}
```

---

## Environment Variables

Required for full functionality:

```bash
# Database (Prisma Accelerate)
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY

# Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_public_key

# AI Features
GEMINI_API_KEY=your_gemini_api_key
```

---

## Performance Considerations

### API Rate Limits

- Grand Rounds: 1 submission per day per user
- OSCE Chat: 100 messages per session recommended
- Student Insights: Can be called frequently, cached for 5 minutes

### Database Optimization

- Indexes on: `userId`, `date`, `sessionId`
- Automatic cleanup prevents bloat
- Connection pooling via Prisma Accelerate

### Caching Strategy

- Grand Rounds challenge: Cached for 24 hours
- Student insights: Consider client-side caching
- Leaderboard: Cache for 5-10 minutes

---

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Review error messages in console
3. Verify environment variables
4. Check database connectivity

For feature requests or bugs, please open an issue in the repository.
