# PANaCEa AI Copilot Instructions

## Project Overview

PANaCEa is a medical education platform for PA (Physician Assistant) students preparing for PANCE/PANRE exams. It combines adaptive learning (FSRS-based SRS), gamification, and AI-generated clinical scenarios.

**Tech Stack**: 
- **Frontend**: React 19 + TypeScript + Vite, Framer Motion (animations), Tailwind CSS
- **Backend**: Cloudflare Functions (serverless), Express.js (optional traditional hosting)
- **Database**: PostgreSQL (Supabase) + Prisma ORM
- **AI**: Google Gemini API
- **Auth**: Clerk (with webhook sync to Prisma)
- **Deployment**: Cloudflare Pages

## Critical Architecture Patterns

### Cloudflare Functions Architecture (Primary)
**PANaCEa runs on Cloudflare Pages with Functions** - serverless-first approach:
- **Functions directory**: `/functions/` contains all serverless API routes
  - `/functions/api/` - API endpoints (conditions, drugs, srs, achievements, etc.)
  - `/functions/api/webhooks/clerk.ts` - Clerk user lifecycle webhook
  - `/functions/geminiProxy.ts` - Gemini API proxy
- **Request pattern**: `onRequestPost(context: PagesContext)` or `onRequestGet`
- **Environment**: Access via `context.env` (e.g., `env.DATABASE_URL`, `env.GEMINI_API_KEY`)
- **Prisma Edge**: Use `createEdgePrismaClient(env.DATABASE_URL)` from `/functions/api/_shared/prisma-edge.ts`
- **Auth**: Import `authenticateRequest` from `/functions/api/_shared/auth.ts`
- **No Express.js required** for Cloudflare deployment

### Legacy Express Backend (Optional)
- `server.ts` exists for local development or traditional Node.js hosting
- **For Cloudflare deployments, ignore `server.ts`** - use Functions instead
- If running locally: `npm run dev:all` starts both Vite (3000) and Express (3001)

### Database-First Architecture
**ALL content comes from PostgreSQL** - no static JSON fallbacks in production:
- Services in `services/` and `lib/services/` query Prisma directly (server-side)
- Frontend fetches via `/api/content/*` endpoints (never imports JSON files)
- Build process externalizes Prisma packages in `vite.config.ts` to prevent browser bundling
- Migration: `npm run migrate:production` (interactive) or `npm run db:migrate:deploy` (CI/CD)
- Scripts in `scripts/` handle content generation, sync, and orchestration

### Data Flow Pattern
1. User action in React component → service call (e.g., `services/geminiService.ts`)
2. Service calls `/api/*` endpoint (Cloudflare Function)
3. Function authenticates via Clerk, validates/sanitizes input
4. Queries database via Prisma Edge or proxies to Gemini API
5. Response flows back through service → component state

### Key File Organization
- `App.tsx`: Main router with lazy-loaded drill mode components (`lazy(() => import(...))`)
- `components/`: React UI, organized by feature
  - `analytics/` - IntelligenceHub with Master-Detail conditions view
  - `drill/` - Drill mode components
  - `modes/` - Training modes
  - `admin/` - Admin/CMS components
  - `integrations/` - External tool integrations
- `functions/`: Cloudflare Functions (serverless API)
  - `api/_shared/` - Shared utilities (auth, prisma, validation)
  - `api/webhooks/` - Webhook handlers
  - `geminiProxy.ts` - AI proxy
- `services/`: Frontend business logic (geminiService, srsService, conditionDataLoader)
- `lib/services/`: Backend services (cms/, srsService, autoAuthor/)
- `lib/middleware/`: Express middleware (validation, auth) - **legacy, use Functions auth instead**
- `types.ts`: Core TypeScript definitions - **deprecated, prefer `src/types/`**
- `src/types/`: New type definitions (drill-modes.ts, etc.)
- `conditionRegistry.ts`: Master registry mapping condition IDs to metadata (2195 lines)
- `public/_headers`: CSP and security headers for Cloudflare Pages

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
- **AI Generation**: `npm run generate:lab|clinical|basic-science-links` - Generate content via Gemini
- **Media**: `npm run media:integrate|process-existing` - Process and link media assets
- **Database Sync**: `npm run sync:all` - Sync all registries (conditions, drugs, anatomy, etc.) to database
- **Orchestration**: `npm run orchestrate:full` - Automated content pipeline (generation, validation, sync)
- **Automation**: `npm run automation:hourly|daily|weekly` - Scheduled maintenance tasks

## Key Patterns & Conventions

### Authentication & Authorization
- **Clerk**: Handles user authentication (sign-in, sign-up, session management)
- **Webhook sync**: `/functions/api/webhooks/clerk.ts` syncs user lifecycle to Prisma
  - Handles: `user.created`, `user.updated`, `user.deleted`
  - Creates users with default `USER` role
  - Uses Cloudflare Turnstile for bot protection
