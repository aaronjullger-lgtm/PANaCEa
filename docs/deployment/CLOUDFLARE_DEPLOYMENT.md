# Cloudflare Pages Deployment Guide

This document describes how to deploy this application on Cloudflare Pages.

## Architecture

1. **Cloudflare Pages Function**: `/functions/geminiProxy.ts`
   - Uses Cloudflare Pages Functions API (exports `onRequestPost`)
   - Uses direct Fetch API to call Gemini instead of Node.js SDK (for Workers compatibility)
   - Includes CORS headers for cross-origin requests
   - Endpoint available at: `https://your-domain.com/geminiProxy`

2. **API Client**: `services/geminiService.ts`
   - Calls `/geminiProxy` endpoint for all Gemini API requests
   - All API calls use the Cloudflare Pages function

3. **Tailwind CSS**: Proper PostCSS integration
   - Tailwind CSS v4 as a dev dependency
   - PostCSS configuration with `@tailwindcss/postcss` plugin
   - `tailwind.config.js` for content configuration
   - Tailwind directives in `index.css`

4. **Cloudflare Configuration**:
   - Cloudflare Pages automatically detects and deploys functions from the `/functions` directory
   - No manual configuration files needed (Pages auto-configures routing)

## Prerequisites: Database Migration

⚠️ **IMPORTANT:** Before deploying to Cloudflare Pages, you **must** set up your database schema first.

If you skip this step, you'll see errors like:

```
The table `public.User` does not exist in the current database.
```

### Apply Database Schema

Follow the detailed guide in [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) to set up your production database.

**Quick Start:**

```bash
# 1. Set your production DATABASE_URL in .env
DATABASE_URL="postgresql://your-production-db-connection-string"

# 2. Run the migration script
npm run migrate:production

# OR manually apply with Prisma
npx prisma migrate deploy
```

This creates all 40+ required tables including User, PerformanceRecord, SRSItem, and more.

✅ Once your database is set up, proceed with Cloudflare Pages deployment below.

---

## Cloudflare Pages Setup

### 1. Build Configuration

In your Cloudflare Pages project settings, configure:

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty or use root)

### 2. Environment Variables

You **must** set the following environment variables in your Cloudflare Pages project:

#### Required for Frontend (Build-time variables)

These variables must be set for **both Production and Preview** environments as they are embedded into the client bundle during build:

- **Variable name**: `VITE_CLERK_PUBLISHABLE_KEY`
  - **Value**: Your Clerk publishable key (starts with `pk_test_` or `pk_live_`)
  - **Get from**: https://dashboard.clerk.com → Your Application → API Keys
  - **CRITICAL**: This MUST be set in Cloudflare Pages environment variables, not just GitHub secrets
  - **Why**: Vite embeds `VITE_*` variables at build time into the client bundle
  - **Note**: This is a public key and safe to expose in client code

#### Required for Backend (Runtime variables)

- **Variable name**: `GEMINI_API_KEY`
  - **Value**: Your Google Gemini API key
- **Variable name**: `DATABASE_URL`
  - **Value**: Your database connection string
  - **Format Options**:
    - **Prisma Accelerate** (Recommended for Edge): `prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY`
      - Provides connection pooling and caching optimized for edge runtime
      - Get API key from: https://www.prisma.io/data-platform/accelerate
    - **Direct PostgreSQL**: `postgresql://user:pass@host:port/db?pgbouncer=true`
      - Works with Supabase, Neon, or any PostgreSQL provider
      - Use connection pooling (?pgbouncer=true) for better performance
  - **Note**: When using Prisma Accelerate extension with `prisma://` URL, you get automatic edge compatibility
- **Variable name**: `CLERK_SECRET_KEY`
  - **Value**: Your Clerk authentication secret key (starts with `sk_test_` or `sk_live_`)
  - **Get from**: https://dashboard.clerk.com → Your Application → API Keys
  - **CRITICAL**: Both `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` must be from the SAME Clerk application
  - **Security**: This is a secret key and should never be exposed in client code

