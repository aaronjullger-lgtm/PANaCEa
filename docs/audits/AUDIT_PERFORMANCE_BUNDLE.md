# Audit 13 — Performance, Bundle Size & Load-Time Profiling

**Date:** 2026-04-02
**Auditor perspective:** Senior full-stack engineer, production readiness review
**Scope:** Vite bundle analysis, code-splitting effectiveness, heavy dependency impact (Framer Motion, Recharts, Lucide), TanStack Query cache tuning, API waterfall patterns, image optimization, Tailwind safelist bloat, critical-path load budget
**Methodology:** Prior production build artifact analysis (`dist/assets/`), dependency graph tracing, import counting, gzip estimation, static code analysis of Vite config and TanStack Query setup

---

## Executive Summary

PANaCEa's bundle architecture is **well-structured but carrying significant dead weight**. The Vite config has thoughtful manual chunk splitting (7 named vendor groups, 7 large-component splits) and 87 lazy-loaded components via `config/lazyComponents.tsx`. However, the **critical path is bloated by a 2.0 MB vendor chunk** (598 KB gzipped), **40 MB of unreferenced Gemini-generated images** in `public/`, a **210 KB CSS file inflated by 140+ Tailwind safelist entries**, and Framer Motion imported in **308 source files** without `LazyMotion` optimization. The 71 production dependencies include libraries that are either unused on the frontend (`googleapis`, `bcrypt`, `express`) or could be lazy-loaded (`@sentry/react`, `canvas-confetti`).

**Severity breakdown:** 3 High, 6 Medium, 6 Low
**Blocks production:** None (performance-only)
**Estimated user impact:** 1–3 second reduction in initial load on 3G/slow 4G achievable through the top 3 fixes

---

## Bundle Size Overview (Prior Production Build)

### Critical Path (Initial Page Load)

| Asset | Raw Size | Gzipped (est.) | Contents |
|---|---|---|---|
| `vendor.js` | **2.0 MB** | **598 KB** | React, ReactDOM, react-router, TanStack Query, Sentry, react-markdown, supabase-js, sonner, papaparse, canvas-confetti, clsx, tailwind-merge, idb-keyval, and all other node_modules not in named chunks |
| `index.js` | 166 KB | 45 KB | App entry, providers, routing shell, eager imports (NavRail, AppBrand, DrillViewRouter) |
| `vendor-ui.js` | 160 KB | 42 KB | Framer Motion + Lucide React |
| `vendor-auth.js` | 72 KB | ~20 KB | Clerk authentication |
| `index.css` | 210 KB | 31 KB | All Tailwind + custom styles |
| `vendor-state.js` | 18 KB | ~5 KB | Zustand, date-fns, immer |
| **Total critical path** | **~2.6 MB** | **~741 KB** | |

### Full Bundle

| Metric | Value |
|---|---|
| Total JS chunks | 109 |
| Total JS size | 6.3 MB |
| Total CSS size | 224 KB |
| Total `dist/` | 53 MB (includes SW, source maps, HTML) |
| Largest lazy chunk | `component-enhancedsettingstab.js` (537 KB) |

---

## Findings

### Finding 13-1: 40 MB of Unreferenced Gemini-Generated Images in public/
**Severity:** High | **Type:** Static asset bloat | **Blocks production:** No

**Files:** 9 `Gemini_Generated_Image_*.png` files ranging from 672 KB to 5.9 MB each, totaling **40 MB**. Plus `HEADER V1.png` (512 KB) and `file (2).svg` — both also unreferenced.

**Verification:** Every Gemini-generated image was grep-verified to have **zero references** across all `.tsx`, `.ts`, `.html`, and `.css` files. They are dead assets.

**Impact:** These are served by Cloudflare Pages as static assets. While not included in JS bundles, they inflate:
- Git clone size permanently (binary blobs in history)
- Cloudflare Pages deployment upload time
- PWA service worker precache if globbed (the workbox config includes `**/*.png`)
- The `public/` directory is 41 MB total — 40 MB is dead images

**Fix:** Delete all 9 `Gemini_Generated_Image_*.png`, `HEADER V1.png`, and `file (2).svg`. Add `Gemini_Generated_Image_*` to `.gitignore`. Consider BFG Repo Cleaner to purge from git history if clone size matters.

---

