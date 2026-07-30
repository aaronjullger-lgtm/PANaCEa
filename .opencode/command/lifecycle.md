---
description: Full development lifecycle — spec → plan → build → review → verify → ship. Composes agents and skills into a staged workflow.
agent: orchestrator
---

Run the full development lifecycle for:

$ARGUMENTS

## Pipeline Stages
Each stage invokes the right skill and agent. Stages gate on the previous stage passing.

### 1. SPEC — Define what to build
- Load `spec-driven-development` skill
- Output: PRD document covering objectives, structure, testing, boundaries
- Gate: spec document written and approved

### 2. PLAN — Break it down
- Load `planning-and-task-breakdown` skill
- Decompose spec into small, verifiable tasks with acceptance criteria
- Output: task list with dependency ordering, file paths, verification steps
- Gate: plan approved

### 3. BUILD — Implement incrementally
- Load `incremental-implementation` + `test-driven-development` skills
- One thin vertical slice at a time: implement, test, verify, commit
- Use `@edge-api`, `@fsrs-guard`, or `@session-pipeline` for domain work
- Output: working code with passing tests
- Gate: all tests pass, diagnostics clean

### 4. REVIEW — Quality gate
- Load `code-review-and-quality` skill
- Invoke `@security-reviewer` if API/auth/data touched
- Flag blocking issues, warnings, nits
- Gate: no blocking issues

### 5. VERIFY — Automated gates
- Load `test-driven-development` + `ci-cd-and-automation` skills
- Run focused tests, typecheck, lint
- Gate: `npx vitest run <path>`, `npm run typecheck:ci` pass

### 6. SHIP — Pre-deploy
- Load `shipping-and-launch` skill
- Run full pre-deploy gates (build, test:critical, edge scan)
- Gate: ship readiness report green

## Auto-mode
`/lifecycle auto` — runs all stages autonomously with checkpoint approval at each gate.
`/lifecycle <stage>` — runs from the named stage forward.
`/lifecycle <stage> --skip-gates` — runs named stage without previous gates.

## Context engineering
Before each stage, run `context-engineering` skill to pack relevant rules, patterns, and MCP integrations.
