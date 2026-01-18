# Quick Start: Using the Database-Driven Drill Setup

## TL;DR

Replace static `conditionRegistry` imports with live database queries using the new `DrillSetup` component and `conditionRegistryService`.

## 5-Minute Integration

### Step 1: Import DrillSetup

```typescript
import { DrillSetup, type DrillConfiguration } from '@/components/drill/DrillSetup';
```

### Step 2: Add Setup Phase

```typescript
const [phase, setPhase] = useState<'setup' | 'active'>('setup');

if (phase === 'setup') {
  return (
    <DrillSetup
      title="My Drill"
      description="Test your knowledge"
      onStart={(config) => {
        // config.availableConditions = filtered condition list
        // config.system = selected system (or undefined)
        // config.difficulty = 'easier' | 'same' | 'harder'
        // config.questionCount = number
        setPhase('active');
      }}
      onBack={onExit}
    />
  );
}
```

### Step 3: Use Filtered Conditions

```typescript
// Pick random condition from filtered pool
const randomCondition =
  config.availableConditions[Math.floor(Math.random() * config.availableConditions.length)];

// Generate question
const question = await fetchNewQuestion({
  conditionName: randomCondition.name,
  difficulty: config.difficulty,
  focus: 'all',
});
```

## Complete Example

```typescript
import React, { useState } from 'react';
import { DrillSetup, type DrillConfiguration } from '@/components/drill/DrillSetup';
import { fetchNewQuestion } from '@/services/geminiService';
import type { Question } from '@/types';

interface MyDrillProps {
  onExit: () => void;
}

export function MyDrill({ onExit }: MyDrillProps) {
  const [phase, setPhase] = useState<'setup' | 'active' | 'complete'>('setup');
  const [config, setConfig] = useState<DrillConfiguration | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);

  const handleStart = async (drillConfig: DrillConfiguration) => {
    setConfig(drillConfig);
    setPhase('active');

    // Generate questions from filtered conditions
    const generatedQuestions: Question[] = [];
    for (let i = 0; i < drillConfig.questionCount; i++) {
      const randomCondition = drillConfig.availableConditions[
        Math.floor(Math.random() * drillConfig.availableConditions.length)
      ];

      const question = await fetchNewQuestion({
        conditionName: randomCondition.name,
        difficulty: drillConfig.difficulty,
        focus: 'all'
      }, []);

      generatedQuestions.push(question);
    }

    setQuestions(generatedQuestions);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) setScore(score + 1);

    if (currentIndex + 1 >= questions.length) {
      setPhase('complete');
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Setup phase
  if (phase === 'setup') {
    return (
      <DrillSetup
        title="My Drill Mode"
        description="Test your diagnostic skills"
        defaultDifficulty="same"
        showSystemFilter={true}
        showQuestionCount={true}
        defaultQuestionCount={10}
        onStart={handleStart}
        onBack={onExit}
      />
    );
  }

  // Active phase
  if (phase === 'active') {
    const currentQuestion = questions[currentIndex];
    return (
      <div className="p-4">
        <h2>Question {currentIndex + 1} of {questions.length}</h2>
        <p>{currentQuestion?.question}</p>
        {/* Render options and handle answer... */}
        <button onClick={() => handleAnswer(true)}>Correct</button>
        <button onClick={() => handleAnswer(false)}>Incorrect</button>
      </div>
    );
  }

  // Complete phase
  if (phase === 'complete') {
    return (
      <div className="p-4">
        <h2>Drill Complete!</h2>
        <p>Score: {score} / {questions.length}</p>
        <button onClick={() => setPhase('setup')}>Restart</button>
        <button onClick={onExit}>Exit</button>
      </div>
    );
  }

  return null;
}
```

## Service API Cheat Sheet

### Import

```typescript
import {
  fetchConditions,
  getAvailableSystems,
  getConditionsBySystem,
  getRandomConditionForSystem,
  findConditionByName,
  getRegistryStats,
} from '@/services/conditionRegistryService';
```

### Common Operations

#### Get all conditions (cached)

```typescript
const conditions = await fetchConditions();
// Returns: ConditionMetadata[]
```

#### Get systems

```typescript
const systems = await getAvailableSystems();
// Returns: ['CV', 'PULM', 'GI', ...]
```

#### Filter by system

```typescript
const cvConditions = await getConditionsBySystem('CV');
// Returns: ConditionMetadata[] (only CV conditions)
```

#### Random selection

```typescript
const randomCondition = await getRandomConditionForSystem('PULM');
// Returns: ConditionMetadata | null
```

#### Search by name

```typescript
const condition = await findConditionByName('Myocardial Infarction');
// Returns: ConditionMetadata | null
```

#### Statistics

```typescript
const stats = await getRegistryStats();
// Returns: {
//   totalConditions: 1094,
//   systemCounts: { CV: 85, PULM: 72, ... },
//   subcategoryCounts: { 'Arrhythmias': 12, ... }
// }
```

## Type Reference

```typescript
interface ConditionMetadata {
  id: string; // "CV__arrhythmia__atrial_fibrillation"
  name: string; // "Atrial Fibrillation"
  system: SystemCode; // "CV"
  subcategory: string; // "Arrhythmias"
}

interface DrillConfiguration {
  system?: SystemCode; // Selected system filter
  difficulty: 'easier' | 'same' | 'harder';
  questionCount: number; // Number of questions
  availableConditions: ConditionMetadata[]; // Filtered pool
}

type SystemCode =
  | 'CV'
  | 'DERM'
  | 'ENDO'
  | 'GI'
  | 'GU'
  | 'HEME'
  | 'HEENT'
  | 'ID'
  | 'MSK'
  | 'NEURO'
  | 'PRO'
  | 'PSYCH'
  | 'PULM'
  | 'RENAL'
  | 'REPRO'
  | 'OTHER';
```

