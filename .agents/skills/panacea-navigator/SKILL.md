---
name: "panacea-navigator"
description: "Use this skill for work in the PANaCEa repo, especially when adding features, debugging, tracing data flow, deciding where code belongs, or figuring out which files to read first. It gives Codex a compact map of the StudyPANaCEa architecture so changes land in the right layer."
---

# PANaCEa Navigator

Start with [AGENTS.md](../../../AGENTS.md) and the files you plan to touch.

Use this skill when the task touches repo structure, architecture, or integration points.

## Read Path By Task

- Product overview and commands: `README.md`
- Repo-specific working rules: `AGENTS.md`
- Deep project context: `CLAUDE.md`
- DB model assumptions: `prisma/schema.prisma`

## Quick Map

- `components/`: React UI by product area
- `hooks/`: client-side behavior and workflow hooks
- `lib/`: core logic, FSRS, domain services, utilities
- `functions/api/`: production Cloudflare Pages Functions
- `routes/` + `server.ts`: local-only Express paths
- `tests/` and `e2e/`: unit/integration and Playwright coverage
- `config/`: view registration and lazy-loading
- `scripts/`: one-off and operational automation

## Default Placement Rules

- Production endpoint work goes in `functions/api/`, not `routes/`
- Shared backend logic belongs in `lib/services/` or `functions/api/_shared/`
- Frontend state belongs in `hooks/`, `store/`, or existing component flows
- New views usually require checking:
  - `config/appViews.ts`
  - `config/lazyComponents.tsx`

## High-Risk Areas

- FSRS and review submission pipeline
- Auth and role checks
- Prisma schema assumptions
- Edge/runtime env handling

Before editing those, read the surrounding implementation instead of patching from guesses.

## Non-Negotiables

- Do not use `process.env` inside deployed Edge handlers
- Do not import Prisma into frontend code
- Do not bypass shared auth or Prisma cleanup helpers
- Do not introduce ad-hoc routing when config wiring already exists
