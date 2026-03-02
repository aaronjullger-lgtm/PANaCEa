# PANaCEa - Project Structure

## Directory Organization

### Frontend Components (`/components`)
React UI components organized by feature domain:
- **drill/**: Drill mode training components (Photo Drill, Rapid Recall)
- **modes/**: Training mode implementations (Quiz, OSCE, Custom Study)
- **admin/**: Administrative dashboard and CMS components
- **analytics/**: Performance charts and statistics visualization
- **session/**: Quiz session management (QuizView, SessionControls)
- **navigation/**: App navigation (CommandCenterHub, NavRail)
- **ui/**: Reusable UI primitives (buttons, cards, modals)
- **shared/**: Cross-cutting components (ErrorBoundary, LoadingStates)

### Business Logic (`/services`)
Service layer implementing core business logic:
- **ai/**: AI integration services (Gemini API, question generation)
- **analytics/**: User performance analytics and statistics
- **drill/**: Drill mode logic and review services
- **session/**: Quiz session orchestration
- **optimization/**: Performance optimization services
- **security/**: Authentication and authorization services

### Backend API (`/functions/api`)
Cloudflare Pages Functions (production edge handlers):
- **_shared/**: Shared utilities (rateLimiter, auth middleware)
- **gemini/**: AI proxy endpoints with rate limiting
- **questions/**: Question generation and retrieval
- **users/**: User profile and progress management
- **analytics/**: Performance data aggregation

### Legacy Express Routes (`/routes`)
Express route handlers for local development only (not deployed):
- **ai.ts**: AI question generation endpoints
- **questions.ts**: Question CRUD operations
- **users.ts**: User management
- **analytics.ts**: Analytics data endpoints
- **conditions.ts**: Medical condition content

### Library Code (`/lib`)
Shared utilities and core algorithms:
- **fsrs/**: FSRS v5 spaced repetition implementation
- **services/**: Backend services (CMS, SRS, Auto-author)
- **middleware/**: Express middleware (auth, validation)
- **utils/**: Utility functions (text processing, date handling)
- **validation/**: Zod schemas for type-safe validation
- **supabase/**: Database client and query helpers

### Database (`/prisma`)
PostgreSQL schema and migrations:
- **schema.prisma**: Complete database schema (50+ models)
- **migrations/**: Version-controlled schema migrations
- **config.ts**: Prisma client configuration

### Scripts (`/scripts`)
Automation and maintenance scripts:
- **automation/**: Scheduled tasks (hourly, daily, weekly)
- **generators/**: Content generation (mnemonics, lab tests)
- **images/**: Medical image fetching and processing
- **fixes/**: Database repair and migration scripts
- **seed/**: Database seeding scripts
- **maintenance/**: System health checks and cleanup

### Configuration (`/config`)
Application configuration files:
- **conditionRegistry.ts**: Medical condition definitions (2195 entries)
- **training-modes.ts**: Training mode configurations
- **navigation.ts**: App navigation structure
- **achievements.ts**: Gamification achievement definitions

### Type Definitions (`/types`)
TypeScript type definitions:
- **medical-content.ts**: Medical domain types
- **question.ts**: Question and quiz types
- **api.ts**: API request/response types
- **unified-stats.ts**: Analytics data types

### React Hooks (`/hooks`)
Custom React hooks for state management:
- **useAuth.ts**: Authentication state
- **useFSRSOptimizer.ts**: FSRS algorithm integration
- **useUserStats.ts**: User performance statistics
- **useSupabase.ts**: Database query hooks

### Context Providers (`/contexts`)
React context for global state:
- **SessionContext.tsx**: Quiz session state
- **ThemeContext.tsx**: UI theme management
- **ToastContext.tsx**: Notification system

## Core Components and Relationships

### Question Generation Flow
```
User Request → SessionContext → QuestionService → Gemini API
                                      ↓
                              StagingLake (validation)
                                      ↓
                              QuestionPool (approved)
                                      ↓
                              NoRepeatService (delivery)
```

### FSRS Learning Flow
```
User Answer → SessionContext → FSRSService → ReviewLog
                                    ↓
                            SchedulingCalculation
                                    ↓
                            NextReviewDate
```

### Content Management Flow
```
Admin CMS → ContentService → Database (PostgreSQL)
                                  ↓
                          ConditionService
                                  ↓
                          Frontend Components
```

### Authentication Flow
```
User Login → Clerk → Backend Middleware → Database User Record
                          ↓
                    JWT Token Validation
                          ↓
                    Protected API Routes
```

## Architectural Patterns

### Database-First Architecture
- PostgreSQL as single source of truth for all medical content
- No static JSON/TS arrays for clinical data
- Prisma ORM for type-safe database access
- Database migrations for schema versioning

### Hybrid Content Engine
- **Staging Lake**: Quality control gateway for AI-generated questions
- **Question Pool**: Approved questions ready for delivery
- **No-Repeat Logic**: Ensures users never see duplicate questions
- **Pearl Harvester**: Extracts clinical pearls from explanations

### Service Layer Pattern
- Business logic separated from UI components
- Services handle data fetching, transformation, and validation
- Dependency injection for testability
- Clear separation of concerns

### Component Composition
- Atomic design principles (atoms, molecules, organisms)
- Reusable UI primitives in `/components/ui`
- Feature-specific components in domain folders
- Higher-order components for cross-cutting concerns

### Edge-First Deployment
- Cloudflare Pages Functions for production API
- Global CDN distribution for low latency
- Edge caching for static assets
- Rate limiting at edge for security

### Type Safety
- Full TypeScript with strict mode enabled
- Zod schemas for runtime validation
- Prisma-generated types for database models
- Type-safe API contracts

### Testing Strategy
- Unit tests with Vitest for business logic
- E2E tests with Playwright for critical flows
- Smoke tests for deployment validation
- Accessibility testing with axe-core

## Key Files

- **App.tsx**: Main React application entry point
- **server.ts**: Express backend server (local dev only)
- **vite.config.ts**: Vite build configuration
- **wrangler.toml**: Cloudflare Pages deployment config
- **prisma/schema.prisma**: Database schema definition
- **package.json**: Dependencies and npm scripts
