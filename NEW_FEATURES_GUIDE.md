# PANaCEa New Features Guide

This document describes the new features implemented across multiple phases to enhance the PANaCEa medical education platform.

## Table of Contents

- [Specialty CAQ Tracks (DLC Packs)](#specialty-caq-tracks-dlc-packs)
- [Daily Rituals](#daily-rituals)
- [High-Fidelity Clinical Simulation](#high-fidelity-clinical-simulation)
- [Accessibility & Personalization](#accessibility--personalization)

---

## Specialty CAQ Tracks (DLC Packs)

### Overview
Post-graduate specialty certification preparation packs that can be unlocked 2-3 years after graduation when users specialize.

### Available Specialties

1. **Orthopedic Surgery CAQ**
   - Advanced orthopedic cases
   - Fracture management
   - Sports medicine
   - Joint replacements
   - Surgical decision-making

2. **Dermatology CAQ**
   - Comprehensive dermatology
   - Lesion identification
   - Biopsy interpretation
   - Procedural dermatology
   - Cosmetic procedures

3. **Psychiatry CAQ**
   - Complex medication management
   - Therapy modalities
   - Crisis intervention
   - Advanced psychopharmacology

4. **Emergency Medicine CAQ**
   - Trauma protocols
   - Critical procedures
   - Toxicology
   - High-acuity decision-making

### Configuration Files
- `config/specialty-caq.ts` - Pack definitions and unlock logic
- Types defined in `types.ts`

### Testing
- `tests/specialty-caq.test.ts` - 6 comprehensive tests

---

## Daily Rituals

Engaging features to maintain daily user engagement and build study habits.

### 1. Medical Wordle

**Description:** Daily word-guessing game featuring medical terms (drugs, conditions, anatomy).

**Features:**
- 6 attempts to guess the word
- Color-coded feedback (green/yellow/gray)
- Hints based on drug class or body system
- Consistent daily words (same for all users)
- Progress saved locally

**Categories:**
- Drugs (e.g., ASPIRIN, WARFARIN, METFORMIN)
- Conditions (e.g., ASTHMA, DIABETES, STROKE)
- Anatomy (e.g., AORTA, FEMUR, LIVER)

**Files:**
- Data: `data/modes/dailyRitualsData.ts`
- Component: `components/modes/MedicalWordleMode.tsx`
- Config: Added to `config/training-modes.ts`

**Usage:**
```typescript
import { getTodaysMedicalWordle } from '@/data/modes/dailyRitualsData';

const game = getTodaysMedicalWordle();
// Returns: { id, date, targetWord, category, hints }
```

### 2. This Day in Medicine

**Description:** Historical medical events displayed on their anniversary dates.

**Featured Events:**
- September 28, 1928: Fleming discovers Penicillin
- January 11, 1922: First insulin treatment
- May 8, 1980: Smallpox eradicated
- April 25, 1953: DNA structure published
- And more...

**Features:**
- Automatic display on anniversary dates
- Link to related study questions
- External Wikipedia links for learning more

**Files:**
- Data: `data/modes/dailyRitualsData.ts`
- Component: `components/dashboard/ThisDayInMedicine.tsx`

**Usage:**
```typescript
import { getTodayInMedicine } from '@/data/modes/dailyRitualsData';

const event = getTodayInMedicine();
// Returns null if no event today, or HistoricalMedicalEvent object
```

### 3. Streak Freeze Insurance

**Description:** Virtual currency system allowing users to protect their study streaks.

**How It Works:**
- Earn coins by answering questions (1 coin per question)
- Bonus coins for correct answers (2 coins)
- Daily bonus for maintaining streaks (10 coins)
- Purchase streak freezes with coins (50 coins each)
- Max 5 freezes at a time

**Mechanics:**
- If you miss a day, a freeze is automatically consumed
- Your streak remains intact
- Prevents complete loss of long streaks

**Files:**
- Data: `data/modes/dailyRitualsData.ts`
- Component: `components/dashboard/StreakFreezeShop.tsx`

**Usage:**
```typescript
import { 
  calculateCoinsEarned, 
  canPurchaseStreakFreeze 
} from '@/data/modes/dailyRitualsData';

const coins = calculateCoinsEarned(10, 7, true);
// questionsAnswered: 10, correctAnswers: 7, hadActiveStreak: true
// Returns: 34 coins
```

---

## High-Fidelity Clinical Simulation

Advanced simulation modes for hands-on clinical decision-making practice.

### 1. Ventilator Hero

**Description:** Interactive ventilator management simulator for critical care scenarios.

**Features:**
- Adjust tidal volume, respiratory rate, PEEP, and FiO2
- Real-time physiologic feedback
- Condition-specific cases (ARDS, COPD, Asthma, etc.)
- Teaching points for each case
- Tracks attempts and provides detailed feedback

**Cases:**
- Moderate ARDS
- COPD Exacerbation
- Status Asthmaticus
- Cardiogenic Pulmonary Edema

**Key Learning:**
- Lung-protective ventilation strategies
- Permissive hypercapnia
- PEEP management
- Auto-PEEP prevention

**Files:**
- Data: `data/modes/ventilatorHeroData.ts`
- Types: `types/drill-modes.ts`
- Config: Added to `config/training-modes.ts`

**Usage:**
```typescript
import { 
  getRandomVentilatorCase, 
  evaluateVentilatorSettings 
} from '@/data/modes/ventilatorHeroData';

const vCase = getRandomVentilatorCase();
const newSettings = { tidalVolume: 400, respiratoryRate: 16, peep: 12, fio2: 80 };
const outcome = evaluateVentilatorSettings(vCase, newSettings);
// Returns: { ph, pco2, po2, success, feedback }
```

### 2. Triage Tent (Mass Casualty)

**Description:** Mass casualty triage simulation using START protocol.

**Features:**
- Swipe/tap to categorize victims
- 4 triage categories: Immediate (Red), Delayed (Yellow), Minor (Green), Expectant (Black)
- Speed and accuracy scoring
- Real-world scenarios (bus crash, building collapse, etc.)
- Teaching points for each decision

**START Triage Algorithm:**
1. Can walk? → Minor (Green)
2. Breathing? → If no, open airway
3. Respiratory Rate: <10 or >30 → Immediate (Red)
4. Perfusion: No radial pulse → Immediate (Red)
5. Mental Status: Cannot follow commands → Immediate (Red)
6. Otherwise → Delayed (Yellow)

**Files:**
- Data: `data/modes/triageTentData.ts`
- Types: `types/drill-modes.ts`
- Config: Added to `config/training-modes.ts`

**Usage:**
```typescript
import { 
  generateTriageSession, 
  calculateTriageScore 
} from '@/data/modes/triageTentData';

const session = generateTriageSession('bus-crash', 10);
// Practice triaging victims...
const score = calculateTriageScore(sessionWithDecisions);
// Returns: { accuracy, speed, overall }
```

### 3. Polypharmacy Puzzle

**Description:** Geriatric deprescribing challenges focusing on medication safety.

**Features:**
- Real-world polypharmacy cases
- 8-15 medications per patient
- Identify medications that should be stopped
- Partial credit scoring
- Deprescribing rationale for each medication
- Teaching points (Beers Criteria, drug interactions)

**Clinical Concerns:**
- Fall risk reduction
- QT prolongation
- Anticholinergic burden
- Renal impairment considerations

**Cases:**
- Fall Risk in Elderly (85yo with polypharmacy)
- QT Prolongation and Syncope
- Anticholinergic Burden causing Delirium
- Medication Safety in Severe Renal Impairment

**Files:**
- Data: `data/modes/polypharmacyData.ts`
- Types: `types/drill-modes.ts`
- Config: Added to `config/training-modes.ts`

**Usage:**
```typescript
import { 
  getRandomPolypharmacyCase, 
  evaluateDeprescribing 
} from '@/data/modes/polypharmacyData';

const pCase = getRandomPolypharmacyCase();
const selectedMeds = ['med-002', 'med-005', 'med-006'];
const result = evaluateDeprescribing(pCase, selectedMeds);
// Returns: { correct, partialCredit, feedback }
```

### 4. Radiology Scroll (DICOM Viewer)

**Description:** Interactive CT/MRI viewer with scrollable slices to find pathology.

**Features:**
- Scroll through imaging series (up to 50 slices)
- Multiple modalities (CT, MRI)
- Multiple body parts (head, chest, abdomen, pelvis)
- Critical slice identification
- Findings and diagnosis submission
- Thoroughness scoring based on slices viewed

**Cases:**
- CT Abdomen: Acute Appendicitis
- CT Head: Chronic Subdural Hematoma
- CT Chest: Pulmonary Embolism
- MRI Brain: Acute Stroke
- CT Abdomen: Abdominal Aortic Aneurysm
- CT Chest: Spontaneous Pneumothorax

**Files:**
- Data: `data/modes/radiologyScrollData.ts`
- Types: `types/drill-modes.ts`
- Config: Added to `config/training-modes.ts`

**Usage:**
```typescript
import { 
  getRandomRadiologySeries, 
  calculateRadiologyScore 
} from '@/data/modes/radiologyScrollData';

const series = getRandomRadiologySeries();
// User scrolls and identifies findings...
const score = calculateRadiologyScore(
  series, 
  identifiedFindings, 
  diagnosis, 
  criticalSlicesViewed, 
  timeSpent
);
// Returns: { findingsAccuracy, diagnosisCorrect, thoroughness, overall }
```

---

## Accessibility & Personalization

### 1. Unit Converter (US vs SI)

**Description:** Toggle between US standard and international (SI) units for laboratory values.

**Supported Conversions:**
- Glucose: mg/dL ↔ mmol/L
- BUN: mg/dL ↔ mmol/L
- Creatinine: mg/dL ↔ µmol/L
- Calcium: mg/dL ↔ mmol/L
- Cholesterol: mg/dL ↔ mmol/L
- Triglycerides: mg/dL ↔ mmol/L
- Bilirubin: mg/dL ↔ µmol/L
- Hemoglobin: g/dL ↔ g/L

**Files:**
- Config: `config/unit-converter.ts`
- Tests: `tests/unit-converter.test.ts`

**Usage:**
```typescript
import { convertLabValue, formatLabValue } from '@/config/unit-converter';

// Convert glucose from US to SI
const result = convertLabValue(100, 'glucose', 'us', 'si');
// Returns: { value: 5.55, unit: 'mmol/L' }

// Format with user preference
const formatted = formatLabValue('glucose', 100, 'si');
// Returns: "5.55 mmol/L"
```

### 2. Drug Name Localization

**Description:** Regional drug naming conventions (US/UK/Global).

**Supported Localizations:**
- Acetaminophen (US) → Paracetamol (UK/Global)
- Albuterol (US) → Salbutamol (UK/Global)
- Epinephrine (US) → Adrenaline (UK/Global)
- Norepinephrine (US) → Noradrenaline (UK/Global)
- Meperidine (US) → Pethidine (UK/Global)

**Files:**
- Config: `config/unit-converter.ts`
- Tests: `tests/unit-converter.test.ts`

**Usage:**
```typescript
import { 
  getLocalizedDrugName, 
  localizeDrugNamesInText 
} from '@/config/unit-converter';

const ukName = getLocalizedDrugName('acetaminophen', 'uk');
// Returns: "Paracetamol"

const text = 'Give Acetaminophen 500mg and Albuterol inhaler.';
const ukText = localizeDrugNamesInText(text, 'uk');
// Returns: "Give Paracetamol 500mg and Salbutamol inhaler."
```

### 3. Smart Watch Complications

**Description:** Sync study progress to Apple Watch and compatible smartwatches.

**Available Complications:**
- Days until exam countdown
- Daily question goal progress ring
- Current study streak

**Files:**
- Types: `types.ts` (SmartWatchComplication interface)
- Component: `components/settings/UserPreferencesPanel.tsx`

**Data Structure:**
```typescript
interface SmartWatchComplication {
  daysUntilExam?: number;
  dailyProgress?: {
    current: number;
    goal: number;
  };
  currentStreak?: number;
}
```

### 4. OSCE Configuration

**Advanced OSCE/Patient Encounter settings:**

#### Voice-to-Voice Mode
- Enable speech-to-text for questions
- AI responds verbally
- Simulates telehealth encounters

#### AI Difficulty Levels
- **Cooperative:** Clear, direct answers
- **Difficult:** Vague answers, distracted, requires skilled interviewing
- **Very Difficult:** Hostile, in pain, cognitive impairment

#### Resource-Limited Toggle
- Disables CT Scan and MRI options
- Simulates rural clinic environment
- Forces reliance on physical exam and basic diagnostics
- Available tests: X-Ray, Ultrasound, Basic Labs, ECG

#### Cultural Competency Scenarios
- Blood transfusion religious objections
- Organ donation cultural beliefs
- End-of-life care preferences
- Mental health cultural stigma

**Files:**
- Config: `config/osce-settings.ts`
- Tests: `tests/osce-settings.test.ts`

**Usage:**
```typescript
import { 
  DEFAULT_OSCE_CONFIG,
  getAIDifficultyPrompt,
  applyResourceLimitations 
} from '@/config/osce-settings';

const config: OSCEConfiguration = {
  enableVoiceMode: true,
  aiDifficultyLevel: 'difficult',
  resourceLimited: true,
  culturalCompetency: true
};

const limitedTests = applyResourceLimitations(['X-Ray', 'CT Scan', 'MRI', 'Ultrasound']);
// Returns: ['X-Ray', 'Ultrasound'] (CT and MRI removed)
```

### 5. User Preferences Panel

**Comprehensive settings UI for all personalization options.**

**Features:**
- Unit system selection (US/SI)
- Drug naming convention (US/UK/Global)
- Smart watch sync toggle
- Live examples and previews
- Persistent storage

**Files:**
- Component: `components/settings/UserPreferencesPanel.tsx`
- Types: `types.ts`

---

## Testing

### Test Coverage

**New Test Files:**
- `tests/new-training-modes.test.ts` - 34 tests covering all simulation modes
- `tests/specialty-caq.test.ts` - 6 tests for specialty packs
- `tests/osce-settings.test.ts` - 8 tests for OSCE configuration
- `tests/unit-converter.test.ts` - 17 tests for conversions and localization

**Total:** 65 new tests, all passing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/new-training-modes.test.ts
```

---

## Architecture

### Type System

All new features use TypeScript for type safety:

```typescript
// Main types in types.ts
- SpecialtyCAQPack
- OSCEConfiguration
- DailyRitualData
- MedicalWordleGame
- HistoricalMedicalEvent
- UserPreferences
- UnitSystem
- DrugNamingConvention
- SmartWatchComplication

// Drill mode types in types/drill-modes.ts
- VentilatorCase, VentilatorSettings, VentilatorAttempt
- TriageVictim, TriageCategory, TriageSession
- PolypharmacyCase, Medication, PolypharmacyAttempt
- RadiologySeries, RadiologySlice, RadiologyAttempt
```

### Configuration Files

- `config/specialty-caq.ts` - Specialty pack definitions
- `config/osce-settings.ts` - OSCE configuration
- `config/unit-converter.ts` - Unit conversions and drug localization
- `config/training-modes.ts` - All training mode metadata (updated)

### Data Files

- `data/modes/dailyRitualsData.ts` - Wordle, history, streak freeze data
- `data/modes/ventilatorHeroData.ts` - Ventilator cases and logic
- `data/modes/triageTentData.ts` - Triage victims and scenarios
- `data/modes/polypharmacyData.ts` - Polypharmacy cases
- `data/modes/radiologyScrollData.ts` - Radiology series

---

## Integration Guide

### Adding New Modes to Menu

All new modes are automatically registered in `config/training-modes.ts`:

```typescript
export const MODE_REGISTRY: TrainingModeConfig[] = [
  // ... existing modes
  {
    id: 'medical_wordle',
    label: 'Medical Wordle',
    description: 'Daily medical word guessing game...',
    category: 'recall',
    iconName: 'Hash',
    theme: 'green',
    route: '/drill/medical-wordle',
    isComingSoon: false,
  },
  // ... other new modes
];
```

### Using in Components

```typescript
import { MODE_REGISTRY } from '@/config/training-modes';

// Find specific mode
const wordleMode = MODE_REGISTRY.find(m => m.id === 'medical_wordle');

// Filter by category
const clinicalModes = MODE_REGISTRY.filter(m => m.category === 'clinical');

// Check if mode is available
const isAvailable = !mode.isComingSoon;
```

---

## Future Enhancements

### Planned Features
1. AI voice synthesis for OSCE voice-to-voice mode
2. Real DICOM image integration for radiology scroll
3. Multiplayer triage competitions
4. Specialty CAQ question banks
5. Apple Watch native app with complications
6. Advanced ventilator waveform visualization

### Extensibility
All systems are designed to be extensible:
- Add new specialty packs in `config/specialty-caq.ts`
- Add new historical events in `data/modes/dailyRitualsData.ts`
- Add new simulation cases in respective data files
- Add new drug localizations in `config/unit-converter.ts`

---

## Support

For questions or issues:
1. Check the test files for usage examples
2. Review type definitions in `types.ts` and `types/drill-modes.ts`
3. Refer to existing implementation in data files

---

## License

All code follows the existing PANaCEa license and contribution guidelines.

---

## Changelog

### Version 1.0.0 (December 2024)

**Added:**
- Specialty CAQ DLC packs (4 specialties)
- Medical Wordle daily game
- This Day in Medicine historical events
- Streak Freeze insurance system
- Ventilator Hero simulator
- Triage Tent mass casualty mode
- Polypharmacy Puzzle
- Radiology Scroll DICOM viewer
- Unit converter (US/SI)
- Drug name localization (US/UK/Global)
- Smart Watch complications support
- OSCE advanced configurations
- User Preferences Panel

**Testing:**
- 65 new tests added
- 100% test pass rate for new features
- Zero security vulnerabilities (CodeQL verified)

**Documentation:**
- Complete feature guide (this document)
- Inline code documentation
- Usage examples for all APIs
