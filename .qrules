# PANaCEa AI Assistant Rules & Guidelines

## Core Principles

### 1. Production-Ready Code Only
- Write complete, production-ready code - never "example" or "placeholder" code
- Never use comments like `// ... rest of logic` or `// ... existing code`
- If you encounter an error during generation, fix it autonomously before outputting
- Execute, don't instruct: When asked to build/test/deploy, do it yourself

### 2. Edge-First Architecture
**CRITICAL**: This project deploys to Cloudflare Pages (Workers environment)

**FORBIDDEN** - Never use these in `functions/` or `src/`:
```typescript
❌ import fs from 'fs'
❌ import path from 'path'
❌ import os from 'os'
❌ process.cwd()
❌ __dirname
❌ __filename
```

**REQUIRED** - Use Web Standard APIs:
```typescript
✅ fetch()
✅ Request / Response
✅ URL / URLSearchParams
✅ Headers
✅ FormData
```

### 3. Database-First Content
**CRITICAL**: Medical content MUST live in PostgreSQL, NOT static files

**FORBIDDEN**:
```typescript
❌ const conditions = [...]; // Static array
❌ import { conditionRegistry } from '@/config/conditionRegistry';
❌ const DRUG_DATA = { ... }; // Hardcoded data
```

**REQUIRED**:
```typescript
✅ const conditions = await prisma.condition.findMany();
✅ const drug = await prisma.drug.findUnique({ where: { id } });
```

### 4. Prisma Singleton Pattern
**CRITICAL**: Never instantiate PrismaClient directly

**FORBIDDEN**:
```typescript
❌ const prisma = new PrismaClient();
❌ import { PrismaClient } from '@prisma/client';
```

**REQUIRED**:
```typescript
✅ import { prisma } from '@/lib/prisma';
✅ import { createEdgePrismaClient } from '@/functions/api/_shared/prisma-edge';
```

**ALWAYS** disconnect in `finally` blocks:
```typescript
const prisma = createEdgePrismaClient(env.DATABASE_URL);
try {
  // ... database operations
} finally {
  await prisma.$disconnect();
}
```

## Code Style & Conventions

### TypeScript
- **Strict Mode**: Always use strict TypeScript
- **Interfaces Over Types**: Prefer `interface` for object shapes
- **Explicit Return Types**: Always specify return types for functions
- **No `any`**: Use `unknown` or proper types instead of `any`
- **Zod Validation**: All API inputs must be validated with Zod schemas

```typescript
// ✅ GOOD
interface UserData {
  id: string;
  email: string;
  firstName: string | null;
}

async function getUser(id: string): Promise<UserData | null> {
  return await prisma.user.findUnique({ where: { id } });
}

// ❌ BAD
function getUser(id: any): any {
  return prisma.user.findUnique({ where: { id } });
}
```

### React Components
- **Functional Components Only**: No class components
- **TypeScript Props**: Always define prop interfaces
- **Hooks**: Use standard hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)
- **No Default Exports**: Use named exports for components

```typescript
// ✅ GOOD
interface QuestionCardProps {
  question: string;
  options: string[];
  onAnswer: (index: number) => void;
}

export function QuestionCard({ question, options, onAnswer }: QuestionCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  // ...
}

// ❌ BAD
export default function QuestionCard(props: any) {
  // ...
}
```

