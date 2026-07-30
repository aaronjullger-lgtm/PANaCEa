---
description: Full feature development workflow — spec, plan, implement, test, review, ship. Use for new features.
agent: orchestrator
---

Execute a complete feature development pipeline for:

$ARGUMENTS

## Phase 1: Discover
- Read every file that will be touched. Use codegraph_explore to understand the blast radius.
- Check `config/appViews.ts`, `prisma/schema.prisma`, `AGENTS.md` for constraints.
- Identify the correct layer: frontend component, Edge function, service, or Prisma model.

## Phase 2: Spec
- Write a brief spec to `.opencode/specs/<feature-name>.md`
- Include: what it does, what files change, what tests are needed, acceptance criteria
- One paragraph max — Aaron can read diffs

## Phase 3: Implement
- Write code following PANaCEa conventions:
  - Edge functions: `authenticatedEndpoint`, `context.env.*`, `safePrismaDisconnect` in finally
  - Frontend: Tailwind + semantic tokens, no Prisma imports, `@/` path alias
  - Services: pure functions, JSDoc, testable
  - FSRS: binary Again/Good only, no Hard/Easy
- Create or update types in `types/` if needed
- Wire into existing systems (routes, config, stores)

## Phase 4: Test
- Write Vitest tests for new logic (use test-author agent for complex test suites)
- Run targeted tests: `npx vitest run <path>`
- Fix any failures before proceeding

## Phase 5: Verify
- Run `npm run lint` — must be 0 errors
- Run `npm run typecheck:ci` — must pass
- Run the specific test files touched by this change

## Phase 6: Commit
- Stage only the files for this feature
- Conventional commit: `feat: <description>`
- Push to a feature branch if not already on one
- Report: files changed, tests passing, what's left
