# Technology Stack & Build System

## Core Technologies

### Frontend

- **React 19** with TypeScript - Modern React with latest features
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library for smooth transitions
- **Lucide React** - Icon library

### Backend & Database

- **Express.js** - Node.js web framework
- **Prisma** - Database ORM with PostgreSQL
- **Supabase** - Backend-as-a-Service (PostgreSQL + Auth + Storage)
- **Clerk** - Authentication provider

### AI & Content

- **Google Gemini API** - AI content generation (2.5-flash and 2.5-pro models)
- **Hybrid Content Engine** - Custom system for AI content caching and quality control

### Deployment

- **Cloudflare Pages** - Frontend hosting
- **Cloudflare Functions** - Serverless backend functions
- **Neon/Supabase** - Managed PostgreSQL database

## Development Commands

### Setup

```bash
npm install                    # Install dependencies
cp .env.example .env          # Set up environment variables
npm run db:generate           # Generate Prisma client
npm run db:push              # Push schema to database (dev)
```

### Development

```bash
npm run dev:all              # Start both frontend and backend (recommended)
npm run dev                  # Frontend only (port 3000)
npm run dev:server          # Backend only (port 3001)
npm run db:studio           # Open Prisma Studio (database GUI)
```

### Database Operations

```bash
npm run db:migrate:dev      # Create and apply migrations (development)
npm run db:migrate:deploy   # Deploy migrations (production)
npm run sync:all           # Sync all registries to database
npm run migrate:production  # Interactive production migration
```

### Content Management

```bash
npm run generate:clinical   # Generate clinical content
npm run generate:lab       # Generate lab content
npm run health-check       # Run content health checker
npm run orchestrate:full   # Run full automated pipeline
```

### Build & Deploy

```bash
npm run build              # Build frontend for production
npm run build:server       # Build backend for production
npm test                   # Run test suite
npm run preview           # Preview production build
```

## Architecture Patterns

### Code Organization

- **Registry Pattern**: Central registries for conditions, drugs, anatomy, etc.
- **Service Layer**: Business logic in `/services` directory
- **Hook Pattern**: Custom React hooks for state management
- **Component Composition**: Lazy-loaded components with Suspense boundaries

### Data Flow

- **Database-First**: Prisma schema as source of truth
- **Registry Sync**: TypeScript registries sync to database tables
- **Cloud Sync**: Real-time sync between local storage and Supabase
- **Hybrid Content**: AI-generated content cached in staging lake

### Performance Optimizations

- **Code Splitting**: Manual chunks for better caching
- **Lazy Loading**: Components loaded on demand
- **PWA**: Service worker for offline functionality
- **Data Preloading**: Background preloading of large datasets
