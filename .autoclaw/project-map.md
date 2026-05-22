# .autoclaw/project-map.md — Stable App Facts

## Identity
- **Name:** StudyPANaCEa (studypanacea.com)
- **Purpose:** Adaptive clinical education platform for PA students — FSRS v6 spaced repetition, implicit metrics, NCCPA blueprint-aligned questions, AI clinical simulations
- **Repo:** /Users/aaronullger/GitHub/StudyPANaCEa

## Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript (strict) + Vite | 19.2 / 6.2 |
| Styling | TailwindCSS + Framer Motion | 3.4 |
| State | Zustand + TanStack Query | 5.0 / 5.90 |
| Backend | Cloudflare Pages Functions (Edge) | — |
| Database | PostgreSQL (Supabase) + Prisma | 7.6 |
| Auth | Clerk | RBAC via UserRole |
| AI | Google Gemini | Server-side |
| Testing | Vitest + Playwright | 4.1 |
| CI/CD | GitHub Actions → Cloudflare Pages | — |
| Node | v22 (.node-version) | — |

## Commands
```bash
npm run dev              # Vite HMR
npm run dev:all          # Frontend + Express backend
npm test                 # Vitest (9648 tests, 517 files — 0 failures)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage
npm run typecheck        # NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
npm run build            # Production build
npm run deploy:local     # Build + deploy to Cloudflare Pages
npm run db:push          # Push schema (dev)
npm run db:studio        # Prisma Studio GUI
```

## Architecture (verified 2026-05-22)
- **API:** `functions/api/` — 555 files, Cloudflare Edge only (Express in `routes/` is local-dev only)
- **Components:** 675 component files (55 subdirs) in `components/`
- **Hooks:** 112 custom hooks in `hooks/`
- **Lib:** 634 files including services, confidence pipeline, FSRS, constants
- **Types:** 35 type definition files in `types/`
- **Tests:** 246 test files
- **Prisma:** 190 models, 30 enums in 5181-line `prisma/schema.prisma`
- **Import alias:** `@/` → repo root
- **Build:** ✅ passes (verified 2026-05-22)
- **Branch:** main, clean working tree
- **Key files:** CLAUDE.md (472 lines), llms.txt (41 lines) at repo root
- **Largest files:** QuizView.tsx (1900), drillReviewService.ts (2718), PatientEncounterMode.tsx (3486), schema.prisma (5181), vite.config.ts (620)

## Auth Model
- Clerk (Token provider pattern)
- RBAC: UserRole enum (Student, Faculty, Admin)
- Auth middleware: `authenticatedEndpoint` from `functions/api/_shared/auth.ts`
- Edge auth: token verification via Clerk backend SDK

## Domain Concepts
- **FSRS:** Free Spaced Repetition Scheduler v6 — 21 parameters, implicit-only rating
- **Rating:** Binary Again(0)/Good(1), derived from behavioral telemetry (no self-rated buttons)
- **Ghost Grader:** Behavioral-biometric rating override — can force Again on correct answers
- **Confidence Pipeline:** 8-stage: Bayesian → calibration → fatigue → interference → fluency → stability → trajctory → trend
- **Question Reservoir:** Background queue — LOW_WATER=15, HIGH_WATER=40, BATCH=25, TTL=48h
- **Drill Types:** 13 active — Anatomy, Condition, Contrastive, DDx, Derm, ECG, Elaboration, FirstLine, Guideline, ICDCoding, Imaging, MiniLab, Pharm
- **Session Types:** MAIN, DRILL, CRAM, rapid_recall — only MAIN and DRILL update FSRS
- **Par Time:** Per-question-type (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms rapid-guess thresholds)

## Critical User Flows
1. Study session: QuizView → answer questions → implicit rating → FSRS update → next question
2. Drill session: DrillShell + drill component → useDrillFSRS hook → submit review → analytics update
3. Question generation: AI generates → validated → persisted → reservoir queued → assigned to user
4. Dashboard: AdaptiveDashboardPage → real analytics from ReviewLog + QuestionAttempt data
5. Content browsing: Clinical library → search/browse conditions, drugs, guidelines

## Environment Variables
- `CLERK_SECRET_KEY`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_AUTH_TOKEN`
- Client: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_API_URL`
- KV: `RATE_LIMIT_KV`, `CACHE`

## Deployment
- Cloudflare Pages via GitHub Actions auto-deploy on push to main
- Production: studypanacea.com
- Express routes (`routes/`) are local dev ONLY — never deployed
