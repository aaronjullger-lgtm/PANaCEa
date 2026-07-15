# Edge Migration Plan — Express to Cloudflare Pages Functions

*Generated: April 10, 2026*
*Source: `routes/*.ts` → `functions/api/*/`*

## Summary

Production runs on **Cloudflare Pages Functions** (`functions/api/`). The Express `routes/` directory is legacy (local dev only). This plan covers the **30 remaining unported endpoints** needed to fully deprecate Express.

**Current coverage: ~65% of Express endpoints have Edge equivalents.** Content and analytics groups were ported after the April 6 audit.

---

## Priority Table

### P0 — Block Express Removal (16 endpoints)

| # | Group | Endpoint | Method | Express Handler | Edge Compatibility |
|---|-------|----------|--------|-----------------|--------------------|
| 1 | Questions | `/api/questions` | GET | `routes/questions.ts:28` | Prisma only |
| 2 | Questions | `/api/questions/fetch` | POST | `routes/questions.ts:54` | Prisma only |
| 3 | Questions | `/api/questions/query` | POST | `routes/questions.ts:78` | Auth + service import |
| 4 | Questions | `/api/questions/batch` | POST | `routes/questions.ts:103` | Auth + Prisma |
| 5 | Questions | `/api/questions/no-repeat` | POST | `routes/questions.ts:161` | Validation + service |
| 6 | Questions | `/api/questions/history` | POST | `routes/questions.ts:184` | Validation + service |
| 7 | Questions | `/api/questions/repository/stats` | GET | `routes/questions.ts:207` | Service import |
| 8 | Questions | `/api/questions/stats` | GET | `routes/questions.ts:224` | Prisma only |
| 9 | Questions | `/api/questions/custom-session` | POST | `routes/questions.ts:416` | ✅ `functions/api/questions/custom-session.ts` |
| 10 | Questions | `/api/questions/pool` | GET | `routes/questions.ts:529` | Prisma + fallback |
| 11 | Questions | `/api/questions/generate` | POST | `routes/questions.ts:635` | AI (Gemini) — complex |
| 12 | OSCE | `/api/osce/cases/random` | GET | `routes/osce.ts:23` | Auth + Prisma |
| 13 | OSCE | `/api/osce/session` | POST | `routes/osce.ts:59` | Auth + Prisma |
| 14 | OSCE | `/api/osce/session/:sessionId` | GET | `routes/osce.ts:122` | Auth + ownership |
| 15 | OSCE | `/api/osce/chat` | POST | `routes/osce.ts:165` | Auth + ownership |
| 16 | OSCE | `/api/osce/complete` | POST | `routes/osce.ts:213` | Auth + ownership |

### P1 — Important, Workarounds Exist (12 endpoints)

| # | Group | Endpoint | Method | Express Handler | Edge Compatibility |
|---|-------|----------|--------|-----------------|--------------------|
| 17 | Reference | `/api/reference/special-tests` | GET | `routes/reference.ts:60` | Auth + service import |
| 18 | Reference | `/api/reference/physiology` | GET | `routes/reference.ts:73` | Auth + service import |
| 19 | Reference | `/api/reference/treatments` | GET | `routes/reference.ts:86` | Auth + service import |
| 20 | Reference | `/api/reference/imaging` | GET | `routes/reference.ts:114` | Auth + service import |
| 21 | Reference | `/api/reference/findings` | GET | `routes/reference.ts:127` | Auth + service import |
| 22 | Labs | `/api/labs/tests` | GET | `routes/labs.ts:14` | Prisma only |
| 23 | Labs | `/api/labs/cases` | GET | `routes/labs.ts:27` | Prisma only |
| 24 | Labs | `/api/labs/cases/random` | GET | `routes/labs.ts:38` | `$queryRaw` — needs rewrite |
| 25 | Drills | `/api/drills/lab-cases` | GET | `routes/drills.ts:192` | ✅ `functions/api/drills/lab-cases.ts` |
| 26 | Drills | `/api/drills/lab-cases` | POST | `routes/drills.ts:229` | ✅ `functions/api/drills/lab-cases.ts` |
| 27 | Users | `/api/achievements` | GET | `routes/users.ts:17` | Auth + Prisma |
| 28 | Users | `/api/performance` | GET/POST | `routes/users.ts:52,94` | Auth + Prisma |

### P1 — Sync (1 endpoint)

| # | Group | Endpoint | Method | Express Handler | Edge Compatibility |
|---|-------|----------|--------|-----------------|--------------------|
| 29 | Sync | `/api/sync` | GET | `routes/sync.ts` | Auth — read-only sync |

### P2 — Dormant / Deferrable (14 endpoints)

