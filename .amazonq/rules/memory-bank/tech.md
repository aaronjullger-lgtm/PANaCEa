# PANaCEa - Technology Stack

## Programming Languages

### TypeScript 5.8.2
- **Primary Language**: All application code written in TypeScript
- **Strict Mode**: Enabled with full type safety (`strict: true`)
- **Target**: ES2022 with modern JavaScript features
- **Module System**: ESNext with bundler resolution
- **JSX**: React JSX transform for component syntax

### Python 3.x
- **Use Cases**: Image mining scripts, data analysis utilities
- **Location**: `/scripts/mine_images.py`, various analysis scripts

### JavaScript (Node.js 20+)
- **Runtime**: Node.js v20.0.0 or higher required
- **Use Cases**: Build scripts, configuration files, legacy utilities

## Frontend Stack

### React 19.2.0
- **UI Framework**: Latest React with concurrent features
- **Component Model**: Functional components with hooks
- **State Management**: Context API + React Query
- **Rendering**: Client-side rendering with Vite

### Vite 6.2.0
- **Build Tool**: Lightning-fast development server and bundler
- **HMR**: Hot module replacement for instant updates
- **Plugins**: React plugin, PWA plugin, Sentry plugin
- **Output**: Optimized production bundles with code splitting

### TailwindCSS 3.4.18
- **Styling**: Utility-first CSS framework
- **Configuration**: Custom design tokens in `tailwind.config.js`
- **Plugins**: Custom spacing system, color tokens
- **JIT**: Just-in-time compilation for minimal CSS

### Framer Motion 12.23.24
- **Animation**: Declarative animations and transitions
- **Gestures**: Drag, hover, tap interactions
- **Layout Animations**: Automatic layout transitions
- **View Transitions**: Page transition effects

### React Router 7.11.0
- **Routing**: Client-side navigation
- **Lazy Loading**: Code-split routes for performance
- **Protected Routes**: Authentication-gated pages

## Backend Stack

### Cloudflare Pages Functions
- **Production API**: Edge functions in `/functions/api`
- **Runtime**: Cloudflare Workers runtime
- **Deployment**: Automatic deployment via GitHub integration
- **Bindings**: Environment variables for secrets

### Express 4.21.2 (Local Dev Only)
- **Dev Server**: Local development API server
- **Port**: 3001 (proxied by Vite on 3000)
- **Middleware**: CORS, helmet, rate limiting
- **Routes**: Legacy routes in `/routes` (not deployed)

### PostgreSQL
- **Database**: Primary data store for all medical content
- **Hosting**: Supabase (production), local (development)
- **Version**: PostgreSQL 14+
- **Features**: Full-text search, JSONB columns, indexes

### Prisma 7.2.0
- **ORM**: Type-safe database client
- **Schema**: Defined in `prisma/schema.prisma`
- **Migrations**: Version-controlled schema changes
- **Client**: Auto-generated TypeScript types
- **Extensions**: Accelerate extension for connection pooling

## AI & Machine Learning

### Google Gemini API
- **Model**: Gemini 1.5 Pro / Flash
- **Use Cases**: Question generation, clinical reasoning, content enrichment
- **SDK**: `@google/generative-ai` v0.24.1
- **Rate Limiting**: Custom rate limiter in edge functions

### FSRS (Free Spaced Repetition Scheduler)
- **Algorithm**: FSRS v5 for spaced repetition
- **Library**: `fsrs.js` v1.2.2
- **Optimization**: User-specific parameter tuning
- **Implementation**: Custom TypeScript wrapper in `/lib/fsrs.ts`

## Authentication & Security

### Clerk 5.57.1
- **Auth Provider**: User authentication and management
- **Features**: Social login, email/password, MFA
- **SDK**: `@clerk/clerk-react` for frontend, `@clerk/backend` for API
- **Session Management**: JWT tokens with automatic refresh

### Security Libraries
- **Helmet**: HTTP security headers
- **CORS**: Cross-origin resource sharing configuration
- **Rate Limiting**: `express-rate-limit` for API protection
- **CSP**: Content Security Policy in `public/_headers`

## Data Management

### React Query 5.90.20
- **Data Fetching**: Server state management
- **Caching**: Intelligent cache invalidation
- **Persistence**: IndexedDB persistence with `@tanstack/react-query-persist-client`
- **Optimistic Updates**: Instant UI updates

### Supabase Client 2.89.0
- **Database Client**: PostgreSQL connection
- **Real-time**: WebSocket subscriptions (optional)
- **Storage**: File upload capabilities

