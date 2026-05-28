# OSCE Enhancement System Documentation

## Overview

The OSCE (Objective Structured Clinical Examination) Enhancement System provides a comprehensive, immersive patient encounter simulation for PA student training. It includes:

1. **Quick Order System** - EMR-style order placement with clinical decision support
2. **Patient Personality Engine** - AI-driven patient simulator with realistic behaviors
3. **Interactive Physical Exam** - Clickable body map with 100+ exam maneuvers
4. **Scoring Engine** - Critical action tracking and competency-based assessment

---

## Architecture

```
components/modes/osce/
├── index.ts              # Exports all components
├── OrderPanel.tsx        # Order placement interface
├── BodyMap.tsx           # Interactive SVG body diagram
├── ExamPanel.tsx         # Physical exam orchestration
├── RapportMeter.tsx      # Patient rapport display
└── ScoreReport.tsx       # End-of-session scoring

services/
├── patientPersonalityEngine.ts  # AI personality system
└── osceScoringEngine.ts         # Scoring and tracking

hooks/
└── useEnhancedOSCE.ts    # Integration hook

functions/api/osce/
└── orderable-items.ts    # API for labs/imaging/meds

types/
└── osce-enhanced.ts      # TypeScript definitions
```

---

## Components

### 1. OrderPanel

EMR-style order placement interface.

**Features:**

- 4 tabs: Labs, Imaging, Procedures, Medications
- Debounced search with autocomplete
- 6 Quick Order Bundles:
  - Cardiac Workup (ECG, Troponins, BNP, CMP)
  - Sepsis Bundle (Lactate, Blood cultures, CBC, CMP)
  - DKA Protocol (BMP, ABG, Serum ketones, Glucose)
  - PE Workup (D-dimer, CT Angio, Troponin)
  - Stroke Alert (CT Head, Glucose, CBC, PT/INR)
  - Abdominal Pain (CBC, CMP, Lipase, CT Abd/Pelvis)
- Clinical Decision Support:
  - Duplicate order detection
  - Allergy cross-check
  - Contraindication warnings
  - Cost tier indicators ($-$$$$)
  - Turnaround time display

**Usage:**

```tsx
import { OrderPanel } from '@/components/modes/osce';

<OrderPanel
  onOrderPlaced={(order) => handleOrder(order)}
  placedOrders={orders}
  patientAllergies={['Penicillin']}
  patientConditions={['Renal insufficiency']}
/>;
```

### 2. BodyMap & ExamPanel

Interactive physical examination system.

**BodyMap Features:**

- 31 clickable anatomical regions
- Anterior/posterior view toggle
- Color coding:
  - Gray: Not examined
  - Yellow: Suggested (based on chief complaint)
  - Green: Normal finding
  - Orange: Abnormal finding
  - Blue: Hover state

**ExamPanel Features:**

- 100+ exam maneuvers organized by region
- Category icons (inspection, palpation, auscultation, percussion)
- Real-time finding display
- Abnormality detection
- Exam summary footer

**Usage:**

```tsx
import { ExamPanel } from '@/components/modes/osce';

<ExamPanel
  onExamPerformed={(finding) => recordFinding(finding)}
  completedExams={examFindings}
  suggestedRegions={['heart', 'lungs', 'chest_anterior']}
  caseData={currentCase}
/>;
```

### 3. RapportMeter

Real-time patient rapport visualization.

**Features:**

- Circular progress gauge (0-100)
- Emotional state emoji indicator
- Milestone tracking with unlocks:
  - 25+: Patient less guarded
  - 50+: Reveals additional details
  - 70+: Shares sensitive information
  - 80+: Reveals hidden agenda
  - 90+: Full trust established
- Empathy/Trust/Frustration breakdown
- Personality trait display

**Variants:**

- Full: Complete card with milestones
- Compact: Inline progress bar
- RapportIndicator: Mini inline display

**Usage:**

```tsx
import { RapportMeter, RapportIndicator } from '@/components/modes/osce';

// Full version
<RapportMeter
  meter={rapportState}
  emotionalState={emotionalState}
  personality={personality}
  showMilestones={true}
/>

// Compact version
<RapportMeter meter={rapportState} compact />

// Inline indicator
<RapportIndicator score={65} emotion="anxious" />
```

