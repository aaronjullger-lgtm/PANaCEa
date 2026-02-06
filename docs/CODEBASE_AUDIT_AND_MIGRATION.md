# PANaCEa Codebase Audit & Migration Guide

**Date:** February 5, 2026  
**Purpose:** Align existing codebase with new 5-module architecture  
**Status:** Audit Complete - Migration Roadmap Defined

---

## Executive Summary

The new architecture (30,000+ lines) defines a **comprehensive 5-module ecosystem**. The existing codebase has **solid foundations** that need to be **enhanced and integrated** with the new architecture rather than replaced.

**Strategy:** **Incremental migration** - Enhance existing code progressively, maintain backward compatibility during transition.

---

## Audit Findings

### ✅ **Strong Foundations (Keep & Enhance)**

#### 1. **Existing OSCE Infrastructure**

**Files:**
- `components/modes/PatientEncounterMode.tsx` (~2,700 lines)
- `functions/api/osce/*.ts` (13 API endpoints)
- `services/domain/osceService.ts`
- `hooks/useEnhancedOSCE.ts`
- `types/drill-modes.ts` (PatientEncounterCase, PatientPersona)

**Status:** ✅ **Good foundation, ready for Module 1 integration**

**What's Good:**
- PatientEncounterCase schema matches new architecture
- API endpoints follow Edge-compatible patterns
- Component structure is modular
- Already has phase system (history, physical, diagnostic, diagnosis, treatment)

**What to Enhance:**
- Add state machine integration (Module 1)
- Connect to PatientVoiceSession Durable Object (WebSocket)
- Integrate AudioInterface component
- Add real-time SOAP generation (Module 4)
- Connect timing analytics (Module 4)

#### 2. **Edge-Compatible API Patterns**

**Files:**
- `functions/api/_shared/middleware.ts` (authenticatedEndpoint)
- `functions/api/_shared/prisma-edge.ts` (createEdgePrismaClient)

**Status:** ✅ **Excellent patterns, fully compatible with new architecture**

**What's Good:**
- Already using `onRequestPost`, `onRequestGet` (Cloudflare Pages Functions)
- Already using `authenticatedEndpoint` middleware
- Already using Edge-compatible Prisma client
- Proper error handling and logging

**What to Enhance:**
- Add WebSocket upgrade handler (for PatientVoiceSession)
- Add state machine loading/validation
- Connect to new services (aiTutorService, soapNoteService, etc.)

#### 3. **Type Definitions**

**Files:**
- `types/drill-modes.ts` (PatientEncounterCase, PatientPersona)
- `types/osce-enhanced.ts` (PlacedOrder, ExamFinding, OSCEScoreReport)

**Status:** ✅ **Good foundation, ready for extension**

**What's Good:**
- PatientPersona matches new PatientPersona interface
- PatientEncounterCase has all required fields
- TypeScript-first approach

**What to Enhance:**
- Merge with new types (patient-av-state-machine.ts)
- Add stateMachine JSON field to PatientEncounterCase
- Import new interfaces for Module 2-5

---

### 🔄 **Migration Required (Integrate New Architecture)**

#### 1. **Module 1: Living Patient Enhancement**

**Current State:**
- Text-based chat interface ✅
- PatientEncounterCase generation ✅
- Session management ✅
- Basic vitals tracking ✅

**Missing (Add from New Architecture):**
- ❌ Event-driven state machine
- ❌ Voice interaction (AudioInterface + WebSocket)
- ❌ Dynamic video loops (veo_cameos)
- ❌ Clinical trigger system
- ❌ Voice modulation based on vitals
- ❌ Enhanced audio visualization

**Migration Plan:**
1. Add stateMachine field to PatientEncounterCase (Prisma migration)
2. Integrate AudioInterface component into PatientEncounterMode
3. Deploy PatientVoiceSession Durable Object
4. Connect WebSocket for voice streaming
5. Add PatientAVEngine for state management
6. Generate pilot videos with veo_cameos

**Files to Update:**
- `components/modes/PatientEncounterMode.tsx` - Add AudioInterface, state machine hooks
- `prisma/schema.prisma` - Add stateMachine Json? field
- `services/domain/patientEncounterGenerator.ts` - Generate state machines
- `hooks/useEnhancedOSCE.ts` - Add state machine management

#### 2. **Module 2: Clinical Eye (New - Add)**

