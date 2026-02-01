# Phase 3 Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Verify statistical isolation
npx tsx scripts/test-drill-mode.ts

# 2. Start development servers
npm run dev:wrangler

# 3. Navigate to Drill Hub
http://localhost:3000/drill
```

---

## 📍 Key Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/drill` | `DrillHub.tsx` | Central navigation + stats dashboard |
| `/drill/photo` | `PhotoDrillSession.tsx` | Photo recognition drill |
| `/drill/contrastive` | `ContrastiveSession.tsx` | DDx comparison drill |
| `/drill/wordle` | _(Phase 3.5)_ | Daily medical terminology puzzle |

---

## 🔌 API Endpoints

### GET `/api/drill/photo-batch`
Fetch photo drill questions

**Query Params:**
- `system` (optional): Cardiology, Dermatology, etc.
- `difficulty` (optional): easy, medium, hard
- `count` (default 10): 1-50

**Response:**
```json
[
  {
    "id": "asset_123",
    "imageUrl": "https://...",
    "thumbnailUrl": "https://...",
    "blurHash": "L7H2EC=PM+yV...",
    "correctConditionId": "cond_456",
    "correctAnswer": "Psoriasis",
    "options": ["Psoriasis", "Eczema", "Dermatitis", "Rosacea"],
    "system": "Dermatology"
  }
]
```

### GET `/api/drill/contrastive-batch`
Fetch DDx comparison questions

**Query Params:**
- `system` (optional)
- `difficulty` (optional)
- `count` (default 10)
- `personalized` (default false): Use user's confusion pairs

**Response:**
```json
[
  {
    "id": "set_123",
    "presentingSymptom": "Chest pain + ST elevation",
    "condition1": { "id": "cond_456", "name": "STEMI" },
    "condition2": { "id": "cond_789", "name": "Pericarditis" },
    "distinguishers": [
      { "feature": "Troponin elevation", "belongsTo": "condition1" },
      { "feature": "Friction rub", "belongsTo": "condition2" }
    ]
  }
]
```

### POST `/api/drill/log-attempt`
Log drill attempt (isMainSession=false)

**Body:**
```json
{
  "questionId": "asset_123",
  "drillType": "photo_drill",
  "wasCorrect": true,
  "responseTimeMs": 3200,
  "metadata": { "system": "Dermatology" }
}
```

**Response:**
```json
{
  "success": true,
  "attemptId": "attempt_999",
  "isMainSession": false
}
```

### GET `/api/drill/overview`
Dashboard statistics

**Response:**
```json
{
  "totalSessions": 42,
  "totalAttempts": 520,
  "overallAccuracy": 0.82,
  "currentStreak": 7,
  "bestStreak": 14,
  "recentActivity": [
    {
      "date": "2026-01-23",
      "drillType": "photo_drill",
      "accuracy": 0.85,
      "attempts": 20
    }
  ]
}
```

---

## 🗂️ Database Schema

### QuestionAttempt (Drill Logging)
```prisma
model QuestionAttempt {
  id              String   @id @default(cuid())
  userId          String
  questionId      String?
  conditionId     String?
  questionType    String?  // 'photo_drill' | 'contrastive_drill'
  wasCorrect      Boolean
  responseTimeMs  Int
  attemptedAt     DateTime @default(now())
  isMainSession   Boolean  @default(false) // ⚠️ CRITICAL: Must be false for drills
  metadata        Json?
}
```

### StudySession (Session Tracking)
```prisma
model StudySession {
  id            String      @id @default(cuid())
  userId        String
  sessionType   SessionType // CRAM for drill sessions
  startTime     DateTime    @default(now())
  endTime       DateTime?
  totalQuestions Int        @default(0)
  correctAnswers Int        @default(0)
}

enum SessionType {
  MAIN          // Standard spaced repetition
  CRAM          // Drill modes (isolated)
  RAPID_RECALL  // Quick review
}
```

### MediaAsset (Photo Drill)
```prisma
model MediaAsset {
  id           String  @id @default(cuid())
  type         String  // 'image' | 'audio' | 'video'
  usageType    String  // 'quiz' | 'teaching' | 'reference'
  modality     String? // 'dermatology' | 'radiology'
  originalUrl  String
  thumbnailUrl String?
  blurHash     String? // For progressive loading
  isAnnotated  Boolean @default(false)
  conditionId  String?
}
```

### ContrastiveSet (DDx Compare)
```prisma
model ContrastiveSet {
  id                 String   @id @default(cuid())
  condition1Id       String
  condition2Id       String
  presentingSymptom  String
  distinguishers     Json     // Array of { feature, belongsTo }
  isHighYield        Boolean  @default(false)
  difficulty         String   // 'easy' | 'medium' | 'hard'
  system             String?
}
```

---

## 🧪 Testing

### Statistical Isolation Verification

```typescript
// Test 1: Drill attempts use isMainSession = false
const drillAttempts = await prisma.questionAttempt.findMany({
  where: {
    questionType: { in: ['photo_drill', 'contrastive_drill'] },
    isMainSession: true, // Should be ZERO
  },
});

// Test 2: UserRolling360Stats unaffected
const statsBefore = await prisma.userRolling360Stats.findUnique({
  where: { userId },
});
await logDrillAttempt({ userId, drillType: 'photo_drill', ... });
const statsAfter = await prisma.userRolling360Stats.findUnique({
  where: { userId },
});
// statsBefore.totalAttempts === statsAfter.totalAttempts ✅

// Test 3: ReviewLog - MAIN/real sessions only (exclude drill/CRAM)
const reviewLogs = await prisma.reviewLog.findMany({
  where: {
    userId,
    OR: [{ review_type: 'real' }, { sessionType: 'MAIN' }],
  },
});
```

