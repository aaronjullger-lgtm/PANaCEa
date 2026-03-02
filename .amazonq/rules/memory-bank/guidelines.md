# PANaCEa - Development Guidelines

## Code Quality Standards

### TypeScript Strict Mode
- **Strict type checking enabled**: All code uses TypeScript strict mode (`strict: true`)
- **No implicit any**: All variables and parameters must have explicit types
- **Null safety**: Strict null checks enforced (`strictNullChecks: true`)
- **No unchecked indexed access**: Array/object access requires null checks (`noUncheckedIndexedAccess: true`)

### Code Formatting
- **Indentation**: 2 spaces (consistent across all files)
- **Line length**: Soft limit of 100 characters, hard limit of 120 characters
- **Semicolons**: Required at end of statements
- **Quotes**: Single quotes for strings, double quotes for JSX attributes
- **Trailing commas**: Required in multi-line arrays and objects

### Naming Conventions
- **Variables/Functions**: camelCase (`getUserProfile`, `isLoading`)
- **Types/Interfaces**: PascalCase (`Question`, `PerformanceRecord`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_REPLENISH_ATTEMPTS`, `BATCH_SIZE`)
- **Private fields**: Prefix with underscore (`_internalState`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (`isAnswered`, `hasActiveSession`)

### Documentation Standards
- **File headers**: Scripts include shebang and JSDoc comment explaining purpose and usage
- **Function documentation**: Complex functions have JSDoc comments with `@param` and `@returns`
- **Inline comments**: Used sparingly for complex logic, not for obvious code
- **TODO comments**: Format as `// TODO: description` with context

## Structural Conventions

### File Organization
- **One component per file**: React components in dedicated files
- **Barrel exports**: Index files (`index.ts`) for clean imports from directories
- **Colocation**: Related files grouped in feature directories
- **Separation of concerns**: Business logic in `/services`, UI in `/components`, types in `/types`

### Import Order
1. External dependencies (React, third-party libraries)
2. Internal absolute imports (`@/components`, `@/lib`)
3. Relative imports (`./`, `../`)
4. Type imports (grouped separately with `import type`)
5. CSS/style imports (last)

### Component Structure
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Question } from '@/types';

// 2. Types/Interfaces
interface ComponentProps {
  data: Question[];
  onSelect: (id: string) => void;
}

// 3. Constants
const DEFAULT_LIMIT = 10;

// 4. Component
export const Component: React.FC<ComponentProps> = ({ data, onSelect }) => {
  // 5. Hooks
  const [state, setState] = useState(null);
  
  // 6. Effects
  useEffect(() => {
    // effect logic
  }, []);
  
  // 7. Handlers
  const handleClick = () => {
    // handler logic
  };
  
  // 8. Render
  return <div>...</div>;
};
```

## Semantic Patterns

### React Patterns

#### Custom Hooks
- **Prefix with `use`**: All custom hooks start with `use` (`useAuth`, `useFSRSOptimizer`)
- **Return consistent shape**: Return objects with named properties, not arrays
- **Cleanup in effects**: Always return cleanup functions from useEffect
- **Dependency arrays**: Explicitly list all dependencies, use ESLint exhaustive-deps

#### State Management
- **Local state first**: Use `useState` for component-local state
- **Context for shared state**: Use React Context for cross-component state
- **Refs for non-reactive values**: Use `useRef` for values that don't trigger re-renders
- **Memoization**: Use `useMemo` and `useCallback` for expensive computations and stable references

#### Error Handling
- **Try-catch blocks**: Wrap async operations in try-catch
- **User-friendly messages**: Show helpful error messages, not technical stack traces
- **Logging**: Use centralized logger (`logger.error(LOG_SCOPE, message, error)`)
- **Graceful degradation**: Provide fallback UI when features fail

### API Patterns

#### Client-Server Communication
- **Fetch with tokens**: Always pass authentication token from `getToken()`
- **Error handling**: Check `res.ok` before parsing JSON
- **Type safety**: Define response types and validate with Zod schemas
- **Offline support**: Queue operations with `syncManager` for offline-first behavior

#### Database Queries
- **Prisma client**: Use generated Prisma client for all database operations
- **Select specific fields**: Use `select` to fetch only needed fields
- **Pagination**: Use `take` and `skip` for large result sets
- **Transactions**: Use `prisma.$transaction` for atomic operations

### Performance Patterns

#### Optimization Techniques
- **Code splitting**: Use React.lazy() for route-based code splitting
- **Memoization**: Memoize expensive computations with `useMemo`
- **Debouncing**: Debounce user input handlers (search, autosave)
- **Virtual scrolling**: Use `@tanstack/react-virtual` for long lists
- **Image optimization**: Lazy load images, use appropriate formats

#### Accessibility
- **Semantic HTML**: Use proper HTML elements (`<button>`, `<nav>`, `<main>`)
- **ARIA labels**: Add `aria-label` for icon-only buttons
- **Keyboard navigation**: Support Tab, Enter, Escape for all interactive elements
- **Screen reader announcements**: Use `announceToScreenReader()` for dynamic content
- **Focus management**: Move focus to new content after navigation

## Internal API Usage

### Service Layer
```typescript
// Question generation
import { getQuestionClient } from '@/services/client/questionApi';
const question = await getQuestionClient(sessionSettings, growthAreas, getToken);

