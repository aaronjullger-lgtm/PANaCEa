# CSP and Prisma Module Resolution Fix

## Problem Statement

The application was experiencing two critical issues in production:

### 1. Content Security Policy Violations

```
Loading the script '<URL>' violates the following Content Security Policy directive:
"script-src 'none'". The policy is report-only, so the violation has been logged
but no further action has been taken.
```

### 2. Prisma Module Resolution Error

```
Uncaught TypeError: Failed to resolve module specifier ".prisma/client/edge".
Relative references must start with either "/", "./", or "../".
```

## Root Causes

### Browser-Side Prisma Imports

Several frontend files were attempting to import Prisma client, which:

1. Is a Node.js/Edge runtime library and cannot run in browsers
2. Caused Vite to bundle Prisma and its dependencies
3. Led to module resolution errors when the browser tried to load `.prisma/client/edge`

**Affected Files:**

- `src/lib/conditionSearch.ts` - Dynamic import on line 101
- `services/conditionDataLoader.ts` - Top-level import on line 8

### Prisma Extension in Bundle

The `@prisma/extension-accelerate` package was being bundled into `vendor-common.js`:

- Increased bundle size unnecessarily
- Included server-only code in browser bundles
- Created additional module resolution issues

## Solutions Implemented

### 1. Removed Database Queries from Browser Search

**File:** `src/lib/conditionSearch.ts`

**Before:**

```typescript
export async function searchConditions(...) {
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('../../lib/prisma'); // ❌ Browser import
      const dbResults = await prisma.medicalContent.findMany({...});
      // ... database query logic
    } catch (error) {
      console.error('Database search failed, falling back to registry:', error);
    }
  }
  // Fallback to registry search
}
```

**After:**

```typescript
export async function searchConditions(...) {
  // Skip database search in browser environment
  // Database queries should only run in server context (Node.js/Edge runtime)
  // The browser cannot and should not import Prisma client

  // Fallback to existing registry search
  const results: ConditionSearchResult[] = [];
  for (const meta of CONDITION_REGISTRY) {
    // ... registry-based search logic
  }
}
```

**Why:** Search functionality in the browser should use the pre-loaded condition registry, not database queries. Database access is for server-side operations only.

### 2. Protected Database Loader with Runtime Checks

**File:** `services/conditionDataLoader.ts`

**Before:**

```typescript
import { prisma } from '../lib/prisma'; // ❌ Top-level import

export async function loadConditionData(conditionId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  const record = await prisma.medicalContent.findUnique({...});
  // ...
}
```

**After:**

```typescript
// ✅ No top-level Prisma import

export async function loadConditionData(conditionId: string) {
  // Browser environment check
  if (typeof window !== 'undefined') {
    console.error('loadConditionData should not be called in browser');
    return null;
  }

  if (!process.env.DATABASE_URL) {
    return null;
  }

  // ✅ Dynamic import only in server context
  const { prisma } = await import('../lib/prisma');
  const record = await prisma.medicalContent.findUnique({...});
  // ...
}
```

**Why:**

- Top-level imports are always bundled by Vite, even if never used
- Dynamic imports + runtime checks ensure code only loads server-side
- Browser environment check provides immediate feedback if misused

### 3. Externalized Prisma Packages in Vite Config

**File:** `vite.config.ts`

**Added:**

```typescript
export default defineConfig(({ mode }) => {
  return {
    build: {
      rollupOptions: {
        external: [
          // Externalize Prisma packages - never bundle in browser
          '@prisma/client',
          '@prisma/client/edge',
          '.prisma/client',
          '.prisma/client/edge',
          '@prisma/extension-accelerate',
        ],
        output: {
          manualChunks: (id) => {
            // ... existing chunk configuration
          },
        },
      },
    },
  };
});
```

**Impact:**

- Prevented Vite from bundling Prisma packages
- Reduced `vendor-common.js` from 293.55 kB to 287.77 kB
- Eliminated @prisma/extension-accelerate from browser bundles

### 4. CSP Configuration (Already Correct)

**File:** `public/_headers`

The CSP was already correctly configured, but the issue was likely from:

- Cloudflare Pages default CSP being applied before deployment
- Preview environments using restrictive defaults
- Old deployments with `script-src 'none'`

**Current CSP:**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval'
    https://*.clerk.accounts.dev
    https://challenges.cloudflare.com
    https://static.cloudflareinsights.com
    https://aistudiocdn.com;
  worker-src 'self' blob:;
  ... (complete policy)
