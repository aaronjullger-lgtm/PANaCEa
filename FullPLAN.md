# PANaCEa full-stack audit: architecture to implementation roadmap

**PANaCEa is an ambitious medical education platform with strong architectural vision but significant gaps between its manifesto and implementation maturity.** The codebase at v1.2.0 carries enterprise-grade complexity — 28+ API endpoint groups, FSRS v6 with 21-parameter optimization, CRPL cognitive telemetry, Chain of Verification AI pipelines — inside what the architecture document itself describes as evolving from a "flashcard app" to a "cognitive prosthetic." This audit reveals a pattern common in solo-developer projects: the architectural aspirations outpace the engineering discipline needed to sustain them. Scattered AI endpoint directories, duplicate folder names, inconsistent test organization, and the absence of centralized state management all signal a codebase that grew organically rather than being refactored iteratively. The good news: the technology choices (Cloudflare Pages + Hono + Prisma Accelerate + Vite + ts-fsrs) are genuinely modern and well-suited to the problem, and the clinical safety thinking (CoVe pipeline, citation enforcement) shows admirable domain awareness.

---

## Part 1 — The ten-dimension audit

### 1. Architecture scores high on vision, low on consistency

The "Split-Brain" compute model — Prisma Accelerate on the edge for data access, client-side WASM for FSRS gradient descent — is a clever solution to Cloudflare's **10–50ms CPU limits**. Hono as the API framework (confirmed by router implementations in `node_modules`) was an excellent choice for edge deployment. The folder structure follows domain-driven organization on both frontend and backend.

However, the implementation reveals structural debt. The `functions/api/` directory contains **28 distinct endpoint groups**, including duplicates: both `drill/` and `drills/` exist, as do `dashboard/` and `ProgressDashboard/` on the component side. AI logic is scattered across four separate directories (`ai/`, `gemini/`, `intelligence/`, `vision/`) with no clear boundary between them. The `_shared/` utilities folder contains tests (good), but the relationship between shared code and feature-specific code lacks a visible service layer abstraction. The `node_modules/` directory was uploaded to Google Drive — an indicator of backup methodology rather than proper version control hygiene. No `.github/` workflows directory was found, raising questions about CI/CD maturity.

**Key files needing attention:** `functions/api/ai/`, `functions/api/gemini/`, `functions/api/intelligence/` (consolidate into one), `functions/api/drill/` vs `functions/api/drills/` (deduplicate), `functions/api/debug/` (remove or gate behind feature flags).

### 2. React frontend has good bones but needs pruning

The component tree spans **23+ top-level directories** organized by domain — `session/`, `dashboard/`, `drill/`, `quiz/`, `analytics/`, `library/`, `auth/`, `modes/`, `achievements/`, `Goals/`, and more. Multiple `hooks/` folders co-located with their components suggests the team correctly chose co-location over centralization for custom hooks.

The problems are naming inconsistency (PascalCase `ProgressDashboard/` and `Goals/` alongside lowercase `custom-study/` and `charts/`), apparent functional overlap (separate `dashboard/` and `ProgressDashboard/` component directories), and **no evidence of centralized state management**. For an application with this many interacting subsystems — live drill sessions, SRS scheduling state, analytics, achievement tracking, CRPL telemetry — the absence of Zustand, Jotai, or even well-structured React Context will produce prop-drilling and stale-state bugs. The `loading/` and `error/` component directories suggest some attention to UI states, but there is no evidence of a systematic error boundary strategy or skeleton loading patterns.

**Key files needing attention:** All 23+ component directories need a naming convention audit. `components/dashboard/` and `components/ProgressDashboard/` should merge. A `/store` or `/state` directory should be created for shared application state.

### 3. API surface is feature-rich but overly fragmented

The Cloudflare Pages Functions backend uses file-based routing through Hono, with endpoint groups for `srs/`, `reviews/`, `questions/`, `drills/`, `analytics/`, `dashboard/`, `user/`, `webhooks/`, `cron/`, `admin/`, `knowledge/`, `study/`, `ai/`, `osce/`, `lecture/`, `drugs/`, `reference/`, `push/`, `library/`, `content/`, `study-path/`, `mapping-enrichment/`, `authors/`, and `debug/`.