### Finding 13-2: 2.0 MB Vendor Chunk Contains Libraries That Should Be Split or Lazy-Loaded
**Severity:** High | **Type:** Bundle bloat | **Blocks production:** No

**Details:** The catch-all `vendor.js` chunk contains every `node_modules` package not explicitly named in `manualChunks`. Key bloat contributors:

| Library | Estimated minified size | Usage | Should be |
|---|---|---|---|
| `@sentry/react` | ~100 KB+ | `lib/monitoring/sentry.ts` already dynamic-imports it; but `lib/utils/errorHandlingUtils.ts` has a **static** `import * as Sentry from '@sentry/react'` | Fix static import → dynamic, or split chunk |
| `react-markdown` + remark + rehype | ~100 KB+ | Used only in ExplanationPanel, knowledge base | Lazy-loaded chunk |
| `@supabase/supabase-js` | ~90 KB+ | Only `hooks/useSupabase.ts` + scripts | Lazy-loaded or removed from frontend bundle |
| `canvas-confetti` | ~30 KB | Celebration animations only | Lazy-loaded chunk |
| `papaparse` | ~50 KB | CSV processing — rarely used in main flow | Lazy-loaded chunk |

**Root cause:** The `manualChunks` function only names 5 vendor groups (charting, vendor-ui, vendor-state, vendor-auth, vendor-validation). Everything else falls into the catch-all `return 'vendor'`. Libraries used by only one lazy route still get pulled into the eagerly-loaded vendor chunk.

**Fix:**
1. **Immediate:** Fix the static Sentry import in `errorHandlingUtils.ts` — change to dynamic `import()` to match the pattern already used in `lib/monitoring/sentry.ts`
2. **Add manualChunks entries:** `react-markdown` + remark → `'vendor-markdown'`, `@supabase` → `'vendor-supabase'`, or better yet, return `undefined` for these so Rollup co-locates them with their lazy consumer (same pattern already used for `cytoscape` and `jspdf`)
3. **Remove from frontend bundle entirely:** `googleapis`, `bcrypt`, `express`, `nodemailer`, `csv-parse`, `ws`, `ioredis`, `svix` are all backend-only — they shouldn't be in `dependencies` if Prisma exclusion is the only tree-shaking guard

---

### Finding 13-3: 71 Production Dependencies Include ~15 Backend-Only Packages
**Severity:** High | **Type:** Dependency hygiene | **Blocks production:** No

**Backend-only packages in `dependencies` (not `devDependencies`):**

| Package | Purpose | Frontend impact |
|---|---|---|
| `@clerk/backend` | Server-side Clerk SDK | Should be devDep or in functions/ only |
| `@prisma/client`, `@prisma/extension-accelerate`, `prisma` | ORM | Stubbed by prismaExcludePlugin, but adds install time |
| `bcrypt` | Password hashing | Node.js only |
| `cors`, `express`, `express-rate-limit`, `helmet` | Express server | Local dev only |
| `googleapis` | Google APIs | Scripts only |
| `nodemailer` | Email sending | Server only |
| `csv-parse` | CSV parsing | Scripts only |
| `ws` | WebSocket server | Server only |
| `ioredis` | Redis client | Server only |
| `svix` | Webhook verification | Server only |
| `pdf-parse` | PDF extraction | Scripts only |
| `dotenv` | Env loading | Build-time only |

**Impact:** Vite's tree-shaking and the prismaExcludePlugin prevent most of these from entering the bundle. However, having them in `dependencies` means:
- `npm install` downloads and builds native addons (bcrypt, sharp) on every CI run
- Any accidental frontend import would pull in Node.js code
- Inflated `node_modules` (~200 MB larger than necessary)

**Fix:** Move backend-only packages to `devDependencies`. For Cloudflare Functions, use a separate `package.json` in `functions/` or list them under a functions-specific dependency group.

---

### Finding 13-4: Framer Motion in 308 Files Without LazyMotion Optimization
**Severity:** Medium | **Type:** Bundle + runtime performance | **Blocks production:** No

**Metrics:**
- 308 source files import from `framer-motion`
- 1,915 `motion.*` element usages
- 592 `AnimatePresence` usages
- `LazyMotion` / `domAnimation` pattern: **not used anywhere**

**Details:** Framer Motion's `LazyMotion` feature lets you load only the animation features actually used, reducing its contribution from ~30 KB (gzipped) to ~5 KB for basic animations. Currently, the full Framer Motion bundle is loaded.

