# Main Session Audit Checklist

Use this checklist with **browser DevTools**, **Console Ninja** (or equivalent), and optionally **Playwright** to audit the main study session end-to-end: UI/UX, navigation, APIs, FSRS, and data collection/display.

## Prerequisites

- App running (`npm run dev` or `wrangler pages dev`)
- Authenticated user (required for session and stats APIs)
- DevTools → Network tab; Console tab (or Console Ninja for enhanced logs)
- Optional: Playwright with auth from `e2e/auth.setup.ts`

---

## 1. Routes & Navigation

| Step | Action | Expectation |
|------|--------|-------------|
| 1.1 | Visit `/` or `/study` | Command Center loads; no 404 |
| 1.2 | Visit `/menu` | Practice Menu loads |
| 1.3 | Visit `/study?tab=analytics` | Progress / Analytics tab visible |
| 1.4 | Visit `/study/knowledge` | Knowledge Base (reference) loads |
| 1.5 | Visit `/study/utilities` | Toolkit loads |
| 1.6 | Use NavRail: Home, Practice, Progress, Knowledge, Utilities | URL and content update for each |
| 1.7 | Visit unknown path (e.g. `/foo`) | 404 UI with "Go to Dashboard" |

**Note:** Legacy paths `/study/reference` and `/study/toolkit` redirect to `/study/knowledge` and `/study/utilities`.

---

## 2. Command Center & UI/UX

| Step | Action | Expectation |
|------|--------|-------------|
| 2.1 | Check header | Brand, Admin, Settings, theme toggle, offline indicator present |
| 2.2 | Check primary CTA | One clear "Build Session" or "Start Session" (per design system) |
| 2.3 | Check widgets | Welcome back, streak, recommendations, curriculum grid, quick stats (no blank key areas) |
| 2.4 | Check training sectors | Visual diagnostics, clinical sim, question practice, specialty drills visible |
| 2.5 | Resize to 375px | No horizontal scroll; touch targets ≥ 44px |
| 2.6 | Check focus ring | Tab to buttons; visible focus ring (not pure black) |

---

## 3. Main Session Flow (Critical Path)

| Step | Action | Network / Console |
|------|--------|-------------------|
| 3.1 | Click "Build Session" or "Start Session" | Session setup modal or direct start |
| 3.2 | Choose focus (e.g. "All") and start | **GET `/api/questions/session?...`** → 200, body has `questions` (and optionally `analytics`, `poolStatus`) |
| 3.3 | Answer 1–2 questions | **POST `/api/questions/attempt`** for each submit → 200 |
| 3.4 | Check Console Ninja / console | No uncaught errors; optional `[PANaCEa] [SyncManager]` debug logs in dev only |
| 3.5 | End or exit session | Return to Command Center; optional "Resume" if session was active |

---

## 4. Due & Flagged Flows

| Step | Action | Expectation |
|------|--------|-------------|
| 4.1 | Start session with "Due" (review) focus (when due items exist) | **POST `/api/questions/due-siblings`** → 200; QuizView shows variant questions |
| 4.2 | Start with "Flagged" focus (when flagged list non-empty) | QuizView shows flagged questions (no extra load API) |

---

## 5. FSRS & SRS

| Step | Action | Expectation |
|------|--------|-------------|
| 5.1 | Trigger GET for FSRS params (e.g. Settings or dashboard) | **GET `/api/user/fsrs-params`** → 200, body has `params` or default message |
| 5.2 | Submit an SRS review (if UI supports) | **POST `/api/srs/submit`** → 200 (request uses `{ "body": { questionId, rating, isCorrect, ... } }`) |
| 5.3 | Check due count / SRS stats | **GET `/api/srs/due`**, **GET `/api/srs/stats`** where used → 200; UI shows counts |

---

## 6. Data Collection & Display

| Step | Action | Expectation |
|------|--------|-------------|
| 6.1 | After a few attempts, open Progress or dashboard | **GET `/api/user/stats`** → 200; `UserFriendlyStatsDisplay` shows accuracy, streak, systems, weak areas |
| 6.2 | Check dashboard-specific requests | **GET `/api/dashboard/stats`**, **GET `/api/stats/retention`** where used → 200 |
| 6.3 | Check rolling 360 | **GET `/api/user/rolling-360-stats`** when Command Center loads → 200; widget not blank |

---

## 7. Console & Errors (Console Ninja)

| Step | Action | Expectation |
|------|--------|-------------|
| 7.1 | Filter console for `error` and `warn` | Ignore known benign: React DevTools, clerk-telemetry (non-CSP), ResizeObserver loop, favicon 404 |
| 7.2 | Check for CSP | No CSP violation for clerk-telemetry |
| 7.3 | Check log format | App logs use `[PANaCEa] [Scope]` tag (SyncManager, QuizView) for easier filtering |

---

## 8. API Endpoints Quick Reference

**Session & questions**

- `GET /api/questions/session` – fetch session questions
- `POST /api/questions/due-siblings` – due review variants
- `POST /api/questions/attempt` – record each answer

**FSRS / SRS**

- `GET/POST /api/user/fsrs-params` – get/optimize FSRS params
- `POST /api/user/update-fsrs-params` – update params
- `POST /api/srs/submit` – submit SRS review (`body.questionId`, `body.rating`, `body.isCorrect`; ratings 2/4 are normalized server-side)
- `GET /api/srs/due`, `GET /api/srs/stats`, `GET /api/srs/sync` – due count, stats, sync

**Stats & display**

- `GET /api/user/stats` – main analytics (UserFriendlyStatsDisplay)
- `GET /api/dashboard/stats` – streak, weakest system, predicted pass
- `GET /api/user/rolling-360-stats` – rolling 360 widget
- `GET /api/stats/retention` – retention data

---

## 9. E2E (Playwright)

- Run route + console audit:  
  `BASE_URL=<url> npx playwright test e2e/feature-console-audit.spec.ts`
- Routes covered: `/`, `/study`, `/study?tab=analytics`, `/study/knowledge`, `/study/utilities`, `/menu`
- Assertions: no uncaught page errors; console issues logged for review; no CSP violation for clerk-telemetry
