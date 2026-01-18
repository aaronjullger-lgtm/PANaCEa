# PANaCEa Master Documentation

**Last Updated**: January 6, 2026  
**Current Version**: 1.1.0  
**Status**: Production (with Monitoring)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Development Guide](#development-guide)
5. [Database & Content](#database--content)
6. [API Reference](#api-reference)
7. [Deployment](#deployment)
8. [Testing & Quality](#testing--quality)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview

PANaCEa is an AI-powered medical education platform for PA (Physician Assistant) students preparing for PANCE/PANRE exams. It combines adaptive learning (FSRS v5 spaced repetition), gamification, and AI-generated clinical scenarios.

### Key Features

- 🧠 **AI-Generated Questions**: Clinical scenarios powered by Google Gemini API
- 📊 **Adaptive Learning**: FSRS v5 spaced repetition with user-specific tuning
- 🎮 **Multiple Drill Modes**: Photo Drill, Rapid Recall, DDx Compare, Patient Encounters
- 📈 **Analytics Dashboard**: Track performance across all 14 PANCE systems
- 🏥 **1,180+ Medical Conditions**: Comprehensive database-driven content
- 📱 **PWA Support**: Study offline with progressive web app capabilities
- 🎯 **Polypharmacy Mode**: Interactive medication deprescribing scenarios

### Tech Stack

```
Frontend:   React 19, TypeScript, Vite, TailwindCSS, Framer Motion
Backend:    Cloudflare Functions (serverless), Express.js (optional)
Database:   PostgreSQL (Supabase) + Prisma ORM + Prisma Accelerate
AI:         Google Gemini API (2.5 Flash/Pro)
Auth:       Clerk (with webhook sync to Prisma)
Monitoring: Sentry (error tracking, session replay, performance)
Deployment: Cloudflare Pages + Functions
```

---

## Quick Start

### Prerequisites

- Node.js v18+
- PostgreSQL database (Supabase recommended)
- Clerk account
- Google Gemini API key

### Installation

```bash
# Clone repository
git clone https://github.com/aaronjullger-lgtm/PANaCEa.git
cd StudyPANaCEa

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials:
# - VITE_CLERK_PUBLISHABLE_KEY (frontend)
# - CLERK_SECRET_KEY (backend)
# - CLERK_WEBHOOK_SECRET
# - GEMINI_API_KEY
# - DATABASE_URL

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate:dev

# Sync registries to database
npm run sync:all

# Start development server
npm run dev:all  # Frontend (3000) + Backend (3001)
# OR
npm run dev     # Frontend only (uses deployed Cloudflare Functions)
```

### Verify Setup

```bash
# Build to check for errors
npm run build

# Run health check
npm run health-check

# Test API health endpoint (after deploy)
curl https://your-domain.com/api/health?ping=true
```

---

## Architecture

### Cloudflare Functions (Primary)

PANaCEa runs on **Cloudflare Pages with Functions** - a serverless-first approach:

```
/functions/
  ├── api/
  │   ├── _shared/
  │   │   ├── auth.ts           # Authentication helper
  │   │   ├── prisma-edge.ts    # Prisma Edge client
  │   │   └── validation.ts     # Input validation
  │   ├── webhooks/
  │   │   └── clerk.ts          # Clerk user lifecycle webhook
  │   ├── questions.ts          # Fetch questions endpoint
  │   ├── drills/
  │   │   ├── polypharmacy-drill.ts
  │   │   ├── media.ts
  │   │   └── ...
  │   └── ...
  └── geminiProxy.ts            # Gemini API proxy
```

**Key Patterns:**

- Request handler: `onRequestPost(context: PagesContext)` or `onRequestGet`
- Environment: Access via `context.env` (e.g., `env.DATABASE_URL`)
- Prisma: Use `createEdgePrismaClient(env.DATABASE_URL)`
- Auth: `authenticateRequest(context.request, env)`

### Database-First Architecture

**ALL content comes from PostgreSQL** - no static JSON in production:

```
User Action → Service Call → Cloudflare Function →
Prisma Query → PostgreSQL → Response → Component State
```

**Key Tables:**

- `Condition` - Registry of 1,180 medical conditions
- `MedicalContent` - Full content (JSONB fields)
- `User` - Synced from Clerk via webhook
- `PerformanceRecord` - Question attempts
- `SRSItem` - Spaced repetition scheduling
- `Drug` - Medication database
- `UserAchievement` - Gamification

### Project Structure

```
StudyPANaCEa/
├── components/          # React UI components
│   ├── analytics/       # IntelligenceHub, performance tracking
│   ├── drill/           # Drill mode components
│   ├── modes/           # Training modes
│   └── admin/           # Admin/CMS components
├── functions/           # Cloudflare Functions (API routes)
├── services/            # Frontend business logic
├── lib/
│   ├── services/        # Backend services (CMS, SRS, autoAuthor)
│   └── middleware/      # Express middleware (legacy)
├── hooks/               # React hooks
├── contexts/            # React contexts
├── scripts/             # Database & content management
│   ├── content-doctor.ts      # AI content generation
│   ├── syncAllRegistries.ts   # Sync to database
│   └── db/                    # Database maintenance
├── prisma/              # Database schema & migrations
├── public/              # Static assets & _headers (CSP)
├── types/               # TypeScript definitions
└── App.tsx              # Main router
```

### PANCE System Codes

14 organ systems for filtering/analytics:

```
CV     - Cardiovascular
PULM   - Pulmonary
GI     - Gastrointestinal
NEURO  - Neurology
MSK    - Musculoskeletal
DERM   - Dermatology
HEME   - Hematology/Oncology
ENDO   - Endocrinology
HEENT  - Eyes, Ears, Nose, Throat
RENAL  - Renal/Nephrology
REPRO  - Reproductive/OB/GYN
PSYCH  - Psychiatry/Behavioral
ID     - Infectious Disease
GU     - Genitourinary
```

---

## Development Guide

### Running Locally

**Option 1: Frontend + Express Backend**

```bash
npm run dev:all
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

**Option 2: Frontend Only (uses deployed Cloudflare Functions)**

```bash
npm run dev
# Frontend: http://localhost:3000
```

### Key Development Commands

```bash
# Database
npm run db:generate          # Generate Prisma client
npm run db:migrate:dev       # Create & apply migration
npm run db:studio            # Open Prisma Studio GUI
npm run sync:all             # Sync registries to database

# Content Generation
npm run content-doctor:phase1    # Gap analysis (find missing conditions)
npm run content-doctor:phase2    # Generate content for new conditions
npm run generate:lab             # Generate lab content
npm run generate:clinical        # Generate clinical content

# Build & Deploy
npm run build                # Production build
npm run preview              # Preview production build

# Quality
npm test                     # Run Vitest tests
npm run health-check         # Validate database content
```

### Authentication Flow

1. **User Sign-In**: Clerk handles authentication
2. **Webhook Sync**: Clerk sends `user.created/updated/deleted` to `/api/webhooks/clerk`
3. **Database Sync**: Webhook creates/updates User in Prisma
4. **API Auth**: Endpoints use `authenticateRequest()` to verify Clerk session
5. **RBAC**: User roles from Prisma (USER, VIEWER, EDITOR, APPROVER, ADMIN, SUPERADMIN)

### State Management

- **Performance data**: localStorage (`panceai_performance_v2`, `panceai_missed_v2`)
- **SRS scheduling**: FSRS v5 algorithm (`lib/fsrs.ts`) + UserSRSConfig (Prisma)
- **User profile**: Clerk (auth) + Prisma User (metadata)
- **Session settings**: SessionSettings type (focus, difficulty, filters)

### Design System

**Colors:**

- Text: `slate-900` (primary), `slate-500` (secondary), `slate-400` (muted)
- Accents: `blue-600`, `blue-500`, `blue-300`
- Backgrounds: `white`, `slate-50` (cards), `slate-100` (subtle)
- Borders: `slate-200`, `slate-100`

**Typography:**

- Font: Inter/sans-serif
- Weights: `font-medium` (labels), `font-bold` (headings)

**Components:**

- Rounded: `rounded-xl` corners
- Padding: `p-4`, `p-6` (generous spacing)
- Hover: `hover:translate-x-1`, `hover:border-blue-300`, `hover:shadow-sm`
- Icons: Lucide React (`w-4 h-4` small, `w-5 h-5` medium)
- Animations: Framer Motion (`easeOut`, 0.2-0.3s duration)

---

## Database & Content

### Content Generation Pipeline

**Phase 1: Gap Analysis**

```bash
npm run content-doctor:phase1
```

Uses Gemini to identify missing high-yield PANCE conditions by comparing database against NCCPA blueprint.

**Phase 2: Content Generation**

```bash
npm run content-doctor:phase2
```

Generates full medical content (33 fields) for conditions missing content:

- Overview, etiology, epidemiology, pathophysiology
- Risk factors, symptoms, physical exam, diagnostics
- Treatment, complications, prognosis
- Buzzwords, clinical pearls, mnemonics, triads
- Guidelines, PANCE yield, related systems

**Content Doctor Features:**

- Concurrent batch processing (10 conditions at once)
- Partial updates (regenerate only missing fields)
- Retry logic with exponential backoff
- String-to-integer parsing for PANCE yield
- Multi-system condition support

### Database Maintenance Scripts

```bash
# Database Scripts (scripts/db/)
npm run db:fix-optional-nulls    # Normalize NULL → "NONE" sentinel
npm run db:revert-none-to-null   # Unlock fields for regeneration
npm run db:normalize-formatting  # Fix CSV import issues
npm run db:verify-formatting     # Validate JSON.parse() compatibility
npm run db:sample-ai-content     # Quality review sample
```

### Registry Sync

```bash
npm run sync:all
```

Syncs all registries to database:

- Conditions (1,180 entries)
- Drugs (medication database)
- Anatomy structures
- Lab tests
- Imaging modalities
- Special tests
- Treatments

### Content Statistics

| Metric                | Count | Percentage |
| --------------------- | ----- | ---------- |
| **Total Conditions**  | 1,180 | -          |
| **With Full Content** | 1,119 | 95%        |
| **Mnemonics**         | 573   | 51%        |
| **Guidelines**        | 744   | 66%        |
| **Classic Triads**    | 1,119 | 100%       |
| **Multi-System**      | ~150  | 13%        |

---

## API Reference

### Authentication

All API endpoints require Clerk authentication:

```typescript
const authResult = await authenticateRequest(context.request, env);
if (!authResult) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
  });
}
```

### Key Endpoints

**Questions**

- `GET /api/questions?system=CV&count=10&difficulty=2`
- `GET /api/questions/polypharmacy-drill?count=1&difficulty=medium`

**Content**

- `GET /api/content/condition/:id`
- `GET /api/content/conditions?system=CV`

**SRS**

- `POST /api/srs/review` - Submit review outcome
- `GET /api/srs/due` - Get due cards
- `POST /api/srs/reset` - Reset user SRS data

**Performance**

- `POST /api/performance/record` - Log attempt
- `GET /api/performance/stats` - Get user statistics

**Achievements**

- `GET /api/achievements` - List user achievements
- `POST /api/achievements/:id/claim` - Claim achievement

**Admin/CMS**

- `GET /api/admin/content` - List content (RBAC required)
- `POST /api/admin/content` - Create content (APPROVER+)
- `PATCH /api/admin/content/:id` - Update content (EDITOR+)
- `POST /api/admin/content/:id/approve` - Approve content (APPROVER+)

### Webhooks

**Clerk User Lifecycle**

- `POST /api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`
- Verification: Svix signature
- Protected: Cloudflare Turnstile

---

## Deployment

### Cloudflare Pages

**Automatic Deployment:**

1. Push to `main` branch
2. Cloudflare Pages builds frontend
3. Functions deployed automatically

**Environment Variables (Cloudflare Dashboard):**

```
CLERK_WEBHOOK_SECRET
GEMINI_API_KEY
DATABASE_URL
CLERK_SECRET_KEY
VITE_CLERK_PUBLISHABLE_KEY (in wrangler.toml)

# Monitoring (Sprint 5)
VITE_SENTRY_DSN
SENTRY_DSN (for Functions)
SENTRY_ORG (optional, for source maps)
SENTRY_PROJECT (optional)
SENTRY_AUTH_TOKEN (optional)
```

**Build Settings:**

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18

### Database Migrations

**Development:**

```bash
npm run db:migrate:dev
```

**Production:**

```bash
npm run db:migrate:deploy
# OR
npm run migrate:production  # Interactive
```

### Content Security Policy

Configured in `public/_headers`:

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com;
  connect-src 'self' https://*.clerk.com https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com;
  frame-src https://*.clerk.accounts.dev https://challenges.cloudflare.com;
  img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
```

---

## Testing & Quality

### Test Suites

```bash
npm test                    # Run all tests (Vitest)
npm run health-check        # Content validation
npm run db:verify-formatting # Database integrity
```

### Code Quality

**TypeScript:**

- Strict mode enabled
- No implicit any
- Path aliases: `@/` for `src/`

**Linting:**

- ESLint configured
- IDE integration recommended

**Build Verification:**

```bash
npm run build
# ✓ built in ~5-6s
# Check for warnings
```

### Performance Monitoring

**Error Tracking (Sentry):**

- Client-side errors: React error boundaries + Sentry SDK
- Server-side errors: CloudFlare Functions error handler
- Session replay: 10% of sessions, 100% on errors
- Performance tracing: 10% sample rate in production

**Health Check Endpoint:**

```bash
# Quick ping (uptime monitors)
curl https://your-domain.com/api/health?ping=true

# Full health check (database, cache, environment)
curl https://your-domain.com/api/health
```

**Response Format:**

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-01-06T12:00:00Z",
  "checks": {
    "database": { "status": "pass", "latency": 45 },
    "cache": { "status": "pass", "latency": 12 },
    "environment": { "status": "pass" }
  }
}
```

**Bundle Size:**

- Current: vendor-common ~608KB (optimized with chunking)
- Target: <500KB per chunk (achieved for most chunks)

**Manual Chunks (vite.config.ts):**

- `vendor-clerk` - Clerk auth library
- `vendor-animation` - Framer Motion
- `data-drugs`, `data-conditions`, `data-labs`
- `drill-[name]` - Individual drill modes
- `admin` - Admin/CMS components

---

## Troubleshooting

### Common Issues

**Gemini API Errors**

- Check `GEMINI_API_KEY` in environment (NOT `VITE_` prefixed)
- Verify key not expired (renew at Google AI Studio)
- Check rate limits (429 errors trigger exponential backoff)

**Database Connection**

- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Supabase: Use "Transaction" connection pooling mode
- Test: `npm run db:studio`

**Build Errors**

- Clear cache: `rm -rf dist node_modules/.vite`
- Regenerate Prisma: `npm run db:generate`
- Check for missing dependencies: `npm install`

**Clerk Authentication**

- Verify `VITE_CLERK_PUBLISHABLE_KEY` in frontend
- Check `CLERK_SECRET_KEY` in backend
- Test webhook: Clerk dashboard → "Testing" tab
- CSP: Ensure `https://*.clerk.com` allowed

**Content Not Loading**

- Run `npm run sync:all` to sync registries
- Check database: `npm run db:studio`
- Verify Prisma client: `npm run db:generate`

**JSON Parsing Errors (Content Doctor)**

- Enhanced parser handles malformed JSON from Gemini
- Check response in logs (first 500 chars shown)
- Retry with exponential backoff (max 3 attempts)

**Cloudflare Functions 405 Errors**

- Ensure using `/functions/` directory (NOT `/app/api/`)
- Use `onRequestPost` export (NOT Next.js App Router pattern)
- Verify `wrangler.toml` configuration

---

## Additional Resources

### Key Configuration Files

- `.env` - Environment variables (local)
- `wrangler.toml` - Cloudflare Pages config
- `vite.config.ts` - Build configuration
- `prisma/schema.prisma` - Database schema
- `public/_headers` - CSP and security headers
- `package.json` - Dependencies and scripts

### Important Scripts

**Content:**

- `scripts/content-doctor.ts` - AI content generation (Phase 1 & 2)
- `scripts/syncAllRegistries.ts` - Sync registries to database
- `scripts/orchestrate-content-generation.ts` - Automated pipeline

**Database:**

- `scripts/db/fix-optional-nulls.ts` - NULL normalization
- `scripts/db/normalize-formatting.ts` - Fix CSV imports
- `scripts/db/sample-ai-content.ts` - Quality review

**Development:**

- `server.ts` - Express backend (legacy)
- `App.tsx` - React router
- `main.tsx` - React entry point

### External Documentation

- [Clerk Docs](https://clerk.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Google Gemini API](https://ai.google.dev/docs)
- [FSRS Algorithm](https://github.com/open-spaced-repetition/fsrs.js)

---

## Version History

### v1.1.0 (January 2026) - Performance & Monitoring

- ✅ **Sprint 1**: TypeScript error fixes (10/11 resolved)
- ✅ **Sprint 2**: 27 database indexes for query optimization
- ✅ **Sprint 3**: CloudFlare KV cache integration (60-80% hit rate)
- ✅ **Sprint 4**: Query optimization, N+1 query fixes (5-10x fewer queries)
- ✅ **Sprint 5**: Sentry error tracking & monitoring
  - Sentry SDK with session replay
  - 3 error boundaries with Sentry capture
  - Health check endpoint (`/api/health`)
  - CloudFlare Functions error handler
  - User context sync with Clerk
- ✅ Bundle size optimization (code splitting complete)
- ✅ Prisma Accelerate for edge-compatible database access

### v1.0.0 (December 2025)

- ✅ Database-first architecture migration complete
- ✅ 1,180 medical conditions (up from 1,119)
- ✅ Polypharmacy drill mode implemented
- ✅ Content Doctor Phase 1 & 2 operational
- ✅ Enhanced JSON parsing with error recovery
- ✅ 61 high-yield PANCE conditions added
- ✅ Multi-system condition support
- ✅ Cloudflare Functions production deployment
- ✅ PWA support with offline capabilities

### Upcoming Features

- 📋 Content quality peer review workflow
- 📋 Advanced analytics dashboard
- 📋 Social learning (study groups)
- 📋 Medical image integration

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues or questions:

- GitHub Issues: [PANaCEa Issues](https://github.com/aaronjullger-lgtm/PANaCEa/issues)
- Developer: Aaron Ullger

---

**Last Review Date**: January 6, 2026  
**Documentation Version**: 1.1  
**Code Version**: 1.1.0
