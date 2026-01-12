# Intelligent DDx System Documentation

## Overview

The Intelligent DDx (Differential Diagnosis) System leverages the rich relational data in the PostgreSQL database to provide personalized, context-aware differential diagnosis features. This replaces the simple side-by-side comparison with a deeply integrated, database-linked system.

**Key Features:**
- 🎯 **Smart Suggestions** based on FSRS mastery data
- 🔴 **Confusion Pattern Detection** from user mistakes
- 📊 **Deep Matrix Comparison** (3-5 conditions)
- 🏥 **Diagnostic Workup Algorithms** from DifferentialDiagnosis table
- 🧪 **Linked Entity Comparison** (labs, imaging, drugs)

## Architecture

### API Endpoints

```
functions/api/ddx/
├── related.ts         # GET - Find related differentials for a condition
├── compare.ts         # GET - Deep comparison of 2-5 conditions  
├── confusion-pairs.ts # GET - User's personal confusion patterns (auth required)
├── workup.ts          # GET - Diagnostic workup algorithm (NEW)
└── smart-suggest.ts   # GET - AI-powered DDx suggestions (NEW)
```

### Service Layer

```typescript
// services/ddxService.ts
import { fetchRelatedConditions, fetchConditionComparison, fetchConfusionPairs } from '@/services/ddxService';
```

### Components

```
components/library/
├── DDxCompareModal.tsx      # Original basic modal
├── ConfusionPairAlert.tsx   # NEW: Personalized confusion warnings
└── index.ts                 # Exports all components
```

---

## Database Tables Leveraged

| Table | Purpose |
|-------|---------|
| `ConditionRelation` | Links conditions as differentials, complications, associated |
| `DifferentialDiagnosis` | Presenting complaints with must-not-miss lists |
| `DifferentialConditionLink` | Junction table for DDx → Condition with ranking |
| `ConfusionPair` | User-specific confusion tracking |
| `MedicalContent` | Core condition data (40+ fields) |
| `LabConditionLink` | Labs associated with conditions |
| `ImagingConditionLink` | Imaging studies for conditions |
| `FindingConditionLink` | Physical exam findings |
| `DrugConditionLink` | Medications for conditions |
| `ScoringSystemConditionLink` | Clinical scoring systems |

---

## API Reference

### 1. GET /api/ddx/related

**Purpose:** Get related differential diagnoses for a condition

**Query Parameters:**
- `conditionId` (string): Condition ID
- `conditionName` (string): Condition name (alternative to ID)
- `limit` (number): Max results (default: 10)

**Response:**
```json
{
  "condition": {
    "id": "uuid",
    "name": "Rheumatoid Arthritis",
    "system": "musculoskeletal"
  },
  "relatedConditions": [
    {
      "id": "uuid",
      "name": "Osteoarthritis",
      "system": "musculoskeletal",
      "relationshipType": "differential",
      "source": "direct_relation"
    }
  ],
  "differentialContext": {
    "presentingComplaint": "Joint Pain",
    "mustNotMiss": ["Septic Arthritis", "Malignancy"],
    "redFlags": ["Fever", "Single hot joint"],
    "keyExamFindings": ["Morning stiffness", "Symmetric involvement"]
  },
  "totalFound": 5
}
```

### 2. GET /api/ddx/compare

**Purpose:** Deep comparison of multiple conditions with linked entity data

**Query Parameters:**
- `ids` (string): Comma-separated condition IDs (2-5 required)

