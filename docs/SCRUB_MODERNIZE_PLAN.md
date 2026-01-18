# 🔬 StudyPANaCEa Repository "Scrub & Modernize" Plan

**Generated:** 2026-01-11  
**Audit Scope:** Full repository analysis  
**Target:** Strategic cleanup and modernization

---

## Executive Summary

This document contains the findings from a comprehensive audit of the PANaCEa codebase and provides three detailed, self-contained Copilot prompts for systematic cleanup.

### Stack Overview

| Layer    | Technology                 | Version |
| -------- | -------------------------- | ------- |
| Frontend | React                      | 19.2.0  |
| Database | PostgreSQL + Prisma        | 7.2.0   |
| Build    | Vite                       | 6.2.0   |
| Styling  | Tailwind CSS               | 3.4.18  |
| Runtime  | Cloudflare Pages Functions | Latest  |
| Auth     | Clerk                      | 5.57.1  |

---

## Audit Findings Summary

### Issues Discovered

| Category                            | Count     | Severity |
| ----------------------------------- | --------- | -------- |
| Console.log statements              | 300+      | Medium   |
| TODO/FIXME comments                 | 50+       | Medium   |
| Inline styles (should use Tailwind) | 172+      | Low      |
| Hardcoded hex colors                | 50+       | Low      |
| `any` type usage                    | 20+ files | High     |
| Incomplete service implementations  | 1 major   | High     |

### Key Files Requiring Attention

1. **`services/studyGroupService.ts`** - Entirely scaffolded, not implemented
2. **`functions/api/**/\*.ts`** - Heavy `any` type usage
3. **`components/analytics/*.tsx`** - Most inline styles and hardcoded colors
4. **`services/*.ts`** - Most console.log statements

---

## Tier 1: Critical Stabilization

### Overview

Fix crashes, broken types, and schema desyncs. These issues can cause runtime errors or data inconsistencies.

### Issues to Address

- [ ] API handlers using `context: any` pattern
- [ ] Heavy use of `any` in data processing
- [ ] Incomplete studyGroupService implementation
- [ ] Missing admin authorization checks

---

## Tier 2: Refactoring & Hygiene

### Overview

Clean up the codebase and enforce strict patterns. These issues affect maintainability and code quality.

### Issues to Address

- [ ] 300+ console.log statements in production code
- [ ] 50+ unresolved TODO comments
- [ ] Inconsistent error handling patterns
- [ ] Duplicate service patterns

---

## Tier 3: UI/UX Polish

### Overview

Visual modernization and interaction smoothing. These issues affect user experience and visual consistency.

### Issues to Address

- [ ] 172+ inline styles should use Tailwind
- [ ] Inconsistent loading states
- [ ] Missing skeleton loaders
- [ ] Hardcoded colors breaking theming

---

# 📋 COPILOT PROMPT: TIER 1 - Critical Stabilization

**Copy everything below this line and paste into Copilot:**

---

## Context

I'm working on the PANaCEa medical education platform. This is a React 19 + TypeScript + Prisma 7 + Cloudflare Pages Functions application. The codebase uses:

- Clerk for authentication
- Zod for validation
- FSRS algorithm for spaced repetition
- Tailwind CSS for styling

The project follows these critical rules from `.clinerules`:

1. All API endpoints must use `try/finally` with `prisma.$disconnect()` in the finally block
2. Use Zod for runtime validation of all external data
3. Never use `any` type - create proper interfaces
4. All medical content must be fetched from PostgreSQL via Prisma (database-first)

## Task: Type Safety & Critical Fixes

### 1. Create a proper CloudflareContext interface

Create/update `functions/api/_shared/types.ts` to include:

```typescript
import { EdgePrismaClient } from './prisma-edge';

export interface CloudflareEnv {
  DATABASE_URL: string;
  GEMINI_API_KEY?: string;
  CLERK_SECRET_KEY: string;
  CACHE?: KVNamespace;
}

export interface CloudflareContext {
  request: Request;
  env: CloudflareEnv;
  params: Record<string, string>;
  data: Record<string, unknown>;
}

export interface AuthenticatedContext extends CloudflareContext {
  userId: string; // Clerk user ID after auth verification
}
```

### 2. Update API handlers to use proper types

For every file in `functions/api/`, replace:

```typescript
export const onRequestPost = async (context: any) => {
```

With:

```typescript
import { CloudflareContext } from '../_shared/types';

export const onRequestPost = async (context: CloudflareContext) => {
```

Priority files to fix (most critical):

1. `functions/api/drills/submit-review.ts` - handles FSRS updates
2. `functions/api/questions/session.ts` - session generation
3. `functions/api/webhooks/clerk.ts` - user sync
4. `functions/api/admin/content/[id].ts` - content management

