---
description: Performance audit — bundle size, N+1 queries, cold starts, re-renders. Run when the app feels slow or before optimization work.
agent: perf
---

Run a performance audit focusing on:

$ARGUMENTS

Use the perf agent to:

1. **Bundle analysis** — Run `npm run build` and check chunk sizes. Flag any chunk > 200KB.
2. **N+1 query scan** — Search for `findUnique` or `findFirst` inside loops in `lib/services/` and `functions/api/`.
3. **Edge cold start** — Check all `functions/api/**/*.ts` for top-level await or heavy initialization.
4. **React re-render** — Flag components with > 5 useState calls or missing memo on expensive props.
5. **Prisma index check** — Cross-reference `where` clauses with `@@index` declarations in `schema.prisma`.

Report critical findings first. Suggest specific fixes with file:line references.