### IndexedDB (idb-keyval)
- **Local Storage**: Offline data persistence
- **PWA Support**: Service worker integration
- **Cache**: Question cache for offline mode

## Testing & Quality

### Vitest 4.0.14
- **Unit Testing**: Fast unit test runner
- **Coverage**: Code coverage reporting
- **Mocking**: Built-in mocking utilities
- **Config**: `vitest.config.ts`

### Playwright 1.57.0
- **E2E Testing**: End-to-end browser testing
- **Browsers**: Chromium, Firefox, WebKit
- **Accessibility**: `@axe-core/playwright` for a11y testing
- **Config**: `playwright.config.ts`, `playwright.wrangler.config.ts`

### ESLint 9.17.0
- **Linting**: Code quality and style enforcement
- **Plugins**: React hooks, React refresh, TypeScript
- **Config**: `eslint.config.js`
- **Max Warnings**: 2000 (legacy codebase)

### Prettier 3.4.2
- **Formatting**: Consistent code formatting
- **Config**: `.prettierrc`
- **Integration**: ESLint integration for auto-fix

## Build & Deployment

### Wrangler 4.18.0
- **Cloudflare CLI**: Deployment and local development
- **Commands**: `wrangler pages dev`, `wrangler pages deploy`
- **Config**: `wrangler.toml`

### Concurrently 9.1.2
- **Process Management**: Run multiple dev servers
- **Usage**: `npm run dev:all` runs Express + Vite

### TSX 4.20.6
- **TypeScript Execution**: Run TS files directly
- **Scripts**: All automation scripts use `tsx`

## Development Commands

### Core Development
```bash
npm run dev                    # Vite dev server (port 3000)
npm run dev:server            # Express backend (port 3001)
npm run dev:all               # Both servers concurrently
npm run dev:wrangler          # Cloudflare Pages dev (production parity)
```

### Building
```bash
npm run build                 # Build frontend for production
npm run build:server          # Build backend (legacy)
npm run pages:build           # Cloudflare Pages build
```

### Database
```bash
npm run db:generate           # Generate Prisma client
npm run db:push               # Push schema changes
npm run db:studio             # Open Prisma Studio GUI
npm run migrate:production    # Run production migrations
npm run db:seed               # Seed database with initial data
```

### Testing
```bash
npm test                      # Run unit tests
npm run test:e2e              # Run E2E tests
npm run test:smoke            # Run smoke tests
npm run test:e2e:ui           # Playwright UI mode
```

### Code Quality
```bash
npm run typecheck             # TypeScript type checking
npm run lint                  # ESLint linting
npm run lint:fix              # Auto-fix linting issues
npm run format                # Format code with Prettier
npm run format:check          # Check formatting
```

### Content Management
```bash
npm run orchestrate:full      # Run full content pipeline
npm run generate:clinical     # Generate clinical content
npm run generate:lab          # Generate lab content
npm run media:integrate       # Integrate media files
```

### Automation
```bash
npm run automation:hourly     # Hourly maintenance tasks
npm run automation:daily      # Daily maintenance tasks
npm run automation:weekly     # Weekly maintenance tasks
npm run system-health         # System health check
```

### Deployment
```bash
npm run deploy:local          # Deploy to Cloudflare Pages
npm run pages:serve           # Serve production build locally
```

## Dependencies Overview

### Core Dependencies (50+)
- **UI**: React, React DOM, Lucide icons, Recharts
- **Routing**: React Router DOM
- **State**: React Query, Context API
- **Styling**: TailwindCSS, Framer Motion
- **Database**: Prisma, PostgreSQL client
- **AI**: Google Gemini SDK
- **Auth**: Clerk
- **Forms**: Zod validation
- **Utils**: UUID, date-fns, clsx

### Dev Dependencies (30+)
- **Testing**: Vitest, Playwright, Testing Library
- **Build**: Vite, TypeScript, TSX
- **Linting**: ESLint, Prettier
- **Types**: @types/* packages for TypeScript
- **Cloudflare**: Wrangler, Workers types

## Environment Variables

### Required
- `DATABASE_URL`: PostgreSQL connection string
- `GEMINI_API_KEY`: Google Gemini API key
- `CLERK_SECRET_KEY`: Clerk backend secret
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk frontend key

### Optional
- `REDIS_URL`: Redis connection for caching
- `SENTRY_DSN`: Error tracking
- `NODE_ENV`: Environment (development/production)
