# Cloudflare Deployment Troubleshooting Checklist

This checklist helps diagnose and resolve Cloudflare Pages deployment issues.

## 🔍 Diagnostic Steps

### 1. Check Deployment Status

```bash
# View recent deployments
gh run list --workflow=deploy.yml --limit=5

# Get logs from last deployment
gh run view [RUN_ID] --log

# Check Cloudflare Dashboard
# https://dash.cloudflare.com → Workers & Pages → panacea
```

### 2. Identify Error Type

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| 8000119 | Project blocked | Contact abusereply@cloudflare.com |
| 8000103 | Rate limit exceeded | Wait and retry, reduce frequency |
| 8000007 | Authentication failed | Check CLOUDFLARE_API_TOKEN |
| 8000000 | Generic API error | Check Cloudflare status page |

### 3. Common Issues

#### ❌ Project Blocked (8000119)

**Symptoms:**
- Build succeeds but upload fails
- Error: "Your Pages project has been blocked"

**Resolution:**
- See [CLOUDFLARE_DEPLOYMENT_BLOCKED.md](./CLOUDFLARE_DEPLOYMENT_BLOCKED.md)
- Email abusereply@cloudflare.com

#### ❌ Build Fails

**Symptoms:**
- Build fails during `npm run build`
- TypeScript errors
- Vite build errors

**Diagnostics:**
```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run type-check

# Check for linting issues
npm run lint
```

**Common Causes:**
- Missing environment variables (VITE_* vars)
- TypeScript type errors
- Import errors
- Dependency issues

**Resolution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

#### ❌ Environment Variables Missing

**Symptoms:**
- Runtime errors about missing variables
- Authentication failures
- API call failures

**Check Cloudflare Dashboard:**
1. Go to Workers & Pages → panacea
2. Settings → Environment Variables
3. Verify all required variables are set:
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - `GEMINI_API_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY` (build-time)

**Resolution:**
- Add missing variables via Cloudflare Dashboard
- Redeploy after adding variables

#### ❌ Function Errors

**Symptoms:**
- 500 errors on API endpoints
- Function timeouts
- Runtime errors in logs

**Diagnostics:**
```bash
# Test functions locally
npm run dev:wrangler

# Check function logs in Cloudflare Dashboard
# Real-time logs → Select function → View logs
```

**Common Causes:**
- Missing database connection
- Incorrect environment variables
- Prisma client errors
- Timeout issues

#### ❌ Authentication Errors (401)

**Symptoms:**
- All protected endpoints return 401
- "Invalid token" errors
- "Missing CLERK_SECRET_KEY" errors

**Diagnostics:**
```bash
# Check if CLERK_SECRET_KEY is set
# Cloudflare Dashboard → Environment Variables

# Test with curl
curl -H "Authorization: Bearer TOKEN" \
  https://studypanacea.com/api/drugs/all
```

**Resolution:**
- Verify `CLERK_SECRET_KEY` is set in Cloudflare
- Ensure key starts with `sk_live_` (not `pk_live_`)
- Verify key matches `VITE_CLERK_PUBLISHABLE_KEY` project
- Redeploy after adding

#### ❌ Database Errors

**Symptoms:**
- "Table does not exist" errors
- Connection timeouts
- Prisma errors

**Diagnostics:**
```bash
# Check database connection
npm run db:studio

# Verify migrations
npx prisma migrate status
```

**Resolution:**
```bash
# Apply migrations
npm run migrate:production

# Regenerate Prisma client
npm run db:generate
```

#### ❌ Build Size Too Large

**Symptoms:**
- Slow deployments
- Upload timeouts
- Warnings about asset sizes

**Check Current Size:**
```bash
npm run build
du -sh dist/
du -sh functions/
```

**Optimization:**
```bash
# Analyze bundle
npm run build -- --analyze

# Check large files
find dist -type f -size +1M -exec ls -lh {} \;
```

**Resolution:**
- Enable code splitting
- Lazy load heavy components
- Optimize images
- Remove unused dependencies

#### ❌ KV Namespace Errors

**Symptoms:**
- "KV namespace not found" errors
- Rate limiting not working
- Cache errors

**Check KV Namespaces:**
```bash
# List KV namespaces
npx wrangler kv:namespace list

# Expected namespaces:
# - RATE_LIMIT_KV (id: 7df124d8b81f400eafe6ba55477bf11d)
# - CACHE (id: b576c43270a3407a8e5ae65afad0fe7e)

# Expected D1 database (wrangler.toml [[d1_databases]]):
# - EDGE_DB → panacea-edge (id: 5d8d23a1-3a32-42e4-aa7e-278c55469f1a)
```

