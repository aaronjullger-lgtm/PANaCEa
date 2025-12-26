# Database Backend Deployment Guide

## Problem: Cloudflare Functions + Prisma Compatibility

Cloudflare Workers/Pages Functions use V8 Isolates which only support ES Modules, while Prisma Client v5.x generates CommonJS modules. This causes the build error:
```
Uncaught ReferenceError: module is not defined
```

## Solution: Hybrid Deployment Architecture

### Architecture Overview

```
┌─────────────────┐
│  Cloudflare     │
│  Pages          │
│  (Frontend +    │
│  geminiProxy)   │
└────────┬────────┘
         │
         │  API calls to /api/*
         │
         ▼
┌─────────────────┐
│  Node.js        │
│  Backend        │
│  (server.ts)    │
│  + Database     │
└─────────────────┘
```

### Deployment Steps

#### 1. Deploy Frontend to Cloudflare Pages

Cloudflare Pages hosts:
- Static React frontend (from `dist/`)
- `geminiProxy` function for AI question generation
- NO database functions (they're in `functions-disabled/`)

**Cloudflare Pages Settings:**
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables:
  - `GEMINI_API_KEY`: Your Gemini API key
  - `CLERK_PUBLISHABLE_KEY`: Clerk public key

#### 2. Deploy Backend to Node.js Hosting

The Express backend (`server.ts`) must be deployed to a Node.js environment:

**Recommended Hosting Options:**
- **Railway**: https://railway.app (easy, auto-deploy from GitHub)
- **Render**: https://render.com (free tier available)
- **Fly.io**: https://fly.io (global edge deployment)
- **Heroku**: https://heroku.com (classic option)
- **Digital Ocean App Platform**
- **AWS Elastic Beanstalk / ECS**

**Backend Environment Variables:**
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
CLERK_SECRET_KEY=your_clerk_secret_key
GEMINI_API_KEY=your_gemini_api_key  
PORT=3001
NODE_ENV=production
```

**Backend Start Command:**
```bash
npm run dev:server
# OR for production:
node server.ts
```

#### 3. Configure Frontend to Call Backend

Update your frontend environment to point API calls to the backend:

**In Cloudflare Pages Environment Variables:**
```
VITE_API_URL=https://your-backend.railway.app
```

**Update API configuration** (if not already done):
```typescript
// lib/utils/apiConfig.ts
const API_BASE = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
  CONTENT_ALL: `${API_BASE}/api/content/all`,
  // ... other endpoints
};
```

### Alternative: Prisma Accelerate

If you prefer to use Cloudflare Functions for database access, you **must** use Prisma Accelerate:

1. Sign up: https://www.prisma.io/data-platform/accelerate
2. Get your Accelerate connection string: `prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY`
3. Set `DATABASE_URL` in Cloudflare Pages to your Accelerate URL
4. Move functions from `functions-disabled/` back to `functions/`
5. Redeploy

**Cost:** Prisma Accelerate has a free tier with limitations, paid plans for production use.

### Current Status

- ✅ Frontend deployed to Cloudflare Pages with AI features
- ❌ Database functions temporarily disabled (in `functions-disabled/`)
- 🔄 Backend needs to be deployed separately OR Prisma Accelerate configured

### Re-enabling Database Functions

Once backend is deployed OR Prisma Accelerate is configured:

```bash
# Move functions back
mv functions-disabled/api/* functions/api/

# Commit and push
git add .
git commit -m "Re-enable database functions"
git push
```

### Testing

**Frontend (Cloudflare Pages):**
- Visit your Cloudflare Pages URL
- AI question generation should work via `/geminiProxy`

**Backend (Node.js hosting):**
- Visit `https://your-backend-url.com/health`
- Should return server health status
- Test API endpoints: `/api/content/all`, etc.

**Database:**
```bash
# Run migrations on your backend host
npm run db:migrate:deploy

# Or use Prisma Studio locally
npm run db:studio
```

### Debugging

**If AI questions don't generate:**
- Check Cloudflare Functions logs
- Verify `GEMINI_API_KEY` is set
- Check browser console for errors

**If database calls fail:**
- Verify backend is running and accessible
- Check `DATABASE_URL` is correct
- Verify CORS is configured in server.ts
- Check backend logs for errors

## Summary

- **Cloudflare Pages**: Static frontend + AI proxy
- **Node.js Backend**: All database operations
- **Database**: PostgreSQL (Neon, Supabase, etc.)
- **Alternative**: Use Prisma Accelerate to keep everything on Cloudflare

This hybrid approach gives you:
- ✅ Fast global CDN for frontend (Cloudflare)
- ✅ Full Node.js compatibility for database (server.ts)
- ✅ No Prisma/CommonJS compatibility issues
- ✅ Flexible scaling for each tier independently