### 3. Fix the studyGroupService implementation

The file `services/studyGroupService.ts` is entirely scaffolded with TODO comments. Either:

- **Option A:** Implement it properly with Prisma calls
- **Option B:** Remove it if not needed and update any imports

If implementing, use this pattern from other services:

```typescript
import { createEdgePrismaClient } from '../functions/api/_shared/prisma-edge';

export class StudyGroupService {
  static async createGroup(data: CreateGroupInput): Promise<StudyGroup> {
    const prisma = createEdgePrismaClient(process.env.DATABASE_URL!);
    try {
      return await prisma.studyGroup.create({ data });
    } finally {
      await prisma.$disconnect();
    }
  }
}
```

### 4. Add missing admin authorization checks

In these files, add admin role verification after auth:

- `functions/api/questions/flags.ts` (line with `// TODO: Add admin check here`)
- `functions/api/questions/flag/[flagId]/resolve.ts`

Use this pattern:

```typescript
import { verifyAuthToken } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

// After getting clerkId from verifyAuthToken:
const user = await prisma.user.findUnique({
  where: { clerkId },
  select: { id: true, role: true },
});

if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
```

### 5. Fix `any` types in submit-review.ts

In `functions/api/drills/submit-review.ts`, replace:

```typescript
const qData: any = (question as any).questionData || {};
```

With a proper interface:

```typescript
interface QuestionData {
  stem?: string;
  question?: string;
  vignette?: string;
  text?: string;
  correctAnswer?: string;
  answer?: string;
  correct_option?: string;
  correctChoice?: string;
  correctIndex?: number;
  options?: Array<{ value?: string; text?: string; label?: string } | string>;
  choices?: Array<{ value?: string; text?: string; label?: string } | string>;
}

const qData = (question.questionData as QuestionData) || {};
```

### Validation Criteria

After completing these changes:

1. Run `npx tsc --noEmit` - should have no type errors
2. Run `npm test` - existing tests should pass
3. Deploy to preview and verify `/api/drills/submit-review` works

---

# 📋 COPILOT PROMPT: TIER 2 - Refactoring & Hygiene

**Copy everything below this line and paste into Copilot:**

---

## Context

I'm working on the PANaCEa medical education platform (React 19 + TypeScript + Prisma 7 + Cloudflare). This task focuses on code hygiene cleanup.

The project follows these rules:

1. No console.log in production code (use proper logging or remove)
2. All TODOs should be resolved or converted to GitHub issues
3. Consistent error handling patterns across the codebase

## Task: Code Hygiene Cleanup

### 1. Create a centralized logger utility

Create `lib/logger.ts`:

```typescript
/**
 * Centralized logging utility for PANaCEa
 * Uses console in development, silent in production (or send to Sentry)
 */

const isDev =
  typeof window !== 'undefined' ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log('[DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.log('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
    // In production, also send to Sentry
    if (!isDev && typeof window !== 'undefined') {
      // @ts-ignore - Sentry may not be imported
      window.Sentry?.captureMessage(args.join(' '), 'error');
    }
  },
};

export default logger;
```

### 2. Remove/replace console.log statements

For each file with console.log statements, apply these rules:

**Scripts (`scripts/*.ts`):**

- Keep console.log - these are CLI tools and need output
- Consider using chalk for colored output

**Services (`services/*.ts`):**

- Replace `console.log` with `logger.debug()` or `logger.info()`
- Replace `console.warn` with `logger.warn()`
- Replace `console.error` with `logger.error()`

Priority files to update:

1. `services/questionService.ts` - 8+ console.log statements
2. `services/contextAwareOrchestrator.ts` - 20+ console.log statements
3. `services/mainSessionService.ts` - scattered logging
4. `services/batchGeneratorService.ts` - progress logging

**API Functions (`functions/api/**/\*.ts`):\*\*

- Remove debug console.log statements entirely
- Keep console.error for actual error cases
- Replace informational logs with `logger.debug()` if needed

Files to clean:

1. `functions/api/_shared/prisma-edge.ts` - Remove debug logging
2. `functions/api/_shared/auth.ts` - Remove `[AUTH]` debug logs
3. `functions/api/_shared/kv-cache.ts` - Remove cache hit/miss logs
4. `functions/api/webhooks/clerk.ts` - Reduce to error logging only

### 3. Resolve or document TODO comments

For each TODO, apply one of these actions:

**Action A: Implement if simple (< 5 lines)**

```typescript
// BEFORE:
// TODO: Add admin check here

// AFTER:
if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
}
```

**Action B: Create a tracking comment with issue reference**

