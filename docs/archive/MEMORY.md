# PANaCEa - Deep Context & Persistent Memory

## Project Overview
**PANaCEa** is an AI-powered PANCE/PANRE exam preparation platform for Physician Assistant students. It combines adaptive learning (FSRS v5 spaced repetition), AI-generated clinical questions (Google Gemini), and a comprehensive medical content database to create a personalized study experience.

## Core Architecture

### Deployment Model
- **Production**: Cloudflare Pages + Functions (Edge Runtime)
- **Local Dev**: Vite (port 3000) + Express (port 3001, legacy) OR Wrangler Pages Dev
- **Database**: PostgreSQL (Supabase) via Prisma ORM with Accelerate
- **Authentication**: Clerk (webhook-based user sync)

### Critical Architectural Constraints
1. **Edge-First**: All production code runs on Cloudflare Workers (no Node.js APIs like `fs`, `path`, `os`)
2. **Database-First**: Medical content lives in PostgreSQL, NOT static JSON/TS files
3. **Prisma Singleton**: Always use `import { prisma } from '@/lib/prisma'` - never instantiate `new PrismaClient()`
4. **Serverless Patterns**: Functions export `onRequestGet/Post(context)`, not Express `(req, res)`

## Tech Stack

### Frontend
- **React 19** (functional components, hooks)
- **TypeScript 5.8** (strict mode enabled)
- **Vite 6** (build tool, HMR)
- **TailwindCSS 3.4** (utility-first styling)
- **Framer Motion 12** (animations, transitions)
- **Lucide React** (icon library)
- **React Router 7** (client-side routing)
- **TanStack Query 5** (server state management)

### Backend
- **Cloudflare Pages Functions** (production API, Edge Runtime)
- **Express 4** (legacy local dev only, NOT deployed)
- **Prisma 7.2** (ORM, schema management)
- **PostgreSQL 16** (database)
- **Zod 4** (runtime validation)

### AI & Services
- **Google Gemini API** (question generation, streaming responses)
- **Clerk** (authentication, user management)
- **Supabase** (PostgreSQL hosting, storage)
- **Sentry** (error tracking)

### Testing & Quality
- **Vitest 4** (unit tests)
- **Playwright 1.57** (E2E tests)
- **ESLint 9** (linting)
- **Prettier 3** (formatting)

## Data Models (Prisma Schema)

### Core Entities
- **User**: Clerk-synced users with FSRS weights, preferences, lifecycle role
- **MedicalContent**: Canonical condition data (symptoms, diagnostics, treatment)
- **Condition**: Metadata registry (system, subcategory, parent hierarchy)
- **Question**: User-facing questions (vignette, options, explanation)
- **QuestionSeed**: Template-based question generators with variables
- **PreGeneratedQuestion**: Staging lake for AI-generated questions
- **Card**: FSRS v6 spaced repetition cards (1:1 with user+question)
- **ReviewLog**: Historical review data (grade, stability, difficulty, telemetry)

### Medical Knowledge
- **Drug**: Pharmacology (mechanism, indications, contraindications)
- **LabTest**: Lab values (normal ranges, interpretation)
- **ImagingStudy**: Radiology (modality, findings, contraindications)
- **PhysicalExamFinding**: Clinical exam maneuvers
- **AnatomyStructure**: Anatomical structures (system, region, function)
- **DifferentialDiagnosis**: DDx lists by presenting complaint

### Linking Tables (Many-to-Many)
- **DrugConditionLink**: Drug ↔ Condition relationships
- **LabConditionLink**: Lab ↔ Condition relationships
- **ImagingConditionLink**: Imaging ↔ Condition relationships
- **FindingConditionLink**: Physical exam ↔ Condition relationships

### Analytics & Progress
- **StudySession**: Session-level analytics (accuracy, momentum, calibration)
- **QuestionAttempt**: Individual question attempts (telemetry, timing)
- **UserProgress**: Per-condition FSRS state
- **DailyUserAnalytics**: Daily aggregated stats
- **UserRolling360Stats**: Rolling 360-question window for PANCE score prediction

## State Management Patterns

### Client State
- **React Context**: Theme, navigation, session, keyboard shortcuts
- **TanStack Query**: Server state caching, optimistic updates
- **LocalStorage**: User preferences (`panceai_*` keys), offline data

### Server State
- **Prisma**: Single source of truth for all medical content
- **Cloudflare KV**: Rate limiting, distributed caching
- **Supabase Storage**: Media assets (images, PDFs)

## Key Design Patterns

### 1. Hybrid Content Engine
**Problem**: AI generation is slow (2-5s) and expensive ($7,300/year)
**Solution**: Staging Lake + No-Repeat Logic
- Generate questions → `PreGeneratedQuestion` table (staging)
- Admin reviews → promote to `Question` table (production)
- Track usage → `UserQuestionSeen` (no-repeat enforcement)
- **Result**: 90% cost reduction, 40-100x faster delivery

