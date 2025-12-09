# Database Migration Guide for Production

This guide helps you migrate your PANaCEa database to production and set up all required tables.

## Problem Statement

If you're seeing this error in your Cloudflare Pages Functions logs:
```
The table `public.User` does not exist in the current database.
```

This means your production database doesn't have the schema applied yet. Follow this guide to fix it.

## Prerequisites

- A PostgreSQL database (Supabase, Neon, or any PostgreSQL provider)
- Database connection credentials
- Node.js 18+ installed locally (for running migrations)
- Access to your database (via connection string)

## Quick Migration (Recommended)

### Option 1: Using Prisma Migrate (Recommended)

This is the safest and most reliable method for production deployments.

1. **Set up your local environment variables**

   Create a `.env` file with your production database credentials:
   
   ```bash
   # Use the DIRECT connection string (not pooled)
   DATABASE_URL="postgresql://user:password@host:5432/database"
   # OR for Supabase, use the "Session" mode connection string:
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   ```

2. **Generate Prisma Client**

   ```bash
   npm install
   npx prisma generate --accelerate
   ```

3. **Apply the migration to your production database**

   ```bash
   npx prisma migrate deploy
   ```

   This command will:
   - Connect to your production database
   - Apply all pending migrations
   - Create all required tables, indexes, and constraints
   - Be safe to run multiple times (idempotent)

4. **Verify the migration**

   ```bash
   npx prisma studio
   ```
   
   This opens a GUI where you can verify all tables were created correctly.

### Option 2: Using db push (Quick but less safe)

Use this for development or if you need a quick fix:

```bash
npx prisma db push
```

**Warning:** This bypasses migration history and directly syncs your schema. Use only for dev/testing.

### Option 3: Manual SQL Execution

If you prefer manual control or can't run Prisma locally:

1. **Get the migration SQL**

   The complete migration SQL is located at:
   ```
   prisma/migrations/20241209000000_init_production_schema/migration.sql
   ```

2. **Execute the SQL manually**

   **Using Supabase Dashboard:**
   - Go to your Supabase project
   - Navigate to **SQL Editor**
   - Copy the entire contents of `migration.sql`
   - Paste and run the SQL

   **Using psql:**
   ```bash
   psql "postgresql://user:password@host:5432/database" < prisma/migrations/20241209000000_init_production_schema/migration.sql
   ```

   **Using another database client:**
   - Open your preferred SQL client (TablePlus, DBeaver, pgAdmin, etc.)
   - Connect to your production database
   - Execute the migration SQL

3. **Create the migration history table**

   After manually executing the SQL, you need to record that the migration was applied:

   ```sql
   CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
       id VARCHAR(36) PRIMARY KEY,
       checksum VARCHAR(64) NOT NULL,
       finished_at TIMESTAMP WITH TIME ZONE,
       migration_name VARCHAR(255) NOT NULL,
       logs TEXT,
       rolled_back_at TIMESTAMP WITH TIME ZONE,
       started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       applied_steps_count INTEGER NOT NULL DEFAULT 0
   );

   INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
   VALUES (
       gen_random_uuid()::TEXT,
       'init_production_schema_checksum',
       CURRENT_TIMESTAMP,
       '20241209000000_init_production_schema',
       1
   );
   ```

## Cloudflare Pages Environment Setup

After migrating your database, ensure your Cloudflare Pages environment has the correct variables:

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment variables**
3. Add/verify these variables:

   ```
   DATABASE_URL = postgresql://[connection-string-with-pooler]
   CLERK_SECRET_KEY = sk_live_[your-clerk-secret-key]
   ```

   **Important:** For Cloudflare Pages Functions (Edge Runtime), use:
   - **Connection pooling enabled**: Add `?pgbouncer=true` to your connection string
   - **OR use Prisma Accelerate**: `prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY`

4. Redeploy your Cloudflare Pages site to pick up the new environment variables

## What This Migration Does

This migration creates the complete database schema including:

### Core Tables
- **User** - User accounts linked to Clerk authentication
- **PerformanceRecord** - Quiz performance tracking
- **SRSItem** - Spaced repetition system data
- **SavedQuestion** - Flagged and missed questions for review

### Medical Content Tables
- **Condition** - Medical conditions
- **MediaAsset** - Medical images (EKGs, X-rays, etc.)
- **MedicalContent** - CMS content with version control
- **EducationalResource** - Textbooks, lectures, PDFs

