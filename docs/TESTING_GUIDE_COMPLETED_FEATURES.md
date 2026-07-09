# Testing Guide: Completed Features

**Date:** February 6, 2026  
**Dev Server:** http://localhost:3000  
**Status:** All features ready for testing

---

## Quick Test Checklist

### 1. Medical Wordle (NEW)

**Path:** Training Menu → Medical Wordle

**Test Steps:**
1. Navigate to localhost:3000
2. Sign in (Clerk)
3. Click "Practice" or go to Training Menu
4. Find "Medical Wordle" in Specialty Drills section
5. Click to launch

**Expected Results:**
- ✅ Wordle UI loads (grid, keyboard)
- ✅ Daily word is loaded or demo word shown
- ✅ Can type/click keyboard to guess
- ✅ Letters color-code correctly (green=correct, yellow=present, gray=absent)
- ✅ Win/loss states work
- ✅ Can share results

**Note:** API endpoints `GET /api/games/wordle/daily` and `POST /api/games/wordle/guess` are implemented in Cloudflare Pages Functions. Requires auth and buzzword seed data in the database. See `docs/api/API_OVERVIEW.md`.

---

### 2. Polypharmacy Puzzle (NEW)

**Path:** Training Menu → Polypharmacy Puzzle

**Test Steps:**
1. From Training Menu
2. Find "Polypharmacy Puzzle" in Clinical Simulation section
3. Click to launch

**Expected Results:**
- ✅ Patient case loads with medication list
- ✅ Can click medications to select (2 at a time)
- ✅ "Check Interaction" button enables when 2 selected
- ✅ Clicking button shows interaction or "no interaction" toast
- ✅ Double-clicking drug checks contraindication
- ✅ "Submit Answer" shows results with scoring
- ✅ Explanation panel shows clinical pearls
- ✅ Timer counts up
- ✅ Issues found counter updates

**Fallback:** If API fails, demo case with NSAIDs + ACE inhibitor interaction loads

---

### 3. Pediatric Dosing Calculator (ENHANCED)

**Path:** Toolkit → Calculators → Pediatric Dosing

**Test Steps:**
1. Go to /study/toolkit
2. Click "Calculators"
3. Select "Pediatric Dosing"

**Expected Results:**
- ✅ Dropdown shows 6 medications (Amoxicillin, Acetaminophen, Ibuprofen, Azithromycin, Ceftriaxone, Ondansetron)
- ✅ Can enter weight in kg
- ✅ Dose calculates automatically (mg/kg × weight)
- ✅ Max dose capping works (e.g., 50kg child + Acetaminophen = 750mg calculated, but capped at 1000mg max)
- ✅ Minimum weight warnings show (e.g., <6kg for Ibuprofen)
- ✅ Dosing recommendation displays with frequency and route
- ✅ Warning about verifying with protocols shown

**Test Cases:**
- 10kg child + Amoxicillin: Should calculate 400mg total (40 mg/kg)
- 20kg child + Acetaminophen: 300mg per dose
- 80kg teen + Acetaminophen: Should cap at 1000mg (not 1200mg)

---

### 4. Clinical Guidelines Reference (ENHANCED)

**Path:** Toolkit → Calculators → Clinical Guidelines

**Test Steps:**
1. Go to /study/toolkit
2. Click "Calculators"
3. Select "Clinical Guidelines"

**Expected Results:**
- ✅ 6 guidelines displayed (CURB-65, CHADS₂-VASc, Ottawa Ankle, PECARN, SIRS, Ranson)
- ✅ Search box filters by name, category, or indication
- ✅ Each guideline shows:
  - Name and category badge
  - Indication
  - Key points (bullets)
  - Scoring interpretation where applicable
- ✅ Searching "cardiac" shows CHADS₂-VASc
- ✅ Searching "pediatric" shows PECARN
- ✅ Empty state shows when no matches

---

### 5. QuizView Submit Button (POLISHED)

**Path:** Start any quiz session

