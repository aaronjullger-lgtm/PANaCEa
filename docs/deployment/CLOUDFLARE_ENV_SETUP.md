# Cloudflare Pages Environment Variable Setup

## Production mode and live keys (studypanacea.com)

If the **production site** shows:

- **`[Sentry] Skipped in non-production mode`** – the frontend was built in development mode, so `import.meta.env.PROD` is false.
- **`Clerk: Clerk has been loaded with development keys`** – the bundle was built with `pk_test_...` instead of `pk_live_...`.

**Fix:**

1. **Build command**  
   In Cloudflare Pages → **Settings** → **Builds & deployments** → **Build configuration**, the build command must be **`npm run build`** (no custom command like `npm run dev` or `vite build --mode development`). The repo’s `build` script runs `vite build --mode production` so the app runs in production mode and Sentry initializes.

2. **Clerk keys for Production**  
   `VITE_CLERK_PUBLISHABLE_KEY` is baked in at **build time**. For the **Production** environment:
   - Either **do not set** `VITE_CLERK_PUBLISHABLE_KEY` in Cloudflare (so the build uses `wrangler.toml` [vars], which should be `pk_live_...`), or  
   - Set **Production** env var `VITE_CLERK_PUBLISHABLE_KEY` = your **live** key (`pk_live_...` from [Clerk Dashboard](https://dashboard.clerk.com) → API Keys).  
   If Production has `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_...`, that overrides wrangler and the site will use development keys. After changing, **redeploy** so a new build runs.

3. **503 on /api/dashboard/stats, /api/user/profile, etc.**  
   These are backend/Pages Functions issues (e.g. `DATABASE_URL` or bindings missing, or DB unreachable). Check Cloudflare Pages → **Settings** → **Environment variables** for **Production**: `DATABASE_URL`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY` must be set. Check deployment logs and Functions logs for errors.

---

## Quick Fix for "Missing Publishable Key for Clerk!" Error

If you're seeing this error in your Cloudflare Pages preview or production deployment:

```
ErrorBoundary caught an error: Error: Missing Publishable Key for Clerk!
```

**Follow these steps:**

### Step 1: Add Environment Variable in Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to: **Workers & Pages** → **Your Project** → **Settings** → **Environment variables**
3. Click **Add variable**
4. Add the following:

| Variable Name                | Value                             | Environment          |
| ---------------------------- | --------------------------------- | -------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Production:** `pk_live_...`; **Preview:** `pk_test_...` or same | Production + Preview |
| `CLERK_SECRET_KEY`           | **Production:** `sk_live_...`; **Preview:** `sk_test_...` or same | Production + Preview |
| `GEMINI_API_KEY`             | Your Gemini API key               | Production + Preview |
| `DATABASE_URL`               | Your database connection string   | Production + Preview |

### Step 2: Get Your Clerk Keys

1. Go to https://dashboard.clerk.com
2. Select your application
3. Navigate to **API Keys**
4. Copy both:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)
5. **IMPORTANT:** Both keys must be from the same application and same environment (test/live)

### Step 3: Redeploy

After adding the environment variables:

1. In Cloudflare Pages, go to **Deployments**
2. Click **...** (three dots) on the latest deployment
3. Click **Retry deployment** or **Redeploy**
4. Wait for the build to complete

**Why redeploy?** Variables prefixed with `VITE_` are embedded at build time, so you must rebuild for changes to take effect.

### Step 4: Verify

After deployment completes:

1. Visit your deployed URL
2. App should load without the Clerk error
3. You should be able to sign in/sign up
4. Check browser console for Clerk initialization messages

---

## Why GitHub/Cloudflare Secrets Alone Don't Work

You mentioned having the keys as secrets in GitHub and Cloudflare. Here's why that's not enough:

### GitHub Secrets

- ✅ Used for GitHub Actions workflows
- ❌ NOT available to Cloudflare Pages builds
- **Use case:** Running automation scripts, tests in CI/CD

### Cloudflare Secrets (Workers/Pages)

- Must be set as **Environment Variables** in Pages project settings
- ✅ Available during build and runtime
- **Use case:** Building and running the app

### Vite Environment Variables

Vite variables work differently:

| Variable Type | When Loaded    | Where Set                              |
| ------------- | -------------- | -------------------------------------- |
| `VITE_*`      | **Build time** | Cloudflare Pages Environment Variables |
| Regular vars  | **Runtime**    | Cloudflare Pages Environment Variables |

**Key Point:** `VITE_CLERK_PUBLISHABLE_KEY` is embedded into your JavaScript bundle during the build process. If it's not set when Cloudflare builds your app, the bundle won't contain it.

---

## wrangler.toml and Secrets

**Prefer Cloudflare Dashboard for secrets.** The `[vars]` section in `wrangler.toml` is committed to version control. Use it only for non-sensitive, build-time values (e.g. `VITE_API_URL`). For production:

- Set `CLERK_SECRET_KEY`, `GEMINI_API_KEY`, `DATABASE_URL` in Cloudflare Dashboard > Environment Variables
- Consider moving `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_*`, `VITE_SENTRY_DSN` to Dashboard as well for easier key rotation

### Where production keys come from (no dev keys in production)

- **Cloudflare Pages build:** Environment variables are read in this order:
  1. **Cloudflare Dashboard** → Your project → Settings → Environment variables (Build). If you set `VITE_CLERK_PUBLISHABLE_KEY` here, that value is used.
  2. **wrangler.toml `[vars]`:** The build runs `node scripts/inject-wrangler-env.js` before `vite build`. That script writes `VITE_*` from wrangler `[vars]` into `.env.production.local`. Dashboard values override: the script uses `process.env` (Cloudflare-injected) when present, otherwise the value from wrangler.toml.
- **Never rely on a committed `.env` for production.** Use Dashboard or wrangler.toml (for non-secret `VITE_*` only). If the app detects a production host (e.g. studypanacea.com) but the publishable key is `pk_test_*`, it shows a setup page asking you to set `VITE_CLERK_PUBLISHABLE_KEY` to a live key in Cloudflare (or via the inject script’s source, wrangler).

## Complete Environment Variable Checklist

For a fully functional deployment, set these in Cloudflare Pages Environment Variables:

### Frontend (Build-time - Required)

- [ ] `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication (client)
- [ ] `VITE_API_URL` - API base URL for client requests (e.g. `https://studypanacea.com`); also in `wrangler.toml` [vars] for non-secret
- [ ] `VITE_SUPABASE_URL` - If using Supabase client (optional)
- [ ] `VITE_SUPABASE_ANON_KEY` - If using Supabase client (optional)

### Backend (Runtime - Required)

- [ ] `CLERK_SECRET_KEY` - Clerk authentication (server)
- [ ] `GEMINI_API_KEY` - Gemini API access
- [ ] `DATABASE_URL` - PostgreSQL connection string (use Prisma Accelerate for Edge)

### Sentry (Build-time - Optional, for source maps)

- [ ] `SENTRY_AUTH_TOKEN` - Sentry API token
- [ ] `SENTRY_ORG` - Sentry organization slug
- [ ] `SENTRY_PROJECT` - Sentry project slug
- [ ] `SENTRY_UPLOAD=true` - Enable source map upload

### Backend (Runtime - Optional)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` - For admin Supabase operations
- [ ] `ADMIN_USER_IDS` - Comma-separated Clerk IDs for admin access
- [ ] `SUPERADMIN_USER_IDS` - Comma-separated Clerk IDs for superadmin
- [ ] `SMTP_*` - Email configuration (if using)

### Sentry source map upload (Build - Optional)

Source map upload runs only when `SENTRY_UPLOAD=true` and `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are set. If the build logs "Project not found", ensure `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry project (e.g. org slug and project slug). To skip upload entirely, omit `SENTRY_UPLOAD` or set it to `false`. The build continues even when upload fails.

---

## Testing Locally vs. Production

### Local Development (.env file)

```bash
# Copy example (see env.example in project root)
cp env.example .env

# Add your keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
GEMINI_API_KEY=your_key
DATABASE_URL=postgresql://...

# Start dev server
npm run dev
```

### Cloudflare Pages (Environment Variables UI)

- Same variables, but set through Cloudflare dashboard
- Must be set for BOTH Production and Preview environments
- Remember to redeploy after changes

---

## Common Mistakes

1. **Setting only in GitHub secrets** ❌
   - GitHub secrets are for GitHub Actions only
   - Not accessible to Cloudflare builds

2. **Setting only for Production environment** ❌
   - Preview deployments (PRs) won't have the variables
   - Always set for both Production AND Preview

3. **Forgetting to redeploy after adding `VITE_*` variables** ❌
   - Build-time variables require a rebuild
   - Click "Retry deployment" after adding them

4. **Using mismatched Clerk keys** ❌
   - Publishable and secret keys must be from same app
   - Both must be for same environment (test or live)

---

## Code / repo reference

- **Cloudflare env types:** `functions/api/_shared/types.ts` — `CloudflareEnv` must match `wrangler.toml` bindings (e.g. `RATE_LIMIT_KV`, `CACHE`) and Dashboard variables (`DATABASE_URL`, `GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `SUPABASE_*`, `SENTRY_DSN`, `ENVIRONMENT`).
- **Vite env types:** `types/vite-env.d.ts` — `ImportMetaEnv` lists all `VITE_*` variables used by the client. Use `import.meta.env.VITE_*` in frontend code; never `process.env` in browser bundles.
- **Functions:** Use `context.env` (or the `env` param) in `functions/api/**`; do not use `process.env` in Edge handlers (use Dashboard or `.dev.vars` for local).

## Need Help?

- **Clerk Setup:** See `AUTHENTICATION_SETUP.md`
- **Full Deployment:** See `CLOUDFLARE_DEPLOYMENT.md`
- **Database Setup:** See `DATABASE_MIGRATION.md`
