# Supabase Setup Guide for PANaCEa

This guide walks you through setting up Supabase as the database and storage backend for PANaCEa.

## Prerequisites

- A Supabase account (https://supabase.com)
- Node.js v18 or higher
- Git

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Project Name**: `panacea` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click "Create new project" and wait for it to initialize (~2 minutes)

## Step 2: Get Your Database Connection Strings

1. In your Supabase project, go to **Project Settings** (gear icon) > **Database**
2. Scroll down to **Connection string** section
3. Copy the following:
   
   **For DATABASE_URL** (Transaction mode - for app runtime):
   ```
   Mode: Transaction
   Connection string: postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   
   **For DIRECT_DATABASE_URL** (Session mode - for migrations):
   ```
   Mode: Session
   Connection string: postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```

## Step 3: Get Your Supabase API Keys

1. Go to **Project Settings** > **API**
2. Copy the following:
   - **Project URL**: Your `SUPABASE_URL`
   - **anon public**: Your `SUPABASE_ANON_KEY`
   - **service_role secret**: Your `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the following variables in `.env`:
   ```env
   # Database URLs from Step 2
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   
   # API Keys from Step 3
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Step 5: Set Up Database Schema

Run Prisma migrations to create all tables:

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to Supabase (creates all tables)
npx prisma db push

# Or create a migration (for version control)
npx prisma migrate dev --name init_schema
```

## Step 6: Set Up Supabase Storage for Images

1. In Supabase Dashboard, go to **Storage**
2. Click "Create a new bucket"
3. Create the following buckets:

   **medical-images** (for photo drill images):
   - Name: `medical-images`
   - Public: ✅ Yes (images need to be publicly accessible)
   - File size limit: 50MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp`
   
4. Set up storage policies:
   - Go to **Storage** > **Policies** > **medical-images**
   - Add policy for public read access:
     ```sql
     CREATE POLICY "Public Access"
     ON storage.objects FOR SELECT
     USING ( bucket_id = 'medical-images' );
     ```
   - Add policy for authenticated upload:
     ```sql
     CREATE POLICY "Authenticated users can upload"
     ON storage.objects FOR INSERT
     WITH CHECK (
       bucket_id = 'medical-images' 
       AND auth.role() = 'authenticated'
     );
     ```

## Step 7: Verify Connection

Test your database connection:

```bash
# Start the backend server
npm run dev:server

# In another terminal, test the health endpoint
curl http://localhost:3001/health
```

You should see a response indicating the server is healthy.

## Step 8: Upload Initial Data (Optional)

If you have existing medical images:

1. Go to **Storage** > **medical-images** bucket
2. Create folders: `ecg/`, `derm/`, `radiology/`
3. Upload images following the naming convention:
   - `condition-name.jpg` (e.g., `atrial-fibrillation.jpg`)
   - Multiple images: `condition-name-1.jpg`, `condition-name-2.jpg`

## Environment Variables Reference

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `DATABASE_URL` | Transaction pooler connection | Project Settings > Database > Connection String (Transaction mode) |
| `DIRECT_DATABASE_URL` | Direct connection for migrations | Project Settings > Database > Connection String (Session mode) |
| `SUPABASE_URL` | Your project URL | Project Settings > API > Project URL |
| `SUPABASE_ANON_KEY` | Public anonymous key | Project Settings > API > Project API keys > anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) | Project Settings > API > Project API keys > service_role |

## Security Best Practices

1. **Never commit `.env` to version control** - it's already in `.gitignore`
2. **Keep `SUPABASE_SERVICE_ROLE_KEY` secret** - only use server-side
3. **Use Row Level Security (RLS)** on sensitive tables
4. **Enable SSL** in production (already enabled by default)
5. **Rotate keys** if they're ever exposed

## Troubleshooting

### Connection Errors

**Error: "Connection string is not valid"**
- Check that you replaced `[PROJECT-REF]`, `[PASSWORD]`, and `[REGION]` with actual values
- Make sure there are no extra spaces in the connection string
- Verify the password is correct

**Error: "prepared statement already exists"**
- This happens with PgBouncer in Transaction mode
- Make sure `?pgbouncer=true` is in your `DATABASE_URL`
- For migrations, use `DIRECT_DATABASE_URL` without pgbouncer

### Migration Errors

**Error: "Migration engine error"**
- Use `DIRECT_DATABASE_URL` for migrations (not the pooler)
- Try `npx prisma db push` instead of `migrate dev` for initial setup

### Storage Upload Issues

**Error: "new row violates row-level security policy"**
- Check that you've created the storage policies in Step 6
- Verify the user is authenticated when uploading

## Next Steps

Once setup is complete:

1. Start the application: `npm run dev:all`
2. Test question generation and storage
3. Upload medical images for photo drill modes
4. Verify no-repeat logic for questions

## Support

For Supabase-specific issues:
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com

For PANaCEa-specific issues:
- Check the README.md
- Review DEVELOPER_GUIDE.md
