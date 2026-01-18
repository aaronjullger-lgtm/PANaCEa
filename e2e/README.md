# 🎭 Playwright Smoke Test Suite for StudyPANaCEa

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

### Step 1: Install Playwright (Already Done!)

```bash
npm init playwright@latest
```

### Step 2: One-Time Authentication Setup

**Start your dev server:**

```bash
npm run dev
```

**In a new terminal, run the auth setup:**

```bash
npx playwright test e2e/auth.setup.ts --headed
```

**What happens:**

1. A browser window opens
2. You manually log in via Clerk (once!)
3. Script saves your session to `playwright/.auth/user.json`
4. All future tests reuse this session ✨

> **Note:** You only need to do this once, or when your session expires.

---

### Step 3: Run the Smoke Tests

**Run all tests:**

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

- Runs ONCE before all tests
- Manual login with Clerk
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
# Re-run auth setup
npx playwright test e2e/auth.setup.ts --headed
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
├── auth.setup.ts         # One-time login setup
├── all-modes.spec.ts     # Main smoke test suite
└── example.spec.ts       # Playwright default example

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
