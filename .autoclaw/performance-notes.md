# .autoclaw/performance-notes.md

## Known Bottlenecks
- Typecheck OOM: requires `NODE_OPTIONS="--max-old-space-size=4096"`
- QuizView (2045 lines): large component, may impact render performance
- PatientEncounterMode (3488 lines): largest file, needs decomposition

## Optimization Opportunities
- Code splitting: already configured in vite.config.ts (vendor chunks + component-level splits)
- Caching: KV namespaces for rate limiting and content caching
- Prisma: pgbouncer pooling configured for connection management
- Question reservoir: batch processing prevents N+1 queries

## Monitoring
- Sentry: performance tracing enabled, source maps uploaded
- Build time: ~16s — acceptably fast
- Test suite: 3200+ tests in Vitest — parallel by default

## To Audit
- Slow queries: check for missing indexes (pending migration has composite indexes)
- Network calls: verify debouncing on user input, batching on writes
- Bundle size: manual vendor chunks in vite.config.ts, review for additions
- AI calls: verify rate limiting and caching on Gemini API calls
