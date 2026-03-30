# Integration Guide: Scoring Systems + Quick Reference Cards

These changes wire the new DynamicScoringCalculator, ScoringSystemBrowser,
and QuickRefHub into the existing ToolkitHub.

## Step 1: Update ToolkitHub.tsx

### 1a. Add imports (after line 32)

```tsx
import { ScoringSystemBrowser } from './calculators/scoring';
import { QuickRefHub } from './quickref';
import { ClipboardList, BookMarked } from 'lucide-react';
```

### 1b. Update TabId type (line 43)

```tsx
// BEFORE:
type TabId = 'calculators' | 'generators' | 'interpreters' | 'imaging';

// AFTER:
type TabId = 'calculators' | 'scoring' | 'quickref' | 'generators' | 'interpreters' | 'imaging';
```

### 1c. Update NAV_TABS (after line 60)

```tsx
const NAV_TABS: NavTab[] = [
  { id: 'calculators', label: 'Calculators', icon: CalculatorIcon },
  { id: 'scoring', label: 'Scoring Systems', icon: ClipboardList },
  { id: 'quickref', label: 'Quick Reference', icon: BookMarked },
  { id: 'generators', label: 'Generators', icon: Lightbulb },
  { id: 'interpreters', label: 'Interpretation Assistants', icon: Activity },
];
```

### 1d. Update VALID_UTILITY_TAB_IDS (line 271)

```tsx
const VALID_UTILITY_TAB_IDS: TabId[] = [
  'calculators', 'scoring', 'quickref', 'generators', 'interpreters'
];
```

### 1e. Update tabMeta (after line 378)

Add these entries to the `tabMeta` object:

```tsx
scoring: {
  title: 'Scoring Systems',
  description: '56 clinical scoring tools — PERC, GCS, Wells, Ottawa, HEART, and more',
},
quickref: {
  title: 'Quick Reference',
  description: 'Pocket-card references: antibiotics, ACLS, lab values, vital signs',
},
```

### 1f. Add tab content rendering

Add these blocks alongside the existing `{activeTab === 'interpreters' && ...}` block
(around line 675):

```tsx
{/* SCORING SYSTEMS TAB */}
{activeTab === 'scoring' && (
  <motion.div
    key="scoring"
    initial={{ y: 20 }}
    animate={{ y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
    <ScoringSystemBrowser />
  </motion.div>
)}

{/* QUICK REFERENCE TAB */}
{activeTab === 'quickref' && (
  <motion.div
    key="quickref"
    initial={{ y: 20 }}
    animate={{ y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
    <QuickRefHub />
  </motion.div>
)}
```

## Step 2: Verify Prisma model names

Check your `prisma/schema.prisma` to confirm these model names match:
- `ScoringSystem` (with `ScoringSystemConditionLink` relation)
- `AntibioticGuideline` 
- `ACLSAlgorithm`

The API endpoints use Prisma's auto-generated client names:
- `prisma.scoringSystem.findMany()`
- `prisma.antibioticGuideline.findMany()`
- `prisma.aCLSAlgorithm.findMany()`

If your Prisma model uses different casing, update the API files accordingly.

## Step 3: Test

1. Run `npm run dev` 
2. Navigate to the Toolkit
3. You should see 5 tabs: Calculators, Scoring Systems, Quick Reference, Generators, Interpreters
4. Click "Scoring Systems" — browse all 56 systems, search, filter by category
5. Click any scoring system — interactive calculator renders from DB data
6. Click "Quick Reference" — browse antibiotic guides, ACLS algorithms, normal labs, vitals