### 2. FSRS v6 Spaced Repetition
**Algorithm**: Free Spaced Repetition Scheduler (open-source)
- **Card Model**: `stability`, `difficulty`, `state` (New/Learning/Review/Relearning)
- **Review Grades**: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
- **Optimization**: Per-user weight tuning via `PersonalizedFSRSParams`
- **Statistical Quarantine**: Only `ReviewLog` entries with `sessionType = 'MAIN'` influence weights

### 3. Edge-Safe API Patterns
```typescript
// ✅ CORRECT: Cloudflare Pages Function
export async function onRequestPost(context) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    const body = await context.request.json();
    // ... logic
    return new Response(JSON.stringify(result), { status: 200 });
  } finally {
    await prisma.$disconnect();
  }
}

// ❌ WRONG: Express pattern (not deployed)
app.post('/api/endpoint', async (req, res) => {
  // This only works in local dev (server.ts)
});
```

### 4. Database-First Content Loading
```typescript
// ✅ CORRECT: Load from database
const conditions = await prisma.condition.findMany({
  where: { system: 'CARDIO' },
  include: { content: true }
});

// ❌ WRONG: Static import (violates architecture)
import { conditionRegistry } from '@/config/conditionRegistry';
```

## File Structure

```
PANaCEa/
├── components/          # React UI components (root level)
│   ├── drill/          # Drill mode components
│   ├── modes/          # Training mode implementations
│   ├── admin/          # Admin CMS components
│   └── session/        # Question session UI
├── functions/          # Cloudflare Pages Functions (PRODUCTION API)
│   └── api/           # API routes (Edge Runtime)
│       ├── _shared/   # Shared utilities (auth, prisma, rate limiting)
│       ├── questions/ # Question generation & fetching
│       ├── gemini/    # AI proxy endpoints
│       └── users/     # User management
├── routes/            # Express routes (LOCAL DEV ONLY, NOT DEPLOYED)
├── lib/               # Server/shared logic (root level)
│   ├── fsrs.ts       # FSRS v6 algorithm
│   ├── prisma.ts     # Prisma singleton
│   ├── services/     # Business logic (CMS, SRS, Auto-author)
│   └── middleware/   # Express middleware (local dev only)
├── src/               # Frontend-only code
│   └── lib/          # Client-side utilities (search, markdown)
├── hooks/             # React custom hooks
├── contexts/          # React context providers
├── pages/             # Top-level page components
├── services/          # Client-side services (API clients)
├── types/             # TypeScript type definitions
├── prisma/            # Database schema & migrations
│   ├── schema.prisma # Source of truth for data models
│   └── migrations/   # Database migration history
├── scripts/           # Automation & maintenance scripts
│   ├── generators/   # Content generation (labs, mnemonics)
│   ├── automation/   # Scheduled jobs (hourly, daily, weekly)
│   └── seed/         # Database seeding scripts
└── public/            # Static assets
    ├── _headers      # Cloudflare security headers (CSP)
    └── images/       # Medical images, diagrams
```

## Environment Variables

### Required (Production)
```bash
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (Prisma Accelerate)
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=...

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# Supabase
VITE_SUPABASE_URL=https://....supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Sentry (optional)
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### Local Development
```bash
# Use local PostgreSQL
DATABASE_URL=postgresql://panacea:panacea_dev@localhost:5432/panacea_dev
```

## Known Limitations & Technical Debt

### 1. Legacy Express Routes
- **Location**: `routes/` directory
- **Status**: NOT deployed to production (Cloudflare Pages only serves `functions/`)
- **Action**: Gradually migrate to `functions/api/` or deprecate

### 2. Static Condition Registry
- **Location**: `config/conditionRegistry.ts`
- **Status**: Legacy metadata file (2195 entries)
- **Action**: Fully migrated to database, but file still exists for reference

### 3. TypeScript Strictness
- **Current**: `@typescript-eslint/no-explicit-any: off`
- **Goal**: Enable strict mode incrementally
- **Blockers**: Large codebase, gradual migration in progress

### 4. React Hooks Exhaustive Deps
- **Current**: `react-hooks/exhaustive-deps: off`
- **Goal**: Re-enable and fix dependency arrays
- **Blockers**: Conditional hooks in error boundaries, complex effect chains

### 5. Prisma Disconnect Patterns
- **Issue**: Some routes don't call `prisma.$disconnect()` in `finally` blocks
- **Impact**: Connection pool exhaustion in serverless environments
- **Action**: Audit all API routes, enforce pattern in code reviews

## Performance Optimizations

### 1. Bundle Splitting (Vite)
- **Vendor Chunks**: `vendor-clerk`, `vendor-ui`, `vendor-auth`, `vendor-validation`
- **Data Chunks**: `data-conditions`, `data-drugs`, `data-labs`
- **Component Chunks**: Large components split into separate bundles
- **Result**: Faster initial load, better caching

### 2. PWA & Service Worker
- **Strategy**: Aggressive caching with immediate SW updates
- **Cache-First**: Data chunks, images, staging lake questions
- **Network-First**: Vendor chunks (avoid stale cache)
- **Offline Support**: Question pool, pearls, condition data

### 3. Database Indexing
- **Composite Indexes**: `[userId, createdAt]`, `[system, panceYield]`
- **Full-Text Search**: `tsvector` on `MedicalContent.search_vector`
- **Vector Search**: `pgvector` for semantic similarity (ContentChunk embeddings)

### 4. Edge Caching
- **Cloudflare KV**: Rate limiting, distributed cache
- **Gemini Cache**: Context caching for PANCE blueprint (reduces API costs)
- **CDN**: Static assets served from Cloudflare edge

## Security Considerations

### 1. Content Security Policy (CSP)
- **Location**: `public/_headers`
- **Allowlist**: Clerk, Turnstile, Supabase, Gemini
- **Action**: Update before adding new external origins

### 2. Rate Limiting
- **Implementation**: `functions/api/_shared/rateLimiter.ts`
- **Endpoints**: `/api/gemini`, `/api/gemini/stream`
- **Storage**: Cloudflare KV (distributed)

### 3. Authentication
- **Clerk Webhooks**: User sync on signup/update
- **Turnstile**: Bot protection on webhook endpoints
- **Role-Based Access**: Prisma `UserRole` enum (USER, EDITOR, ADMIN, SUPERADMIN)

### 4. Input Validation
- **Zod Schemas**: All API endpoints validate inputs
- **Sanitization**: HTML sanitization for user-generated content
- **SQL Injection**: Prisma parameterized queries (safe by default)

## Development Workflows

### Local Development
```bash
# Start PostgreSQL (Docker)
docker-compose up -d