**Current State:**
- None (new module)

**Required:**
- Create ClinicalEyeMode component
- Implement point-and-click diagnostic engine
- Add spatial-understanding integration for heatmaps
- Generate standardized patient videos
- Build comparative anatomy viewer

**Files to Create:**
- `components/modes/ClinicalEyeMode.tsx` (new)
- `components/clinical-eye/PointAndClickDiagnostic.tsx` (new)
- `components/clinical-eye/HeatmapOverlay.tsx` (new)
- `functions/api/clinical-eye/question.ts` (new)
- `services/clinical-eye/heatmapService.ts` (new)

#### 3. **Module 3: Digital Sim Lab (New - Add)**

**Current State:**
- None (new module)

**Required:**
- Create SimLabMode component
- Implement equipment tray drag-and-drop
- Build sterile field tracking
- Add geometry validation
- Generate workflow animations

**Files to Create:**
- `components/modes/SimLabMode.tsx` (new)
- `components/sim-lab/EquipmentTray.tsx` (new)
- `components/sim-lab/SterileFieldTracker.tsx` (new)
- `components/sim-lab/GeometryValidator.tsx` (new)
- `functions/api/sim-lab/procedure.ts` (new)

#### 4. **Module 4: Smart Scribe Integration**

**Current State:**
- Manual SOAP note entry ✅
- `functions/api/osce/grade-soap.ts` exists ✅
- Basic scoring ✅

**Missing:**
- ❌ Real-time SOAP generation (gemini-dictation)
- ❌ Side-by-side comparison
- ❌ Timing analytics (echoscript)
- ❌ Echo path visualization
- ❌ Dynamic infographic generation

**Migration Plan:**
1. Integrate soapNoteService into PatientEncounterMode
2. Add real-time SOAP draft display in sidebar
3. Integrate timingAnalyticsService
4. Add echo path visualization to debrief
5. Connect infographicService for mistakes

**Files to Update:**
- `components/modes/PatientEncounterMode.tsx` - Add SOAP draft panel
- `functions/api/osce/grade-soap.ts` - Use SOAPComparison from new service
- Add `components/osce/SOAPComparisonView.tsx` (new)
- Add `components/osce/EchoPathVisualization.tsx` (new)

#### 5. **Module 5: Interface Fabric (Partial - Enhance)**

**Current State:**
- Basic dashboard ✅
- Light/dark mode toggle ✅
- User profiles ✅

**Missing:**
- ❌ Circadian UI adaptation (lumina)
- ❌ Avatar progression system
- ❌ Achievement badges
- ❌ Phantom patient
- ❌ Audio reviews
- ❌ Consult system
- ❌ Metacognition widgets

**Migration Plan:**
1. Integrate AdaptiveUIService for circadian modes
2. Add avatar display and progression tracking
3. Build badge notification system
4. Create phantom patient component for dashboard
5. Add audio podcast generation
6. Implement consult system in OSCE
7. Embed metacognition widgets

**Files to Update:**
- `App.tsx` - Add AdaptiveUIService initialization
- `pages/DashboardPage.tsx` - Add phantom patient, metacognition widgets
- `components/modes/PatientEncounterMode.tsx` - Add consult button
- Add `components/gamification/PhantomPatient.tsx` (new)
- Add `components/gamification/AvatarDisplay.tsx` (new)

#### 6. **AI Tutor Integration**

**Current State:**
- virtualPreceptorService.ts exists ✅
- Gemini integration exists ✅

**Missing:**
- ❌ ask_the_manual integration
- ❌ Corpus management
- ❌ Progressive hint system
- ❌ Citation extraction

**Migration Plan:**
1. Upload textbooks to ask_the_manual corpus
2. Integrate aiTutorService alongside virtualPreceptorService
3. Add tutor sidebar to all modules
4. Implement progressive hint UI

**Files to Update:**
- `services/ai/virtualPreceptorService.ts` - Enhance with aiTutorService
- Add tutor sidebar to all mode components
- Add `components/ai-tutor/TutorSidebar.tsx` (new)
- Add `components/ai-tutor/ProgressiveHintPanel.tsx` (new)

---

## Integration Points

### Existing → New Architecture Mapping