**Positive note:** The codebase does check `useReducedMotion()` in several UI components (TrustBadge, GlassCard, ErrorState), which is good for accessibility. But this is only in ~10 files out of 308.

**Impact:** vendor-ui.js is 160 KB raw (42 KB gzip). With `LazyMotion` + `domAnimation`, this could drop to ~80 KB raw (~20 KB gzip) for most routes.

**Fix:**
1. Wrap `AppProviders` with `<LazyMotion features={domAnimation} strict>`
2. Replace `motion.div` with `m.div` in components (the lazy-compatible alias)
3. Only load `domMax` (full features) for routes that need layout animations or drag

---

### Finding 13-5: Tailwind Safelist Has 140+ Entries Including 3 Regex Patterns
**Severity:** Medium | **Type:** CSS bloat | **Blocks production:** No

**Details:** `tailwind.config.js` safelist contains:
- ~137 explicit class strings (e.g., `'bg-purple-50'`, `'from-indigo-600'`)
- 3 regex patterns generating combinatorial classes: `bg-data-*/{5..90}`, `border-data-*/{5..90}`, `text-data-*/{5..90}` — each pattern expands to ~77 classes (7 colors × 11 opacities) = **231 regex-generated classes**
- Total safelisted: ~370 classes that bypass tree-shaking

**Impact:** The CSS file is 210 KB raw (31 KB gzip). While the gzipped size is acceptable, the safelist forces Tailwind to include classes that may never be used, bypassing the purge step entirely. The 3 regex patterns alone generate 231 classes for data color opacity variants that may or may not all be used.

**Fix:**
1. Audit which safelisted classes are actually used: `grep -r "bg-data-fail/50"` etc.
2. Replace regex patterns with explicit lists of only the opacity values actually used
3. Move gradient classes (`from-purple-*`, `to-indigo-*`) out of safelist — they should be detectable by Tailwind's content scanner if they're in `.tsx` files
4. Consider extracting semantic color compositions into CSS custom properties instead of using Tailwind opacity modifiers

---

### Finding 13-6: Sentry Dual-Import — Lazy in One File, Eager in Another
**Severity:** Medium | **Type:** Bundle bloat | **Blocks production:** No

**Files:**
- `lib/monitoring/sentry.ts` — **Correctly** uses `await import('@sentry/react')` (dynamic, lazy)
- `lib/utils/errorHandlingUtils.ts` — **Statically** imports `import * as Sentry from '@sentry/react'` (eager, forces into vendor.js)

**Impact:** The static import in `errorHandlingUtils.ts` defeats the lazy-loading strategy in `sentry.ts`. Sentry's entire SDK (~100 KB+ minified) is pulled into the vendor chunk regardless of whether the DSN is configured.

**Fix:** Change `errorHandlingUtils.ts` to use the lazy Sentry instance from `lib/monitoring/sentry.ts`, or convert its import to dynamic: `const Sentry = await import('@sentry/react')`.

---

### Finding 13-7: EnhancedSettingsTab Chunk Is 537 KB — Largest Lazy Chunk
**Severity:** Medium | **Type:** Chunk bloat | **Blocks production:** No

**Details:** `component-enhancedsettingstab.js` at 537 KB is the single largest lazy chunk, nearly as large as the entire charting library (284 KB). Settings pages typically don't need this much code.

**Likely cause:** The settings tab probably imports heavy sub-dependencies (charting for stats display, data export with jspdf, etc.) that get co-bundled rather than remaining in their own lazy chunks.

**Fix:** Analyze what's inside this chunk (use `npx vite-bundle-visualizer` or `rollup-plugin-visualizer`). Split heavy sub-features of settings into their own lazy-loaded tabs.

---

### Finding 13-8: 306 Unique Lucide Icons Imported Across 401 Files
**Severity:** Medium | **Type:** Bundle awareness | **Blocks production:** No

**Details:** 306 unique icon names are imported from `lucide-react` across 401 source files. The Vite config already handles this well:
- `resolve.alias` points to `lucide-react/dist/esm/lucide-react.js` for tree-shaking
- `lucide-react` is excluded from `optimizeDeps` to avoid prebundling the full set
- `treeshake.moduleSideEffects` marks it as side-effect-free

