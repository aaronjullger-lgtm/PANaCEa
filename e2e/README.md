# Playwright Smoke Test Suite for StudyPANaCEa

This directory contains comprehensive end-to-end tests that verify every study mode in the application loads correctly and doesn't crash with 500/401 errors.

## 📋 What Gets Tested

✅ **11 Study Modes:**

- Drill Dashboard
- Pharmacology Drill → Tests `/api/questions/pharmacology-drill`
- ECG/Media Drill → Tests `/api/drills/media` (critical endpoint)
- Anatomy Drill
- Physiology Drill
- Code Blue Drill
- System Drill → Tests `/api/questions/system-drill`
- Flashcards
- Admin Dashboard
- Quiz Mode
- Analytics Dashboard

✅ **Critical Checks:**

- ❌ No 500 Internal Server Error
- ❌ No 401 Unauthorized
- ❌ No blank white screens
- ❌ No React error boundaries
- ✅ Expected content loads
- ✅ API endpoints return valid data

---

## 🚀 Quick Start Guide

### Step 1: Install Playwright Browsers

```bash
npx playwright install
```

### Step 2: Authentication Setup

**Start your dev server:**

```bash
npm run dev
```

Preferred credential-based setup:

1. Create a dedicated Clerk test user with MFA / Client Trust disabled (or use backend auth via `CLERK_SECRET_KEY`).
2. Set local-only values in `.env` or your shell (either naming scheme works):

```env
# Canonical names
E2E_CLERK_TEST_EMAIL=test-learner@example.com
E2E_CLERK_TEST_PASSWORD=replace-with-local-test-password

# Or PANaCEa-local names (resolved with same priority: canonical wins)
PANACEA_E2E_EMAIL=test-learner@example.com
PANACEA_E2E_PASSWORD=replace-with-local-test-password
CLERK_SECRET_KEY=sk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

3. In a new terminal, run:

```bash
npm run test:auth
```

**What happens:**

1. A browser window opens.
2. `e2e/auth.setup.ts` signs in through Clerk with the E2E credentials.
3. The script saves your session to `playwright/.auth/user.json`.
4. Browser E2E tests that use saved auth reuse that session.

Manual fallback:

If the E2E credential variables are not set, `npm run test:auth` waits up to 2
minutes for you to sign in manually, then saves the session.

> Note: `npm run test:auth` loads `.env`. Raw `npx playwright test
> e2e/auth.setup.ts --headed` only sees variables already exported in your shell.

---

### Step 3: Run the Smoke Tests

**Run all saved-auth tests:**

```bash
npx playwright test e2e/all-modes
```

**Run with UI (recommended for debugging):**

```bash
npx playwright test e2e/all-modes --ui
```

**Run single test:**

```bash
npx playwright test e2e/all-modes -g "ECG"
```

**Debug mode:**

```bash
npx playwright test e2e/all-modes --debug
```

**Only Chromium (faster):**

```bash
npx playwright test e2e/all-modes --project=chromium
```

### Production-Parity Smoke

Use this when testing Cloudflare Pages Functions routing and the core authenticated
study loop against Wrangler:

```bash
# Terminal 1
npm run dev:wrangler

# Terminal 2
BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke
```

Set `E2E_REQUIRE_AUTH=1` when you want the command to fail fast if Clerk E2E
credentials are missing. Without credentials, the public production-smoke tests
run and the authenticated core-loop test is skipped.

---

## 📊 Understanding Test Output

### ✅ Success Output:

```
✅ Drill Dashboard - PASSED
✅ Pharmacology Drill - PASSED
✅ ECG / Media Drill - PASSED
...
```

### ❌ Failure Examples:

```
❌ 500 Internal Server Error detected on ECG / Media Drill
❌ Authentication failed (401 Unauthorized)
❌ Blank screen detected on Flashcards
```

---

## 🔧 Configuration Files

### `playwright.config.ts`

- Base URL: `http://localhost:3000`
- Timeout: 30 seconds per test
- Auto-starts dev server (`npm run dev`)
- Uses saved auth state for all tests
- Screenshots/videos on failure

### `e2e/auth.setup.ts`

- Runs before saved-auth Playwright projects
- Signs in with `E2E_CLERK_TEST_EMAIL` / `E2E_CLERK_TEST_PASSWORD` when present
- Falls back to manual Clerk login when credentials are not present
- Saves session to `playwright/.auth/user.json`

### `e2e/all-modes.spec.ts`

- Parameterized tests for all routes
- Critical error detection
- Direct API endpoint tests

---

## 🎯 Use Cases

### Daily Development

Run before deploying to catch regressions:

```bash
npx playwright test e2e/all-modes
```

### After Backend Changes

Test specific API endpoints:

```bash
npx playwright test e2e/all-modes -g "API"
```

### Debugging Production Issues

Run with trace for detailed debugging:

```bash
npx playwright test e2e/all-modes --trace on
```

### CI/CD Integration

Already configured in `.github/workflows/playwright.yml`

---

## 🐛 Troubleshooting

### Authentication Expired

```bash
npm run test:auth
```

### Dev Server Not Running

```bash
# Start manually in separate terminal
npm run dev

# Then run tests without webServer
npx playwright test e2e/all-modes
```

### Tests Timing Out

```bash
# Increase timeout in playwright.config.ts
timeout: 60000 // 60 seconds
```

### See What Browser Sees

```bash
# Run in headed mode (browser visible)
npx playwright test e2e/all-modes --headed

# Or use UI mode
npx playwright test e2e/all-modes --ui
```

---

## 📁 File Structure

```
e2e/
├── auth.setup.ts           # One-time login setup
├── all-modes.spec.ts       # Main smoke test suite
├── critical-flows.spec.ts  # Auth, drill lifecycle, navigation
├── srs-flashcards.spec.ts  # Study Tools → Resources → SRS Flashcards
└── example.spec.ts         # Playwright default example

playwright/
└── .auth/
    └── user.json         # Saved authentication state

playwright.config.ts      # Playwright configuration
```

---

## 🎓 Learn More

- [Playwright Docs](https://playwright.dev)
- [Test Generator](https://playwright.dev/docs/codegen): `npx playwright codegen http://localhost:3000`
- [Trace Viewer](https://playwright.dev/docs/trace-viewer): `npx playwright show-trace trace.zip`

---

## ✨ Pro Tips

1. **Use UI Mode for Development:**

   ```bash
   npx playwright test --ui
   ```

   - See tests run in real-time
   - Time travel through test steps
   - Inspect locators visually

2. **Generate Tests Automatically:**

   ```bash
   npx playwright codegen http://localhost:3000
   ```

3. **Run Only Failed Tests:**

   ```bash
   npx playwright test --last-failed
   ```

4. **Check Installed Browsers:**
   ```bash
   npx playwright --version
   ```

---

**Happy Testing! 🎭**
