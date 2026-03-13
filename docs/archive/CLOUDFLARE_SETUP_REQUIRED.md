# 🚨 CRITICAL: Cloudflare Environment Variable Setup Required

## Problem
Authentication is failing on all protected endpoints because `CLERK_SECRET_KEY` is not configured in the Cloudflare Pages environment.

## Error Symptoms
- GET /api/drugs/all → 401 Unauthorized
- GET /api/labs/cases → 401 Unauthorized  
- POST /api/questions/generate-batch → 401 Unauthorized

## Root Cause
The middleware checks for `env.CLERK_SECRET_KEY` in `functions/api/_shared/auth.ts`, but this secret is not defined in the Cloudflare environment.

## Solution Steps

### 1. Get Your Clerk Secret Key
1. Go to https://dashboard.clerk.com
2. Select your "PANaCEa" project
3. Go to **API Keys**
4. Copy the **Secret Key** (starts with `sk_live_...`)

### 2. Add to Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages**
3. Select **studypanacea** project
4. Go to **Settings** → **Environment Variables**
5. Click **Add Variable**
6. Set:
   - **Name**: `CLERK_SECRET_KEY`
   - **Value**: Your secret key from step 1 (e.g., `sk_live_abcd1234...`)
   - **Type**: Check "Encrypt" for security
   - **Environment**: Apply to **Production** and **Preview**
7. Click **Save**

### 3. Redeploy
After adding the environment variable, trigger a new deployment:
- Either push a new commit
- Or manually redeploy from Cloudflare Dashboard

### 4. Verify
After deployment completes, test an authenticated endpoint:
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  https://studypanacea.com/api/drugs/all
```

Expected response: `{ "success": true, "data": { "drugs": [...] } }`

## Security Notes
- ✅ **DO**: Add secret keys via Cloudflare Dashboard
- ✅ **DO**: Use "Encrypt" option for sensitive values
- ❌ **DON'T**: Commit secret keys to `wrangler.toml`
- ❌ **DON'T**: Use public keys (`pk_*`) as secret keys

## Additional Environment Variables
While you're in the Cloudflare Dashboard, verify these are also set:
- `DATABASE_URL` - Prisma Accelerate connection string
- `GEMINI_API_KEY` - Google Gemini API key
- `DIRECT_DATABASE_URL` - Direct Supabase connection (for migrations only)

## Troubleshooting
If you still see 401 errors after adding `CLERK_SECRET_KEY`:
1. Check the deployment logs in Cloudflare Dashboard
2. Verify the secret key starts with `sk_live_` (not `pk_live_`)
3. Ensure the key is from the correct Clerk project
4. Wait 1-2 minutes for environment variable changes to propagate
5. Hard refresh the frontend to get a fresh auth token

## References
- Clerk Documentation: https://clerk.com/docs/backend-requests/handling/manual-jwt
- Cloudflare Pages Environment Variables: https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
