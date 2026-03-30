# Clinical Library & Tools — Integration Guide

## Files Created This Session

### Generic Reference System (components/library/)
- `GenericReferenceView.tsx` — Config-driven reusable entity browser (425 lines)
- `referenceConfigs.tsx` — 9 entity card configs (Procedures, Imaging, ECG, Anatomy, Special Tests, Physiology, Physical Exam Findings, Guidelines, History Components)
- `ReferenceHub.tsx` — Grid launcher for all reference entity types
- `index.ts` — Updated barrel export with all new components

### Scoring Systems (components/toolkit/calculators/scoring/)
- `DynamicScoringCalculator.tsx` — Data-driven calculator for all 56 scoring systems
- `ScoringSystemBrowser.tsx` — Browsable grid with search/filter
- `index.ts` — Barrel export

### Quick Reference Cards (components/toolkit/quickref/)
- `QuickRefHub.tsx` — Category launcher (4 categories)
- `AntibioticRefCards.tsx` — 59 organism reference cards
- `ACLSRefCards.tsx` — 50 ACLS algorithm step cards
- `NormalLabRefCards.tsx` — Lab values + vital signs (dual-mode)
- `index.ts` — Barrel export

### API Endpoints (functions/api/reference/)
- `scoring-systems/index.ts` — List all 56 scoring systems
- `scoring-systems/[id].ts` — Single scoring system detail
- `antibiotic-guidelines/index.ts` — 59 organisms
- `acls-algorithms/index.ts` — 50 ACLS steps

---

## Integration: KnowledgeBaseHub.tsx

### Step 1: Add import

```tsx
// Add near top of KnowledgeBaseHub.tsx imports:
import { Library } from 'lucide-react';
import ReferenceHub from '../library/ReferenceHub';
```

### Step 2: Add tab to NAV_TABS array
```tsx
// Add after the 'labs' entry:
{ id: 'reference', label: 'Reference', icon: Library, description: 'Procedures, imaging, ECG, anatomy, and more' },
```

### Step 3: Add to VALID_TAB_IDS
```tsx
const VALID_TAB_IDS = ['conditions', 'pharmacopeia', 'labs', 'reference'] as const;
```

### Step 4: Add tab content rendering
```tsx
// In the tab content switch/conditional, add:
{activeTab === 'reference' && <ReferenceHub />}
```

---

## Integration: ToolkitHub.tsx

### Step 1: Add imports
```tsx
import { ScoringSystemBrowser } from './calculators/scoring';
import { QuickRefHub } from './quickref';
```

### Step 2: Add tabs
```tsx
// Add to NAV_TABS after existing entries:
{ id: 'scoring', label: 'Scoring Systems', icon: ClipboardCheck, description: 'All 56 clinical scoring systems' },
{ id: 'quickref', label: 'Quick Ref', icon: BookOpen, description: 'Antibiotic guides, ACLS, lab values, vitals' },
```

### Step 3: Update VALID_TAB_IDS
```tsx
const VALID_UTILITY_TAB_IDS = ['calculators', 'generators', 'interpreters', 'imaging', 'scoring', 'quickref'] as const;
```

### Step 4: Add tab content
```tsx
{activeTab === 'scoring' && <ScoringSystemBrowser />}
{activeTab === 'quickref' && <QuickRefHub />}
```
