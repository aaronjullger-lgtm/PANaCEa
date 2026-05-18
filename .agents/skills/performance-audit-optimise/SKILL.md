---
name: performance-audit-optimise
description: Use to audit and optimize performance across routes, bundle size, rendering, hydration, images, 3D components, API calls, and database queries. Trigger when the user mentions slow pages, heavy dashboards, poor Core Web Vitals, high latency, or performance bottlenecks.
---

1. Establish the performance scope and baseline. Measure or collect current metrics such as LCP, INP, CLS, TTFB, bundle size, route timing, API latency, and database query timing.
2. Inspect the framework, build output, dependency graph, route structure, client/server component boundaries, images, fonts, animation, 3D usage, and data-fetching patterns.
3. Identify large dependencies and unnecessary client code. Prefer removing unused libraries, dynamic imports, route-level splitting, server-side logic, and smaller alternatives that match project conventions.
4. Audit rendering and hydration. Move work server-side where appropriate, reduce repeated state derivation, prevent layout shifts, and avoid blocking work on initial render.
5. Optimize images and media. Use appropriate dimensions, responsive formats such as WebP or AVIF, framework image components when available, lazy loading, and explicit aspect ratios.
6. Treat heavy 3D or animation code as high risk. Dynamically import it, provide mobile fallbacks, respect reduced motion, and verify it does not block primary content.
7. Examine API calls and database queries. Add caching, pagination, batching, indexes, select lists, and request deduplication where supported and safe.
8. Implement small measurable improvements first. Avoid broad rewrites unless measurements show the current architecture is the bottleneck.
9. Run relevant verification: production build, bundle analyzer if configured, Lighthouse or browser profiling when available, API/database benchmarks, lint, typecheck, and tests.
10. Acceptance criteria: baseline and after metrics are recorded where practical, user-visible bottlenecks are reduced, correctness is preserved, and remaining bottlenecks are prioritized.
11. Finish with measured improvements, files changed, commands run, performance tradeoffs, and next recommended optimizations.
