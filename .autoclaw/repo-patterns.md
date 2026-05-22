# .autoclaw/repo-patterns.md — Coding Conventions

## File Naming
- Components: PascalCase (`DrillShell.tsx`)
- Services/utils: camelCase (`drillReviewService.ts`)
- API routes: kebab-case (`submit-review.ts`)
- Test files: `*.test.ts` or `*.test.tsx`
- Types: `*.types.ts` in `types/` dir

## Import Ordering
```
React → third-party → @/lib → @/hooks → @/components → relative
```

## API Patterns
- Every endpoint: try/catch → `{ error: string }` on failure
- Auth: `authenticatedEndpoint` wrapper from `functions/api/_shared/auth.ts`
- Prisma: `safePrismaDisconnect(prisma)` in finally block
- Edge constraint: `context.env.*` never `process.env`
- Rate limiting: `RATE_LIMIT_KV` namespace

## Component Patterns
- Tailwind + semantic color tokens from `tailwind.config.js`
- State: Zustand for client, TanStack Query for server
- Drills: all wire through `useDrillFSRS` hook
- Export: named exports preferred
- Props: typed interfaces, destructured

## Testing Patterns
- Framework: Vitest 4.1, jsdom environment
- Location: `tests/` or colocated in `lib/`, `functions/`, `components/`
- Coverage thresholds: 40% statements, 35% branches/functions/lines
- Critical paths higher: `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`, `lib/confidence/**`
- Never assert on insertion order
- FSRS math: handle floating-point precision

## Error Handling
- API errors: `{ error: "human-readable message" }`
- Sentry: capture unexpected errors, source maps uploaded
- Client: error boundaries for React tree
- Auth errors: `CLERK_AUTH_DEBUG=true` for diagnostics

## Validation
- Server-side: Zod or manual validation before DB writes
- Client-side: form validation before submission
- AI output: schema-validate generated JSON before persistence

## Commit Style
- Conventional: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- Branch naming: `feat/description`, `fix/description`, `chore/description`

## Never Patterns
- `process.env` in Edge functions
- Prisma client in browser bundles
- Self-rated difficulty buttons (implicit-only)
- Hard/Easy rating values (binary Again/Good only)
- Skip `safePrismaDisconnect` in Edge finally blocks
- Commit `.env` files, API keys, secrets
- Array insertion order assertions in tests