| Group | Endpoints | Count | Notes |
|-------|-----------|-------|-------|
| Games | GET/POST wordle (2), GET/POST grand-rounds (2) | 4 | Not in App.tsx routing |
| Pearls | POST extract, GET daily, GET user, GET favorites, POST useful, POST search, GET stats | 7 | Not called by frontend |
| Adaptive | GET recommendations, GET next-action, GET profile, POST feedback | 4 | Not called by frontend |
| Audit | GET content-audit | 1 | Admin-only |

---

## Per-Group Migration Notes

### Questions (`routes/questions.ts` — 838 lines)

**Dependencies:**
- `lib/services/questionBankService` (`getQuestionsWithFallback`)
- `services/core/noRepeatService` (`getQuestionsWithNoRepeat`, `recordQuestionSeen`, `getRepositoryStats`)
- `lib/services/semanticCacheService` (for `/generate`)
- `lib/questionGenerator` (for `/generate` — calls Gemini)
- `services/core/conditionDataLoader` (for `/generate`)
- `lib/services/notificationService` (for `/flag` — already ported)
- Prisma models: `PreGeneratedQuestion`, `QuestionFlag`

**Edge Compatibility Issues:**
- `/generate` calls Gemini AI — must use `aiEndpoint` middleware stack with `env.GEMINI_API_KEY`
- `/no-repeat` and `/history` import from `services/core/` — verify these have no Node.js deps
- `/pool` uses `getQuestionsWithFallback` with a fallback chain — ensure the fallback doesn't use Node APIs
- All endpoints check `process.env.DATABASE_URL` — replace with env check middleware
- `uuid` import — use `crypto.randomUUID()` (Edge-native) instead of `uuid` package

**Effort:** 3–4 sprints. `/generate` is the hardest (AI pipeline). Bulk endpoints (`/query`, `/batch`, `/custom-session`, `/pool`) are Prisma-heavy but straightforward.

**File structure after migration:**
```
functions/api/questions/
├── index.ts              # GET /, GET /stats, GET /repository/stats, GET /pool
├── fetch.ts              # POST /fetch
├── query.ts              # POST /query
├── batch.ts              # POST /batch
├── no-repeat.ts          # POST /no-repeat
├── history.ts            # POST /history
├── custom-session.ts     # POST /custom-session
├── generate.ts           # POST /generate (AI)
├── flag/index.ts         # ✅ Already ported
└── seeds/index.ts        # ✅ Already ported
```

---

### OSCE (`routes/osce.ts` — 263 lines)

**Dependencies:**
- Prisma models: `PatientEncounterCase`, `PatientEncounterSession`, `User`
- `uuid` package (replace with `crypto.randomUUID()`)

**Edge Compatibility Issues:**
- All endpoints use `getBody<T>()` helper that unwraps `{ body: {...} }` — Edge middleware's `withValidation` already handles both flat and body-wrapped payloads
- Ownership enforcement pattern (`session.userId !== user.id`) — must keep in Edge version
- `process.env.DATABASE_URL` guards — replace with env check middleware

**Effort:** 1 sprint. All endpoints are simple CRUD with auth + ownership. No service imports beyond Prisma.

**File structure after migration:**
```
functions/api/osce/
├── cases/random.ts       # GET /cases/random
├── session/create.ts     # POST /session
├── session/[sessionId].ts # GET /session/:sessionId
├── chat.ts               # POST /chat
└── complete.ts           # POST /complete
```

---

### Reference (`routes/reference.ts` — 153 lines)

**Dependencies:**
- `lib/services/referenceService` — shared service, already Edge-compatible (uses Prisma)
- `requireAuth` middleware

**Edge Compatibility Issues:**
- All 5 missing endpoints follow the **exact same pattern**: auth → import service → call method → return result
- Service uses dynamic `import()` — verify no Node.js deps in referenceService
- Query params (`system`, `category`, `modality`) — use `publicEndpoint`/`authenticatedEndpoint` with `source: 'query'`

**Effort:** < 1 sprint. Mechanical copy-paste with pattern substitution.

**File structure after migration:**
```
functions/api/reference/
├── special-tests.ts      # GET /special-tests
├── physiology.ts         # GET /physiology
├── treatments.ts         # GET /treatments
├── imaging.ts            # GET /imaging
└── findings.ts           # GET /findings
```

---

### Labs (`routes/labs.ts` — 56 lines)

**Dependencies:**
- Prisma models: `LabTest`, `LabCase`

**Edge Compatibility Issues:**
- `/cases/random` uses `$queryRaw` with `ORDER BY RANDOM()` — Prisma Accelerate doesn't support raw queries in the same way. Replace with `findMany` + client-side shuffle, or use `$queryRawUnsafe` with Accelerate-compatible syntax
- All endpoints are unauthenticated in Express — consider adding auth for Edge

**Effort:** < 1 sprint. Three simple endpoints.

**File structure after migration:**
```
functions/api/labs/
├── tests.ts              # GET /tests
├── cases/index.ts        # GET /cases
└── cases/random.ts       # GET /cases/random
```

