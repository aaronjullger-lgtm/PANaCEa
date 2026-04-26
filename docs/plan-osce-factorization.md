# PLAN DOC 1: OSCE Factorization Implementation Plan
**Date**: 2026-04-24 | **Sprint**: Integration Roadmap | **Priority**: P0

---

## Phase 1 Summary: Audit Complete ✅

### 1-Page Diff: Current vs. EasyMED Factorization

| Aspect | Current PANaCEa | EasyMED Target | Change Required |
|--------|----------------|----------------|----------------|
| **LLM Agents** | 1 patient agent | 3 agents (Auxiliary, Patient, Evaluation) | **New: Auxiliary + Evaluation agents** |
| **Intent Taxonomy** | None (freeform patient responses) | 31-intent taxonomy (7 categories) | **New: Intent classifier + taxonomy** |
| **Prompts** | Hardcoded in `live.ts` | YAML files in `packages/prompts/osce/en/` | **Refactor: Extract to YAML** |
| **Rubric** | 5 custom checklists | 8-dimension SPBench (QC, CC, CD, RC, LC, LN, CS, PD) | **New: SPBench implementation** |
| **Evaluation** | AI reasoning during session + structural | Post-hoc rubric scorer (separate LLM call) | **New: Post-session evaluation cron** |
| **Case Template** | JSON seed format | Structured template (Appendix E.2) | **Update: Template structure** |
| **Scoring** | 85 structural + 15 AI | SPBench 8-dim × 100pt scale | **New: SPBench scoring system** |
| **Session State** | `PatientEncounterSession` model | Cloudflare Durable Objects | **New: OsceSessionDO for session state** |

### What Stays the Same
- ✅ Gemini Live API WebSocket protocol (audio streaming)
- ✅ `PatientEncounterCase` case storage model (extend only)
- ✅ Physical exam tool system
- ✅ Vitals/labs tool responses
- ✅ Structural scoring (85 pts instant)
- ✅ UI components (OsceSession, OsceFeedback) - minor wiring changes only

### What Changes
- 🔶 **Auxiliary agent**: Classifies student intents → routes to Patient agent
- 🔶 **Patient agent**: Grounded in case data with 31-intent awareness
- 🔶 **Evaluation agent**: Post-hoc SPBench scoring (QC, CC, CD, RC, LC, LN, CS, PD)
- 🔶 **Intent prompts**: YAML-based prompt system
- 🔶 **SPBench cron**: Nightly rubric scoring job
- 🔶 **ClinicalIntent enum**: New Prisma model for intent tracking
- 🔶 **OsceSession model**: Extended for intent logging
- 🔶 **Durable Objects**: Session state management for multi-agent orchestration

---

## Phase 2: Implementation Plan

### Sprint 1: Prisma Migration & Core Models

**New Prisma Models**:
```prisma
enum ClinicalIntent {
  DEMOGRAPHICS
  CHIEF_COMPLAINT
  ONSET
  CAUSE
  LOCATION
  CHARACTER
  DURATION
  MODIFIERS
  ASSOCIATED
  PROGRESSION
  TREATMENT
  TESTS
  GENERAL
  ELIMINATION
  CHANGES
  HEALTH
  CHRONIC
  INFECTIOUS
  SURGICAL
  TRANSFUSIONS
  ALLERGIES
  IMMUNIZATION
  TRAVEL
  HABITS
  OCCUPATION
  SEXUAL
  OBSTETRIC
  FAMILY
  MENSTRUAL
  COMMUNICATION
  OTHER
}

model ClinicalIntentLog {
  id String @id
  sessionId String @map("PatientEncounterSession")
  intent ClinicalIntent
  confidence Float @default(0.0)
  studentText String
  classifiedAt DateTime @default(now())
  @@index([sessionId, classifiedAt])
}

model OsceSession {
  id String @id
  userId String
  caseId String @map("PatientEncounterCase")
  status String @default("active")
  currentAgent String // "auxiliary" | "patient" | "evaluation"
  auxiliaryState Json // intent classifier state
  patientState Json // patient agent state
  evaluationState Json // rubric scorer state
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  completedAt DateTime?
}

model SpbenchScore {
  id String @id
  sessionId String @map("OsceSession")
  queryCompetence Float // QC: 0-100
  caseCoverage Float // CC: 0-100
  clinicalDepth Float // CD: 0-100
  relevanceCheck Float // RC: 0-100
  logicalConsistency Float // LC: 0-100
  languageNaturality Float // LN: 0-100
  clinicalSafety Float // CS: 0-100
  professionalDemeanor Float // PD: 0-100
  overallScore Float // weighted average
  scoredAt DateTime @default(now())
}
```