| Existing Component | New Architecture Component | Integration Method |
|--------------------|----------------------------|-------------------|
| `PatientEncounterMode.tsx` | Module 1 (Living Patient) | Enhance with state machine, AudioInterface |
| `useEnhancedOSCE.ts` | Module 1 + 4 (OSCE + Analytics) | Add timing analytics, SOAP generation |
| `AudioInterface.tsx` | Module 1 (Voice) | Already exists! Connect to Durable Object |
| `virtualPreceptorService.ts` | AI Tutor (ask_the_manual) | Enhance with corpus queries |
| `patientEncounterGenerator.ts` | Module 1 (Case Gen) | Add state machine generation |
| Dashboard | Module 5 (Interface Fabric) | Add circadian UI, phantom, widgets |
| API endpoints | All modules | Add new endpoints for Modules 2-5 |

### New Services to Add

| Service | Module | Priority |
|---------|--------|----------|
| `systemIntegrationService.ts` | Integration | ✅ Already created |
| `aiTutorService.ts` | AI Tutor | ✅ Already created |
| `soapNoteService.ts` | Module 4 | ✅ Already created |
| `timingAnalyticsService.ts` | Module 4 | ✅ Already created |
| `infographicService.ts` | Module 4 | ✅ Already created |
| `adaptiveUIService.ts` | Module 5 | ✅ Already created |
| `gamificationService.ts` | Module 5 | ✅ Already created |

**Status:** All new services already designed! Just need to wire them in.

---

## Database Schema Updates

### Add to PatientEncounterCase

```prisma
model PatientEncounterCase {
  // ... existing fields ...
  
  // NEW: Module 1 state machine
  stateMachine Json?
  
  // NEW: Generated video URLs
  videoUrls Json? // { baseline: url, critical: url, stable: url }
  
  // NEW: Voice configuration
  voiceConfig Json? // { voiceId, personality, toneDescriptors }
}
```

### Add New Models