- **API auth**: All endpoints use `authenticateRequest()` from `/_shared/auth.ts`
- **Admin endpoints**: Check user role from Prisma User table
- **No middleware pattern**: Functions handle auth directly in handler

### State Management
- **Performance data**: Stored in localStorage (`panceai_performance_v2`, `panceai_missed_v2`, `panceai_flagged_v2`)
- **SRS scheduling**: FSRS v5 algorithm (`lib/fsrs.ts`) with user-specific tuning (UserSRSConfig in Prisma)
- **User profile**: Clerk for auth; onboarding/metadata stored in Prisma User table
- **Session settings**: SessionSettings type controls focus (all/growth/review/topic), difficulty, filtering

### Error Handling
- **Functions**: Return standard `Response` objects with appropriate status codes
  - Success: `new Response(JSON.stringify(data), { status: 200 })`
  - Error: `new Response(JSON.stringify({ error: 'message' }), { status: 400 })`
- **Validation**: Use helper functions from `/_shared/validation.ts`
- **ErrorBoundary**: Component catches React errors
- **Try-catch**: Always wrap database/API calls; log errors with context

### Design System (Clinical UI)
- **Colors**: 
  - Text: `slate-900` (primary), `slate-500` (secondary), `slate-400` (muted)
  - Accents: `blue-600`, `blue-500`, `blue-300`
  - Backgrounds: `white`, `slate-50` (cards), `slate-100` (subtle)
  - Borders: `slate-200`, `slate-100`
- **Typography**: Inter/sans-serif, `font-medium` for labels, `font-bold` for headings
- **Spacing**: Consistent rounded-xl corners, generous padding (p-4, p-6)
- **Hover states**: `hover:translate-x-1`, `hover:border-blue-300`, `hover:shadow-sm` (no generic gray)
- **Icons**: Lucide React, consistent sizing (w-4 h-4 for small, w-5 h-5 for medium)
- **Animations**: Framer Motion with `easeOut` transitions, 0.2-0.3s duration
- **Master-Detail pattern**: List view → Detail view with sticky headers, AnimatePresence

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
- **Prisma Edge**: Use `createEdgePrismaClient()` in Cloudflare Functions
- **Connection pooling**: Supabase "Transaction" mode for best performance
- **Key models**: User, PerformanceRecord, SRSItem, SavedQuestion, UserAchievement, DailyStreak, MedicalContent, UserSRSConfig
- **Migrations**: `npm run db:migrate:dev` (development), `npm run db:migrate:deploy` (CI/CD)
- **Always disconnect**: Call `await prisma.$disconnect()` in finally blocks

### Content Security Policy
- **File**: `public/_headers`
- **Critical domains**:
  - Clerk: `https://*.clerk.accounts.dev`, `https://*.clerk.com`, `https://clerk.studypanacea.com`
  - Cloudflare: `https://challenges.cloudflare.com` (Turnstile)
  - Supabase: `https://*.supabase.co`, `wss://*.supabase.co`
  - Gemini: `https://generativelanguage.googleapis.com`
- **Directives**: `default-src`, `script-src`, `connect-src`, `frame-src`, `img-src`, `style-src`

## Development Workflow

### Setup
```bash
npm install
cp .env.example .env
# Add required vars:
# - VITE_CLERK_PUBLISHABLE_KEY (frontend)
# - CLERK_SECRET_KEY (backend/functions)
# - CLERK_WEBHOOK_SECRET (webhook verification)
# - GEMINI_API_KEY (AI generation)
# - DATABASE_URL (Supabase connection string)
npm run dev:all  # Start both frontend (Vite) and backend (Express) for local dev
# OR for Cloudflare Functions testing:
npm run dev  # Frontend only, uses deployed Functions
```

### Testing & Validation
- Run tests: `npm test` (Vitest)
- Lint: Check for TypeScript errors via IDE
- Database: `npm run db:studio` opens Prisma Studio GUI
- Health check: `npm run health-check` (content validation script)

### Important Scripts
- **Development**: 
  - `npm run dev:all` - Frontend + Express backend (local testing)
  - `npm run dev` - Frontend only (uses deployed Functions)
  - `npm run dev:server` - Express backend only (legacy)
- **Content generation**: 
  - `npm run generate:lab` - Generate lab content
  - `npm run generate:clinical` - Generate clinical content
  - `npm run generate:basic-science-links` - Generate basic science links
- **Database**:
  - `npm run sync:all` - Sync all registries to database
  - `npm run db:migrate:dev` - Create/apply development migration
  - `npm run db:migrate:deploy` - Apply migrations in production
  - `npm run migrate:production` - Interactive production migration
- **Build**: 
  - `npm run build` - Build frontend for production
  - `npm run build:server` - Build Express backend (legacy)

