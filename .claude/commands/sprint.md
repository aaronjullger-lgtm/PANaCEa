Execute a full sprint implementation pipeline.

Follow the `sprint-workflow` skill:

1. **Audit** — Read all files that will be modified. Understand imports, types, patterns. Check `config/appViews.ts`, `prisma/schema.prisma`, existing tests.
2. **Plan** — Break into numbered sprints (1–4 files each). Safety/data first, shared helpers before consumers.
3. **Implement** — Write code following PANaCEa conventions. JSDoc headers, `// ─── Section ──────` separators, pure functions exported separately.
4. **Wire** — Update configs, add endpoints, integrate with existing systems. Separate sprint from core logic.
5. **Test** — Write tests for pure functions. Run: `npx vitest run <path>`. Don't move on with failing tests.
6. **Verify** — Typecheck changed files (scoped, not full project). Check edge-runtime safety if touching `functions/`.
7. **Commit** — Stage specific files. Message: `feat(scope): description`. Push when asked.

Use `$ARGUMENTS` as the task description.

**"Do it for me"** = fully execute. Don't ask clarifying questions. Don't explain what you're about to do. Just build it.

**Session continuation**: "continue" = pick up the NEXT undone thing. Don't recap completed work.