**Debug endpoints in production** (`debug/` folder last modified April 6) is a security concern — these should be behind `NODE_ENV` checks or removed entirely. The `_shared/` directory with its `__tests__/` subfolder confirms shared middleware exists, but there is no visible pattern for consistent auth middleware application across all 28+ endpoint groups. The `webhooks/` directory (for Clerk) and `cron/` directory suggest webhook signature verification and scheduled task patterns are present, but their implementation quality could not be verified through folder structure alone.

Rate limiting is a critical gap. Cloudflare offers native rate-limiting primitives, but there is no evidence of their use. For an AI-integrated app calling Gemini APIs, this is both a cost risk and a security vulnerability.

### 4. Database design follows the manifesto but needs RLS

The architecture mandates PostgreSQL as the "only source of truth" with **zero static JSON files** for content. Key tables include `MedicalContent`, `Question`, `UserProgress` (with `fsrsParams` JSONB column), and `ReviewLog`. Prisma Accelerate provides edge-compatible database access with connection pooling and caching.

The `npx prisma generate --no-engine` command for edge client generation is a non-standard workflow that requires documentation and team knowledge. No evidence of Row Level Security (RLS) policies was found — critical for a medical education platform where user data isolation is essential. The `mapping-enrichment/` endpoint suggests some data normalization pipeline exists, but migration hygiene (versioned, reviewed, reversible migrations) could not be verified.

**Key improvement areas:** Implement RLS using Prisma Client Extensions (see reference repos below). Add audit logging for all data mutations. Document the edge client generation workflow.

### 5. AI integration is architecturally sophisticated but fragmented

The **Chain of Verification (CoVe) pipeline** — Draft → Plan → Verify → Refine — is genuinely impressive for a medical education context. Citation enforcement with inline `[Source ID]` references linking to `MedicalContent` entries demonstrates serious thought about clinical accuracy. The architecture envisions cross-checking generated content against the 2025 PANCE Blueprint.

The fragmentation concern is severe: four separate directories handle AI — `functions/api/ai/` for general generation, `functions/api/gemini/` for direct Gemini calls, `functions/api/intelligence/` for AI-powered features, and `functions/api/vision/` for image AI. Each of these was recently modified (April 6-7), suggesting active development across all four. This fragmentation likely means **duplicated Gemini client initialization, inconsistent error handling, and scattered prompt templates**. A unified AI service layer with model routing, shared prompt templates, structured output validation (Zod), and centralized cost tracking would dramatically improve maintainability.

No evidence of streaming responses, model fallback chains, or response caching was visible in the folder structure — all are standard practices for production AI integrations.

### 6. FSRS implementation targets the bleeding edge

PANaCEa targets **FSRS v6 with 21 parameters** (the latest algorithm version from the open-spaced-repetition project). The architecture specifies the exact parameter array, the short-term stability formula (`S' = S · e^{w17·(G-3+w18)} · S^{-w19}`), and the power-law retrievability curve (`R(t,S) = (1 + t/9S)^{-w20}`). The WASM optimization pathway — client fetches `ReviewLog` data via API, passes to `fsrs-browser` WASM worker, sends optimized parameters back — is the correct architecture for edge-constrained environments.

The **CRPL telemetry system** (hesitation mapping, flight time measurement, rapid-guessing filters) adds real pedagogical value by measuring cognitive state rather than just duration. However, the rapid-guessing filter (duration < 3000ms → rating=0) could incorrectly penalize expert users who legitimately answer clinical vignettes quickly.

**Critical concern:** The architecture manifesto (dated January 22, 2026) instructs "rewrite `fsrs.ts` to match v6 spec entirely," implying the existing implementation was outdated at that time. Whether this rewrite was completed in the subsequent ~10 weeks is unclear. The `srs/` backend folder was modified as recently as April 6, suggesting active work.

**Key files needing attention:** `services/optimizer/fsrsWasm.ts` (verify WASM bindings), `functions/api/srs/` (verify v6 formulas), CRPL telemetry collection (verify privacy disclosures).

