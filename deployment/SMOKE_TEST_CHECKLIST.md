# PANaCEa Smoke Test Checklist

> **Purpose:** Quick verification that core functionality works after deployment  
> **Duration:** 5-10 minutes  
> **Run After:** Every production deployment

---

## 🔥 Quick Smoke Test (5 minutes)

Run these tests immediately after any deployment:

### 1. Landing & Auth Flow

| Step | Action                 | Expected Result                   | ✓/✗ |
| ---- | ---------------------- | --------------------------------- | --- |
| 1.1  | Visit production URL   | Landing page loads without errors | [ ] |
| 1.2  | Click "Sign Up"        | Clerk modal appears               | [ ] |
| 1.3  | Sign up with new email | Redirected to dashboard           | [ ] |
| 1.4  | Sign out               | Returned to landing page          | [ ] |
| 1.5  | Sign back in           | Dashboard loads with user data    | [ ] |

### 2. Core Quiz Flow

| Step | Action                         | Expected Result                    | ✓/✗ |
| ---- | ------------------------------ | ---------------------------------- | --- |
| 2.1  | Click "Start Training"         | Session setup modal appears        | [ ] |
| 2.2  | Select 5 questions, any system | Quiz starts loading                | [ ] |
| 2.3  | Wait for first question        | Question displays within 5 seconds | [ ] |
| 2.4  | Select an answer               | Answer is selectable               | [ ] |
| 2.5  | Submit answer                  | Feedback/explanation appears       | [ ] |
| 2.6  | Continue through 5 questions   | All questions load successfully    | [ ] |
| 2.7  | Complete session               | Session summary displays           | [ ] |

### 3. Critical API Endpoints

| Endpoint   | Test Command       | Expected Status       | ✓/✗ |
| ---------- | ------------------ | --------------------- | --- |
| Health     | `curl /api/health` | 200 + status: healthy | [ ] |
| Questions  | (via quiz flow)    | Questions load        | [ ] |
| User Stats | Check dashboard    | Stats displayed       | [ ] |

---

## 🧪 Extended Smoke Test (10 minutes)

Run these additional tests for major releases:

### 4. Analytics Dashboard

| Step | Action                  | Expected Result         | ✓/✗ |
| ---- | ----------------------- | ----------------------- | --- |
| 4.1  | Navigate to Analytics   | Dashboard loads         | [ ] |
| 4.2  | Check performance chart | Chart renders with data | [ ] |
| 4.3  | Check system breakdown  | Organ systems displayed | [ ] |

### 5. Different Training Modes

| Mode | Action       | Expected Result         | ✓/✗ |
| ---- | ------------ | ----------------------- | --- |
| 5.1  | Rapid Recall | Flashcard-style works   | [ ] |
| 5.2  | Photo Drill  | Images load             | [ ] |
| 5.3  | DDx Trainer  | Differential mode works | [ ] |

### 6. Error Handling

| Test | Action            | Expected Result          | ✓/✗ |
| ---- | ----------------- | ------------------------ | --- |
| 6.1  | Network offline   | Graceful error message   | [ ] |
| 6.2  | Invalid URL       | 404 page displays        | [ ] |
| 6.3  | Long press submit | No duplicate submissions | [ ] |

### 7. Cross-Browser (if time permits)

| Browser         | Tested | Notes | ✓/✗ |
| --------------- | ------ | ----- | --- |
| Chrome Desktop  | [ ]    |       |     |
| Firefox Desktop | [ ]    |       |     |
| Safari Desktop  | [ ]    |       |     |
| Chrome Mobile   | [ ]    |       |     |
| Safari iOS      | [ ]    |       |     |

---

## 🚨 If Tests Fail

### Immediate Actions

1. **Do NOT share production URL** until issues resolved
2. Check Cloudflare Pages → Functions → Real-time logs
3. Check browser console for errors
4. Verify environment variables are set correctly

### Rollback Criteria

Rollback immediately if:

- [ ] Landing page fails to load
- [ ] Authentication completely broken
- [ ] Quiz questions never load
- [ ] Database connection errors in health check

### Quick Rollback

```bash
# In Cloudflare Dashboard:
# Pages → [Project] → Deployments → Previous deployment → "Rollback"
```

---

## 📝 Test Results Log

### Deployment: [DATE]

- **Deployed By:** [NAME]
- **Commit:** [HASH]
- **Quick Smoke:** ✅ Pass / ❌ Fail
- **Extended Smoke:** ✅ Pass / ❌ Fail / ⏭️ Skipped

**Notes:**

```
[Add any observations or issues encountered]
```

---

## 🤖 Automated Smoke Tests (Future)

When E2E tests are fully implemented, run:

```bash
# Run Playwright smoke tests against production
PLAYWRIGHT_BASE_URL=https://your-domain.pages.dev npm run test:e2e:smoke
```

See `e2e/smoke.spec.ts` for automated test cases.

---

_Last Updated: January 8, 2026_
