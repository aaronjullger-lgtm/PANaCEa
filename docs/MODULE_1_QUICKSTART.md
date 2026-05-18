# Module 1: Living Patient Encounter - Quick Start Guide

**For Developers & Content Creators**

---

## TL;DR

Module 1 uses a **JSON State Machine** to synchronize voice (Gemini) + video (Veo) based on clinical triggers.

```
O2 sat < 88% → Trigger "hypoxia_severe" → Transition to "severe_hypoxia" state
  ↓
Voice: Gasping, slow speech, high pitch
Video: Tripod position, accessory muscle use
System Prompt: "You can only speak 2-3 words at a time"
```

---

## Creating Your First Case

### 1. Define States

```typescript
const states = {
  baseline: {
    id: "baseline",
    name: "Stable Baseline",
    clinicalContext: "Patient is stable, speaking in full sentences",
    voice: {
      voiceId: "Kore",
      rate: 1.0,
      pitch: 0,
      volume: 0.9,
      toneDescriptors: ["calm", "cooperative"],
      applyVocalStrain: false,
    },
    video: {
      videoId: "stable-001",
      prompt: "50yo male in ED, sitting upright, calm, making eye contact",
      environment: "emergency_department",
      duration: 5,
      transitionType: "immediate",
      transitionDuration: 0,
      status: "ready",
    },
  },
  critical: {
    id: "critical",
    name: "Critical Decompensation",
    clinicalContext: "Patient is decompensating rapidly",
    voice: {
      voiceId: "Kore",
      rate: 0.6,
      pitch: 3,
      volume: 0.5,
      toneDescriptors: ["gasping", "panicked", "weak"],
      applyVocalStrain: true,
      backgroundSounds: ["labored_breathing", "monitor_alarm"],
    },
    video: {
      videoId: "critical-001",
      prompt: "50yo male in ED, severe distress, tripod position, gasping",
      environment: "emergency_department",
      duration: 5,
      transitionType: "medical_scan",
      transitionDuration: 1000,
      status: "ready",
    },
    systemPromptOverride: "You are in severe distress. You can only speak 1-2 words at a time before gasping for air. You are terrified.",
  },
};
```

### 2. Define Triggers

```typescript
const triggers = {
  hypoxia: {
    id: "hypoxia_critical",
    type: "respiratory",
    severity: "critical",
    description: "O2 saturation dangerously low",
    condition: {
      field: "vitals.o2",
      operator: "lt",
      value: 85,
    },
    priority: 10,
  },
};
```

### 3. Define Transitions

```typescript
const globalTransitions = [
  {
    toState: "critical",
    triggers: [triggers.hypoxia],
    cooldown: 0,
    reversible: true,
    reversionCondition: {
      operator: "and",
      conditions: [
        { field: "vitals.o2", operator: "gte", value: 92 },
        { field: "studentActions", operator: "contains", value: "administer_oxygen" },
      ],
    },
  },
];
```

### 4. Assemble State Machine

```typescript
const stateMachine: PatientAVStateMachine = {
  id: "case-mi-001",
  version: "1.0.0",
  initialState: "baseline",
  states,
  globalTransitions,
  stateTransitions: {},
  metadata: {
    caseId: "case-mi-001",
    patientName: "John Doe",
    chiefComplaint: "Chest pain",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};
```

### 5. Generate Videos

```typescript
import { createVeoCameosService } from '@/services/av/veoCameosService';

const veoService = createVeoCameosService(process.env.VEO_API_KEY!);

const demographics = {
  age: 50,
  gender: 'male' as const,
};

// Pre-generate video library
await veoService.preGenerateLibrary(
  demographics,
  'emergency_department',
  ['stable-001', 'critical-001']
);
```

### 6. Save to Database

