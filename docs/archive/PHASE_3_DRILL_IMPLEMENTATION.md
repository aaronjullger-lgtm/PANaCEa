# Phase 3: Drill & Kill Gamification Engine - Implementation Guide

## Overview

Phase 3 implements high-intensity active recall drill modes that leverage PANaCEa's content library while maintaining strict statistical isolation from FSRS v6 optimization.

**Status**: ✅ Core implementation complete  
**Date**: January 23, 2026  
**Next Phase**: Rolling 360 Analytics Engine

---

## 🎯 Core Principles

### Statistical Isolation (CRITICAL)

All drill modes must adhere to the "Main Session Quarantine" rule:

```typescript
// ✅ CORRECT: Drill attempts
await logDrillAttempt({
  userId,
  drillType: 'photo_drill',
  // ... other fields
});
// Automatically sets isMainSession = false

// ❌ WRONG: Never set isMainSession = true for drills
```

**Why This Matters:**
- FSRS v6 weights are optimized based on spaced repetition performance
- "Rapid fire" drills are NOT representative of long-term memory retrieval
- Mixing drill stats with exam stats would corrupt the FSRS algorithm

---

## 📁 Implementation Structure

### Services (`/services/drill/`)

#### 1. `photoDrill.service.ts`
**Purpose**: Photo recognition for Dermatology and Radiology

**Key Functions:**
```typescript
getPhotoDrillBatch(options): Promise<PhotoDrillQuestion[]>
// Fetches images from MediaAsset table with:
// - Lazy loading (blurHash → thumbnail → full image)
// - System-specific filtering
// - Automatic distractor generation

getPhotoDrillStats(userId): Promise<DrillStats>
// Returns isolated statistics (excludes from main stats)
```

**Database Pattern:**
```sql
SELECT * FROM MediaAsset
WHERE type = 'image'
  AND usageType = 'quiz'
  AND isAnnotated = false
  AND modality IN ('dermatology', 'radiology')
```

#### 2. `contrastiveDrill.service.ts`
**Purpose**: DDx Compare mode for similar conditions

**Key Functions:**
```typescript
getContrastiveDrillBatch(options): Promise<ContrastiveQuestion[]>
// Queries ContrastiveSet table
// Can target user's personal confusion pairs

logContrastiveDrillAttempt(userId, setId, assignments, isCorrect, timeMs)
// Logs to ContrastiveDrillAttempt table
```

**Personalization Logic:**
```typescript
// Uses ConfusionPair table to target weak areas
const confusionPairs = await prisma.confusionPair.findMany({
  where: {
    userId,
    occurrences: { gte: 2 },
  },
  orderBy: { occurrences: 'desc' },
});
```

#### 3. `drillSessionManager.ts`
**Purpose**: Session management and statistical isolation enforcement

**Critical Functions:**
```typescript
logDrillAttempt(data)
// ENFORCES isMainSession = false
// Creates QuestionAttempt record

verifyStatisticalIsolation(userId)
// Audits data to ensure no FSRS contamination
```

---

### Components (`/components/drill/`)

#### 1. `PhotoDrillCard.tsx`
**Features:**
- Lazy image loading (blurHash → thumbnail → full)
- Instant visual feedback (green/red overlay)
- Shuffled answer options
- Response time tracking

**Props:**
```typescript
interface PhotoDrillCardProps {
  question: PhotoDrillQuestion;
  onAnswer: (isCorrect: boolean, timeMs: number) => void;
  showFeedback?: boolean;
}
```

#### 2. `ContrastiveCard.tsx`
**Features:**
- Drag-and-drop interface (@dnd-kit)
- Three-zone layout:
  1. Unassigned features pool
  2. Condition 1 drop zone
  3. Condition 2 drop zone
- Real-time validation
- Partial credit scoring

**User Flow:**
1. Read presenting symptom
2. Drag distinguishing features to conditions
3. Submit when all features assigned
4. See correct/incorrect highlights

---

### Testing (`/scripts/`)

#### `test-drill-mode.ts`
**Purpose**: Verify statistical isolation

**Tests:**
1. ✅ Drill attempts use `isMainSession = false`
2. ✅ `UserRolling360Stats` is NOT affected by drills
3. ✅ `ReviewLog` uses `sessionType = CRAM` for drills
4. ✅ Comprehensive isolation verification

**Run:**
```bash
npx tsx scripts/test-drill-mode.ts
```

**Expected Output:**
```
🎉 All tests passed! Statistical isolation is verified.
✅ Drill modes are safe to use in production.
```

---

## 🔧 API Integration

### Cloudflare Functions Pattern

```typescript
// functions/api/drill/photo-batch.ts
export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Authenticate
  const userId = await authenticateRequest(context);
  
  // Parse query params
  const url = new URL(request.url);
  const system = url.searchParams.get('system');
  const difficulty = url.searchParams.get('difficulty');
  
  // Get drill batch
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  try {
    const questions = await getPhotoDrillBatch({
      system: system || undefined,
      difficulty: difficulty as any,
      count: 10,
    });
    
    return new Response(JSON.stringify(questions), {
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
}
```

---

## 📊 Database Schema Usage