### 7. Testing exists but lacks systematic coverage

**Vitest** is confirmed as the test runner (dedicated `vitest/` config folder). A `test-results/` directory at the project root suggests CI integration with output artifacts. The `_shared/__tests__/` directory confirms unit tests exist for shared backend utilities. Three separate `testing/` folders plus inconsistent naming (`__tests__/`, `test/`, `tests/`, `testing/`, `TESTING/`) across the codebase reveal an ad-hoc approach to test organization.

No Playwright or E2E testing configuration was found. No evidence of test coverage enforcement or minimum coverage thresholds. For a medical education platform where incorrect content display could have real-world consequences, the testing posture is significantly underdeveloped. The FSRS algorithm, the CoVe pipeline, and the review submission flow are all high-value targets for property-based testing.

### 8. Performance has a strong edge foundation but needs frontend work

The Cloudflare Pages + Hono + Prisma Accelerate stack provides excellent edge performance by default — global deployment, connection pooling, and cached reads. This is the performance floor, and it is high.

The frontend performance story is less clear. With 23+ component directories and no evidence of route-level lazy loading (`React.lazy()` + `Suspense`), the initial bundle likely includes far more code than necessary for any given page. The `charts/` and `analytics/` directories suggest heavy visualization libraries (Recharts or similar) that should be code-split. No service worker configuration was found — critical for an educational app where offline study capability is a key feature.

### 9. Security has auth but lacks defense in depth

**Clerk authentication** is integrated (evidenced by `auth/` component directory and `webhooks/` for Clerk events). The separation of `admin/` endpoints suggests role-based access control exists.

Missing security layers include: **no evidence of rate limiting** (critical for AI endpoints), **debug endpoints exposed** in production, **no visible CSP headers** configuration, **no input validation framework** (Zod) at API boundaries (though the `_shared/` directory may contain this), and **no evidence of secrets rotation** or management tooling. The Prisma Accelerate connection string, Clerk secret key, and Gemini API key are all high-value secrets that require proper management.

### 10. Design system is thematically strong but inconsistently applied

The "Stormy Slate" design system demonstrates genuine thought about cognitive load in medical education. The decision to ban bright colors (orange buttons, purple gradients) and enforce semantic tokens (`bg-surface-primary`, `bg-surface-card`, `text-slate-50`) reduces visual noise during study sessions. The **epistemic uncertainty UI** — ghost bars for low-confidence analytics, calibration progress bars when N < 60 reviews — is a rare and valuable pattern for educational software.

The `ui/` component directory likely contains shared primitives (possibly shadcn/ui or Radix-based). Dedicated `charts/` and `loading/` directories suggest some systematization. However, naming inconsistencies across component directories (`Goals/` vs `achievements/` vs `custom-study/`) and the sheer breadth of the component tree suggest the design system's token enforcement may be inconsistently applied in practice.

---

## Part 2 — Reference repositories by audit dimension

### Architecture and code organization