### 4. ScoreReport

End-of-session comprehensive scoring.

**Features:**

- Overall score with grade coloring
- ACGME Milestone Level (1-5)
- 6-domain competency breakdown:
  - History Taking
  - Physical Exam
  - Diagnostic Reasoning
  - Treatment
  - Communication
  - Efficiency
- Critical actions checklist
- Encounter timeline
- Learning gaps analysis
- Strengths/improvements summary

**Usage:**

```tsx
import { ScoreReport } from '@/components/modes/osce';

<ScoreReport
  report={scoreReport}
  onClose={() => setShowReport(false)}
  onRetry={() => startNewCase()}
/>;
```

---

## Services

### Patient Personality Engine

`services/patientPersonalityEngine.ts`

Generates realistic patient personalities for AI simulation.

**Personality Dimensions:**

| Dimension           | Options                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| Communication Style | verbose, terse, anxious, stoic, angry, confused, evasive, dramatic          |
| Health Literacy     | low, medium, high                                                           |
| Pain Behavior       | stoic, expressive, catastrophizing                                          |
| Hidden Agenda       | none, seeking_drugs, fear_cancer, hiding_abuse, work_excuse, secondary_gain |

**Key Functions:**

```typescript
// Generate random personality
const personality = generatePatientPersonality();

// Initialize rapport meter
const rapport = initializeRapportMeter();

// Initialize emotional state
const emotion = initializeEmotionalState(personality);

// Generate information control rules
const rules = generateInformationRules(personality);

// Process an interaction
const result = processEnhancedInteraction(userMessage, personality, rapport, emotion, rules);
// Returns: { updatedRapport, updatedEmotion, nonVerbalCue, shouldRevealHidden }

// Build AI prompt with personality context
const prompt = buildEnhancedPatientPrompt(
  personality,
  rapportScore,
  emotionalState,
  additionalContext
);
```

**Non-Verbal Cues Library:**

The engine injects contextual non-verbal cues:

- Anxiety cues: wringing hands, avoiding eye contact, bouncing leg
- Pain cues: grimacing, guarding abdomen, shallow breathing
- Rapport cues: nodding, leaning forward, maintaining eye contact
- Distress cues: tearing up, voice breaking, long pauses

### OSCE Scoring Engine

`services/osceScoringEngine.ts`

Tracks critical actions and calculates competency scores.

**Universal Critical Actions:**

- Verify patient identity
- Hand hygiene before exam
- Obtain verbal consent
- Explain procedures
- Assess pain
- Ask about medication allergies
- Review current medications

**Condition-Specific Actions:**

| Condition    | Critical Actions                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------- |
| ACS/MI       | ECG within 10 min, Serial troponins, Aspirin 325mg                                              |
| Stroke       | Non-contrast head CT, Blood glucose, NIH Stroke Scale, Last known well time                     |
| Sepsis       | Serum lactate, Blood cultures before antibiotics, Broad-spectrum abx within 1hr, 30ml/kg fluids |
| PE           | Wells score, D-dimer if appropriate, CT pulmonary angiogram, Anticoagulation                    |
| Pneumonia    | Chest X-ray, Oxygenation assessment, CURB-65/PSI score, Appropriate antibiotics                 |
| Appendicitis | RLQ tenderness, CT/US imaging, NPO status, Surgical consultation                                |

**Usage:**

```typescript
import { createScoringEngine } from '@/services/osceScoringEngine';

// Create engine for a case
const engine = createScoringEngine(caseData);

// Track actions
engine.trackQuestion(question, 'history');
engine.trackExam(examFinding);
engine.trackOrder(order);
engine.trackTreatment(treatment);

// Generate final report
const report = engine.generateReport(finalDiagnosis, differentials);
```

---

## Integration Hook

`hooks/useEnhancedOSCE.ts`

Unified state management for all OSCE features.

**Usage:**

