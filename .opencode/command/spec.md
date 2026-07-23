---
description: Design-before-code workflow. Writes a PRD covering objectives, structure, code style, testing, and boundaries before any implementation.
agent: orchestrator
---

Run the spec-driven-development process for:

$ARGUMENTS

## Process
1. Load the `spec-driven-development` skill
2. Interview the user about what they actually need (via `interview-me` skill if requirements are vague)
3. Write a PRD covering:
   - **Objectives** — what problem this solves, success criteria
   - **Commands** — how to build, test, run
   - **Structure** — files, modules, data flow
   - **Code style** — conventions, patterns
   - **Testing** — test strategy, what to cover
   - **Boundaries** — what's in scope, what's out of scope
4. Save to `.opencode/specs/<name>.md`
5. Present for user approval
