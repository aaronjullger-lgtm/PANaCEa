# Lab Mode Enhancement - Orderable Tests Feature

## Overview

The Lab Mode has been enhanced to support a more realistic clinical workflow where users start with basic lab panels (CBC, BMP, LFT) and can order additional tests as needed to help diagnose the condition.

## Key Features

### 1. Comprehensive Lab Test Database (300+ Tests)

Located in `src/data/labTests.ts`, this database contains:
- **300+ available laboratory tests** organized by category
- Categories include:
  - Basic Panels (BMP, CBC, CMP, LFT)
  - Hematology
  - Endocrine
  - Infectious Disease
  - Toxicology
  - Immunology/Rheumatology
  - Cardiac
  - Renal Function
  - Gastrointestinal
  - Tumor Markers
  - Genetics
  - And more...

Each test includes:
- Test name
- Category
- Typical use description
- Common abnormalities (when relevant)

### 2. Lab-Driven Conditions Database (300 Conditions)

Located in `src/data/labDrivenConditions.ts`, this database contains:
- **300 conditions** that are primarily diagnosed through laboratory testing
- Organized by medical specialty:
  - Hematology (40 conditions)
  - Metabolic/Endocrine (60 conditions)
  - Renal/Electrolyte (40 conditions)
  - Hepatic (30 conditions)
  - Cardiac (20 conditions)
  - Infectious Disease (40 conditions)
  - Rheumatologic/Autoimmune (25 conditions)
  - Gastrointestinal (20 conditions)
  - Oncology (15 conditions)
  - Toxicology (10 conditions)

### 3. Orderable Tests Workflow

#### Initial State
When a lab case is presented, users see:
- **Patient demographics** (age, sex)
- **Clinical vignette** (2-3 sentences describing presentation)
- **Three default lab panels** (always shown):
  1. Complete Blood Count (CBC)
  2. Basic Metabolic Panel (BMP)
  3. Liver Function Tests (LFT)

#### Ordering Additional Tests
- Click the **"Order Additional Tests"** button
- Browse available tests (shown in a dropdown menu)
- Click on a test name to order it
- The test results appear immediately in the lab panel display
- Continue ordering tests as needed to reach a diagnosis

#### Submitting Diagnosis
- Once ready, enter your diagnosis in the text field
- The system will provide feedback on correctness
- Review key findings and explanations

## Technical Implementation

### Type Definitions

```typescript
// Enhanced LabCase interface
interface LabCase {
  id: string;
  clinicalContext: string;
  patientAge: number;
  patientSex: 'M' | 'F';
  panels: LabPanel[];  // Initially shown panels
  correctDiagnosis: string;
  keyFindings: string[];
  explanation: string;
  category: LabCategory;
  orderableTests?: LabPanel[];  // Tests that can be ordered
  orderedTests?: string[];      // Tests the user has ordered
}
```

### Hook API

The `useMiniLabDrill` hook provides:

```typescript
const {
  currentCase,           // Current lab case
  status,               // Game status
  availableTests,       // Tests that can be ordered
  orderTest,            // Function to order a test
  submitAnswer,         // Function to submit diagnosis
  // ... other functions
} = useMiniLabDrill();
```

### Component Integration

The `MiniLabDrillSession` component:
- Displays initial lab panels
- Shows "Order Additional Tests" button when orderable tests are available
- Provides a dropdown menu of available tests
- Updates the UI when tests are ordered
- Maintains state across user interactions

## Usage Example

### For Developers

```typescript
// Order a test programmatically
const testToOrder = "Arterial Blood Gas";
orderTest(testToOrder);

// Check available tests
console.log(availableTests); // ["Urinalysis", "Thyroid Function Tests", ...]

// Check what's been ordered
console.log(currentCase?.orderedTests); // ["Arterial Blood Gas"]
```

### For Content Generation

The `generateLabContent.ts` script has been updated to:
1. Use the comprehensive condition database
2. Include orderable tests in generated cases
3. Ensure default panels (BMP, CBC, LFT) are always included
4. Add 2-4 relevant orderable tests per case

Run the script:
```bash
npm run generate:lab
```

## Testing

Comprehensive test suite in `hooks/game/use-mini-lab-drill.test.ts` covers:
- Initial state verification
- Test ordering functionality
- Panel updates
- Available tests filtering
- State persistence
- Basic game functionality

Run tests:
```bash
npm test hooks/game/use-mini-lab-drill.test.ts
```

## Files Modified/Created

### New Files
- `src/data/labTests.ts` - Comprehensive lab test database
- `src/data/labDrivenConditions.ts` - Lab-driven conditions database
- `hooks/game/use-mini-lab-drill.test.ts` - Test suite
- `docs/LAB_MODE_ENHANCEMENT.md` - This documentation

### Modified Files
- `src/types/content.ts` - Added orderable tests support
- `hooks/game/use-mini-lab-drill.ts` - Added ordering functionality
- `components/drill/MiniLabDrillSession.tsx` - Added UI for ordering tests
- `scripts/generateLabContent.ts` - Updated to use new databases

## Future Enhancements

Possible improvements:
1. **Cost tracking** - Track the "cost" of ordered tests
2. **Time limits** - Add time pressure to ordering decisions
3. **Hints** - Provide hints about which tests might be helpful
4. **Test result delays** - Simulate real-world lab result timing
5. **Test bundles** - Allow ordering common test combinations
6. **Search functionality** - Add search/filter for available tests
7. **Categories in UI** - Group orderable tests by category in the dropdown

## Educational Benefits

This enhancement provides:
- **Realistic clinical workflow** - Mirrors actual medical decision-making
- **Cost awareness** - Encourages thoughtful test ordering
- **Differential diagnosis practice** - Users must think about which tests will help
- **Comprehensive test exposure** - 300+ tests familiarizes students with available diagnostics
- **Pattern recognition** - Learn which tests are useful for different presentations

## Backward Compatibility

The system maintains full backward compatibility:
- Existing lab cases work without orderable tests
- Cases without orderable tests show only default panels
- No breaking changes to existing functionality
- All previous tests continue to pass