```typescript
// BEFORE:
// TODO: Save to database

// AFTER:
// DEFERRED: Database implementation needed - see GitHub issue #XXX
// This service currently uses in-memory state as a placeholder
```

**Action C: Remove if obsolete**
Check if the TODO is already implemented elsewhere or no longer needed.

Priority TODOs to address:

1. `services/studyGroupService.ts` - 10+ TODOs (implement or remove service)
2. `functions/api/questions/flags.ts` - admin check TODO
3. `server.ts` - migration TODO

### 4. Create unified error handling utility

Create `lib/errorHandling.ts`:

```typescript
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createErrorResponse(
  error: unknown,
  defaultMessage = 'An error occurred'
): Response {
  const isAppError = error instanceof AppError;
  const status = isAppError ? error.statusCode : 500;
  const message = isAppError ? error.message : defaultMessage;

  logger.error('API Error:', error);

  return new Response(
    JSON.stringify({
      error: message,
      code: isAppError ? error.code : 'INTERNAL_ERROR',
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// Usage in API handlers:
// } catch (error) {
//   return createErrorResponse(error, 'Failed to process request');
// }
```

### 5. Standardize API error responses

Update all API handlers to use this pattern:

```typescript
import { createErrorResponse, AppError } from '../../lib/errorHandling';

export const onRequestPost = async (context: CloudflareContext) => {
  let prisma: EdgePrismaClient | null = null;

  try {
    // ... handler logic

    if (!someCondition) {
      throw new AppError('Resource not found', 404, 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to complete operation');
  } finally {
    if (prisma) await prisma.$disconnect();
  }
};
```

### Validation Criteria

After completing these changes:

1. Run `grep -r "console.log" services/ --include="*.ts" | wc -l` - should be < 10
2. Run `grep -r "// TODO" functions/ --include="*.ts" | wc -l` - should be 0
3. All tests should still pass

---

# 📋 COPILOT PROMPT: TIER 3 - UI/UX Polish

**Copy everything below this line and paste into Copilot:**

---

## Context

I'm working on the PANaCEa medical education platform (React 19 + TypeScript + Tailwind CSS). This task focuses on visual consistency and UX improvements.

The project uses:

- Tailwind CSS 3.4 with custom CSS variables (`var(--color-*)`)
- Framer Motion for animations
- Existing skeleton loaders in `components/ui/SkeletonLoader.tsx`

The `.clinerules` specifies:

1. Zero Layout Shift (CLS = 0.0) - use skeleton loaders
2. All skeletons use `bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl`
3. Smooth transitions with framer-motion

## Task: UI/UX Standardization

### 1. Replace inline styles with Tailwind utilities

**Pattern to convert:**

```tsx
// BEFORE:
style={{ width: `${percentage}%` }}

// AFTER:
style={{ width: `${percentage}%` }}  // Keep dynamic values
// OR use Tailwind for static values:
className="w-full"  // If always 100%
className="w-1/2"   // If always 50%
```

**For dynamic widths (progress bars), use this pattern:**

```tsx
// Good pattern - dynamic inline style is acceptable for calculated values
<div
  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
  style={{ width: `${Math.min(100, progress)}%` }}
/>
```

**Convert static inline styles to Tailwind:**

| Inline Style       | Tailwind Equivalent |
| ------------------ | ------------------- |
| `fontSize: 12`     | `text-xs`           |
| `fontSize: 11`     | `text-[11px]`       |
| `margin: 0`        | `m-0`               |
| `padding: 20px`    | `p-5`               |
| `color: '#64748b'` | `text-slate-500`    |
| `color: '#e2e8f0'` | `text-slate-200`    |

Priority files to update:

1. `components/analytics/AnalyticsDashboard.tsx`
2. `components/ProgressDashboard/HeatmapCalendar.tsx`
3. `components/achievements/UnlockAnimation.tsx`
4. `components/dashboard/charts/*.tsx`

### 2. Standardize Recharts styling with CSS variables

For all Recharts components, use CSS variables instead of hardcoded colors:

```tsx
// BEFORE:
<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
<XAxis tick={{ fill: '#64748b', fontSize: 11 }} />

// AFTER:
<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
<XAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
```

Create a Recharts theme helper in `lib/chartTheme.ts`:

```typescript
export const chartTheme = {
  grid: {
    stroke: 'var(--color-border)',
    strokeDasharray: '3 3',
  },
  axis: {
    tick: {
      fill: 'var(--color-text-muted)',
      fontSize: 11,
    },
    line: {
      stroke: 'var(--color-border)',
    },
  },
  colors: {
    primary: 'var(--color-accent)',
    secondary: 'var(--color-accent-secondary)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
};
```

### 3. Add skeleton loaders to async components

For components that fetch data, add loading skeletons:

**Pattern:**

```tsx
import { SkeletonLoader, SkeletonText } from '@/components/ui/SkeletonLoader';

const MyComponent = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Match the structure of actual content */}
        <SkeletonLoader height={200} className="rounded-xl" />
        <SkeletonText lines={3} />
      </div>
    );
  }

  return <ActualContent data={data} />;
};
```

Priority components to add skeletons:

1. `components/modes/SmartReviewMode.tsx` - Replace simple spinner with content skeleton
2. `components/analytics/AnalyticsDashboard.tsx` - Add chart skeletons
3. `components/dashboard/TrainingMenu.tsx` - Add mode card skeletons

### 4. Update SmartReviewMode loading state

In `components/modes/SmartReviewMode.tsx`, replace the loading state:

```tsx
// BEFORE:
if (viewState === 'loading') {
  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] flex items-center justify-center z-50">
      <motion.div>
        <Brain className="w-16 h-16 animate-pulse" />
        <p>Loading your daily reviews...</p>
      </motion.div>
    </div>
  );
}

// AFTER:
if (viewState === 'loading') {
  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] overflow-y-auto z-50">
      {/* Header Skeleton */}
      <div className="sticky top-0 bg-[var(--color-bg-secondary)]/95 backdrop-blur border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkeletonLoader width={24} height={24} className="rounded" />
            <SkeletonLoader width={100} height={20} className="rounded" />
          </div>
          <SkeletonLoader width={60} height={20} className="rounded" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Badge skeleton */}
        <div className="flex justify-center">
          <SkeletonLoader width={140} height={36} className="rounded-full" />
        </div>

        {/* Question card skeleton */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
          <SkeletonText lines={3} className="mb-8" />

          {/* Answer choices skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonLoader key={i} height={64} className="rounded-xl" />
            ))}
          </div>
        </div>

        {/* Button skeleton */}
        <div className="flex justify-center">
          <SkeletonLoader width={160} height={48} className="rounded-xl" />
        </div>
      </div>
    </div>
  );
}
```

### 5. Add error states with retry buttons

Create a reusable error component in `components/ui/ErrorState.tsx`:

```tsx
import { AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong',
  onRetry,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <p className="text-[var(--color-text-primary)] font-medium mb-2">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </motion.div>
  );
};
```

Then use it in components:

```tsx
if (error) {
  return <ErrorState message={error.message} onRetry={loadData} />;
}
```

### 6. Prevent layout shift on progress bars

Ensure all progress bar containers have explicit heights:

```tsx
// BEFORE: May cause layout shift
<div className="bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
  <div style={{ width: `${progress}%` }} className="h-2 bg-blue-500" />
</div>

// AFTER: Fixed height prevents shift
<div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
  <div
    style={{ width: `${progress}%` }}
    className="h-full bg-blue-500 transition-all duration-300"
  />
</div>
```

### Validation Criteria

After completing these changes:

1. Run Lighthouse audit - CLS should be < 0.1
2. Toggle dark mode - all colors should update correctly
3. Throttle network to 3G - skeletons should appear before content
4. All interactions should have visual feedback

---

## Implementation Notes

### Order of Operations

1. **Start with Tier 1** - Type safety prevents runtime errors
2. **Then Tier 2** - Clean code makes Tier 3 easier
3. **Finally Tier 3** - Polish builds on stable foundation

### Testing After Each Tier

```bash
# After Tier 1
npx tsc --noEmit
npm test

# After Tier 2
npm run audit:all  # If available
grep -r "console.log" services/ --include="*.ts" | wc -l

# After Tier 3
npm run build
npm run preview
# Run Lighthouse audit on preview
```

### Rollback Plan

Create a branch before starting:

```bash
git checkout -b scrub-modernize-2026-01
```

Commit after each tier:

```bash
git commit -m "Tier 1: Type safety and critical fixes"
git commit -m "Tier 2: Code hygiene cleanup"
git commit -m "Tier 3: UI/UX polish"
```

---

## Appendix: Files Index

### High Priority Files (Tier 1)

- `functions/api/_shared/types.ts`
- `functions/api/drills/submit-review.ts`
- `functions/api/questions/session.ts`
- `services/studyGroupService.ts`

### Medium Priority Files (Tier 2)

- `services/questionService.ts`
- `services/contextAwareOrchestrator.ts`
- `functions/api/_shared/prisma-edge.ts`
- `functions/api/_shared/auth.ts`

### Lower Priority Files (Tier 3)

- `components/analytics/AnalyticsDashboard.tsx`
- `components/modes/SmartReviewMode.tsx`
- `components/ProgressDashboard/*.tsx`
- `components/dashboard/charts/*.tsx`
