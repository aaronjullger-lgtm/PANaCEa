# Drill Setup Refactor Guide

## Overview

The drill setup system has been refactored to use a **live database-driven registry** instead of static file imports. This ensures drill modes always work with the most up-to-date condition data from PostgreSQL.

## What Changed

### Before (Static Registry)
```typescript
import { conditionRegistry, getRandomConditionForSystem } from '../conditionRegistry';

// Static array - could be stale
const conditions = Object.values(conditionRegistry);

// Static function - only works with imported data
const randomCondition = getRandomConditionForSystem('CV');
```

### After (Database-Driven)
```typescript
import { fetchConditions, getRandomConditionForSystem } from '../services/conditionRegistryService';

// Live database query - always fresh
const conditions = await fetchConditions();

// Database query - works with latest data
const randomCondition = await getRandomConditionForSystem('CV');
```

## New Components & Services

### 1. DrillSetup Component
**File**: `components/drill/DrillSetup.tsx`

Universal drill configuration component with:
- System filter dropdown (dynamically populated from database)
- Difficulty selector (easier/same/harder)
- Question count selector (5/10/15/20)
- Live condition count display
- Loading and error states

**Usage Example**:
```typescript
import { DrillSetup, type DrillConfiguration } from './components/drill/DrillSetup';

function MyDrillMode() {
  const handleStart = (config: DrillConfiguration) => {
    // config.system - Selected system (or undefined for all)
    // config.difficulty - 'easier' | 'same' | 'harder'
    // config.questionCount - Number of questions
    // config.availableConditions - Full list of conditions for selected system
    
    console.log(`Starting drill with ${config.availableConditions.length} conditions`);
    
    // Use config to generate questions...
  };

  return (
    <DrillSetup
      title="My Drill Mode"
      description="Test your knowledge"
      defaultDifficulty="same"
      showSystemFilter={true}
      showQuestionCount={true}
      defaultQuestionCount={10}
      onStart={handleStart}
      onBack={handleExit}
    />
  );
}
```

### 2. Condition Registry Service
**File**: `services/conditionRegistryService.ts`

Database access layer with caching (5-minute TTL):

```typescript
import {
  fetchConditions,
  getAvailableSystems,
  getConditionsBySystem,
  getRandomConditionForSystem,
  getRandomCondition,
  findConditionByName,
  findConditionById,
  getRegistryStats,
  clearConditionsCache,
  prefetchConditions,
} from '../services/conditionRegistryService';

// Fetch all conditions (cached)
const conditions = await fetchConditions();

// Get unique systems
const systems = await getAvailableSystems(); // ['CV', 'PULM', 'GI', ...]

// Filter by system
const cvConditions = await getConditionsBySystem('CV');

// Random selection (for quiz generation)
const randomCondition = await getRandomConditionForSystem('PULM');

// Search
const condition = await findConditionByName('Myocardial Infarction');

// Stats
const stats = await getRegistryStats();
// {
//   totalConditions: 1094,
//   systemCounts: { CV: 85, PULM: 72, ... },
//   subcategoryCounts: { 'Arrhythmias': 12, ... }
// }
```

### 3. Backend API Endpoint
**File**: `server.ts` (lines 310-332)

```typescript
GET /api/conditions
```

**Response**:
```json
[
  {
    "id": "CV__arrhythmia__atrial_fibrillation",
    "name": "Atrial Fibrillation",
    "system": "CV",
    "subcategory": "Arrhythmias"
  },
  ...
]
```

**Features**:
- ✅ Clerk authentication required
- ✅ Only returns `published` conditions
- ✅ Sorted alphabetically by name
- ✅ Minimal payload (4 fields only)

## Migration Guide

### For Drill Components

**Step 1**: Replace static imports
```typescript
// ❌ Remove
import { conditionRegistry } from '../conditionRegistry';

// ✅ Add
import { fetchConditions } from '../services/conditionRegistryService';
```

**Step 2**: Update system dropdown logic
```typescript
// ❌ Old (static)
const systems = Object.keys(SYSTEM_NAMES);

// ✅ New (database-driven)
const [systems, setSystems] = useState<SystemCode[]>([]);

useEffect(() => {
  async function loadSystems() {
    const conditions = await fetchConditions();
    const uniqueSystems = new Set(conditions.map(c => c.system));
    setSystems(Array.from(uniqueSystems));
  }
  loadSystems();
}, []);
```

**Step 3**: Update question generation
```typescript
// ❌ Old (static)
const randomCondition = getRandomConditionForSystem('CV');

// ✅ New (database-driven)
const randomCondition = await getRandomConditionForSystem('CV');

// Use randomCondition.name to fetch from geminiService
const question = await fetchNewQuestion({
  conditionName: randomCondition.name,
  difficulty: 'same',
  focus: 'all'
});
```

### For Services (geminiService.ts)

