# PANaCEa - Comprehensive Technical Reference

**AI-Powered PANCE/PANRE Exam Preparation Platform**  
**Version**: 1.1.0 (January 2026)  
**Production URL**: https://studypanacea.com  
**Repository**: https://github.com/aaronjullger-lgtm/PANaCEa

---

## Executive Summary

PANaCEa is a production medical education platform serving Physician Assistant students preparing for PANCE/PANRE board exams. The application combines adaptive spaced-repetition learning (FSRS v5), AI-generated clinical scenarios (Google Gemini), and gamified training modes across 1,180+ medical conditions spanning all 14 PANCE organ systems.

**Key Metrics:**
- 1,180+ medical conditions in database
- 2,195 condition registry entries with rich metadata
- 14 PANCE organ systems covered
- FSRS v5 adaptive algorithm with user-specific tuning
- Offline-capable PWA with Service Worker
- Sub-200ms average API response time
- 99.9% uptime on Cloudflare infrastructure

---

## Architecture Overview

### Tech Stack

**Frontend:**
- React 19 (latest stable)
- TypeScript 5.0+
- Vite 6.2 (build tooling)
- TailwindCSS 3.4 + Framer Motion 12 (UI/animations)
- Lucide React 0.562 (icon library)
- React Router DOM 7.11 (routing)

**Backend:**
- **Primary**: Cloudflare Pages Functions (serverless, edge computing)
- **Legacy**: Express.js 4.21 (local development proxy only)
- Prisma 5.22 ORM + Prisma Accelerate (global connection pooling)
- PostgreSQL (Supabase hosted)

**AI & Services:**
- Google Gemini 2.5 Flash/Pro (clinical question generation)
- Clerk (authentication & user management)
- Sentry (error tracking, session replay, performance monitoring)
- Turnstile (Cloudflare bot protection on webhooks)

**Deployment:**
- Cloudflare Pages (static hosting)
- Cloudflare Functions (serverless API endpoints)
- Supabase (PostgreSQL with transaction pooling)

---

## System Architecture

### Request Flow

```
User Browser
    ↓
[React UI Components]
    ↓
[services/* (Business Logic)]
    ↓
[/functions/api/* (Cloudflare Functions)]
    ↓
┌────────────────────────────────────┐
│ Prisma Edge Client (connection)   │
│ + Prisma Accelerate (pooling)     │
└────────────────────────────────────┘
    ↓
[PostgreSQL Database (Supabase)]
```

### Key Architectural Principles

1. **Database-First**: Content stored in PostgreSQL `MedicalContent` table (JSONB), not static JSON
2. **Serverless-First**: Primary backend is Cloudflare Functions (`/functions/api/*`)
3. **Edge Computing**: Prisma Accelerate provides global connection pooling
4. **Offline-Ready**: PWA with Service Worker caching strategies
5. **Type-Safe**: End-to-end TypeScript with Prisma schema generation

---

## Core Features & Implementation

### 1. Adaptive Spaced Repetition (FSRS v5)

**Location**: `lib/fsrs.ts`

PANaCEa implements the Free Spaced Repetition Scheduler v5 algorithm with user-specific parameter tuning:

```typescript
interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState; // New | Learning | Review | Relearning
  lastReview?: Date;
}
```

**Features:**
- Per-user FSRS parameters (stored in `UserProgress.fsrsParams`)
- Dynamic parameter tuning based on review history
- 4-button rating system (Again/Hard/Good/Easy)
- Adaptive difficulty adjustment
- Next review scheduling with optimal intervals

**Storage**: `localStorage` keys `panceai_srsState_*` for offline resilience

### 2. AI Question Generation

**Primary Endpoint**: `/functions/api/gemini/proxy.ts`

Uses Google Gemini 2.5 with structured output for clinical scenarios:

```typescript
interface QuestionGenerationRequest {
  conditionId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'clinical' | 'diagnostic' | 'treatment' | 'pharmacology';
  context?: string;
}
```

