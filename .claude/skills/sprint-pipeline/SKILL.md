---
name: sprint-pipeline
description: >
  End-to-end sprint implementation workflow for PANaCEa feature development.
  Use this skill whenever the user asks to "implement", "build", "add a feature",
  "plan and implement", "do it for me", or gives a multi-step technical task.
  Also use when continuing interrupted implementation work across sessions, when
  the user says "continue", "pick up where you left off", or "proceed". This skill
  encodes Aaron's preferred phased audit-first approach and prevents half-finished
  implementations, forgotten test coverage, and uncommitted work.
---

# Sprint Implementation Pipeline

## Why this exists

Aaron's working style is specific: audit first, then implement in phases, verify
each phase with tests, commit with clear messages, and push when done. "Do it
for me" means fully execute — don't ask, don't explain, just build it. This
skill encodes that workflow so every session starts executing immediately.

## Aaron's preferences (from feedback)

- **"Do it for me"** = fully execute the work. Don't ask clarifying questions.
  Don't explain what you're about to do. Just do it.
- **Phased approach**: Break large features into numbered sprints (Sprint 1, 2, etc.)
- **Audit-first**: Before writing code, read the existing files that will be touched.
  Understand imports, data flow, and existing patterns.
- **Concise communication**: Report results briefly. "37/37 tests pass" not a paragraph.
- **Verification**: Every sprint ends with tests passing. Don't skip this.
- **Commit granularity**: One commit per logical group of sprints is fine. Don't
  micro-commit every file change.

## Sprint execution workflow

### Phase 0: Audit (always first)

Before writing a single line of code:

1. Read every file that will be modified. Note existing imports, exports, types.
2. Check `config/appViews.ts` and `config/lazyComponents.tsx` if adding views.
3. Check the Prisma schema for any tables you'll query. Verify column names.
4. If the feature has tests, read them to understand expected behavior.
5. Grep for the function names you plan to use — they may already exist.

This prevents the #1 source of wasted time: writing code that conflicts with
existing patterns or references nonexistent columns.

### Phase 1: Implement in numbered sprints

Break the feature into discrete sprints. Each sprint should be a coherent unit:

- **Sprint N**: Clear title (e.g., "Ghost Grader v2 bidirectional grading")
- Each sprint touches a small set of files (1–4)
- Each sprint produces something testable
- Report completion briefly: "Sprint 3 done — `antiGamingDistribution.ts` written"

When writing new service files, follow PANaCEa conventions:
- Export pure algorithm functions separately from DB-integrated async functions
- Use the `// ─── Section Name ──────` separator pattern for visual structure
- Put types/interfaces near the top, constants after, then functions
- Always add a JSDoc header comment explaining what the file does and which sprint created it

### Phase 2: Wire and integrate

After core logic is written, wire it into the existing codebase:

- Update `config/appViews.ts` if adding a new view
- Update `config/lazyComponents.tsx` if adding a lazy-loaded component
- Add API endpoints in `functions/api/` for Cloudflare Pages Functions
- Update `drillReviewService.ts` if touching the SRS review pipeline
- Update `components/layout/DrillViewRouter.tsx` if adding routes

Keep wiring changes in a separate sprint from the core logic — easier to debug.

### Phase 3: Test

Write tests for every new pure function (see vitest-author skill). Run them:

```bash
cd /Users/aaronullger/GitHub/StudyPANaCEa
npx vitest run tests/yourTest.test.ts
```

If tests fail, fix and rerun. Don't move on with failing tests.
Report: "12/12 tests passing" — not a paragraph about what was tested.

### Phase 4: Commit and push

- Stage specific files (not `git add -A` — avoid capturing unrelated changes)
- One commit per logical group of sprints is fine
- Commit message format: `feat(scope): brief description of what was added`
- Push to remote when the user says "push" or "handle it for me"
- After push, verify with `git log --oneline -3` and report the hash

## Verification checklist

Before declaring a sprint complete, verify:

- [ ] All new files have JSDoc header comments
- [ ] All imports resolve (no red squiggles if you can check)
- [ ] Pure functions are exported for testing
- [ ] Tests exist and pass for all new pure functions
- [ ] No `any` types that could be properly typed
- [ ] Config files updated if new views/routes were added
- [ ] The feature can actually be reached from the UI (route exists)

## Session continuation protocol

When picking up work from a previous session:

1. Read the session summary carefully — it lists exactly what was done and what's pending
2. Check git log to see what was actually committed vs what was only discussed
3. Verify files exist before assuming they were written (previous session may have failed)
4. Don't re-audit files that haven't changed — jump to the next pending sprint
5. If tests were passing at the end of last session, start by running them to confirm

The key insight: "continue" means pick up the NEXT undone thing, not recap
what was already done. Aaron has already read the summary — he doesn't need
you to repeat it.

## Desktop Commander considerations

When working through Desktop Commander MCP (common in Cowork sessions):

- `read_file` often returns empty content → use `start_process` with `cat` instead
- `write_file` works best in 25–30 line chunks with `mode: 'append'`
- For the first chunk, use `mode: 'rewrite'`; for subsequent chunks, `mode: 'append'`
- Git operations via `start_process`: `git add`, `git commit`, `git push`
- If git complains about lock files: `rm -f .git/index.lock`
- TypeScript compilation check: `npx tsc --noEmit` (may OOM on large repos — skip if so)

## Stacking with other PANaCEa skills

This skill works best when combined with:
- **panacea-navigator**: Read this first to understand where files go
- **fsrs-domain**: Read this when the sprint touches SRS/FSRS logic
- **vitest-author**: Read this when writing tests (Phase 3)
- **desktop-commander-deploy**: Read this if using Desktop Commander MCP