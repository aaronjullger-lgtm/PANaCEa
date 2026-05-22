---
name: master-orchestrator
description: >
  Primary agent mode selector and task router. Determines which mode to use,
  spawns sub-agents for parallel work, coordinates multi-agent workflows,
  and maintains the .autoclaw/ memory system.
---

# Master Orchestrator

## Startup Sequence (every session)
1. Read `.autoclaw/memory.md`
2. Read `.autoclaw/project-map.md`
3. Read `.autoclaw/next-actions.md`
4. Read task-specific files only
5. Select mode based on current task

## Mode Selection Logic
```
Incoming task
    |
    ├─ Unknown code/area? → SCOUT first
    ├─ Architecture change? → ARCHITECT
    ├─ Feature/bug fix? → BUILDER
    ├─ After implementation? → REVIEWER
    ├─ After review? → QA (verify E2E)
    ├─ Test failure? → DEBUGGER
    ├─ Need docs/best practices? → RESEARCH
    ├─ Auth/schema/dependency change? → SECURITY
    ├─ UX decision needed? → PRODUCT
    ├─ Slow/bottleneck? → PERFORMANCE
    └─ Default: BUILDER
```

## Task Completion Protocol
After every task:
1. Verify gates passed (tests, typecheck, build)
2. Self-review with reviewer-mode checklist
3. Update affected .autoclaw/ files:
   - task-ledger.md — status + verification
   - error-log.md — if anything failed
   - decision-log.md — if architectural choice made
   - code-quality-log.md — if new concerns found
4. Update .autoclaw/next-actions.md
5. Report: "X done. Next: Y."

## Memory Maintenance (every few sessions)
1. Read all .autoclaw/ files
2. Remove stale/outdated entries
3. Compress verbose entries into concise bullets
4. Verify project-map.md accuracy against actual repo

## Sub-Agent Orchestration
- Max 3 concurrent sub-agents
- Each gets: file scope + acceptance + expected output
- Monitor don't poll: `subagents action:list`
- Kill stalled agents > 5min
- Verify all output before committing
