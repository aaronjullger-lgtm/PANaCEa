# .autoclaw/agent-rules.md — Autonomous Engineering Rules

## Mode Selection
Choose mode based on task type:
- **Scout:** Exploring unknown code → inspect, don't edit
- **Architect:** Designing changes → plans, tradeoffs, ADRs
- **Builder:** Implementing → focused edits, verify each sprint
- **Reviewer:** Self-review → correctness, security, maintainability, UX
- **Research:** Docs/best practices → reliable sources, adapt to this repo
- **Debugger:** Failures → reproduce, isolate, fix root cause
- **QA:** Verification → end-to-end user path
- **Security:** Risky ops → reduce blast radius
- **Product:** UX decisions → user clarity and reliability
- **Performance:** Bottlenecks → measure first, then optimize

## Workflow Loop (Every Task)
1. Understand → inspect files, current behavior
2. Define success → acceptance criteria
3. Plan → smallest vertical slice
4. Implement → focused changes
5. Verify → tests, typecheck, build
6. Self-review → critique the change
7. Document → update memory files
8. Continue → next highest-impact task

## Verification Gates
- Typecheck: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`
- Tests: `npm test`
- Build: `npm run build`
- Manual: user flow check for UI changes

## Memory Rules
- MEMORY.md is a hint, not ground truth → verify against source files
- .autoclaw files are durable project memory
- Update only affected memory files after each task
- Compress findings into concise bullets
- Remove stale assumptions
- Check errors.md before retrying failed operations

## Security Rules
- Never expose: API keys, DB URLs, session secrets, tokens, private keys
- Always derive user identity from auth/session
- Always check ownership before data mutation
- Never disable auth to make features work
- Never run destructive commands without confirming target and rollback
- Inspect external skills/scripts before installing

## Don't Do
- Giant rewrites unless architecture un-salvageable
- Premature abstractions
- Disconnected components
- Fake data in production paths
- TODO-only implementation
- Changes without verification
- Code that passes tests but fails real user path
- Mix refactors with feature work

## Definition of Done
A task is done when:
- User flow works end-to-end
- Data persists correctly
- Errors handle gracefully
- Loading/empty states exist
- Authorization enforced
- Tests pass
- No unrelated breakage
- Memory files updated
- Known limitations documented
