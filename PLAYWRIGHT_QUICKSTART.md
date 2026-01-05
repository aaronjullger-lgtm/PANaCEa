# 🎭 Playwright Smoke Tests - Quick Reference

## 🚀 Installation Complete!
✅ Playwright installed with Chromium, Firefox, WebKit
✅ Configuration optimized for localhost:3000
✅ Test files created in `e2e/` directory

---

## 📝 Run Instructions

### Step 1️⃣: One-Time Authentication Setup
```bash
# Start your dev server
npm run dev

# In a NEW terminal, run auth setup (browser will open)
npm run test:auth
```
**👉 Log in manually in the browser, then the script saves your session automatically!**

---

### Step 2️⃣: Run the Smoke Tests
```bash
# All tests (recommended first run)
npm run test:smoke

# With UI (best for debugging)
npm run test:e2e:ui

# Watch tests run in browser
npm run test:e2e:headed
```

---

## 🎯 What Gets Tested

### Study Modes (11 total):
- ✅ Drill Dashboard
- ✅ Pharmacology Drill → `/api/questions/pharmacology-drill`
- ✅ ECG/Media Drill → `/api/drills/media` **(CRITICAL - had 500s)**
- ✅ Anatomy Drill
- ✅ Physiology Drill
- ✅ Code Blue Drill
- ✅ System Drill → `/api/questions/system-drill`
- ✅ Flashcards
- ✅ Admin Dashboard
- ✅ Quiz Mode
- ✅ Analytics

### Critical Checks:
- ❌ No 500 Internal Server Error
- ❌ No 401 Unauthorized
- ❌ No blank white screens
- ❌ No React error boundaries
- ✅ Expected content loads
- ✅ API endpoints return valid JSON

---

## 🛠️ Available Commands

```bash
# Run all e2e tests
npm run test:e2e

# Run only smoke tests
npm run test:smoke

# Interactive UI mode (recommended!)
npm run test:e2e:ui

# See browser (headed mode)
npm run test:e2e:headed

# Re-authenticate (if session expires)
npm run test:auth

# Run specific test
npx playwright test -g "ECG"

# Debug mode
npx playwright test --debug
```

---

## 📊 Test Output Example

```
Running 11 tests...

✅ Drill Dashboard - loads successfully
✅ Pharmacology Drill - loads successfully
✅ ECG / Media Drill - loads successfully
✅ Anatomy Drill - loads successfully
...

✅ 11 passed (15s)
```

---

## 🐛 Troubleshooting

**Authentication expired?**
```bash
npm run test:auth
```

**Dev server not running?**
```bash
# Terminal 1:
npm run dev

# Terminal 2:
npm run test:smoke
```

**Want to see what's happening?**
```bash
npm run test:e2e:ui
```

---

## 📁 Files Created

```
e2e/
├── auth.setup.ts         # One-time login setup
├── all-modes.spec.ts     # Main smoke tests (11 modes)
├── README.md             # Full documentation
└── example.spec.ts       # Playwright default

playwright/
├── .auth/
│   ├── user.json         # Your saved auth session
│   └── .gitignore        # Don't commit auth tokens
└── playwright.config.ts  # Playwright settings

package.json              # New test scripts added
```

---

## 💡 Pro Tips

1. **Use UI Mode for Development:**
   ```bash
   npm run test:e2e:ui
   ```
   - Time travel through test execution
   - Inspect elements visually
   - Debug with breakpoints

2. **Run Before Deploying:**
   ```bash
   npm run test:smoke
   ```
   - Catches regressions in 30 seconds
   - Tests all critical paths

3. **Generate New Tests:**
   ```bash
   npx playwright codegen http://localhost:3000
   ```
   - Record interactions
   - Auto-generates test code

---

## 🎓 Learn More

- **Full Documentation:** `e2e/README.md`
- **Playwright Docs:** https://playwright.dev
- **Trace Viewer:** `npx playwright show-trace trace.zip`

---

**Happy Testing! 🚀**

*No more guessing which parts of your app are broken!*
