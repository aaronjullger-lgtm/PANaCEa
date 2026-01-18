# PANaCEa Master Implementation Plan

This document outlines the prioritized plan to address the outstanding issues and feature requests for the PANaCEa platform.

## Phase 1: Security & Core Infrastructure (The Foundation)

**Goal:** Secure the application and ensure the backend foundation is solid.

- **[CRITICAL] Admin Authentication:**
  - Apply `requireAdmin` middleware to all admin routes in `server.ts`.
  - Secure `AdminDashboard.tsx` by validating the user role server-side (via API) instead of relying on `localStorage`.
- **[CRITICAL] Gemini Proxy Security:**
  - Implement prompt validation/classification in `/geminiProxy` to prevent prompt injection (ensure queries are medical).
- **[CRITICAL] Rate Limiting:**
  - Migrate from in-memory `Map` to Redis (or a persistent store) for rate limiting to support scalability.
- **Database Persistence:**
  - Enable the commented-out database storage logic in `server.ts`.
  - Ensure `DATABASE_URL` is properly configured and handled.
- **API Routing Architecture:**
  - Implement missing routes in `server.ts`: `/api/admin/stats`, `/api/performance`, `/api/srs`, `/api/achievements`, `/api/questions/query`.

## Phase 2: Data Persistence & Synchronization (The Glue)

**Goal:** Ensure user data is saved reliably and synchronized across devices.

- **Grand Rounds Mode:**
  - Connect to API: Replace mock data generation with `fetchQuestionsByIds`.
  - Implement `submitCompletion` to save results to the database.
- **Patient Encounter / OSCE Persistence:**
  - Connect chat history to `/api/osce/chat` for persistence.
  - Ensure session state is saved/restored correctly.
- **Drill Modes Persistence:**
  - Update `PhotoDrillSession`, `MiniLabDrillSession`, `PharmDrillSession`, `ConditionDrillSession` to call `submitScore()` API.
  - Implement unified `submitDrillResult()` for consistent scoring.
- **Cloud Sync:**
  - Migrate frontend from `localStorage` reliance to API-first data fetching.
  - Fix `offlineSyncService.ts` to match server routes.

## Phase 3: AI & Advanced Features (The Brain)

**Goal:** Leverage Gemini for dynamic, intelligent feedback.

- **SOAP Note Grading:**
  - Replace length-based scoring with Gemini-based rubric analysis via `/geminiProxy`.
- **AI Coach & Socratic Method:**
  - Update `CoachingService.ts` to call `/geminiProxy` for dynamic feedback on user answers.
  - Implement "Socratic Coach" to guide users instead of giving static responses.
- **Rapid Recall:**
  - Implement semantic validation using Gemini (e.g., "Crohn's" = "Crohn's Disease") instead of exact string matching.
- **Dynamic Personas:**
  - Update `virtualAttendingService` to generate unique feedback based on personas.

## Phase 4: UI/UX Polish & Accessibility (The Face)

**Goal:** Improve the user experience, accessibility, and visual consistency.

- **Theme Inconsistency:**
  - Fix dark mode issues in Patient Encounter and Training Menu.
  - Replace hard-coded colors with semantic CSS variables.
- **Mobile Responsiveness:**
  - Fix cramped inputs in Patient Encounter.
  - Fix overflow issues in Settings Modal and Training Menu.
- **Lab Trendlines:**
  - Implement `<Sparkline />` component for lab values in Patient Encounter.
- **Accessibility:**
  - Add ARIA labels, fix focus traps, and improve keyboard navigation.
- **Loading States:**
  - Add indicators for submission and data fetching actions.

## Phase 5: New Features & Content Expansion (The Growth)

**Goal:** Add requested features and expand content.

- **Clinical Fidelity Mode:**
  - Connect Settings toggle to `PatientEncounterMode` logic.
- **Medical Spanish Mode:**
  - Implement robust translation service (API-based) for clinical vignettes.
- **Real PANRE-LA:**
  - Connect simulator to database for actual questions and progress tracking.
- **Dynamic Content:**
  - Move "Code Blue" questions to DB.
  - Fetch "This Day in Medicine" from external API.
  - Fetch Imaging assets from storage API.
- **Database Economy:**
  - Implement `UserWallet` table and transaction endpoints.

## Phase 6: DevOps & Automation (The Machine)

**Goal:** Automate maintenance and ensure reliability.

- **Automated Jobs:**
  - Schedule Grand Rounds creation and cleanup (Cron/GitHub Actions).
- **Test Coverage:**
  - Increase unit and integration test coverage for UI components.
- **Sanitization:**
  - Upgrade input sanitization to `DOMPurify`.

---

**Next Steps:**
We will begin with **Phase 1**, focusing on securing the Admin routes and enabling Database persistence.
