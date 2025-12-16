# Cloudflare Pages Setup for Prisma & Content API

## 1. Environment Variables

Ensure the following environment variables are set in your Cloudflare Pages project settings (Settings > Environment variables):

- `DATABASE_URL`: Your Prisma Accelerate connection string (starts with `prisma://`).
- `DIRECT_URL`: Your direct database connection string (starts with `postgres://`).
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key.
- `CLERK_SECRET_KEY`: Your Clerk secret key.
- `GEMINI_API_KEY`: Your Google Gemini API key.

## 2. Build Settings

Update your build settings to ensure the Prisma Client is generated with the Accelerate extension before building the app.

- **Build command**: `npx prisma generate --no-engine && npm run build`
- **Build output directory**: `dist`
- **Node.js version**: Set `NODE_VERSION` environment variable to `20` (or `18`).

> **Note:** We use `npx prisma generate --no-engine` because Cloudflare Pages Functions run in an edge environment where the standard Prisma query engine binary is not supported. The `@prisma/extension-accelerate` and `@prisma/adapter-neon` (if used) allow it to work without the binary.

## 3. Troubleshooting "500 Internal Server Error"

If you see a 500 error on `/api/content/all`:

1.  **Check Logs**: Go to your Cloudflare Pages dashboard > Deployments > View details > Functions to see the real-time logs.
2.  **CORS**: We have added `Access-Control-Allow-Origin: *` headers to the error responses. This should allow the frontend to display the actual error message (e.g., "Database not configured") instead of a generic CORS error.
3.  **Database Connection**: Ensure `DATABASE_URL` is correct and accessible from Cloudflare.

## 4. Recent Changes

We have updated the following files to include proper CORS headers and error handling:

- `functions/api/content/all.ts`
- `functions/api/content/search.ts`
- `functions/api/content/condition/[conditionId].ts`
- `functions/api/questions/generate.ts`
- `functions/api/questions/flag/index.ts`
- `functions/api/questions/flag/[flagId]/resolve.ts`
- `functions/api/questions/flags.ts`
- `functions/api/branches/index.ts`
- `functions/api/branches/[branchName]/merge.ts`

These changes ensure that even if the API fails, the frontend receives a readable JSON error response.
