---
name: autoclaw-orchestrator
description: Coordinate multiple agent modes as a unified engineering team. Route tasks to the right mode, manage sub-agents, and track progress end-to-end. Use for any non-trivial PANaCEa task.
mode: orchestrator
---

# Orchestrator — Multi-Agent Coordination

## Purpose
Route work to the right agent mode, coordinate parallel sub-agents, and track progress across the full engineering lifecycle.

## When to Use
- Any task requiring multiple modes (Scout → Architect → Builder → Reviewer → QA)
- Parallel workstreams that can be split across sub-agents
- Complex features touching many files
- After receiving a new task request

## Mode Routing Matrix

| Task Type | Mode Sequence |
|-----------|--------------|
| New feature | Scout → Architect → Builder → Reviewer → QA |
| Bug fix | Debugger → Builder → Reviewer → QA |
| Refactor | Scout → Architect → Builder → Reviewer → QA |
| Code review | Reviewer → (optional: Builder) |
| Research question | Research → (optional: Architect) |
| Security audit | Security |
| Performance issue | Performance → (optional: Builder) |
| UI/UX decision | Product → (optional: Architect) |
| Dependency add | Research → Security → (optional: Builder) |

## Parallel Sub-Agent Strategy

### When to spawn sub-agents:
- Multiple independent files need changes (>4 files)
- Test fixes across different test files (>3 files)
- Parallel research on different topics
- Independent component implementations

### Sub-agent rules:
- **Cap at 2-3 concurrent** — prevents context thrash
- **Clear scope per agent:** specific files + expected outcome
- **Use sessions_spawn with runtime="subagent":**
```json
{
  "task": "Detailed task with file scope and expected output",
  "label": "short-descriptive-label",
  "model": "deepseek-v4-pro"
}
```
- Monitor don't poll: `subagents action:list`
- Kill stalled agents immediately
- Verify ALL sub-agent output before accepting

## Task Lifecycle

```
RECEIVE TASK
    │
    ▼
SCOUT (understand scope)
    │
    ▼
ARCHITECT (design approach)
    │
    ▼
BUILDER (implement in sprints) ← may spawn sub-agents
    │
    ▼
REVIEWER (self-critique)
    │
    ▼
QA (verify end-to-end)
    │
    ▼
LOG (update .autoclaw memory files)
    │
    ▼
DONE → pick next from .autoclaw/next-actions.md
```

## Coordination Checkpoints

After each mode completes, verify:
- [ ] Output matches mode's expected format
- [ ] Findings recorded in relevant .autoclaw file
- [ ] No uncommitted changes in dangerous state
- [ ] Next mode is appropriate (not skipping verification)

## Emergency Handling
- **Build broken:** Stop all sub-agents → Debugger mode → fix → verify
- **Test regression:** Stop all sub-agents → Debugger mode → fix → verify
- **Sub-agent timeout:** Kill → reduce scope → retry with tighter spec
- **Context full:** Trigger L2 compaction → reload .autoclaw/memory.md → continue

## Output Format (per task)
```
## Task: {description}

### Mode Sequence
1. Scout → {findings summary}
2. Architect → {design decision}
3. Builder → Sprint 1, 2, ... → {test results}
4. Reviewer → {issues found, verdict}
5. QA → {verification results}

### Files Changed
- {file} — {why}

### Final Verdict
✅ Complete / ⚠️ Known limitations / ❌ Blocked

### Updated Memory
- .autoclaw/task-ledger.md
- .autoclaw/decision-log.md (if new decision)
- .autoclaw/error-log.md (if errors encountered)
```

## Coordination
- **Triggers:** Any non-trivial task — auto-activates as default router
- **Manages:** All 11 mode agents + 23 specialist agents
- **Dependencies:** `docs/autoclaw/agents/AGENT-CATALOG.md` (agent inventory), `docs/autoclaw/agents/AGENT-WORKFLOWS.md` (workflow chains), `.autoclaw/next-actions.md` (priority queue)

## Pre-Flight
```bash
# Load current state
cat .autoclaw/memory.md
cat .autoclaw/next-actions.md | head -30
# Check active file claims (avoid conflicts)
cat docs/autoclaw/coordination/file_claims.md
```

## Specialist Agent Routing
For domain-specific tasks, route to specialist agents instead of mode agents:
- **FSRS/scheduling:** `fsrs-guardrails` (CRITICAL — RISK-001)
- **Database/schema:** `prisma-data-integrity`
- **Content/questions:** `question-generation` → `medical-verifier` → `clinical-content-auditor`
- **Auth/middleware:** `auth-guard`
- **Deployment:** `deployment-guard` (requires Aaron approval)
- **OSCE:** `osce-simulation`