**Response:**
```json
{
  "conditions": [
    {
      "id": "uuid",
      "condition": "Rheumatoid Arthritis",
      "system": "musculoskeletal",
      "classic_patient": "Middle-aged woman with symmetric joint pain",
      "gold_standard_dx": "Anti-CCP antibodies",
      "first_line_rx": "Methotrexate",
      "linkedLabs": [
        { "name": "RF", "significance": "70% sensitivity", "isHighYield": true }
      ],
      "linkedImaging": [
        { "name": "Hand X-ray", "classicFindings": "Erosions, periarticular osteopenia" }
      ],
      "linkedDrugs": [
        { "genericName": "Methotrexate", "isFirstLine": true }
      ]
    }
  ],
  "discriminatingFeatures": ["classic_patient", "gold_standard_dx"],
  "uniqueEntities": [
    {
      "conditionId": "uuid",
      "uniqueLabs": [{ "name": "Anti-CCP" }],
      "uniqueImaging": []
    }
  ],
  "comparisonFields": [
    { "key": "classic_patient", "label": "Classic Patient", "category": "presentation" },
    { "key": "linkedLabs", "label": "Labs", "category": "diagnosis", "isLinkedEntity": true }
  ]
}
```

### 3. GET /api/ddx/confusion-pairs (Auth Required)

**Purpose:** Get user's personal confusion patterns

**Query Parameters:**
- `limit` (number): Max pairs (default: 10)
- `minCount` (number): Minimum confusion count (default: 2)
- `conditionId` (string): Filter by specific condition

**Response:**
```json
{
  "userId": "clerk_user_id",
  "confusionPairs": [
    {
      "id": "uuid",
      "realCondition": "Hyperthyroidism",
      "mistakenFor": "Anxiety Disorder",
      "count": 5,
      "severity": "high",
      "keyDifferences": {
        "goldStandardDx": {
          "real": "TSH, Free T4",
          "mistaken": "Clinical diagnosis (DSM-5)"
        },
        "classicPatient": {
          "real": "Young woman with weight loss, heat intolerance",
          "mistaken": "Patient with excessive worry, restlessness"
        }
      },
      "distinguishingFeatures": "Check TSH in anxious patients with weight loss"
    }
  ],
  "confusionScore": 15,
  "systemSummary": {
    "endocrine": { "count": 5, "pairs": [...] }
  },
  "recommendations": [
    "Focus on distinguishing Hyperthyroidism from Anxiety - you've confused these 5 times"
  ]
}
```

---

## Component Usage

### ConfusionPairAlert

Shows personalized warnings when viewing conditions the user frequently confuses.

```tsx
import { ConfusionPairAlert } from '@/components/library';

// In condition detail view
<ConfusionPairAlert
  conditionId={condition.id}
  conditionName={condition.condition}
  onCompare={(id1, id2) => openDDxCompare([id1, id2])}
/>

// Compact mode (for card previews)
<ConfusionPairAlert
  conditionId={condition.id}
  compact
/>
```

### DDxCompareModal (Enhanced)

```tsx
import { DDxCompareModal } from '@/components/library';

<DDxCompareModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  conditions={allConditions}
  initialCondition={selectedCondition}
  onStartDDxQuiz={(ids) => startQuiz(ids)}
/>
```

---

## Service Functions

```typescript
import ddxService from '@/services/ddxService';

// Get related conditions
const related = await ddxService.fetchRelatedConditions(conditionId);

// Compare conditions
const comparison = await ddxService.fetchConditionComparison(['id1', 'id2']);

// Get user's confusion pairs (requires auth token)
const token = await getToken();
const confusions = await ddxService.fetchConfusionPairs(token, {
  limit: 10,
  minCount: 2,
});

// Utility functions
const color = ddxService.getSeverityColor('high'); // 'text-red-500'
const bgColor = ddxService.getSeverityBgColor('medium'); // 'bg-amber-500/10 border-amber-500/30'
const isDiff = ddxService.valuesAreDifferent(val1, val2);
```

---

## Integration Points

### 1. Condition Detail Panel

Add confusion alert:
```tsx
// In ConditionDetailPanel.tsx
import { ConfusionPairAlert } from './ConfusionPairAlert';

<ConfusionPairAlert
  conditionId={condition.id}
  onCompare={handleOpenDDx}
/>
```

