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
- [ ] Answer at least one question and get feedback
- [ ] Complete or exit session; results or progress visible
- [ ] No console errors during quiz load and submit

## Critical Pages Load

- [ ] Dashboard (or home) loads
- [ ] Condition Library loads and search works
- [ ] Settings (or profile) loads
- [ ] At least one mode (e.g. DDx, OSCE, Drill) loads without crash

## Rate Limiting (if KV bound)

- [ ] Gemini/OSCE grade endpoints return 429 after exceeding limit (optional manual test)

## Sign-off

- [ ] All critical paths above passed
- [ ] No blocking errors in browser console for happy path
- [ ] Sentry (if configured) receiving events for any caught errors
