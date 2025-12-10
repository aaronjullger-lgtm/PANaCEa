# PANaCEa AI Copilot Instructions

## Project Overview

PANaCEa is a medical education platform for PA (Physician Assistant) students preparing for PANCE/PANRE exams. It combines adaptive learning (SRS), gamification, and AI-generated clinical scenarios.

**Tech Stack**: React 19 + TypeScript + Vite (frontend), Express.js (backend), PostgreSQL + Prisma (database), Google Gemini API (AI), Clerk (auth), Framer Motion (animations)

## Architecture Essentials

### Frontend-Backend Split
- **Frontend** (`:3000`): React app; routes requests to backend via `/geminiProxy` proxy
- **Backend** (`:3001`): Express server handling auth, rate limiting, Gemini API calls, database queries
- **Start both**: `npm run dev:all` (or `npm run dev:server` + `npm run dev` separately)

### Data Flow Pattern
1. User action in React component → service call (e.g., `services/geminiService.ts`)
2. Service calls `/geminiProxy` endpoint on backend
3. Backend (server.ts) authenticates via Clerk middleware, validates input
4. Proxies to Gemini API or database via Prisma
5. Response flows back through service → component state

### Key File Organization
- `App.tsx`: Main router; uses lazy loading for drill modes
- `components/`: React UI, organized by feature (drill/, modes/, admin/)
- `services/`: Pure business logic (geminiService, srsService, etc.)
- `lib/services/cms/`: Content lifecycle (draft → published), audit logging
- `lib/middleware/`: Express middleware (Clerk auth, input validation)
- `server.ts`: Express app (1369 lines); health checks, Gemini proxy, rate limiting
- `types.ts` & `src/types/`: Core TypeScript definitions (Question, PerformanceRecord, etc.)

## Content & Condition System

### How Content Works
- Medical conditions stored in `data/conditionContent.generated.json` (auto-generated from markdown)
- Registry: `conditionRegistry.ts` maps condition IDs to metadata (PANCE system, subcategory)
- Services load and normalize this JSON at runtime
- Questions reference `conditionId` (stable) and `condition` (human name)

### PANCE System Codes
Used throughout for filtering/analytics:
```
CV (Cardiovascular), PULM (Pulmonary), GI, NEURO, MSK, DERM, 
HEME, ENDO, HEENT, RENAL, REPRO, PSYCH, ID, GU, PRO
```

### Content Generation Pipeline
Scripts in `scripts/` (run via npm scripts):
- `npm run sync:condition-content`: Convert markdown → JSON
- `npm run generate:lab|clinical|basic-science-links`: AI-generated content via Gemini
- `npm run media:integrate|process-existing`: Process media assets

## Key Patterns & Conventions

### State Management
- **Performance data**: Stored in localStorage (`panceai_performance_v2`, `panceai_missed_v2`, `panceai_flagged_v2`)
- **SRS scheduling**: Custom intervals (1d → 3d → 7d → 14d) implemented in `scheduleNextReview()`
- **User profile**: Clerk for auth; onboarding stored in Prisma User table

### Error Handling
- Validation middleware in `lib/middleware/validation.ts` (required fields, string length, enums)
- ErrorBoundary component catches React errors; server logs all errors
- Always include try-catch in services; propagate meaningful error messages

### Build & Chunking
- Vite config uses manual chunks: vendor-clerk, vendor-animation, data-drugs, data-conditions
- Drill mode components split to `drill-[name]` chunks for lazy loading
- Admin components in separate `admin` chunk
- Source maps: `hidden` in production (generated but not referenced)

### Database Access
- Prisma client initialized with Edge Adapter for serverless compatibility
- Connection pooling via Supabase recommended (use "Transaction" mode)
- Models: User, PerformanceRecord, SRSItem, SavedQuestion, UserAchievement, DailyStreak, MedicalContent (CMS)
- Optional for development; required for production with `npm run migrate:production`

### API Conventions (Express)
- All endpoints require Clerk auth via `requireAuth` middleware
- Request body sanitized by `sanitizeBody` middleware
- Use Express types: `AuthenticatedRequest` includes `req.auth.userId`
- Error responses always include `error` field and optional `details`

## Development Workflow

### Setup
```bash
npm install
cp .env.example .env
# Add: VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, GEMINI_API_KEY, DATABASE_URL (optional)
npm run dev:all  # Start both frontend and backend
```

### Testing & Validation
- Run tests: `npm test` (Vitest)
- Lint: Check for TypeScript errors via IDE
- Database: `npm run db:studio` opens Prisma Studio GUI
- Health check: `npm run health-check` (content validation script)

### Important Scripts
- Content generation: `npm run generate:lab`, `npm run generate:clinical`
- Database: `npm run db:migrate:dev` (development), `npm run migrate:production` (production)
- Background jobs: `npm run orchestrate:full` (automated content pipeline)

### Deployment
- Frontend: Build with `npm run build`; deploy to Cloudflare Pages
- Backend: Cloudflare Functions handle `/functions/geminiProxy.ts` (for serverless)
- Or run `server.ts` as Node.js server for traditional hosting
- See `CLOUDFLARE_DEPLOYMENT.md` for full setup

## Critical Considerations

### Security
- Never use `VITE_` prefixed env vars on backend (they're client-side only)
- Always sanitize request bodies; validate input types/lengths
- Clerk authentication required for all API endpoints
- Rate limiting implemented in-memory; use Redis for distributed deployments

### Performance
- Lazy-load drill mode components via dynamic imports (see `App.tsx` lazy() calls)
- Data files (conditions, drugs) split into separate chunks
- Use `useMemo` for expensive calculations; memoize components
- Prefetch Gemini questions: `prefetchQuestions()` in background

### No-Repeat Logic
- Questions tracked in localStorage; SRS items in Prisma
- Repeat-level system prevents same question in same session
- `getNextQuestion()` filters by system/difficulty and avoids repeats
- See `DATABASE_IMPLEMENTATION.md` for details

### Admin & CMS
- Content lifecycle: DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED → ARCHIVED
- Audit logging tracks all changes (who, what, when)
- Only admins/approvers can transition states (RBAC in `lib/services/cms/`)

## Where to Look for Help

- Architecture deep dive: `DEVELOPER_GUIDE.md`
- Database schema & no-repeat logic: `DATABASE_IMPLEMENTATION.md`
- CMS/content lifecycle: `ADMIN_CMS_IMPLEMENTATION.md` & `lib/services/cms/contentService.ts`
- Drill modes: `PHASE_11_IMPLEMENTATION.md` (integrations), `HYBRID_CONTENT_ENGINE.md`
- Deployment: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `CLOUDFLARE_DEPLOYMENT.md`

## Quick Troubleshooting

**Gemini proxy failing**: Check `GEMINI_API_KEY` in `.env` (not `VITE_`); backend server must be running
**Questions not loading**: Run `npm run sync:condition-content` to regenerate condition JSON
**Database errors**: Ensure `DATABASE_URL` set; run `npm run db:generate` to sync Prisma client
**Build slow**: Check chunk sizes; ensure vendor splits in `vite.config.ts` are up-to-date