---

### Drills (`routes/drills.ts` — 254 lines)

**Dependencies:**
- Prisma model: `LabCase`
- Complex `transformLabCase()` function (200 lines of data transformation)

**Edge Compatibility Issues:**
- `transformLabCase()` is pure data transformation — fully Edge-compatible
- Panel config parsing uses no Node APIs — safe for Edge
- `Math.random()` for shuffle — fine in Edge runtime

**Effort:** 1 sprint. The transform logic is substantial but has no Edge incompatibilities.

**File structure after migration:**
```
functions/api/drills/
├── lab-cases.ts          # GET + POST /lab-cases
├── submit-review.ts      # ✅ Already ported
└── lab-cases-transform.ts # Shared transform logic (internal)
```

---

### Users (`routes/users.ts` — 142 lines)

**Dependencies:**
- Prisma models: `User`, `UserAchievement`, `PerformanceRecord`
- `uuid` package (replace with `crypto.randomUUID()`)

**Edge Compatibility Issues:**
- BigInt serialization for `timestamp` — Edge JSON.stringify handles this natively
- `process.env.DATABASE_URL` guards — replace with env check middleware

**Effort:** < 1 sprint. Three simple CRUD endpoints.

**File structure after migration:**
```
functions/api/
├── achievements/index.ts # GET /achievements
└── performance/index.ts  # GET + POST /performance
```

---

### Sync (`routes/sync.ts` — GET handler)

**Dependencies:**
- Prisma models for sync data

**Edge Compatibility Issues:**
- POST `/api/sync` already ported to `functions/api/sync.ts`
- GET handler likely mirrors the POST read path

**Effort:** Trivial. Read existing Edge sync.ts, add GET handler.

---

## Recommended Migration Order

```
Sprint 1: Reference (5 endpoints)     ← fastest win, identical pattern
Sprint 2: Labs + Users (6 endpoints)  ← simple CRUD, builds confidence
Sprint 3: OSCE (5 endpoints)          ← introduces auth + ownership pattern
Sprint 4: Questions bulk (7 endpoints) ← GET /, fetch, query, batch, no-repeat, history, stats, pool, custom-session
Sprint 5: Questions AI (1 endpoint)   ← /generate (Gemini integration, save for dedicated sprint)
Sprint 6: Drills + Sync (3 endpoints) ← lab-cases transform + sync GET
```

**Rationale:**
- Start with the lowest-risk, highest-velocity group (Reference) to validate the workflow
- Questions bulk is the largest group but all endpoints are Prisma-heavy with no AI — doable in one sprint
- `/generate` is isolated complexity (Gemini call chain) — dedicated sprint avoids blocking the bulk questions
- Drills has substantial transform logic but no Edge incompatibilities — fits a single sprint

---

## Code Pattern Template

### Express (legacy)

```typescript
// routes/questions.ts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { system, difficulty } = req.query;
    const limit = Number(req.query.limit) || 10;
    const { getQuestionsWithFallback } = await import('../lib/services/questionBankService');
    const result = await getQuestionsWithFallback({ system, difficulty, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});
```

### Edge (target pattern)

```typescript
// functions/api/questions/index.ts
import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, CACHE_STRATEGY } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const QuestionsQuerySchema = z.object({
  system: z.string().optional(),
  difficulty: z.string().optional(),
  limit: z.string().optional().default('10').transform(Number),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  QuestionsQuerySchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/questions');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      const { system, difficulty, limit } = validated;
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Import service — ensure service has no Node.js deps
      const { getQuestionsWithFallback } = await import('../../lib/services/questionBankService');
      const result = await getQuestionsWithFallback({ system, difficulty, limit });

      logger.info('Questions fetched', { system, difficulty, limit });
      return { data: result };
    } catch (error) {
      logger.error('Failed to fetch questions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch questions');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
```

### Key Differences

| Aspect | Express | Edge (CF Pages Functions) |
|--------|---------|--------------------------|
| Auth | `requireAuth` middleware + `req.auth.userId` | `authenticatedEndpoint()` or `withAuth()` middleware |
| Validation | `validateRequired()` / `validateEnum()` | Zod schema + `withValidation()` |
| Request body | `req.body` | `context.validated` (after Zod validation) |
| Query params | `req.query` | `context.validated` with `source: 'query'` |
| Route params | `req.params.id` | `context.params.id` |
| Env vars | `process.env.DATABASE_URL` | `context.env.DATABASE_URL` |
| Prisma | `import { prisma } from '../lib/prisma'` | `createEdgePrismaClient(env.DATABASE_URL)` |
| Prisma disconnect | Automatic (long-running server) | `safePrismaDisconnect(prisma)` in `finally` |
| CORS | `cors()` middleware | `withCors()` middleware |
| Rate limiting | `express-rate-limit` | `withRateLimit()` middleware |
| Error response | `res.status(500).json({ error })` | `throw new Error('message')` (caught by `withErrorHandling`) |
| UUID | `import { v4 as uuidv4 } from 'uuid'` | `crypto.randomUUID()` (Edge-native) |
| `$queryRaw` | Full Node pg driver | Prisma Accelerate — may need `$queryRawUnsafe` or rewrite |

