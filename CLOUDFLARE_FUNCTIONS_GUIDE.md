# Cloudflare Pages Functions Setup Guide

## Current Status: ✅ READY FOR DEPLOYMENT

Your repository is **already correctly configured** for Cloudflare Pages Functions! The structure is exactly as Cloudflare requires.

## Project Structure (Verified ✅)

```
/PANaCEa (project root)
  ├── functions/              ← ✅ Special Cloudflare Pages Functions folder
  │   └── geminiProxy.ts      ← ✅ Backend API endpoint (TypeScript natively supported)
  ├── public/                 ← Static assets folder
  │   └── panacea-logo.svg
  ├── dist/                   ← Build output directory (created by npm run build)
  ├── index.html              ← Frontend entry point
  └── package.json
```

## How Cloudflare Pages Functions Work

### Automatic Detection
Cloudflare Pages automatically:
1. **Detects** any `/functions` folder at your project root
2. **Compiles** TypeScript files natively (no need for .js conversion)
3. **Creates** API endpoints based on file names:
   - `functions/geminiProxy.ts` → Available at `/geminiProxy`
4. **Enables** environment variable configuration in the dashboard

### The Function Endpoint
- **File**: `/functions/geminiProxy.ts`
- **URL**: `https://studypanacea.com/geminiProxy`
- **Method**: POST (via `onRequestPost` export)
- **CORS**: Enabled with `onRequestOptions` handler

## Deployment Instructions

### Step 1: Deploy to Cloudflare Pages

Using Wrangler CLI:
```bash
npx wrangler pages deploy .
```

Or via GitHub integration:
1. Push your code to GitHub
2. Cloudflare will automatically deploy

### Step 2: Configure Environment Variables

Once deployed, the error message **"Variables cannot be added to a Worker that only has static assets"** will be **GONE** because Cloudflare will detect your Functions folder.

To add your API key:

1. **Go to Cloudflare Dashboard**
   - Navigate to your Pages project
   - Click on **Settings** → **Environment variables**

2. **Add the Variable**
   - Click **"Add variable"**
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Google Gemini API key
   - **Environment**: Select both "Production" and "Preview"
   - Click **"Save"**

3. **Redeploy** (if needed)
   - If the deployment was already complete, you may need to trigger a new deployment
   - Either push a new commit or click "Retry deployment" in Cloudflare dashboard

## Verification Steps

### 1. Check Functions are Detected

After deployment, check your Cloudflare Pages deployment logs for:
```
✅ Functions deployed successfully:
   - /geminiProxy (POST, OPTIONS)
```

### 2. Test the Endpoint

Use curl to test the function:
```bash
curl -X POST https://studypanacea.com/geminiProxy \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "gemini-2.5-flash",
    "prompt": "Say hello",
    "temperature": 0.8
  }'
```

Expected response:
```json
{"text":"Hello! How can I help you today?"}
```

### 3. Verify Environment Variables Work

If you get an error about missing API key:
```json
{"error": "Missing API Key on Server"}
```

This means:
- ✅ The function is working correctly
- ❌ The `GEMINI_API_KEY` environment variable is not set
- **Action**: Go back to Step 2 above and add the environment variable

### 4. Test in the Application

1. Open your application in the browser
2. Start a new study session
3. Verify questions generate successfully
4. Check browser console for any errors

## Troubleshooting

### Issue: Still seeing "Variables cannot be added" error

**Cause**: Cloudflare hasn't detected the functions folder yet.

**Solution**:
1. Verify `/functions/geminiProxy.ts` is committed to git: `git ls-files functions/`
2. Make sure the file is pushed to your repository
3. Trigger a new deployment
4. Check deployment logs for "Functions deployed" message

### Issue: 404 Not Found on /geminiProxy

**Cause**: Function not deployed correctly.

**Solution**:
1. Check Cloudflare deployment logs
2. Verify the build was successful
3. Ensure `/functions/geminiProxy.ts` is in your repository
4. Cloudflare Pages automatically detects functions - no manual configuration needed

### Issue: CORS errors in browser

**Cause**: Missing CORS headers.

**Solution**: The function already includes CORS headers, but verify:
- `onRequestOptions` handler is exported
- All responses include `Access-Control-Allow-Origin: *`

## Technical Details

### Why This Structure Works

Cloudflare Pages uses a convention-based approach:

1. **Static Assets**: Served from the `dist` folder
2. **Dynamic Functions**: Automatically detected from `/functions` folder at root
3. **TypeScript Support**: Native compilation, no build step needed
4. **Environment Variables**: Injected at runtime via `context.env`

### Function Handler Pattern

```typescript
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY; // Access environment variables here
  // ... function logic
}

export async function onRequestOptions(): Promise<Response> {
  // Handle CORS preflight requests
}
```

### Routes Configuration

Cloudflare Pages automatically creates routes for functions based on their filenames:
- `functions/geminiProxy.ts` → Automatically available at `/geminiProxy`
- No manual route configuration needed

## Summary

✅ **Your repository is correctly configured!**
✅ **The `/functions/geminiProxy.ts` file is in the right place**
✅ **TypeScript is natively supported by Cloudflare Pages**
✅ **CORS headers are properly configured**
✅ **Routes are automatically detected by Cloudflare Pages**

**Next Step**: Deploy and add your `GEMINI_API_KEY` environment variable in the Cloudflare dashboard.

Cloudflare Pages will automatically detect the Functions folder and create the appropriate routes during deployment.

## Additional Resources

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Functions Routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [TypeScript Support](https://developers.cloudflare.com/pages/functions/typescript/)