### Styling (TailwindCSS)
- **Utility-First**: Use Tailwind classes, no custom CSS unless necessary
- **Design Tokens**: Use semantic color variables (`var(--color-*)`)
- **Clinical Palette**: Slate text, blue accents, rounded-xl cards
- **Animations**: Framer Motion with `easeOut` 0.2-0.3s transitions
- **No Pure Black**: Use `clinical-navy` (#0F172A) instead of `#000000`

```typescript
// ✅ GOOD
<div className="rounded-xl bg-surface-primary text-text-primary hover:translate-x-1 transition-transform duration-300 ease-out">
  <h2 className="text-xl font-semibold text-clinical-blue">Title</h2>
</div>

// ❌ BAD
<div style={{ backgroundColor: '#000', color: '#fff' }}>
  <h2>Title</h2>
</div>
```

### API Routes (Cloudflare Pages Functions)

**REQUIRED Pattern**:
```typescript
// functions/api/endpoint.ts
import { authenticateRequest } from './_shared/auth';
import { createEdgePrismaClient } from './_shared/prisma-edge';
import { z } from 'zod';

const RequestSchema = z.object({
  userId: z.string(),
  data: z.string(),
});

export async function onRequestPost(context: any) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(context.request, context.env.CLERK_SECRET_KEY);
    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // 2. Validate input
    const body = await context.request.json();
    const validated = RequestSchema.parse(body);

    // 3. Business logic
    const result = await prisma.user.update({
      where: { id: validated.userId },
      data: { /* ... */ },
    });

    // 4. Return response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
```

**FORBIDDEN Pattern** (Express-style):
```typescript
❌ app.post('/api/endpoint', async (req, res) => {
  // This only works in local dev (server.ts)
});
```

### Error Handling
- **Always Return JSON**: Never return HTML or raw stack traces
- **Structured Errors**: Use consistent error response format
- **Log Errors**: Always log errors before returning response
- **Try-Catch-Finally**: Always disconnect Prisma in `finally` blocks

```typescript
// ✅ GOOD
try {
  const result = await prisma.user.findUnique({ where: { id } });
  if (!result) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
  }
  return new Response(JSON.stringify(result), { status: 200 });
} catch (error) {
  console.error('Database error:', error);
  return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
} finally {
  await prisma.$disconnect();
}

// ❌ BAD
const result = await prisma.user.findUnique({ where: { id } });
return result; // No error handling, no disconnect
```

## Specific Do's and Don'ts

### React Components
✅ **DO**:
- Use functional components with hooks
- Define TypeScript interfaces for props
- Use Framer Motion for animations
- Use Lucide React for icons
- Implement loading states and error boundaries
- Use TanStack Query for server state

❌ **DON'T**:
- Use class components
- Use inline styles (use Tailwind)
- Use default exports
- Mutate state directly
- Use `any` type
- Forget to handle loading/error states

### API Development
✅ **DO**:
- Export `onRequestGet`, `onRequestPost`, etc.
- Validate all inputs with Zod
- Authenticate protected routes
- Disconnect Prisma in `finally` blocks
- Return structured JSON responses
- Log errors before returning

❌ **DON'T**:
- Use Express patterns (`req`, `res`)
- Use Node.js APIs (`fs`, `path`, `os`)
- Instantiate `new PrismaClient()`
- Return HTML error pages
- Forget to handle errors
- Use `process.env` (use `context.env`)

### Database Operations
✅ **DO**:
- Use Prisma singleton from `@/lib/prisma`
- Select only needed fields
- Use transactions for multi-step operations
- Add indexes for frequently queried fields
- Use `include` for relations
- Disconnect in `finally` blocks

❌ **DON'T**:
- Create new PrismaClient instances
- Select all fields (`select: *`)
- Forget to handle null results
- Use raw SQL without parameterization
- Forget to disconnect
- Query in loops (use `findMany` instead)

### Testing
✅ **DO**:
- Write unit tests for utilities (Vitest)
- Write E2E tests for critical flows (Playwright)
- Mock external APIs (Gemini, Clerk)
- Test error cases
- Use test fixtures for data

❌ **DON'T**:
- Test implementation details
- Use real API keys in tests
- Forget to clean up test data
- Skip error case testing
- Use production database for tests

### Security
✅ **DO**:
- Validate all user inputs with Zod
- Authenticate protected routes
- Verify Clerk webhook signatures
- Use environment variables for secrets
- Sanitize HTML user content
- Implement rate limiting

❌ **DON'T**:
- Trust user input
- Hardcode API keys
- Skip authentication checks
- Return sensitive data in errors
- Use `eval()` or `Function()`
- Expose internal error details

## File Organization

### Import Order
1. External dependencies (React, etc.)
2. Internal absolute imports (`@/lib`, `@/components`)
3. Relative imports (`./`, `../`)
4. Type imports (last)

```typescript
// ✅ GOOD
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { prisma } from '@/lib/prisma';
import { QuestionCard } from '@/components/session/QuestionCard';
import { formatDate } from './utils';
import type { User } from '@prisma/client';

// ❌ BAD
import type { User } from '@prisma/client';
import { formatDate } from './utils';
import { useState } from 'react';
import { prisma } from '@/lib/prisma';
```

### File Naming
- **Components**: PascalCase (`QuestionCard.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`UserData.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)
- **Hooks**: camelCase with `use` prefix (`useAuth.ts`)

### Directory Structure
- **Components**: Root `components/` directory
- **Server Logic**: Root `lib/` directory
- **Client Logic**: `src/lib/` directory
- **API Routes**: `functions/api/` directory
- **Types**: Root `types/` directory
- **Hooks**: Root `hooks/` directory

## Performance Best Practices

### Database Queries
- Select only needed fields
- Use indexes for WHERE clauses
- Batch queries with `findMany` instead of loops
- Use `include` for relations (avoid N+1 queries)
- Implement pagination for large datasets

### React Performance
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to children
- Implement virtualization for long lists (TanStack Virtual)
- Lazy load routes and heavy components
- Optimize images (WebP, responsive sizes)

### Bundle Size
- Tree-shake unused code
- Code-split large components
- Use dynamic imports for heavy dependencies
- Externalize Prisma packages
- Minimize vendor chunks

## Medical Content Guidelines

### Clinical Accuracy
- Always cite sources for medical content
- Use NCCPA PANCE Blueprint for categorization
- Validate drug information against FDA guidelines
- Cross-reference lab values with clinical standards
- Review content with medical professionals

### Question Quality
- Use realistic clinical vignettes
- Include distractors that test understanding
- Provide detailed explanations with references
- Tag questions with PANCE organ systems
- Implement difficulty levels (easy, medium, hard)

### Content Organization
- Use hierarchical condition taxonomy
- Link related conditions (differential diagnosis)
- Associate drugs with conditions
- Map lab findings to conditions
- Include imaging findings

## Deployment Checklist

Before deploying to production:
- [ ] Run `npm run typecheck` (no errors)
- [ ] Run `npm run lint` (no errors)
- [ ] Run `npm run build` (successful build)
- [ ] Run `npm test` (all tests pass)
- [ ] Run `npm run test:e2e` (critical flows pass)
- [ ] Verify environment variables in Cloudflare Dashboard
- [ ] Run database migrations (`npm run migrate:production`)
- [ ] Test API endpoints with production-like data
- [ ] Verify CSP headers in `public/_headers`
- [ ] Check Sentry for errors after deployment

## Common Mistakes to Avoid

1. **Using Node.js APIs in Functions**: Always use Web Standard APIs
2. **Forgetting Prisma Disconnect**: Always disconnect in `finally` blocks
3. **Static Medical Content**: Always load from database, never static files
4. **Missing Input Validation**: Always validate with Zod schemas
5. **Express Patterns in Functions**: Use `onRequest*` exports, not `(req, res)`
6. **Hardcoded Secrets**: Always use environment variables
7. **Missing Error Handling**: Always wrap database calls in try-catch
8. **Returning HTML Errors**: Always return JSON error responses
9. **Skipping Authentication**: Always verify Clerk tokens on protected routes
10. **Missing Rate Limiting**: Implement rate limiting on expensive endpoints

---

**Remember**: This is a medical education platform. Code quality, security, and clinical accuracy are paramount. When in doubt, ask for clarification rather than making assumptions about medical content or user data handling.