// Session management
import { recordSessionAnswer } from '@/services/core';
await recordSessionAnswer(questionId, isCorrect, system, timeSpentMs);

// Analytics
import { recordCircadianPerformance } from '@/services/analytics';
recordCircadianPerformance({ timestamp, isCorrect, topic });
```

### Database Operations
```typescript
// Prisma queries
const conditions = await prisma.condition.findMany({
  where: { system: 'CV' },
  select: { id: true, name: true },
  take: 50,
});

// Transactions
await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { score } }),
  prisma.performanceRecord.create({ data: record }),
]);
```

### State Management
```typescript
// Context usage
import { useUserContext } from '@/hooks/useUserContext';
const { showPANREContent, careerStage } = useUserContext();

// Local storage
localStorage.setItem('panceai_enabled_systems', JSON.stringify(systems));
window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
```

## Code Idioms

### Conditional Rendering
```typescript
// Preferred: Early return for loading/error states
if (isLoading) return <Loader />;
if (error) return <ErrorMessage error={error} />;

// Preferred: Ternary for simple conditions
{isAnswered ? <Feedback /> : <SubmitButton />}

// Preferred: Logical AND for optional rendering
{hasData && <DataDisplay data={data} />}
```

### Array Operations
```typescript
// Preferred: Functional methods over loops
const correct = records.filter(r => r.isCorrect).length;
const systems = conditions.map(c => c.system);
const hasErrors = results.some(r => r.error);

// Preferred: Optional chaining for nested access
const email = user?.primaryEmailAddress?.emailAddress;
```

### Async/Await
```typescript
// Preferred: Async/await over .then()
try {
  const data = await fetchData();
  processData(data);
} catch (error) {
  handleError(error);
}

// Preferred: Promise.all for parallel operations
const [questions, stats] = await Promise.all([
  fetchQuestions(),
  fetchStats(),
]);
```

## Annotations

### JSDoc Comments
```typescript
/**
 * Fetches X-ray images from Wikimedia Commons for PA student training.
 * 
 * @param condition - Medical condition to fetch images for
 * @param limit - Maximum number of images to fetch (default: 10)
 * @returns Array of validated image URLs with metadata
 * 
 * Usage:
 *   npx tsx scripts/images/fetch-xray-images.ts
 *   npx tsx scripts/images/fetch-xray-images.ts --dry-run
 */
```

### Type Annotations
```typescript
// Explicit return types for public functions
function calculateScore(records: PerformanceRecord[]): number {
  return records.filter(r => r.isCorrect).length;
}

// Type guards for runtime validation
function isQuestion(obj: unknown): obj is Question {
  return typeof obj === 'object' && obj !== null && 'question' in obj;
}
```

### React Component Props
```typescript
// Interface for component props with JSDoc
interface QuizViewProps {
  /** Initial queue of questions to display */
  initialQueue: Question[];
  /** Callback when user answers a question */
  addPerformanceRecord: (record: PerformanceRecord) => void;
  /** When true, enables exam simulator mode (hide feedback, enforce timer) */
  isExamSimulator?: boolean;
}
```

## Testing Patterns

### Unit Tests
- **Test file naming**: `*.test.ts` or `*.test.tsx`
- **Test structure**: Arrange-Act-Assert pattern
- **Mocking**: Use Vitest mocks for external dependencies
- **Coverage**: Aim for 80%+ coverage on business logic

### E2E Tests
- **Test file naming**: `*.spec.ts` in `/e2e` directory
- **Page objects**: Use Playwright page objects for reusable selectors
- **Assertions**: Use Playwright's built-in assertions
- **Cleanup**: Reset database state between tests

## Security Practices

### Authentication
- **Token validation**: Always validate JWT tokens on backend
- **Clerk integration**: Use Clerk SDK for authentication, never roll your own
- **Protected routes**: Check authentication before rendering sensitive content

### Data Sanitization
- **HTML sanitization**: Use `sanitizeForRationale()` before rendering user content
- **SQL injection prevention**: Use Prisma parameterized queries (never string concatenation)
- **XSS prevention**: Never use `dangerouslySetInnerHTML` without sanitization

### Environment Variables
- **Never commit secrets**: Use `.env` files (gitignored)
- **Validate on startup**: Check required env vars exist at application start
- **Type-safe access**: Define env var types in `vite-env.d.ts`
