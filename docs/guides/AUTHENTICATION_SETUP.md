# User Authentication & Cloud Statistics Setup Guide

This guide will walk you through setting up user authentication and cloud synchronization for the PANaCEa medical education app.

## Overview

The system now includes:

- **User Authentication**: Powered by Clerk for secure sign-in/sign-up
- **Cloud Sync**: Automatic synchronization of user progress across devices
- **Offline Support**: Continue studying offline, sync when back online
- **Data Migration**: Seamless migration of local data to cloud on first sign-in

## Prerequisites

1. Node.js 16+ installed
2. PostgreSQL database (or compatible service like Neon, Supabase, Railway)
3. Clerk account (free tier available)

## Step 1: Set Up Clerk Authentication

### 1.1 Create a Clerk Application

1. Go to [https://clerk.com](https://clerk.com) and sign up/sign in
2. Click "Add application"
3. Name it "PANaCEa" (or your preferred name)
4. Select your preferred authentication methods (Email, Google, etc.)
5. Click "Create application"

### 1.2 Get Your API Keys

After creating the application:

1. Go to "API Keys" in the left sidebar
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 1.3 Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your Clerk keys:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

## Step 2: Set Up PostgreSQL Database

### Option A: Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a new database:
   ```bash
   createdb panacea
   ```
3. Add connection string to `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/panacea?schema=public"
   ```

### Option B: Cloud Database (Recommended for Production)

Use a managed PostgreSQL service like:

#### Neon (Free tier, serverless)

1. Go to [https://neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/panacea?sslmode=require"
   ```

#### Supabase (Free tier)

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database
4. Copy the "Connection string" (Transaction mode)
5. Add to `.env`

#### Railway (Free tier)

1. Go to [https://railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL service
4. Copy connection string from Variables tab
5. Add to `.env`

## Step 3: Run Database Migrations

Once your database is set up, run migrations to create the tables:

```bash
# Install dependencies (if not already done)
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init_auth_models

# Or, if deploying to production
npx prisma migrate deploy
```

## Step 4: Configure Cloudflare Pages (for Production)

If deploying to Cloudflare Pages, add environment variables in the Cloudflare dashboard:

1. Go to your Cloudflare Pages project
2. Navigate to Settings > Environment Variables
3. Add the following variables:
   - `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
   - `CLERK_SECRET_KEY`: Your Clerk secret key
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `GEMINI_API_KEY`: Your existing Gemini API key

**Important**: Make sure to add these variables for both **Production** and **Preview** environments.

## Step 5: Test Locally

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` and:

1. Click the "Sign In" button
2. Create a new account or sign in
3. Start a study session
4. Your progress should now sync to the cloud automatically

## Features

### Authentication

- **Sign In/Sign Up**: Users can create accounts using email, Google, or other configured methods
- **User Profile**: View and manage account settings
- **Secure Sessions**: JWT-based authentication with automatic token refresh

### Data Synchronization

- **Automatic Sync**: Progress syncs automatically when signed in
- **Manual Sync**: Force sync anytime from the profile menu
- **Conflict Resolution**: Latest data takes precedence in case of conflicts
- **Offline Support**: Study offline, data syncs when connection restored

### Data Migration

- **First-Time Sign In**: Local data automatically uploads to cloud
- **No Data Loss**: Existing progress preserved during migration
- **Merge Logic**: Cloud and local data intelligently merged

## Troubleshooting

### Authentication Issues

**Problem**: Error "Missing Publishable Key for Clerk!" when starting the application

- **Solution**:
  1. Copy `.env.example` to `.env`: `cp .env.example .env`
  2. Get your Clerk publishable key from https://dashboard.clerk.com
  3. Add it to `.env` as: `VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here`
  4. Restart the development server
- **Note**: This error is intentional to ensure proper configuration before the app starts

**Problem**: "Sign In" button doesn't appear

- **Solution**: Check that `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env`
- Restart dev server after adding environment variables

**Problem**: Sign-in modal doesn't open

- **Solution**: Check browser console for errors
- Verify Clerk keys are correct
- Ensure Clerk application is active (not paused)

### Database Issues

**Problem**: `P1001: Can't reach database server`

- **Solution**: Check DATABASE_URL is correct
- Verify database is running
- Check firewall/security group settings (for cloud databases)

**Problem**: `P1010: User does not have permission`

- **Solution**: Grant necessary permissions to database user
- For Prisma: User needs CREATE, ALTER, DROP permissions

### Sync Issues

**Problem**: Data not syncing to cloud

- **Solution**: Check browser console for API errors
- Verify authentication token is valid
- Check network tab for failed requests to `/api/sync`

**Problem**: "Sync error" message appears

- **Solution**: Check Cloudflare Function logs
- Verify DATABASE_URL is accessible from Cloudflare Workers
- Consider using Prisma Data Proxy for serverless environments

## Advanced Configuration

### Using Prisma Data Proxy

For better serverless compatibility with Cloudflare Workers:

1. Run: `npx prisma generate --data-proxy`
2. Get connection string from [Prisma Data Platform](https://cloud.prisma.io)
3. Update `DATABASE_URL` in Cloudflare environment variables

### Custom Auth Provider

To use a different auth provider (Auth0, Firebase, etc.):

1. Replace `@clerk/clerk-react` in `hooks/useAuth.ts`
2. Update `AuthProvider.tsx` component
3. Update shared API auth middleware in `functions/api/_shared/auth.ts` and `functions/api/_shared/middleware.ts`

### Scaling Considerations

For high-traffic scenarios:

- Use connection pooling (PgBouncer)
- Enable Prisma Data Proxy
- Implement Redis caching for frequently accessed data
- Add rate limiting to API endpoints

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Rotate keys regularly** in production
3. **Use different keys** for development and production
4. **Enable MFA** in Clerk for admin accounts
5. **Monitor API usage** and set up alerts
6. **Implement rate limiting** on sync endpoints

### ⚠️ Important Security Note

Authentication is handled centrally by shared middleware (`withAuth` / `authenticatedEndpoint`) and applies to `/api/sync`, `/api/user/profile`, and other protected endpoints.

Before production, verify:

- `CLERK_SECRET_KEY` is configured in Cloudflare Pages Functions env.
- Protected endpoints return `401` when called without `Authorization: Bearer <token>`.
- Runtime CORS settings only allow your deployed app origin(s).
- Rate limiting is enabled for sensitive endpoints (`/api/sync`, AI-proxy routes, profile updates).

## Support

For issues:

1. Check the troubleshooting section above
2. Review browser console and network tab
3. Check Cloudflare Pages function logs
4. Review Prisma error messages

For Clerk-specific issues:

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord Community](https://clerk.com/discord)

For Prisma issues:

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Discord Community](https://pris.ly/discord)

## Next Steps

After setup:

1. Customize authentication UI in `AuthButton.tsx`
2. Add more sync strategies (debouncing, batch uploads)
3. Implement offline queue for failed syncs
4. Add analytics tracking for user behavior
5. Create admin dashboard for user management
