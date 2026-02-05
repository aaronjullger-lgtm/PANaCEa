# PANaCEa: Refactor Implementation Guide

**Purpose:** Step-by-step guide to integrate new architecture with existing code  
**Date:** February 5, 2026

---

## Table of Contents

1. [Database Migration](#database-migration)
2. [App-Level Integration](#app-level-integration)
3. [PatientEncounterMode Enhancement](#patientencountermode-enhancement)
4. [Service Integration](#service-integration)
5. [Example: Before & After](#example-before-after)

---

## Database Migration

### Step 1: Update Prisma Schema

**File:** `prisma/schema.prisma`

```prisma
model PatientEncounterCase {
  id                      String                    @id
  patientName             String
  chiefComplaint          String
  age                     Int
  sex                     String
  vitalSigns              Json
  historyData             Json
  physicalExamData        Json
  labData                 Json
  essentialQuestions      String[]
  helpfulQuestions        String[]
  unnecessaryQuestions    String[]
  correctDiagnosis        String
  differentialDiagnoses   String[]
  idealWorkup             String[]
  teachingPoints          String[]
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime
  
  // NEW: Module 1 additions
  stateMachine            Json?                     // PatientAVStateMachine
  videoUrls               Json?                     // { baseline: url, critical: url }
  voiceConfig             Json?                     // { voiceId, personality }
  
  CaseRubric              CaseRubric?
  PatientEncounterSession PatientEncounterSession[]
}

// NEW: Module 5 models
model UserAvatar {
  id                  String   @id @default(uuid())
  userId              String   @unique
  stage               String   @default("student_year_1")
  equippedAccessories Json     @default("[]")
  xp                  Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  User                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserAchievement {
  id               String   @id @default(uuid())
  userId           String
  badgeId          String
  unlockedAt       DateTime @default(now())
  displayOnProfile Boolean  @default(true)
  User             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, badgeId])
  @@index([userId])
}

model PhantomPatient {
  id              String   @id @default(uuid())
  userId          String   @unique
  condition       String
  healthState     Int      @default(100)
  videoUrl        String?
  lastInteraction DateTime @default(now())
  updatedAt       DateTime @updatedAt
  User            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CaseFile {
  id                       String                    @id @default(uuid())
  sessionId                String                   @unique
  soapComparison           Json
  timingAnalytics          Json
  infographics             Json                      @default("[]")
  pdfUrl                   String?
  createdAt                DateTime                  @default(now())
  PatientEncounterSession  PatientEncounterSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

// Update User model to support new relations
model User {
  // ... existing fields ...
  UserAvatar         UserAvatar?
  UserAchievement    UserAchievement[]
  PhantomPatient     PhantomPatient?
}

model PatientEncounterSession {
  // ... existing fields ...
  CaseFile           CaseFile?
}
```

### Step 2: Create Migration

```bash
npx prisma migrate dev --name add_module_5_gamification
```

---

## App-Level Integration

### Step 1: Add SystemIntegrationProvider

**File:** `App.tsx`

```typescript
import { SystemIntegrationProvider } from '@/contexts/SystemIntegrationContext';
import { AdaptiveUIService } from '@/services/ui/adaptiveUIService';
import { useEffect, useState } from 'react';

function App() {
  const [uiMode, setUIMode] = useState<'focus' | 'review' | 'rest' | 'standard'>('standard');
  const [integration] = useState(() => createSystemIntegrationService());
  const [adaptiveUI] = useState(() => createAdaptiveUIService());

  // Initialize circadian UI
  useEffect(() => {
    async function initializeUI() {
      const profile = await loadUserCircadianProfile();
      const mode = adaptiveUI.determineUIMode(profile);
      setUIMode(mode);
      
      const theme = adaptiveUI.getThemeConfig(mode);
      adaptiveUI.applyTheme(theme);
    }
    
    initializeUI();
    
    // Update every 15 minutes
    const interval = setInterval(initializeUI, 900000);
    return () => clearInterval(interval);
  }, [adaptiveUI]);

  return (
    <SystemIntegrationProvider value={{ integration }}>
      <div className={`app-container ui-mode-${uiMode}`}>
        {/* Existing app content */}
        <Router>
          {/* ... routes ... */}
        </Router>
      </div>
    </SystemIntegrationProvider>
  );
}
```

### Step 2: Create Context

**File:** `contexts/SystemIntegrationContext.tsx` (new)

```typescript
import React, { createContext, useContext } from 'react';
import type { SystemIntegrationService } from '@/services/integration/systemIntegrationService';

interface SystemIntegrationContextValue {
  integration: SystemIntegrationService;
}

const SystemIntegrationContext = createContext<SystemIntegrationContextValue | null>(null);

export function SystemIntegrationProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode; 
  value: SystemIntegrationContextValue 
}) {
  return (
    <SystemIntegrationContext.Provider value={value}>
      {children}
    </SystemIntegrationContext.Provider>
  );
}

export function useSystemIntegration() {
  const context = useContext(SystemIntegrationContext);
  if (!context) {
    throw new Error('useSystemIntegration must be used within SystemIntegrationProvider');
  }
  return context;
}
```

---

## PatientEncounterMode Enhancement

### Step 1: Add State Machine Management

**File:** `components/modes/PatientEncounterMode.tsx`

**Add to imports:**
```typescript
import { PatientAVEngine } from '@/services/av/patientAVEngine';
import { AudioInterface } from '@/components/osce/AudioInterface';
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';
import type { PatientAVStateMachine } from '@/types/patient-av-state-machine';
```

**Add state:**
```typescript
// NEW: State machine for Module 1
const [avEngine, setAVEngine] = useState<PatientAVEngine | null>(null);
const [currentAVState, setCurrentAVState] = useState<string | null>(null);
const [wsUrl, setWsUrl] = useState<string | null>(null);

// NEW: Integration service
const { integration } = useSystemIntegration();
```

**Add initialization:**
```typescript
// Initialize state machine when case loads
useEffect(() => {
  if (!currentCase?.stateMachine) return;
  
  const stateMachine = currentCase.stateMachine as PatientAVStateMachine;
  const engine = new PatientAVEngine(stateMachine);
  
  // Subscribe to state transitions
  engine.on((event) => {
    if (event.type === 'TRANSITION_COMPLETED') {
      setCurrentAVState(engine.getCurrentAVState().id);
      
      // Emit to integration service
      integration.emit({
        type: 'MODULE_ENTERED',
        timestamp: new Date().toISOString(),
        sourceModule: 'osce',
        sessionId: session!.id!,
        payload: { stateTransition: event.payload }
      });
    }
  });
  
  setAVEngine(engine);
  setCurrentAVState(stateMachine.initialState);
}, [currentCase, integration, session]);

// Update state machine when vitals change
useEffect(() => {
  if (!avEngine) return;
  avEngine.updateVitals(vitals);
}, [vitals, avEngine]);
```

### Step 2: Add AudioInterface

**Add to render (before existing chat interface):**

```typescript
{/* NEW: Voice Mode (Module 1) */}
{wsUrl && (
  <div className="mb-4">
    <AudioInterface
      wsUrl={wsUrl}
      onSessionClose={(transcript) => {
        // Persist transcript
        saveOSCEChat(session!.id!, transcript.map((text, i) => ({
          role: i % 2 === 0 ? 'student' : 'patient',
          content: text,
          timestamp: new Date().toISOString()
        })), token);
      }}
      patientLabel={currentCase?.patientName ?? 'Patient'}
    />
  </div>
)}

{/* Toggle between voice and text */}
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setWsUrl(wsUrl ? null : `wss://voice.panacea.app/voice/${session?.id}?token=${token}`)}
    className="btn-secondary"
  >
    {wsUrl ? 'Switch to Text' : 'Switch to Voice'}
  </button>
</div>
```

### Step 3: Add Real-Time SOAP Draft Panel

**Add state:**
```typescript
const [soapService] = useState(() => createSOAPNoteService(GEMINI_API_KEY));
const [draftSOAP, setDraftSOAP] = useState<string | null>(null);
```

**Add initialization:**
```typescript
useEffect(() => {
  if (!session?.id) return;
  
  // Start real-time SOAP generation
  soapService.startRealtimeGeneration(session.id);
  
  // Update draft every 2 seconds
  const interval = setInterval(() => {
    const draft = soapService.getDraftNote(session.id);
    if (draft) {
      setDraftSOAP(formatSOAPNote(draft));
    }
  }, 2000);
  
  return () => clearInterval(interval);
}, [session, soapService]);

// Forward transcript to SOAP service
useEffect(() => {
  if (!session?.id) return;
  
  const latestMessage = session.questions[session.questions.length - 1];
  if (latestMessage) {
    soapService.addTranscript(
      session.id,
      latestMessage.role as 'student' | 'patient',
      latestMessage.response
    );
  }
}, [session?.questions, soapService]);
```

**Add to sidebar:**
```typescript
{/* NEW: Draft SOAP Note Panel */}
<div className="sidebar-panel">
  <h3 className="text-lg font-semibold mb-2">📝 Draft SOAP Note</h3>
  <div className="soap-draft-container text-sm">
    {draftSOAP ? (
      <pre className="whitespace-pre-wrap">{draftSOAP}</pre>
    ) : (
      <p className="text-muted">Note will appear as you interview...</p>
    )}
  </div>
  <p className="text-xs text-muted mt-2">Auto-updating in real-time</p>
</div>
```

### Step 4: Add Timing Analytics

**Add state:**
```typescript
const [timingService] = useState(() => createTimingAnalyticsService());
const [currentMetricId, setCurrentMetricId] = useState<string | null>(null);
```

**Track actions:**
```typescript
// When phase changes to diagnosis
useEffect(() => {
  if (phase === 'diagnosis' && session?.id && !currentMetricId) {
    const metricId = timingService.startMetric(
      session.id,
      'Time to diagnosis',
      'diagnosis',
      'critical',
      120 // 2 minutes target
    );
    setCurrentMetricId(metricId);
  }
}, [phase, session, currentMetricId, timingService]);

// When diagnosis submitted
const handleDiagnosisSubmit = (diagnosis: string) => {
  if (currentMetricId && session?.id) {
    timingService.endMetric(session.id, currentMetricId);
  }
  
  // Emit event
  integration.emit({
    type: 'DIAGNOSIS_MADE',
    timestamp: new Date().toISOString(),
    sourceModule: 'osce',
    sessionId: session!.id!,
    payload: {
      diagnosis,
      isCorrect: diagnosis === currentCase?.correctDiagnosis,
      timeToAction: Date.now() - session!.startTime
    }
  });
  
  // ... existing logic ...
};
```

---

## Service Integration

### Step 1: Enhance patientEncounterGenerator.ts

**File:** `services/domain/patientEncounterGenerator.ts`

**Add state machine generation:**

```typescript
import { StateMachineBuilder } from '@/services/av/patientAVEngine';
import type { PatientAVStateMachine } from '@/types/patient-av-state-machine';

/**
 * Generate state machine for a case.
 */
function generateStateMachine(
  caseId: string,
  patientName: string,
  chiefComplaint: string,
  condition: string
): PatientAVStateMachine {
  const builder = new StateMachineBuilder();
  
  return builder
    .withId(caseId)
    .withVersion('1.0.0')
    .withInitialState('baseline')
    .withMetadata({
      caseId,
      patientName,
      chiefComplaint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .addState({
      id: 'baseline',
      name: 'Baseline State',
      clinicalContext: 'Patient presenting with initial complaint',
      voice: {
        voiceId: 'Kore',
        rate: 1.0,
        pitch: 0,
        volume: 0.9,
        toneDescriptors: ['concerned', 'cooperative'],
        applyVocalStrain: false,
      },
      video: {
        videoId: `${caseId}-baseline`,
        prompt: `${patientName} presenting with ${chiefComplaint}`,
        physicalPresentation: 'Initial presentation',
        environment: 'emergency_department',
        duration: 5,
        transitionType: 'immediate',
        transitionDuration: 0,
        status: 'pending', // Will be generated later
      },
    })
    .build();
}

/**
 * Enhanced case generation with state machine.
 */
export async function generatePatientEncounterWithStateMachine(): Promise<PatientEncounterCase> {
  const baseCase = await generatePatientEncounterFromCondition();
  
  // Generate state machine
  const stateMachine = generateStateMachine(
    baseCase.id,
    baseCase.patientName,
    baseCase.chiefComplaint,
    baseCase.correctDiagnosis
  );
  
  return {
    ...baseCase,
    stateMachine: stateMachine as any, // Cast for Prisma Json type
  };
}
```

### Step 2: Create Integration Hooks

**File:** `hooks/useSystemIntegration.ts` (new)

```typescript
import { useContext, useEffect, useCallback } from 'react';
import { SystemIntegrationContext } from '@/contexts/SystemIntegrationContext';
import type { SystemEvent, SystemEventType } from '@/types/unified-system-integration';

export function useSystemIntegration() {
  const context = useContext(SystemIntegrationContext);
  if (!context) throw new Error('Must be within SystemIntegrationProvider');
  return context;
}

/**
 * Hook to subscribe to system events.
 */
export function useSystemEvent(
  eventType: SystemEventType,
  callback: (event: SystemEvent) => void
) {
  const { integration } = useSystemIntegration();
  
  useEffect(() => {
    return integration.on(eventType, callback);
  }, [integration, eventType, callback]);
}

/**
 * Hook to emit system events.
 */
export function useSystemEmit() {
  const { integration } = useSystemIntegration();
  
  return useCallback(
    (event: SystemEvent) => {
      integration.emit(event);
    },
    [integration]
  );
}
```

**File:** `hooks/useRealtimeSOAP.ts` (new)

```typescript
import { useState, useEffect } from 'react';
import { createSOAPNoteService } from '@/services/scribe/soapNoteService';
import type { SOAPNote } from '@/types/smart-scribe-system';

export function useRealtimeSOAP(sessionId: string | null, geminiApiKey: string) {
  const [service] = useState(() => createSOAPNoteService(geminiApiKey));
  const [draftNote, setDraftNote] = useState<SOAPNote | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    
    // Start generation
    service.startRealtimeGeneration(sessionId);
    
    // Poll for updates
    const interval = setInterval(() => {
      const draft = service.getDraftNote(sessionId);
      setDraftNote(draft);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [sessionId, service]);

  const addTranscript = useCallback((speaker: 'student' | 'patient', text: string) => {
    if (sessionId) {
      service.addTranscript(sessionId, speaker, text);
    }
  }, [sessionId, service]);

  const finalize = useCallback(async () => {
    if (!sessionId) return null;
    return await service.finalizeNote(sessionId);
  }, [sessionId, service]);

  return { draftNote, addTranscript, finalize };
}
```

---

## Example: Before & After

### PatientEncounterMode - Before (Simplified)

```typescript
function PatientEncounterMode() {
  const [currentCase, setCurrentCase] = useState<PatientEncounterCase | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [vitals, setVitals] = useState({ hr: 80, bp: '120/80', o2: 98 });

  // Send message to patient
  const sendMessage = async (text: string) => {
    const response = await chatWithPatientSimulator(text, currentCase);
    setMessages([...messages, 
      { role: 'student', content: text },
      { role: 'patient', content: response }
    ]);
  };

  return (
    <div>
      <h1>OSCE: {currentCase?.chiefComplaint}</h1>
      <div>Vitals: HR {vitals.hr}, BP {vitals.bp}, O2 {vitals.o2}%</div>
      
      <div className="chat">
        {messages.map((msg, i) => (
          <div key={i}>{msg.role}: {msg.content}</div>
        ))}
      </div>
      
      <input onSubmit={sendMessage} />
    </div>
  );
}
```

### PatientEncounterMode - After (Enhanced)

```typescript
function PatientEncounterMode() {
  const [currentCase, setCurrentCase] = useState<PatientEncounterCase | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [vitals, setVitals] = useState({ hr: 80, bp: '120/80', o2: 98 });
  
  // NEW: Integration service
  const { integration } = useSystemIntegration();
  
  // NEW: State machine
  const [avEngine, setAVEngine] = useState<PatientAVEngine | null>(null);
  const [currentAVState, setCurrentAVState] = useState<string | null>(null);
  
  // NEW: Real-time SOAP
  const { draftNote, addTranscript } = useRealtimeSOAP(session?.id, GEMINI_API_KEY);
  
  // NEW: Timing analytics
  const [timingService] = useState(() => createTimingAnalyticsService());
  
  // NEW: Audio/video
  const [voiceMode, setVoiceMode] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // Initialize state machine
  useEffect(() => {
    if (!currentCase?.stateMachine) return;
    
    const engine = new PatientAVEngine(currentCase.stateMachine as PatientAVStateMachine);
    
    // Subscribe to transitions
    engine.on((event) => {
      if (event.type === 'TRANSITION_COMPLETED') {
        setCurrentAVState(engine.getCurrentAVState().id);
        
        // Update video display
        const newState = engine.getCurrentAVState();
        setVideoUrl(newState.video.videoUrl);
        
        // Emit to integration
        integration.emit({
          type: 'MODULE_ENTERED',
          timestamp: new Date().toISOString(),
          sourceModule: 'osce',
          sessionId: session!.id!,
          payload: { stateTransition: event.payload }
        });
      }
    });
    
    setAVEngine(engine);
  }, [currentCase, integration, session]);

  // Update state machine when vitals change
  useEffect(() => {
    if (avEngine) {
      avEngine.updateVitals(vitals);
    }
  }, [vitals, avEngine]);

  // Send message (enhanced with SOAP tracking)
  const sendMessage = async (text: string) => {
    // Track conversation node
    if (session?.id) {
      timingService.recordConversationNode(
        session.id,
        'question',
        text,
        undefined,
        calculateRelevance(text, currentCase)
      );
    }
    
    const response = await chatWithPatientSimulator(text, currentCase);
    
    const newMessages = [
      ...messages,
      { role: 'student', content: text, timestamp: new Date().toISOString() },
      { role: 'patient', content: response, timestamp: new Date().toISOString() }
    ];
    
    setMessages(newMessages);
    
    // Forward to SOAP generator
    addTranscript('student', text);
    addTranscript('patient', response);
    
    // Emit event
    integration.emit({
      type: 'MODULE_ENTERED',
      timestamp: new Date().toISOString(),
      sourceModule: 'osce',
      sessionId: session!.id!,
      payload: { messageAdded: { text, response } }
    });
  };

  return (
    <div className="osce-container">
      {/* Context banner (persistent across all modules) */}
      <div className="context-banner">
        👤 Patient: {currentCase?.patientName} | 
        🩺 CC: {currentCase?.chiefComplaint} | 
        🩹 Vitals: HR {vitals.hr}, BP {vitals.bp}, O2 {vitals.o2}%
        {currentAVState && ` | State: ${currentAVState}`}
      </div>
      
      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1">
          <h1>OSCE: {currentCase?.chiefComplaint}</h1>
          
          {/* NEW: Video player */}
          {videoUrl && (
            <video src={videoUrl} loop muted autoPlay className="patient-video" />
          )}
          
          {/* NEW: Voice mode */}
          {voiceMode && wsUrl ? (
            <AudioInterface wsUrl={wsUrl} patientLabel={currentCase?.patientName} />
          ) : (
            <div className="chat">
              {messages.map((msg, i) => (
                <div key={i} className={`message message-${msg.role}`}>
                  {msg.content}
                </div>
              ))}
            </div>
          )}
          
          <div className="controls">
            <button onClick={() => setVoiceMode(!voiceMode)}>
              {voiceMode ? '💬 Switch to Text' : '🎤 Switch to Voice'}
            </button>
            <input onSubmit={sendMessage} disabled={voiceMode} />
          </div>
        </div>
        
        {/* NEW: Smart sidebar */}
        <div className="sidebar">
          {/* AI Tutor panel */}
          <div className="sidebar-panel">
            <h3>🤖 AI Tutor</h3>
            <AITutorPanel caseContext={currentCase} />
          </div>
          
          {/* Real-time SOAP draft */}
          <div className="sidebar-panel">
            <h3>📝 Draft SOAP Note</h3>
            <div className="soap-draft">
              {draftNote ? formatSOAPNote(draftNote) : 'Generating...'}
            </div>
          </div>
          
          {/* Live analytics */}
          <div className="sidebar-panel">
            <h3>📊 Live Analytics</h3>
            <div>
              Questions: {messages.filter(m => m.role === 'student').length}
              <br />
              Efficiency: {calculateEfficiency()}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Migration Checklist

### Phase 1: Core Integration (Week 1)

- [ ] Create SystemIntegrationContext
- [ ] Add SystemIntegrationProvider to App.tsx
- [ ] Database migration (add new fields)
- [ ] Enhance patientEncounterGenerator with state machine
- [ ] Add AudioInterface to PatientEncounterMode
- [ ] Deploy PatientVoiceSession Durable Object
- [ ] Test voice streaming end-to-end

### Phase 2: Module 4 Features (Week 2)

- [ ] Integrate soapNoteService
- [ ] Add SOAP draft panel to OSCE sidebar
- [ ] Integrate timingAnalyticsService
- [ ] Track all questions and actions
- [ ] Build SOAPComparisonView component
- [ ] Build EchoPathVisualization component
- [ ] Enhance debrief screen

### Phase 3: Module 5 Features (Week 3)

- [ ] Integrate AdaptiveUIService
- [ ] Add circadian UI mode switching
- [ ] Create avatar display component
- [ ] Build phantom patient component
- [ ] Add phantom to dashboard
- [ ] Implement badge notification system
- [ ] Generate first audio podcast

### Phase 4: New Modules (Weeks 4-5)

- [ ] Build ClinicalEyeMode component
- [ ] Build SimLabMode component
- [ ] Create 10+ sub-components for each
- [ ] Add navigation to new modules
- [ ] Test transitions between all modules

### Phase 5: Polish & Test (Week 6)

- [ ] Add cross-module navigation bar
- [ ] Implement smooth transitions
- [ ] Add keyboard shortcuts
- [ ] E2E testing
- [ ] Performance optimization
- [ ] User acceptance testing

---

## Quick Wins (Implement First)

### 1. Add Timing Analytics (Low Risk, High Value)

**Time**: 2 hours  
**Files**: 1 (PatientEncounterMode.tsx)  
**Impact**: Immediate insights into question efficiency

```typescript
// Add to PatientEncounterMode
const [timingService] = useState(() => createTimingAnalyticsService());

useEffect(() => {
  if (session?.id) {
    timingService.startSession(session.id, currentCase?.id);
  }
}, [session]);

// Track each question
const trackQuestion = (question: string) => {
  if (session?.id) {
    timingService.recordConversationNode(
      session.id,
      'question',
      question,
      undefined,
      calculateRelevance(question)
    );
  }
};
```

### 2. Add Real-Time SOAP Draft (Medium Risk, High Value)

**Time**: 4 hours  
**Files**: 2 (PatientEncounterMode.tsx, new SOAPDraftPanel.tsx)  
**Impact**: Students see AI-generated note in real-time

```typescript
// Add to PatientEncounterMode
const { draftNote, addTranscript } = useRealtimeSOAP(session?.id, GEMINI_API_KEY);

// Display in sidebar
<SOAPDraftPanel note={draftNote} />
```

### 3. Add Phantom Patient to Dashboard (Low Risk, Medium Value)

**Time**: 3 hours  
**Files**: 2 (DashboardPage.tsx, new PhantomPatient.tsx)  
**Impact**: Immediate engagement boost

```typescript
// Add to Dashboard
const [phantomPatient, setPhantomPatient] = useState<PhantomPatient | null>(null);

useEffect(() => {
  loadPhantomPatient(userId).then(setPhantomPatient);
}, [userId]);

<PhantomPatientCard patient={phantomPatient} />
```

---

## Risk Mitigation

### High-Risk Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| **Voice mode** | WebSocket stability | Deploy behind feature flag, extensive testing |
| **State machine** | Logic bugs | Comprehensive unit tests, gradual rollout |
| **Database migration** | Data loss | Backup before migration, reversible migrations |

### Medium-Risk Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| **Real-time SOAP** | API rate limits | Implement caching, debouncing |
| **Video generation** | Cost/latency | Pre-generate common states |
| **Infographics** | Generation failures | Fallback to text explanations |

### Low-Risk Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| **Timing analytics** | Minimal | Pure tracking, no user-facing logic |
| **Circadian UI** | Minimal | CSS-only changes, user can override |
| **Phantom patient** | Minimal | Separate component, doesn't affect core |

---

## Success Metrics

### Integration Complete When:

- [ ] All existing OSCE functionality still works
- [ ] New Module 1 features accessible (voice, state machine)
- [ ] Module 4 features working (SOAP, analytics, infographics)
- [ ] Module 5 features working (circadian UI, avatar, phantom)
- [ ] Context preserved across module transitions
- [ ] No performance regressions
- [ ] All tests passing (unit + integration + E2E)

### Quality Gates

- **Code Coverage**: > 80% for new code
- **Type Safety**: 0 `any` types in new code
- **Performance**: < 500ms p95 latency (no regression)
- **Accessibility**: All WCAG 2.1 AA criteria met
- **Documentation**: All new features documented

---

## Conclusion

The existing PANaCEa codebase is **well-structured and production-ready**. The migration strategy is to **enhance progressively** rather than rewrite:

1. **Week 1**: Connect core systems (integration service, state machine, audio)
2. **Week 2**: Add Module 4 (SOAP, analytics)
3. **Week 3**: Add Module 5 (UI, gamification)
4. **Weeks 4-5**: Build new modules (Clinical Eye, Sim Lab)
5. **Week 6**: Polish and test

**The new architecture complements the existing code - it doesn't replace it.**

With careful execution, the enhanced PANaCEa will be a **seamless, intelligent, multi-modal platform** while maintaining all existing functionality.

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
