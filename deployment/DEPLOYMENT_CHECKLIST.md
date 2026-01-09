# PANaCEa Production Deployment Checklist

> **Last Updated:** January 8, 2026  
> **Target Platform:** Cloudflare Pages

---

## 📋 Pre-Deployment Checklist

### 1. Environment Variables (Cloudflare Dashboard)

**Navigate:** Cloudflare Dashboard → Pages → [Your Project] → Settings → Environment Variables

#### Required Secrets (Production)
| Variable | Type | Where to Get |
|----------|------|--------------|
| `DATABASE_URL` | Secret | Supabase → Project → Settings → Database → Connection String (with `?pgbouncer=true&connection_limit=1`) |
| `CLERK_SECRET_KEY` | Secret | Clerk Dashboard → API Keys → Secret keys |
| `CLERK_WEBHOOK_SECRET` | Secret | Clerk Dashboard → Webhooks → Signing secret |
| `GEMINI_API_KEY` | Secret | Google AI Studio → API Keys |

#### Required Variables (Non-Secret)
| Variable | Type | Value |
|----------|------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Variable | `pk_live_...` (from Clerk Dashboard) |
| `APP_VERSION` | Variable | `1.0.0` (or current version) |
| `NODE_ENV` | Variable | `production` |

#### Optional Variables
| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Error monitoring |
| `CACHE` | KV namespace binding (for caching) |
| `RATE_LIMIT_KV` | KV namespace binding (for distributed rate limiting) |

### 2. KV Namespaces (Optional but Recommended)

Create these KV namespaces in Cloudflare:
```bash
# Via CLI
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "RATE_LIMIT_KV"
```

Add bindings to `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<namespace-id>"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<namespace-id>"
```

### 3. Database Preparation

- [ ] Run all pending migrations: `npx prisma migrate deploy`
- [ ] Verify database connectivity: `npx prisma db pull --print`
- [ ] Check RLS policies are enabled (if configured)
- [ ] Verify connection pooling is enabled in Supabase

### 4. Clerk Configuration

- [ ] Verify webhook endpoint: `/api/webhooks/clerk`
- [ ] Add production domain to allowed origins
- [ ] Configure redirect URLs for production domain
- [ ] Enable multi-factor authentication (recommended)

---

## 🚀 Deployment Steps

### Option A: Cloudflare Pages (Git Integration)

1. **Connect Repository**
   - Cloudflare Dashboard → Pages → Create a project
   - Connect to GitHub → Select `PANaCEa` repository
   - Branch: `main`

2. **Build Configuration**
   ```
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   ```

3. **Environment Variables**
   - Add all variables from Pre-Deployment Checklist
   - Click "Save and Deploy"

### Option B: Manual Deployment (CLI)

```bash
# Build locally
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=panacea

# Or using npm script
npm run deploy
```

### Option C: GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: panacea
          directory: dist
```

---

## ✅ Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-domain.pages.dev/api/health

# Expected response (status: 200)
{
  "status": "healthy",
  "checks": {
    "database": { "status": "pass" },
    "cache": { "status": "pass" },
    "environment": { "status": "pass" }
  }
}
```

### 2. Smoke Tests (Manual)

Run through the [SMOKE_TEST_CHECKLIST.md](./SMOKE_TEST_CHECKLIST.md) after each deployment.

### 3. Error Monitoring

- [ ] Verify Sentry is receiving events (trigger a test error)
- [ ] Check Cloudflare Analytics for any 5xx errors
- [ ] Monitor Gemini API usage in Google AI Studio

---

## 🔄 Rollback Procedure

### Cloudflare Pages Rollback
1. Go to Cloudflare Dashboard → Pages → [Your Project] → Deployments
2. Find the previous working deployment
3. Click the "..." menu → "Rollback to this deployment"

### Database Rollback (if needed)
```bash
# List migrations
npx prisma migrate status

# Rollback last migration (DANGEROUS - requires manual down.sql)
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## 🔐 Security Checklist

- [ ] All secrets stored in Cloudflare, NOT in code
- [ ] No `VITE_` prefix on sensitive variables (except publishable key)
- [ ] CORS configured correctly in `_headers` file
- [ ] Rate limiting enabled on Gemini endpoints
- [ ] RLS policies active in Supabase
- [ ] Clerk webhook signature verification enabled

---

## 📊 Performance Checklist

- [ ] Build output is optimized (`npm run build` shows no warnings)
- [ ] Images are compressed and served from Supabase CDN
- [ ] Code splitting is working (check Network tab for lazy-loaded chunks)
- [ ] Cache headers are set correctly for static assets

---

## 🐛 Common Issues & Solutions

### Issue: Database connection fails
**Solution:** Check `DATABASE_URL` includes `?pgbouncer=true&connection_limit=1`

### Issue: Clerk authentication fails
**Solution:** Verify `VITE_CLERK_PUBLISHABLE_KEY` is the LIVE key (not test) and domain is whitelisted

### Issue: Gemini API returns 429
**Solution:** Check rate limits, consider upgrading API quota in Google AI Studio

### Issue: Functions return 500
**Solution:** Check Cloudflare Pages → Functions → Real-time logs for error details

---

*Maintained by: PANaCEa Engineering Team*
- [ ] Document the problem