### 2. Library Cards

Add related DDx count:
```tsx
// Show "3 related differentials" on cards
const { relatedConditions } = await fetchRelatedConditions(conditionId);
```

### 3. Quiz Integration

Use confusion pairs for targeted practice:
```tsx
const { confusionPairs } = await fetchConfusionPairs(token);
// Generate quiz focusing on confused conditions
const quizConditions = confusionPairs.flatMap(p => [p.realCondition, p.mistakenFor]);
```

---

## Performance Considerations

1. **Caching:** Consider caching `fetchRelatedConditions` results client-side
2. **Batch Loading:** The compare endpoint handles up to 5 conditions efficiently
3. **Lazy Loading:** Confusion pairs are only fetched when component mounts
4. **Connection Pooling:** All endpoints use `prisma.$disconnect()` in finally blocks

---

## Advanced APIs

### 4. GET /api/ddx/workup

**Purpose:** Get diagnostic workup algorithm for a presenting complaint

**Query Parameters:**
- `complaint` (string): Presenting complaint (e.g., "chest pain")
- `conditionId` (string): Condition ID (alternative to complaint)

**Response:**
```json
{
  "complaint": "Chest Pain",
  "category": "cardiac",
  "isEmergency": true,
  "differentials": {
    "all": ["ACS", "PE", "Aortic Dissection", "Pneumothorax"],
    "mustNotMiss": ["STEMI", "PE", "Aortic Dissection"],
    "mostCommon": ["Costochondritis", "GERD"],
    "mostDangerous": ["STEMI", "Aortic Dissection"]
  },
  "workupAlgorithm": [
    {
      "order": 1,
      "action": "history",
      "name": "Focused History",
      "branches": [
        { "result": "Radiation to jaw/arm?" },
        { "result": "Tearing pain to back?" }
      ]
    },
    {
      "order": 2,
      "action": "test",
      "name": "Initial Labs",
      "branches": [
        { "result": "Troponin", "diagnosis": "ACS", "urgency": "emergent" },
        { "result": "D-dimer", "urgency": "emergent" }
      ],
      "cost": "medium"
    }
  ],
  "redFlags": ["Radiation to jaw", "Diaphoresis", "Hypotension"],
  "keyQuestions": ["Onset?", "Character?", "Radiation?"],
  "scoringSystems": [
    { "name": "HEART Score", "whenToUse": "Risk stratify chest pain" }
  ],
  "clinicalPearls": ["Always consider ACS in diabetics with atypical symptoms"]
}
```

### 5. GET /api/ddx/smart-suggest

**Purpose:** AI-powered DDx suggestions based on user's mastery and confusion patterns

**Query Parameters:**
- `conditionId` (string): Target condition
- `limit` (number): Max suggestions (default: 10)

**Authentication:** Optional but enriches suggestions

**Response:**
```json
{
  "targetCondition": {
    "id": "uuid",
    "name": "Hyperthyroidism",
    "system": "endocrine",
    "panceYield": 3
  },
  "suggestions": [
    {
      "conditionId": "uuid",
      "conditionName": "Anxiety Disorder",
      "system": "psychiatry",
      "reason": "You've confused Hyperthyroidism with this 5 times",
      "priority": "critical",
      "context": {
        "type": "confusion",
        "details": "5 confusion events recorded",
        "actionable": "Review distinguishing features side-by-side"
      },
      "panceYield": 2,
      "masteryLevel": "struggling"
    },
    {
      "conditionId": "uuid",
      "conditionName": "Graves Disease",
      "system": "endocrine",
      "reason": "Direct differential diagnosis relationship",
      "priority": "high",
      "context": {
        "type": "similar",
        "details": "Commonly confused on exams",
        "actionable": "Learn key distinguishing features"
      }
    },
    {
      "conditionId": "uuid",
      "conditionName": "Thyroid Storm",
      "system": "endocrine",
      "reason": "Complication of Hyperthyroidism",
      "priority": "medium",
      "context": {
        "type": "complication",
        "details": "Understanding complications improves clinical reasoning",
        "actionable": "Learn when this complication develops"
      }
    }
  ],
  "studyRecommendation": "PRIORITY: Focus on distinguishing Hyperthyroidism from Anxiety Disorder. You frequently confuse these conditions.",
  "summary": {
    "totalSuggestions": 10,
    "criticalCount": 1,
    "confusionBasedCount": 2,
    "masteryGapCount": 4
  },
  "isAuthenticated": true
}
```

