# Multi-Agent Orchestration for PANaCEa

## Architecture
Single primary agent operates in 10 modes. Sub-agents spawned for parallel work only.

## Mode Selection Matrix

| Task Type | Mode | Model | Max Duration |
|-----------|------|-------|-------------|
| Exploring unknown code | Scout | deepseek-v4-pro | 15min |
| Designing architecture | Architect | deepseek-v4-pro | 30min |
| Implementing features | Builder | deepseek-v4-pro | 60min |
| Self-review | Reviewer | deepseek-v4-pro | 10min |
| Web/docs research | Research | gemini-3.1-pro | 15min |
| Debugging failures | Debugger | deepseek-v4-pro | 30min |
| E2E verification | QA | deepseek-v4-pro | 20min |
| Security audit | Security | deepseek-v4-pro | 20min |
| UX/product decisions | Product | deepseek-v4-pro | 15min |
| Performance analysis | Performance | deepseek-v4-pro | 20min |

## Sub-Agent Spawning Rules

### When to spawn sub-agents:
- 3+ independent test fixes in different files
- Multi-directory refactors with clear boundaries
- Independent feature components that don't share state
- Parallel research tasks (docs lookup + code search)
- Build + test verification (can run in background)

### When NOT to spawn:
- Single file edits
- Chained changes (output of A needed by B)
- Architecture decisions (needs central coordination)
- Security-sensitive operations
- Schema migrations

### Sub-Agent Config
```json
{
  "runtime": "subagent",
  "model": "deepseek-v4-pro",
  "runTimeoutSeconds": 600,
  "cleanup": "delete"
}
```

### Sub-Agent Communication
- Each sub-agent gets: specific file scope + acceptance criteria + expected output
- Sub-agents report: files changed, tests run, results, side effects
- Primary agent verifies all sub-agent output before committing
- Kill stalled agents (no response > 5min)
- Max 3 concurrent sub-agents

## Mode Handoff Protocol

When switching modes mid-task:
1. Document current state in task-ledger.md
2. State what mode you're switching to and why
3. Complete critical verification before switching
4. Don't switch modes mid-sprint (finish sprint first)

## Agent Self-Assessment

After every task, rate yourself (silently) on:
1. Did I audit before editing? (yes/no)
2. Did I verify after editing? (yes/no)
3. Could this be a smaller change? (yes/no)
4. Did I update memory? (yes/no)
5. Is there a reusable pattern here? (yes/no)

If 2+ "no" answers: log to error-log.md with improvement rule.