### Deployment (Cloudflare Pages)
1. **Frontend**: Automatic on push to main branch
2. **Environment Variables**: Set in Cloudflare Pages dashboard
   - `CLERK_WEBHOOK_SECRET`
   - `GEMINI_API_KEY`
   - `DATABASE_URL`
   - `CLERK_SECRET_KEY`
   - `VITE_*` vars (public, set in wrangler.toml)
3. **Migrations**: Run `npm run db:migrate:deploy` before deployment
4. **Webhook URL**: Configure in Clerk dashboard: `https://studypanacea.com/api/webhooks/clerk`
5. **Verify**: Check Functions logs in Cloudflare dashboard

## Critical Considerations

### Security
- **Environment variables**: 
  - `VITE_*` prefixed vars are PUBLIC (bundled in frontend)
  - Non-prefixed vars are SERVER-ONLY (Functions/backend)
  - Never use `VITE_` prefix for secrets (API keys, etc.)
- **Webhook verification**: Always verify Svix signatures in webhook handlers
- **Input sanitization**: Validate all user input before database queries
- **Rate limiting**: Applied globally via Cloudflare (100 req/15min per IP)
- **CSP**: Strict Content Security Policy in `public/_headers`

### Performance
- **Lazy loading**: Drill modes loaded on-demand via dynamic imports
- **Code splitting**: Manual chunks for better caching
- **Prefetching**: `prefetchQuestions()` for background loading
- **Memoization**: Use `useMemo` for expensive calculations
- **Database queries**: Use Prisma's query optimization (select specific fields, use includes wisely)

### No-Repeat Logic
- Questions tracked in localStorage; SRS items in Prisma
- Repeat-level system prevents same question in same session
- `getNextQuestion()` filters by system/difficulty and avoids repeats
- See `DATABASE_IMPLEMENTATION.md` for details

### Admin & CMS
- Content lifecycle: DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED → ARCHIVED
- Audit logging tracks all changes (who, what, when)
- Role-based access control (USER, VIEWER, EDITOR, APPROVER, ADMIN, SUPERADMIN)
- Only admins/approvers can transition states (RBAC in `lib/services/cms/`)

## Where to Look for Help

- **Architecture**: `DEVELOPER_GUIDE.md`
- **Database**: `DATABASE_IMPLEMENTATION.md`, `DATABASE_FIRST_ARCHITECTURE.md`
- **Cloudflare**: `CLOUDFLARE_DEPLOYMENT.md`, `CLOUDFLARE_FUNCTIONS_GUIDE.md`
- **CMS**: `ADMIN_CMS_IMPLEMENTATION.md`, `lib/services/cms/contentService.ts`
- **Drill modes**: `PHASE_11_IMPLEMENTATION.md`, `HYBRID_CONTENT_ENGINE.md`
- **Deployment**: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- **Authentication**: `AUTHENTICATION_SETUP.md`, `SUPABASE_CLERK_INTEGRATION.md`

## Quick Troubleshooting

### Common Issues

**Gemini proxy failing**
- Check `GEMINI_API_KEY` in Cloudflare environment variables (NOT `VITE_` prefixed)
- Verify Function is deployed and accessible
- Check Cloudflare Functions logs for errors

**Questions not loading**
- Run `npm run sync:all` to sync registries to database
- Check `DATABASE_URL` connection string
- Verify Prisma client is generated: `npm run db:generate`

**Clerk authentication failing**
- Verify `VITE_CLERK_PUBLISHABLE_KEY` in frontend env
- Check `CLERK_SECRET_KEY` in backend/Functions env
- Test webhook at Clerk dashboard (should return 200)
- Verify CSP allows Clerk domains in `public/_headers`

**Database errors**
- Ensure `DATABASE_URL` is set correctly
- Run `npm run db:generate` to sync Prisma client
- Check Supabase connection pooling mode (use "Transaction")
- Verify migrations are applied: `npm run db:migrate:deploy`

**Build/deployment issues**
- Check chunk sizes in build output
- Verify all dependencies are installed
- Ensure Prisma is externalized in `vite.config.ts`
- Clear build cache: `rm -rf dist node_modules/.vite`

**CSP violations**
- Check browser console for specific blocked resource
- Add domain to appropriate directive in `public/_headers`
- Common additions: Clerk (`*.clerk.com`), Turnstile (`challenges.cloudflare.com`)

**Webhook 405 errors**
- Verify using Cloudflare Functions (`/functions/api/webhooks/clerk.ts`)
- NOT Next.js App Router (`/app/api/webhooks/clerk/route.ts`) - delete if exists
- Use `onRequestPost` export pattern for Functions

**"Unexpected token '<'" errors**
- Frontend receiving HTML instead of JSON
- Usually means API route not found or server not running
- For local dev: Ensure `npm run dev:all` is running (not just `npm run dev`)
- For production: Verify Function is deployed at correct path
