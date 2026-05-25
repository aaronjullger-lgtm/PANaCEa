# PANaCEa Agent Catalog

Complete inventory of all autonomous agents available for StudyPANaCEa development.

---

## Mode Agents (General-Purpose)

These 11 agents form the autonomous engineering cycle. Route any task through the Orchestrator.

| # | Agent | Trigger | Contract | Output |
|---|-------|---------|----------|--------|
| 1 | **Scout** | "explore X", unfamiliar code | Read-only discovery | Findings + file list + next action |
| 2 | **Architect** | "design X", multi-file change | 2+ options + ADR | Recommendation + tradeoffs + sprint plan |
| 3 | **Builder** | "implement X", "fix X" | Sprint-based (1-4 files) | Verified code + test results |
| 4 | **Reviewer** | After every Builder sprint | 6-dimension checklist | Issues found + verdict |
| 5 | **Research** | "research X", docs lookup | Source-priority search | Findings + applicability + caveats |
| 6 | **Debugger** | Tests fail, build breaks | 7-step protocol | Root cause + fix + prevention rule |
| 7 | **QA** | Before "done" | End-to-end user path | Verified flows + issues |
| 8 | **Security** | Migrations, deploys, external code | Blast radius audit | Risks + mitigations |
| 9 | **Product** | Ambiguous UX decisions | User-centered framework | UX decision + states to implement |
| 10 | **Performance** | Slow app, large builds | Measure-first audit | Bottlenecks + optimization targets |
| 11 | **Orchestrator** | Any non-trivial task | Mode routing + sub-agent coordination | Task lifecycle tracking |

### Default Workflow Chain
```
Orchestrator → Scout → Architect → Builder → Reviewer → QA → Done
                     ↓ (optional)
              Research (docs/best practices)
              Debugger (if failures)
              Security (if risky changes)
              Product (if UX ambiguity)
              Performance (if slow)
```

---

## Specialist Agents (Domain-Specific)

20 PANaCEa-domain agents for deep expertise. Invoke by name or task domain.

### Content & Learning Pipeline (5 agents)

| # | Agent | Domain | Key Files | Guardrails |
|---|-------|--------|-----------|------------|
| 12 | **question-generation** | AI question gen, blueprint alignment | `lib/services/autoAuthor/`, `functions/api/questions/` | panacea-content-refinery, panacea-edge-endpoints |
| 13 | **clinical-content-auditor** | Medical accuracy, content quality | `lib/services/content/`, `functions/api/content/` | panacea-content-refinery, panacea-prisma-data-integrity |
| 14 | **content-refinery** | PDF/media ingestion, content enrichment | `scripts/refinery/`, `lib/services/media/` | Standalone |
| 15 | **session-pipeline** | Study session flow, quiz submission | `components/session/QuizView.tsx`, `hooks/useQuizSubmit.ts` | RISK-002 critical subsystem |
| 16 | **study-plan** | Adaptive study scheduling, plan generation | `lib/services/studyPlan/`, `functions/api/study-plan/` | panacea-fsrs-guardrails, panacea-dashboard-analytics |

### Quality & Verification (4 agents)

| # | Agent | Domain | Key Files | Guardrails |
|---|-------|--------|-----------|------------|
| 17 | **regression-guard** | Test coverage, regression prevention | `tests/`, `vitest.config.ts` | panacea-verify |
| 18 | **verify** | Test runner, coverage thresholds | All test commands | Standalone (shared dependency) |
| 19 | **medical-verifier** | Medical accuracy of generated content | `lib/services/agents/tools/conditionVerify.ts` | Clinical domain knowledge |
| 20 | **blueprint-coverage** | NCCPA blueprint alignment audit | `lib/constants/blueprint.ts`, `lib/services/agents/tools/blueprintCoverageCheck.ts` | panacea-content-refinery |

### Infrastructure & Operations (5 agents)

| # | Agent | Domain | Key Files | Guardrails |
|---|-------|--------|-----------|------------|
| 21 | **identity-migration** | Source identity (canonical IDs) | `prisma/migrations/`, `lib/services/identity/` | panacea-prisma-data-integrity, panacea-verify (P0, needs Aaron) |
| 22 | **deployment-guard** | Production readiness, deploy safety | `wrangler.toml`, `.github/workflows/deploy.yml` | release-readiness, security-and-privacy-audit |
| 23 | **repo-hygiene** | Branch cleanup, dead code, root MD | `.github/`, `scripts/` | repo-operating-system |
| 24 | **prisma-data-integrity** | Schema health, migrations, indexes | `prisma/schema.prisma`, `prisma/migrations/` | Standalone |
| 25 | **edge-endpoints** | Cloudflare Edge API patterns | `functions/api/` | RISK-003 critical subsystem (auth/Edge rules) |

### UX & Analytics (3 agents)

| # | Agent | Domain | Key Files | Guardrails |
|---|-------|--------|-----------|------------|
| 26 | **dashboard-analytics** | Analytics widgets, dashboard data | `components/dashboard/`, `lib/services/analytics/` | panacea-session-pipeline |
| 27 | **view-composition** | Component decomposition, layout | `components/modes/`, `components/session/` | Standalone |
| 28 | **osce-simulation** | OSCE clinical encounter mode | `components/modes/osce/`, `hooks/useEnhancedOSCE.ts` | panacea-session-pipeline |

### Safety & Auth (3 agents)

| # | Agent | Domain | Key Files | Guardrails |
|---|-------|--------|-----------|------------|
| 29 | **auth-guard** | Clerk RBAC, auth middleware | `functions/api/_shared/auth.ts`, `lib/auth/` | security-and-privacy-audit |
| 30 | **fsrs-guardrails** | FSRS algorithm safety, binary rating | `lib/fsrs.ts`, `lib/implicit-metrics.ts` | RISK-001 critical subsystem |
| 31 | **offline-sync** | Offline queue, sync manager | `lib/services/sync/`, `components/offline/` | panacea-session-pipeline |

---

## Agent Tools (10 shared)

All specialist agents use these shared tools for read-only system queries:

| Tool | Category | Used By |
|------|----------|---------|
| `clinical_library_search` | Student-facing | question-generation, clinical-content-auditor, study-plan |
| `user_progress_summary` | Student-facing | study-plan, session-pipeline, dashboard-analytics |
| `fsrs_due_count` | Student-facing | study-plan, fsrs-guardrails, dashboard-analytics |
| `content_health_audit` | Content quality | clinical-content-auditor, content-refinery |
| `question_quality_check` | Content quality | question-generation, regression-guard |
| `condition_verify` | Content quality | medical-verifier, clinical-content-auditor |
| `blueprint_coverage_check` | System health | blueprint-coverage, question-generation |
| `drill_coverage_check` | System health | session-pipeline, study-plan |
| `database_integrity_check` | Infrastructure | prisma-data-integrity, identity-migration, repo-hygiene |
| `fsrs_calibration_status` | Infrastructure | fsrs-guardrails, regression-guard |

---

## Dependency Graph

```
question-generation ──┬── content-refinery
                      └── edge-endpoints

study-plan ──┬── fsrs-guardrails
             └── dashboard-analytics

identity-migration ──┬── prisma-data-integrity
                     └── verify

regression-guard ──── verify
deployment-guard ──── release-readiness, security-and-privacy-audit
auth-guard ────────── security-and-privacy-audit
repo-hygiene ──────── repo-operating-system
clinical-content-auditor ──┬── content-refinery
                           └── prisma-data-integrity

All agents ────────── verify (test runner)
```
