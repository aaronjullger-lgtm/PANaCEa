# Cloudflare Pages Environment Variable Setup

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
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_xxxxx` (your actual key) | Production + Preview |
| `CLERK_SECRET_KEY`           | `sk_test_xxxxx` (your actual key) | Production + Preview |
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

## Complete Environment Variable Checklist

For a fully functional deployment, set these in Cloudflare Pages Environment Variables:

### Frontend (Build-time - Required)

- [ ] `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication (client)
- [ ] `VITE_GEMINI_API_KEY` - If using Gemini from client (optional)
- [ ] `VITE_SUPABASE_URL` - If using Supabase client (optional)
- [ ] `VITE_SUPABASE_ANON_KEY` - If using Supabase client (optional)

### Backend (Runtime - Required)

- [ ] `CLERK_SECRET_KEY` - Clerk authentication (server)
- [ ] `GEMINI_API_KEY` - Gemini API access
- [ ] `DATABASE_URL` - PostgreSQL connection string

### Backend (Runtime - Optional)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` - For admin Supabase operations
- [ ] `SMTP_*` - Email configuration (if using)

---

## Testing Locally vs. Production

### Local Development (.env file)

```bash
# Copy example
cp .env.example .env

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

## Need Help?

- **Clerk Setup:** See `AUTHENTICATION_SETUP.md`
- **Full Deployment:** See `CLOUDFLARE_DEPLOYMENT.md`
- **Database Setup:** See `DATABASE_MIGRATION.md`
