# Production Deployment Checklist

Use this checklist to ensure a smooth deployment to production.

## Pre-Deployment

### 1. Database Setup ✅

- [ ] **Create PostgreSQL database** (Supabase, Neon, or other provider)
- [ ] **Get database connection strings** (both direct and pooled)
- [ ] **Set up local .env with production DATABASE_URL**
- [ ] **Run database migration:**
  ```bash
  npm run migrate:production
  # OR
  npx prisma migrate deploy
  ```
- [ ] **Verify all tables exist:**
  ```bash
  npx prisma studio
  ```
- [ ] **Expected: 40+ tables including User, PerformanceRecord, SRSItem, etc.**

### 2. Authentication Setup ✅

- [ ] **Create Clerk application** at https://clerk.com
- [ ] **Get Clerk keys:**
  - [ ] `CLERK_SECRET_KEY` (starts with `sk_live_` or `sk_test_`)
  - [ ] `VITE_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_` or `pk_test_`)
- [ ] **Verify keys are from the SAME Clerk application**
- [ ] **Enable desired authentication methods** in Clerk dashboard

### 3. API Keys ✅

- [ ] **Get Gemini API key** from https://ai.google.dev/
- [ ] **Verify API key has available quota**
- [ ] **Test API key locally:**
  ```bash
  npm run dev
  # Try generating a question
  ```

### 4. Local Testing ✅

- [ ] **Install dependencies:** `npm install`
- [ ] **Generate Prisma client:** `npm run db:generate`
- [ ] **Test backend:** `npm run dev:server`
- [ ] **Test frontend:** `npm run dev`
- [ ] **Test authentication flow** (sign up, sign in, sign out)
- [ ] **Test sync endpoint** (create performance record, verify it saves)
- [ ] **Test question generation**

## Cloudflare Pages Deployment

### 5. Create Cloudflare Pages Project ✅

- [ ] **Go to** https://dash.cloudflare.com
- [ ] **Navigate to** Pages > Create a project
- [ ] **Connect to GitHub repository**
- [ ] **Configure build settings:**
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Root directory: `/` (or leave empty)

### 6. Set Environment Variables ✅

Go to **Settings** → **Environment variables** and add:

#### Required Variables

- [ ] **`DATABASE_URL`**

  ```
  postgresql://user:pass@host:6543/db?pgbouncer=true
  ```

  OR for Prisma Accelerate:

  ```
  prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY
  ```

- [ ] **`CLERK_SECRET_KEY`**

  ```
  sk_live_xxxxx (or sk_test_xxxxx for testing)
  ```

- [ ] **`GEMINI_API_KEY`**
  ```
  Your Google Gemini API key
  ```

#### Optional but Recommended

- [ ] **`VITE_APP_URL`** - Your production domain
- [ ] **`NODE_ENV`** - Set to `production`

### 7. Deploy ✅

- [ ] **Trigger first deployment** (push to main branch or click "Deploy" in Cloudflare)
- [ ] **Wait for build to complete** (~2-5 minutes)
- [ ] **Check deployment logs** for errors
- [ ] **Verify "Functions" were deployed** (look for `/api/sync` and others)

## Post-Deployment Verification

### 8. Test Production Application ✅

- [ ] **Access your production URL** (e.g., `https://your-app.pages.dev`)
- [ ] **Verify homepage loads** without errors
- [ ] **Test authentication:**
  - [ ] Sign up with a test account
  - [ ] Verify email (if enabled)
  - [ ] Sign in
  - [ ] Sign out
  - [ ] Sign in again

- [ ] **Test core functionality:**
  - [ ] Navigate to quiz/practice mode
  - [ ] Generate a question
  - [ ] Answer a question
  - [ ] Check that performance is saved (refresh page)
  - [ ] Verify sync is working (data persists after sign out/in)

### 9. Monitor Logs ✅

- [ ] **Check Cloudflare Pages logs** for errors
  - Go to Pages project > **View build** > **Functions**
  - Look for any 500 errors or exceptions
- [ ] **Check browser console** for frontend errors
  - Open browser DevTools > Console
  - Look for red errors

### 10. Database Health Check ✅

- [ ] **Verify data is being saved:**
  ```bash
  npx prisma studio
  # OR check Supabase dashboard
  ```
- [ ] **Check User table** has test user(s)
- [ ] **Check PerformanceRecord table** has quiz records
- [ ] **Verify no connection errors** in Cloudflare logs

## Common Issues & Solutions

### Issue: "The table public.User does not exist"

**Solution:** Database migration wasn't applied. Run:

```bash
npm run migrate:production
```

See [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) for details.

### Issue: "Unauthorized" or 401 errors

**Solution:** Clerk keys mismatch or incorrect configuration.

1. Verify both `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` are from the same Clerk app
2. Check both are for the same environment (test vs live)
3. Redeploy after fixing environment variables

### Issue: Questions not generating

**Solution:**

1. Verify `GEMINI_API_KEY` is set in Cloudflare Pages
2. Check API key has available quota
3. Check Cloudflare Functions logs for detailed errors

### Issue: Data not syncing

**Solution:**

1. Verify `DATABASE_URL` is correctly set
2. Check Cloudflare Functions logs for database connection errors
3. Ensure connection pooling is enabled (`?pgbouncer=true`)
4. For Supabase, verify connection limit isn't exceeded

### Issue: Build fails

**Solution:**

1. Check build logs in Cloudflare Pages
2. Ensure `package.json` is correct
3. Verify Node.js version compatibility
4. Try building locally: `npm run build`

## Maintenance

### Regular Tasks

- [ ] **Monitor error rates** in Cloudflare dashboard
- [ ] **Check database size** and storage usage
- [ ] **Review performance metrics**
- [ ] **Update dependencies** regularly
- [ ] **Backup database** periodically

### Before Major Updates

- [ ] **Test in staging environment** first
- [ ] **Backup production database**
- [ ] **Review migration files** if schema changes
- [ ] **Plan downtime** if needed (usually not required)

## Resources

- [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) - Database setup guide
- [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) - Deployment details
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Database provider setup
- [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md) - Auth configuration

## Getting Help

If you encounter issues:

1. Check the troubleshooting sections in the docs above
2. Review Cloudflare Pages logs
3. Check browser console for errors
4. Verify all environment variables are set correctly
5. Try testing locally with production DATABASE_URL

## Deployment Complete! 🎉

Once all checkboxes are marked:

- ✅ Your database is set up and migrated
- ✅ Your application is deployed to Cloudflare Pages
- ✅ Authentication is working
- ✅ Data is syncing correctly
- ✅ Users can start using PANaCEa!

Remember to:

- Monitor logs for the first few days
- Gather user feedback
- Iterate and improve

Good luck with your production deployment! 🚀
