# Workflow: Cloudflare Functions Review

**Goal:** Verify `functions/api/` Edge handlers are runtime-correct and safe (no Node APIs, `context.env`, Prisma singleton, authz, validation).

**Triggers:** changes under `functions/api/`, new endpoints, pre-deploy Edge check.

**Agents:** Orchestrator → Security (lead for authz) → Reviewer → Test/Debug (if build fails) → Documentation.

## Phases
1. **Context scan** *(required)* — read `architecture-boundaries.mdc`, `.cursor/training/cloudflare-functions-primer.md`, `functions/api/_shared/` (auth, prisma-edge), changed endpoints.
2. **Plan** — list endpoints + checks.
3. **Implementation** — fixes within Edge rules (additive authz/validation with approval).
4. **Self-review** — scan for `process.env`/Node built-ins; confirm `safePrismaDisconnect` in `finally`.
5. **Verification** — commands below.
6. **Specialist review** — Security (authz/RLS), Reviewer.
7. **Docs / memory** — note Edge gotchas.
8. **Final report** — see template.

**Implementation boundaries:** no `process.env`/`fs`/`path`/`os` in Edge; `onRequestGet/Post` handlers; Zod validation; structured `{ error }`; no auth/RLS weakening; note that `dev:wrangler` is broken on `main` (build the Functions bundle can't run fully) — verify via typecheck/build + code review.

**Validation commands:** `npm run typecheck` · `npm run build`; grep `rg -n "process\.env" functions/api` (should be none).

**Evidence required:** Edge-safety scan output; per-endpoint authz + validation notes.

**Stop conditions:** all changed endpoints pass the Edge checklist.

**Human approval gates (required):** auth/RLS changes, secret handling, production deploy.

**Final report template:** Endpoints reviewed → Edge-safety results → authz/validation coverage → risks → approval-needed items.

**Durable memory updates:** append Edge pitfalls to `known-failure-modes.md`.