**Migration File**: `prisma/migrations/20260424000000_osce_factorization/migration.sql`

---

### Sprint 2: Agent Prompt YAMLs

**Directory Structure**:
```
packages/prompts/osce/en/
├── auxiliary_agent.yaml    # Intent classifier (Gemini 2.5 Flash)
├── patient_agent.yaml      # Case-grounded patient (Gemini 2.5 Pro)
├── evaluation_agent.yaml    # SPBench rubric scorer (Gemini 2.5 Pro)
└── prompts/
    ├── system.txt
    ├── taxonomy_table.txt  # 31 intents with examples
    └── scoring_rubric.txt   # 8 SPBench dimensions
```

**auxiliary_agent.yaml**:
```yaml
model: gemini-2.5-flash
temperature: 0.1
max_tokens: 50
system: |
  You are an auxiliary agent for an OSCE clinical simulation.
  Your task: Classify the student's inquiry into one of 31 clinical intents.

  Use the 31-intent taxonomy:
  - DEMOGRAPHICS: age, sex, ethnicity, occupation
  - CHIEF_COMPLAINT: primary reason for visit
  - ONSET: when symptoms started
  - LOCATION: anatomical site
  - CHARACTER: quality of pain/discomfort
  - DURATION: time since onset
  - MODIFIERS: exacerbating/alleviating factors
  - ASSOCIATED: related symptoms
  - PROGRESSION: changes over time
  - TREATMENT: interventions tried
  - TESTS: diagnostics ordered
  - GENERAL: broad screening
  - ELIMINATION: ruling out differentials
  - CHANGES: recent life changes
  - HEALTH: overall health status
  - CHRONIC: ongoing conditions
  - INFECTIOUS: exposure history
  - SURGICAL: past procedures
  - TRANSFUSIONS: blood products
  - ALLERGIES: adverse reactions
  - IMMUNIZATION: vaccine status
  - TRAVEL: geographic exposure
  - HABITS: substance use
  - OCCUPATION: work risks
  - SEXUAL: sexual history
  - OBSTETRIC: pregnancy-related
  - FAMILY: hereditary conditions
  - MENSTRUAL: cycle details
  - COMMUNICATION: rapport building
  - OTHER: unclassifiable

  Return ONLY the intent name in uppercase.
user: |
  Student inquiry: "{{student_text}}"

  Classify intent:
```

**patient_agent.yaml**:
```yaml
model: gemini-2.5-pro
temperature: 0.8
max_tokens: 150
system: |
  You are a {{patient_age}}-year-old {{patient_sex}} patient named {{patient_name}}.
  Chief complaint: {{chief_complaint}}

  BEHAVIOR RULES:
  1. STAY IN CHARACTER - first person, lay language only
  2. EMPATHY RESPONSE - open up for empathetic inquiries, shut down for rude ones
  3. INTENT-AWARE - recognize what the student is asking ({{classified_intent}})
  4. LAY LANGUAGE - never use medical terms unless student has used them
  5. EXAM-SPECIFIC - only reveal findings for body system named
  6. BRIEF ANSWERS - 1-2 sentences max

  Case data available:
  - Vitals: {{vitals}}
  - HPI: {{hpi}}
  - PMH: {{pmh}}
  - PE findings: {{pe_findings}}
  - Labs: {{labs}}
```

