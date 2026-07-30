# Blank Screen Audit – Wrangler Pages Dev

## Summary

**Root cause:** You are serving the **source directory** (`.`) instead of the **built output** (`dist`). The browser receives raw `index.tsx` (TypeScript/JSX), which it cannot run, so the app never mounts and the screen stays blank.

---

## 1. Entry Point ✅ OK

| Check | Result |
|-------|--------|
| **index.html** | `<div id="root"></div>` (line 417) |
| **Script tag** | `<script type="module" src="/index.tsx"></script>` (line 418) |
| **index.tsx** | `document.getElementById('root')` and `ReactDOM.createRoot(rootElement)` (lines 28–33) |

The root element ID and the React mount target match. No change needed here.

---

## 2. Environment Variables ✅ OK (Vite / Supabase)

- **wrangler.toml** defines `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, etc. with the `VITE_` prefix.
- **Client code** uses `import.meta.env.VITE_*` (e.g. `VITE_USE_MOCK`, `VITE_TODOIST_*`). No Supabase `createClient` usage was found under `src/`; env usage is consistent with Vite.
- **vite.config.ts** defines `process.env` shims for browser builds, and `import.meta.env.VITE_USE_MOCK` is set in `define`.

No env-related fix required for the blank screen.

---

## 3. Base Path ✅ OK

- **vite.config.ts** does not set `base`; Vite default is `'/'`.
- Asset paths are root-relative. No base-path issue for local dev.

---

## 4. Actual Cause: Wrong Directory Served ❌

**What you're doing:**

```bash
npx wrangler pages dev .
```

Here, the last argument (`.`) is the **directory of static assets** Wrangler serves. So Wrangler serves the **project root** (source tree), not the built app.

**What the browser gets:**

1. **Request /** → `index.html`
2. **index.html** contains: `<script type="module" src="/index.tsx"></script>`
3. **Request /index.tsx** → Wrangler serves the **raw** `index.tsx` file from the repo
4. The browser tries to run that file as JavaScript. It is TypeScript/JSX (with `import React from 'react'`, etc.), so:
   - Either the browser fails to parse it, or
   - Module resolution fails (bare specifiers like `react` are not resolved)
5. The app script never runs → **blank screen**.

**What should be served:**

- The **built** output from `npm run build` (Vite), i.e. the **`dist/`** folder.
- In `dist/`, `index.html` points to compiled JS, e.g. `/assets/index-xxxxx.js`, which the browser can run.

**wrangler.toml** already has:

```toml
pages_build_output_dir = "dist"
```

So the project is set up to use `dist` as the asset directory; the issue is only that you're overriding it by passing `.` to `wrangler pages dev`.

---

## Fix

**Recommended – build once, then serve `dist`:**

```bash
npm run build
npm run pages:serve
```

Or in one step: `npm run pages:dev`. If port 8788 is in use, add `--port 8789`.

After this, open the URL shown (e.g. http://localhost:8788) to load the compiled app; the blank screen should be resolved.