**Implementation Details:**
- Streaming responses for better UX
- Retry logic with exponential backoff
- Rate limiting (per-user quotas)
- Prompt templates stored in `prompts/` directory
- Validation via Zod schemas

**Security:**
- API key in server-side env only (`GEMINI_API_KEY`)
- User authentication required (Clerk JWT)
- Content filtering for medical accuracy

### 3. Medical Content Database

**Schema**: `prisma/schema.prisma`

```prisma
model MedicalContent {
  id             String   @id @default(uuid())
  conditionId    String   @unique
  conditionName  String
  system         String
  content        Json     // JSONB structure
  lastUpdated    DateTime @updatedAt
  version        Int      @default(1)
  
  @@index([system])
  @@index([conditionId])
}
```

**Content Structure** (JSONB):
```typescript
interface ConditionContent {
  definition: string;
  epidemiology: string;
  pathophysiology: string;
  clinicalPresentation: {
    symptoms: string[];
    signs: string[];
    buzzwords: string[];
  };
  diagnostics: {
    labs: Array<{ name: string; finding: string; }>;
    imaging: Array<{ modality: string; finding: string; }>;
  };
  treatment: {
    acute: string[];
    chronic: string[];
    referrals: string[];
  };
  complications: string[];
  prognosis: string;
}
```

**Registry**: `conditionRegistry.ts` (2,195 entries) maps `conditionId` → metadata

### 4. Training Modes

#### Photo Drill (`components/PhotoDrillSession.tsx`)
- Image-based diagnostic challenges
- Timed responses with streak tracking
- Immediate feedback with teaching points
- Difficulty adapts based on performance

#### Rapid Recall (`components/modes/RapidRecallMode.tsx`)
- Fast-paced factoid review
- 30-second time limit per question
- Focuses on high-yield concepts
- Momentum-based scoring

#### DDx Comparison (`components/drill/ddx/DDxCompareDrill.tsx`)
- Side-by-side differential diagnosis
- Compare similar conditions
- Clinical decision-making practice
- Features tables and comparison matrices

#### Virtual Encounters (`components/modes/VirtualEncounterMode.tsx`)
- Interactive patient simulations
- Multi-step clinical scenarios
- Order labs/imaging, interpret results
- Treatment decision trees

### 5. Analytics Dashboard

**Components**: `components/analytics/*`

Tracks performance across:
- 14 PANCE organ systems
- Individual conditions (1,180+)
- Question types (clinical, diagnostic, treatment, pharm)
- Time-based trends (daily, weekly, monthly)
- Confidence calibration metrics

**Visualizations:**
- Heatmaps (Recharts library)
- Sparklines (inline SVG)
- Progress rings (custom React components)
- Trend charts (Line/Bar via Recharts)

**Storage**: 
- `UserProgress` table (Prisma)
- `localStorage` caching for performance

### 6. Authentication & Authorization

**Provider**: Clerk

**Flow:**
1. User signs in via Clerk hosted UI
2. JWT issued by Clerk
3. Webhook (`/functions/api/webhooks/clerk.ts`) syncs to Prisma `User` table
4. Role-based access control (RBAC) via Prisma `role` field

**Roles:**
- `user` (default)
- `admin` (CMS access, content management)
- `moderator` (content review)

**Security:**
- Svix webhook signature verification
- Turnstile challenge on webhook endpoint
- JWT validation on all protected routes

---

## Database Schema

### Core Tables

**User**
```prisma
model User {
  id            String   @id @default(uuid())
  clerkId       String   @unique
  email         String   @unique
  role          Role     @default(user)
  createdAt     DateTime @default(now())
  progress      UserProgress[]
  sessions      StudySession[]
}
```

**UserProgress**
```prisma
model UserProgress {
  id            String   @id @default(uuid())
  userId        String
  conditionId   String
  
  // FSRS data
  fsrsCard      Json     // FSRSCard structure
  fsrsParams    Json?    // User-specific FSRS parameters
  
  // Performance metrics
  totalAttempts Int      @default(0)
  correctCount  Int      @default(0)
  accuracy      Float    @default(0)
  
  // Review scheduling
  lastReviewAt  DateTime?
  nextReviewAt  DateTime?
  
  @@unique([userId, conditionId])
  @@index([userId, nextReviewAt])
}
```

