---
name: "panacea-deployment-guard"
description: "Use to work on PANaCEa Cloudflare Pages deployment, Wrangler configuration, KV namespaces, environment variables, CSP headers, redirects, build output, and deployment smoke testing. Trigger when asked about deployment, Wrangler, Cloudflare, production build config, CSP, redirects, or deployment readiness."
---

# PANaCEa Deployment Guard

You own the deployment surface: Wrangler config, Cloudflare Pages build output, CSP/security headers, redirects, KV namespace bindings, environment variable wiring, and deployment smoke gates.

## First Files

- `CLAUDE.md` for deployment architecture
- `wrangler.toml` — deployment configuration
- `vite.config.ts` — build configuration
- `public/_headers` — security headers (CSP, CORS, etc.)
- `public/_redirects` — route redirects (currently removed, Cloudflare built-in SPA fallback)
- `functions/` — Pages Functions directory
- `package.json` — deploy scripts and build commands
- `.env.example` — required environment variables
- `.github/workflows/ci.yml` — CI pipeline
- `docs/deployment/` — deployment documentation

## Architecture

- **Production target:** Cloudflare Pages with Pages Functions
- **Build output:** `dist/` directory (Vite build)
- **Functions:** `functions/` directory (mounted as Pages Functions)
- **KV namespaces:** `RATE_LIMIT_KV`, `CACHE`, and any additional bindings
- **Environment:** Variables set in Cloudflare Dashboard, not committed
- **CI/CD:** GitHub Actions auto-deploy on push to main
- **SPA fallback:** Cloudflare Pages built-in (no `_redirects` self-rewrite needed)

## Rules

- Never commit secrets, API keys, or `.env` files
- Never deploy without running the full verification ladder
- `_headers` CSP must not break the app — test locally before deploying
- Wrangler `pages dev` must serve direct routes and API health without redirect warnings
- Build output size must stay within Cloudflare Pages limits
- Environment variables must be documented in `.env.example` (values only, no secrets)
- Clerk publishable keys differ between local test and production — document both

## Deployment Verification Ladder

Before any deploy:

1. `npm run typecheck` — TypeScript must pass
2. `npm run build` — Production build must complete
3. `npm run build:check-size` — Bundle size within budget
4. `npm run test:critical` — Critical tests pass
5. `npm run lint` — No errors
6. `npm run pages:serve` — Wrangler serves without routing errors
7. `BASE_URL=http://localhost:8788 npm run verify:health` — API health passes
8. Manual smoke: `/study` renders, `/api/health` returns 200

## Common Deployment Issues

- Live Clerk key on localhost returns 400 (documented limitation)
- Missing KV namespace bindings in `wrangler.toml`
- CSP blocking legitimate resources in production
- Build output too large for Cloudflare Pages limits
- Wrangler rejecting malformed `_redirects` rules
- Environment variables missing in Cloudflare Dashboard
- Pages Functions cold starts exceeding limits
- `process.env` usage in Edge functions (must use `context.env`)

## Tests To Look For

- `functions/api/health.ts` — health endpoint
- `e2e/production-smoke/` — production smoke tests
- Build verification: `npm run build` and `npm run build:check-size`
- Wrangler smoke: `npm run verify:health`

## Verification

```bash
npm run build
npm run build:check-size
npm run pages:serve
BASE_URL=http://localhost:8788 npm run verify:health
```