---

## 🎨 UI Components

### PhotoDrillCard

```tsx
import PhotoDrillCard from '@/components/drill/PhotoDrillCard';

<PhotoDrillCard
  question={{
    id: 'asset_123',
    imageUrl: 'https://...',
    blurHash: 'L7H2EC...',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 'Option A',
  }}
  onAnswer={(isCorrect, timeMs) => {
    logAttempt({ wasCorrect: isCorrect, responseTimeMs: timeMs });
  }}
  showFeedback={true}
/>
```

### ContrastiveCard

```tsx
import ContrastiveCard from '@/components/drill/ContrastiveCard';

<ContrastiveCard
  question={{
    id: 'set_123',
    presentingSymptom: 'Chest pain + ST elevation',
    condition1: { id: 'cond_1', name: 'STEMI' },
    condition2: { id: 'cond_2', name: 'Pericarditis' },
    distinguishers: [
      { feature: 'Troponin elevation', belongsTo: 'condition1' },
      { feature: 'Friction rub', belongsTo: 'condition2' },
    ],
  }}
  onSubmit={(isCorrect, assignments, timeMs) => {
    logAttempt({ wasCorrect: isCorrect, responseTimeMs: timeMs });
  }}
/>
```

---

## 🔧 Service Functions

### Photo Drill Service

```typescript
import { getPhotoDrillBatch } from '@/services/drill/photoDrill.service';

const questions = await getPhotoDrillBatch({
  system: 'Dermatology',
  difficulty: 'medium',
  count: 10,
});
```

### Contrastive Drill Service

```typescript
import { getContrastiveDrillBatch } from '@/services/drill/contrastiveDrill.service';

const questions = await getContrastiveDrillBatch({
  userId: 'user_123', // Optional: enables personalization
  system: 'Cardiology',
  count: 5,
});
```

### Session Manager

```typescript
import { logDrillAttempt, createDrillSession, completeDrillSession } from '@/services/drill/drillSessionManager';

// 1. Create session
const session = await createDrillSession({
  userId: 'user_123',
  drillType: 'photo_drill',
  plannedQuestions: 10,
});

// 2. Log attempts
await logDrillAttempt({
  userId: 'user_123',
  questionId: 'asset_123',
  drillType: 'photo_drill',
  wasCorrect: true,
  responseTimeMs: 3200,
});

// 3. Complete session
await completeDrillSession(session.id, {
  totalQuestions: 10,
  correctAnswers: 8,
});
```

---

## 🚨 Common Errors

### Error: "isMainSession must be false for drills"
**Cause**: Manually setting `isMainSession = true`  
**Fix**: Let `logDrillAttempt()` handle this automatically

### Error: "MediaAsset not found"
**Cause**: Empty `MediaAsset` table  
**Fix**: Run `npm run seed:media-assets`

### Error: "ContrastiveSet not found"
**Cause**: Empty `ContrastiveSet` table  
**Fix**: Run `npm run seed:contrastive-sets`

### Error: "Prisma Client not initialized"
**Cause**: Running services client-side  
**Fix**: Only use drill services in API routes or server components

---

## 📊 Performance Tips

### Image Loading Optimization

```tsx
// Use progressive loading
<div>
  {/* 1. BlurHash (< 1kb) */}
  <div style={{ backgroundImage: `url(${blurHash})` }} />
  
  {/* 2. Thumbnail (< 50kb) */}
  <img src={thumbnailUrl} className="blur-sm" />
  
  {/* 3. Full image (lazy) */}
  <img 
    src={originalUrl} 
    loading="lazy"
    onLoad={() => setLoaded(true)}
  />
</div>
```

### Batch Fetching

```typescript
// ✅ GOOD: Fetch batch of 10
const questions = await getPhotoDrillBatch({ count: 10 });

// ❌ BAD: Fetch one at a time
for (let i = 0; i < 10; i++) {
  const question = await getPhotoDrillBatch({ count: 1 });
}
```

### Caching Strategy

```typescript
// Service Worker (vite-plugin-pwa)
{
  urlPattern: /\/api\/drill\/.*/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'drill-api',
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 3600, // 1 hour
    },
  },
}
```

---

## 🎯 Architectural Rules

### ✅ DO

- Use database for all content (MediaAsset, ContrastiveSet)
- Set `isMainSession = false` for all drill attempts
- Use `sessionType = CRAM` for drill sessions
- Verify isolation with test script before deployment
- Use Cloudflare Functions for API routes
- Implement progressive image loading

### ❌ DON'T

- Create static JSON files for questions
- Set `isMainSession = true` for drills
- Mix drill stats with main stats
- Query drill attempts when calculating FSRS weights
- Import Prisma client in frontend components
- Serve full-resolution images immediately

---

## 📞 Support

**Questions?** Reference these docs:
- Full implementation: `docs/PHASE_3_DRILL_IMPLEMENTATION.md`
- Complete summary: `docs/PHASE_3_COMPLETE_SUMMARY.md`
- Master docs: `MASTER_DOCUMENTATION.md`
- Copilot instructions: `.github/copilot-instructions.md`

**Issues?** Check:
- Test script output: `npx tsx scripts/test-drill-mode.ts`
- Database content: `npm run db:studio`
- Cloudflare logs: Wrangler dashboard
- Sentry errors: Filter by `feature: drill_mode`

---

**Last Updated**: January 23, 2026  
**Phase**: 3 (Complete)  
**Next Phase**: 4 (Rolling 360 Analytics)
