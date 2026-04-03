---
name: perf-bundle-edge
description: "Optimize PANaCEa performance: frontend bundle size, code splitting, Cloudflare edge function cold starts, Prisma connection management, and runtime efficiency. Use this skill whenever the app feels slow, bundle size is growing, edge functions are timing out, or you need to add a heavy dependency — even if the user just says 'it's slow' or 'the deploy is huge'. Also use when reviewing lazy loading, analyzing Vite build output, or optimizing database queries for edge runtime."
keywords: ["bundle size", "vite", "cloudflare edge", "cold start", "prisma edge", "three.js", "recharts", "framer-motion", "code splitting", "lazy loading", "kv cache", "cpu timeout"]
composes: ["cf-edge-api", "session-orchestration"]
---

# PANaCEa Performance & Bundle Optimization

## Purpose
PANaCEa must load fast on student laptops and respect Cloudflare CPU time limits (<30s edge functions). Frontend bundle size, Prisma connection management, and code splitting are critical.

## Frontend Bundle Strategy

### Heavy Dependency Lazy Loading
- **Three.js (Anatomy):** Lazy-load only on routes using 3D (anatomy-drill, osce-sim). Route-level code split:
  ```typescript
  const AnatomyViewer = lazy(() => import('./AnatomyViewer')); // ~500KB
  ```
- **recharts (Charting):** Lazy-load dashboard/analytics routes only.
- **Framer Motion (Animations):** Already tree-shakeable; only import used components.

### Vite Build Analysis
- Run `npm run build` → inspect `dist/` for chunk breakdown:
  - `dist/index-XXX.js` (main app ~150KB gzipped)
  - `dist/vendor-XXX.js` (React, TailwindCSS, Clerk)
  - `dist/three-XXX.js` (lazy chunk, only loaded if anatomy route accessed)
- Check `vite.config.ts` for `rollupOptions.output.manualChunks`:
  - Ensure Three.js in separate chunk
  - Recharts in separate chunk
  - Clerk in separate chunk
- **Tree-shaking:** Remove unused exports; unused imports won't auto-prune without `sideEffects: false` in package.json.

## Edge Function Performance

### Prisma Edge Client Lifecycle
All edge functions must follow this pattern:
```typescript
const prisma = new PrismaClient();
try {
  const result = await prisma.question.findUnique({id});
  return new Response(JSON.stringify(result));
} finally {
  await safePrismaDisconnect(prisma);
}
```
- **Critical:** Always call `safePrismaDisconnect()` in `finally` block. Connection leaks cause timeout cascades.
- Use Prisma Accelerate KV pool (connection pooling via `DATABASE_URL` in wrangler.toml).
- Max 5–10 concurrent Prisma instances per edge function; reuse singleton when possible.

### Cold Start Reduction
- **Keep Edge Functions <100KB:** Split large handlers into separate functions.
- **Minimize imports:** Only import what you use in each handler.
- **KV Caching:** Use `context.env.KV_CACHE` to cache frequently fetched data (student profile, course config):
  ```typescript
  const cached = await env.KV_CACHE.get(`profile:${userId}`);
  if (cached) return cached;
  // fetch + store for 1 hour
  ```
- **Connection pooling:** Reuse Prisma singleton (`prisma-edge.ts`) when possible.

### KV Caching Strategy
- **High-frequency reads** (user progress, question metadata): Cache 1–4 hours.
- **Mutable data** (session attempts, FSRS state): Cache <5 min or skip.
- **Key pattern:** `{resource}:{id}:{version}` to enable cache busting.

## Heavy Dependency Audit
Before adding any dependency > 50KB:
- [ ] Is it lazy-loadable? (No → reconsider)
- [ ] Used on every page or only specific routes?
- [ ] Existing alternatives lighter? (recharts vs Victory, Three.js vs Babylon)
- [ ] Can feature be deferred (progressive enhancement)?
- [ ] Impact on cold start <3s?

## Common Failure Modes
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Edge timeout (>30s) | Prisma connection leak or N+1 query | Check `safePrismaDisconnect()` in finally; use `.select()` to limit fields |
| Slow page load | Large chunk loaded on route | Add `lazy()` + `<Suspense>` for heavy components |
| Cold start >3s | Bloated vendor chunk | Tree-shake unused exports; split vendor by route |
| High KV cost | No cache TTL or cache miss thrashing | Set cache headers; use versioned keys |

## Database Query Patterns for Edge
- **Avoid N+1:** Use `.include()` instead of sequential queries. Example: `findUnique({include: {attempts: true}})`.
- **Select explicitly:** `.select({id: true, name: true})` reduces payload.
- **Connection pooling:** Prisma Accelerate handles pool; never create multiple clients per request.
- **Timeouts:** Set query timeout in Prisma schema: `relationMode = "prisma"` (no FK constraints on DB).

## Files to Inspect First
- `vite.config.ts` — chunk strategy, lazy-loading config
- `dist/` (post-build) — actual bundle breakdown
- `src/routes/` — identify heavy routes (anatomy, dashboard)
- `functions/api/_shared/prisma-edge.ts` — connection singleton
- `wrangler.toml` — env vars, KV namespaces, CPU limits
- `package.json` — dependency sizes (`npm ls Three.js recharts framer-motion`)

## Workflow
1. **Diagnose:** Check browser DevTools (Network tab), Cloudflare Analytics (edge CPU %), build output.
2. **Profile:** Run `npm run build`, check chunk sizes. Profile edge functions with Wrangler.
3. **Optimize:** Apply code splitting, cache, or dependency swap.
4. **Validate:** Rerun build, deploy to staging, measure cold start + page load time.

## See Also
- `cf-edge-api` — Edge function patterns, context.env, KV usage
- `session-orchestration` — Prisma query optimization, FSRS submission flow