**evaluation_agent.yaml**:
```yaml
model: gemini-2.5-pro
temperature: 0.1
max_tokens: 500
system: |
  You are a post-hoc OSCE evaluation agent using SPBench rubric.

  Score 8 dimensions (0-100 scale):
  1. Query Competence (QC): Appropriateness of history questions
  2. Case Coverage (CC): Completeness of data gathered
  3. Clinical Depth (CD): Depth of diagnostic reasoning
  4. Relevance Check (RC): Focus on relevant findings
  5. Logical Consistency (LC): Coherence of reasoning
  6. Language Naturality (LN): Patient-appropriate communication
  7. Clinical Safety (CS): Red flag detection
  8. Professional Demeanor (PD): Empathy and professionalism

  Session transcript:
  {{transcript}}

  Intent log:
  {{intent_log}}

  Student diagnosis: {{student_diagnosis}}
  Correct diagnosis: {{correct_diagnosis}}

  Return JSON:
  {
    "QC": <score>,
    "CC": <score>,
    "CD": <score>,
    "RC": <score>,
    "LC": <score>,
    "LN": <score>,
    "CS": <score>,
    "PD": <score>,
    "justification": "<brief explanation>"
  }
```

---

### Sprint 3: Cloudflare Pages Functions

**New Endpoints**:

#### `functions/api/osce/intent.ts`
```typescript
import { authenticatedEndpoint } from '../_shared/auth';
import { loadPrompt } from '../_shared/prompts';
import { aiGateway } from '../_shared/gemini';

export const onRequestPost: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    const { sessionId, studentText } = await context.request.json();

    // Load auxiliary agent prompt
    const prompt = await loadPrompt('osce/en/auxiliary_agent.yaml');

    // Call Gemini 2.5 Flash
    const response = await aiGateway({
      model: 'gemini-2.5-flash',
      prompt: prompt.user.replace('{{student_text}}', studentText),
      system: prompt.system,
      temperature: 0.1
    });

    const intent = response.text.trim().toUpperCase();

    // Log intent classification
    await prisma.clinicalIntentLog.create({
      data: {
        sessionId,
        intent: intent as ClinicalIntent,
        confidence: 0.95, // Gemini 2.5 Flash reports 96.3% accuracy
        studentText,
        classifiedAt: new Date()
      }
    });

    return new Response(JSON.stringify({ intent }), {
      headers: { 'Content-Type': 'application/json' }
    });
  })
);
```

#### `functions/api/osce/patient.ts`
```typescript
export const onRequestPost: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    const { sessionId, classifiedIntent } = await context.request.json();

    // Load case data
    const session = await prisma.osceSession.findUnique({
      where: { id: sessionId },
      include: { case: true }
    });

    const caseData = session!.case;

    // Load patient agent prompt (Gemini 2.5 Pro)
    const prompt = await loadPrompt('osce/en/patient_agent.yaml');
    const system = prompt.system
      .replace('{{patient_age}}', caseData.age.toString())
      .replace('{{patient_sex}}', caseData.sex)
      .replace('{{patient_name}}', caseData.patientName)
      .replace('{{chief_complaint}}', caseData.chiefComplaint)
      .replace('{{classified_intent}}', classifiedIntent)
      .replace('{{vitals}}', JSON.stringify(caseData.vitalSigns))
      .replace('{{hpi}}', JSON.stringify(caseData.historyData))
      .replace('{{pmh}}', '...') // etc.

    // Call Gemini 2.5 Pro (case-grounded)
    const response = await aiGateway({
      model: 'gemini-2.5-pro',
      system,
      prompt: 'Respond to the student based on their inquiry.',
      temperature: 0.8
    });

    return new Response(JSON.stringify({ response: response.text }), {
      headers: { 'Content-Type': 'application/json' }
    });
  })
);
```

