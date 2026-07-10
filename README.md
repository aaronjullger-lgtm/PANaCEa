<div align="center">
<img width="1200" height="475" alt="PANaCEa Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# PANaCEa

**AI-Powered PANCE/PANRE Exam Preparation Platform**

Adaptive learning meets medical education excellence for Physician Assistant students.

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Latest-purple.svg)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue.svg)](https://www.postgresql.org/)

</div>

> **Deployment note:** Cloudflare deployment readiness is tracked in the current production scorecard and final readiness reports. Local development is unaffected.

---

## 🎯 Overview

PANaCEa is a comprehensive medical education platform designed specifically for PA students preparing for their PANCE/PANRE board exams. It combines AI-assisted learning workflows with FSRS v6-compatible spaced repetition to create a personalized learning experience.

**📚 For current production status and implementation priorities, see [UPDATED_PRODUCTION_READINESS_SCORECARD.md](./UPDATED_PRODUCTION_READINESS_SCORECARD.md) and [NEXT_IMPLEMENTATION_PLAN.md](./NEXT_IMPLEMENTATION_PLAN.md).**
**🤖 For the Intelligence Layer (Gemini Live, Clinical Eye, Knowledge Cache, Visualizer, Podcast), see [docs/INTELLIGENCE_LAYER.md](./docs/INTELLIGENCE_LAYER.md).**

### ✨ Key Features

- **🧠 AI-Generated Questions**: Clinical scenarios powered by Google Gemini API
- **📊 Adaptive Learning**: FSRS v6-compatible spaced repetition with user-specific tuning
- **🎮 Gamified Training**: Multiple drill modes including Photo Drill, Rapid Recall, DDx Compare
- **📈 Analytics Dashboard**: Track performance across all PANCE organ systems
- **🏥 Virtual Patient Encounters**: Interactive clinical case simulations
- **📱 PWA Support**: Study offline with progressive web app capabilities

### 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Framer Motion
- **Backend**: Cloudflare Pages Functions (production); Express (local dev only)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Google Gemini API
- **Authentication**: Clerk
- **Deployment**: Cloudflare Pages + Functions

### Architecture (API)

- **Production API:** Cloudflare Pages Functions under `functions/api/`. All deployed requests are served by these edge handlers.
- **Legacy `routes/`:** The `routes/` directory contains Express route handlers for **local/dev only**. They are **not deployed** to Cloudflare Pages. Use `npm run dev:server` only when testing legacy Express behavior. For production behavior, use `npm run dev:wrangler` or deploy to Pages.
- **Endpoint contracts:** See `docs/api/API_OVERVIEW.md` for the unified response envelope (`ok`/`fail`, `traceId`, error codes) and request/response shapes of actively maintained endpoints (admin, OSCE, health, Gemini, content library, questions, goals/session).

### Deployment & health (runbook)

- **Validate locally:** `npm run typecheck` → `npm run lint` → `npm run build` → `npm test`. E2E: start app (e.g. `npm run dev:wrangler`), then `npm run test:e2e` or `npm run test:smoke`.
- **CI:** `.github/workflows/ci.yml` runs typecheck, lint, build, unit tests, and an E2E smoke job (api-health against wrangler pages dev). Env vars for deploy: set in Cloudflare Pages (Dashboard → Settings → Environment variables); do not commit secrets.
- **CSP and rate limits:** Security headers (including CSP) are in `public/_headers`. Gemini proxy rate limiting is in `functions/api/_shared/rateLimiter.ts` (applied to `/api/gemini` and `/api/gemini/stream`).

---

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v22 or higher (`.node-version` and `.nvmrc` are set to `22`)
- **PostgreSQL** database
- **Google Gemini API** key ([Get one here](https://makersuite.google.com/app/apikey))
- **Clerk Account** for authentication ([Sign up](https://clerk.com))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/aaronjullger-lgtm/PANaCEa.git
   cd PANaCEa
   ```

2. **Install dependencies**

   ```bash
   npm ci
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:

   ```env
   # Clerk Authentication
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...

   # Google Gemini AI
   GEMINI_API_KEY=your_gemini_api_key

   # PostgreSQL Database (REQUIRED)
   DATABASE_URL=postgresql://user:password@host:5432/database
   DIRECT_DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
   ```

   > ⚠️ **DATABASE_URL is REQUIRED** - PANaCEa uses a database-first architecture
   > For local Express dev with a direct Postgres URL, `sslmode=require` is normalized to libpq-compatible SSL semantics at runtime. Use `sslmode=verify-full` plus a trusted CA when you need certificate verification locally.

4. **Initialize the database**

   ```bash
   npm run db:generate
   npm run db:migrate:dev
   ```

5. **Start the development servers**

   **Production**: Cloudflare Pages serves both static assets and API via `functions/api/`. No Express in production.

   **Local dev** – choose one:
   - **`npm run dev:all`** – Express backend (port 3001) + Vite frontend (port 3000). Quick for local testing.
   - **`npm run dev:wrangler`** – Builds `dist` and serves Cloudflare Pages Functions. Matches production routing (recommended before deploy).

   ```bash
   npm run dev:all
   ```

   This starts:
   - 🔧 Backend (Express) on `http://localhost:3001`
   - ⚛️ Frontend (Vite) on `http://localhost:3000`

   <details>
   <summary>Alternative: Run servers separately</summary>

   ```bash
   # Terminal 1 - Backend (start first)
   npm run dev:server

   # Terminal 2 - Frontend
   npm run dev
   ```

   </details>

6. **Open your browser**

   Navigate to `http://localhost:3000`

---

## 🚢 Deployment

For production deployment to Cloudflare Pages:

1. Set production `DATABASE_URL` in Cloudflare environment variables
2. Run database migrations: `npm run migrate:production`
3. Follow the detailed guide: [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)

📖 **Deployment Resources:**

- [Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)
- [Environment Setup Guide](docs/deployment/ENV_SETUP_GUIDE.md)

---

## 📜 Available Scripts

| Command                      | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `npm run dev:all`            | Express + Vite (local dev)                                   |
| `npm run dev:wrangler`       | Build + Cloudflare Pages Functions (production parity)        |
| `npm run dev:server`         | Express backend only                                         |
| `npm run dev`                | Frontend only (proxies /api to Express if running)           |
| `npm run build`              | Build frontend for production                                |
| `npm run build:server`       | Build backend for production                                 |
| `npm test`                   | Run test suite                                               |
| `npm run verify:health`      | Verify public Cloudflare Pages `/api/health`                 |
| `npm run test:e2e:production-smoke` | Run production-parity Playwright smoke tests          |
| `npm run db:studio`          | Open Prisma Studio (database GUI)                            |
| `npm run migrate:production` | Run database migrations                                      |
| `npm run orchestrate:full`   | Run automated content pipeline                               |

---

### Production-Parity Smoke Tests

Public route/API health smoke:

```bash
# Terminal 1
npm run dev:wrangler

# Terminal 2
BASE_URL=http://localhost:8788 npm run verify:health
```

Authenticated core-study smoke uses `e2e/production-smoke/core-launch.spec.ts`.
Set up a dedicated Clerk test user with MFA / Client Trust disabled, then set
these local-only variables in `.env` or your shell:

```env
E2E_REQUIRE_AUTH=1
E2E_CLERK_TEST_EMAIL=test-learner@example.com
E2E_CLERK_TEST_PASSWORD=replace-with-local-test-password
```

Then run:

```bash
# Terminal 1
npm run dev:wrangler

# Terminal 2
BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke
```

Do not use production learner/admin accounts for smoke tests, and do not commit
real E2E credentials. The `test:e2e:production-smoke` script loads `.env` when
it exists.

---

## 🏗️ Project Structure

```
PANaCEa/
├── components/         # React UI components
│   ├── drill/         # Drill mode components
│   ├── modes/         # Training mode implementations
│   └── admin/         # Admin dashboard components
├── services/          # Business logic layer
├── lib/
│   ├── services/      # Backend services (CMS, SRS, Auto-author)
│   ├── middleware/    # Express middleware (auth, validation)
│   └── fsrs.ts        # FSRS-compatible spaced repetition algorithm
├── server.ts          # Express backend server
├── App.tsx            # Main React application
├── conditionRegistry.ts # Medical condition definitions (2195 entries)
└── prisma/            # Database schema and migrations
```

---

## 🐛 Troubleshooting

### "Unexpected token '<'" error

**Problem**: Frontend returns HTML instead of JSON for API calls  
**Solution**: Backend server is not running. Use `npm run dev:all`

### Database connection errors

**Problem**: Can't connect to PostgreSQL  
**Solutions**:

- Verify `DATABASE_URL` is set in `.env`
- Run `npm run db:generate` to sync Prisma client
- Check database is accessible

### Gemini API errors

**Problem**: AI question generation fails  
**Solutions**:

- Verify `GEMINI_API_KEY` is set correctly
- Ensure backend server is running on port 3001
- Check API key validity at [Google AI Studio](https://makersuite.google.com)

---

## 📚 Documentation

- [Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md) - Production deployment
- [Environment Setup](docs/deployment/ENV_SETUP_GUIDE.md) - Environment variables and configuration
- [API Overview](docs/api/API_OVERVIEW.md) - Unified response envelope and endpoint contracts
- [Copilot Instructions](.github/copilot-instructions.md) - AI coding assistant guide
- [Archived Documentation](docs/archive/INDEX.md) - Historical audit reports and status docs

---

## 🤝 Contributing

This is an educational project for PA students. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **PANCE Blueprint** - NCCPA exam content outline
- **Google Gemini** - AI question generation
- **Clerk** - Authentication infrastructure
- **Supabase/PostgreSQL** - Database hosting
- **Open FSRS** - Spaced repetition algorithm

---

<div align="center">

**Built with ❤️ for PA Students**

[Report Bug](https://github.com/aaronjullger-lgtm/PANaCEa/issues) · [Request Feature](https://github.com/aaronjullger-lgtm/PANaCEa/issues)

</div>

# 3. Verify database connection:

npm run db:studio # Opens Prisma Studio - if this works, DB is accessible

````

**Note:** The Vite dev server (port 3000) proxies `/api/*` and `/geminiProxy` requests to the legacy Express backend (port 3001) when using `npm run dev`/`dev:all`. Maintained Cloudflare Pages Function routes such as `/api/study/*` require `npm run dev:wrangler` or `npm run pages:serve` for production-parity testing.

### Database-First Architecture

PANaCEa uses a **strict database-first architecture** where PostgreSQL is the ONLY source of truth for all medical content. No static JSON/TS arrays are used for clinical data.

**Required Setup:**
- Backend server must be running (`npm run dev:server` or deployed)
- `DATABASE_URL` environment variable must be configured
- Database schema must be applied (`npm run db:migrate:dev` locally, `npm run migrate:production` only for reviewed production migration work)

**What happens without database:**
- Condition content will be empty
- Drug data will show error state (no static fallback)
- Lab cases will show error state with retry option
- Cram Mode will show error state

For full functionality (AI question generation, user authentication, condition content, database features), run the frontend with the appropriate backend target: Express for legacy local route smoke, or Wrangler/Pages Functions for maintained production API flows.

## 🧠 Hybrid Content Engine

PANaCEa features an advanced **Hybrid Content Engine** that solves the latency, cost, and quality control issues of pure AI generation. This system builds a valuable asset library over time while drastically reducing costs.

### Key Features:

1. **Staging Lake Architecture** - Quality control gateway that validates all AI-generated questions before they reach users
2. **No-Repeat Logic** - Smart question delivery that ensures users never see the same question twice
3. **Vignette Permutation Storage** - Dynamic question generation from templates that creates infinite unique variations
4. **Pearl Harvester** - Automatic extraction of clinical pearls from explanations for quick review

### Benefits:

- **90% Cost Reduction**: From $7,300/year to $730/year by caching vetted questions
- **40-100x Faster**: Question delivery drops from 2-5 seconds to 50ms
- **Quality Control**: All questions validated before reaching users
- **Asset Building**: Growing library of 50,000+ vetted medical education questions

📖 **Read the Full Documentation** in the docs/ directory.

### Quick Start with Hybrid Content Engine:

```bash
# Run the demo to see all features in action
npx tsx scripts/exampleHybridContentEngine.ts
````