**However:** 306 icons is a lot. Each icon is ~1 KB minified. Even with tree-shaking, that's ~300 KB of icon SVG data in `vendor-ui.js`.

**Fix:** Low priority given existing optimizations. For further gains:
1. Audit if all 306 icons are actually rendered (some may be imported but unused)
2. Consider replacing the most common icons (used in 50+ files) with inline SVG to avoid the import overhead
3. Monitor vendor-ui chunk size over time as more icons are added

---

### Finding 13-9: No `LazyMotion` + Eagerly Imported motion in AppRoutes.tsx
**Severity:** Medium | **Type:** Critical path inflation | **Blocks production:** No

**Details:** `config/AppRoutes.tsx` (the routing shell that loads on every page) eagerly imports:
```typescript
import { motion, AnimatePresence } from 'framer-motion';
```
This means Framer Motion is on the critical path for **every single page load**, even pages that don't animate. Additionally, AppRoutes eagerly imports:
- `NavRail` (463 lines)
- `DrillViewRouter` (483 lines)
- `AppBrand` (97 lines)
- 5 Lucide icons
- `BehavioralTrackerProvider`, `PerformanceMonitor`, etc.

**Impact:** The routing shell pulls in ~1,000 lines of eagerly-loaded component code plus Framer Motion, all blocking first render.