# Run migrations
npm run db:migrate:dev

# Start dev servers (Express + Vite)
npm run dev:all

# OR: Start Wrangler (Cloudflare Pages parity)
npm run dev:wrangler
```

### Database Workflows
```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate:dev

# Apply migrations (production)
npm run migrate:production

# Open Prisma Studio (GUI)
npm run db:studio
```

### Testing
```bash
# Unit tests
npm test

# E2E tests (Playwright)
npm run test:e2e

# Smoke tests (critical flows)
npm run test:smoke

# Type checking
npm run typecheck
```

### Content Pipeline
```bash
# Generate lab content
npm run generate:lab

# Generate clinical content
npm run generate:clinical

# Run full orchestration
npm run orchestrate:full

# Sync registries to database
npm run sync:all-registries
```

## Common Pitfalls

1. **Missing Database**: Empty content if `DATABASE_URL` not set
2. **Forgetting `onRequest*` Exports**: Functions must export `onRequestGet/Post/etc.`
3. **Skipping Svix Verification**: Clerk webhooks must verify signatures
4. **Bundling Prisma**: Prisma packages must be externalized in Vite config
5. **Static JSON Fallbacks**: Never use static JSON for medical content (database-first)
6. **Node.js APIs in Functions**: No `fs`, `path`, `os` in `functions/` directory
7. **Express Patterns in Functions**: Use `context.request`, not `req.body`
8. **Missing Prisma Disconnect**: Always call `prisma.$disconnect()` in `finally` blocks

## Future Roadmap

### Phase 1: Intelligence Layer (In Progress)
- Gemini Live integration (voice-to-voice)
- Clinical Eye (image analysis)
- Knowledge Cache (context caching)
- Visualizer (AI-generated diagrams)
- Podcast generation (NotebookLM-style)

### Phase 2: FSRS Enhancements
- Visual mnemonics generation
- Adaptive difficulty tuning
- Circadian rhythm optimization
- Ghost grader (implicit confidence scoring)

### Phase 3: Content Expansion
- 3D anatomy models (bounding boxes)
- OSCE simulation (live patient encounters)
- Smart PDF viewer (citation extraction)
- Guideline integration (UpToDate-style)

### Phase 4: Collaboration
- Study groups
- Peer statistics
- Leaderboards
- Shared question banks

## References

- **Master Documentation**: `MASTER_DOCUMENTATION.md`
- **Cloudflare Guide**: `CLOUDFLARE_FUNCTIONS_GUIDE.md`
- **Database Implementation**: `DATABASE_IMPLEMENTATION.md`
- **Hybrid Content Engine**: `HYBRID_CONTENT_ENGINE.md`
- **Admin CMS**: `ADMIN_CMS_IMPLEMENTATION.md`
- **Production Checklist**: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- **AI Integration Roadmap**: `docs/AI_INTEGRATION_ROADMAP.md`
- **Intelligence Layer**: `docs/INTELLIGENCE_LAYER.md`
- **GitHub Spark Protocol**: `docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md`

---

**Last Updated**: 2025-01-06
**Version**: 1.0.0
**Maintainer**: PANaCEa Development Team
