---
name: osce-architect
description: "Design, review, and fix OSCE (clinical simulation) flows in PANaCEa — including patient encounter engines, grading rubrics, transcript handling, clinical reasoning scaffolds, and station configuration. Use this skill whenever working on OSCE mode, clinical simulation, patient encounter UI, OSCE grading, standardized patient interactions, or any live clinical reasoning exercise — even if the user just says 'OSCE is broken' or 'the simulation feedback is wrong'."
tags: [osce, clinical-simulation, grading, patient-encounter, clinical-reasoning]
composesWith: [ai-generation-safety, clinical-content-gen, clinical-safety-review]
---

## Purpose
OSCE (Objective Structured Clinical Examination) mode must feel like a real clinical encounter with accurate, fair grading. Every patient interaction, transcript, grade, and feedback loop must maintain clinical integrity and psychological safety for learners.

## Architecture Overview

### Live Engine Flow
1. **Live Engine** (`functions/api/osce/live-engine.ts`) — Orchestrates real-time patient interaction:
   - Manages session state (patient history, physical exam findings, diagnostic results)
   - Calls Gemini 3 with extended thinking for patient responses
   - Handles concurrent candidate + standardized patient transcript streams
   - Enforces time limits and station progression

2. **Transcript Pipeline** → Persistence → Grading → Feedback:
   - Candidate actions (questions asked, exams performed) streamed to transcript
   - Standardized patient (AI) responds with clinical realism
   - Both stored in OSCE session database
   - Scoring engine consumes transcript post-session

3. **Grading Loop** (`functions/api/osce/analysis/`) — Multi-dimensional scoring:
   - Clinical reasoning scaffold validates decision trees
   - Scoring dimensions (history depth, exam thoroughness, differential reasoning) evaluated
   - Rubric compliance checked against station expectations
   - Feedback generated from reasoning trace

### Key Files & Responsibilities
| Path | Role |
|------|------|
| `components/osce/LiveInterface.tsx` | Candidate UI; question input, exam selection, timer |
| `components/osce/AudioInterface.tsx` | Voice/audio capture for natural patient interaction |
| `components/osce/SOAPNoteTrainer.tsx` | SOAP note drafting with real-time feedback |
| `components/osce/DifferentialDiagnosisRanker.tsx` | Guides differential reasoning; surfaces omissions |
| `functions/api/osce/live-engine.ts` | Patient logic; state machine; transcript mgmt |
| `functions/api/osce/live.ts` | Candidate session endpoint; auth; state sync |
| `functions/api/osce/chat.ts` | Chat/question API for candidate-to-patient communication |
| `functions/api/osce/complete.ts` | Session completion; triggers grading analysis |
| `lib/osce/clinicalReasoningScaffold.ts` | Decision tree validation; missing reasoning detection |
| `types/osce-enhanced.ts` | Session, transcript, grading data shapes |
| `config/osce-settings.ts` | Station config, time limits, rubric templates |
| `AUDIT_OSCE_MODE.md` | Known issues, recent migrations, compliance checklist |

## Station Design Patterns

### History Taking
- Patient remembers all details; candidate must ask strategically
- Scoring: chief complaint coverage, red flag screening, systems review depth
- Guard against: leading questions, skipped pertinent negatives

### Physical Exam
- Predetermined findings (normal/abnormal); candidate selects exam focus
- Scoring: appropriate exam selection, interpretation accuracy, procedural technique
- Guard against: exam overload (cognitive bias), missed key findings

### Clinical Reasoning
- Differential diagnosis generation required before "diagnosis"
- Scoring: breadth (number of considerations), ranking logic, supporting evidence
- Guard against: confirmation bias, premature closure

### Diagnostic Result Interpretation
- Labs/imaging returned with realistic delay; candidate must synthesize
- Scoring: result interpretation accuracy, integration into reasoning, impact on management

## Grading Rubric Integrity
- **Scoring Dimensions** (post-2026-04-01 migration): history, exam, reasoning, synthesis
- **Clinical Reasoning Scaffold** validates that candidate's reasoning chain is sound
- **Confidence Calibration**: scoring normalized to station difficulty + candidate baseline
- **Blind Spots Detection**: algorithm flags missing elements (e.g., unasked screening questions, ignored findings)

## Transcript Handling
- **Streaming**: candidate actions streamed in real-time; patient responses returned via Gemini
- **Persistence**: session transcript stored (candidate utterances, timestamps, exam selections, results)
- **Replay**: full session playback available for review, self-assessment, faculty feedback
- **Streaming Timeout Risk**: Gemini extended thinking may exceed request budget; fallback to structured response required

## Common Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Gemini timeout during live sim | Request payload too large; extended thinking exhausted | Cap thinking tokens; batch patient history summary |
| Grading inconsistency | Scoring dimensions misaligned across stations | Sync `config/osce-settings.ts` with `clinicalReasoningScaffold.ts` |
| Lost transcript | Session crash mid-stream; incomplete persistence | Ensure `safePrismaDisconnect()` in finally blocks; idempotent writes |
| Feedback is vague | Rubric doesn't map to actionable learning | Feedback engine must cite specific missed elements (e.g., "No screening for chest pain risk factors") |
| AI patient breaks character | Temperature too high; response incoherent | Validate Gemini system prompt; use `temperature: 0.5–0.7` |

## What "Good" Looks Like
✅ Candidate feels immersed in real clinical encounter
✅ Grading transparent: feedback cites exact reasoning gaps
✅ Transcript complete & auditable (timestamps, all candidate actions)
✅ Session completes in <20s (no Gemini timeout)
✅ Rubric scoring stable across cohorts (inter-rater reliability ≥0.85)
✅ Coaching feedback drives actual learning (post-OSCE score improvement measurable)

## Next Steps
1. Verify `clinicalReasoningScaffold.ts` mappings match all station rubrics
2. Add transcript validation test (no orphaned actions)
3. Implement Gemini timeout recovery (graceful fallback response)
4. Run inter-rater reliability audit on sample scored sessions