```prisma
// Module 5: User avatar and progression
model UserAvatar {
  id                String   @id @default(uuid())
  userId            String   @unique
  stage             String   // student_year_1, clinical_year, etc.
  equippedAccessories Json   // Array of accessory IDs
  xp                Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  User              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Module 5: Achievement badges
model UserAchievement {
  id           String   @id @default(uuid())
  userId       String
  badgeId      String
  unlockedAt   DateTime @default(now())
  displayOnProfile Boolean @default(true)
  User         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, badgeId])
  @@index([userId])
}

// Module 5: Phantom patient
model PhantomPatient {
  id            String   @id @default(uuid())
  userId        String   @unique
  condition     String
  healthState   Int      @default(100)
  videoUrl      String?
  lastInteraction DateTime @default(now())
  User          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Module 4: Automated case files
model CaseFile {
  id                String   @id @default(uuid())
  sessionId         String   @unique
  soapComparison    Json
  timingAnalytics   Json
  infographics      Json     // Array of generated infographic URLs
  pdfUrl            String?
  createdAt         DateTime @default(now())
  PatientEncounterSession PatientEncounterSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

---

## Implementation Priority

### Phase 1: Connect Core Systems (Week 1)

**Priority: HIGH**

1. **Integrate System Integration Service**
   - Wire into App.tsx as global provider
   - Initialize event bus
   - Set up context synchronization

2. **Enhance PatientEncounterMode with Module 1 Features**
   - Add AudioInterface component
   - Connect to PatientVoiceSession WebSocket
   - Integrate PatientAVEngine for state management
   - Add enhanced audio visualization

3. **Database Migration**
   - Add stateMachine, videoUrls, voiceConfig to PatientEncounterCase
   - Add UserAvatar, UserAchievement, PhantomPatient, CaseFile models
   - Run migration

**Files to Modify:**
- `App.tsx` - Add SystemIntegrationProvider
- `components/modes/PatientEncounterMode.tsx` - Add state machine + audio
- `prisma/schema.prisma` - Add new fields and models
- `services/domain/patientEncounterGenerator.ts` - Generate state machines

### Phase 2: Add Module 4 Features (Week 2)

**Priority: HIGH**

1. **Real-Time SOAP Generation**
   - Integrate soapNoteService into OSCE
   - Add draft SOAP panel in sidebar
   - Show real-time updates

2. **Timing Analytics**
   - Integrate timingAnalyticsService
   - Track all questions and actions
   - Build echo path visualization

3. **Enhanced Debrief**
   - Add SOAP comparison view
   - Add echo path visualization
   - Integrate infographic generation for mistakes

**Files to Create/Modify:**
- `components/osce/SOAPDraftPanel.tsx` (new)
- `components/osce/SOAPComparisonView.tsx` (new)
- `components/osce/EchoPathVisualization.tsx` (new)
- `components/modes/PatientEncounterMode.tsx` - Integrate services

### Phase 3: Add Module 5 Features (Week 3)

**Priority: MEDIUM**

1. **Circadian UI**
   - Integrate AdaptiveUIService
   - Detect peak hours and adjust UI mode
   - Apply theme configurations

2. **Gamification**
   - Add avatar display to dashboard
   - Implement XP and level system
   - Create badge notification system
   - Build phantom patient component

3. **Audio Reviews**
   - Generate podcasts from weak areas
   - Add podcast player to dashboard

**Files to Create/Modify:**
- `App.tsx` - Initialize AdaptiveUIService
- `pages/DashboardPage.tsx` - Add phantom patient, avatar display
- `components/gamification/*` (new directory with 5 components)

### Phase 4: Build Modules 2 & 3 (Weeks 4-5)

**Priority: MEDIUM**

1. **Module 2: Clinical Eye**
   - Create new mode component
   - Build point-and-click engine
   - Integrate spatial-understanding

2. **Module 3: Sim Lab**
   - Create new mode component
   - Build equipment tray
   - Implement sterile field tracking

**Files to Create:**
- `components/modes/ClinicalEyeMode.tsx` (new, ~800 lines)
- `components/modes/SimLabMode.tsx` (new, ~900 lines)
- 10+ sub-components for each module

### Phase 5: Polish & Integration (Week 6)

**Priority: LOW (Quality of Life)**

1. **Cross-Module Navigation**
   - Unified nav bar
   - Smart module suggestions
   - Smooth transitions

2. **Testing**
   - Integration tests for all modules
   - E2E workflow test (login → case → review)
   - Performance testing

---

## Code Quality Standards

### Align Existing Code with New Patterns

#### 1. **Type Safety**

**Before:**
```typescript
// Existing (less specific)
const case: any = await getRandomEncounterCase();
```

**After:**
```typescript
// Aligned (type-safe)
const case: PatientEncounterCase = await getRandomEncounterCase();
```

#### 2. **Service Integration**

**Before:**
```typescript
// Existing (direct Gemini calls)
const response = await callGeminiText(model, prompt);
```

**After:**
```typescript
// Aligned (service layer)
const response = await aiTutorService.query({
  question: prompt,
  context: 'osce_active',
  clinicalContext: { ... }
});
```

#### 3. **State Management**

**Before:**
```typescript
// Existing (local state)
const [vitals, setVitals] = useState({ hr: 80, bp: '120/80' });
```

**After:**
```typescript
// Aligned (unified state with integration service)
const { vitals, updateVitals } = useUnifiedSession(sessionId);

// Updates propagate to all modules
updateVitals({ hr: 86 }); // → Triggers state machine + SOAP + UI
```

#### 4. **Error Handling**

**Before:**
```typescript
// Existing (basic)
try {
  const data = await fetch(url);
} catch (error) {
  console.error(error);
}
```

**After:**
```typescript
// Aligned (comprehensive with user feedback)
try {
  const data = await fetch(url);
} catch (error) {
  log.error('Failed to fetch', error);
  toast.error('Failed to load case. Retrying...');
  await retryWithBackoff(() => fetch(url), 3);
}
```

---

## API Endpoint Enhancements

### New Endpoints to Add

```
/api/osce/
  ├── voice/:sessionId        (NEW - WebSocket upgrade)
  ├── state-machine/:caseId   (NEW - Get state machine)
  └── soap/draft/:sessionId   (NEW - Get real-time SOAP draft)

/api/clinical-eye/          (NEW - Module 2)
  ├── questions
  ├── heatmap/:imageId
  └── validate-click

/api/sim-lab/               (NEW - Module 3)
  ├── procedures
  ├── validate-equipment
  └── validate-geometry

/api/smart-scribe/          (NEW - Module 4)
  ├── infographic/generate
  ├── soap/compare
  └── timing-analytics/:sessionId

/api/gamification/          (NEW - Module 5)
  ├── avatar
  ├── achievements
  ├── phantom-patient
  └── audio-review/generate

/api/ai-tutor/              (NEW - AI Tutor)
  ├── query
  ├── hint
  └── debrief
```

### Enhance Existing Endpoints

**`/api/osce/session` (POST)**

**Current:**
```typescript
// Creates session, returns basic info
return { success: true, session };
```

**Enhanced:**
```typescript
// Also initialize state machine, timing analytics, SOAP generator
const session = await prisma.patientEncounterSession.create({ ... });

// Initialize Module 1 state machine
const avEngine = new PatientAVEngine(case.stateMachine);

// Initialize Module 4 services
await soapNoteService.startRealtimeGeneration(session.id);
await timingAnalyticsService.startSession(session.id, case.id);

// Initialize Module 5 tracking
await updatePhantomPatient(user.id, 'interaction');

return { success: true, session, wsUrl: `wss://voice.panacea.app/voice/${session.id}` };
```

---

## Component Refactoring Guide

### PatientEncounterMode.tsx Refactor

**Current Structure (~2,700 lines):**
```typescript
PatientEncounterMode
  ├── State management (useState hooks)
  ├── Chat interface
  ├── Vitals display
  ├── Physical exam panel
  ├── Diagnostic panel
  └── Results view
```

**Enhanced Structure:**
```typescript
PatientEncounterMode
  ├── Unified session state (SystemIntegrationProvider)
  ├── Audio-visual interface (Module 1)
  │   ├── AudioInterface (voice streaming)
  │   ├── VideoPlayer (veo_cameos loops)
  │   └── VitalityMeter (enhanced visualization)
  ├── Smart sidebar (adaptive)
  │   ├── AI Tutor panel
  │   ├── Real-time SOAP draft
  │   └── Live analytics
  ├── Chat interface (fallback for text-only)
  ├── Context banner (persistent patient info)
  ├── Physical exam panel (unchanged)
  ├── Diagnostic panel (links to Module 2)
  ├── Consult button (Module 5 feature)
  └── Enhanced results view (Module 4)
      ├── SOAP comparison
      ├── Echo path visualization
      └── Generated infographics
```

**Refactor Steps:**
1. Extract large sections into sub-components
2. Add integration service hooks
3. Connect to new services
4. Add state machine management
5. Enhance with Module 4 & 5 features

---

## Service Layer Audit

### Existing Services (Keep & Enhance)

**✅ Good Services (Minor enhancements):**

1. `services/domain/patientEncounterGenerator.ts`
   - ✅ Already generates PatientPersona
   - ➕ Add state machine generation
   - ➕ Add video URL generation (veo_cameos)

2. `services/ai/virtualPreceptorService.ts`
   - ✅ Already provides feedback
   - ➕ Integrate with aiTutorService for citations
   - ➕ Add progressive hint logic

3. `services/session/sessionService.ts`
   - ✅ Already manages sessions
   - ➕ Integrate with systemIntegrationService
   - ➕ Add unified state management

**New Services (Already Created):**

4. `services/av/patientAVEngine.ts` ✅
5. `services/av/veoCameosService.ts` ✅
6. `services/ai/aiTutorService.ts` ✅
7. `services/scribe/soapNoteService.ts` ✅
8. `services/scribe/infographicService.ts` ✅
9. `services/analytics/timingAnalyticsService.ts` ✅
10. `services/ui/adaptiveUIService.ts` ✅
11. `services/gamification/gamificationService.ts` ✅
12. `services/integration/systemIntegrationService.ts` ✅

---

## Migration Roadmap

### Week 1: Core Integration

- [ ] Add SystemIntegrationProvider to App.tsx
- [ ] Database migration (add new fields/models)
- [ ] Enhance PatientEncounterMode with AudioInterface
- [ ] Deploy PatientVoiceSession Durable Object
- [ ] Test voice streaming

### Week 2: Module 4 Integration

- [ ] Integrate soapNoteService
- [ ] Add SOAP draft panel to OSCE
- [ ] Integrate timingAnalyticsService
- [ ] Build echo path visualization
- [ ] Enhance debrief screen

### Week 3: Module 5 Integration

- [ ] Integrate AdaptiveUIService
- [ ] Add circadian UI modes
- [ ] Build avatar system
- [ ] Create phantom patient component
- [ ] Add to dashboard

### Week 4: Build Module 2

- [ ] Create ClinicalEyeMode component
- [ ] Implement point-and-click engine
- [ ] Integrate spatial-understanding
- [ ] Generate 10 pilot videos
- [ ] Test heatmap generation

### Week 5: Build Module 3

- [ ] Create SimLabMode component
- [ ] Build equipment tray
- [ ] Implement sterile field tracking
- [ ] Generate 5 procedure animations
- [ ] Test geometry validation

### Week 6: Integration Testing

- [ ] E2E test: Login → OSCE → Imaging → Procedure → Review
- [ ] Test context propagation across all modules
- [ ] Test coordinated responses (critical vital → 8 services)
- [ ] Performance testing (100+ concurrent users)
- [ ] User acceptance testing

---

## Backward Compatibility

### Maintain Existing Functionality

**During migration:**
- ✅ Existing text-based OSCE continues to work
- ✅ Existing API endpoints remain functional
- ✅ Existing sessions can complete normally
- ✅ Existing data remains accessible

**Strategy:**
- Use **feature flags** to enable new features progressively
- Run **both systems in parallel** during transition
- **Gradual rollout** (internal → beta → production)

### Feature Flags

```typescript
const FEATURE_FLAGS = {
  enableVoiceMode: false,         // Module 1 voice (start false)
  enableStateMachine: false,      // Module 1 state machine
  enableRealtimeSOAP: false,      // Module 4 SOAP generation
  enableTimingAnalytics: true,    // Module 4 (low risk, start true)
  enableCircadianUI: false,       // Module 5
  enablePhantomPatient: false,    // Module 5
  enableClinicalEye: false,       // Module 2 (new)
  enableSimLab: false,            // Module 3 (new)
};
```

**Rollout Plan:**
1. Week 1: Enable timing analytics (low risk)
2. Week 2: Enable real-time SOAP (medium risk)
3. Week 3: Enable circadian UI + phantom (low risk)
4. Week 4: Enable voice mode (high risk - test thoroughly)
5. Week 5: Enable state machine (high risk)
6. Week 6: Enable all features

---

## Code Quality Improvements

### Apply to All Existing Code

#### 1. **Consistent Error Handling**

```typescript
// Add to all API endpoints
try {
  // ... logic ...
} catch (error) {
  log.error('Endpoint error', error);
  return new Response(
    JSON.stringify({ error: 'Internal server error', details: String(error) }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
} finally {
  await safePrismaDisconnect(prisma);
}
```

#### 2. **Comprehensive Logging**

```typescript
// Add structured logging everywhere
import { createEndpointLogger } from '../_shared/secureLogger';

const log = createEndpointLogger('/api/osce/session', auth.userId);
log.info('Creating session', { caseId });
log.error('Failed to create session', error);
```

#### 3. **Input Validation**

```typescript
// Add Zod validation to all endpoints
const BodySchema = z.object({
  body: z.object({
    caseId: z.string().uuid(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
});

export const onRequestPost = authenticatedEndpoint(
  BodySchema,
  async ({ env, validated, auth }) => { ... }
);
```

#### 4. **Type Safety**

```typescript
// Remove 'any' types
// Before:
const messages: any[] = session.messages;

// After:
interface ChatMessage {
  role: 'student' | 'patient' | 'system';
  content: string;
  timestamp: string;
}
const messages: ChatMessage[] = session.messages as ChatMessage[];
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test state machine engine
describe('PatientAVEngine', () => {
  it('should transition state when O2 drops below 88%', () => {
    const engine = new PatientAVEngine(stateMachine);
    engine.updateVitals({ o2: 86 });
    expect(engine.getCurrentAVState().id).toBe('severe_hypoxia');
  });
});

// Test SOAP generator
describe('SOAPNoteService', () => {
  it('should extract HPI elements from transcript', async () => {
    const service = createSOAPNoteService(apiKey);
    await service.addTranscript(sessionId, 'patient', 'Pain started 30 minutes ago');
    const note = service.getDraftNote(sessionId);
    expect(note.subjective.hpi.onset?.content).toContain('30 minutes');
  });
});
```

### Integration Tests

```typescript
// Test cross-module coordination
describe('System Integration', () => {
  it('should coordinate responses when diagnosis made', async () => {
    const integration = createSystemIntegrationService();
    const events: SystemEvent[] = [];
    integration.on('DIAGNOSIS_MADE', (e) => events.push(e));
    
    integration.emit({
      type: 'DIAGNOSIS_MADE',
      sessionId: 'test',
      sourceModule: 'osce',
      timestamp: new Date().toISOString(),
      payload: { diagnosis: 'STEMI', isCorrect: true }
    });
    
    // Should trigger SOAP finalization
    expect(events).toHaveLength(1);
    // Verify other services notified
  });
});
```

### E2E Tests

```typescript
// Test complete workflow
test('Complete OSCE → Imaging → Procedure → Review workflow', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('[data-testid="start-osce"]');
  
  // Module 1: OSCE
  await page.fill('[data-testid="chat-input"]', 'What brings you in today?');
  await page.click('[data-testid="send-message"]');
  await page.waitForSelector('[data-testid="patient-response"]');
  
  // Verify context preserved
  const contextBanner = page.locator('[data-testid="context-banner"]');
  await expect(contextBanner).toContainText('John Smith');
  
  // Transition to Module 2
  await page.click('[data-testid="review-ecg"]');
  await expect(page).toHaveURL(/clinical-eye/);
  
  // Verify context carried over
  await expect(contextBanner).toContainText('John Smith');
  await expect(contextBanner).toContainText('STEMI');
  
  // ... continue through all modules
});
```

---

## File-by-File Audit Summary

### High Priority (Enhance Immediately)

| File | Current State | Action Required | Priority |
|------|---------------|-----------------|----------|
| `PatientEncounterMode.tsx` | Good foundation | Add state machine, audio, SOAP panel | HIGH |
| `patientEncounterGenerator.ts` | Good | Add state machine generation | HIGH |
| `App.tsx` | Basic | Add SystemIntegrationProvider | HIGH |
| `schema.prisma` | Good | Add new fields/models | HIGH |

### Medium Priority (Enhance Soon)

| File | Current State | Action Required | Priority |
|------|---------------|-----------------|----------|
| `DashboardPage.tsx` | Basic | Add phantom, avatar, widgets | MEDIUM |
| `virtualPreceptorService.ts` | Good | Integrate aiTutorService | MEDIUM |
| `osceService.ts` | Good | Connect to integration service | MEDIUM |

### Low Priority (Quality of Life)

| File | Current State | Action Required | Priority |
|------|---------------|-----------------|----------|
| Various components | Good | Add keyboard shortcuts | LOW |
| Various components | Good | Improve loading states | LOW |
| Various components | Good | Add micro-animations | LOW |

---

## Success Criteria

### Integration Complete When:

- [ ] All 5 modules accessible from unified navigation
- [ ] Context preserved across all module transitions
- [ ] All 13 AI services coordinated via Integration Service
- [ ] Real-time SOAP generation working in OSCE
- [ ] Timing analytics tracking all actions
- [ ] Circadian UI adapting to time of day
- [ ] Avatar and phantom patient functional
- [ ] Voice mode working with state machine
- [ ] Point-and-click diagnostics working (Module 2)
- [ ] Procedure simulation working (Module 3)
- [ ] E2E test passing (login → complete case → review)
- [ ] No regressions in existing functionality

---

## Estimated Effort

### Time Estimates

| Phase | Work | Time |
|-------|------|------|
| **Phase 1** | Core integration (DB, services, OSCE) | 40 hours |
| **Phase 2** | Module 4 integration (SOAP, analytics) | 32 hours |
| **Phase 3** | Module 5 integration (UI, gamification) | 24 hours |
| **Phase 4** | Modules 2 & 3 build | 80 hours |
| **Phase 5** | Polish, testing, debugging | 24 hours |
| **TOTAL** | | **200 hours (~5 weeks)** |

### Team Allocation

- **1 Senior Engineer**: Core integration (Phases 1-2)
- **1 Mid-Level Engineer**: Module 5 implementation (Phase 3)
- **2 Engineers**: Modules 2 & 3 build (Phase 4)
- **1 QA Engineer**: Testing (Phase 5)

---

## Conclusion

The existing PANaCEa codebase provides a **solid foundation** that can be **enhanced incrementally** with the new architecture. The migration path is clear:

1. **Week 1**: Integrate core systems (event bus, state machine, database)
2. **Week 2**: Add Module 4 features (SOAP, analytics)
3. **Week 3**: Add Module 5 features (UI, gamification)
4. **Weeks 4-5**: Build new modules (Clinical Eye, Sim Lab)
5. **Week 6**: Polish, test, deploy

**Key Principle:** **Enhance, don't replace.** The existing code is production-quality; we're adding the new architecture on top, not throwing away good work.

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
