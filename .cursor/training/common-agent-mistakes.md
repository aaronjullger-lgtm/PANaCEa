# Common Agent Mistakes (in this repo)

The top ways agents go wrong here, and the fix. Cross-refs: `.cursor/memory/do-not-repeat.md`, `known-failure-modes.md`.

1. **Assuming Next.js.** This is React + Vite + React Router. Don't add `next/*`, server components, or `app/` routing.
2. **Claiming success without checks / UI without screenshots.** Always run the ladder and capture browser evidence.
3. **Importing missing modules.** `routes/` and `lib/services/tokenMatchCache.ts` don't exist on `main`. Verify before importing; never invent stubs.
4. **Blaming pre-existing failures on your change.** 2 typecheck errors (`renderStructuredRationale.ts`) and 3 `no-empty` lint errors pre-exist. Distinguish pre-existing vs introduced.
5. **`process.env` in Edge functions.** Use `context.env.*`; add `safePrismaDisconnect` in `finally`.
6. **Prisma/server imports in client code.** Breaks the Vite bundle. Keep server code out of `components/`/`src/`/hooks.
7. **Editing shared primitives or FSRS rating logic.** Cascades / safety-critical → human approval.
8. **Weakening tests/gates to go green.** Never delete/skip tests, weaken assertions, `@ts-ignore`, or disable lint.
9. **Touching secrets or prod.** No committing/writing `.env`/`.dev.vars`/`.cursor/mcp.json`; no prod DB/deploys/migrations without approval.
10. **Raw hex / off-system UI.** Use tokens; reuse primitives; avoid AI-slop visuals.
11. **Adding deps casually.** New production deps need approval; never `npm audit fix --force` or hand-edit the lockfile.
12. **Uncontrolled retry loops.** Max 2 repair attempts; diagnose before retrying; escalate unresolved failures.