```typescript
await prisma.patientEncounterCase.create({
  data: {
    id: 'case-mi-001',
    patientName: 'John Doe',
    chiefComplaint: 'Chest pain',
    age: 50,
    sex: 'M',
    vitalSigns: { hr: 110, bp: '140/90', temp: 98.6, rr: 22, o2sat: 94 },
    historyData: { /* ... */ },
    physicalExamData: { /* ... */ },
    labData: { /* ... */ },
    essentialQuestions: ['chest pain character', 'radiation', 'onset'],
    helpfulQuestions: ['cardiac history', 'risk factors'],
    unnecessaryQuestions: ['sleep habits', 'diet'],
    correctDiagnosis: 'Acute Myocardial Infarction',
    differentialDiagnoses: ['GERD', 'Pulmonary Embolism', 'Aortic Dissection'],
    idealWorkup: ['ECG', 'Troponin', 'CXR'],
    teachingPoints: ['Time is muscle', 'STEMI criteria'],
    // NEW: State machine JSON
    stateMachine: stateMachine as any,
  },
});
```

---

## Testing the State Machine

### Unit Test (Engine Only)

```typescript
import { PatientAVEngine } from '@/services/av/patientAVEngine';

const engine = new PatientAVEngine(stateMachine);

// Subscribe to events
engine.on((event) => {
  console.log(`Event: ${event.type}`, event.payload);
});

// Simulate vitals update
engine.updateVitals({ o2: 84 });

// Check current state
console.log(engine.getCurrentAVState().name); // "Critical Decompensation"

// Simulate student action
engine.recordStudentAction('administer_oxygen');

// Update vitals again
engine.updateVitals({ o2: 94 });

// Check current state
console.log(engine.getCurrentAVState().name); // "Stable Baseline" (reverted)
```

### Integration Test (WebSocket)

```typescript
const ws = new WebSocket('wss://voice.panacea.app/voice/session-123?token=xyz');

ws.onopen = () => {
  console.log('Connected to voice session');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'av_state_transition') {
    console.log(`State changed: ${msg.payload.fromState} → ${msg.payload.toState}`);
    console.log(`New video: ${msg.payload.newStateDefinition.video.videoUrl}`);
  }
};

// Simulate vitals update
ws.send(JSON.stringify({
  type: 'av_vitals_update',
  timestamp: new Date().toISOString(),
  payload: {
    vitals: { o2: 84 }
  }
}));
```

---

## Voice Modulation Cheat Sheet

| Clinical State | Rate | Pitch | Volume | Tone Descriptors |
|----------------|------|-------|--------|------------------|
| **Stable** | 1.0 | 0 | 0.9 | calm, cooperative |
| **Mild Distress** | 0.9 | 0 | 0.8 | slightly breathless, concerned |
| **Severe Distress** | 0.7 | +2 | 0.6 | gasping, panicked, breathless |
| **Pain** | 0.8 | +1 | 0.7 | grimacing, tense, short answers |
| **Confused** | 0.8 | -1 | 0.7 | disoriented, slow, uncertain |
| **Agitated** | 1.2 | +1 | 0.9 | irritable, demanding, loud |

---

## Video Prompt Templates

### Respiratory States

```
Baseline:     "{{age}}yo {{gender}} in ED, sitting upright, nasal cannula, calm"
Mild Dyspnea: "{{age}}yo {{gender}} in ED, mild dyspnea, pursed-lip breathing"
Severe:       "{{age}}yo {{gender}} in ED, tripod position, accessory muscles, gasping"
```

### Cardiovascular States

```
Baseline:     "{{age}}yo {{gender}} in ED, sitting on bed, cardiac monitor visible"
Chest Pain:   "{{age}}yo {{gender}} in ED, clutching chest, Levine sign, diaphoresis"
Shock:        "{{age}}yo {{gender}} in ED, pale, diaphoretic, altered mental status"
```

### Neurological States

```
Baseline:     "{{age}}yo {{gender}} in ED, alert, making eye contact"
Stroke:       "{{age}}yo {{gender}} in ED, facial droop, arm weakness, confused"
Seizure:      "{{age}}yo {{gender}} in ED, postictal, disoriented, side-lying"
```

---

## Common Pitfalls

### 1. Trigger Priority Conflicts

**Problem**: Multiple triggers activate simultaneously.

**Solution**: Assign priorities (1-10). Highest priority wins.

