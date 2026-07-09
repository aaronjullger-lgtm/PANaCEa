#!/usr/bin/env node
/**
 * The legacy Express local-dev server (`server.ts`) is RETIRED. Its modular
 * route system was moved to `_trash/old-routes/`, so `server.ts`'s
 * `import './routes'` no longer resolves — `dev:server`/`dev:all` would crash
 * with a cryptic "Cannot find module './routes'".
 *
 * Production and local API now run entirely on Cloudflare Pages Functions
 * (`functions/api/**`), which is the ONLY path with full endpoint parity
 * (including /api/questions/custom-session and /api/drills/lab-cases).
 *
 * This guard fails fast with clear guidance instead of a broken Express boot.
 * (FEAT-001 / FEAT-002)
 */
const msg = `
────────────────────────────────────────────────────────────────────────
  ⚠️  The Express local-dev server is RETIRED and no longer runnable.
      (server.ts imports ./routes, which was moved to _trash/old-routes/)

  Use the Cloudflare Functions dev path instead — it has full API parity:

    • Full app + API (recommended):   npm run dev:wrangler
    • Frontend only (no API):         npm run dev

  Endpoints the audit flagged as "missing locally" (custom-session,
  lab-cases) already exist as Cloudflare Functions and work under dev:wrangler.
────────────────────────────────────────────────────────────────────────
`;
console.error(msg);
process.exit(1);