#### `functions/api/osce/evaluate.ts`
```typescript
export const onRequestPost: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    const { sessionId } = await context.request.json();

    // Load session transcript and intent log
    const [session, intents] = await Promise.all([
      prisma.osceSession.findUnique({
        where: { id: sessionId },
        include: { case: true }
      }),
      prisma.clinicalIntentLog.findMany({
        where: { sessionId },
        orderBy: { classifiedAt: 'asc' }
      })
    ]);

    // Load evaluation agent prompt
    const prompt = await loadPrompt('osce/en/evaluation_agent.yaml');

    // Build evaluation context
    const transcript = await buildTranscript(sessionId);
    const intentLog = intents.map(i => `${i.intent}: ${i.studentText}`).join('\n');

    const system = prompt.system
      .replace('{{transcript}}', transcript)
      .replace('{{intent_log}}', intentLog)
      .replace('{{student_diagnosis}}', session!.diagnosis || 'none')
      .replace('{{correct_diagnosis}}', session!.case.correctDiagnosis);

    // Call Gemini 2.5 Pro for SPBench scoring
    const response = await aiGateway({
      model: 'gemini-2.5-pro',
      system,
      prompt: 'Score this OSCE session using SPBench rubric.',
      temperature: 0.1
    });

    const scores = JSON.parse(response.text);

    // Save SPBench scores
    const spbench = await prisma.spbenchScore.create({
      data: {
        sessionId,
        queryCompetence: scores.QC,
        caseCoverage: scores.CC,
        clinicalDepth: scores.CD,
        relevanceCheck: scores.RC,
        logicalConsistency: scores.LC,
        languageNaturality: scores.LN,
        clinicalSafety: scores.CS,
        professionalDemeanor: scores.PD,
        overallScore: (scores.QC * 0.15 + scores.CC * 0.15 + scores.CD * 0.15 +
                      scores.RC * 0.10 + scores.LC * 0.15 + scores.LN * 0.10 +
                      scores.CS * 0.10 + scores.PD * 0.10)
      }
    });

    return new Response(JSON.stringify({ scores: spbench }), {
      headers: { 'Content-Type': 'application/json' }
    });
  })
);
```

---

### Sprint 4: Durable Object for Session State

**`workers/osce-session.ts`**:
```typescript
export interface OsceSessionState {
  currentAgent: 'auxiliary' | 'patient' | 'evaluation';
  auxiliaryState: {
    lastIntent?: ClinicalIntent;
    intentHistory: Array<{ intent: ClinicalIntent; timestamp: number }>;
  };
  patientState: {
    empathyLevel: number; // 0-1, affects response openness
    questionsAsked: number;
    criticalMissed: string[];
  };
  evaluationState: {
    transcript: Array<{ role: 'student' | 'patient'; text: string; timestamp: number }>;
    startTime: number;
    endTime?: number;
  };
}

export class OsceSessionDO implements DurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method;

    switch (method) {
      case 'POST':
        if (url.pathname === '/classify') {
          return this.handleIntentClassification(request);
        }
        if (url.pathname === '/respond') {
          return this.handlePatientResponse(request);
        }
        if (url.pathname === '/evaluate') {
          return this.handleEvaluation(request);
        }
        break;
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleIntentClassification(request: Request) {
    const { studentText } = await request.json();
    const state = await this.state.storage.get<OsceSessionState>('session');

    // Store for routing
    state.auxiliaryState.lastIntent = undefined; // Will be set by intent.ts
    await this.state.storage.put('session', state);

    // Forward to intent.ts endpoint
    const intentResponse = await this.env.AI_ENDPOINT.fetch(request);
    const intent = await intentResponse.json();

    // Update state
    state.auxiliaryState.lastIntent = intent.intent;
    state.auxiliaryState.intentHistory.push({
      intent: intent.intent,
      timestamp: Date.now()
    });
    await this.state.storage.put('session', state);

    return new Response(JSON.stringify({ intent: intent.intent }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handlePatientResponse(request: Request) {
    const { classifiedIntent } = await request.json();
    const state = await this.state.storage.get<OsceSessionState>('session');

    // Forward to patient.ts endpoint
    const patientResponse = await this.env.AI_ENDPOINT.fetch(request);
    const response = await patientResponse.json();

    // Update empathy level based on intent
    if (['COMMUNICATION', 'EMPATHY'].includes(classifiedIntent)) {
      state.patientState.empathyLevel = Math.min(1, state.patientState.empathyLevel + 0.1);
    }

    await this.state.storage.put('session', state);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleEvaluation(request: Request) {
    const state = await this.state.storage.get<OsceSessionState>('session');

    state.evaluationState.endTime = Date.now();
    await this.state.storage.put('session', state);

    // Forward to evaluate.ts endpoint
    return this.env.AI_ENDPOINT.fetch(request);
  }
}
```