```typescript
{
  id: "cardiac_arrest",
  priority: 10  // Takes precedence over everything
}
```

### 2. Oscillating States

**Problem**: State transitions back and forth rapidly (e.g., O2 = 91%, oscillates between 89-93%).

**Solution**: Use cooldowns and hysteresis (different thresholds for transition vs. reversion).

```typescript
{
  toState: "severe_hypoxia",
  triggers: [{ condition: { field: "vitals.o2", operator: "lt", value: 88 } }],
  cooldown: 30,  // Can't fire again for 30s
  reversible: true,
  reversionCondition: { field: "vitals.o2", operator: "gte", value: 92 }  // Different threshold
}
```

### 3. Video Generation Lag

**Problem**: Video takes 30-60s to generate, causes UI lag.

**Solution**: Pre-generate videos during case creation. Store URLs in state machine JSON.

```typescript
// During case creation
const videos = await veoService.preGenerateLibrary(demographics, 'emergency_department', stateIds);

// Update state machine with URLs
for (const [stateId, video] of videos.entries()) {
  stateMachine.states[stateId].video.videoUrl = video.videoUrl;
  stateMachine.states[stateId].video.status = 'ready';
}
```

### 4. System Prompt Conflicts

**Problem**: State-specific prompt overrides are too long, cause Gemini to ignore them.

**Solution**: Keep overrides concise (<100 words). Focus on tone/speech pattern changes only.

```typescript
// BAD (too prescriptive)
systemPromptOverride: "You are a 60yo male with COPD. You have a 40-pack-year smoking history. Your symptoms started 3 days ago with increased dyspnea and purulent sputum. You are allergic to penicillin. You take albuterol and Advair. You are married with 2 children..."

// GOOD (focused on behavior)
systemPromptOverride: "You are severely short of breath. You can only speak 2-3 words at a time before gasping. You are scared and struggling to breathe."
```

---

## Advanced: Custom Transition Animations

### Client-Side Implementation

```typescript
// components/osce/AVTransitionLayer.tsx
function playTransitionAnimation(type: TransitionType, duration: number) {
  switch (type) {
    case 'immediate':
      // Instant cut
      return;
      
    case 'crossfade':
      // Fade out current video, fade in new video
      currentVideoRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration,
        fill: 'forwards',
      });
      newVideoRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration,
        fill: 'forwards',
      });
      break;
      
    case 'medical_scan':
      // Red scanner overlay effect (like medical diagnostic)
      const scanLine = document.createElement('div');
      scanLine.className = 'scan-line';
      scanLine.animate([{ top: '0%' }, { top: '100%' }], {
        duration,
        easing: 'ease-in-out',
      });
      break;
  }
}
```

---

## Debugging Tools

### 1. Event Logger

```typescript
engine.on((event) => {
  console.log(`[${event.type}] ${event.timestamp}`, event.payload);
});
```

### 2. State Inspector

```typescript
console.log('Current State:', engine.getCurrentAVState());
console.log('Active Triggers:', engine.getState().activeTriggers);
console.log('State History:', engine.getState().stateHistory);
```

### 3. Condition Evaluator Tester

```typescript
import { evaluateCondition } from '@/services/av/patientAVEngine';

const context = {
  vitals: { o2: 85, hr: 120 },
  physicalFindings: { lungSounds: 'wheezing' },
  studentActions: ['administer_oxygen'],
};

const condition = {
  operator: 'and',
  conditions: [
    { field: 'vitals.o2', operator: 'lt', value: 88 },
    { field: 'vitals.hr', operator: 'gt', value: 100 },
  ],
};

console.log(evaluateCondition(condition, context)); // true
```

---

## Resources

- **Full Architecture**: `docs/MODULE_1_AV_ARCHITECTURE.md`
- **Type Definitions**: `types/patient-av-state-machine.ts`
- **Engine Source**: `services/av/patientAVEngine.ts`
- **Veo Service**: `services/av/veoCameosService.ts`
- **Durable Object**: `worker/src/PatientVoiceSession.ts`

---

**Questions?** Open an issue in the PANaCEa repo or ping the A/V Systems team.
