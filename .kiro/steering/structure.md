# Project Structure & Organization

## Root Level Files

### Configuration Files

- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration with PWA setup
- `tailwind.config.js` - Tailwind CSS configuration
- `prisma/schema.prisma` - Database schema definition
- `.env.example` - Environment variables template

### Core Application Files

- `App.tsx` - Main application component with routing logic
- `index.tsx` - Application entry point
- `types.ts` - Global TypeScript type definitions (being migrated to `src/types/`)
- `constants.ts` - Application constants (PANCE topics, system codes, etc.)

### Registry Files (Data Sources)

- `conditionRegistry.ts` - Medical conditions organized by system
- `drugRegistry.ts` - Pharmaceutical data and classifications
- `anatomyRegistry.ts` - Anatomical structures and systems
- `treatmentRegistry.ts` - Treatment protocols and guidelines
- `labTestRegistry.ts` - Laboratory tests and normal values
- `*Registry.ts` - Other specialized registries

## Directory Structure

### `/components` - React Components

Organized by feature and complexity:

- **Core UI**: `Loader.tsx`, `ThemeToggleButton.tsx`, `ErrorBoundary.tsx`
- **Views**: `QuizView.tsx`, `MenuView.tsx`, `LandingPage.tsx`
- **Drill Modes**: `drill/` subdirectory for specialized training modes
- **Analytics**: `analytics/` for performance tracking components
- **Admin**: `admin/` for content management interfaces
- **Modals**: Various modal components for settings, shortcuts, etc.

### `/hooks` - Custom React Hooks

- `useAuth.ts` - Authentication state management
- `useUserStats.ts` - Performance data with cloud sync
- `useSupabase.ts` - Database operations
- `useTheme.ts` - Theme switching logic
- `game/` - Gamification-related hooks

### `/lib` - Utility Libraries

- `supabase.ts` - Database client configuration
- `db.ts` - Database helper functions
- `api/` - API integration utilities
- `auth/` - Authentication helpers
- `utils/` - General utility functions

### `/services` - Business Logic

- `geminiService.ts` - AI content generation
- `contentOrchestrator.ts` - Content pipeline management
- `mediaApprovalService.ts` - Content quality control
- `userProfileService.ts` - User data management
- `*Service.ts` - Other domain-specific services

### `/data` - Static Data Files

- `conditionDrillData.ts` - Drill session configurations
- `pharmQuizData.ts` - Pharmacology question data
- `photoManifest.ts` - Image asset references
- `modes/` - Training mode configurations

### `/scripts` - Automation & Utilities

- `automation/` - Scheduled tasks (hourly, daily, weekly)
- `generateContent.ts` - AI content generation scripts
- `migrate*.ts` - Database migration utilities
- `sync*.ts` - Registry synchronization scripts

### `/functions` - Serverless Functions

- `api/` - API endpoints for Cloudflare Functions
- `geminiProxy.ts` - AI API proxy function

### `/config` - Configuration Files

- `achievements.ts` - Gamification system configuration
- `training-modes.ts` - Learning mode definitions
- `specialty-caq.ts` - Specialty certification tracks

## Naming Conventions

### Files & Directories

- **PascalCase**: React components (`QuizView.tsx`, `MenuView.tsx`)
- **camelCase**: Utilities, services, hooks (`useAuth.ts`, `geminiService.ts`)
- **kebab-case**: Configuration files (`vite.config.ts`)
- **lowercase**: Directories (`components/`, `services/`, `hooks/`)

### Code Conventions

- **Interfaces**: PascalCase with descriptive names (`Question`, `PerformanceRecord`)
- **Types**: PascalCase for union types (`SystemCode`, `TrainingModeId`)
- **Constants**: UPPER_SNAKE_CASE (`PANCE_TOPICS`, `GEMINI_FLASH_MODEL`)
- **Registry Objects**: UPPER_SNAKE_CASE with descriptive prefixes (`CONDITION_REGISTRY_CV`)

## Import Patterns

### Path Aliases

- `@/*` - Root directory alias for clean imports
- Relative imports for same-directory files
- Absolute imports for cross-directory dependencies

### Component Organization

- Lazy loading for large components with `React.lazy()`
- Suspense boundaries for loading states
- Error boundaries for graceful error handling

## Data Flow Architecture

### Registry → Database → UI

1. **Registries**: TypeScript source of truth for medical data
2. **Sync Scripts**: Transfer registry data to database tables
3. **Services**: Business logic layer accessing database
4. **Hooks**: React state management with cloud sync
5. **Components**: UI consuming data through hooks

### Content Pipeline

1. **AI Generation**: Gemini API creates medical content
2. **Staging Lake**: Quality control and validation
3. **Approval Process**: Human review for medical accuracy
4. **Production Cache**: Approved content served to users