**Resolution:**
- Verify IDs in wrangler.toml match Dashboard
- Create missing namespaces if needed

---

## 🛠️ Preventive Measures

### Best Practices

1. **Deployment Frequency**
   - Limit to 10-20 deployments per day
   - Batch changes before deploying
   - Use preview branches for testing

2. **Build Optimization**
   - Keep dist/ under 50MB
   - Monitor function count (currently 256)
   - Optimize asset sizes

3. **Environment Variables**
   - Document all required variables
   - Keep secrets in Cloudflare, not code
   - Use encrypted variables for sensitive data

4. **Testing Before Deploy**
   ```bash
   # Always test locally first
   npm run build
   npm run dev:wrangler
   
   # Test functions locally
   npx wrangler pages dev dist
   ```

5. **Monitoring**
   - Check deployment logs regularly
   - Set up Sentry for error tracking
   - Monitor function performance
   - Track deployment success rate

---

## 📊 Health Checks

### Pre-Deployment Checklist

- [ ] Build passes locally: `npm run build`
- [ ] Types check: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Tests pass: `npm test` (if applicable)
- [ ] Functions work locally: `npm run dev:wrangler`
- [ ] Environment variables documented
- [ ] Database migrations applied
- [ ] No secrets in code

### Post-Deployment Verification

- [ ] Deployment completes successfully
- [ ] Health endpoint responds: `curl https://studypanacea.com/api/health`
- [ ] Authentication works
- [ ] Database queries work
- [ ] AI generation works
- [ ] No console errors
- [ ] Check Sentry for errors

### Weekly Maintenance

- [ ] Review deployment logs
- [ ] Check error rates in Sentry
- [ ] Monitor bundle size trends
- [ ] Review function performance
- [ ] Update dependencies
- [ ] Clean up old deployments

---

## 🔗 Resources

### Documentation
- [CLOUDFLARE_DEPLOYMENT_BLOCKED.md](./CLOUDFLARE_DEPLOYMENT_BLOCKED.md) - Block resolution
- [CLOUDFLARE_SETUP_REQUIRED.md](./CLOUDFLARE_SETUP_REQUIRED.md) - Environment setup
- [docs/deployment/CLOUDFLARE_DEPLOYMENT.md](./docs/deployment/CLOUDFLARE_DEPLOYMENT.md) - Full deployment guide
- [docs/deployment/DEPLOYMENT_CHECKLIST.md](./docs/deployment/DEPLOYMENT_CHECKLIST.md) - Pre-deploy checklist

### Cloudflare Resources
- [Pages Docs](https://developers.cloudflare.com/pages/)
- [Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [Troubleshooting](https://developers.cloudflare.com/pages/platform/troubleshooting/)
- [Status Page](https://www.cloudflarestatus.com/)

### Support
- Email: support@cloudflare.com
- Abuse: abusereply@cloudflare.com
- Community: https://community.cloudflare.com
- Discord: https://discord.gg/cloudflaredev

---

## 🆘 When to Escalate

Contact Cloudflare support if:

- ❌ Deployment blocked > 7 days
- ❌ Critical production issue
- ❌ Billing/payment problems
- ❌ Account security concerns
- ❌ Repeated unexplained failures

**Support Channels:**
1. Dashboard ticket: https://dash.cloudflare.com/?to=/:account/support
2. Community forum: https://community.cloudflare.com
3. Email: support@cloudflare.com
4. Twitter: @CloudflareHelp

---

## 📝 Issue Template

When reporting to Cloudflare support, include:

```
ISSUE SUMMARY:
[Brief description]

PROJECT DETAILS:
- Project Name: panacea
- Domain: studypanacea.com
- Account ID: [Your account ID]
- Error Code: [e.g., 8000119]
- Date/Time: [When issue occurred]

DEPLOYMENT INFO:
- Workflow: [GitHub Actions / Manual / Other]
- Build Status: [Success / Failed]
- Upload Status: [Success / Failed]
- Error Message: [Full error message]

TROUBLESHOOTING ATTEMPTED:
- [List what you've tried]

LOGS:
- [Attach relevant logs]

ENVIRONMENT:
- Node Version: 22
- Wrangler Version: [Check with npx wrangler --version]
- Build Output Size: [Check dist/ size]
- Function Count: 256
```

---

**Last Updated:** February 2, 2026  
**Maintained By:** PANaCEa Development Team
