# Quick Start Guide - User Authentication & Cloud Sync

## What's New? 🎉

Your PANaCEa app now supports:

- 🔐 **User Accounts** - Sign in to save your progress
- ☁️ **Cloud Sync** - Access your data from any device
- 📱 **Multi-Device** - Study on phone, tablet, or computer
- 💾 **No Data Loss** - Your existing progress is automatically migrated

## How to Enable (3 Simple Steps)

### Step 1: Get Your Free Clerk Account (5 minutes)

1. Visit https://clerk.com
2. Sign up (free tier is plenty)
3. Click "Add application"
4. Name it "PANaCEa"
5. Copy your API keys from the dashboard

### Step 2: Get a Free Database (5 minutes)

Choose one (all have generous free tiers):

**Option A: Neon** (Recommended - Serverless)

1. Visit https://neon.tech
2. Create account
3. Create new project
4. Copy connection string

**Option B: Supabase** (Great features)

1. Visit https://supabase.com
2. Create account
3. Create new project
4. Copy "Transaction" connection string

**Option C: Railway** (Simple)

1. Visit https://railway.app
2. Create account
3. Add PostgreSQL service
4. Copy connection string

### Step 3: Configure Your App (2 minutes)

1. **Create environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your keys:**

   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_secret_here
   DATABASE_URL="postgresql://user:password@host/dbname"
   ```

3. **Run database setup:**

   ```bash
   npx prisma migrate dev
   ```

4. **Start your app:**
   ```bash
   npm run dev
   ```

That's it! 🎉

## Using the Feature

### First Time Sign-In

1. Click "Sign In" button in the menu
2. Create your account
3. Your existing progress uploads automatically
4. See "Synced" indicator when complete

### Daily Use

- Study normally - sync happens automatically
- Progress saves every few seconds
- Works offline, syncs when back online
- Sign out anytime without losing data

### On Another Device

1. Open PANaCEa
2. Sign in with same account
3. Your progress appears instantly
4. Continue studying from where you left off

## Troubleshooting

### "Missing Publishable Key for Clerk!" error

- This error appears when the app starts without proper Clerk configuration
- **Solution:**
  1. Create `.env` file: `cp .env.example .env`
  2. Add your Clerk publishable key to `.env`
  3. Restart dev server: `Ctrl+C` then `npm run dev`

### "Sign In button doesn't appear"

- Check `.env` file has correct keys
- Restart dev server: `Ctrl+C` then `npm run dev`
- Clear browser cache

### "Database connection failed"

- Verify `DATABASE_URL` in `.env`
- Check database service is running
- Try connection string in database tool first

### "Data not syncing"

- Check browser console for errors
- Look for cloud icon in menu
- Try signing out and back in
- Check internet connection

## Need More Help?

📚 **Detailed Guides:**

- [Complete Setup Guide](./AUTHENTICATION_SETUP.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Feature Documentation](./CLOUD_SYNC_README.md)
- [Technical Details](./IMPLEMENTATION_SUMMARY_AUTH.md)

💬 **Get Support:**

- Check documentation above
- Review error messages
- Create GitHub issue with details

## Without Authentication

**Don't want to set this up?** No problem!

- App works fine without authentication
- Data stays in your browser (localStorage)
- All features work normally
- Set up later when ready

## Security Notes

⚠️ **Before Production Deployment:**

The current implementation uses simplified JWT verification for development. Before deploying to production:

1. Install `@clerk/backend`: `npm install @clerk/backend`
2. Update JWT verification in `functions/api/sync.ts`
3. See detailed security notes in `AUTHENTICATION_SETUP.md`

**For local development and testing, the current setup is fine!**

## What Gets Synced?

✅ Performance records (quiz history)
✅ Spaced repetition schedules
✅ Missed questions
✅ Flagged questions
✅ Study statistics
✅ Learning streaks

## Deployment to Production

When ready to deploy to Cloudflare Pages:

1. Add environment variables in Cloudflare dashboard:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - `GEMINI_API_KEY` (existing)

2. Update JWT verification (see AUTHENTICATION_SETUP.md)

3. Deploy normally: `npm run build`

---

**Questions?** Check the detailed guides linked above or create an issue on GitHub.

Happy studying! 📚