**Fix:**
1. Remove `motion`/`AnimatePresence` from AppRoutes if page transitions can be deferred
2. Consider lazy-loading `NavRail` and `DrillViewRouter` (they're layout components, but not needed for the very first paint)
3. Wrap page transitions in `React.startTransition` to avoid blocking

---

### Finding 13-10: TanStack Query Config Is Reasonable but refetchOnWindowFocus Adds Unnecessary Fetches
**Severity:** Low | **Type:** Performance tuning | **Blocks production:** No

**Details:** Global QueryClient config:
- `staleTime: 2 minutes` — reasonable for SRS data
- `gcTime: 24 hours` — good for offline PWA support
- `retry: 1` — appropriate
- `refetchOnWindowFocus: true` — **fires API requests every time the user tabs back**

**Impact:** For a study app where students frequently switch between PANaCEa and reference materials, `refetchOnWindowFocus: true` generates unnecessary API calls on every tab switch. With a 2-minute staleTime, data fetched 30 seconds ago would be refetched on window focus.

**Fix:** Set `refetchOnWindowFocus: false` globally, or set it to `'always'` only for the due-queue hook where freshness matters. The 2-minute staleTime already handles staleness.

---

### Finding 13-11: PWA Workbox Precaches All PNG/JPG — Including 40 MB Dead Images
**Severity:** Low | **Type:** Service worker bloat | **Blocks production:** No

**Details:** Workbox config:
```javascript
globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
maximumFileSizeToCacheInBytes: 8 * 1024 * 1024 // 8MB
```
This will attempt to precache every `.png` in `dist/`, including any that survive from `public/`. The 8 MB limit per file would exclude the largest Gemini images, but several (672 KB, 1 MB) would be cached. Combined with runtime caching for images (`CacheFirst`, 30-day, 100 entries), the service worker cache can grow very large.

**Fix:** After deleting dead images (Finding 13-1), narrow `globPatterns` to exclude image files and rely solely on runtime caching for images: `['**/*.{js,css,html,ico,json}']`.

---

### Finding 13-12: `components/modes/index.ts` Barrel Export Risks Bundle Leakage
**Severity:** Low | **Type:** Tree-shaking risk | **Blocks production:** No

**Details:** `components/modes/index.ts` re-exports 14 mode components. In `lazyComponents.tsx`, some modes are imported via the barrel:
```typescript
export const CramMode = lazy(() =>
  import('../components/modes').then((m) => ({ default: m.CramMode }))
);
```
While Rollup can theoretically tree-shake barrel re-exports, dynamic imports through a barrel are less reliable for tree-shaking than direct file imports. If Rollup fails to tree-shake, loading `CramMode` would pull in all 14 mode components.

**Current mitigation:** The build output shows separate chunks for each mode (e.g., `GrandRoundsMode-Cx4WZbku.js` at 28 KB), suggesting tree-shaking is currently working.

**Fix:** Monitor. If any mode chunk grows unexpectedly, switch barrel imports to direct file imports: `import('../components/modes/CramMode')`.

---

### Finding 13-13: No Bundle Size CI Gate / Lighthouse CI
**Severity:** Low | **Type:** Missing safeguard | **Blocks production:** No

**Details:** There's no automated check in CI that would catch bundle size regressions. The existing `initialLoadOptimizer.ts` defines performance budgets (`maxBundleSize: 500KB`) but these are runtime checks, not build-time gates. No `bundlesize`, `size-limit`, or Lighthouse CI configuration exists.

**Impact:** A developer could accidentally import a heavy library eagerly (as happened with Sentry in errorHandlingUtils.ts) and it would go unnoticed until users report slow loads.

**Fix:**
1. Add `size-limit` to CI: `npm install --save-dev size-limit @size-limit/preset-app` with limits on critical-path chunks
2. Add Lighthouse CI for Core Web Vitals regression detection
3. Add `vite-plugin-visualizer` to build for on-demand bundle analysis

---

### Finding 13-14: App.tsx Eagerly Imports Service Functions That May Not Be Needed
**Severity:** Low | **Type:** Critical path inflation | **Blocks production:** No

**Details:** `App.tsx` eagerly imports:
```typescript
import { getQuestionBatch } from './services/questionService';
import { initializeSession, fetchSessionQuestions, prefetchQuestions } from './services/core';
import { inferTaskType } from './lib/taskTypes';
import { preloadData } from './lib/utils/dataLoader';
```
These are session-start functions that aren't needed until the user actually starts a study session. On the landing page or dashboard, they're dead weight.

**Fix:** Move these imports into the callbacks that use them, or use dynamic imports: `const { initializeSession } = await import('./services/core')`.

---

### Finding 13-15: ECG Images in public/images/ Are Tiny JPEGs (4 KB Each) but Not WebP
**Severity:** Low | **Type:** Best practice | **Blocks production:** No

**Details:** 6 ECG strip images in `public/images/` are each ~4 KB JPEG. These are clinical training images referenced by the ECG drill. They're already well-optimized for size.

**Non-issue but note:** These could be converted to WebP for ~25% savings, but at 4 KB each, the savings (1 KB per image) doesn't justify the effort. More important is ensuring they have appropriate `alt` text for accessibility and `loading="lazy"` attributes.

---

## Top 10 Findings by Impact

| Rank | Finding | Severity | Estimated Savings |
|---|---|---|---|
| 1 | 13-1: 40 MB dead Gemini images in public/ | High | 40 MB off deploy, git history |
| 2 | 13-2: 2 MB vendor chunk with splittable libraries | High | ~200–400 KB off critical path |
| 3 | 13-3: 15 backend-only packages in dependencies | High | Faster CI, smaller node_modules |
| 4 | 13-6: Sentry static import defeats lazy strategy | Medium | ~100 KB off vendor.js |
| 5 | 13-4: Framer Motion in 308 files without LazyMotion | Medium | ~80 KB off vendor-ui.js |
| 6 | 13-9: motion/AnimatePresence eager in AppRoutes | Medium | Faster first render |
| 7 | 13-5: 370 safelisted Tailwind classes | Medium | ~30–50 KB off CSS |
| 8 | 13-7: 537 KB EnhancedSettingsTab chunk | Medium | Better lazy-load granularity |
| 9 | 13-13: No bundle size CI gate | Low | Prevents future regressions |
| 10 | 13-10: refetchOnWindowFocus on every tab switch | Low | Fewer unnecessary API calls |

---

## 3 Highest-Leverage Fixes

### Fix 1: Delete Dead Images + Fix PWA Precache (Findings 13-1, 13-11)
**Effort:** 30 minutes | **Impact:** 40 MB off deployments, cleaner service worker cache

1. Delete all 9 `Gemini_Generated_Image_*.png`, `HEADER V1.png`, `file (2).svg` from `public/`
2. Add `Gemini_Generated_Image_*` to `.gitignore`
3. Update workbox `globPatterns` to exclude images: `['**/*.{js,css,html,ico,json}']`
4. Verify ECG images in `public/images/` are still referenced and working

### Fix 2: Split Vendor Chunk + Fix Sentry Dual-Import (Findings 13-2, 13-6)
**Effort:** 2 hours | **Impact:** ~200–400 KB off critical path vendor.js

1. Fix `lib/utils/errorHandlingUtils.ts`: change `import * as Sentry from '@sentry/react'` to dynamic import via the existing `lib/monitoring/sentry.ts` wrapper
2. Add `undefined` returns in `manualChunks` for `react-markdown`, `@supabase`, `canvas-confetti`, `papaparse` — same pattern used for cytoscape/jspdf — so they co-locate with their lazy consumer
3. Move backend-only packages to `devDependencies`: `bcrypt`, `express`, `cors`, `helmet`, `express-rate-limit`, `googleapis`, `nodemailer`, `csv-parse`, `ws`, `ioredis`, `svix`, `pdf-parse`, `dotenv`
4. Run build and verify vendor.js drops below 1.5 MB

### Fix 3: Adopt LazyMotion + Defer Eager Imports in AppRoutes (Findings 13-4, 13-9, 13-14)
**Effort:** 4 hours | **Impact:** ~80 KB off vendor-ui.js, faster first render

1. Install nothing — `LazyMotion` is included in `framer-motion`
2. Add `<LazyMotion features={domAnimation}>` wrapper in `AppProviders`
3. In AppRoutes.tsx, replace `import { motion, AnimatePresence } from 'framer-motion'` with `import { m, AnimatePresence } from 'framer-motion'` and use `m.div` instead of `motion.div`
4. Migrate high-traffic components (DrillShell, GlassCard, EmptyState) to `m.*` syntax
5. In App.tsx, move `getQuestionBatch`, `initializeSession`, `fetchSessionQuestions`, `prefetchQuestions` into dynamic imports inside their respective callbacks

---

## Minimal Safe Implementation Plan

### Day 1: Dead Asset Cleanup + Sentry Fix (1 hour)
1. Delete dead images from `public/`
2. Fix Sentry dual-import in `errorHandlingUtils.ts`
3. Update workbox `globPatterns`
4. Run `npm run build` to verify no breakage
5. Commit: "perf: remove 40MB dead images, fix Sentry eager import"

### Day 2: Vendor Chunk Splitting + Dependency Cleanup (3 hours)
1. Update `manualChunks` — return `undefined` for `react-markdown`, `@supabase`, `canvas-confetti`, `papaparse`
2. Move 13 backend-only packages from `dependencies` to `devDependencies`
3. Run `npm install` to verify nothing breaks
4. Run `npm run build` — verify vendor.js < 1.5 MB
5. Run full test suite
6. Commit: "perf: split vendor chunk, move backend deps to devDependencies"

### Day 3: LazyMotion Adoption + Eager Import Cleanup (4 hours)
1. Add `<LazyMotion features={domAnimation}>` to AppProviders
2. Convert AppRoutes.tsx and 10 highest-traffic components to `m.*` syntax
3. Move session-start imports in App.tsx to dynamic imports
4. Run full test suite + visual regression check on key pages
5. Commit: "perf: adopt LazyMotion, defer eager imports in routing shell"

### Day 4: Safeguards (2 hours)
1. Install `size-limit` and configure budgets for vendor.js (< 1.5 MB), vendor-ui.js (< 100 KB), index.js (< 200 KB)
2. Add to CI pipeline (`npm run size-limit`)
3. Audit Tailwind safelist — remove unused entries, replace regex patterns with explicit lists
4. Commit: "ci: add bundle size limits, trim Tailwind safelist"

---

## What to Audit Next

**Audit 14 — Authentication, Authorization & Security Posture** should examine:
- Clerk token validation in every Edge Function endpoint (are any unprotected?)
- Rate limiting on sensitive endpoints (submit-review, attempt, AI generation)
- Input validation/sanitization on all API endpoints (zod schemas vs raw body parsing)
- CORS configuration in production (Cloudflare Pages headers)
- Environment variable exposure (are any secrets in client-side VITE_* vars?)
- Content Security Policy headers
- Prisma query injection risks (raw SQL usage)
- JWT expiration and refresh patterns
- Admin route protection (server-side, not just client-side route guards)

This would address the highest-risk category that hasn't been covered in audits 1–13: security vulnerabilities that could affect production users and data integrity.

---

*Report generated from analysis of prior production build artifacts in `dist/assets/`, dependency graph tracing, and static code analysis. Bundle sizes reflect the most recent successful build (2026-04-02). Gzip estimates calculated with `gzip -c` on actual build output.*
