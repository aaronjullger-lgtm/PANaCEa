# Module 1: Living Patient Encounter - A/V Systems Architecture

**Version:** 1.0.0  
**Date:** February 5, 2026  
**Status:** Design Complete - Implementation Pending

---

## Executive Summary

This document defines the **event-driven audio-visual (A/V) architecture** for Module 1: The Living Patient Encounter. The system synchronizes real-time voice interaction (Gemini `native_audio_function_call_sandbox`) with dynamic video loops (veo_cameos) based on clinical triggers derived from patient vitals and physical findings.

**Core Innovation:** A JSON-based state machine that maps clinical conditions (e.g., "O2 sat < 88%") to specific audio-visual states, creating a reactive, immersive patient simulation that responds to student actions and physiological changes.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [JSON State Machine](#json-state-machine)
3. [Clinical Trigger System](#clinical-trigger-system)
4. [Audio-Visual States](#audio-visual-states)
5. [Event-Driven Runtime](#event-driven-runtime)
6. [WebSocket Protocol](#websocket-protocol)
7. [Gemini Integration](#gemini-integration)
8. [Veo Cameos Integration](#veo-cameos-integration)
9. [Implementation Guide](#implementation-guide)
10. [Example: COPD Exacerbation Case](#example-copd-exacerbation-case)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React Client)                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │ AudioInterface  │  │ VideoPlayer      │  │ VitalsMonitor          │ │
│  │ (Mic, Barge-In) │  │ (Veo Loop)       │  │ (HR, O2, BP, etc.)     │ │
│  └────────┬────────┘  └────────┬─────────┘  └───────────┬────────────┘ │
│           │                    │                         │              │
└───────────┼────────────────────┼─────────────────────────┼──────────────┘
            │                    │                         │
            │         WebSocket (wss://voice.panacea.app)  │
            │                    │                         │
┌───────────▼────────────────────▼─────────────────────────▼──────────────┐
│               BACKEND (Cloudflare Durable Object)                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                 PatientVoiceSession (DO)                           │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │ │
│  │  │ PatientAVEngine  │  │ Gemini Connector │  │ Veo Generator   │ │ │
│  │  │ (State Machine)  │  │ (Audio I/O)      │  │ (Video Library) │ │ │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘ │ │
│  └───────────┼─────────────────────┼─────────────────────┼──────────┘ │
│              │                     │                     │              │
└──────────────┼─────────────────────┼─────────────────────┼──────────────┘
               │                     │                     │
     ┌─────────▼─────────┐  ┌────────▼────────┐  ┌────────▼────────┐
     │ Prisma/Postgres   │  │ Gemini API      │  │ Veo Cameos API  │
     │ (Session, Case)   │  │ (Voice+Persona) │  │ (Video Gen)     │
     └───────────────────┘  └─────────────────┘  └─────────────────┘
```

### Data Flow

1. **Client → Server**: Student asks question (audio PCM) or updates vitals
2. **Server**: PatientAVEngine evaluates clinical triggers
3. **Server**: If trigger activated → state transition
4. **Server → Gemini**: Update voice modulation (rate, pitch, tone)
5. **Server → Client**: Send state transition event + new video URL
6. **Client**: Crossfade to new video, update UI indicators
7. **Gemini → Client**: Stream AI patient response (audio)

---

## JSON State Machine

### Schema

See `types/patient-av-state-machine.ts` for full TypeScript definitions.

```typescript
interface PatientAVStateMachine {
  id: string;                    // Unique machine ID (caseId)
  version: string;               // Schema version
  initialState: string;          // Starting state ID
  states: Record<string, AVState>;
  globalTransitions: StateTransitionRule[];
  stateTransitions: Record<string, StateTransitionRule[]>;
  metadata: {
    caseId: string;
    patientName: string;
    chiefComplaint: string;
    createdAt: string;
    updatedAt: string;
  };
}
```

### AVState Definition

Each state defines:

- **Voice Modulation**: Voice ID, rate, pitch, volume, tone descriptors, background sounds
- **Video State**: Video ID, prompt, environment, transition type
- **Clinical Context**: Human-readable description
- **Auto-Transitions**: Rules for automatic state changes

```typescript
interface AVState {
  id: string;
  name: string;
  clinicalContext: string;
  voice: VoiceModulation;
  video: VideoState;
  systemPromptOverride?: string;
  autoTransitions?: StateTransitionRule[];
}
```

---

## Clinical Trigger System

### Trigger Anatomy

```typescript
interface ClinicalTrigger {
  id: string;                           // "hypoxia_severe"
  type: ClinicalTriggerType;            // "respiratory"
  severity: ClinicalSeverity;           // "severe"
  description: string;                  // Human-readable
  condition: ClinicalConditionExpression; // Evaluation logic
  priority: number;                     // 1-10 (higher = more urgent)
}
```

### Condition Expressions

Expressions are evaluated against:

- `vitals`: Current vitals from `PatientEncounterSession.physicalFindings.vitals`
- `physicalFindings`: JSON object with exam findings
- `studentActions`: Array of actions performed (e.g., "administer_oxygen")

**Example: Hypoxia Trigger**

```typescript
{
  id: "hypoxia_severe",
  type: "respiratory",
  severity: "severe",
  condition: {
    field: "vitals.o2",
    operator: "lt",
    value: 88
  },
  priority: 9
}
```

**Example: Combined Condition**

```typescript
{
  id: "chest_pain_with_diaphoresis",
  type: "pain",
  severity: "severe",
  condition: {
    operator: "and",
    conditions: [
      { field: "physicalFindings.painLocation", operator: "eq", value: "chest" },
      { field: "physicalFindings.painScale", operator: "gte", value: 7 },
      { field: "physicalFindings.diaphoresis", operator: "eq", value: true }
    ]
  },
  priority: 9
}
```

### Pre-Defined Trigger Library

See `types/patient-av-state-machine.ts` → `CLINICAL_TRIGGERS_LIBRARY`:

- `hypoxia_severe` (O2 < 88%)
- `hypoxia_moderate` (O2 88-92%)
- `tachycardia` (HR > 100)
- `pain_severe_chest` (chest pain ≥7/10)
- `agitation` (mental status: agitated/anxious)
- `fever_high` (temp > 102°F)

---

## Audio-Visual States

### Voice Modulation

Gemini `native_audio_function_call_sandbox` supports:

- **Voice Library IDs**: "Kore", "Puck", "Charon", "Aoede"
- **Speech Rate**: 0.5 - 2.0 (1.0 = normal)
- **Pitch**: -12 to +12 semitones
- **Volume**: 0.0 - 1.0
- **Tone Descriptors**: Injected into system prompt (e.g., "breathless", "panicked")

**Example: Severe Hypoxia Voice**

```typescript
{
  voiceId: "Kore",
  rate: 0.7,              // Slow speech (gasping)
  pitch: 2,               // Slightly higher pitch (strain)
  volume: 0.6,            // Quieter (weak)
  toneDescriptors: ["gasping", "panicked", "breathless"],
  applyVocalStrain: true, // Post-processing distortion
  backgroundSounds: ["labored_breathing", "wheezing", "monitor_alarm"]
}
```

### Video States (Veo Cameos)

Each state has a corresponding 5-second video loop:

- **Prompt Template**: E.g., "60yo male in ED, severe dyspnea, tripod position, accessory muscle use"
- **Environment**: ED, clinic, home, ambulance
- **Physical Presentation**: Levine sign, tripod position, writhing, etc.
- **Transition Type**: `immediate`, `crossfade`, `medical_scan`

**Example: COPD Severe State Video**

```typescript
{
  videoId: "copd-severe-001",
  prompt: "60yo male in ED, severe dyspnea, tripod position, accessory muscle use, high-flow oxygen, monitor alarming",
  physicalPresentation: "Tripod position, accessory muscle use",
  environment: "emergency_department",
  duration: 5,
  transitionType: "medical_scan",  // Red scanner overlay effect
  transitionDuration: 1000,
  status: "ready"
}
```

---

## Event-Driven Runtime

### PatientAVEngine

Core responsibilities:

1. **Evaluate Triggers**: On vitals/findings update, evaluate all condition expressions
2. **Activate Triggers**: Emit `TRIGGER_ACTIVATED` events
3. **Execute Transitions**: Apply highest-priority matching transition rule
4. **Emit Events**: Notify listeners (WebSocket, logger, analytics)

**Key Methods:**

```typescript
class PatientAVEngine {
  updateVitals(vitals, physicalFindings): void;
  recordStudentAction(action): void;
  transition(toState, trigger?): void;
  on(listener: (event: AVEvent) => void): void;
}
```

### Event Types

- `STATE_ENTER` / `STATE_EXIT`
- `TRIGGER_ACTIVATED` / `TRIGGER_DEACTIVATED`
- `TRANSITION_COMPLETED`
- `VITALS_UPDATED`
- `STUDENT_ACTION`
- `VIDEO_GENERATED`

### Auto-Transitions

States can define auto-transition rules:

```typescript
{
  toState: "stabilized",
  triggers: [{ id: "oxygen_therapy_effective", ... }],
  cooldown: 30,           // Can't fire again for 30s
  reversible: true,       // Can revert if condition fails
  reversionCondition: { field: "vitals.o2", operator: "lt", value: 90 },
  requiresStudentAction: "administer_oxygen"
}
```

**Behavior:**

- If `vitals.o2 >= 92` AND student has performed "administer_oxygen" → transition to "stabilized"
- If O2 drops below 90 → auto-revert to previous state
- Cooldown prevents rapid oscillation

---

## WebSocket Protocol

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `audio` | Bidirectional | PCM audio chunks (base64 or binary) |
| `transcript` | Server → Client | Transcript segment |
| `barge_in` | Client → Server | Interrupt AI speech |
| `tts_start` / `tts_end` | Server → Client | TTS playback state |
| `av_state_sync` | Server → Client | Full state sync on connect |
| `av_state_transition` | Server → Client | State changed |
| `av_trigger_activated` | Server → Client | Trigger activated |
| `av_vitals_update` | Client → Server | Vitals changed |
| `av_student_action` | Client → Server | Student action performed |
| `av_video_ready` | Server → Client | Video URL available |

### Example: State Transition Message

```json
{
  "type": "av_state_transition",
  "timestamp": "2026-02-05T10:15:30.123Z",
  "payload": {
    "fromState": "mild_distress",
    "toState": "severe_hypoxia",
    "newStateDefinition": {
      "id": "severe_hypoxia",
      "voice": { "voiceId": "Kore", "rate": 0.7, ... },
      "video": { "videoId": "copd-severe-001", "videoUrl": "https://...", ... }
    },
    "trigger": {
      "id": "hypoxia_severe",
      "description": "Severe hypoxia (O2 sat < 88%)"
    },
    "transitionAnimation": {
      "type": "medical_scan",
      "duration": 1000
    }
  }
}
```

### Client Handling

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'av_state_transition') {
    // 1. Trigger transition animation
    playTransitionAnimation(msg.payload.transitionAnimation);
    
    // 2. Preload new video
    videoPlayer.preload(msg.payload.newStateDefinition.video.videoUrl);
    
    // 3. Update UI indicators (vitals, alerts)
    updateClinicalAlerts(msg.payload.trigger);
    
    // 4. Crossfade to new video
    videoPlayer.transitionTo(msg.payload.newStateDefinition.video.videoUrl);
  }
};
```

---

## Gemini Integration

### Native Audio Function Call Sandbox

**Endpoint**: `wss://generativelanguage.googleapis.com/ws/v1alpha.GenerativeService.BidiGenerateContent`

**Features:**

- Full-duplex audio streaming
- Barge-in support (interrupt TTS)
- Voice library selection
- Real-time voice modulation

### System Prompt Construction

```typescript
function buildSystemPrompt(
  patientName: string,
  chiefComplaint: string,
  currentState: AVState
): string {
  const toneDescriptors = currentState.voice.toneDescriptors.join(', ');
  
  return `You are ${patientName}, a patient presenting with ${chiefComplaint}.

Clinical State: ${currentState.clinicalContext}

Voice Characteristics: ${toneDescriptors}

Instructions:
- Respond naturally to the student's questions about your symptoms and history.
- Match your tone to your clinical state (${toneDescriptors}).
- If you are short of breath, keep answers brief and fragmented.
- Never break character or reveal your diagnosis directly.
- If the student interrupts you, stop speaking immediately.

Remember: You are a real patient. Be authentic, not a textbook.`;
}
```

### Voice Config Update

When state transitions occur, update Gemini voice config:

```typescript
geminiConnection.send(JSON.stringify({
  updateVoice: {
    voiceId: newState.voice.voiceId,
    rate: newState.voice.rate,
    pitch: newState.voice.pitch,
    volume: newState.voice.volume
  }
}));
```

---

## Veo Cameos Integration

### Video Generation Service

See `services/av/veoCameosService.ts`.

**Pre-Generation Strategy:**

1. On case creation, generate 3-5 key state videos (baseline, critical, stable)
2. Cache videos in CDN (Cloudflare R2 or similar)
3. Generate additional states on-demand if custom scenario

**Prompt Templates:**

```typescript
const VIDEO_PROMPT_TEMPLATES = {
  'copd_mild': '{{age}}yo {{gender}} in {{environment}}, sitting upright, mild dyspnea, nasal cannula, pursed-lip breathing, looking at camera',
  'copd_severe': '{{age}}yo {{gender}} in {{environment}}, severe dyspnea, tripod position, accessory muscle use, high-flow oxygen, monitor alarming',
  // ... 30+ templates
};
```

**API Call:**

```typescript
const response = await fetch('https://generativelanguage.googleapis.com/v1/models/veo-2:generate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${VEO_API_KEY}` },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      videoDuration: 5,
      loop: true,
      style: 'realistic',
      aspectRatio: '16:9'
    }
  })
});
```

### Reference Images for Consistent Appearance

Upload 1-2 reference images of a "patient" to maintain visual consistency across states:

```typescript
referenceImages: [
  "https://cdn.panacea.app/patients/copd-john-smith-reference.jpg"
]
```

---

## Implementation Guide

### Phase 1: Core Infrastructure (Week 1)

- [ ] Deploy Cloudflare Worker + Durable Object (`PatientVoiceSession`)
- [ ] Implement `PatientAVEngine` (condition evaluator, state machine runtime)
- [ ] Create WebSocket message protocol
- [ ] Add `PatientAVStateMachine` JSON column to `PatientEncounterCase` table

### Phase 2: Gemini Integration (Week 2)

- [ ] Connect to Gemini Multimodal Live API
- [ ] Implement voice modulation updates
- [ ] Test barge-in functionality
- [ ] Add transcript persistence to `PatientEncounterSession.messages`

### Phase 3: Veo Cameos Integration (Week 3)

- [ ] Implement `VeoCameosService`
- [ ] Generate pilot video library (10 common states)
- [ ] Add video URL caching (Cloudflare R2)
- [ ] Implement client-side video transition animations

### Phase 4: State Machine Authoring (Week 4)

- [ ] Create 5 pilot cases (COPD, MI, Stroke, Sepsis, Trauma)
- [ ] Define state machines with 3-5 states each
- [ ] Test trigger activation and auto-transitions
- [ ] Tune cooldowns and reversibility

### Phase 5: Polish & Testing (Week 5)

- [ ] Add latency monitoring (echoscript)
- [ ] Implement "Invisible Preceptor" analytics (echo_paths)
- [ ] Load testing (20 concurrent sessions)
- [ ] User acceptance testing with PA students

---

## Example: COPD Exacerbation Case

### State Machine Definition

See `types/patient-av-state-machine.ts` → `EXAMPLE_COPD_STATE_MACHINE`.

**States:**

1. **mild_distress** (Initial)
   - Voice: Slightly breathless, concerned
   - Video: Pursed-lip breathing, nasal cannula
   - Transitions: → `severe_hypoxia` if O2 < 88%

2. **severe_hypoxia** (Critical)
   - Voice: Gasping, panicked (rate=0.7, pitch=+2)
   - Video: Tripod position, accessory muscles
   - System Prompt: "You can only speak 2-3 words at a time"
   - Transitions: → `stabilized` if O2 ≥ 92% AND oxygen administered

3. **stabilized** (Post-Intervention)
   - Voice: Relieved, tired
   - Video: Relaxed posture, improved breathing
   - Reversible: → `severe_hypoxia` if O2 drops below 90%

### Trigger Flow

1. **Initial State**: `mild_distress` (O2 = 92%, patient mildly anxious)
2. **Student Questions**: "Can you describe your breathing?"
   - Patient (AI): "It's... it's hard to catch my breath. It started this morning."
3. **Vitals Worsening**: O2 drops to 86% (simulation)
4. **Trigger Activated**: `hypoxia_severe` (priority 9)
5. **State Transition**: `mild_distress` → `severe_hypoxia`
6. **Client Receives**: `av_state_transition` message
7. **Video Crossfades**: Pursed-lip breathing → Tripod position
8. **Voice Updates**: Gemini switches to gasping, slow speech
9. **Student Action**: Orders high-flow oxygen
10. **Action Recorded**: `recordStudentAction("administer_oxygen")`
11. **O2 Improves**: Vitals updated to O2 = 94%
12. **Trigger Activated**: `oxygen_therapy_effective`
13. **State Transition**: `severe_hypoxia` → `stabilized`
14. **Video Crossfades**: Tripod position → Relaxed posture
15. **Voice Updates**: Gemini switches to relieved, normal rate
16. **Patient (AI)**: "Oh... that's better. Thank you. I can breathe now."

### Analytics Output (Invisible Preceptor)

Using `echoscript`:

- **Time to O2 Order**: 45 seconds (Target: < 60s)
- **Time to Recognize Hypoxia**: 12 seconds (Excellent)
- **Questions Asked During Crisis**: 2 (Good - focused on intervention)
- **Unnecessary Questions**: 0 (Excellent efficiency)

---

## Appendix: File Locations

| Component | Path |
|-----------|------|
| **Type Definitions** | `types/patient-av-state-machine.ts` |
| **State Machine Engine** | `services/av/patientAVEngine.ts` |
| **Veo Cameos Service** | `services/av/veoCameosService.ts` |
| **Durable Object** | `worker/src/PatientVoiceSession.ts` |
| **Audio Interface (React)** | `components/osce/AudioInterface.tsx` |
| **WebSocket Message Protocol** | `types/patient-av-state-machine.ts` (see AVWebSocketMessage) |

---

## Next Steps

1. **Review this architecture** with the development team
2. **Prototype a single state machine** (COPD case) in isolation
3. **Test voice modulation** with Gemini API in Postman/Insomnia
4. **Generate pilot videos** with veo_cameos (use cartoon style for faster iteration)
5. **Deploy Durable Object** to Cloudflare (staging environment)
6. **Integrate with existing OSCE infrastructure** (`PatientEncounterMode.tsx`)

---

**Document Maintainer**: A/V Systems Architect  
**Last Updated**: February 5, 2026  
**Status**: ✅ Design Complete - Ready for Implementation
