# Smoke Test Checklist (Sprint 4 Launch)

Use this checklist for manual QA after deployment to verify critical paths.

## Pre-requisites

- [ ] Production (or staging) URL is live
- [ ] Environment variables set: `DATABASE_URL`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY` (and optional `RATE_LIMIT_KV`)

## Health & Infrastructure

- [ ] `GET /api/health` returns 200 when DB is reachable
- [ ] Response includes `checks.database.status: "pass"`, `checks.auth`, `checks.cache`
- [ ] Uncaught React errors are caught by GlobalErrorBoundary (no white screen)

## Auth & Core Flow

- [ ] Login → redirect to app (or landing)
- [ ] Logout → redirect to sign-in
- [ ] Session persists on refresh when logged in

## Quiz / Session Flow

- [ ] Start a practice session (e.g. from Practice or Study)
- [ ] `GET /api/questions/session` returns `questions` plus `analytics`/`poolStatus` payload
- [ ] Answer at least one question and get feedback
- [ ] Complete or exit session; results or progress visible
- [ ] No console errors during quiz load and submit

## Question Pool & Due Review

- [ ] `GET /api/questions/pool` returns `questions[]` and `poolStatus`
- [ ] Due review path triggers `POST /api/questions/due-siblings` and returns sibling question results
- [ ] Enhanced generation path (`POST /api/questions/generate-enhanced`) returns `question` + `verification` metadata

## Critical Pages Load

- [ ] Dashboard (or home) loads
- [ ] Condition Library loads and search works
- [ ] Condition Library filters load from `GET /api/content/systems`
- [ ] Condition detail panel loads from `GET /api/content/condition/:conditionId/details`
- [ ] Settings (or profile) loads
- [ ] At least one mode (e.g. DDx, OSCE, Drill) loads without crash

## Rate Limiting (if KV bound)

- [ ] Repeated `GET /api/health` requests eventually return `429` for anonymous limits (optional manual test)

## Sign-off

- [ ] All critical paths above passed
- [ ] No blocking errors in browser console for happy path
- [ ] Sentry (if configured) receiving events for any caught errors
