---
name: "panacea-osce-simulation"
description: "Use this skill for PANaCEa OSCE, virtual patient, SOAP note, clinical simulation, grading rubric, standardized-patient behavior, scoring, feedback, station flow, and AI-mediated encounter work."
---

# PANaCEa OSCE Simulation

Use for simulated encounters, OSCE station flow, SOAP grading, patient state, and rubric feedback.

## First Files

- `components/osce/*` and `pages/SimulationPage.tsx`
- `routes/osce.ts` only for local legacy context; production behavior belongs in `functions/api/osce*` or existing Edge routes
- `workers/osce-session.ts`
- `lib/services/soapGradingService.ts`
- `lib/services/soapAnalyticsService.ts`
- `lib/services/osceStructuralScorer.ts`
- `functions/api/cron/osce-spbench-judge.ts`
- `scripts/seed-osce-cases.ts` and `scripts/seed-osce-rubrics.ts`
- `types/osce-enhanced.ts`, `types/patient-av-state-machine.ts`, `types/custom-session.ts`

## Clinical Simulation Rules

- Separate patient persona/state, learner actions, rubric scoring, and feedback generation.
- Grading should be rubric-grounded and explainable, not a free-form vibe check.
- Preserve safety boundaries: AI feedback can tutor but should not present itself as real clinical advice.
- SOAP scoring must distinguish structure, clinical reasoning, omissions, and unsafe statements.
- Do not make SP behavior reveal hidden diagnosis too early unless the station script calls for it.

## Workflow

1. Identify the station surface: setup, live encounter, note writing, grading, analytics, or admin seed data.
2. Trace the data model and types before editing prompts or scoring.
3. Keep deterministic scoring helpers separate from AI prompt generation.
4. Add fixtures for rubrics/cases when changing scoring logic.
5. Verify end-to-end station flow if UI and API both change.

## Prompt And AI Rules

- Keep prompt changes small and testable.
- Preserve rubric anchors, red flags, and required actions in structured form.
- Prefer structured JSON outputs validated by schema when scores drive UI or persistence.
- Log enough metadata for audit/debug without storing sensitive free text unnecessarily.

## Validation

- Unit tests for deterministic rubric/scoring functions.
- Endpoint tests for grading contracts and validation errors.
- Playwright for station flow, note submission, and feedback rendering.
- Clinical safety review for new rubric domains or patient advice surfaces.

## Common Traps

- Updating local Express OSCE routes while production Edge behavior remains unchanged
- Letting AI generate scores without schema validation
- Mixing learner-facing feedback with admin/audit scoring details
- Breaking station timers, turn-taking, or note state when changing layout
- Creating cases that are educationally rich but not aligned to PA board objectives