#### How to set environment variables in Cloudflare Pages:

1. Go to your Cloudflare dashboard
2. Select your Pages project
3. Go to **Settings** → **Environment variables**
4. Click **Add variable**
5. Add each variable (example for Clerk):
   - Name: `VITE_CLERK_PUBLISHABLE_KEY`
   - Value: `pk_test_xxxxx` (your actual publishable key)
   - Select environment: **Production** and **Preview** (check both)
   - Click **Save**
6. Repeat for all required variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` (Production + Preview)
   - `CLERK_SECRET_KEY` (Production + Preview)
   - `GEMINI_API_KEY` (Production + Preview)
   - `DATABASE_URL` (Production + Preview)
7. After adding all variables, trigger a new deployment for changes to take effect

**Important Notes:**

- Variables prefixed with `VITE_` (like `VITE_CLERK_PUBLISHABLE_KEY`) are embedded at **build time**
- You must set them in Cloudflare Pages, not just in GitHub secrets
- After adding or changing `VITE_*` variables, redeploy to rebuild the app with new values
- Backend variables (without `VITE_` prefix) are available at runtime only

### 3. Node.js Version

The project uses Node.js 22.12.0. Cloudflare Pages will automatically detect and use the appropriate version based on your package.json engines field or their default version.

### 4. Database Edge Runtime Compatibility

Cloudflare Pages Functions run on Edge Runtime, which doesn't support the standard Prisma Client (Node.js APIs and Rust binary engine). This project uses **Prisma Accelerate** for edge compatibility:

- **Edge Client**: `@prisma/client/edge`
- **Extension**: `@prisma/extension-accelerate`
- **Database**: Compatible with any PostgreSQL provider (Supabase, Neon, etc.)

**Setup:**

1. The edge-compatible Prisma client is created via `functions/api/_shared/prisma-edge.ts`
2. All Cloudflare Functions use `createEdgePrismaClient(env.DATABASE_URL)` instead of `new PrismaClient()`
3. The DATABASE_URL can be:
   - **Prisma Accelerate URL** (recommended): `prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY`
     - Sign up at https://www.prisma.io/data-platform/accelerate
     - Provides connection pooling, caching, and edge optimization
   - **Standard PostgreSQL URL**: `postgresql://user:pass@host:port/db?pgbouncer=true`
     - Works but without Accelerate features
     - Use connection pooling for better performance

**Important:**

- If you add new Cloudflare Functions that need database access, always use `createEdgePrismaClient()` from `functions/api/_shared/prisma-edge.ts` instead of instantiating `PrismaClient` directly.
- The error "the URL must start with the protocol prisma://" indicates you're using Accelerate extension but haven't configured a Prisma Accelerate URL. Either:
  1. Set up Prisma Accelerate and use `prisma://` URL, OR
  2. Use a standard PostgreSQL connection string (the extension will work but without Accelerate features)

## How It Works

### Cloudflare Pages Functions

Cloudflare Pages automatically deploys any TypeScript/JavaScript files in the `/functions` directory as serverless functions:

- **File**: `/functions/geminiProxy.ts`
- **Endpoint**: `/geminiProxy` (file name becomes the URL path)
- **Method**: POST (via `onRequestPost` export)

### Function Interface

Cloudflare Pages functions export handler functions named by the HTTP method:

- `onRequestPost` - handles POST requests
- `onRequestGet` - handles GET requests
- `onRequestOptions` - handles OPTIONS requests (for CORS preflight)
- `onRequest` - handles all HTTP methods

The function receives a context object with:

```typescript
{
  request: Request,  // Standard Fetch API Request
  env: {             // Environment variables
    GEMINI_API_KEY: string
  }
}
```

**Important**: The function uses direct Fetch API calls to the Gemini API instead of the `@google/generative-ai` SDK, as the SDK requires Node.js APIs that are not available in Cloudflare Workers. This ensures compatibility with the Cloudflare Workers runtime environment.

## Testing

After deployment:

1. Verify the function is deployed:
   - Check Cloudflare Pages dashboard for successful deployment
   - Look for "Functions" in the deployment details

2. Test the endpoint:
   - The application should automatically use the new endpoint
   - Check browser console for any errors
   - Verify questions are being generated successfully

## Tailwind CSS Setup

The application now uses Tailwind CSS v4 with PostCSS instead of the CDN version.

### Files Added/Modified:

- `tailwind.config.js` - Tailwind configuration with content paths
- `postcss.config.js` - PostCSS configuration with Tailwind plugin
- `index.css` - Added Tailwind directives (`@tailwind base/components/utilities`)
- `index.html` - Removed CDN script tag

### Build Process:

1. Vite processes `index.css` through PostCSS
2. PostCSS runs the `@tailwindcss/postcss` plugin
3. Tailwind scans content files and generates utility classes
4. Final CSS is bundled and minified into `dist/assets/index-*.css`

This approach:

- ✅ Eliminates the production CDN warning
- ✅ Reduces bundle size (only used utilities are included)
- ✅ Enables custom Tailwind configurations
- ✅ Works properly with Vite's build process

## Troubleshooting

### Error: "Missing Publishable Key for Clerk!"

**Symptom:** App fails to load with error about missing Clerk publishable key in preview/production

**Cause:** `VITE_CLERK_PUBLISHABLE_KEY` is not set in Cloudflare Pages environment variables

**Solution:**

1. Go to Cloudflare Dashboard → Your Pages Project → Settings → Environment Variables
2. Add variable:
   - Name: `VITE_CLERK_PUBLISHABLE_KEY`
   - Value: Your Clerk publishable key (get from https://dashboard.clerk.com)
   - Environment: Check **both** Production and Preview
3. Click **Save**
4. Trigger a new deployment (Cloudflare will rebuild with the new environment variable)

**Why this happens:**

- Vite embeds `VITE_*` variables into the client bundle at **build time**
- Having the key in GitHub secrets alone is not enough - it must be in Cloudflare Pages
- After adding the variable, you **must redeploy** for it to take effect

**Verification:**

- After deployment, the app should load without the Clerk error
- Check browser console - you should see Clerk initialized messages
- You should be able to sign in/sign up

### Error: "GEMINI_API_KEY environment variable is not set"

- Make sure you've set the `GEMINI_API_KEY` environment variable in Cloudflare Pages
- Redeploy after setting the environment variable

### Error: 404 on /geminiProxy

- Verify the `/functions/geminiProxy.ts` file is in your repository
- Check Cloudflare Pages deployment logs for function deployment status
- Ensure the build was successful
- Cloudflare Pages automatically detects functions - no manual route configuration needed

### Questions not generating

- Check browser console for errors
- Verify your Gemini API key is valid and has quota available
- Check Cloudflare Pages function logs for errors
- Verify the function is calling the correct Gemini API endpoint

### Tailwind styles not working

- Ensure `npm install` was run to install Tailwind dependencies
- Check that `postcss.config.js` and `tailwind.config.js` exist
- Verify `index.css` contains the Tailwind directives
- Run `npm run build` and check for PostCSS errors

### Authentication errors (401 Unauthorized)

- Verify both `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are from the **same** Clerk application
- Check that both keys are for the same environment (both test or both live)
- Mismatched keys will cause token verification failures

## Cloudflare Pages Functions Key Features

| Feature            | Implementation                                                   |
| ------------------ | ---------------------------------------------------------------- |
| Functions location | `/functions/` directory                                          |
| Function export    | `export async function onRequestPost(context)` for POST requests |
| Environment vars   | Accessed via `context.env`                                       |
| Endpoint path      | `/functionName` (based on file name)                             |
| Request/Response   | Standard Fetch API                                               |
| Runtime            | Cloudflare Workers with `nodejs_compat` flag                     |
| API Client         | Must use Fetch API for external calls                            |
| CSS Processing     | Configured via PostCSS                                           |

## Additional Resources

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
