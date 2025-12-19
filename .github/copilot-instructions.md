# PANaCEa AI Copilot Instructions

## Project Overview

PANaCEa is a medical education platform for PA (Physician Assistant) students preparing for PANCE/PANRE exams. It combines adaptive learning (FSRS-based SRS), gamification, and AI-generated clinical scenarios.

**Tech Stack**: React 19 + TypeScript + Vite (frontend), Express.js (backend), PostgreSQL + Prisma (database), Google Gemini API (AI), Clerk (auth), Framer Motion (animations)

## Critical Architecture Patterns

### Database-First Architecture
**ALL content comes from PostgreSQL** - no static JSON fallbacks in production:
- Services in `services/` and `lib/services/` query Prisma directly (server-side)
- Frontend fetches via `/api/content/*` endpoints (never imports JSON files)
- Build process externalizes Prisma packages in `vite.config.ts` to prevent browser bundling
- Migration: `npm run migrate:production` (interactive) or `npm run db:migrate:deploy` (CI/CD)
- Scripts in `scripts/` handle content generation, sync, and orchestration

### Frontend-Backend Split (Dual Server Architecture)
- **Frontend** (`:3000`): Vite dev server; proxies `/geminiProxy` and `/api/*` to backend
- **Backend** (`:3001`): Express server; handles auth, rate limiting, Gemini API, database queries
- **MUST run both**: `npm run dev:all` (recommended) or separate terminals
- **Common error**: Running only `npm run dev` causes "Unexpected token '<'" errors (HTML returned for API calls)

### Data Flow Pattern
1. User action in React component → service call (e.g., `services/geminiService.ts`)
2. Service calls `/geminiProxy` or `/api/*` endpoint on backend
3. Backend (`server.ts`) authenticates via Clerk middleware, validates/sanitizes input
4. Proxies to Gemini API or queries database via Prisma
5. Response flows back through service → component state

### Key File Organization
- `App.tsx`: Main router with lazy-loaded drill mode components (`lazy(() => import(...))`)
- `components/`: React UI, organized by feature (drill/, modes/, admin/, integrations/)
- `services/`: Pure business logic (geminiService, srsService, conditionDataLoader)
- `lib/services/`: Backend services (cms/, srsService, autoAuthor/)
- `lib/middleware/`: Express middleware (clerkAuth, adminAuth, validation, promptValidation)
- `server.ts`: Express app (3100 lines); all API routes, health checks, Gemini proxy
- `types.ts`: Core TypeScript definitions (Question, PerformanceRecord, SessionSettings) - **deprecated but still widely used**
- `src/types/`: New type definitions (drill-modes.ts, etc.) - **preferred for new code**
- `conditionRegistry.ts`: Master registry mapping condition IDs to metadata (2195 lines)

## Content & Condition System

### How Content Works
- Medical conditions defined in `conditionRegistry.ts` (2195 lines) with metadata (system, subcategory, aliases, mediaIds)
- Content stored in PostgreSQL `MedicalContent` table (JSONB fields for flexibility)
- Services load via `services/conditionDataLoader.ts` (database-only, no filesystem access)
- Questions reference `conditionId` (stable ID from registry) and `condition` (human-readable name)
- **Multi-system tagging**: Conditions can have `relatedSystems` array (e.g., Sarcoidosis: primary PULM, related DERM/HEENT)

### PANCE System Codes
Used throughout for filtering/analytics (see `SystemCode` type in `types.ts`):
```
CV (Cardiovascular), PULM (Pulmonary), GI, NEURO, MSK, DERM, 
HEME, ENDO, HEENT, RENAL, REPRO, PSYCH, ID, GU, PRO (Professional), OTHER (internal)
```

### Content Generation Pipeline
Scripts in `scripts/` (run via npm scripts):
- **Conversion**: `npm run sync:condition-content` - Convert markdown → JSON (legacy, database-first now)
- **AI Generation**: `npm run generate:lab|clinical|basic-science-links` - Generate content via Gemini
- **Media**: `npm run media:integrate|process-existing` - Process and link media assets
- **Database Sync**: `npm run sync:all` - Sync all registries (conditions, drugs, anatomy, etc.) to database
- **Orchestration**: `npm run orchestrate:full` - Automated content pipeline (generation, validation, sync)
- **Automation**: `npm run automation:hourly|daily|weekly` - Scheduled maintenance tasks