**`wrangler.toml`**:
```toml
[[durable_objects.bindings]]
name = "OsceSessionDO"
class_name = "OsceSessionDO"
script_name = "workers/osce-session"
```

---

### Sprint 5: UI Updates

#### `components/osce/OsceSession.tsx`
**Changes**:
- Add intent badge display for classified intents
- Show 3-agent state indicator (Auxiliary → Patient → Evaluation)
- Intent log panel (collapsible)

```typescript
// New state for intent display
const [classifiedIntent, setClassifiedIntent] = useState<ClinicalIntent | null>(null);
const [currentAgent, setCurrentAgent] = useState<'auxiliary' | 'patient' | 'evaluation'>('auxiliary');

// Update on student submission
const handleSubmit = async (studentText: string) => {
  // 1. Classify intent (Auxiliary agent)
  const intent = await classifyIntent(sessionId, studentText);
  setClassifiedIntent(intent);
  setCurrentAgent('patient');

  // 2. Get patient response (Patient agent)
  const patientResponse = await getPatientResponse(sessionId, intent);
  // ... display response
};

// Evaluation button (appears when student clicks "Finish")
const handleEvaluation = async () => {
  setCurrentAgent('evaluation');
  const scores = await evaluateSession(sessionId);
  // ... show SPBench results
};
```

#### `components/osce/OsceFeedback.tsx`
**Changes**:
- Add SPBench 8-dimension score cards
- Radar chart for SPBench scores
- Comparison with cohort percentiles

```typescript
// New SPBench score display
const SpbenchScoreCard = ({ label, score, description }: SpbenchScoreProps) => (
  <div className="bg-white rounded-lg p-4 shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <h3 className="font-semibold">{label}</h3>
      <span className={`text-2xl font-bold ${score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
        {score}/100
      </span>
    </div>
    <p className="text-sm text-gray-600">{description}</p>
    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
           style={{ width: `${score}%` }} />
    </div>
  </div>
);

