# Workflow: Dependency Update Review

**Goal:** Review a dependency add/upgrade for necessity, safety, compatibility, and bundle impact.

**Triggers:** dependency-bump PR, "add <package>", periodic dep review.

**Agents:** Orchestrator → Reviewer (lead) → Security → (Implementation only for approved changes) → Documentation.

## Phases
1. **Context scan** *(required)* — `package.json`/lockfile diff, changelogs; read `dependency-and-package-safety.mdc`.
2. **Plan** — necessity check (can the existing stack do it?), risk assessment.
3. **Implementation** — none unless approved; `npm install` to reconcile lockfile.
4. **Self-review** — Edge-safety if used in `functions/api/`; no yarn/pnpm/bun lockfiles.
5. **Verification** — commands below.
6. **Specialist review** — Security (supply chain), Reviewer.
7. **Docs / memory** — record decision.
8. **Final report** — see template.

**Implementation boundaries:** **new production deps require human approval**; never `npm audit fix --force`; never hand-edit the lockfile; no untrusted registries/scripts.

**Validation commands:** `npm install` · `npm run typecheck` · `npm run build` · `npm test` · `npm run build:check-size`.

**Evidence required:** advisories (`npm audit`, report-only), version diffs, bundle delta.

**Stop conditions:** verdict reached; prod deps paused at approval gate.

**Human approval gates (required):** any production dependency add/upgrade.

**Final report template:** {dep, old→new, risk, action} table → install/build/test results → bundle delta → approval-needed items.

**Durable memory updates:** note risky ecosystems/pins in `agent-lessons-learned.md`.
