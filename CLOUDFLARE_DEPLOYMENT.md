# Cloudflare Pages Deployment Guide

## Migration from Netlify to Cloudflare Pages

This document describes how to deploy this application on Cloudflare Pages after migrating from Netlify.

## Changes Made

1. **Created Cloudflare Pages Function**: `/functions/geminiProxy.ts`
   - This replaces the Netlify function that was located at `/netlify/functions/geminiProxy.ts`
   - Uses Cloudflare Pages Functions API (exports `onRequestPost`)
   - Endpoint will be available at: `https://your-domain.com/geminiProxy`

2. **Updated API Client**: `services/geminiService.ts`
   - Changed endpoint from `/.netlify/functions/geminiProxy` to `/geminiProxy`
   - All API calls now use the Cloudflare Pages function

## Cloudflare Pages Setup

### 1. Build Configuration

In your Cloudflare Pages project settings, configure:

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty or use root)

### 2. Environment Variables

You **must** set the following environment variable in your Cloudflare Pages project:

- **Variable name**: `GEMINI_API_KEY`
- **Value**: Your Google Gemini API key

#### How to set environment variables in Cloudflare Pages:

1. Go to your Cloudflare dashboard
2. Select your Pages project
3. Go to **Settings** → **Environment variables**
4. Click **Add variable**
5. Name: `GEMINI_API_KEY`
6. Value: Your Gemini API key
7. Select environment (Production and/or Preview)
8. Click **Save**

### 3. Node.js Version

The project uses Node.js 22.12.0. This is configured in `netlify.toml` but Cloudflare Pages will automatically detect and use the appropriate version.

## How It Works

### Cloudflare Pages Functions

Cloudflare Pages automatically deploys any TypeScript/JavaScript files in the `/functions` directory as serverless functions:

- **File**: `/functions/geminiProxy.ts`
- **Endpoint**: `/geminiProxy` (file name becomes the URL path)
- **Method**: POST (via `onRequestPost` export)

### Function Interface

Cloudflare Pages functions export handler functions named by the HTTP method:
- `onRequestPost` - handles POST requests
- `onRequestGet` - handles GET requests
- `onRequest` - handles all HTTP methods

The function receives a context object with:
```typescript
{
  request: Request,  // Standard Fetch API Request
  env: {             // Environment variables
    GEMINI_API_KEY: string
  }
}
```

## Testing

After deployment:

1. Verify the function is deployed:
   - Check Cloudflare Pages dashboard for successful deployment
   - Look for "Functions" in the deployment details

2. Test the endpoint:
   - The application should automatically use the new endpoint
   - Check browser console for any errors
   - Verify questions are being generated successfully

## Troubleshooting

### Error: "GEMINI_API_KEY environment variable is not set"
- Make sure you've set the `GEMINI_API_KEY` environment variable in Cloudflare Pages
- Redeploy after setting the environment variable

### Error: 404 on /geminiProxy
- Verify the `/functions/geminiProxy.ts` file is in your repository
- Check Cloudflare Pages deployment logs for function deployment status
- Ensure the build was successful

### Questions not generating
- Check browser console for errors
- Verify your Gemini API key is valid and has quota available
- Check Cloudflare Pages function logs for errors

## Differences from Netlify

| Feature | Netlify | Cloudflare Pages |
|---------|---------|------------------|
| Functions location | `/netlify/functions/` | `/functions/` |
| Function export | `export { handler }` | `export async function onRequestPost(context)` |
| Environment vars | `process.env` | `context.env` |
| Endpoint path | `/.netlify/functions/functionName` | `/functionName` |
| Request/Response | Netlify handler interface | Standard Fetch API |

## Additional Resources

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