### Learning & Analytics Tables
- **UserAchievement** - Gamification achievements
- **DailyStreak** - Study streak tracking
- **MasteryProgress** - Topic mastery levels
- **ConfusionPair** - Differential diagnosis confusion tracking
- **BaselineAssessment** - Initial assessment results

### Question Management Tables
- **PreGeneratedQuestion** - AI-generated question pool
- **StagingQuestion** - Quality control staging area
- **QuestionSeed** - Question templates
- **UserQuestionHistory** - No-repeat tracking
- **ClinicalPearl** - Extracted learning points
- **SemanticCache** - AI response caching

### Quality & Compliance Tables
- **QuestionFlag** - User-reported question issues
- **QuestionVerification** - Automated fact-checking
- **StalenessReport** - Outdated content tracking
- **GuidelineVersion** - Medical guideline tracking
- **GuidelineConflict** - Guideline change conflicts
- **NCCPABlueprint** - PANCE/PANRE blueprint compliance

### Advanced Features Tables
- **ContentVersion** - Content version history
- **ContentAuditLog** - Complete audit trail
- **BackgroundJob** - Async job queue
- **SyncQueue** - Offline sync support
- **ContentLock** - Concurrent editing prevention
- **ContentBranch** - Git-like branching for content
- **QuestionMigration** - Question update tracking
- **BountyReward** - User contribution rewards

**Total:** 40+ tables with proper indexes, foreign keys, and constraints

## Verification Steps

After migration, verify your setup:

1. **Check tables exist**

   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

   You should see all tables including `User`, `PerformanceRecord`, `SRSItem`, etc.

2. **Test the sync endpoint**

   Make a test request to your deployed application:
   ```bash
   curl -X GET https://your-domain.com/api/sync \
     -H "Authorization: Bearer YOUR_CLERK_TOKEN"
   ```

   You should get a 200 response instead of 500.

3. **Check Prisma connection**

   If using Prisma Studio:
   ```bash
   npx prisma studio
   ```

## Troubleshooting

### Error: "The table public.User does not exist"

**Solution:** You haven't run the migration yet. Follow Option 1 or 2 above.

### Error: "Connection timeout" or "Cannot connect to database"

**Solutions:**
- Verify your DATABASE_URL is correct
- Check that your database allows connections from your IP
- For Supabase: Ensure you're using the correct connection string (Session mode for migrations)
- Check firewall rules and network connectivity

### Error: "relation already exists"

**Solution:** Tables partially exist. You have two options:

1. **Drop and recreate (CAUTION: Data loss)**
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   -- Then run migration again
   ```

2. **Skip existing tables**
   - Comment out CREATE TABLE statements for tables that already exist in the migration.sql
   - Run only the missing parts

### Error: "permission denied for schema public"

**Solution:** Your database user needs proper permissions:
```sql
GRANT ALL PRIVILEGES ON SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### Migration applied but Cloudflare still shows errors

**Solutions:**
1. Verify environment variables in Cloudflare Pages settings
2. Redeploy your Cloudflare Pages site
3. Clear Cloudflare cache
4. Check that DATABASE_URL uses connection pooling (?pgbouncer=true)

## Rollback Procedure

If you need to rollback the migration:

1. **Using Prisma**
   ```bash
   # This will show you how to rollback
   npx prisma migrate resolve --rolled-back 20241209000000_init_production_schema
   ```

2. **Manual Rollback**
   ```sql
   -- WARNING: This will delete all data!
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

## Best Practices

1. **Always backup before migrating**
   ```bash
   pg_dump "your-connection-string" > backup.sql
   ```

2. **Test migrations on a staging database first**

3. **Use separate databases for development, staging, and production**

4. **Keep migration files in version control** (already done)

5. **Use Prisma Migrate for all schema changes** (maintains history)

## Next Steps

After successful migration:

1. ✅ Database schema is ready
2. ✅ User authentication will work
3. ✅ Data synchronization will function
4. 🔄 Start using the application
5. 📊 Monitor logs for any issues
6. 🎯 Consider seeding initial data (conditions, media, etc.)

## Support

If you encounter issues:

1. Check the [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) guide
2. Review [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)
3. Check Cloudflare Pages logs for detailed error messages
4. Verify all environment variables are set correctly
5. Test database connection locally before deploying

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Accelerate for Edge](https://www.prisma.io/docs/accelerate)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
