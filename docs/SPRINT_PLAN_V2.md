# Sprint Plan: Main Session Enhancements (V2)

This sprint focuses on delivering tangible improvements to the core user study session. The five legs cover advanced content generation, UI/UX refinement, performance optimization, enhanced analytics, and new feature development.

---

### Leg 1: Advanced Content Generation & Quality Control

*Goal: Increase question variety and establish a quality assurance workflow.*

1.  **Implement Image-Based Question Generation:**
    *   **Task:** Create a new script in `scripts/generators/` for generating questions based on clinical images (e.g., ECGs, X-rays, dermatological photos).
    *   **Details:** The script will source images from a designated directory (e.g., `assets/clinical-images/`), use the Gemini Vision model to interpret the image, and generate a PANCE-style question.
    *   **Files to Create/Modify:** `scripts/generators/image-question-generator.ts`, `assets/clinical-images/`.

2.  **Develop Question Curation Admin Panel:**
    *   **Task:** Build a new admin component for reviewing, editing, and approving questions from the `PreGeneratedQuestion` pool.
    *   **Details:** This interface will allow admins to "promote" high-quality questions to the main `Question` table, fix typos, or delete poor-quality questions. This creates a sustainable content pipeline.
    *   **Files to Create/Modify:** `components/admin/QuestionCurationPanel.tsx`, `functions/api/questions/curate.ts`.

---

### Leg 2: UI/UX Refinement

*Goal: Make the study session setup more intuitive and the dashboard more insightful.*

1.  **Redesign Session Setup Modal:**
    *   **Task:** Overhaul `SessionSetupModal.tsx` to include study presets.
    *   **Details:** Introduce one-click presets like "Quick 10-min Review," "Cardiology Deep Dive," or "Weakest Topics Drill." These presets will automatically configure the session settings.
    *   **Files to Modify:** `components/SessionSetupModal.tsx`, `config/training-modes.ts`.

2.  **Add Topic Performance Trend Chart:**
    *   **Task:** Implement a new chart in the `ProgressDashboard/` that visualizes user performance on a specific topic over time.
    *   **Details:** This will help users see if their study efforts in a particular area are leading to improvement. Use a line chart to show the percentage correct for a selected topic across multiple sessions.
    *   **Files to Create/Modify:** `components/ProgressDashboard/TopicTrendChart.tsx`, `services/analyticsService.ts`.

---

### Leg 3: Performance Optimization

*Goal: Reduce load times and improve the responsiveness of the application.*

1.  **Implement Client-Side Content Caching:**
    *   **Task:** Cache medical content fetched from the database in the browser's `localStorage`.
    *   **Details:** During a study session, when `geminiService.ts` fetches content for a condition, cache the result. On subsequent requests for the same condition, pull from the cache to avoid redundant database calls, speeding up question generation.
    *   **Files to Modify:** `services/conditionDataLoader.ts`, `services/geminiService.ts`.

2.  **Optimize Component Loading:**
    *   **Task:** Review and expand the manual chunking strategy in `vite.config.ts`.
    *   **Details:** Defer the loading of large, non-critical components (e.g., complex modals, admin panels) using dynamic `import()` statements. This will reduce the initial JavaScript bundle size and improve the application's initial load time.
    *   **Files to Modify:** `vite.config.ts`, `App.tsx` (or relevant router configuration).

---

### Leg 4: Enhanced Analytics & User Feedback

*Goal: Empower users to give better feedback and understand their long-term progress.*

1.  **Overhaul "Flag Question" Functionality:**
    *   **Task:** Enhance the `FlagQuestionModal.tsx` to allow for more specific feedback.
    *   **Details:** Instead of a generic flag, provide categories like "Incorrect Fact," "Typo in Question/Rationale," "Confusing Options," or "Image is Unclear." This structured feedback is more actionable for the curation process.
    *   **Files to Modify:** `components/FlagQuestionModal.tsx`, `functions/api/feedback/submit.ts`.

2.  **Implement Long-Term Spaced Repetition (SRS) Analytics:**
    *   **Task:** Create a new dashboard view dedicated to FSRS analytics.
    *   **Details:** Display metrics like "Retention Rate," "Projected Memory Stability," and a list of "Upcoming Reviews." This gives users insight into the effectiveness of their long-term study habits.
    *   **Files to Create/Modify:** `components/analytics/SrsDashboard.tsx`, `lib/fsrs.ts`.

---

### Leg 5: New Feature Development

*Goal: Introduce a new, high-value study mode.*

1.  **Develop "Differential Diagnosis (DDx) Trainer" Mode:**
    *   **Task:** Create a new study mode where the user is presented with a clinical vignette and must select the most likely diagnosis from a list of similar conditions.
    *   **Details:** This mode specifically targets clinical reasoning. After a selection, the AI will provide a detailed rationale explaining why the chosen answer is correct or incorrect and how to differentiate it from the other options.
    *   **Files to Create/Modify:** `components/modes/DdxTrainer.tsx`, `services/ddxService.ts`, `functions/api/ddx/generate.ts`.
