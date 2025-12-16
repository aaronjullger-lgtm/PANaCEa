<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1XKKOL9unGhpt6WDahRfrws6I92V3mjTJ

## Run Locally

**Prerequisites:**  Node.js (v18 or higher)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add:
   - `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key (from https://dashboard.clerk.com)
   - `CLERK_SECRET_KEY`: Your Clerk secret key
   - `GEMINI_API_KEY`: Your Gemini API key
   - `DATABASE_URL`: **REQUIRED** - Your PostgreSQL connection string
   
   **⚠️ DATABASE_URL is REQUIRED** - This app uses a database-first architecture. All content is stored in PostgreSQL.
   
   See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) for detailed authentication setup instructions.

3. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

4. **Start the application:**
   
   **⚠️ IMPORTANT: You must run BOTH frontend and backend servers**
   
   **Option A - Run both together (RECOMMENDED):**
   ```bash
   npm run dev:all
   ```
   This starts:
   - Backend server (Express) on `http://localhost:3001` - Handles API and database
   - Frontend dev server (Vite) on `http://localhost:3000` - React UI
   
   **Option B - Run separately:**
   ```bash
   # Terminal 1 - Backend (MUST be started first)
   npm run dev:server
   
   # Terminal 2 - Frontend
   npm run dev
   ```
   
   **❌ DO NOT run `npm run dev` alone** - This only starts the frontend. API calls will fail with "Unexpected token '<'" errors because the backend isn't running.

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## Deploy to Production

⚠️ **Before deploying to production, you MUST set up your database first!**

### Quick Production Setup:

1. **Set up your database:**
   ```bash
   # Set production DATABASE_URL in .env
   DATABASE_URL="postgresql://your-production-db-url"
   
   # Run database migration
   npm run migrate:production
   ```

2. **Deploy to Cloudflare Pages:**
   - Follow the step-by-step guide: [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)
   - Detailed deployment instructions: [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)

📖 **Read the comprehensive guides:**
- [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md) - Database setup and migration
- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Complete deployment checklist
- [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) - Cloudflare Pages configuration

## Available Scripts

### Development Scripts
- `npm run dev` - Start frontend development server
- `npm run dev:server` - Start backend server with hot reload
- `npm run dev:all` - Start both frontend and backend concurrently
- `npm run preview` - Preview production build
- `npm test` - Run test suite

### Build Scripts
- `npm run build` - Build frontend for production
- `npm run build:server` - Build backend for production

### Database Scripts
- `npm run migrate:production` - Apply database migrations to production (interactive)
- `npm run db:migrate:deploy` - Deploy migrations (non-interactive)
- `npm run db:migrate:dev` - Create and apply migrations in development
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database (development only)
- `npm run db:studio` - Open Prisma Studio database GUI

## 🔍 Troubleshooting

### "SyntaxError: Unexpected token '<' in JSON"

**Problem:** Frontend trying to parse HTML instead of JSON from API calls.

**Cause:** Backend server is not running. The Vite dev server returns the React app's `index.html` for unknown routes instead of JSON from the API.

**Solution:** 
```bash
# Stop frontend-only dev server (Ctrl+C)
# Start both servers together:
npm run dev:all
```

### "Failed to fetch from /api/content/all"

**Problem:** API requests failing with network errors.

**Cause:** Backend Express server (port 3001) is not running.

**Solution:**
```bash
npm run dev:all  # Always use this command for development
```

### "Database unavailable" or connection errors

**Problem:** Backend server starts but can't connect to database.

**Causes:**
1. `DATABASE_URL` not set in `.env`
2. Database not accessible (wrong credentials, network issues)
3. Prisma client not generated

**Solution:**
```bash
# 1. Check .env file has DATABASE_URL
# 2. Generate Prisma client:
npm run db:generate

# 3. Verify database connection:
npm run db:studio  # Opens Prisma Studio - if this works, DB is accessible
```

**Note:** The Vite dev server (port 3000) proxies `/api/*` and `/geminiProxy` requests to the Express backend (port 3001). Both servers must be running for the app to function properly.

### Database-First Architecture

PANaCEa uses a **database-first architecture** where all medical content is stored in and retrieved from the database via API endpoints. The application **requires** a properly configured database to function.

**Required Setup:**
- Backend server must be running (`npm run dev:server` or deployed)
- `DATABASE_URL` environment variable must be configured
- Database schema must be applied (run `npm run migrate:production`)

**What happens without database:**
- Condition content will be empty
- Drug data uses the static registry as fallback
- Lab cases return empty arrays gracefully

For full functionality (AI question generation, user authentication, condition content, database features), both frontend and backend servers with database access are required.

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

📖 **[Read the Full Documentation →](HYBRID_CONTENT_ENGINE.md)**

### Quick Start with Hybrid Content Engine:

```bash
# Run the demo to see all features in action
npx tsx scripts/exampleHybridContentEngine.ts
```
