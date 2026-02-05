# Module 4: Smart Scribe & Tutor Architecture

**Version:** 1.0.0  
**Date:** February 5, 2026  
**Status:** ✅ Design Complete - Implementation Pending

---

## Table of Contents

1. [Overview](#overview)
2. [Auto-Scribe System](#auto-scribe-system)
3. [Dynamic Remediation Graphics](#dynamic-remediation-graphics)
4. [Enhanced Audio Visualization](#enhanced-audio-visualization)
5. [Timing Analytics](#timing-analytics)
6. [Automated Case Files](#automated-case-files)
7. [Integration Architecture](#integration-architecture)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Overview

**Module 4** is the **synthesis layer** that automates grunt work and provides dynamic visual remediation, allowing students to focus on clinical reasoning rather than documentation.

**Core Purpose**: Automate documentation, provide visual learning aids, track performance metrics

**Key Technologies:**
- `gemini-dictation`: Real-time SOAP note generation
- `info_genius`: Dynamic infographic generation
- `echoscript + echo_paths`: Timing analysis and conversation tree visualization
- `live_audio`: Enhanced audio visualization with haptic feedback

---

## Auto-Scribe System

### Overview

**Problem**: Students spend cognitive load on note-taking instead of focusing on clinical reasoning

**Solution**: AI runs in background during OSCE, automatically drafting a "gold standard" SOAP note

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OSCE SESSION (MODULE 1)                       │
│  ┌────────────────┐     ┌────────────────┐     ┌──────────────┐
│  │ Voice          │     │ Transcript     │     │ Vitals       │
│  │ Interaction    │────▶│ Buffer         │────▶│ Updates      │
│  └────────────────┘     └────────────────┘     └──────────────┘
└───────────────────────────────────┼────────────────────────────┘
                                    │
                                    │ Real-time Feed
                                    │
┌───────────────────────────────────▼────────────────────────────┐
│              REALTIME SOAP GENERATOR                            │
│  ┌────────────────────────────────────────────────────────────┐
│  │  gemini-dictation                                          │
│  │  - Extract HPI elements (onset, duration, character, etc.) │
│  │  - Document vitals and physical exam                       │
│  │  - Formulate assessment and differential                   │
│  │  - Create management plan                                  │
│  │  - Update every 5 seconds                                  │
│  └────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Final Note
                                    │
┌───────────────────────────────────▼────────────────────────────┐
│                     COMPARISON LAYER                            │
│  ┌─────────────────────┐         ┌─────────────────────────┐  │
│  │ Student's Note      │   VS    │ AI Gold Standard       │  │
│  │                     │         │                         │  │
│  │ "55yo M with chest" │         │ "55yo M with crushing  │  │
│  │ [MISSING: Duration] │         │  substernal chest      │  │
│  │ [MISSING: Radiation]│         │  pressure x 30 min,    │  │
│  │                     │         │  radiating to L arm"   │  │
│  └─────────────────────┘         └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### SOAP Note Structure

```typescript
interface SOAPNote {
  subjective: {
    chiefComplaint: SOAPElement;
    hpi: {
      onset: SOAPElement;           // "Sudden onset 30 minutes ago"
      location: SOAPElement;         // "Substernal"
      duration: SOAPElement;         // "Persistent for 30 minutes"
      character: SOAPElement;        // "Crushing, pressure-like"
      aggravating_factors: SOAPElement;
      relieving_factors: SOAPElement;
      severity: SOAPElement;         // "10/10"
      associated_symptoms: SOAPElement; // "Diaphoresis, nausea"
    };
    // ... more sections
  };
  objective: {
    vitalSigns: SOAPElement;
    physicalExam: { ... };
    labs?: SOAPElement;
    imaging?: SOAPElement;
  };
  assessment: {
    primaryDiagnosis: SOAPElement;
    differentialDiagnoses: SOAPElement[];
    clinicalReasoning: SOAPElement;
  };
  plan: {
    diagnosticWorkup?: SOAPElement;
    treatment?: SOAPElement;
    patientEducation?: SOAPElement;
    followUp?: SOAPElement;
  };
}
```

### Real-Time Generation Flow

1. **Listening Phase**:
   - Audio transcribed via `gemini-dictation`
   - Transcript buffer accumulates
   - Vitals updates captured
   - Physical findings tracked

2. **Extraction Phase** (every 5 seconds):
   - Gemini analyzes transcript + vitals + findings
   - Extracts SOAP elements with confidence scores
   - Updates draft note incrementally

3. **Finalization Phase** (end of encounter):
   - Comprehensive final extraction
   - Calculate completeness score
   - Return gold standard note

4. **Comparison Phase**:
   - Student submits their note
   - Element-by-element comparison
   - Missing/incomplete/incorrect highlighting
   - Generate feedback

### Example: Missing HPI Elements

```
Student's Note:
  Subjective: 55yo M with chest pain
  
Gold Standard:
  Subjective: 55yo M with sudden onset (30 min ago) crushing substernal
  chest pressure (10/10), radiating to L arm and jaw, associated with
  diaphoresis and nausea. No relieving factors. Risk factors: HTN, DM,
  smoking (40 pack-years).

Comparison:
  ✅ Chief complaint present
  ❌ MISSING: Onset (critical)
  ❌ MISSING: Duration (important)
  ❌ MISSING: Character (critical)
  ❌ MISSING: Radiation (important)
  ❌ MISSING: Severity (important)
  ❌ MISSING: Associated symptoms (important)
  ❌ MISSING: Risk factors (important)

Score: 12/100 (Completeness)
Feedback: "Critical HPI elements missing. Always document OPQRST."
```

### Implementation

```typescript
// Start real-time generation
const service = createSOAPNoteService(GEMINI_API_KEY);
await service.startRealtimeGeneration(sessionId);

// Add transcript as it comes in
await service.addTranscript(sessionId, 'patient', 'I have chest pain');
await service.addTranscript(sessionId, 'student', 'When did it start?');
await service.addTranscript(sessionId, 'patient', 'About 30 minutes ago');

// Add vitals updates
await service.addVitals(sessionId, { hr: 110, bp: '140/90', o2: 94 });

// Get draft note (UI can display this in real-time)
const draft = service.getDraftNote(sessionId);

// Finalize at end
const goldStandard = await service.finalizeNote(sessionId);

// Compare with student note
const comparison = await service.compareNotes(studentNote, goldStandard);
```

---

## Dynamic Remediation Graphics

### Overview

**Problem**: Students confuse similar conditions (e.g., Erythema Nodosum vs. Migrans)

**Solution**: AI instantly generates side-by-side comparison infographics tailored to the student's confusion

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT CONFUSION DETECTED                    │
│  Student selected: "Lyme disease" (Erythema Migrans)            │
│  Correct answer: "Sarcoidosis" (Erythema Nodosum)              │
└───────────────────────────────┼────────────────────────────────┘
                                │
                                │ Confusion Event
                                │
┌───────────────────────────────▼────────────────────────────────┐
│              INFOGRAPHIC GENERATOR (info_genius)                │
│  ┌────────────────────────────────────────────────────────────┐
│  │  Generate side-by-side comparison:                         │
│  │                                                             │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │  │ Erythema Nodosum    │  │ Erythema Migrans        │   │
│  │  │ [Image of nodules]  │  │ [Image of bulls-eye]    │   │
│  │  │ - Tender nodules    │  │ - Target lesion         │   │
│  │  │ - Shins/pretibial   │  │ - Expands outward       │   │
│  │  │ - Systemic disease  │  │ - Lyme disease          │   │
│  │  └─────────────────────┘  └─────────────────────────┘   │
│  │                                                             │
│  │  Key Difference: Location and appearance                  │
│  │  Mnemonic: Nodosum = Nodules, Migrans = Migrates         │
│  └────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Infographic Types

| Type | Use Case | Example |
|------|----------|---------|
| **Comparison** | Confusing similar conditions | Erythema Nodosum vs. Migrans |
| **Flowchart** | Diagnostic algorithm | Chest Pain Workup Decision Tree |
| **Differential Table** | DDx comparison | Acute Abdomen Differentials |
| **Algorithm** | Treatment pathway | Sepsis Management Algorithm |
| **Mnemonic Visual** | Memory aid | MUDPILES (Anion Gap Acidosis) |
| **Timeline** | Pathophysiology | MI Pathophys Timeline |
| **Anatomy** | Structural relationships | Brachial Plexus Diagram |

### Example Request

```typescript
const request: InfographicRequest = {
  id: 'infographic-001',
  type: 'comparison',
  primaryConcept: 'Erythema Nodosum',
  secondaryConcept: 'Erythema Migrans',
  confusionPoint: 'Student confused the two skin lesions',
  audience: 'student',           // vs. 'resident' or 'attending'
  complexity: 'moderate',         // vs. 'simple' or 'detailed'
  teachingPoints: [
    'Erythema Nodosum: Tender nodules on shins, systemic disease',
    'Erythema Migrans: Bulls-eye rash, Lyme disease',
    'Key difference: Location (shins vs. anywhere) and appearance'
  ],
  colorScheme: 'light',
  context: {
    caseContext: 'Patient with knee pain and rash',
    studentAnswer: 'Lyme disease',
    correctAnswer: 'Sarcoidosis with Erythema Nodosum'
  }
};

const infographic = await service.generateInfographic(request);
// → Returns SVG with interactive hover elements
```

### Common Confusion Pairs (Pre-Generated Library)

| Concept A | Concept B | Frequency | PANCE Yield |
|-----------|-----------|-----------|-------------|
| Crohn's Disease | Ulcerative Colitis | ★★★★★ | 95 |
| Type 1 DM | Type 2 DM | ★★★★★ | 92 |
| STEMI | NSTEMI | ★★★★★ | 98 |
| Nephritic | Nephrotic Syndrome | ★★★★☆ | 88 |
| Basal Cell | Squamous Cell Carcinoma | ★★★★☆ | 85 |
| Appendicitis | Diverticulitis | ★★★★☆ | 82 |
| Viral Meningitis | Bacterial Meningitis | ★★★★☆ | 90 |
| Systolic HF | Diastolic HF | ★★★☆☆ | 78 |
| Pneumonia | Pulmonary Embolism | ★★★☆☆ | 80 |
| Erythema Nodosum | Erythema Migrans | ★★★☆☆ | 75 |

---

## Enhanced Audio Visualization

### Overview

**Problem**: Standard waveform is boring and doesn't convey clinical urgency

**Solution**: Dynamic visualization that reflects patient vitality, with haptic feedback for critical events

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIO INPUT (MICROPHONE)                      │
│  ┌────────────────┐     ┌────────────────┐     ┌──────────────┐
│  │ PCM Stream     │────▶│ RMS Calculation│────▶│ FFT Analysis │
│  └────────────────┘     └────────────────┘     └──────────────┘
└───────────────────────────────┼────────────────────────────────┘
                                │
                                │ Audio Data
                                │
┌───────────────────────────────▼────────────────────────────────┐
│              VITALITY MAPPING ENGINE                            │
│  ┌────────────────────────────────────────────────────────────┐
│  │  O2 Sat: 86% → COLOR: Red (critical)                      │
│  │  HR: 120 bpm → PULSE RATE: Fast                           │
│  │  BP: 140/90 → GRADIENT: Yellow-Orange                     │
│  └────────────────────────────────────────────────────────────┘
└───────────────────────────────┼────────────────────────────────┘
                                │
                                │ Visualization Parameters
                                │
┌───────────────────────────────▼────────────────────────────────┐
│                   CANVAS RENDERER                               │
│  ┌────────────────────────────────────────────────────────────┐
│  │  [Vitality Meter Visualization]                            │
│  │                                                             │
│  │     ████████                                                │
│  │    ██      ██     ← Circular waveform                      │
│  │   ██  ●    ██       Color shifts red → blue                │
│  │    ██      ██       Pulse rate matches HR                  │
│  │     ████████                                                │
│  │                                                             │
│  │  Background blur: intensity = O2 deviation                 │
│  └────────────────────────────────────────────────────────────┘
└───────────────────────────────┼────────────────────────────────┘
                                │
                                │ Haptic Triggers
                                │
┌───────────────────────────────▼────────────────────────────────┐
│                    HAPTIC FEEDBACK                              │
│  Critical Alert: ████ (Long pulse)                            │
│  Vital Change:   ██   (Short pulse)                           │
│  Barge-In:       █    (Confirmation tap)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Visualization Types

#### 1. Vitality Meter (Recommended)

- **Appearance**: Circular audio-reactive visualization
- **Color Mapping**: 
  - O2 > 95%: Blue (stable)
  - O2 88-94%: Yellow (caution)
  - O2 < 88%: Red (critical)
- **Animation**: Pulse rate matches patient HR
- **Background**: Blur intensity increases as patient decompensates

#### 2. Waveform (Classic)

- **Appearance**: Horizontal waveform
- **Color**: Shifts based on vital trends
- **Animation**: Smoothed, responsive

#### 3. Spectrum (Frequency)

- **Appearance**: Vertical bars (frequency spectrum)
- **Color**: Gradient based on patient state
- **Animation**: Reactive to voice frequency

#### 4. Particle System

- **Appearance**: Particle cloud
- **Behavior**: Particles scatter when critically ill, coalesce when stable
- **Color**: Reflects vitals

### Haptic Feedback Patterns

| Event | Pattern | Intensity | Duration |
|-------|---------|-----------|----------|
| **Patient Speaking** | None | 0 | - |
| **Critical Alert** | Long pulse | 1.0 | 500ms |
| **Vital Change** | Short pulse | 0.7 | 200ms |
| **Barge-In** | Confirmation tap | 0.5 | 100ms |
| **HR Sync** | Rhythmic pulse | 0.3 | Continuous |

### Example Configuration

```typescript
const vizConfig: AudioVisualizationConfig = {
  type: 'vitality_meter',
  colorScheme: {
    primary: '#3b82f6',    // Blue
    secondary: '#8b5cf6',  // Purple
    alert: '#ef4444',      // Red
    stable: '#10b981',     // Green
  },
  matchSystemTheme: true,
  backgroundBlur: {
    enabled: true,
    intensity: 10,         // 0-20 px
    darkOverlay: 0.3,      // 0-1
  },
  vitalityMapping: {
    enabled: true,
    vitalEffects: {
      o2sat: {
        threshold: { critical: 88, warning: 92, normal: 95 },
        effect: 'color_shift'   // Blue → Yellow → Red
      },
      hr: {
        threshold: { critical: 120, warning: 100, normal: 80 },
        effect: 'pulse_rate'    // Animation speed
      },
      bp: {
        threshold: { critical: '90/60', warning: '100/70', normal: '120/80' },
        effect: 'color_gradient'
      }
    }
  },
  hapticFeedback: {
    enabled: true,
    eventPatterns: {
      patientSpeaking: 'none',
      criticalAlert: 'alarm',
      vitalChange: 'warning',
      bargeIn: 'confirmation'
    },
    intensity: 0.7
  },
  animation: {
    smoothing: 0.8,        // 0-1 (higher = smoother)
    responsiveness: 0.6    // 0-1 (higher = more reactive)
  }
};
```

---

## Timing Analytics (echoscript + echo_paths)

### Overview

**Problem**: No visibility into student's decision-making process and efficiency

**Solution**: Track every question, action, and decision with timing metrics. Visualize conversation tree to identify efficient vs. wasteful paths.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       OSCE SESSION                               │
│  Student asks: "What brings you in today?" [t=0s]               │
│  Patient: "Chest pain"                        [t=3s]             │
│  Student asks: "Can you describe it?"         [t=5s]             │
│  Patient: "Crushing, substernal"              [t=8s]             │
│  Student asks: "What's your typical diet?"    [t=10s] ← Rabbit hole!
│  Patient: "I eat pretty healthy..."           [t=13s]            │
│  Student orders: ECG                          [t=45s]            │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            │ Real-time Tracking
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                 TIMING ANALYTICS ENGINE                         │
│  ┌────────────────────────────────────────────────────────────┐
│  │  Metrics:                                                   │
│  │  - Time to recognize STEMI: 45s (Target: 60s) ✅          │
│  │  - Time to ECG order: 45s (Target: 10min) ✅              │
│  │  - Questions asked: 3 (Optimal: 5)                        │
│  │  - Rabbit holes: 1 (Diet question, 3s wasted)             │
│  └────────────────────────────────────────────────────────────┘
└───────────────────────────┼────────────────────────────────────┘
                            │
                            │ Visualization Data
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                   ECHO PATH VISUALIZATION                       │
│  ┌────────────────────────────────────────────────────────────┐
│  │                                                             │
│  │  [Chief Complaint] ───────────────────┐                   │
│  │         │                              │                   │
│  │         ▼                              ▼                   │
│  │  [Describe pain] ✅           [Typical diet?] ❌          │
│  │   Optimal path                  Rabbit hole               │
│  │         │                         3s wasted               │
│  │         ▼                                                  │
│  │  [Radiation?] ✅                                          │
│  │         │                                                  │
│  │         ▼                                                  │
│  │  [Order ECG] ✅                                           │
│  │                                                             │
│  │  Green = Optimal path                                     │
│  │  Red = Rabbit hole                                        │
│  │  Efficiency Score: 75/100                                 │
│  └────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Timing Metric Categories

| Category | Examples | Significance |
|----------|----------|--------------|
| **Recognition** | Time to recognize STEMI, sepsis, shock | ⚠️ Critical |
| **Action** | Time to ECG, antibiotics, intubation | ⚠️ Critical |
| **Diagnosis** | Time to correct diagnosis | Important |
| **Intervention** | Time to start treatment | Important |
| **Communication** | Time spent on history | Routine |
| **Decision** | Time deliberating on management | Routine |

### Echo Path Analysis

**Optimal Path** (Green):
```
Chief Complaint → Describe pain → Radiation → Risk factors → Order ECG
5 nodes, 45 seconds
```

**Actual Path** (Mixed):
```
Chief Complaint → Describe pain → Typical diet? → Radiation → Order ECG
6 nodes, 48 seconds
Rabbit hole: "Typical diet?" (low relevance, 3s wasted)
```

**Efficiency Score**:
```
Efficiency = (Optimal Steps / Actual Steps) × 100
           = (5 / 6) × 100
           = 83%
```

### Example Usage

```typescript
const service = createTimingAnalyticsService();

// Start session
service.startSession(sessionId, 'stemi-case-001');

// Start recognition metric
const recognitionId = service.startMetric(
  sessionId,
  'Time to recognize STEMI',
  'recognition',
  'critical',
  60  // Target: 60 seconds
);

// Record questions (echo path nodes)
const node1 = service.recordConversationNode(
  sessionId,
  'question',
  'What brings you in today?',
  undefined,
  0.9  // Relevance: 0-1
);

const node2 = service.recordConversationNode(
  sessionId,
  'question',
  'Can you describe the pain?',
  node1,
  0.95
);

// Rabbit hole!
const node3 = service.recordConversationNode(
  sessionId,
  'question',
  'What does your typical diet look like?',
  node2,
  0.2  // Low relevance
);

// End recognition metric
service.endMetric(sessionId, recognitionId);
service.recordMilestone(sessionId, 'STEMI Recognized', 60, true);

// End session
const analytics = await service.endSession(sessionId);

console.log('Efficiency Score:', analytics.echoPath.efficiencyScore);
console.log('Rabbit Holes:', analytics.echoPath.rabbitHoles);
// Rabbit Holes: [{ startNodeId: 'node3', timeWasted: 3, reason: 'Excessive focus on lifestyle factors' }]
```

---

## Automated Case Files

### Overview

**Problem**: Students get a grade but no personalized learning artifact

**Solution**: Generate comprehensive case file with transcript, notes, analytics, and tailored teaching points

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED CASE FILE                           │
│                                                                  │
│  1. CASE DETAILS                                                │
│     Patient: John Smith, 55yo M                                 │
│     Chief Complaint: Chest pain                                 │
│     Diagnosis: ST-Elevation Myocardial Infarction (STEMI)      │
│                                                                  │
│  2. TRANSCRIPT                                                  │
│     [00:00] Student: What brings you in today?                  │
│     [00:03] Patient: I have terrible chest pain...              │
│     [00:45] Student: I need to order an ECG.                   │
│                                                                  │
│  3. SOAP NOTE COMPARISON                                        │
│     ┌──────────────────┐  ┌──────────────────┐               │
│     │ Your Note        │  │ Gold Standard    │               │
│     │ Score: 65/100    │  │                  │               │
│     └──────────────────┘  └──────────────────┘               │
│                                                                  │
│  4. TIMING ANALYTICS                                            │
│     Time to Recognition: 45s ✅ (Target: 60s)                  │
│     Time to ECG: 45s ✅                                        │
│     Efficiency Score: 83%                                       │
│     Rabbit Holes: 1 (Diet question)                            │
│                                                                  │
│  5. CLINICAL PERFORMANCE                                        │
│     Overall: 78/100                                            │
│     History: 85/100 ✅                                         │
│     Physical Exam: 70/100                                      │
│     Diagnosis: 90/100 ✅                                       │
│     Management: 75/100                                         │
│                                                                  │
│  6. PERSONALIZED PEARLS                                        │
│     💡 Missed Finding: JVD assessment                          │
│        Always assess for RV involvement in inferior MI          │
│                                                                  │
│     💡 Inefficient Questioning: Diet history                   │
│        Focus on OPQRST in acute chest pain                     │
│                                                                  │
│     💡 [Infographic]: STEMI vs. NSTEMI Comparison             │
│        [Dynamic infographic embedded]                           │
│                                                                  │
│  7. AI TUTOR INSIGHTS                                          │
│     Key Teaching Points:                                       │
│     - Inferior MI can involve RV (check V4R)                   │
│     - Before nitrates, rule out PDE-5 inhibitor use           │
│     - Time is muscle: door-to-balloon < 90 min                │
│                                                                  │
│     Recommended Reading:                                        │
│     - Harrison's Ch. 296: Acute MI (p. 2051-2065)             │
│     - AHA 2023 STEMI Guidelines                                │
│                                                                  │
│     Similar Cases to Review:                                    │
│     - Right ventricular infarction                             │
│     - Posterior MI                                             │
│     - Atypical MI presentations                                │
│                                                                  │
│  [Export as PDF] [Export as JSON] [Share with Faculty]        │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Generate automated case file
const caseFile = await generateAutomatedCaseFile(
  sessionId,
  {
    patientName: 'John Smith',
    chiefComplaint: 'Chest pain',
    diagnosis: 'STEMI',
    specialty: 'Cardiology'
  },
  {
    correctDiagnosis: true,
    essentialQuestionsAsked: ['chest pain character', 'radiation'],
    criticalFindingsMissed: ['JVD assessment'],
    timeToAction: 45
  }
);

// Export formats
const pdfUrl = caseFile.exportFormats.pdf;
const jsonData = caseFile.exportFormats.json;
```

---

## Integration Architecture

### Unified Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    PANACEA STUDENT DASHBOARD                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐
│  │  ACTIVE OSCE SESSION (Module 1 + Module 4)                 │
│  │  ┌──────────────────┐  ┌──────────────────┐               │
│  │  │ Patient Video    │  │ AI Tutor Sidebar │               │
│  │  │ (Veo Cameos)     │  │ (ask_the_manual) │               │
│  │  │                  │  │                  │               │
│  │  │ [Levine Sign]    │  │ "This patient    │               │
│  │  │                  │  │  is showing...   │               │
│  │  └──────────────────┘  └──────────────────┘               │
│  │                                                             │
│  │  ┌──────────────────────────────────────────────────────┐ │
│  │  │ Audio Visualization (Vitality Meter)                  │ │
│  │  │  ████████     ← Red (O2 = 86%)                       │ │
│  │  │ ██      ██                                            │ │
│  │  │ ██  ●    ██    [Haptic: Critical Alert]             │ │
│  │  │  ██      ██                                           │ │
│  │  │   ████████                                            │ │
│  │  └──────────────────────────────────────────────────────┘ │
│  │                                                             │
│  │  ┌──────────────────────────────────────────────────────┐ │
│  │  │ Real-Time SOAP Note Draft (Background)                │ │
│  │  │ Subjective: 55yo M with sudden onset crushing...     │ │
│  │  │ [Auto-updating every 5s]                              │ │
│  │  └──────────────────────────────────────────────────────┘ │
│  └────────────────────────────────────────────────────────────┘
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐
│  │  POST-ENCOUNTER REVIEW                                     │
│  │  ┌──────────────────┐  ┌──────────────────┐               │
│  │  │ SOAP Comparison  │  │ Timing Analytics │               │
│  │  │ [Side-by-side]   │  │ [Echo Path]      │               │
│  │  └──────────────────┘  └──────────────────┘               │
│  │                                                             │
│  │  ┌────────────────────────────────────────────────────┐   │
│  │  │ Dynamic Remediation                                 │   │
│  │  │ [Infographic]: Inferior MI with RV Involvement     │   │
│  │  │ [Generated by info_genius]                          │   │
│  │  └────────────────────────────────────────────────────┘   │
│  │                                                             │
│  │  [Download Case File PDF] [Review AI Tutor Insights]      │
│  └────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Cross-Module Data Flow

```
Module 1 (OSCE) ──┬──> Transcript ────> Module 4 (SOAP Generator)
                  │
                  ├──> Audio Stream ──> Module 4 (Enhanced Viz)
                  │
                  ├──> Questions ─────> Module 4 (Timing Analytics)
                  │
                  └──> Student Answer ─> Module 4 (Infographic Generator)

AI Tutor ─────────────> Citations ─────> Module 4 (Case File)
```

---

## Implementation Roadmap

### Phase 1: Auto-Scribe (Weeks 1-2)

- [ ] Implement SOAPNoteService
- [ ] Test gemini-dictation integration
- [ ] Create real-time SOAP generator
- [ ] Build comparison UI (side-by-side)
- [ ] Deploy to staging

### Phase 2: Timing Analytics (Week 3)

- [ ] Implement TimingAnalyticsService
- [ ] Add echoscript integration
- [ ] Build echo path visualization
- [ ] Create efficiency score algorithm
- [ ] Test with 5 pilot cases

### Phase 3: Dynamic Infographics (Week 4)

- [ ] Implement InfoGraphicService
- [ ] Test info_genius API
- [ ] Generate 20 high-yield comparison infographics
- [ ] Build interactive SVG viewer
- [ ] Deploy infographic library

### Phase 4: Enhanced Audio Viz (Week 5)

- [ ] Implement vitality meter visualization
- [ ] Add haptic feedback support
- [ ] Test color shifting based on vitals
- [ ] Add background blur effects
- [ ] Mobile optimization

### Phase 5: Automated Case Files (Week 6)

- [ ] Implement case file generator
- [ ] Create PDF export functionality
- [ ] Build personalized pearls engine
- [ ] Test end-to-end workflow
- [ ] User acceptance testing

---

## File Manifest

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **Types** | `types/smart-scribe-system.ts` | 850 | All Module 4 types |
| **SOAP Service** | `services/scribe/soapNoteService.ts` | 680 | Real-time note generation |
| **Infographic Service** | `services/scribe/infographicService.ts` | 420 | Dynamic graphics |
| **Timing Service** | `services/analytics/timingAnalyticsService.ts` | 580 | echoscript/echo_paths |
| **Documentation** | `docs/MODULE_4_SMART_SCRIBE_ARCHITECTURE.md` | 1,800 | This document |

**Total**: ~4,330 lines

---

## Success Metrics

### SOAP Note Quality

| Metric | Target |
|--------|--------|
| **AI Completeness** | > 90% |
| **Student Completeness** | > 70% |
| **Comparison Accuracy** | > 95% |
| **Missing Element Detection** | 100% |

### Timing Analytics

| Metric | Target |
|--------|--------|
| **Echo Path Efficiency** | > 75% |
| **Rabbit Hole Detection** | > 90% |
| **Critical Action Timeliness** | > 80% |
| **Visualization Accuracy** | > 95% |

### Infographics

| Metric | Target |
|--------|--------|
| **Generation Time** | < 10s |
| **Student Satisfaction** | > 8/10 |
| **Clarity Rating** | > 8/10 |
| **Pre-Generated Library** | 50+ infographics |

---

## Cost Estimate

| Service | Usage (per 1000 sessions) | Cost |
|---------|---------------------------|------|
| **gemini-dictation** | 100 hours transcription | $200 |
| **info_genius** | 500 infographics | $100 |
| **echoscript** | 1000 analytics sessions | $50 |
| **Audio processing** | 100 hours | $25 |
| **Storage (case files)** | 50GB | $10 |

**Total**: ~$385 per 1000 sessions (~$0.39 per session)

---

## Conclusion

Module 4 completes the PANaCEa ecosystem by automating documentation and providing dynamic, personalized learning aids. Students can focus on clinical reasoning while the AI handles the "grunt work" of note-taking and generates tailored visual explanations for their specific confusion points.

**Key Innovations:**
1. **Real-time SOAP generation** during encounters
2. **Side-by-side comparison** with gold standard
3. **Dynamic infographics** generated on-the-fly
4. **Enhanced audio visualization** with clinical vitality mapping
5. **Timing analytics** with conversation tree visualization
6. **Automated case files** as personalized learning artifacts

**Status**: ✅ Design Complete - Ready for Implementation

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