| Repository | Stars | Relevance |
|---|---|---|
| **[cal.com/cal.com](https://github.com/calcom/cal.com)** | ~37.6k | Gold standard for large-scale TypeScript monorepo architecture. Turborepo with 73 feature packages, Controller → Service → Repository pattern, tRPC + Prisma. Study `AGENTS.md` for coding standards, `/packages/` structure for service layer patterns |
| **[refinedev/refine](https://github.com/refinedev/refine)** | ~28k | Headless React meta-framework for dashboards and internal tools. Demonstrates clean separation between data providers, UI adapters, and routing. Study `/packages/core/src/` for provider abstraction patterns |
| **[cloudflare/react-router-hono-fullstack-template](https://github.com/cloudflare/workers-sdk)** | Official | Cloudflare's recommended React + Hono fullstack template on Pages. Study for correct file-based routing patterns with Hono on Workers |

### FSRS and spaced repetition

| Repository | Stars | Relevance |
|---|---|---|
| **[open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** | ~570 | The canonical TypeScript FSRS library. Directly relevant — PANaCEa should consume this rather than re-implementing. Study `src/fsrs/` for the correct v6 algorithm, `src/fsrs/models.ts` for type definitions |
| **[open-spaced-repetition/fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs)** | Active | Rust FSRS with full training/optimization via Burn ML framework. Powers the WASM bindings PANaCEa intends to use. Study `src/scheduler.rs` for scheduling correctness, `src/training.rs` for optimizer patterns |
| **[ishiko732/ts-fsrs-demo](https://github.com/ishiko732/ts-fsrs-demo)** | Reference | Complete working app integrating ts-fsrs + Hono + Kysely. Closest architectural analog to PANaCEa. Study the review submission flow and parameter optimization pipeline |

### AI integration

| Repository | Stars | Relevance |
|---|---|---|
| **[vercel/ai](https://github.com/vercel/ai)** | ~10k+ | The AI SDK for TypeScript. `generateObject()` with Zod schema validation provides exactly the structured output pattern PANaCEa needs for clinical content generation. Study `packages/ai/src/generate-object/` for structured output, streaming patterns |
| **[thiswillbeyourgithub/AnkiAIUtils](https://github.com/thiswillbeyourgithub/AnkiAIUtils)** | Active | AI tools for Anki flashcards battle-tested in medical school. Uses LiteLLM for model-agnostic LLM support. Study the explanation generation and mnemonic creation patterns — directly applicable to PANaCEa's question generation |

### Database and data layer

| Repository | Stars | Relevance |
|---|---|---|
| **[prisma/prisma-client-extensions](https://github.com/prisma/prisma-client-extensions)** | Official | The essential reference for Prisma Client Extensions including RLS, audit logging, input validation, computed fields, and query logging. Study `row-level-security/` for PostgreSQL RLS with Prisma, `audit-log-context/` for mutation tracking |
| **[zenstackhq/zenstack](https://github.com/zenstackhq/zenstack)** | ~2.5k | Prisma superset with `@@allow()` / `@@deny()` authorization directives, auto-generated APIs, and Tanstack Query hooks. Study the authorization proxy pattern — `enhance(prisma, { user })` creates an access-controlled client per request |

### Testing and quality

| Repository | Stars | Relevance |
|---|---|---|
| **[calcom/cal.com](https://github.com/calcom/cal.com)** | ~37.6k | Production-grade Vitest + Playwright in a monorepo. Multi-project Playwright config, database seeding before E2E, CI parallelization. Study `playwright.config.ts`, `.github/workflows/`, test naming conventions (`.integration-test.ts`) |
| **[ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate)** | Active | Full Clerk + Zod + Vitest + Playwright stack with GitHub Actions CI. Study the complete testing pipeline from unit through E2E, plus type-safe environment variable validation with T3 Env |

### Security

| Repository | Stars | Relevance |
|---|---|---|
| **[ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate)** | Active | Clerk auth with MFA, RBAC, multi-tenancy, Zod validation, Sentry error monitoring, Pino logging. The most comprehensive Clerk integration reference available. Study `/src/middleware.ts` for auth patterns, Zod schemas for input validation |
| **[hongkongkiwi/prisma-rls-secure](https://github.com/hongkongkiwi/prisma-rls-secure)** | Active | PostgreSQL RLS + Column Level Security for Prisma with PERMISSIVE/RESTRICTIVE policies, JWT integration, multi-tenant support. Study the schema syntax for `@@rls.policy()` directives |

### UI/UX and design system

| Repository | Stars | Relevance |
|---|---|---|
| **[satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin)** | ~11.4k | Most popular shadcn/ui admin dashboard. React + Vite + TypeScript — same stack as PANaCEa. Study component composition, dark mode implementation, responsive layout patterns |
| **[medplum/medplum](https://github.com/medplum/medplum)** | ~2.1k | Open-source FHIR-native healthcare platform with React frontend. Study `packages/react/` for clinical data display components (DiagnosticReport, MedicationRequest, patient observations), HIPAA-compliant UI patterns |
| **[openmrs/openmrs-esm-patient-chart](https://github.com/openmrs/openmrs-esm-patient-chart)** | Active | React microfrontend for clinical patient charts. Study clinical form rendering, vital signs display, medication lists — patterns directly applicable to PANaCEa's OSCE mode and clinical reference library |

---

## Part 3 — Phased implementation roadmap

### Phase 1: Foundation (weeks 1–3, effort: Large)

**What it addresses:** Architecture consistency, naming conventions, dead code, duplicate endpoints, security basics.

**Audit findings resolved:** #1 (Architecture inconsistency), #3 (API fragmentation), #9 (Security gaps).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Consolidate AI endpoints into single `functions/api/ai/` with model routing layer | `functions/api/ai/`, `gemini/`, `intelligence/`, `vision/` | Medium | vercel/ai (provider pattern) |
| Deduplicate `drill/` vs `drills/` endpoints | `functions/api/drill/`, `functions/api/drills/` | Small | — |
| Remove or feature-gate `debug/` endpoints | `functions/api/debug/` | Small | — |
| Enforce naming convention (lowercase-kebab) across all component directories | All 23+ `components/` subdirs | Medium | cal.com AGENTS.md |
| Add rate limiting to AI and auth endpoints | `functions/api/_shared/` | Medium | Cloudflare rate limiting docs |
| Implement Zod validation at all API boundaries | `functions/api/_shared/`, all endpoint handlers | Large | ixartz/SaaS-Boilerplate |
| Add CSP headers and security middleware | Cloudflare Pages `_headers` file, `functions/_middleware.ts` | Small | — |

### Phase 2: Data integrity (weeks 3–5, effort: Medium)

**What it addresses:** Database security, audit logging, migration hygiene.

**Audit findings resolved:** #4 (Database/RLS), #9 (endpoint protection).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Implement Row Level Security via Prisma Client Extensions | `prisma/schema.prisma`, `functions/api/_shared/prisma.ts` | Large | prisma/prisma-client-extensions (row-level-security), zenstack |
| Add audit logging for all data mutations | `functions/api/_shared/` | Medium | prisma/prisma-client-extensions (audit-log-context) |
| Document edge client generation workflow | `prisma/`, project README | Small | — |
| Verify and enforce migration versioning | `prisma/migrations/` | Small | — |

### Phase 3: Core algorithm verification (weeks 5–7, effort: Medium)

**What it addresses:** FSRS v6 correctness, SRS pipeline integrity, telemetry privacy.

**Audit findings resolved:** #6 (FSRS correctness), #5 (AI output validation).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Verify FSRS v6 formulas against ts-fsrs canonical implementation | `functions/api/srs/`, client-side FSRS code | Medium | open-spaced-repetition/ts-fsrs |
| Consider consuming ts-fsrs directly instead of custom implementation | `services/optimizer/`, `package.json` | Medium | ts-fsrs, ts-fsrs-demo |
| Add property-based tests for FSRS scheduling edge cases (S=0, first review, same-day reviews) | `functions/api/srs/__tests__/` | Medium | fsrs-rs test suite |
| Tune rapid-guessing filter threshold (3000ms may be too aggressive) | CRPL telemetry code | Small | — |
| Add privacy disclosure for CRPL telemetry data collection | Frontend consent UI, privacy policy | Small | — |

### Phase 4: State management and frontend performance (weeks 7–9, effort: Large)

**What it addresses:** Re-render optimization, bundle size, offline capability, centralized state.

**Audit findings resolved:** #2 (React state management), #8 (Performance).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Introduce Zustand or Jotai for shared application state (session, SRS, analytics) | New `src/store/` directory | Large | refine (provider patterns) |
| Implement route-level code splitting with `React.lazy()` + `Suspense` | `src/App.tsx` or router config | Medium | Vite code splitting docs |
| Lazy-load charts and analytics components | `components/charts/`, `components/analytics/` | Small | — |
| Add `rollup-plugin-visualizer` for bundle analysis | `vite.config.ts` | Small | — |
| Implement service worker for offline study mode | New `public/sw.js` | Large | — |
| Merge `dashboard/` and `ProgressDashboard/` component directories | `components/dashboard/`, `components/ProgressDashboard/` | Medium | — |

### Phase 5: AI service layer unification (weeks 9–11, effort: Large)

**What it addresses:** AI fragmentation, prompt engineering quality, cost optimization, streaming.

**Audit findings resolved:** #5 (AI integration quality).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Create unified AI service with model routing, fallback chains, and response caching | `functions/api/ai/service.ts` (new) | Large | vercel/ai SDK |
| Implement structured output validation with Zod schemas for all AI-generated content | `functions/api/ai/schemas/` (new) | Medium | vercel/ai `generateObject()` |
| Add streaming support for long-form AI generation (OSCE scenarios, explanations) | `functions/api/ai/`, frontend consumption | Medium | vercel/ai `streamText()` |
| Centralize prompt templates with version tracking | `functions/api/ai/prompts/` (new) | Medium | AnkiAIUtils (prompt patterns) |
| Implement cost tracking and per-user AI usage limits | `functions/api/ai/`, database schema | Medium | — |

### Phase 6: Testing and CI/CD (weeks 11–14, effort: Large)

**What it addresses:** Test coverage, CI pipeline, E2E testing, deployment confidence.

**Audit findings resolved:** #7 (Testing gaps).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Standardize test organization (co-located `__tests__/` or `.test.ts` suffix) | All test directories | Medium | cal.com conventions |
| Add Playwright E2E tests for critical flows (login → study → review → submit) | New `e2e/` directory | Large | cal.com `playwright.config.ts` |
| Set up GitHub Actions CI with Vitest, Playwright, type-checking, lint gates | `.github/workflows/` (new) | Medium | ixartz/SaaS-Boilerplate |
| Add minimum test coverage enforcement (target: 60% → 80% over time) | `vitest.config.ts` | Small | — |
| Add FSRS algorithm correctness tests against known-good outputs | `functions/api/srs/__tests__/` | Medium | ts-fsrs test suite |

### Phase 7: Clinical UI polish and accessibility (weeks 14–16, effort: Medium)

**What it addresses:** Design system consistency, clinical safety, accessibility, OSCE mode quality.

**Audit findings resolved:** #10 (UI/UX), #2 (accessibility).

| Task | Files/Directories | Effort | Reference Repo |
|---|---|---|---|
| Audit and enforce "Stormy Slate" design tokens across all components | All `components/` directories | Medium | satnaing/shadcn-admin |
| Add WCAG 2.1 AA compliance (focus indicators, screen reader support, contrast ratios) | `components/ui/`, all interactive components | Large | medplum/medplum (`packages/react/`) |
| Implement clinical safety patterns for drug dosages and lab values (highlight abnormals, cross-check ranges) | `components/library/`, `functions/api/drugs/` | Medium | medplum clinical components |
| Add OSCE-specific UI patterns (timer, structured clinical exam flow, scoring rubric display) | `components/modes/osce/` | Medium | openmrs patient chart |
| Implement error boundary strategy with graceful degradation | `components/error/` | Small | — |

---

## Where the architectural manifesto meets reality

The January 2026 architecture manifesto is a remarkably detailed specification — 21-parameter FSRS, CRPL telemetry, CoVe pipelines, Monte Carlo simulation, WASM optimization. It reads like a research paper translated into engineering requirements. The gap between this manifesto and the current v1.2.0 implementation is the central tension of this codebase.

The most impactful changes are not the most technically exciting ones. Consolidating four AI directories into one unified service layer, adding Zod validation at API boundaries, implementing RLS on the database, and setting up a real CI/CD pipeline will do more for PANaCEa's reliability and maintainability than perfecting the 21st FSRS parameter. The recommendation is to **prioritize infrastructure discipline (Phases 1–2) before algorithm sophistication (Phase 3+)**. A correctly-implemented ts-fsrs library integration with 17 parameters and comprehensive tests will outperform a buggy custom 21-parameter implementation every time.

The reference repositories reveal that PANaCEa's architecture is on the right track — Hono on Cloudflare Pages is exactly what cal.com-style projects are moving toward, and the FSRS community's ts-fsrs library was purpose-built for applications like this. The path forward is not rearchitecting but consolidating: fewer directories with clearer boundaries, standardized patterns enforced through linting and testing, and a deliberate sequence of improvements that builds confidence in each layer before adding complexity on top of it.