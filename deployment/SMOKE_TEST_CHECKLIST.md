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

### 2b. Main Session (Rolling 360)

| Step | Action | Expected Result | ✓/✗ |
| ---- | ------ | --------------- | --- |
| 2b.1 | Start main session (Build Session / Start session) | Session starts; questions load | [ ] |
| 2b.2 | Answer at least 2 questions and submit each | Feedback appears; no console errors | [ ] |
| 2b.3 | End or complete session | Session summary displays | [ ] |
| 2b.4 | Return to Command Center / dashboard | Dashboard or stats show updated activity; Rolling 360 widget updates when visible | [ ] |

### 3. Critical API Endpoints

| Endpoint   | Test Command       | Expected Status       | ✓/✗ |
| ---------- | ------------------ | --------------------- | --- |
| Health (public) | `curl /api/health` | 200 + `status: ok` (liveness only) | [ ] |
| Readiness (admin) | `curl -H "Authorization: Bearer …" /api/admin/readiness` | 200 healthy or 503 unhealthy | [ ] |
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

### 6. OSCE Flow

| Step | Action | Expected Result | ✓/✗ |
| ---- | ------ | --------------- | --- |
| 6.1  | Navigate to OSCE / Patient Encounter | OSCE or Patient Encounter entry loads | [ ] |
| 6.2  | Start encounter (select or random case, create session) | Session created; chat/encounter UI appears | [ ] |
| 6.3  | Send at least one chat message | Message sends; patient/model response appears | [ ] |
| 6.4  | Complete encounter (submit diagnosis/plan or End Encounter) | Session completes without error | [ ] |
| 6.5  | View results | Preceptor feedback appears; when available, rubric checklist or "no rubric" message shows | [ ] |

### 6b. Knowledge Base / Condition Library

| Step | Action | Expected Result | ✓/✗ |
| ---- | ------ | --------------- | --- |
| 6b.1 | Navigate to Knowledge Base (e.g. NavRail or study/knowledge) | Knowledge Base or Condition Library entry loads | [ ] |
| 6b.2 | Open Condition Library tab | Systems sidebar and content area load | [ ] |
| 6b.3 | Select a system (e.g. Cardiovascular) | Condition list loads for that system | [ ] |
| 6b.4 | Open a condition (click a card) | Detail slide-over opens; summary and/or details load | [ ] |
| 6b.5 | (Optional) Use search | Search results or empty state appears; no console errors | [ ] |

### 7. Error Handling

| Test | Action            | Expected Result          | ✓/✗ |
| ---- | ----------------- | ------------------------ | --- |
| 7.1  | Network offline   | Graceful error message   | [ ] |
| 7.2  | Invalid URL       | 404 page displays        | [ ] |
| 7.3  | Long press submit | No duplicate submissions | [ ] |

### 8. Cross-Browser (if time permits)

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

## 🤖 Automated Verification

Run health check E2E before or after deployment:

```bash
# Run against local wrangler
npm run verify:health

# Run against production (set BASE_URL)
BASE_URL=https://studypanacea.com npm run verify:health
```

See [e2e/api-health.spec.ts](../e2e/api-health.spec.ts) for the health check spec.

---

_Last Updated: January 8, 2026_