## Key Patterns & Conventions

### State Management
- **Performance data**: Stored in localStorage (`panceai_performance_v2`, `panceai_missed_v2`, `panceai_flagged_v2`)
- **SRS scheduling**: FSRS v5 algorithm (`lib/fsrs.ts`) with user-specific tuning (UserSRSConfig in Prisma)
- **User profile**: Clerk for auth; onboarding/metadata stored in Prisma User table
- **Session settings**: SessionSettings type controls focus (all/growth/review/topic), difficulty, filtering

### Error Handling
- Validation middleware in `lib/middleware/validation.ts`:
  - `validateRequired(fields)` - Check required fields exist
  - `validateStringLength(field, min, max)` - Enforce string constraints
  - `validateEnum(field, allowedValues)` - Validate against enum
  - `sanitizeBody` - Middleware to sanitize all request bodies
- ErrorBoundary component catches React errors; server logs all errors
- Always include try-catch in services; propagate meaningful error messages
- Express endpoints return `{ error: string, details?: any }` on failure

### Build & Chunking (vite.config.ts)
- **Manual chunks** for better caching:
  - `vendor-clerk`: Clerk authentication library
  - `vendor-animation`: Framer Motion
  - `data-drugs`, `data-conditions`, `data-labs`: Large data files
  - `drill-[name]`: Individual drill mode components
  - `admin`: Admin/CMS components
- **Lazy loading**: All drill modes use `lazy(() => import(...))` in `App.tsx`
- **Prisma externalization**: Prisma packages explicitly excluded from browser bundles
- **Source maps**: `hidden` in production (generated but not referenced in code)

### Database Access
- **Prisma client**: Initialized with Edge Adapter (`@prisma/adapter-neon`) for serverless
- **Connection pooling**: Use Supabase "Transaction" mode for best performance
- **Key models**: User, PerformanceRecord, SRSItem, SavedQuestion, UserAchievement, DailyStreak, MedicalContent, UserSRSConfig
- **Environment**: `DATABASE_URL` required for production; optional for development
- **Migrations**: `npm run migrate:production` (interactive) or `npm run db:migrate:deploy` (CI/CD)

### API Conventions (Express in server.ts)
- **Authentication**: All endpoints require `requireAuth` middleware (adds `req.auth.userId`)
- **Admin endpoints**: Use `requireAdmin({ roles: ['admin', 'superadmin'] })`
- **Input validation**: Chain `validateRequired`, `validateEnum`, `validateStringLength` before handler
- **Input sanitization**: `sanitizeBody` middleware auto-applied to all routes
- **Typed requests**: Use `AuthenticatedRequest` type for authenticated endpoints
- **Error responses**: Always `{ error: string, details?: any }` with appropriate HTTP status
- **Rate limiting**: Applied globally via `express-rate-limit` (100 req/15min per IP)
- **Security**: `helmet` middleware for security headers; CORS restricted to frontend URL

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
- **Development**: `npm run dev:all` (frontend + backend), `npm run dev:server` (backend only), `npm run dev` (frontend only)
- **Content generation**: `npm run generate:lab`, `npm run generate:clinical`, `npm run generate:basic-science-links`
- **Database sync**: `npm run sync:all` (sync all registries), `npm run sync:conditions|drugs|anatomy` (individual)
- **Database migrations**: `npm run db:migrate:dev` (development), `npm run migrate:production` (production)
- **Orchestration**: `npm run orchestrate:full` (full pipeline), `npm run automation:hourly|daily|weekly` (scheduled tasks)
- **Build**: `npm run build` (frontend), `npm run build:server` (backend)

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
**"Unexpected token '<'" errors**: Backend not running - use `npm run dev:all` instead of `npm run dev` alone
**API endpoints return HTML**: Vite dev server intercepting API routes - ensure backend is running on port 3001
