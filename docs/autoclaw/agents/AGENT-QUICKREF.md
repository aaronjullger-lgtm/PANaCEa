# PANaCEa Agent Quick Reference

## Start Any Task
```
"Work on [feature/bug/refactor]" → Orchestrator auto-routes to correct agents
```

## Mode Agents (11)
| Agent | When to use |
|-------|------------|
| **Scout** | Before touching unfamiliar code |
| **Architect** | Before multi-file changes |
| **Builder** | Implementation (default) |
| **Reviewer** | After every change |
| **Debugger** | Anything broken |
| **QA** | Before claiming done |
| **Security** | Migrations, deploys, external code |
| **Research** | Docs, best practices |
| **Product** | Ambiguous UX |
| **Performance** | Slow/big/suspicious |
| **Orchestrator** | Any non-trivial task |

## Specialist Agents (23)
| Domain | Agent | Trigger |
|--------|-------|---------|
| Coordination | syncytium-coordinator | Multi-agent mission routing |
| Coordination | navigator | Codebase navigation/file discovery |
| Coordination | autonomy-skillsmith-agent | Skill/workflow creation |
| Content | question-generation | "generate questions" |
| Content | clinical-content-auditor | "audit content quality" |
| Content | content-refinery | "ingest PDF/media" |
| Content | medical-verifier | "verify medical accuracy" |
| Content | blueprint-coverage | "check NCCPA coverage" |
| Learning | session-pipeline | "fix study session" |
| Learning | study-plan | "generate study plan" |
| Learning | fsrs-guardrails | "FSRS scheduling issue" |
| Infra | prisma-data-integrity | "check database health" |
| Infra | identity-migration | "source identity work" |
| Infra | edge-endpoints | "add API endpoint" |
| Infra | repo-hygiene | "clean up branches/files" |
| Quality | regression-guard | "test suite issue" |
| Quality | verify | "run verification" |
| UX | dashboard-analytics | "analytics widget" |
| UX | view-composition | "decompose component" |
| UX | osce-simulation | "OSCE encounter issue" |
| Safety | auth-guard | "auth/permission issue" |
| Safety | deployment-guard | "deploy preparation" |
| Safety | offline-sync | "offline/sync issue" |

## Agent Tools (10, all read-only)
```
Student: clinical_library_search, user_progress_summary, fsrs_due_count
Quality:  content_health_audit, question_quality_check, condition_verify
System:   blueprint_coverage_check, drill_coverage_check
Infra:    database_integrity_check, fsrs_calibration_status
```

## Critical Subsystems (RISK-001 through RISK-003)
- **FSRS:** Load fsrs-guardrails. Run FSRS tests before + after.
- **Session:** Load session-pipeline. Preserve double-submit guards.
- **Edge Auth:** Load auth-guard. Never process.env. Always safePrismaDisconnect.

## Verification Chain
```bash
npm test                          # Full suite: 0 failures required
npm run typecheck                 # Uses tsconfig.production.json
npm run build                     # Production build: must pass
```

## Docs
- Full catalog: `docs/autoclaw/agents/AGENT-CATALOG.md`
- Workflows: `docs/autoclaw/agents/AGENT-WORKFLOWS.md`
- Toolchains: `docs/autoclaw/agents/AGENT-TOOLCHAINS.md`
- Runbooks: `docs/autoclaw/agents/AGENT-RUNBOOKS.md`
