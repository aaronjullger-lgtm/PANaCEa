---
name: "panacea-fsrs-guardrails"
description: "Use this skill whenever a task touches FSRS, spaced repetition, review scheduling, retrievability, stability, difficulty, implicit metrics, par time, Ghost Grader, or drill review submission in PANaCEa. It protects repo-specific scheduler rules and prevents incorrect four-button FSRS assumptions."
---

# PANaCEa FSRS Guardrails

Read these first when the task touches scheduler logic:

- `AGENTS.md`
- `lib/fsrs.ts`
- `lib/implicit-metrics.ts`
- `hooks/useDrillFSRS.ts`
- `lib/services/drillReviewService.ts`

## Core Rules

- Student-facing review is binary: `Again` / `Good`
- Do not add `Hard` / `Easy` UI
- Internal enum values still follow FSRS conventions:
  - `Again = 1`
  - `Hard = 2`
  - `Good = 3`
  - `Easy = 4`

## Important Domain Invariants

- Only real `MAIN` and `DRILL` flows should update FSRS
- Respect MVRT / rapid-guess filtering before scheduling updates
- `grade_continuous` is `1.0-4.0`
- `retrievability` is `0.0-1.0`
- `stability` is in days
- Par time and behavioral telemetry are part of the rating pipeline, not optional extras

## Change Boundaries

- Treat rating-logic changes and parameter changes as approval-required
- When debugging scheduler behavior, inspect implicit metrics and Ghost Grader inputs before changing FSRS math
- Prefer adding tests around pure scheduling logic before touching live submission flows

## Common Failure Modes

- Accidentally assuming four student-facing rating buttons
- Updating FSRS from cram or non-real review flows
- Ignoring par-time or telemetry-derived rating adjustments
- Changing frontend labels without preserving backend enum expectations