---

## Advanced Components

### DDxMatrixView

Compare 3-5 conditions in a matrix format with category grouping.

```tsx
import { DDxMatrixView } from '@/components/library';

<DDxMatrixView
  initialConditionIds={['id1', 'id2', 'id3']}
  availableConditions={conditions}
  onClose={() => setShowMatrix(false)}
  onStartQuiz={(ids) => startDDxQuiz(ids)}
  maxConditions={5}
/>
```

**Features:**
- Collapsible category sections (Presentation, Diagnosis, Treatment)
- Difference highlighting with star indicators
- Linked entity toggle (Labs, Imaging, Drugs)
- Discriminating features banner
- Condition adder dropdown with search

### useDDxIntelligence Hook

Provides intelligent DDx data for any condition.

```tsx
import { useDDxIntelligence } from '@/components/library/hooks';

const {
  suggestions,
  workup,
  relatedConditions,
  isLoading,
  studyRecommendation,
  criticalSuggestions,
  confusionSuggestions,
  hasCriticalConfusions,
  refresh,
  getPriorityColor,
} = useDDxIntelligence(conditionId, {
  autoFetch: true,
  includeWorkup: true,
  limit: 10,
});

// Use in component
{hasCriticalConfusions && (
  <Alert variant="destructive">
    You frequently confuse this condition with others!
  </Alert>
)}

{suggestions.map(s => (
  <SuggestionCard 
    key={s.conditionId}
    className={getPriorityColor(s.priority)}
    {...s}
  />
))}
```

---

## Intelligence Algorithms

### Priority Scoring

Suggestions are prioritized based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Confusion count ≥5 | `critical` | User has confused conditions 5+ times |
| Confusion count ≥2 | `high` | Recent confusion patterns |
| Direct DDx relation | `high` | Database-linked differential |
| Shared buzzwords ≥3 | `high` | Similar presentations |
| Complication relation | `medium` | Clinically related |
| Same system + low mastery | `medium-low` | Knowledge gaps |

### Mastery Level Calculation

Based on FSRS card state:
```typescript
function getMasteryLevel(mastery) {
  if (mastery.state === 0) return 'new';
  if (mastery.stability >= 30) return 'mastered';
  if (mastery.stability >= 7) return 'proficient';
  if (mastery.stability >= 1) return 'learning';
  return 'struggling';
}
```

### Study Recommendation Generation

Priority order:
1. Critical confusion patterns → Direct comparison focus
2. Any confusion patterns → Create comparison table
3. High-yield differentials → Study together
4. Default → General review suggestion

---

## Future Enhancements

1. ✅ **AI-Powered Suggestions:** Now implemented via `/api/ddx/smart-suggest`
2. ✅ **Diagnostic Algorithms:** Workup endpoint provides structured algorithms
3. ✅ **Multi-Condition Matrix:** `DDxMatrixView` supports 3-5 conditions
4. ✅ **FSRS Integration:** Mastery data influences suggestion priority
5. 🔜 **Visual Decision Trees:** Render `workupAlgorithm` as interactive flowcharts
6. 🔜 **AI Mnemonics:** Use Gemini to generate distinguishing mnemonics
7. 🔜 **Confusion Quiz Mode:** Auto-generate quizzes from confusion pairs
