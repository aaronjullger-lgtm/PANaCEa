# Quick Start: Fix "Table Does Not Exist" Error

## The Problem

You deployed to Cloudflare Pages and see this error:

```
Error: The table `public.User` does not exist in the current database.
```

## The Solution (3 Steps)

### Step 1: Set Up Your Database Connection

Create a `.env` file locally:

```bash
DATABASE_URL="postgresql://your-production-database-url"
```

**Where to get your database URL:**

- **Supabase:** Dashboard → Settings → Database → Connection String (Direct)
- **Neon:** Dashboard → Connection Details → Connection String
- **Other:** Your PostgreSQL provider's connection string

**Important:** Use the **direct connection** (port 5432), NOT the pooler (port 6543)

### Step 2: Run the Migration

```bash
# Install dependencies if you haven't already
npm install

# Run the migration script
npm run migrate:production
```

The script will:

1. ✅ Check your database connection
2. ✅ Show what tables exist vs. what's missing
3. ✅ Ask for confirmation
4. ✅ Apply all database migrations
5. ✅ Verify everything worked

**Expected output:**

```
✅ Database connection successful
📊 Database Status:
   - Total tables found: 0
   - User table exists: ❌
   - Missing tables: 40

Do you want to proceed with the migration? (yes/no): yes

🚀 Applying database migration...
✅ Migration applied successfully!
✅ All expected tables are present!
```

### Step 3: Configure Cloudflare Pages

1. Go to your Cloudflare Pages dashboard
2. Navigate to: Settings → Environment variables
3. Add these variables:

```
DATABASE_URL = postgresql://your-connection-string-with-pooler:6543
CLERK_SECRET_KEY = sk_live_xxxxx
GEMINI_API_KEY = your-gemini-key
```

**Note:** For Cloudflare Pages runtime, you CAN use the pooled connection (port 6543)

4. Redeploy your application

### Step 4: Verify It Works

Visit your deployed site and test:

- ✅ Sign up for an account
- ✅ Sign in
- ✅ Answer a practice question
- ✅ Refresh the page - your data should persist!

---

## That's It! 🎉

Your application should now be fully functional.

## Need More Help?

- **Detailed guide:** [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)
- **Deployment checklist:** [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- **Troubleshooting:** See DATABASE_MIGRATION.md troubleshooting section

## Common Questions

**Q: Can I run the migration multiple times?**
A: Yes! It's safe to run multiple times. It will skip tables that already exist.

**Q: Will this delete my existing data?**
A: No! The migration only creates tables. Existing data is preserved.

**Q: What if I don't want to run the script?**
A: You can manually run: `npx prisma migrate deploy` or execute the SQL directly (see DATABASE_MIGRATION.md)

**Q: Which database providers work?**
A: Any PostgreSQL database: Supabase, Neon, Railway, AWS RDS, etc.

**Q: Do I need to do this for development?**
A: Not required for local development. The app can use mock data locally.

**Q: What if the migration fails?**
A: Check the troubleshooting section in DATABASE_MIGRATION.md. Common issues:

- Wrong DATABASE_URL
- Insufficient permissions
- Database not accepting connections

## Visual Guide

```
┌─────────────────────────────────────────┐
│  1. Set DATABASE_URL in .env            │
│     └─> Points to your production DB   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  2. Run: npm run migrate:production     │
│     ├─> Checks connection               │
│     ├─> Shows current state             │
│     ├─> Asks for confirmation           │
│     ├─> Applies migrations              │
│     └─> Verifies success                │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  3. Set DATABASE_URL in Cloudflare      │
│     └─> Use pooled connection (6543)   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  4. Redeploy on Cloudflare Pages        │
│     └─> App now works! ✅               │
└─────────────────────────────────────────┘
```

## What Gets Created

The migration creates **40+ tables** including:

### Core Tables

- **User** - Authentication and profiles
- **PerformanceRecord** - Quiz results
- **SRSItem** - Spaced repetition data
- **SavedQuestion** - Flagged questions

### Content Tables

- **Condition** - Medical conditions
- **MediaAsset** - Images and diagrams
- **MedicalContent** - CMS content
- **PreGeneratedQuestion** - Question pool

### Plus 30+ more tables for advanced features!

Total: **1,290 lines of SQL** creating a complete application database.

---

## Success Indicators

✅ Migration script completes without errors
✅ Database has 40+ tables
✅ Can view tables in `npx prisma studio`
✅ Cloudflare Pages deploys successfully
✅ No more "table does not exist" errors
✅ User can sign up and data persists

**You're ready to go!** 🚀