**Test Steps:**
1. Click "Start Session" on dashboard
2. Select any question mode
3. Answer a question
4. Click "Submit Answer"

**Expected Results:**
- ✅ Button shows spinner during processing
- ✅ Text changes to "Submitting..."
- ✅ Button is disabled (can't double-click)
- ✅ After processing, shows rationale
- ✅ "Next" button appears
- ✅ Submit button resets on next question

**Check Console:** No errors during submission

---

### 6. CommandCenterHub Tooltips (POLISHED)

**Path:** Training Menu

**Test Steps:**
1. Go to Training Menu
2. Hover over any mode card
3. If any mode is disabled, hover over it

**Expected Results:**
- ✅ Only readiness-approved modes are visible
- ✅ Deferred or placeholder modes are hidden, not shown as "Coming Soon"
- ✅ Hover shows browser tooltip with description for visible modes
- ✅ Tooltip appears within 1-2 seconds
- ✅ Aria-label present for screen readers

**Note:** Mode discovery now fails closed. A mode is public only when the mode readiness gate marks its contract and mounted implementation as production-ready.

---

### 7. Adaptive Dashboard Error Handling (POLISHED)

**Test Steps:**
1. Go to Dashboard
2. If data loads: Check that streak, due reviews, cards learned all show real numbers (not "7", not "mock")
3. To test error state:
   - Disable network in DevTools
   - Refresh page

**Expected Results:**
- ✅ With network: Real data displays
- ✅ Without network: "No Internet Connection" message
- ✅ Error message says "Check your connection and try again"
- ✅ "Check Connection & Retry" button shows
- ✅ Clicking retry reloads page

---

### 8. SmartReviewMode Speed Feedback (POLISHED)

**Path:** Training Menu → Smart Review Mode (if available)

**Test Steps:**
1. Start Smart Review session
2. Answer questions at different speeds
3. Watch for toast notifications

**Expected Results:**
- ✅ <10s answer: "Lightning fast! ⚡ - Strong recall" toast
- ✅ 10-20s: "Quick recall! ✓ - Good retention"
- ✅ 20-40s: "Consider reviewing this topic again 🔄"
- ✅ >40s: "Slow recall - Flag for intensive review ⏱️"
- ✅ Toasts auto-dismiss after 2-3 seconds

---

### 9. Navigation & 404 (FIXED)

**Test Steps:**
1. Navigate to http://localhost:3000/study → Should show dashboard
2. Navigate to http://localhost:3000/menu → Should show menu
3. Navigate to http://localhost:3000/study/toolkit → Should show toolkit
4. Navigate to http://localhost:3000/invalid-page → Should show 404

**Expected Results:**
- ✅ Valid paths: Content loads correctly
- ✅ Invalid path: "404 Page Not Found" message
- ✅ 404 page has "Go to Dashboard" button
- ✅ Clicking button goes to /study
- ✅ No dead links in navigation

**Paths to test:**
- `/study` ✓ Dashboard
- `/menu` ✓ Training Menu
- `/study/reference` ✓ Reference Library
- `/study/toolkit` ✓ Toolkit Hub
- `/admin` ✓ Admin Dashboard (if admin)
- `/clinical-eye` ✓ Clinical Eye
- `/visualizer` ✓ Visualizer
- `/random-invalid-path` → 404

---

### 10. Clinical Eye Mode Demo (POLISHED)

**Path:** /clinical-eye

**Test Steps:**
1. Navigate to /clinical-eye
2. Click "Start Exercise"

**Expected Results:**
- ✅ Demo SVG image loads (not broken image)
- ✅ Shows "Demo: Chest X-Ray - Pneumothorax"
- ✅ Text says "(Production uses real medical images from database)"
- ✅ Can click on image regions
- ✅ Ellipse outline shows target area
- ✅ UI is interactive and functional

---

## Regression Testing

Test that existing features still work:

### Core Features
- [ ] Sign in/sign out works
- [ ] Dashboard loads without errors
- [ ] Start Session flow works
- [ ] Questions load and display
- [ ] Can answer questions
- [ ] Rationale shows after answering
- [ ] "Next" button advances questions
- [ ] Session ends properly

### Navigation
- [ ] NavRail shows 5 items
- [ ] Clicking Dashboard goes to /study
- [ ] Clicking Reference goes to /study/reference
- [ ] Clicking Toolkit goes to /study/toolkit
- [ ] Clicking Menu goes to /menu
- [ ] Settings button opens modal

### Existing Modes (spot check)
- [ ] ECG Drill loads
- [ ] Derm Drill loads
- [ ] Fluids & Electrolytes works
- [ ] Grand Rounds loads
- [ ] OSCE/Patient Encounter works

### Analytics
- [ ] Dashboard stats display
- [ ] Progress tab shows charts
- [ ] Gap Analysis works
- [ ] Heatmap displays

---

## Browser Console Checks

Open DevTools Console and check for:

### Should NOT See:
- ❌ 404 errors for `/api/pearls/*` (should be `/api/user/pearls/*`)
- ❌ 404 errors for `/api/social/*` (feature hidden)
- ❌ Red/uncaught errors
- ❌ "sportsbook" in any logs

### Should See:
- ✅ Successful API calls to `/api/questions/*`
- ✅ Auth tokens in requests
- ✅ Successful data fetching
- ✅ Clean navigation transitions

---

## Performance Checks

### Page Load
- First load: Should be <3s to interactive
- Subsequent loads: Should be <1s (cached)

### Interactions
- Button clicks: Instant response
- Mode navigation: <500ms transition
- Question submit: <1s with spinner
- Toast notifications: Smooth animations

### Network
- Check Network tab for:
  - ✅ No failed requests (except expected missing APIs)
  - ✅ Images load successfully
  - ✅ API responses are fast (<2s)
  - ✅ Auth headers present on protected endpoints

---

## Known Issues/Expected Behavior

### APIs Not Implemented (Expected)
- ~~`/api/games/wordle/*`~~ — **Implemented** in `functions/api/games/wordle/` (see `docs/api/API_OVERVIEW.md`)
- `/api/social/*` - Study Groups hidden, won't be called
- `/api/questions/polypharmacy-drill` - Falls back to demo case if not found

### Intentionally Disabled
- Study Groups button (hidden in MenuView)
- Social dashboard view (commented out)
- Medical Wordle on Dashboard (commented out, but accessible via Training Menu)

### Known Limitations
- Streak data may show 0 (TODO: integrate with /api/streaks/[userId])
- Some modes may need database content seeded
- Offline sync requires authentication

---

## Testing Priority Order

### High Priority (Must Work)
1. Sign in flow
2. Dashboard loads
3. Start quiz session
4. Answer questions
5. Polypharmacy Puzzle works
6. Pediatric Dosing calculates

### Medium Priority (Should Work)
7. Medical Wordle interactive
8. Clinical Guidelines searchable
9. 404 page shows
10. Submit button spinner
11. Error messages clear

### Low Priority (Nice to Have)
12. Tooltips on hover
13. Speed feedback toasts
14. Clinical Eye demo image
15. All animations smooth

---

## Bug Reporting Template

If you find issues, note:

```
**Feature:** [Name]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** [What should happen]
**Actual:** [What happened]
**Console Errors:** [Any errors in console]
**Screenshot:** [If applicable]
```

---

## Success Criteria

The testing is successful if:
- ✅ All 28 modes accessible from Training Menu
- ✅ Polypharmacy Puzzle fully interactive
- ✅ Medical Wordle playable
- ✅ Calculators functional
- ✅ No JavaScript errors in console
- ✅ Navigation clean, no dead links
- ✅ Loading states visible
- ✅ Error messages helpful
- ✅ 404 page works
- ✅ Core quiz flow intact

---

## Ready to Test

1. **Open browser:** http://localhost:3000
2. **Sign in** with Clerk
3. **Follow checklist above**
4. **Report any issues**

All features have been implemented and polished. The platform should be fully functional for PA student use.