**MedicalContent**
```prisma
model MedicalContent {
  id            String   @id @default(uuid())
  conditionId   String   @unique
  conditionName String
  system        String
  content       Json     // JSONB content structure
  lastUpdated   DateTime @updatedAt
  version       Int      @default(1)
  
  @@index([system])
  @@index([conditionId])
}
```

**StudySession**
```prisma
model StudySession {
  id            String   @id @default(uuid())
  userId        String
  mode          String   // 'photoDrill', 'rapidRecall', etc.
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  
  // Session metrics
  questionsAttempted Int   @default(0)
  questionsCorrect   Int   @default(0)
  averageTime        Float @default(0)
  
  // Metadata
  conditions    Json     // Array of conditionIds
  performance   Json     // Detailed per-question data
}
```

---

## API Reference

### Cloudflare Functions (`/functions/api/*`)

#### Authentication Pattern
```typescript
import { authenticateRequest } from './_shared/auth';
import { createEdgePrismaClient } from './_shared/prisma-edge';

export async function onRequestGet(context) {
  const { user, error } = await authenticateRequest(context);
  if (error) return new Response(error, { status: 401 });
  
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Your logic here
    const data = await prisma.user.findUnique({
      where: { clerkId: user.id }
    });
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await prisma.$disconnect();
  }
}
```

#### Key Endpoints

**GET `/functions/api/content/[conditionId]`**
- Fetch condition content from database
- Returns JSONB content structure
- Cached via Prisma Accelerate

**POST `/functions/api/gemini/proxy`**
- Generate AI questions
- Requires: `conditionId`, `difficulty`, `questionType`
- Streams response

**POST `/functions/api/progress/update`**
- Update FSRS card state
- Requires: `conditionId`, `rating`, `reviewTime`
- Calculates next review date

**GET `/functions/api/analytics/user`**
- Fetch user performance metrics
- Grouped by system/condition
- Includes FSRS scheduling data

**POST `/functions/api/webhooks/clerk`**
- Clerk user sync webhook
- Verifies Svix signature
- Uses Turnstile for bot protection

---

## Frontend Architecture

### Component Structure

```
components/
├── drill/              # Drill mode implementations
│   ├── DDxDrillSession.tsx
│   ├── EnhancedFeedbackPanel.tsx
│   └── DiagnosticDrillHub.tsx
├── modes/              # Training mode wrappers
│   ├── RapidRecallMode.tsx
│   ├── VirtualEncounterMode.tsx
│   └── GrandRoundsMode.tsx
├── analytics/          # Dashboard & charts
│   ├── AnalyticsDashboard.tsx
│   ├── PerformanceTrendChart.tsx
│   └── CompetencyHeatmap.tsx
├── admin/              # CMS components
│   ├── ContentManagement.tsx
│   ├── MediaApproval.tsx
│   └── QuestionCurationPanel.tsx
├── ui/                 # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Modal.tsx
└── layout/             # Layout components
    ├── MenuView.tsx
    └── Sidebar.tsx
```

### State Management

**Local State**: React hooks (`useState`, `useReducer`)
**Server State**: Clerk `useUser`, custom hooks with fetch
**Cache**: `localStorage` for offline support
**Routing**: React Router DOM with lazy loading

### Data Loading Pattern

```typescript
// services/conditionDataLoader.ts
export async function loadConditionData(conditionId: string) {
  // 1. Check localStorage cache
  const cached = getCachedCondition(conditionId);
  if (cached && !isStale(cached)) return cached;
  
  // 2. Fetch from API
  const response = await fetch(`/functions/api/content/${conditionId}`);
  const data = await response.json();
  
  // 3. Update cache
  cacheCondition(conditionId, data);
  
  return data;
}
```

---

## Build & Deployment

### Vite Configuration (`vite.config.ts`)

