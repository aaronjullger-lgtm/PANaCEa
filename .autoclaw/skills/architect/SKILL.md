---
name: autoclaw-architect
description: Design changes for PANaCEa. Choose simplest durable architecture. Output options, chosen path, tradeoffs, risks, and rollback plan. Use for any multi-file design decision.
mode: architect
---

# Architect Mode — PANaCEa Design Decisions

## Purpose
Design the right solution before implementing. Write Architecture Decision Records.

## When to Use
- Multi-file changes (>3 files)
- New feature design
- Refactoring strategy
- Pattern selection (state management, data flow, routing)
- Before any Builder mode work on non-trivial features

## Workflow
1. Understand requirements from task/scout output
2. List 2-3 approaches with tradeoffs
3. Pick recommendation with rationale
4. Document as ADR in .autoclaw/decision-log.md
5. Output implementation plan

## Output Format
```
## Architect: {feature/task}

### Options
1. **{Option A}** — {approach} | Risk: {L/M/H} | Complexity: {L/M/H}
2. **{Option B}** — {approach} | Risk: {L/M/H} | Complexity: {L/M/H}

### Recommendation: {Option X}
**Why:** {rationale in 2-3 bullets}
**Tradeoffs:** {what we give up}
**Files touched:** {list, ≤8 files}
**Rollback:** {how to undo}
**Risks:** {what could go wrong}

### Implementation Sprints
1. {sprint 1 description} ({1-2 files})
2. {sprint 2 description} ({1-2 files})
```

## Rules
- Always present at least 2 options
- Prefer simplest approach that meets requirements
- Prefer existing patterns over novel ones
- Prefer completing existing code over rewriting
- Document decision in .autoclaw/decision-log.md
- Keep designs to existing architecture — no paradigm shifts without explicit approval

## Coordination
- **Receives from:** Scout (exploration findings), Orchestrator (task routing), Product (UX decisions)
- **Hands off to:** Builder (implementation sprints)
- **Dependencies:** `.autoclaw/project-map.md`, `.autoclaw/decision-log.md`, `docs/autoclaw/coordination/risk_register.md` (for RISK-001 through 007)

## Pre-Flight
```bash
# Read current architecture state
cat .autoclaw/project-map.md
cat .autoclaw/decision-log.md | tail -30
# Check risk register for affected subsystems
grep -A5 "RISK-" docs/autoclaw/coordination/risk_register.md
```

## Common Pitfalls
- **Over-engineering:** YAGNI — design for what's needed now, not hypothetical future
- **Paradigm drift:** Stay within existing architecture (React+Edge+Prisma+Clerk)
- **Ignoring risk register:** RISK-001 (FSRS), RISK-002 (Session), RISK-003 (Edge Auth) are critical
