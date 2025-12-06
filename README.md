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
   - `VITE_GEMINI_API_KEY`: Your Gemini API key (for client-side)
   - `DATABASE_URL`: Your PostgreSQL connection string (optional for development)
   
   See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) for detailed authentication setup instructions.

3. **Start the application:**
   
   **Option A - Run both frontend and backend together (recommended):**
   ```bash
   npm run dev:all
   ```
   This starts:
   - Backend server on `http://localhost:3001`
   - Frontend dev server on `http://localhost:3000`
   
   **Option B - Run separately:**
   ```bash
   # Terminal 1 - Backend
   npm run dev:server
   
   # Terminal 2 - Frontend
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start frontend development server
- `npm run dev:server` - Start backend server with hot reload
- `npm run dev:all` - Start both frontend and backend concurrently
- `npm run build` - Build frontend for production
- `npm run build:server` - Build backend for production
- `npm run preview` - Preview production build
- `npm test` - Run test suite

**Note:** The Vite development server proxies requests to `/geminiProxy` to `http://localhost:3001`. The backend server must be running for AI features to work.

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
