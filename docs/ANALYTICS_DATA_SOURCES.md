# Analytics Data Sources and Consistency

## Overview

PANaCEa uses two main sources for analytics:

1. **Client-side (heatmap and growth areas)** – Synced `performanceData` from `useUserStats`, filtered by `focus === 'all'`.
2. **Server-side (Analytics Dashboard)** – Aggregated stats from `/api/user/stats` (and related endpoints).

Both stay consistent when performance records include `focus` and are synced correctly.

## Client-Side: Heatmap and Growth Areas

- **Source:** `useUserStats()` → `performanceData` (synced from GET/POST `/api/sync`).
- **Filter:** Only records with `focus === 'all'` are used for:
  - **Heatmap** – `heatmapPerformance` in `App.tsx` and `MenuView` (topic/system breakdown).
  - **Growth areas** – Weakest topics by accuracy, derived from the same filtered set.
- **Rationale:** “All topics” sessions are PANCE-level; topic/system stats and growth areas are computed from this subset so they reflect full exam-style practice.

## Server-Side: Analytics Dashboard

- **Source:** `/api/user/stats` (and `/api/user/stability-trend`, `/api/analytics/calibration`, `/api/analytics/learner-analysis`, `/api/analytics/readiness-projection`, etc.).
- **Data:** Aggregated from `QuestionAttempt`, `UserProgress`, and related tables; by-system accuracy, time, calibration, learner clustering, and exam readiness projections.
- **Readiness projection:** `GET /api/analytics/readiness-projection?examDate=YYYY-MM-DD` — FSRS card-level readiness with per-system breakdown (see `docs/api/API_OVERVIEW.md`).
- **Learner analysis:** `GET /api/analytics/learner-analysis` — behavioral archetype, early warnings, and composite risk score (see `docs/api/API_OVERVIEW.md`).

## Consistency

- When a user completes a session, performance records (with `focus`, `topic`, `system`) are:
  1. Added locally in the quiz flow.
  2. Synced to the server via POST `/api/sync` (and/or drill submit endpoints).
- Ensuring `focus` is set on each record (e.g. `sessionSettings.focus`) keeps client heatmap/growth areas and server aggregates aligned.
- If the heatmap is empty but the user has done “all topics” sessions, check that records have `focus: 'all'` and that sync has run (e.g. after session end).
