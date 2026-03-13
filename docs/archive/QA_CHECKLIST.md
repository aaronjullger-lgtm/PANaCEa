# Visual QA Checklist - Audit Fixes

**Purpose:** Manual verification of design system changes and functionality  
**Tester:** _____________  
**Date:** _____________

---

## Design System Colors (Step 4)

### Light Mode
- [ ] Primary buttons use slate gray (#64748b), not gold
- [ ] Hover states use darker slate (#475569)
- [ ] Focus rings are slate, clearly visible
- [ ] No gold colors visible anywhere in UI
- [ ] Text contrast meets WCAG AA (4.5:1 minimum)

### Dark Mode
- [ ] Toggle dark mode successfully
- [ ] Primary buttons use slate-400 (#94a3b8)
- [ ] Hover states use slate-300 (#cbd5e1)
- [ ] Focus rings visible and slate-colored
- [ ] All text readable with good contrast

### Specific Components to Check
- [ ] Navigation buttons
- [ ] Primary CTAs (Start Drill, Submit, etc.)
- [ ] Pill selectors (active state)
- [ ] Focus indicators on all interactive elements
- [ ] Card borders and accents
- [ ] Badge colors

---

## AI Safety & Resilience (Step 3)

### Timeout Behavior
- [ ] Open browser DevTools → Network tab
- [ ] Submit a drill review
- [ ] Verify Gemini API call completes within 30 seconds
- [ ] No hanging requests visible

### Fallback Testing
**Note:** This requires temporarily breaking the API key

1. [ ] Set invalid `GEMINI_API_KEY` in environment
2. [ ] Submit a drill review
3. [ ] Check console for `[AI_SAFETY]` warning message
4. [ ] Verify review still completes successfully
5. [ ] Confirm rating is calculated (not default 0.5)
6. [ ] Restore correct API key

---

## Rapid-Guess Logging (Step 5)

### Database Verification
Run these queries in your database client:

```sql
-- Check for rapid-guess reviews
SELECT 
  review_type, 
  COUNT(*) as count
FROM "ReviewLog" 
WHERE review_type = 'rapid_guess'
GROUP BY review_type;
```

- [ ] Query returns results (rapid guesses are logged)

```sql
-- Check telemetry flag
SELECT 
  telemetry->>'rapid_guess' as rapid_guess_flag,
  COUNT(*) 
FROM "ReviewLog" 
WHERE telemetry->>'rapid_guess' = 'true'
GROUP BY telemetry->>'rapid_guess';
```

- [ ] Query returns results (telemetry includes flag)

### Functional Test
1. [ ] Start a drill session
2. [ ] Answer a question in <500ms (rapid guess)
3. [ ] Check database for new ReviewLog entry
4. [ ] Verify `review_type = 'rapid_guess'`
5. [ ] Verify `telemetry.rapid_guess = true`
6. [ ] Confirm FSRS card state NOT updated

---

## Database Performance (Step 2)

### Query Speed Test
Run this query and note the execution time:

```sql
EXPLAIN ANALYZE
SELECT * FROM "MedicalContent" 
WHERE status = 'PUBLISHED' AND system = 'cardiovascular';
```

- [ ] Query uses index (check EXPLAIN output)
- [ ] Execution time < 50ms
- [ ] No "Seq Scan" in query plan

### Index Verification
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'MedicalContent' 
  AND indexname LIKE '%status%';
```

- [ ] Index `MedicalContent_status_system_idx` exists
- [ ] Index definition includes both `status` and `system`

---

## General Functionality

### Core Features
- [ ] Drill mode starts successfully
- [ ] Questions load without errors
- [ ] Answers submit correctly
- [ ] Progress tracking works
- [ ] Analytics dashboard loads
- [ ] No console errors

### Performance
- [ ] Page load time acceptable
- [ ] No visible lag or stuttering
- [ ] Smooth transitions between pages
- [ ] No memory leaks (check DevTools Memory tab)

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader compatible (test with VoiceOver/NVDA)
- [ ] Color contrast sufficient (use axe DevTools)

---

## Browser Testing

### Desktop
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive design works
- [ ] Touch targets adequate (44px minimum)

---

## Regression Testing

### Features That Should Still Work
- [ ] User authentication (Clerk)
- [ ] Question generation
- [ ] FSRS scheduling
- [ ] Progress tracking
- [ ] Analytics charts
- [ ] Dark mode toggle
- [ ] Settings persistence
- [ ] Offline mode (PWA)

---

## Issues Found

| Issue | Severity | Component | Description | Status |
|-------|----------|-----------|-------------|--------|
| | | | | |
| | | | | |
| | | | | |

---

## Sign-Off

### QA Approval
- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for staging deployment

**QA Tester:** _____________  
**Date:** _____________  
**Signature:** _____________

### Engineering Approval
- [ ] All fixes verified
- [ ] Documentation complete
- [ ] Ready for production

**Engineer:** _____________  
**Date:** _____________  
**Signature:** _____________

---

## Notes

_Add any additional observations or concerns here:_

---

**Next Steps After Approval:**
1. Deploy to staging environment
2. Monitor for 24-48 hours
3. Collect user feedback
4. Deploy to production if stable
