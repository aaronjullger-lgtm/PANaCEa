# Workflow: Pre-Deploy Readiness

**Goal:** Produce a go/no-go readiness verdict. **Never deploys.**

**Triggers:** release request, pre-merge for risky changes, "are we ready to ship?".

**Agents:** Orchestrator → Release Readiness (lead) → Security → Reviewer → Documentation.

## Phases
1. **Context scan** *(required)* — `wrangler.toml`, `functions/api/`, `public/_headers`, `.node-version`, CI configs; read `cloud-agent-operating-mode.mdc`.
2. **Plan** — checklist to run.
3. **Implementation** — none (assessment only).
4. **Self-review** — confirm no staged secrets/`.env`/`.cursor/mcp.json`.
5. **Verification** — commands below.
6. **Specialist review** — Security gate; Reviewer.
7. **Docs / memory** — record readiness snapshot in `validation-history.md`.
8. **Final report** — see template.

**Implementation boundaries:** **do not deploy or run production migrations**; Edge code uses `context.env` (no Node built-ins).

**Validation commands:** `npm run typecheck:ci` · `npm run lint` · `npm test` · `npm run build` · `npm run env:check:compat-date`.

**Evidence required:** full ladder results (pre-existing vs introduced); secret-scan clean; Edge-safety scan.

**Stop conditions:** verdict delivered; deploy is out of scope.

**Human approval gates (required):** the deploy itself, production migrations, env/secret changes, billing.

**Final report template:** Go/No-Go → checklist w/ evidence → blockers (e.g. `dev:wrangler` broken, missing modules) → required dashboard secrets → "deploy requires human approval".

**Durable memory updates:** append the readiness snapshot to `validation-history.md`.
