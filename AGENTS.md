# AGENTS.md

## Product identity

StudyPanacea is a premium PANCE prep platform. It helps users study through practice questions, clinical image training, weak-area targeting, progress tracking, readiness analytics, and adaptive study workflows.

The visual direction is:
"Diagnostic Atlas OS" - a dark, precise, premium medical learning command center with anatomical diagrams, scanner motifs, glass panels, organ-system analytics, high-quality motion, and clinical dashboard patterns.

The UI should feel like:

- a medical atlas
- a diagnostic workstation
- an exam-readiness command center
- a premium education product

The UI should not feel like:

- a generic AI SaaS landing page
- a blue-gradient startup template
- a stock-photo medical website
- an admin dashboard template
- a crypto dashboard
- a random glassmorphism Dribbble shot

## Design principles

1. Product-specific visuals beat generic polish.
2. Motion must explain learning, diagnosis, progress, or readiness.
3. Use 3D sparingly and meaningfully.
4. Prefer precise clinical UI details over decorative blobs.
5. Every dashboard metric must connect to a next action.
6. Preserve accessibility and reduced-motion support.
7. Mobile must have lighter fallbacks for heavy 3D sections.
8. All UI must be responsive.
9. Components must be typed.
10. Do not introduce unnecessary dependencies.

## Visual system

Default direction:

- dark clinical background
- glass cards
- subtle grid/noise overlays
- cyan, blue, violet, and pulse-pink accents
- anatomical/scanner motifs
- organ-system labels
- vitals-monitor-inspired metrics
- clean typography
- high contrast
- generous spacing

Avoid:

- huge generic gradients
- blob backgrounds
- fake AI robot mascots
- stock doctor photos
- random emoji icons
- meaningless floating shapes
- excessive neon
- unreadable low-contrast text
- animation that hurts performance

## Preferred frontend stack

Use the existing project stack when possible.

This repository currently uses React, TypeScript, Vite, React Router, Tailwind, shadcn-style UI primitives, Framer Motion, Recharts, and Lucide. Preserve that architecture unless the user explicitly requests a framework migration.

Prefer:

- Next.js for new projects or explicitly requested migrations
- TypeScript
- Tailwind
- shadcn/ui
- Motion from `motion/react` when available or when a migration is approved
- React Three Fiber only for meaningful 3D medical scenes
- drei only when React Three Fiber is in use
- GSAP ScrollTrigger only for pinned or scrubbed scroll scenes
- Recharts for dashboard charts
- TanStack Table for serious tables
- Lucide icons

Do not add React Three Fiber, drei, GSAP, or new UI libraries unless the feature need is clear and the user has approved dependency changes.

## Animation rules

Use Motion for:

- hover/tap states
- card reveals
- layout transitions
- tab transitions
- modal/drawer transitions
- SVG path drawing
- simple scroll-linked transforms

Use GSAP ScrollTrigger for:

- pinned scroll storytelling
- scrubbed timelines
- scroll-controlled multi-step sections
- complex sequencing

Use React Three Fiber for:

- hero anatomy/scanner scene
- meaningful 3D medical objects
- subtle organ-system visualization

Always:

- respect prefers-reduced-motion
- avoid animation during hydration that causes layout shift
- lazy-load heavy 3D sections
- keep mobile fallbacks lighter

## Implementation rules

Before editing:

- inspect existing files
- identify routing conventions
- identify component conventions
- identify package manager
- preserve working behavior

When editing:

- make focused changes
- avoid broad rewrites unless requested
- keep components small and composable
- use TypeScript types
- avoid `any` unless justified
- avoid hard-coded magic data inside presentation components
- place mock data in a dedicated file
- add loading, empty, and error states where relevant
- maintain keyboard accessibility and visible focus states

Verification:

- run lint if available
- run typecheck if available
- run build if available
- if a command fails, explain the failure and whether it is related to the change

Completion summary:

- list changed files
- explain major decisions
- list verification commands run
- list known limitations

## Recovery workflow

This repository has a working recovery plan in `APP_FUNCTIONALITY_PLAN.md`.

When continuing functional recovery work:

- read `APP_FUNCTIONALITY_PLAN.md` before choosing the next task
- update it after setup, build, runtime, auth, API, test, or workflow changes
- keep known blockers, verification history, current task, and next best step current
- do not restart broad inspection when the plan already contains current evidence
- preserve unrelated dirty-worktree changes

