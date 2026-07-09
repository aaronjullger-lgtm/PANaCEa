---
name: verifying-in-browser
description: Run the app locally and verify a change actually works in a real browser before claiming success. Use whenever a frontend/UI/route change needs runtime confirmation.
---

# Verifying in browser

Confirm UI/behavior changes in a running browser, not just by reading code.

## When to use

- Any change to `components/`, `src/`, routes, styles, or client behavior.
- Before claiming a visual or interactive change works.

## Instructions

1. Start the frontend dev server (leave it running):
   ```bash
   npm run dev   # Vite on localhost:3000
   ```
   (`npm run dev:all` / `dev:wrangler` are currently broken on `main` — see `docs/cursor-automation-audit.md`.)
2. Open the app in a browser (Playwright is available; a browser MCP may also be configured — see `.cursor/mcp.example.json`).
3. For authenticated views in local dev, use the dev auto-login URL documented in `.cursorrules`:
   `localhost:3000/?dev_auth=cursor_secret_key_999` and wait ~2s for Clerk to complete. Do **not** use production credentials.
4. Navigate to the exact screen your change affects and exercise the real interaction (click, type, submit) — not just page load.
5. Capture screenshots of the before/after or the working state.

## Verification

- The change is visible/behaves as intended in the browser.
- No new console errors in the affected flow.
- Screenshots captured as evidence.

## Failure recovery

- Blank screen / API errors: the local API paths are broken on `main`; verify what is client-only, or note that backend-dependent screens need a working API (document the limitation).
- Port 3000 in use: stop the stale process (use its specific PID) or read the terminal to find the running server.
- Auth won't complete: confirm the dev-auth URL and that a Clerk test user exists; never substitute prod creds.