**Updated** (already done in refactor):
```typescript
// Before:
import { getRandomConditionForSystem } from "../conditionRegistry";
const condition = getRandomConditionForSystem(system);

// After:
import { getRandomConditionForSystem as getRandomConditionForSystemDB } from "./conditionRegistryService";
const dbCondition = await getRandomConditionForSystemDB(system);
const compatMeta = findConditionMeta(dbCondition.name);
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Start Drill" in DrillSetup component              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ DrillSetup fetches GET /api/conditions on mount                 │
│ - Builds system dropdown from unique systems                    │
│ - Shows condition count per system                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ User selects system (e.g., "PULM") and difficulty              │
│ - DrillSetup filters conditions: 72 PULM conditions available  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Start Drill" → onStart(config)                    │
│ config = {                                                      │
│   system: 'PULM',                                               │
│   difficulty: 'same',                                           │
│   questionCount: 10,                                            │
│   availableConditions: [...72 PULM conditions]                 │
│ }                                                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Drill mode picks random condition from availableConditions[]   │
│ → Calls geminiService.fetchNewQuestion()                       │
│ → Gemini generates question for that condition                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Question displayed to user                                      │
│ Repeat for remaining questions (up to questionCount)           │
└─────────────────────────────────────────────────────────────────┘
```

## Caching Strategy

The `conditionRegistryService` implements a **5-minute cache** to minimize database queries:

```typescript
let conditionsCache: ConditionMetadata[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// First call → Database query
await fetchConditions(); // ⏱ ~200ms (database)

// Subsequent calls within 5 minutes → Cache
await fetchConditions(); // ⚡ ~0ms (memory)

// After 5 minutes → Refresh from database
await fetchConditions(); // ⏱ ~200ms (database, updates cache)

// Force refresh
await fetchConditions(true); // ⏱ ~200ms (bypass cache)
```

**Cache invalidation**:
```typescript
// Manual clear (e.g., after content update)
clearConditionsCache();

// Auto-refresh on next fetch
await fetchConditions();
```

## Performance Considerations

### Initial Load
- **Database query**: ~200ms (Supabase connection pooling)
- **Cache hit**: ~0ms (in-memory)
- **Frontend parse**: ~10ms (1000+ conditions)

### Optimization Tips

1. **Prefetch on app init** (in App.tsx):
```typescript
useEffect(() => {
  prefetchConditions(); // Load cache early
}, []);
```

2. **Lazy load drill modes**:
```typescript
const DrillMode = lazy(() => import('./components/drill/MyDrill'));
```

3. **Use system filter** to reduce condition pool:
```typescript
// ❌ Slow: Loop through all 1094 conditions
const allConditions = await fetchConditions();

// ✅ Fast: Only get 72 PULM conditions
const pulmConditions = await getConditionsBySystem('PULM');
```

## Testing

### Unit Tests
```typescript
import { fetchConditions, getRandomConditionForSystem } from './conditionRegistryService';

describe('conditionRegistryService', () => {
  it('should fetch conditions from API', async () => {
    const conditions = await fetchConditions();
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions[0]).toHaveProperty('id');
    expect(conditions[0]).toHaveProperty('name');
    expect(conditions[0]).toHaveProperty('system');
  });

  it('should return random condition for system', async () => {
    const condition = await getRandomConditionForSystem('CV');
    expect(condition).toBeDefined();
    expect(condition?.system).toBe('CV');
  });
});
```

### Integration Tests
```bash
# Start server
npm run dev:all

# Test API endpoint
curl -H "Authorization: Bearer $CLERK_TOKEN" \
  http://localhost:3001/api/conditions

# Should return JSON array of conditions
```

## Rollback Plan

If issues arise, temporarily restore static imports:

```typescript
// In geminiService.ts
import { getRandomConditionForSystem } from "../conditionRegistry"; // Static fallback

// Wrap database calls in try/catch with fallback
try {
  const dbCondition = await getRandomConditionForSystemDB(systemCode);
  // Use dbCondition...
} catch (error) {
  console.error('Database registry failed, using static fallback:', error);
  const staticCondition = getRandomConditionForSystem(systemCode); // Fallback
  // Use staticCondition...
}
```

## Future Enhancements

1. **Real-time updates**: WebSocket connection to PostgreSQL for live condition updates
2. **Advanced filtering**: Filter by subcategory, difficulty rating, PANCE yield
3. **Personalized pools**: Exclude mastered conditions, prioritize weak areas
4. **Analytics**: Track most-selected systems, popular conditions
5. **Content versioning**: Track which DB version generated each question

## Troubleshooting

### "Failed to load conditions"
- Check `DATABASE_URL` is set in environment
- Verify Supabase connection string is valid
- Run `npm run db:migrate:deploy` to apply migrations

### "No conditions available for system"
- Ensure conditions are synced: `npm run sync:all`
- Check Condition table has `status: 'published'` records
- Verify system codes match: `CV`, `PULM`, etc. (not `Cardiovascular`)

### Stale data in UI
- Clear cache: `clearConditionsCache()` in browser console
- Refresh page to re-fetch from database
- Check cache duration (5 minutes) hasn't been exceeded

### Performance issues
- Enable query logging in Prisma
- Check Supabase connection pooling mode (use "Transaction")
- Verify database indexes on `system` and `status` columns

## Summary

The refactored drill setup system provides:
- ✅ **Live data**: Always reflects current database state
- ✅ **Type safety**: Full TypeScript support
- ✅ **Performance**: 5-minute cache, minimal payloads
- ✅ **Scalability**: Handles 1000+ conditions efficiently
- ✅ **Maintainability**: Single source of truth (PostgreSQL)
- ✅ **Developer experience**: Clean API, reusable components

All drill modes should migrate to this pattern for consistency and reliability.