### Tables Utilized

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `MediaAsset` | Photo drill images | `modality`, `usageType`, `blurHash` |
| `ContrastiveSet` | DDx comparisons | `distinguishers`, `isHighYield` |
| `ConfusionPair` | User weakness targeting | `occurrences`, `lastConfusedAt` |
| `QuestionAttempt` | Drill logging | `isMainSession = false` |
| `ReviewLog` | Session tracking | `sessionType = CRAM` |
| `ContrastiveDrillAttempt` | DDx attempts | `userAssignments`, `wasCorrect` |

### Data Flow

```
User Starts Drill
      ↓
Create StudySession (sessionType = CRAM)
      ↓
Fetch Questions (MediaAsset / ContrastiveSet)
      ↓
User Answers
      ↓
Log to QuestionAttempt (isMainSession = false)
      ↓
Complete StudySession
      ↓
Update Drill Stats (isolated from FSRS)
```

---

## 🎮 User Experience Flow

### Photo Drill
1. Select system (Cardiology, Dermatology, etc.)
2. Start rapid-fire session (10-20 images)
3. See blurred preview → full image loads
4. Select diagnosis from 4 options
5. Instant feedback (green/red overlay)
6. Auto-advance to next question
7. Session summary (accuracy, avg time)

### DDx Compare
1. See presenting symptom
2. Drag features to matching condition
3. Submit when all assigned
4. See green (correct) / red (incorrect) highlights
5. Review correct assignments
6. Next comparison

---

## 🔍 Performance Optimization

### Image Loading Strategy

```typescript
// 1. Show blurHash immediately (< 1kb)
<div style={{ backgroundImage: `url(${blurHash})` }} />

// 2. Load thumbnail (< 50kb)
<img src={thumbnailUrl} className="blur-sm" />

// 3. Load full image (lazy)
<img 
  src={originalUrl} 
  onLoad={() => setLoaded(true)}
  loading="lazy"
/>
```

### Caching Strategy

```typescript
// PWA Service Worker (vite-plugin-pwa)
{
  urlPattern: /\/api\/drill\/.*/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'drill-api',
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 60 * 60, // 1 hour
    },
  },
}
```

---

## 🚀 Deployment Checklist

### Before Production

- [ ] Run `npx tsx scripts/test-drill-mode.ts` (all tests pass)
- [ ] Verify Cloudflare Functions deploy correctly
- [ ] Test on staging with real user accounts
- [ ] Confirm `isMainSession = false` for all drill attempts
- [ ] Check `UserRolling360Stats` does NOT include drill data
- [ ] Validate image loading performance (< 2s for full image)
- [ ] Test drag-and-drop on mobile devices

### Monitoring

```typescript
// Add to error tracking (Sentry)
Sentry.captureException(error, {
  tags: {
    feature: 'drill_mode',
    drillType: 'photo_drill',
  },
});
```

---

## 📈 Future Enhancements

### Phase 3.5: Additional Drill Modes

1. **Daily Wordle**
   - Schema: `DailyWordle`, `Buzzword`
   - Database-first (no static word lists)
   
2. **Audio Drill** (Heart sounds, Lung sounds)
   - Use `MediaAsset.type = 'audio'`
   
3. **ECG Pattern Recognition**
   - Use `ECGPattern` and `ECGConditionLink`

### Phase 4: Rolling 360 Analytics

Next phase will implement:
- Circular buffer for "Current Form" tracking
- `UserRolling360Stats` visualization
- `blueprintAdherence` metric
- System-level weakness detection

---

## 🛡️ Architectural Enforcement

### Hooks (from `.clinerules`)

✅ **"Strict Database-First" Firewall**
- All images from `MediaAsset` table
- All questions from `ContrastiveSet` table
- No static JSON files

✅ **"Main Session" Quarantine**
- `isMainSession = false` for all drills
- `sessionType = CRAM` in ReviewLog
- Verified by automated tests

✅ **"Latency Masking" Auditor**
- Lazy image loading
- BlurHash preview
- Progressive enhancement

---

## 📚 References

- **Schema**: `prisma/schema.prisma`
- **FSRS v6 Docs**: `docs/FSRS_V6_SCHEMA_IMPROVEMENTS.md`
- **Workflow**: `.cline/prompts/clinical-ingestion-pipeline.md`
- **Hooks**: `.clinerules`

---

## ✅ Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Photo Drill Service | ✅ Complete | `services/drill/photoDrill.service.ts` |
| Contrastive Drill Service | ✅ Complete | `services/drill/contrastiveDrill.service.ts` |
| Session Manager | ✅ Complete | `services/drill/drillSessionManager.ts` |
| Photo Drill UI | ✅ Complete | `components/drill/PhotoDrillCard.tsx` |
| Contrastive UI | ✅ Complete | `components/drill/ContrastiveCard.tsx` |
| Test Script | ✅ Complete | `scripts/test-drill-mode.ts` |
| Cloudflare Functions | ⏳ TODO | `functions/api/drill/*` |
| Drill Hub Page | ⏳ TODO | `pages/DrillHub.tsx` |
| Daily Wordle | ⏳ TODO | Phase 3.5 |
| Rolling 360 Analytics | ⏳ TODO | Phase 4 |

---

**Last Updated**: January 23, 2026  
**Implemented By**: GitHub Copilot (Senior Clinical & Technical Architect)  
**Next Action**: Create Cloudflare Functions endpoints and Drill Hub page