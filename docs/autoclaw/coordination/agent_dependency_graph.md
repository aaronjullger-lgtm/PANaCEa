# Agent Dependency Graph

Which agents must load alongside which others.

---

## Hard Dependencies (Must Load)

```
panacea-question-generation
  ├── requires: panacea-content-refinery (content ingestion, enrichment context)
  └── requires: panacea-edge-endpoints (generation routes are Edge Functions)

panacea-study-plan
  ├── requires: panacea-fsrs-guardrails (study plans derive from FSRS review data)
  └── requires: panacea-dashboard-analytics (progress page renders plan output)

panacea-identity-migration
  ├── requires: panacea-prisma-data-integrity (schema/migration foundations)
  └── requires: panacea-verify (migration testing)

panacea-regression-guard
  └── requires: panacea-verify (verification command selection)

panacea-deployment-guard
  ├── requires: release-readiness (production release context)
  └── requires: security-and-privacy-audit (CSP, header security)

panacea-auth-guard
  └── requires: security-and-privacy-audit (auth security patterns)

panacea-repo-hygiene
  └── requires: repo-operating-system (repo structure conventions)

panacea-clinical-content-auditor
  ├── requires: panacea-content-refinery (content pipeline context)
  └── requires: panacea-prisma-data-integrity (database content models)
```

## Soft Dependencies (Recommended)

```
panacea-fsrs-guardrails
  └── recommended: panacea-session-pipeline (drill review context)

panacea-offline-sync
  └── recommended: panacea-session-pipeline (answer submission context)

panacea-osce-simulation
  └── recommended: panacea-session-pipeline (OSCE session context)

panacea-view-composition
  └── recommended: aidesigner-frontend (visual design context)

panacea-dashboard-analytics
  └── recommended: panacea-fsrs-guardrails (analytics from review data)
```

## Universal Secondaries

These can be useful secondary skills for any agent:
- `panacea-verify` — choose verification commands
- `panacea-navigator` — codebase navigation
- `debug-reproduce-isolate` — reproduce and fix bugs

## Coordinator Rules

1. When dispatching an agent, always include its hard dependencies as secondary skills.
2. Soft dependencies are suggestions — include if the task scope warrants.
3. Never dispatch two agents with overlapping file claims simultaneously.
4. Check `file_claims.md` before every dispatch.