```typescript
import { useEnhancedOSCE } from '@/hooks/useEnhancedOSCE';

const {
  state,
  initializeSession,
  endSession,
  processMessage,
  addChatMessage,
  placeOrder,
  cancelOrder,
  recordExamFinding,
  getSuggestedExams,
  setPhase,
  getRapportScore,
  getEmotionIcon,
  getIntermediateScore,
} = useEnhancedOSCE({
  enablePersonality: true,
  enableRapport: true,
  enableScoring: true,
});

// Start a session
initializeSession(caseData);

// Process user message
const { updatedRapport, nonVerbalCue, enhancedPrompt } = processMessage(message);

// Use enhancedPrompt for AI call
const aiResponse = await callGemini(enhancedPrompt + actualUserMessage);

// End session and get report
const report = endSession(finalDiagnosis, differentials);
```

**State Structure:**

```typescript
interface EnhancedOSCEState {
  personality: PatientPersonalityMatrix | null;
  rapportMeter: RapportMeter;
  emotionalState: EmotionalState | null;
  infoRules: InformationControlRule[];
  orders: PlacedOrder[];
  examFindings: ExamFinding[];
  chatHistory: EnhancedChatMessage[];
  scoreReport: OSCEScoreReport | null;
  isSessionActive: boolean;
  currentPhase: 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
}
```

---

## API Endpoints

### GET /api/osce/orderable-items

Returns available orderable items.

**Query Parameters:**

- `type`: 'lab' | 'imaging' | 'procedure' | 'medication' | 'all'

**Response:**

```json
{
  "items": [
    {
      "id": "cbc",
      "name": "Complete Blood Count (CBC)",
      "type": "lab",
      "category": "Hematology",
      "turnaroundTime": "1 hour",
      "cost": "$"
    }
  ]
}
```

---

## Integration with PatientEncounterMode

To integrate into the existing `PatientEncounterMode.tsx`:

```tsx
import { useEnhancedOSCE } from '@/hooks/useEnhancedOSCE';
import { OrderPanel, ExamPanel, RapportMeter, ScoreReport } from '@/components/modes/osce';

function PatientEncounterMode({ caseData }) {
  const osce = useEnhancedOSCE();
  const [showOrders, setShowOrders] = useState(false);
  const [showExam, setShowExam] = useState(false);

  useEffect(() => {
    osce.initializeSession(caseData);
  }, [caseData]);

  const handleSendMessage = async (message: string) => {
    const { enhancedPrompt, nonVerbalCue } = osce.processMessage(message);

    // Call AI with enhanced prompt
    const response = await fetch('/api/osce/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: enhancedPrompt,
        message,
      }),
    });

    // Display non-verbal cue if present
    if (nonVerbalCue) {
      displayCue(nonVerbalCue);
    }
  };

  return (
    <div className="flex">
      {/* Main chat area */}
      <div className="flex-1">
        <ChatInterface onSend={handleSendMessage} />
      </div>

      {/* Side panel */}
      <div className="w-80">
        <RapportMeter
          meter={osce.state.rapportMeter}
          emotionalState={osce.state.emotionalState}
          personality={osce.state.personality}
        />

        {showOrders && (
          <OrderPanel onOrderPlaced={osce.placeOrder} placedOrders={osce.state.orders} />
        )}

        {showExam && (
          <ExamPanel
            onExamPerformed={osce.recordExamFinding}
            completedExams={osce.state.examFindings}
            suggestedRegions={osce.getSuggestedExams(caseData.chiefComplaint)}
          />
        )}
      </div>

      {/* Score report modal */}
      {osce.state.scoreReport && (
        <Modal>
          <ScoreReport report={osce.state.scoreReport} />
        </Modal>
      )}
    </div>
  );
}
```

---

## Future Enhancements

1. **Multimedia Integration**
   - Clinical images tied to exam findings
   - Auscultation sounds for heart/lung exams
   - ECG/X-ray results with interpretation

2. **AI Improvements**
   - Fine-tuned patient responses per personality
   - Context-aware follow-up questions
   - Emotional escalation/de-escalation

3. **Multiplayer Mode**
   - Peer observation with feedback
   - Instructor monitoring dashboard
   - Team-based scenarios (handoffs)

4. **Analytics**
   - Learning progression tracking
   - Weakness identification
   - Spaced repetition for weak areas

---

## Files Created

