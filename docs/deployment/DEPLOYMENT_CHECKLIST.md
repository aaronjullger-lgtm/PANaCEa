# Deployment Checklist for Cloudflare Pages

This checklist ensures all changes are properly deployed to fix the issues mentioned in the problem statement.

## Pre-Deployment Verification

- [x] ✅ Tailwind CDN removed from `index.html`
- [x] ✅ Tailwind CSS v4 installed as dev dependency
- [x] ✅ PostCSS configuration created (`postcss.config.js`)
- [x] ✅ Tailwind configuration created (`tailwind.config.js`)
- [x] ✅ Cloudflare function uses Fetch API (no Node.js SDK dependency)
- [x] ✅ CORS headers added to function
- [x] ✅ Worker config files removed (Pages auto-detects functions)
- [x] ✅ All tests pass (209/209)
- [x] ✅ Build completes successfully
- [x] ✅ No security vulnerabilities (CodeQL scan: 0 issues)

## Cloudflare Pages Configuration

### 1. Build Settings
In your Cloudflare Pages project dashboard:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty)

### 2. Environment Variables
Set the following in **Settings → Environment Variables**:
- **Name**: `GEMINI_API_KEY`
- **Value**: Your Google Gemini API key
- **Environment**: Both Production and Preview

### 3. Node.js Version
- Cloudflare will auto-detect Node.js version from your package.json
- Current requirement: Node.js 18.0.0 or higher

## Post-Deployment Verification

After deploying, verify the following:

### 1. Check for Tailwind CDN Warning
Open browser console (F12) and verify:
- ❌ Old message: "cdn.tailwindcss.com should not be used in production"
- ✅ New: No warning about Tailwind CDN

### 2. Check Gemini Proxy Function
Test the function endpoint:
```bash
curl -X POST https://your-domain.com/geminiProxy \
  -H "Content-Type: application/json" \
  -d '{"modelName":"gemini-2.5-flash","prompt":"Say hello","temperature":0.8}'
```

Expected response:
```json
{"text":"Hello! How can I help you today?"}
```

If you get a 404:
- Check Cloudflare Pages deployment logs
- Verify `/functions/geminiProxy.ts` was deployed
- Check that `GEMINI_API_KEY` is set in environment variables

### 3. Test Question Generation
1. Open the application in your browser
2. Start a new session
3. Verify questions generate successfully
4. Check browser console for any errors

### 4. Verify Tailwind Styles
- Check that the UI looks correct
- Verify dark mode toggle works
- Ensure responsive design works on mobile

## Troubleshooting

### Issue: Questions still not generating (404 on /geminiProxy)

**Cause**: Function not deployed or not recognized by Cloudflare

**Solutions**:
1. Verify the `/functions` directory is in your repository root
2. Check Cloudflare Pages deployment logs for "Functions deployed" message
3. Force a new deployment by pushing a small change
4. Cloudflare Pages automatically detects functions - no manual configuration needed

### Issue: GEMINI_API_KEY not set error

**Cause**: Environment variable not configured or not deployed

**Solutions**:
1. Go to Cloudflare dashboard → Your project → Settings → Environment Variables
2. Add `GEMINI_API_KEY` with your API key
3. Make sure to select both "Production" and "Preview" environments
4. Redeploy the application (push a new commit or use "Retry deployment")

### Issue: Styles look broken

**Cause**: Tailwind not building correctly

**Solutions**:
1. Run `npm install` to ensure all dependencies are installed
2. Run `npm run build` locally to verify build works
3. Check for errors in Cloudflare build logs
4. Verify `postcss.config.js` and `tailwind.config.js` exist

### Issue: CORS errors in browser console

**Cause**: Function not returning CORS headers

**Solutions**:
1. Verify `/functions/geminiProxy.ts` has CORS headers in all responses
2. Check that `onRequestOptions` handler is exported
3. Redeploy the function

## Additional Resources

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/v4)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## Success Criteria

Your deployment is successful when:
- ✅ No Tailwind CDN warning in browser console
- ✅ Questions generate without 404 errors
- ✅ UI looks correct with all Tailwind styles applied
- ✅ Dark mode works properly
- ✅ No console errors related to Gemini proxy

## Getting Help

If you encounter issues after following this checklist:
1. Check Cloudflare Pages deployment logs
2. Check browser console for specific error messages
3. Review the detailed `CLOUDFLARE_DEPLOYMENT.md` documentation
4. Verify all environment variables are set correctly