```

**Allows:**

- ✅ Application scripts (`'self'`)
- ✅ Clerk authentication
- ✅ Cloudflare infrastructure
- ✅ React 19 from aistudiocdn.com
- ✅ Service workers (`blob:`)

## Build Verification

### Before Fixes

```bash
$ npm run build
# Warning: ".prisma/client/edge" is imported but could not be resolved
# vendor-common.js: 293.55 kB
# Multiple files with Prisma references
```

### After Fixes

```bash
$ npm run build
✓ built in 6.31s
# vendor-common.js: 287.77 kB ✅ (reduced size)
# No Prisma warnings ✅
# prisma-*.js chunk created but not loaded in browser ✅
```

### Bundle Analysis

```bash
# Check for Prisma in main bundles
$ grep -r "\.prisma\|@prisma" dist/assets/*.js | grep -v "prisma-"
# No matches ✅

# Check main index bundle
$ grep "import.*prisma" dist/assets/index-*.js
# No matches ✅
```

## Testing Recommendations

### 1. Manual Testing

1. **Deploy to Cloudflare Pages**
   - Verify `_headers` file is present in deployment
   - Check browser console for CSP violations
   - Confirm no module resolution errors

2. **Test Search Functionality**
   - Use command palette (Cmd+K / Ctrl+K)
   - Search for conditions and drugs
   - Verify results appear without errors

3. **Test Condition Pages**
   - Navigate to individual condition pages
   - Server-side data loading should work
   - No browser errors related to Prisma

### 2. Browser DevTools Checks

```javascript
// Open browser console
// Check for errors:
typeof window !== 'undefined'; // Should be true in browser
// No errors about .prisma/client/edge
// No CSP violations about script-src 'none'
```

### 3. Network Tab

- Verify no requests for `.prisma/` resources
- Check CSP headers in response headers
- Confirm `_headers` file is being served

## Architecture Guidelines

### Server-Only Code (Node.js/Edge Runtime)

Use Prisma, database queries, and server-side logic:

- ✅ `server.ts` - Express server
- ✅ `functions/` - Cloudflare Functions
- ✅ API routes and serverless functions
- ✅ Build scripts (e.g., `scripts/`)

### Browser Code (React/Frontend)

Use pre-loaded data and registries:

- ✅ `components/` - React components
- ✅ `src/` - Frontend services and utilities
- ✅ `services/` - Client-side logic (with runtime checks if shared)
- ❌ Never import Prisma directly
- ❌ Never import `lib/prisma.ts` or `lib/db.ts`

### Shared Code (Hybrid)

If code must work in both environments:

1. Add runtime environment check: `typeof window !== 'undefined'`
2. Use dynamic imports for server-only dependencies
3. Provide fallback behavior for browser environment

**Example:**

```typescript
export async function loadData(id: string) {
  // Browser: use registry
  if (typeof window !== 'undefined') {
    return REGISTRY.find((item) => item.id === id);
  }

  // Server: use database
  const { prisma } = await import('../lib/prisma');
  return await prisma.table.findUnique({ where: { id } });
}
```

## Future Improvements

### 1. Remove 'unsafe-inline' and 'unsafe-eval'

- Generate nonces for inline scripts
- Replace libraries using `eval()`
- Use `strict-dynamic` for better security

### 2. Add CSP Reporting

```
Content-Security-Policy-Report-Only: ... report-uri /csp-report
```

- Monitor violations in production
- Tighten policy based on real usage

### 3. Implement Subresource Integrity (SRI)

```html
<script src="https://example.com/script.js" integrity="sha384-..." crossorigin="anonymous"></script>
```

### 4. Consider Server-Side Search

If database search is needed:

- Create API endpoint: `/api/search`
- Frontend calls API instead of direct database access
- Proper separation of concerns

## Deployment Checklist

- [x] Fix Prisma imports in browser code
- [x] Add runtime environment checks
- [x] Externalize Prisma in Vite config
- [x] Verify `_headers` file in dist
- [x] Test build output for Prisma references
- [ ] Deploy to Cloudflare Pages
- [ ] Verify CSP headers in production
- [ ] Test all search functionality
- [ ] Monitor browser console for errors
- [ ] Check Network tab for unexpected requests

## Summary

The issues were caused by attempting to use server-side database code (Prisma) in browser bundles. The fixes ensure a clean separation:

**Browser:**

- Uses condition registry for searches
- No Prisma code loaded or executed
- Fast, client-side search functionality

**Server:**

- Uses Prisma for database queries
- Loads data from Supabase
- Powers API endpoints and serverless functions

**CSP:**

- Properly configured in `_headers`
- Allows all necessary scripts
- Blocks unauthorized sources

The application now builds cleanly, with no Prisma code in browser bundles, and proper CSP headers that allow all legitimate scripts while maintaining security.