| File                                     | Purpose                  | LOC  |
| ---------------------------------------- | ------------------------ | ---- |
| `components/modes/osce/OrderPanel.tsx`   | Order placement UI       | ~350 |
| `components/modes/osce/BodyMap.tsx`      | Interactive body diagram | ~400 |
| `components/modes/osce/ExamPanel.tsx`    | Physical exam UI         | ~280 |
| `components/modes/osce/RapportMeter.tsx` | Rapport display          | ~220 |
| `components/modes/osce/ScoreReport.tsx`  | Score report UI          | ~350 |
| `components/modes/osce/index.ts`         | Exports                  | ~10  |
| `services/patientPersonalityEngine.ts`   | Personality AI           | ~500 |
| `services/osceScoringEngine.ts`          | Scoring logic            | ~450 |
| `hooks/useEnhancedOSCE.ts`               | Integration hook         | ~280 |
| `functions/api/osce/orderable-items.ts`  | API endpoint             | ~150 |
| `types/osce-enhanced.ts`                 | TypeScript types         | ~200 |

**Total: ~3,200 lines of code**

---

## Testing

Run tests:

```bash
npm run test -- --grep "OSCE"
```

Key test scenarios:

1. Personality generation produces valid matrices
2. Rapport meter updates correctly with interactions
3. Critical actions trigger appropriately
4. Score calculation is accurate
5. Order bundles expand correctly
6. Exam findings track properly

---

## Grading, seeding, and API

### Grading flow

1. User completes encounter and clicks **End Encounter**.
2. Front end calls `POST /api/osce/complete` first, then `POST /api/osce/analysis/grade` (grade requires `session.status === 'completed'`).
3. Grade API loads the completed session and case rubric; if no `CaseRubric` exists, it falls back to a checklist built from `essentialQuestions` + `idealWorkup`.
4. Gemini returns rubric grading, the API persists/updates `OsceResult`, and optionally creates `ConceptGap` for tutor targeting when differential performance is poor.
5. Results view shows Preceptor debrief plus rubric checklist (PASS/FAIL per item), red flags missed, and supports **Retry grading**.

### Seed scripts

- **Cases:** `npm run seed:osce-cases` — seeds `PatientEncounterCase` rows (run first).
- **Rubrics:** `npm run seed:osce-rubrics` — creates `CaseRubric` for cases that don’t have one, using `essentialQuestions` and `idealWorkup`. Grading works without rubrics via the API fallback; rubrics improve consistency.

### OSCE API contract

All endpoints below require authenticated requests.

- **GET /api/osce/history?sessionId=…&limit=…**  
  Query params: `sessionId` (required), `limit` (optional, 1–500, default 100).  
  Returns `{ history }`. Session ownership enforced; 404 if not found or not owned.

- **POST /api/osce/complete**  
  Request body:
  ```json
  {
    "body": {
      "sessionId": "string",
      "diagnosis": "string (optional)",
      "treatmentPlan": "string (optional)",
      "osceTelemetry": {
        "totalTimeMs": "number (optional)",
        "clinicalConfidenceIndex": "number 1-4 (optional)",
        "redFlagsMissed": "number (optional)",
        "unnecessaryOrders": "number (optional)",
        "implicitRating": {
          "rating": "number",
          "confidence": "number",
          "components": "object of numeric component scores (optional)"
        },
        "efficiencyScore": "number (optional)",
        "speechMetrics": "object (optional)",
        "diagnosticEfficiency": "object (optional)",
        "rapportMetrics": "object (optional)",
        "actionCount": "number (optional)"
      }
    }
  }
  ```
  Behavior:
  - Marks the encounter session as `completed` (idempotent).
  - Returns `{ "success": true, "alreadyCompleted": true }` when already completed.
  - Persists telemetry on `PatientEncounterSession.osceTelemetry` when provided.
  - Does not create `CaseFile`; grading output remains owned by `/api/osce/analysis/grade`.

- **POST /api/osce/analysis/grade**  
  Request body:
  ```json
  {
    "body": {
      "sessionId": "string"
    }
  }
  ```
  Success response fields:
  - `resultId`
  - `score` (0-100)
  - `checklist` (`[{ item, status: "PASS" | "FAIL", feedback }]`)
  - `redFlagsMissed` (`string[]`)
  - `clinicalReasoningScore` (0-100)
  - `billingCodeSuggestion`
  - `softSkillsReport` (optional)
  - `conceptGapCreated` (boolean)
  
  Notes:
  - Returns `400` if session is not completed.
  - Applies Gemini-specific rate limiting (`429` when exceeded).