### Middleware Stack Reference

| Stack | Use When | Middleware Chain |
|-------|----------|-----------------|
| `publicEndpoint(schema, handler)` | No auth required | CORS → Error → EnvCheck → RateLimit(600/min) → Validation → Logging |
| `authenticatedEndpoint(schema, handler)` | Auth required | CORS → Error → EnvCheck → Auth → RateLimit(300/min) → Validation → Logging |
| `adminAuthenticatedEndpoint(schema, handler)` | Admin only | CORS → Error → EnvCheck → Auth → AdminRole → RateLimit(60/min) → Validation → Logging |
| `aiEndpoint(schema, handler)` | Calls Gemini/AI | CORS → Error → EnvCheck → Auth → RateLimit(25/min) → Validation → Logging |
| `withCors()` | OPTIONS handler | CORS preflight |

---

## Testing Strategy

### Per-Endpoint Group

| Group | Unit Tests | Integration Tests | E2E Tests | Notes |
|-------|-----------|-------------------|-----------|-------|
| **Reference** (5) | Service-level mocks | Edge function handler tests | N/A for V1 | Identical pattern — write one test template, copy |
| **Labs** (3) | Prisma query validation | `findMany` vs `$queryRaw` behavior | Drill component | Verify `$queryRaw` replacement returns same results |
| **Users** (3) | Auth flow + Prisma writes | `clerkId → user.id` lookup | Dashboard widgets | BigInt timestamp serialization check |
| **OSCE** (5) | Ownership enforcement | Session CRUD lifecycle | OSCE flow | Test: wrong user gets 404 |
| **Questions bulk** (10) | Query/filter combinations | `getQuestionsWithFallback` | Main session | Test: no-repeat dedup, batch ID lookup |
| **Questions AI** (1) | Semantic cache hit/miss | Gemini call (mocked) | Custom session | Test: fallback on AI failure |
| **Drills** (2) | `transformLabCase` unit tests | Lab case fetch + filter | MiniLabDrill | Panel parsing edge cases |
| **Sync** (1) | Read parity with POST sync | Data consistency | Settings page | Verify GET returns same shape as POST response |

### Test Template (Vitest)

```typescript
// functions/api/questions/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from './index';

// Mock environment
const mockEnv = {
  DATABASE_URL: 'prisma://mock-accelerate.prisma-data.net/?api_key=test',
  CLERK_SECRET_KEY: 'sk_test_mock',
};

const createMockRequest = (url: string, init?: RequestInit) =>
  new Request(url, { headers: { Authorization: 'Bearer mock-token' }, ...init });

describe('GET /api/questions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns questions with default limit', async () => {
    // Set up mock context
    const context = {
      request: createMockRequest('http://localhost/api/questions'),
      env: mockEnv,
      params: {},
      validated: { system: undefined, difficulty: undefined, limit: 10 },
    };

    // Mock the service import
    vi.mock('../../lib/services/questionBankService', () => ({
      getQuestionsWithFallback: vi.fn().mockResolvedValue({
        questions: [{ id: 'q1', question: 'Test?' }],
        total: 1,
        source: 'pool',
      }),
    }));

    const response = await onRequestGet(context as any);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.questions).toHaveLength(1);
  });
});
```

### Test Execution

```bash
# Run all Edge function tests
npx vitest run functions/api/

# Run specific group
npx vitest run functions/api/questions/
npx vitest run functions/api/osce/

# Watch mode during development
npx vitest watch functions/api/
```

---

## Express Removal Checklist

Once all P0 + P1 endpoints are ported:

- [ ] All P0 endpoints (16) have Edge equivalents with passing tests
- [ ] All P1 endpoints (13) have Edge equivalents with passing tests
- [ ] Switch `npm run dev` to `npm run dev:wrangler` exclusively for 1 week
- [ ] Verify all frontend features work against wrangler dev server
- [ ] Run full E2E test suite against wrangler
- [ ] Remove `routes/` directory
- [ ] Remove `server.ts`
- [ ] Remove Express dependencies (`express`, `cors`, `helmet`, `express-rate-limit`)
- [ ] Update `CLAUDE.md` dev commands
- [ ] Remove `npm run dev:all` from `package.json`
- [ ] Update `docs/express-to-edge-migration.md` to mark all ✅

---

*This document complements `docs/express-to-edge-migration.md` (status tracker) with migration implementation details.*