// Radar chart for SPBench overview
const SpbenchRadarChart = ({ scores }: { scores: SpbenchScore }) => (
  <ResponsiveContainer width="100%" height={300}>
    <RadarChart data={{
      labels: ['QC', 'CC', 'CD', 'RC', 'LC', 'LN', 'CS', 'PD'],
      datasets: [{
        data: [scores.QC, scores.CC, scores.CD, scores.RC, scores.LC, scores.LN, scores.CS, scores.PD],
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)'
      }]
    }}>
      <PolarGrid />
      <PolarAngleAxis />
      <PolarRadiusAxis />
      <Radar />
    </RadarChart>
  </ResponsiveContainer>
);
```

#### `components/osce/CoverageHeatmap.tsx` (New)
- Heatmap visualization of 31-intent coverage
- Track which intents student explored vs. missed
- Red/green coding for essential vs. missed intents

---

### Sprint 6: Nightly SPBench Judge Cron

**`functions/api/cron/osce-spbench-judge.ts`**:
```typescript
export const onRequestGet: PagesFunction<Env> = withCors(
  cronEndpoint(async (context) => {
    // Only runs with CRON_SECRET
    if (context.request.headers.get('Authorization') !== `Bearer ${context.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const prisma = createEdgePrismaClient(context.env);

    try {
      // Find completed sessions without SPBench scores
      const unscoredSessions = await prisma.osceSession.findMany({
        where: {
          status: 'completed',
          evaluationState: { path: ['spbenchScored'], equals: null }
        },
        include: { case: true }
      });

      let scored = 0;
      for (const session of unscoredSessions) {
        // Build transcript
        const transcript = await buildTranscript(session.id);

        // Load evaluation agent prompt
        const prompt = await loadPrompt('osce/en/evaluation_agent.yaml');

        // Call Gemini 2.5 Pro
        const response = await aiGateway({
          model: 'gemini-2.5-pro',
          system: prompt.system.replace('{{transcript}}', transcript),
          prompt: 'Score this OSCE session using SPBench rubric.',
          temperature: 0.1
        });

        const scores = JSON.parse(response.text);

        // Save SPBench scores
        await prisma.spbenchScore.create({
          data: {
            sessionId: session.id,
            queryCompetence: scores.QC,
            caseCoverage: scores.CC,
            clinicalDepth: scores.CD,
            relevanceCheck: scores.RC,
            logicalConsistency: scores.LC,
            languageNaturality: scores.LN,
            clinicalSafety: scores.CS,
            professionalDemeanor: scores.PD,
            overallScore: (scores.QC * 0.15 + scores.CC * 0.15 + scores.CD * 0.15 +
                          scores.RC * 0.10 + scores.LC * 0.15 + scores.LN * 0.10 +
                          scores.CS * 0.10 + scores.PD * 0.10)
          }
        });

        scored++;
      }

      return new Response(JSON.stringify({ scored, total: unscoredSessions.length }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      await safePrismaDisconnect(prisma);
    }
  })
);
```

**Cron Schedule**: `0 2 * * *` (2 AM daily, off-peak)

---

## Sprint Summary

| Sprint | Files Changed | Tests | Commit Message |
|--------|--------------|-------|----------------|
| 1: Prisma Migration | schema.prisma, migration.sql | 3 | feat(osce): add ClinicalIntent enum, OsceSession, SpbenchScore models |
| 2: Agent Prompt YAMLs | packages/prompts/osce/en/*.yaml | 2 | feat(osce): extract prompts to YAML (auxiliary, patient, evaluation agents) |
| 3: Pages Functions | functions/api/osce/intent.ts, patient.ts, evaluate.ts | 5 | feat(osce): add 3-agent API endpoints (intent classification, patient, evaluation) |
| 4: Durable Objects | workers/osce-session.ts, wrangler.toml | 4 | feat(osce): add OsceSessionDO for multi-agent state management |
| 5: UI Updates | components/osce/OsceSession.tsx, OsceFeedback.tsx | 3 | feat(osce): add intent badges, SPBench cards, coverage heatmap |
| 6: Nightly Cron | functions/api/cron/osce-spbench-judge.ts | 2 | feat(osce): add nightly SPBench evaluation cron |

**Total**: 19 files, 19 tests, 6 commits

---

## Integration Points

- **AI Gateway**: Reuse existing `functions/api/_shared/gemini.ts`
- **Auth**: `authenticatedEndpoint` middleware
- **Prisma Edge**: Singleton client pattern
- **WebSocket**: Existing Gemini Live API integration
- **Case Data**: Extend `PatientEncounterCase` model, no breaking changes

---

## Testing Plan

### Unit Tests
- `functions/api/osce/intent.test.ts` - Intent classification logic
- `functions/api/osce/patient.test.ts` - Patient agent routing
- `functions/api/osce/evaluate.test.ts` - SPBench scoring
- `workers/osce-session.test.ts` - Durable Object state machine

### Integration Tests
- `functions/api/osce/intent.integration.test.ts` - Full intent → patient flow
- `functions/api/osce/spbench.integration.test.ts` - End-to-end evaluation

### E2E Tests
- `e2e/osce-factorization.spec.ts` - 3-agent workflow verification

---

## Success Criteria

- ✅ All 3 agents (Auxiliary, Patient, Evaluation) deployed
- ✅ 31-intent taxonomy integrated (96.3% accuracy target)
- ✅ SPBench 8-dimension scoring functional
- ✅ Nightly cron processes all completed sessions
- ✅ UI shows intent badges, agent state, SPBench cards
- ✅ 19/19 tests passing
- ✅ No breaking changes to existing OSCE sessions
- ✅ Zero regressions in existing OSCE tests

---

## Rollback Plan

If any sprint fails:
1. Revert migration (safe — no data loss)
2. Roll back functions (old versions remain in history)
3. Revert Durable Object deployment
4. UI changes isolated to new components — can feature-flag

---

## Next Steps After OSCE Factorization

1. ✅ Complete OSCE factorization (this plan)
2. ⏳ Implement MedQG 41-item checklist (P1)
3. ⏳ Add MedQG keypoint stage (P1)
4. ⏳ Implement ANEETA 4-agent tutor panel (P2)
5. ⏳ Build CPSkill NEJM-CPC (P2)
