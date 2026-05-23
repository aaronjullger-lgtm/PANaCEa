# PANaCEa Deployment Infrastructure

**Production target:** Cloudflare Pages with Pages Functions.  
**CI/CD:** GitHub Actions → auto-deploy on push to main (`ci.yml` + `deploy.yml`).  
**Legacy server docs:** PM2, systemd, and Express server scripts in this directory are **retained for reference only**. They describe a pre-Cloudflare deployment model that is not in active use.

## Directory Structure

```
deployment/
├── scripts/          # Deployment automation scripts (legacy — see notes)
│   ├── deploy.sh              # Legacy PM2/Express deploy
│   ├── monitor.sh             # Legacy system monitoring
│   ├── verify-deployment.sh   # Legacy deployment verification
│   └── job-stats.ts           # Job queue statistics
├── systemd/          # Linux systemd service files (legacy)
├── cron/             # Legacy cron job configs (retired — GitHub Actions lanes used now)
├── DEPLOYMENT_CHECKLIST.md   # Current production deployment checklist
├── SMOKE_TEST_CHECKLIST.md   # Post-deployment smoke test checklist
├── MIGRATION_GUIDE.md        # Database migration guide
└── README.md                 # This file
```

## Quick Start — Deploying to Cloudflare Pages

### 1. Verify Production Build

```bash
npm run build              # Build frontend
npm run build:check-size   # Verify bundle size budget
```

### 2. Test Locally (Production Parity)

```bash
npm run pages:serve                           # Wrangler pages dev
BASE_URL=http://localhost:8788 npm run verify:health  # API health check
```

### 3. Deploy via CI (Recommended)

Push to `main` → GitHub Actions runs `ci.yml` → on success, `deploy.yml` deploys to Cloudflare Pages.

### 4. Manual Deploy (CLI)

```bash
npm run deploy:local       # Build + deploy to Cloudflare Pages
```
Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in env.

### 5. Verify Deployment

```bash
curl https://studypanacea.com/api/health
# Expected: {"status":"ok","checks":{"functionDeployed":{"status":"pass",...}}}
```

Full smoke: follow [SMOKE_TEST_CHECKLIST.md](./SMOKE_TEST_CHECKLIST.md).

## Deployment Methods

### Cloudflare Pages (Production)

Cloudflare Pages serves static assets (`dist/`) and API endpoints (`functions/api/`).  
**Build command:** `npm run build` | **Output dir:** `dist` | **Git integration:** connected to GitHub.

See `docs/deployment/CLOUDFLARE_DEPLOYMENT.md` for full Cloudflare setup details.

### Legacy: PM2 / Systemd / Express Server (Not in active use)

The `deploy.sh`, systemd services, and monitoring scripts describe a pre-Cloudflare
Express + PM2 deployment model. They are preserved for reference but are not the
current production deployment method.

### Local Development

```bash
npm run dev:all           # Express backend + Vite frontend
npm run dev:wrangler      # Build + Cloudflare Pages Functions (production parity)
npm run dev               # Vite frontend only (proxies to Express)
```

## Configuration

### Environment Variables

All secrets are set in Cloudflare Dashboard (Pages → Settings → Environment Variables).
See `.env.example` for the full list of required/optional variables.

**Required in Cloudflare Dashboard:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `CLERK_SECRET_KEY` | Clerk backend auth |
| `GEMINI_API_KEY` | Google Gemini AI |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access |

**Build-time variables (VITE_ prefix):** Set in Cloudflare Dashboard, or let `scripts/inject-wrangler-env.js` inject from `wrangler.toml [vars]` during build.

### Database Migration

```bash
npx prisma generate
npx prisma migrate dev       # Development
npx prisma migrate deploy    # Production (run in CI via deploy.yml)
npx prisma migrate status    # Check migration status
```

## Monitoring

### Cloudflare Dashboard

- **Real-time logs:** Pages → [Project] → Functions → Real-time logs
- **Analytics:** Pages → [Project] → Analytics (requests, errors, bandwidth)
- **Deploy history:** Pages → [Project] → Deployments

### Sentry (Error Tracking)

Production errors surface in Sentry. Source maps are uploaded during CI deploys.

### Health Check

```bash
# Local Wrangler
BASE_URL=http://localhost:8788 npm run verify:health

# Production
curl https://studypanacea.com/api/health
```

## Troubleshooting

### Common Issues

**1. Database connection fails in Functions**

- Check `DATABASE_URL` is set in Cloudflare Dashboard env vars
- Verify connection pooling is enabled (`?pgbouncer=true`)
- Check Functions real-time logs for Prisma errors

**2. Clerk auth fails (401)**

- Verify `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` are from the same Clerk instance
- Check the production domain is in Clerk's allowed origins
- Set `CLERK_AUTH_DEBUG=true` to diagnose "token-not-active-yet" (clock skew)

**3. Gemini API returns errors**

- Verify `GEMINI_API_KEY` is set in Cloudflare Dashboard
- Check Google AI Studio for quota usage
- Rate limiting on `/api/gemini` is handled by `RATE_LIMIT_KV`

**4. Build too large for Cloudflare Pages**

- Run `npm run build:check-size` to check budget
- Pages free tier: 1 build/min, 500 builds/month, 25MB per file limit

**5. Prisma Client not generated**

```bash
npx prisma generate
ls -la node_modules/@prisma/client
```

## Rollback Procedure

**Cloudflare Pages rollback (instant):**

1. Cloudflare Dashboard → Pages → [Project] → Deployments
2. Find the previous working deployment
3. Click "..." → "Rollback to this deployment"

**Database rollback (if migration caused issues):**

```bash
npx prisma migrate status
npx prisma migrate resolve --rolled-back <migration_name>
# Or restore from pg_dump backup
```

## Security Checklist

- [ ] All secrets in Cloudflare Dashboard, never committed
- [ ] No `process.env` in Edge functions (use `context.env`)
- [ ] CSP headers configured in `public/_headers`
- [ ] Rate limiting active via `RATE_LIMIT_KV`
- [ ] Clerk webhook verification enabled
- [ ] Supabase RLS policies enabled

## Resources

- **Cloudflare Deployment Guide:** `docs/deployment/CLOUDFLARE_DEPLOYMENT.md`
- **Production Checklist:** `deployment/DEPLOYMENT_CHECKLIST.md`
- **Smoke Test Checklist:** `deployment/SMOKE_TEST_CHECKLIST.md`
- **CI/CD Configuration:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- **Wrangler Config:** `wrangler.toml`
- **Build Config:** `vite.config.ts`

## Support

For deployment issues:

1. Check Cloudflare Pages → Functions → Real-time logs
2. Run `npm run verify:health` against the deployed URL
3. Check Sentry for runtime errors
4. Review CI logs on GitHub Actions
