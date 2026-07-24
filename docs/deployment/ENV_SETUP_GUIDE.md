# Environment Variables Setup Guide

This guide helps you configure all required environment variables for PANaCEa.

## 🔑 Required Variables (Must Configure)

### 1. Clerk Authentication

**Get your keys:**
1. Go to [clerk.com](https://clerk.com) and sign in
2. Select your project (or create one)
3. Go to **API Keys** in the dashboard
4. Copy your keys

**Add to `.env`:**
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  # Your publishable key
CLERK_SECRET_KEY=sk_test_...            # Your secret key
CLERK_WEBHOOK_SECRET=whsec_...          # Your webhook secret
```

### 2. Database (Supabase + Prisma)

**Get your database URL:**
1. Go to [supabase.com](https://supabase.com) and sign in
2. Select your project
3. Go to **Settings → Database**
4. Copy the **Connection string** (choose "Transaction" mode for Prisma Accelerate)

**For Prisma Accelerate (recommended for edge):**
1. Go to [prisma.io/data-platform](https://www.prisma.io/data-platform)
2. Create a project
3. Enable Accelerate
4. Get your Accelerate connection string (starts with `prisma://`)

**Add to `.env`:**
```env
# Prisma Accelerate URL (edge-compatible)
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_KEY

# Direct connection for scripts/migrations
DIRECT_DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

### 3. Google Gemini API

**Get your API key:**
1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Copy it

**Add to `.env`:**
```env
GEMINI_API_KEY=AIza...  # Your Gemini API key
```

## 📦 Optional But Recommended

### 4. Supabase (Storage & Services)

**Already have from step 2 above:**
```env
# Client-side (public)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server-side
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Service role for admin operations
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 5. Sentry (Error Monitoring)

**Setup:**
1. Go to [sentry.io](https://sentry.io) and create a project
2. Get your DSN from project settings

```env
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project
```

### 6. Adobe (PDF Services - for Study Companion)

**Setup:**
1. Go to [developer.adobe.com](https://developer.adobe.com)
2. Create credentials for PDF Services API

```env
ADOBE_CLIENT_ID=your_adobe_client_id
ADOBE_CLIENT_SECRET=your_adobe_client_secret
VITE_ADOBE_CLIENT_ID=your_adobe_client_id
VITE_ADOBE_PDF_EMBED_CLIENT_ID=your_adobe_pdf_embed_client_id
```

## 🔌 MCP Server Authentication

These are for Cursor MCP servers (enter in Cursor UI when prompted):

### GitHub MCP
```env
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```
**Get it:** [github.com/settings/tokens](https://github.com/settings/tokens)

### Supabase Postgres MCP
```env
SUPABASE_ACCESS_TOKEN=your_supabase_database_password
```
**Get it:** Your Supabase database password from Settings → Database

### Cloudflare MCP
```env
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```
**Get it:** Cloudflare Dashboard → API Tokens

### Cloudflare AI Gateway (optional — server-side Gemini routing)

When both values are set in Cloudflare Pages secrets, Gemini calls from Edge handlers and the Vercel AI SDK provider registry route through Cloudflare AI Gateway for caching, analytics, and rate limiting.

```env
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CF_AI_GATEWAY_ID=your_ai_gateway_id
```

Used by `functions/api/_shared/ai-gateway.ts` (`buildGeminiUrl`) and `lib/ai-sdk/providers.ts`. Staging adequacy/critic checks use the centralized `lib/ai/aiGateway.ts` path and benefit from the same `GEMINI_API_KEY` configuration.

## ✅ Verification Steps

### 1. Check Environment Variables Are Loaded

```bash
# Start dev server
npm run dev:wrangler

# In another terminal, test
node -e "console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set')"
```

### 2. Test Database Connection

```bash
# Test Prisma connection
npx prisma db pull
```

### 3. Test Authentication

1. Start the app: `npm run dev:wrangler`
2. Open http://localhost:3000
3. Try to sign in with Clerk

## 🚨 Common Issues

### Issue: "Cannot find module 'clerk'"
**Fix:** Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set (starts with `pk_`)

### Issue: Database connection fails
**Fix:** Check your `DATABASE_URL` format:
- Prisma Accelerate: `prisma://accelerate.prisma-data.net/?api_key=...`
- Direct connection: `postgresql://user:pass@host:5432/dbname`

### Issue: Gemini API errors
**Fix:** 
1. Verify your API key is correct
2. Check quota at [console.cloud.google.com](https://console.cloud.google.com)
3. Ensure billing is enabled

## 📝 Quick Reference

**Minimum required for local dev:**
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
DATABASE_URL=postgresql://...
GEMINI_API_KEY=AIza...
```

**For full functionality, also add:**
- Supabase credentials (storage, auth)
- Sentry (error monitoring)
- Adobe (PDF features)

---

## 🔐 Security Reminders

1. **NEVER commit `.env`** - It's already in `.gitignore`
2. **Rotate keys if exposed** - Immediately regenerate any leaked keys
3. **Use different keys for dev/prod** - Test keys for development, production keys for deployment
4. **Keep `env.example` updated** - Update the example file when adding new variables

---

## 🚀 Next Steps

After configuration:
1. Run `npm run dev:wrangler` to start the backend
2. Run `npm run dev` in another terminal for the frontend
3. Visit http://localhost:3000
4. Test authentication and basic features

Need help? Check:
- [README.md](./README.md) - Full documentation
- [MASTER_DOCUMENTATION.md](./MASTER_DOCUMENTATION.md) - Architecture guide
- [SITE_TEST_REPORT.md](./SITE_TEST_REPORT.md) - Known issues and fixes