## Codex skill routing

Repo-local skills live in `.agents/skills` and should be considered available to Codex whenever working inside this repository.

Use `skill-routing-and-usage` when a request could match multiple skills, asks to improve skill usage, or changes `.agents/skills`.

Default routing:

- Use `panacea-navigator` first for unclear StudyPANaCEa repo work.
- Prefer narrow `panacea-*` skills over generic reusable skills for product internals.
- Use `panacea-verify` to choose validation commands for code changes.
- Use `aidesigner-frontend` for AIDesigner-driven frontend generation or redesign.
- Use `supabase` as a secondary skill for Supabase-specific behavior, but use `panacea-prisma-data-integrity` as primary for PANaCEa Prisma/schema/data-integrity work.
- Use `security-and-privacy-audit` for auth, authorization, secrets, privacy, payment, or sensitive logging risk.
- Use `release-readiness` only when the task is preparing for production release or launch.

Do not load every plausible skill. Pick one primary skill, then add only the secondary skills that materially constrain the work.

## Prompt engineering defaults

When prompts are broad, restate the working route before editing:

- primary skill
- secondary skills, if any
- affected subsystem
- verification plan

Favor precise, outcome-oriented task framing:

- Good: "Use `panacea-session-pipeline` to trace duplicate drill submissions and add a regression test."
- Good: "Use `panacea-fsrs-guardrails` and `panacea-verify` for a safe FSRS scheduler change."
- Weak: "Fix the study mode."

For safety-critical work, preserve these constraints:

- no Hard/Easy FSRS ratings
- no production migrations without approval
- no secrets in logs or docs
- no Prisma imports in frontend code
- no auth, RLS, or middleware bypasses to make tests pass
- no medical diagnosis claims in AI tutor, OSCE, or content-generation output

Skill library maintenance:

- Update `docs/skills-overview.md` when skills are added, renamed, removed, or repurposed.
- Update `docs/skills-usage.md` when routing rules change.
- Run `.agents/skills/skill-routing-and-usage/scripts/audit-skills.sh /Users/aaronullger/GitHub/StudyPANaCEa` after skill edits.

## Cursor agent operating system (quick reference)

A curated Cursor agent setup lives in `.cursor/` (rules, skills, hooks, MCP templates) and `docs/cursor-*.md`. Full map: `docs/cursor-agent-operating-system.md`. High-value durable truths for any agent/tool:

- **Stack truth:** React 19 + Vite 6 + React Router 7 (SPA, **not** Next.js); Cloudflare Pages Functions for the prod API (`functions/api/`, Edge — use `context.env`, not `process.env`); Prisma 7 + Supabase Postgres; Clerk auth; Tailwind/Radix/Framer Motion. Package manager: **npm**, Node 22.
- **Verification truth:** don't claim success without running the ladder — `npm run typecheck` · `npm run lint` · `npm test` (or `test:critical`) · `npm run build` — and, for UI, browser evidence (screenshots). Never delete/skip/weaken tests to reach green.
- **Known blockers (pre-existing on `main`):** `dev:all`/`dev:server` and `dev:wrangler` don't run (missing `routes/` and `lib/services/tokenMatchCache.ts`); `npm run lint` has 3 pre-existing `no-empty` errors; `npm run typecheck` has 2 pre-existing errors in `lib/study/renderStructuredRationale.ts`. Use `npm run dev` (port 3000) for the frontend.
- **Cloud caveats:** secrets are injected as env vars (`DATABASE_URL` is `prisma://` Accelerate; `DIRECT_DATABASE_URL` is `postgres://`); DB scripts need `ssl: { rejectUnauthorized: false }`. Details: `docs/cursor-automation-audit.md`.
- **No-secrets policy:** never commit secrets/tokens/connection strings; `.cursor/mcp.json` and `.env`/`.dev.vars` stay untracked; a commit-time secret scanner must not be bypassed.
- **No-production-data policy:** never connect to prod DB/services; MCP servers default to read-only/dev; production migrations/deploys require human approval.
- **Final report requirement:** end each run with files changed, commands run + pass/fail (pre-existing vs introduced), evidence, residual risks, and manual dashboard steps (see the `cloud-agent-final-report` skill).