## Common Patterns

### Pattern 1: Pick N Random Conditions

```typescript
function pickRandomConditions(conditions: ConditionMetadata[], count: number): ConditionMetadata[] {
  const shuffled = [...conditions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Usage:
const randomConditions = pickRandomConditions(config.availableConditions, 10);
```

### Pattern 2: Generate Question for Condition

```typescript
async function generateQuestionForCondition(
  condition: ConditionMetadata,
  difficulty: 'easier' | 'same' | 'harder'
): Promise<Question> {
  return await fetchNewQuestion(
    {
      conditionName: condition.name,
      difficulty,
      focus: 'all',
    },
    []
  );
}
```

### Pattern 3: Prefetch on App Init

```typescript
// In App.tsx
import { prefetchConditions } from '@/services/conditionRegistryService';

useEffect(() => {
  prefetchConditions(); // Warm cache early
}, []);
```

### Pattern 4: Force Refresh Cache

```typescript
import { fetchConditions, clearConditionsCache } from '@/services/conditionRegistryService';

async function refreshRegistry() {
  clearConditionsCache();
  const conditions = await fetchConditions();
  console.log('Registry refreshed:', conditions.length);
}
```

## Props Reference

### DrillSetup Component

| Prop                   | Type                                   | Default      | Description            |
| ---------------------- | -------------------------------------- | ------------ | ---------------------- |
| `title`                | `string`                               | **required** | Drill mode title       |
| `description`          | `string`                               | **required** | Brief description      |
| `defaultDifficulty`    | `'easier' \| 'same' \| 'harder'`       | `'same'`     | Initial difficulty     |
| `showSystemFilter`     | `boolean`                              | `true`       | Show system dropdown   |
| `showQuestionCount`    | `boolean`                              | `true`       | Show question selector |
| `defaultQuestionCount` | `number`                               | `10`         | Initial question count |
| `onStart`              | `(config: DrillConfiguration) => void` | **required** | Start callback         |
| `onBack`               | `() => void`                           | `undefined`  | Back button callback   |
| `systemFilter`         | `SystemCode[]`                         | `undefined`  | Pre-filter systems     |

## Testing

### Unit Test Example

```typescript
import { fetchConditions, getRandomConditionForSystem } from './conditionRegistryService';

describe('conditionRegistryService', () => {
  it('fetches conditions from database', async () => {
    const conditions = await fetchConditions();

    expect(conditions).toBeDefined();
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions[0]).toHaveProperty('id');
    expect(conditions[0]).toHaveProperty('name');
    expect(conditions[0]).toHaveProperty('system');
  });

  it('returns random condition for system', async () => {
    const condition = await getRandomConditionForSystem('CV');

    expect(condition).toBeDefined();
    expect(condition?.system).toBe('CV');
  });
});
```

### Integration Test

```bash
# Start dev server
npm run dev:all

# Test API endpoint
curl -H "Authorization: Bearer $CLERK_TOKEN" \
  http://localhost:3001/api/conditions \
  | jq '.[0]'

# Expected output:
# {
#   "id": "CV__arrhythmia__atrial_fibrillation",
#   "name": "Atrial Fibrillation",
#   "system": "CV",
#   "subcategory": "Arrhythmias"
# }
```

## Troubleshooting

### Error: "Failed to load conditions"

```typescript
// Check database connection
console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Run migrations
npm run db:migrate:deploy

// Sync conditions
npm run sync:all
```

### Warning: "Using stale cache"

```typescript
// Clear cache
import { clearConditionsCache } from '@/services/conditionRegistryService';
clearConditionsCache();

// Or force refresh
const conditions = await fetchConditions(true);
```

### Performance: Slow initial load

```typescript
// Add prefetch to App.tsx initialization
import { prefetchConditions } from '@/services/conditionRegistryService';

useEffect(() => {
  prefetchConditions(); // ⚡ Loads cache in background
}, []);
```

## Migration Checklist

- [ ] Import `DrillSetup` component
- [ ] Add 'setup' phase to drill flow
- [ ] Use `config.availableConditions` for question generation
- [ ] Remove static `conditionRegistry` imports
- [ ] Test system filtering works
- [ ] Test difficulty selector works
- [ ] Test question count selector works
- [ ] Verify cache is working (check network tab)
- [ ] Add error handling for API failures

## Resources

- **Full Guide**: `DRILL_SETUP_REFACTOR_GUIDE.md`
- **Implementation Summary**: `DRILL_SETUP_REFACTOR_SUMMARY.md`
- **Example Code**: `components/drill/ConditionDrillSession-Example.tsx`
- **Service Code**: `services/conditionRegistryService.ts`
- **Component Code**: `components/drill/DrillSetup.tsx`

## Support

Questions? Check:

1. The comprehensive guide (`DRILL_SETUP_REFACTOR_GUIDE.md`)
2. Example implementation (`ConditionDrillSession-Example.tsx`)
3. Existing usage in `ClinicalLibrary.tsx`

---

**Quick Reference**:

- Import: `@/components/drill/DrillSetup`
- Service: `@/services/conditionRegistryService`
- API: `GET /api/conditions` (Clerk auth required)
- Cache: 5-minute TTL, auto-refresh
