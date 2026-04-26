# PANaCEa Integration Audit Summary
**Date**: 2026-04-24 | **Sprint**: Integration Roadmap | **Status**: Audit Complete

## Executive Summary

Three parallel audits completed for OSCE, Question Authoring, and Tutor/FSRS subsystems. All findings consolidated for EasyMED OSCE factorization planning.

---

## Audit 1: Existing OSCE Implementation

### Current State
- **Voice Model**: Gemini 2.5 Flash Native Audio (Aoede voice)
- **Text Model**: Gemini 2.0 Exp (fallback to 2.0 Flash)
- **Architecture**: Single LLM patient agent with tool-supported vitals
- **WebSocket Protocol**: Gemini Live API with real-time audio streaming
- **Case Storage**: `PatientEncounterCase` model (seeded via scripts)
- **Scoring**: Hybrid - Structural (85 pts instant) + AI reasoning (15 pts, 3-8s)
- **Rubric System**: 5-checklist structure (History, PE, Dx, Management, Communication)

### Key Files
- `functions/api/osce/live.ts` - WebSocket bootstrap
- `functions/api/osce/live-engine.ts` - Unified Live API config
- `services/domain/osceService.ts` - Core OSCE service
- `services/domain/osceScoringEngine.ts` - Comprehensive scoring
- `lib/services/osceStructuralScorer.ts` - Instant structural scoring
- `components/osce/*` - UI components (OsceSession, OsceFeedback)

### Prisma Models
```prisma
model PatientEncounterCase {
  id, patientName, chiefComplaint, age, sex
  vitalSigns (Json), historyData (Json), physicalExamData (Json), labData (Json)
  essentialQuestions[], helpfulQuestions[], unnecessaryQuestions[]
  correctDiagnosis, differentialDiagnoses[], idealWorkup[], teachingPoints[]
}

model PatientEncounterSession {
  userId, caseId, status (active|completed)
  messages (Json), physicalFindings (Json?), diagnosticOrders (Json?)
  diagnosis?, treatmentPlan?, telemetry (Json?)
}

model OsceResult {
  sessionId (unique), score, checklist (Json), redFlagsMissed[]
  clinicalReasoningScore, softSkillsReport (Json?), communicationScore?
}
```

### Limitations
- **Single LLM**: No factorization (Auxiliary + Patient + Evaluation agents)
- **Hardcoded prompts**: System instruction embedded in code
- **No intent classification**: Patient responses not taxonomized
- **No SPBench rubric**: Custom 5-checklist system
- **Limited case variety**: ~10 hardcoded scenarios
- **No post-hoc rubric scorer**: AI reasoning only, no structured post-session evaluation

---

## Audit 2: Question Authoring Pipeline

### Current State
- **Generation Model**: Gemini 2.5 Flash via AI Gateway
- **Prompt Style**: Few-shot with Kaplan-level taxonomy
- **Stages**: Condition retrieval → Grounding → PubMed → Textbook → PANCE anchors → Generation → Post-processing
- **Embedding Model**: Gemini text-embedding-004 (768 dims)
- **Vector DB**: pgvector with HNSW IVFFlat (lists=100, cosine)
- **Validation**: Source grounding (30% keyword overlap), structure, difficulty scoring

### Key Files
- `functions/api/questions/generate.ts` - Main generation endpoint
- `functions/api/_shared/question-generator.ts` - Core logic
- `lib/services/autoAuthor/contentGenerator.ts` - Bulk content generation
- `lib/services/autoAuthor/langchainContentGenerator.ts` - LangChain integration

### Prisma Models with Vectors
```prisma
model QuestionEmbedding {
  questionId, embedding (vector(768)), embeddingModel
}

model MedicalContentEmbedding {
  contentId, embedding (vector(768))
}

model ContentChunk {
  embedding (vector(768)), source, chunkType
}
```

### MedQG Integration Opportunity
- **Similarity**: Both use few-shot, but MedQG has explicit 3-stage flow (topic→keypoint→question) + 41-item NBME self-refine
- **Gap**: PANaCEa has no self-refine checklist, no explicit keypoint extraction stage
- **Action**: Add MedQG 41-item checklist to post-processing, implement keypoint stage

---

## Audit 3: Tutor Surfaces & FSRS

### Tutor Surfaces
1. **Socratic Tutor**: `/functions/api/ai/learning/socratic.ts` → ZPD-calibrated remediation
2. **Drill Explanations**: Integrated in `drillReviewService.ts` with Ghost Grader
3. **Dashboard Planner**: `dashboardPersonalization.ts` → 5 learner-stage configs
4. **Wrong-Answer Explainer**: Via Ghost Grader + `explanationEngagementService.ts`
5. **Chat Endpoints**: `/functions/api/tutor/chat.ts`, `/functions/api/ai/tutor/chat.ts`

### ANEETA Integration Opportunity
- **Similarity**: 4-agent structure (Mentor/Teacher/Trainer/Doubt Solver)
- **Gap**: PANaCEa has single socratic endpoint, no multi-persona orchestration
- **Action**: Implement 4-agent tutor panel with Coach/Attending/Debriefer layer

### FSRS State
- **Version**: Custom PANaCEa v6 (21 parameters w[0]..w[20])
- **Rating**: Binary Again/Good only (Hard/Easy deprecated)
- **Dependencies**: `fsrs-browser@5.2.0`, `fsrs.js@1.2.2` (custom impl dominates)
- **PersonalizedFSRSParams**: Found in schema - per-user param customization
- **Optimizer**: None found - no per-user optimization cron
- **Version Selector**: `lib/fsrs-version-selector.ts` → prefers persisted tag, falls back to `w.length`

### Prisma Model
```prisma
model PersonalizedFSRSParams {
  userId, params (Json), version, lastCalibrated
  requestCount, successCount, retentionRate
  w0..w20 (individual params), stability, difficulty
}
```

---

## Integration Matrix Summary

| Integration | Complexity | Value | Prio | Status |
|------------|------------|-------|------|--------|
| **EasyMED OSCE factorization** | High | High | P0 | Planning |
| **MedQG 41-item checklist** | Low | Medium | P1 | Ready |
| **MedQG keypoint stage** | Medium | Medium | P1 | Ready |
| **ANEETA 4-agent tutor panel** | High | Medium | P2 | Pending |
| **CPSkill NEJM-CPC** | Very High | High | P2 | Pending |

---

## Next Steps

1. ✅ OSCE audit complete
2. ✅ Question authoring audit complete
3. ✅ Tutor/FSRS audit complete
4. 🔄 **IN PROGRESS**: Write OSCE factorization plan (Task 6)
5. ⏳ Prioritize integration roadmap (P0+P1 items)
6. ⏳ Generate drop-in Claude Code plans for P0 integrations