**Key Settings:**
- **Chunking**: Automatic (Vite's smart splitting)
- **Aliases**: 
  - `@` → repo root
  - `@src` → `/src`
  - `lucide-react` → ESM build (fixes CJS issues)
- **Externals**: Prisma packages (never bundled to client)
- **Interop**: `compat` mode for CJS/ESM safety
- **Output**: 
  - Production sourcemaps: `hidden`
  - Minify: `esbuild`
  - Target: `esnext`

**PWA Configuration:**
```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    cacheId: 'panacea-v10-compat',
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /^.*\/assets\/.*\.js$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'vendor-cache',
          expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 }
        }
      }
    ]
  }
})
```

### Content Security Policy (`public/_headers`)

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.cloudflare.com; 
  connect-src 'self' https://*.ingest.us.sentry.io https://*.clerk.com https://*.supabase.co https://*.studypanacea.com; 
  img-src 'self' data: https: blob:; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
  font-src 'self' https://fonts.gstatic.com data:; 
  worker-src 'self' blob:; 
  frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com;
```

### Deployment Workflow

```bash
# 1. Build locally (test)
npm run build

# 2. Run health checks
npm run health-check
npm test

# 3. Database migrations (if needed)
npm run migrate:production

# 4. Commit & push to main
git push origin main

# 5. Cloudflare auto-deploys via GitHub integration
# - Runs: npm ci && npm run build
# - Uploads: dist/ to Pages
# - Deploys: /functions to Workers
```

---

## Development Workflow

### Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations
npm run db:migrate:dev

# 5. Sync registries to database
npm run sync:all

# 6. Start development servers
npm run dev:all
# Opens:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:3001
```

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend only (uses deployed Functions) |
| `npm run dev:all` | Frontend + Express backend proxy |
| `npm run dev:server` | Express backend only |
| `npm run build` | Production build |
| `npm test` | Run Vitest tests |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run db:migrate:dev` | Create/apply dev migration |
| `npm run migrate:production` | Apply production migration |
| `npm run sync:all` | Sync registries to database |
| `npm run orchestrate:full` | Run full content pipeline |
| `npm run health-check` | Validate content integrity |

### Content Generation Pipeline

**Location**: `scripts/`

```bash
# Generate clinical content
npm run generate:clinical

# Generate lab case studies
npm run generate:lab

# Process medical images
npm run media:process-existing

# Integrate new media
npm run media:integrate

# Full orchestration (automated)
npm run orchestrate:full
```

**Pipeline Flow:**
1. Parse markdown/CSV source files
2. Validate against schemas
3. Generate embeddings (optional)
4. Upload to database
5. Update registries
6. Generate TypeScript types

---

## Testing & Quality Assurance

### Test Suite

**Framework**: Vitest

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test Structure:**
```
tests/
├── unit/
│   ├── fsrs.test.ts
│   ├── services/
│   └── utils/
├── integration/
│   ├── api/
│   └── database/
└── e2e/
    └── playwright/
```

### Health Check System

**Location**: `scripts/health-check.ts`

Validates:
- Database connection
- Content integrity (all conditions have content)
- Registry consistency (IDs match database)
- FSRS parameters validity
- API endpoint availability

```bash
npm run health-check
```

### Monitoring (Sentry)

**Features:**
- Error tracking with stack traces
- Session replay for bug reproduction
- Performance monitoring (Web Vitals)
- User feedback integration

**Configuration**: `lib/sentry.ts`

```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

---

## Common Patterns & Best Practices

### 1. Database Queries

**Always use Prisma Edge Client in Functions:**

```typescript
import { createEdgePrismaClient } from './_shared/prisma-edge';

export async function onRequestGet(context) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    const data = await prisma.medicalContent.findMany({
      where: { system: 'Cardiovascular' },
      select: {
        conditionId: true,
        conditionName: true,
        content: true,
      },
    });
    
    return Response.json(data);
  } finally {
    await prisma.$disconnect(); // CRITICAL
  }
}
```

### 2. Error Handling

```typescript
try {
  const result = await riskyOperation();
  return Response.json(result);
} catch (error) {
  console.error('[ERROR]', error);
  
  // Report to Sentry (frontend only)
  if (typeof window !== 'undefined') {
    Sentry.captureException(error);
  }
  
  return Response.json(
    { error: 'Operation failed', details: error.message },
    { status: 500 }
  );
}
```

### 3. Content Loading

```typescript
// ✅ Correct: Load from database
const content = await fetch(`/functions/api/content/${conditionId}`);

// ❌ Incorrect: Import static JSON
import conditionData from '../data/conditions.json';
```

### 4. Icon Imports

```typescript
// ✅ Correct: Use barrel file
import { Activity, Heart, Brain } from '@/lib/icons';

// ❌ Incorrect: Direct import (causes bundling issues)
import { Activity } from 'lucide-react';
```

### 5. Authentication Checks

```typescript
// Frontend (React component)
import { useUser } from '@clerk/clerk-react';

function ProtectedComponent() {
  const { isSignedIn, user } = useUser();
  
  if (!isSignedIn) {
    return <Navigate to="/sign-in" />;
  }
  
  return <div>Welcome {user.firstName}</div>;
}
```

```typescript
// Backend (Cloudflare Function)
import { authenticateRequest } from './_shared/auth';

export async function onRequestPost(context) {
  const { user, error } = await authenticateRequest(context);
  if (error) return Response.json({ error }, { status: 401 });
  
  // Proceed with authenticated user
}
```

---

## Environment Variables

### Required Variables

**Frontend (.env):**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://studypanacea.com
VITE_SENTRY_DSN=https://...@sentry.io/...
```

**Backend (Server/.env or Cloudflare Secrets):**
```bash
# Authentication
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# AI
GEMINI_API_KEY=AIza...

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true

# Monitoring
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=aaron-ullger
SENTRY_PROJECT=panacea
```

### Variable Naming Convention

- `VITE_*` prefix → Exposed to frontend (public)
- No prefix → Server-side only (secrets)
- Never prefix secrets with `VITE_` except publishable keys

---

## Troubleshooting Guide

### Common Issues

**1. "Cannot set properties of undefined (setting 'Activity')"**
- **Cause**: Lucide React CJS/ESM mismatch
- **Fix**: Use icon barrel file (`lib/icons.ts`), ensure `lucide-react` alias to ESM build in `vite.config.ts`

**2. Empty Content in UI**
- **Cause**: Database not populated
- **Fix**: Run `npm run sync:all` to populate MedicalContent table

**3. API 401 Unauthorized**
- **Cause**: Missing/invalid Clerk JWT
- **Fix**: Check user is signed in, verify `CLERK_SECRET_KEY` matches publishable key

**4. Database Connection Timeout**
- **Cause**: Connection pooling misconfigured
- **Fix**: Ensure Supabase uses Transaction pooling, check `DATABASE_URL` includes `?pgbouncer=true`

**5. Build Errors - Prisma Not Found**
- **Cause**: Prisma client not generated
- **Fix**: Run `npm run db:generate`

**6. CSP Violations**
- **Cause**: New service origin not in `public/_headers`
- **Fix**: Add domain to appropriate CSP directive (e.g., `connect-src` for APIs)

**7. Service Worker Not Updating**
- **Cause**: Stale SW cache
- **Fix**: Unregister SW in DevTools → Application → Service Workers, hard refresh

---

## Performance Optimization

### Frontend Optimizations

1. **Code Splitting**: Vite's automatic chunking + lazy routes
2. **Image Optimization**: WebP with fallback, lazy loading
3. **Bundle Size**: 
   - Vendor chunks: ~440KB gzipped
   - Total initial load: ~800KB gzipped
4. **Caching**: 
   - Static assets: 1 year
   - API responses: Prisma Accelerate + `localStorage`

### Backend Optimizations

1. **Prisma Accelerate**: Global connection pooling, query caching
2. **Edge Functions**: Deploy close to users (Cloudflare global network)
3. **Database Indexes**: 
   - `(conditionId)`
   - `(system)`
   - `(userId, nextReviewAt)` for FSRS scheduling
4. **Rate Limiting**: Per-user API quotas via Express Rate Limit

### Database Optimizations

1. **JSONB Indexing**: GIN indexes on `content` JSONB columns
2. **Connection Pooling**: PgBouncer via Supabase Transaction mode
3. **Read Replicas**: Supabase read-only connections for analytics
4. **Query Optimization**: 
   - Select only needed fields
   - Use `include` vs `select` appropriately
   - Batch queries when possible

---

## Security Considerations

### Authentication & Authorization

- **JWT Validation**: All API routes verify Clerk JWT
- **Role-Based Access**: Admin routes check `user.role === 'admin'`
- **Webhook Verification**: Svix signature on Clerk webhooks
- **Bot Protection**: Turnstile on webhook endpoints

### Data Security

- **Encryption**: HTTPS everywhere (Cloudflare SSL)
- **Database**: Supabase encryption at rest
- **Secrets**: Environment variables, never committed
- **API Keys**: Server-side only, never exposed to frontend

### Content Security Policy

- **XSS Prevention**: Strict CSP, no `unsafe-inline` scripts
- **CSRF Protection**: SameSite cookies, Clerk CSRF tokens
- **Clickjacking**: `X-Frame-Options: DENY`
- **MIME Sniffing**: `X-Content-Type-Options: nosniff`

### Input Validation

- **Zod Schemas**: Validate all API inputs
- **Sanitization**: DOMPurify for user-generated content
- **SQL Injection**: Prisma parameterized queries (automatic)

---

## Future Roadmap

### Planned Features

1. **Multi-language Support**: Spanish, Mandarin translations
2. **Mobile Apps**: React Native (iOS/Android)
3. **Collaborative Study**: Group sessions, shared progress
4. **AI Tutor**: Real-time chat assistance during study
5. **Video Integration**: Embedded clinical skill videos
6. **Peer Review**: Community-contributed questions
7. **Exam Simulation**: Full-length PANCE practice tests
8. **Prescription Writing**: Interactive order entry training

### Technical Improvements

1. **Database Sharding**: Horizontal scaling for user data
2. **GraphQL API**: Replace REST for flexible queries
3. **WebSockets**: Real-time collaborative features
4. **CDN Optimization**: Cloudflare R2 for media storage
5. **A/B Testing**: Feature flags & experimentation framework
6. **Accessibility**: WCAG 2.1 AAA compliance
7. **Internationalization**: i18n framework integration

---

## Contributing

### Development Guidelines

1. **Branch Strategy**: `main` (production), `develop` (staging), feature branches
2. **Commit Convention**: Conventional Commits (feat/fix/docs/chore)
3. **Code Review**: Required for all PRs
4. **Testing**: Unit tests required for new features
5. **Documentation**: Update README/docs with changes

### Code Style

- **Formatting**: Prettier (2-space indent, single quotes)
- **Linting**: ESLint with TypeScript rules
- **Naming**: camelCase (variables), PascalCase (components), UPPER_CASE (constants)
- **File Structure**: Co-locate components with styles/tests

---

## Support & Resources

### Documentation

- [Master Documentation](./MASTER_DOCUMENTATION.md) - Architecture & development guide
- [Cloudflare Functions Guide](./CLOUDFLARE_FUNCTIONS_GUIDE.md) - Serverless API patterns
- [Database Implementation](./DATABASE_IMPLEMENTATION.md) - Schema & migrations
- [Production Deployment](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Deployment guide

### External Resources

- [Vite Documentation](https://vitejs.dev/)
- [React 19 Docs](https://react.dev/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Clerk Docs](https://clerk.com/docs)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)

### Contact

- **Repository**: https://github.com/aaronjullger-lgtm/PANaCEa
- **Issues**: GitHub Issues
- **Production**: https://studypanacea.com

---

## License

Proprietary - All Rights Reserved

Copyright © 2026 PANaCEa Platform

---

**Document Version**: 1.0  
**Last Updated**: January 6, 2026  
**Maintained By**: Development Team
