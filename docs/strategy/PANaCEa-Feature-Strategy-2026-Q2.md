# PANaCEa Feature Strategy & SDK Opportunity Analysis

**Date:** April 3, 2026
**Scope:** New feature proposals grounded in the audited codebase
**Audience:** Product owner / lead architect

---

## A. Existing Foundations Worth Building On

These are the most important current systems that create leverage for new features. Each is production-quality code that is collecting data, running pipelines, or exposing interfaces that are only partially exploited today.

### 1. Implicit Metrics + Confidence Pipeline (highest leverage)

The `implicit-metrics.ts` (794 lines) and `drillReviewService.ts` (1,353 lines) together form one of the most sophisticated behavioral assessment systems in any SRS product. The system collects 200+ telemetry fields per question attempt, including response latency, answer switches, cursor entropy, hover oscillations, commitment gap, and full mouse trajectory data. It derives continuous ratings (1.0-4.0) via ex-Gaussian RT classification, multi-signal SDT blending, and Ghost Grader behavioral honesty checks.

**What is unused:** Four complete confidence pipeline modules are imported but never called: `desirableDifficultyBonus`, `difficultyModulator`, `interferenceDetector`, and `trendDetector`. Wave 3B (session regularity), 3C (relearning speed), and 3D (confusion pair recurrence) are also imported but not triggered. This means the system already has the code to detect interference between similar questions, track confidence trajectories across sessions, and reward desirable difficulty --- it just needs wiring.

### 2. Hybrid Search + Embedding Infrastructure

The codebase has a complete hybrid search pipeline: keyword (PostgreSQL full-text with `ts_rank`) plus semantic (768-d `text-embedding-005` via pgvector with HNSW indexing), fused via Reciprocal Rank Fusion (k=60). `MedicalContentEmbedding` and `ContentChunk` tables exist with vector columns. The embedding pipeline generates on-demand and caches in the database.

**What is underexploited:** Embeddings exist per-condition but are not used for question similarity, distractor quality assessment, or confusion-pair prediction. The search pipeline serves the library but is not integrated into the session flow (e.g., for dynamic reference linking during question review).

### 3. Confusion Pair System (dual-storage, graph-capable)

Confusion tracking exists at both the client level (localStorage with `confusionService.ts`, including graph building and RRF-normalized edge weights) and the server level (ConfusionPair model with bidirectional entity-level foreign keys). The `ExplanationPanel` already calls `recordConfusion()` on incorrect answers and `updateWeaknessMap()` for weakness tracking.

**What is underexploited:** The confusion graph data is collected but not used to drive session content selection, generate targeted contrastive questions, or surface "you keep confusing X with Y" insights on the dashboard.

### 4. Proactive Question Reservoir

The reservoir system (`reservoirService.ts`, `refillOrchestrator.ts`, `refillWorker.ts`) is a production background queue with `FOR UPDATE SKIP LOCKED` atomic reservation, TTL management, priority-weighted selection (overdue review = 9, due = 7, gap = 6, standard = 5, backfill = 3), low/high water marks (15/40), and 2-hour maintenance cron. This eliminates wait time during sessions.

**What is underexploited:** The reservoir currently only fills for the `adaptive` scope. It does not pre-warm for drill-specific scopes, rotation-specific content, or confusion-pair-targeted remediation.

### 5. Question Generation + Quality Pipeline

Gemini 2.5 Flash with Google Search grounding generates structured questions with 5-section rationales (bottomLine, whyCorrect, whyIncorrect per option, clinicalPearl, highYieldImageOrTable). A staging-to-live pipeline with AI critic scoring (auto-promote >90, flag 70-90, reject <70) gates quality. Blueprint weighting aligns to NCCPA 2025 percentages across 15 organ systems and 8 task categories.

**What is underexploited:** Generation is batch/admin-triggered, not learner-reactive. No mechanism exists to generate questions in response to detected confusion pairs, weak areas, or specific cognitive gaps.

### 6. NCCPA Blueprint Alignment + Learner Phase System

`nccpa-question-weighting.ts` implements a complete blueprint distribution engine with learner phase modulation (Didactic: 30/50/20 by Bloom's order; Clinical: 15/40/45; PANCE Prep: 10/35/55). Task category weights match the 2025 PANCE blueprint exactly.

**What is underexploited:** The learner phase is not automatically detected from user behavior or rotation schedule. It requires manual configuration. The system could infer phase from the user's clinical profile (currentRotation, eorDate) and adapt automatically.

### 7. 35+ Drill Modes with Shared Shell

The `DrillShell.tsx` orchestrator wraps 35+ specialized drill components including contrastive drills, DDx ranking, ECG interpretation, ventilator simulation, pharmacology, anatomy spatial canvas, and teach-back. Each drill uses `useDrillFSRS` for spaced repetition integration.

**What is underexploited:** Drill selection is manual. No system recommends which drill mode to use based on the learner's current weakness profile, confusion patterns, or FSRS card states.

### 8. Adaptive Dashboard Registry

The active `/study` dashboard now renders through `CommandCenterWorkspace` and the adaptive registry under `components/dashboard/adaptive/`. The old all-widgets-at-once dashboard bench has been retired; new dashboard ideas should ship as registry entries that pass eligibility, scoring, suppression, slot resolution, and visual-budget checks.

**What is underexploited:** The confidence pipeline's unused modules (trend detection, interference detection, desirable difficulty) could feed richer normalized signals, but they should adapt the plan and attribution rather than create extra always-visible analytics.

### 9. Cron + Background Job Infrastructure

11 cron endpoints run via GitHub Actions (daily at 3 AM UTC, hourly, weekly). These include: `aggregate-analytics`, `daily-prescription`, `replenish-pool`, `reservoir-maintenance`, `compute-content-health`, `generate-variants`, `push-reminders`, `nightly-health-check`. The infrastructure supports adding new scheduled jobs trivially.

### 10. OSCE / Patient Encounter Simulation

A full OSCE simulation system exists with 15 endpoints, a state machine, orderable items (labs, imaging), intervention tracking, and AI chat. This is a complete virtual patient encounter framework.

**What is underexploited:** OSCE sessions don't feed back into the FSRS system or confusion graph. Clinical reasoning demonstrated in OSCE could inform the learner's condition-level mastery.

---

## B. New Feature Proposals

### Feature 1: Metacognitive Mirror Dashboard

**What it does:** Surfaces learner-facing insights derived from the implicit metrics pipeline. Shows users their behavioral patterns: "You tend to switch answers on cardiology questions (and the switch hurts you 68% of the time)," "Your first instinct is correct 74% of the time on pharmacology," "You spend 3x longer on GI questions but aren't more accurate," "Your confidence calibration is improving: predicted 70%, actual 72%."

**Why it is valuable:** Most SRS tools show accuracy and streaks. PANaCEa already collects answer switches, cursor entropy, hover oscillations, commitment gap, and trajectory confidence --- this data is uniquely rich. Surfacing it creates a metacognitive feedback loop that no competitor offers. Research shows metacognitive awareness is one of the strongest predictors of exam performance.

**Builds on:** `implicit-metrics.ts` (switch counts, trajectory confidence, hover oscillations), `CalibrationChart.tsx`, `ReviewLog.grade_continuous`, `ReviewLog.implicit_confidence`, `DailyUserAnalytics`, `UserStatistics.rushedSystems` / `overthinkingSystems`.

**SDK needed:** No. All data already collected.

**Complexity:** Medium (aggregation queries + new dashboard widgets)
**Impact:** High
**Prerequisites:** Wire `desirableDifficultyBonus`, `trendDetector`, and `interferenceDetector` into the live pipeline to enrich the data feeding these insights.

---

### Feature 2: Confusion-Aware Adaptive Drill Routing

**What it does:** When a user answers incorrectly and the confusion pair is recorded, the system automatically queues a targeted remediation sequence: (1) a contrastive drill comparing the confused conditions, (2) a recall question on the correct condition 10 minutes later, (3) a similar-but-different vignette 24 hours later. The reservoir pre-warms these targeted items.

**Why it is valuable:** Confusion between similar conditions (e.g., Crohn's vs UC, epidural vs subdural) is the #1 source of PANCE errors. Current confusion tracking is passive. This turns it into active, spaced remediation.

**Builds on:** `ConfusionPair` (server-side), `confusionService.ts` (client-side graph), `ContrastiveDrill.tsx`, `DDxDrillSession.tsx`, reservoir `refillWorker.ts` (scope system already supports `condition:{id}`), FSRS scheduling.

**SDK needed:** No.

**Complexity:** Medium (reservoir scope extension + drill routing logic + confusion-to-content mapping)
**Impact:** Very High
**Prerequisites:** Confusion pair data needs sufficient density; ensure `recordConfusion()` is called on all incorrect answers across all drill types, not just QuizView.

---

### Feature 3: Retrieval-Augmented Explanation Enhancement

**What it does:** When a user views a question explanation, the system uses the existing hybrid search pipeline to pull the most relevant MedicalContent chunks, clinical pearls, and guideline references, then presents them as expandable "deep dive" sections beneath the standard rationale. For PANRE-LA preparation, this simulates the open-book reference lookup workflow.

**Why it is valuable:** PANRE-LA (the new recertification exam) allows reference materials. Training students to efficiently find and use references during practice builds a transferable skill. It also enriches explanations without requiring manual curation of every question.

**Builds on:** `semantic-search.ts` (hybrid search with RRF), `ContentChunk` + `MedicalContentEmbedding` (vector store), `ExplanationPanel.tsx` (already has structured rationale display), `SourceMaterial` model (citation tracking).

**SDK needed:** No new SDK. Uses existing `text-embedding-005` via Google GenAI.

**Complexity:** Medium
**Impact:** High
**Prerequisites:** Embedding coverage needs to be expanded beyond current ~400-500 conditions. Run batch embedding generation for all MedicalContent.

---

### Feature 4: Behavioral Fatigue Forecasting + Smart Session Length

**What it does:** Uses the existing per-session behavioral signal trajectory (RT slope, accuracy slope, switch rate increase, cursor entropy trend) to predict when a learner is entering cognitive fatigue. Proactively suggests session end or break at the optimal stopping point, before performance degrades. Shows a "diminishing returns" indicator in the session pacer.

**Why it is valuable:** Students often study past the point of productive learning, especially during PANCE prep. The data to detect this already exists in every session. Intervening at the right moment maximizes retention per minute studied.

**Builds on:** `useSessionWellness.ts` (already tracks rapid answering, late-night), `WellnessCheckModal.tsx` (breathing exercise UI), `SessionPacer.tsx`, `useFatigueTracking()` hook, `trendDetector.ts` (confidence trajectory --- currently unused), `exGaussianRT.ts` (lapse detection), session-level `updateLatencyStats()`.

**SDK needed:** No.

**Complexity:** Low-Medium (trend detection code exists; needs integration into session UI)
**Impact:** High
**Prerequisites:** Wire `trendDetector.detectConfidenceTrend()` into the live pipeline.

---

### Feature 5: AI-Powered Spaced Repetition Parameter Optimization

**What it does:** Uses each learner's accumulated ReviewLog data to run per-user FSRS parameter optimization. Instead of the global 21-parameter default, each learner gets personalized scheduling weights fitted to their actual forgetting curves. Runs as a background job (weekly cron) and updates `UserProgress.fsrsCard` parameters.

**Why it is valuable:** FSRS v6 with default parameters is already good, but personalized parameters can reduce review load by 10-20% while maintaining the same retention target. The `open-spaced-repetition/binding` package is already in the dependency list, suggesting this was planned.

**Builds on:** `fsrs.ts` (v6 with 21 params), `ReviewLog` (full history with grade_continuous, stability, difficulty, retrievability), `@open-spaced-repetition/binding` (already in package.json), `UserProgress.reviewHistory` (JSON array of snapshots), cron infrastructure.

**SDK needed:** No new SDK. `fsrs.js` and `@open-spaced-repetition/binding` already installed. May want the FSRS optimizer from `open-spaced-repetition/fsrs-optimizer` (Python) for the fitting algorithm, callable via a background worker.

**Candidate service:** `open-spaced-repetition/fsrs-optimizer` (Python package, run in GitHub Actions weekly job)

**Complexity:** Medium
**Impact:** High
**Prerequisites:** Minimum ~100 reviews per user for meaningful parameter fitting. Need a `UserFSRSParams` table or field on User model.

---

### Feature 6: Clinical Image Interpretation Training with Vision AI

**What it does:** Extends the existing `PhotoDrillCard`, `ECGDrillSession`, `ImagingDrillSession`, and `DermDrillSession` with Gemini Vision-powered image analysis feedback. After a student identifies a finding in an image, the AI highlights the relevant region, explains what to look for, and generates follow-up questions about similar-appearing conditions. Uses the existing `SpatialAnswerCanvas` for point-and-click interactions.

**Why it is valuable:** Image interpretation is a high-yield PANCE area (dermatology, radiology, ECG). The drill components and spatial canvas already exist. Adding AI-powered feedback transforms static image questions into interactive visual learning.

**Builds on:** `PhotoDrillCard.tsx`, `ECGDrillSession.tsx`, `ImagingDrillSession.tsx`, `DermDrillSession.tsx`, `SpatialAnswerCanvas.tsx`, `MediaAsset` model (with qualityScore, approvalStatus), `/api/vision/analyze` and `/api/vision/analyze-3d` endpoints (already exist), Gemini Vision (`gemini-1.5-pro` already used for image grading in `lib/gemini.ts`).

**SDK needed:** No new SDK. Gemini Vision already integrated.

**Complexity:** Medium-High (annotation rendering, region highlighting, follow-up generation)
**Impact:** High
**Prerequisites:** MediaAsset population is sparse. Need more clinically relevant images. Consider integration with open medical image databases.

---

### Feature 7: Cross-Session Interference Alerts

**What it does:** Activates the existing (but unused) `interferenceDetector.ts` to detect when a student is confusing recently-studied similar topics. When interference is detected (e.g., studying both Crohn's and UC in the same session, and performance on both drops), the system alerts the student and suggests interleaving with a different system before returning.

**Why it is valuable:** Proactive interference is a well-documented learning science phenomenon. The detection code already exists. Surfacing it helps students understand why their performance suddenly dropped and gives them an evidence-based strategy (interleaving) to fix it.

**Builds on:** `interferenceDetector.ts` (complete module, never called), `confusionService.ts` (confusion graph), session-level review tracking, `drillReviewService.ts` (where the call would be inserted).

**SDK needed:** No.

**Complexity:** Low (module exists; needs one function call in drillReviewService + UI notification)
**Impact:** Medium-High
**Prerequisites:** None beyond wiring the existing module.

---

### Feature 8: PubMed-Grounded Evidence Cards

**What it does:** For high-yield conditions and treatments, automatically fetches relevant PubMed abstracts and guidelines using the PubMed E-utilities API. Presents them as "Evidence Cards" within the ExplanationPanel, with relevance ranking and plain-language summaries generated by Gemini. Supports the evidence-based medicine competency expected on PANCE.

**Why it is valuable:** PA students need to develop evidence appraisal skills. Current explanations use Gemini's Google Search grounding, which provides general web sources. PubMed integration provides authoritative medical evidence. The MCP tools `search_articles`, `get_article_metadata`, and `get_full_text_article` are already available in the environment.

**Builds on:** `ExplanationPanel.tsx` (structured rationale with grounding sources), `SourceMaterial` model (citation tracking), Gemini summarization, `MedicalContent` (condition data for search queries).

**SDK/Integration needed:** PubMed E-utilities API (free, NCBI). The MCP connector for article search is already available (`search_articles`, `get_article_metadata`).

**Candidate service:** NCBI E-utilities (Entrez), or the already-connected article search MCP

**Complexity:** Medium
**Impact:** Medium-High
**Prerequisites:** Rate limiting for NCBI API (max 3 requests/second without API key, 10 with). Cache results in ContentChunk table.

---

### Feature 9: Rotation-Aware Auto-Curriculum

**What it does:** Reads the user's clinical profile (currentRotation, eorDate, rotation schedule) and automatically adjusts the learner phase, blueprint weighting, and reservoir priority to match their current clinical context. During an EM rotation, the system upweights emergency medicine, trauma, and acute care content. As the EOR exam approaches, it shifts from clinical application to exam-format questions.

**Why it is valuable:** PA students rotate through 6-10 clinical rotations, each with its own EOR exam. Currently, learner phase and content focus require manual configuration. Automatic alignment eliminates friction and ensures students are always studying the most relevant content.

**Builds on:** `nccpa-question-weighting.ts` (learner phases, system weights), adaptive dashboard mode profiles, `ExamHorizonWidget`, `GoalContextWidget`, the `UserProfile` model (currentRotation, eorDate fields likely exist or planned), reservoir priority system, `daily-prescription.ts` cron.

**SDK needed:** No.

**Complexity:** Medium
**Impact:** Very High
**Prerequisites:** User profile must store rotation schedule with dates. Feed rotation deadlines into dashboard normalization and mode classification so EOR/didactic modes select the right widgets.

---

### Feature 10: Lecture/PDF Content Ingestion Pipeline

**What it does:** Allows students to upload lecture slides (PPTX) or PDFs from their PA program. The system extracts text, identifies medical concepts, maps them to existing conditions/topics in the database using semantic search, and generates practice questions from the lecture content. Creates a "Study from your lectures" mode.

**Why it is valuable:** Every PA student has program-specific lecture materials. Being able to study from their own content within PANaCEa's SRS framework is a massive retention and engagement driver. The ingestion infrastructure partially exists (OpenStax PDF extraction in `scripts/ingest/`, `batchProcessPDFs.ts`, content chunking).

**Builds on:** `scripts/ingest/` (PDF/XML extraction, chunking), `ContentChunk` table (RAG storage), `MedicalContentEmbedding` (semantic matching), `generationService.ts` (question generation from content), `text-embedding-005` (embedding pipeline), hybrid search for concept mapping.

**SDK needed:** PDF extraction: `pdf-parse` or similar (may already be available). PPTX extraction: `pptx-parser` or Office XML unpacking. Both are lightweight.

**Candidate services:** `pdf-parse` (npm), `mammoth` (docx), `pptx2json` (pptx)

**Complexity:** High (ingestion pipeline, concept mapping, quality filtering)
**Impact:** Very High
**Prerequisites:** Robust concept-to-condition mapping via embeddings. Content quality filtering to avoid generating questions from poorly structured lecture notes.

---

### Feature 11: Predictive Exam Score with Confidence Intervals

**What it does:** Extends the existing `Rolling360Buffer` / `UserRolling360Stats` to produce a real PANCE score prediction with confidence intervals, using the learner's FSRS card states, accuracy by blueprint area, and calibration data. Shows a simulated score report matching the PANCE format (scaled score, pass/fail probability, per-system breakdown).

**Why it is valuable:** "Am I ready for the exam?" is the #1 question PA students ask. A data-driven prediction based on actual performance, calibrated against blueprint weights, is far more useful than raw accuracy percentages.

**Builds on:** `UserRolling360Stats` (360-question rolling window), `nccpa-question-weighting.ts` (blueprint weights by system), `CalibrationChart.tsx` (confidence calibration), `ExamReadinessCard.tsx` (already exists), `DailyUserAnalytics` (daily aggregation), FSRS card states (stability/difficulty distribution).

**SDK needed:** No.

**Complexity:** Medium
**Impact:** Very High
**Prerequisites:** Sufficient question coverage across all 15 blueprint systems. Calibration requires mapping internal accuracy to PANCE scaled scores (requires external validation data or heuristic modeling).

---

### Feature 12: Socratic Remediation Loops

**What it does:** When a student gets a question wrong, instead of just showing the explanation, the system enters a Socratic dialogue mode. Using Gemini, it asks the student guided questions to help them reason through the correct answer: "What are the risk factors for this condition?" "Given those findings, what would you expect on imaging?" The dialogue adapts based on the student's responses.

**Why it is valuable:** Passive explanation reading creates recognition-based false mastery. Active retrieval through guided questioning forces deeper processing. The `/api/intelligence/socratic-remediation` endpoint and `reasoning_tutor` mode already exist in the codebase.

**Builds on:** `/api/intelligence/socratic-remediation` (endpoint exists), `/api/tutor/chat` (AI tutor), `reasoning_tutor` training mode (defined in `training-modes.ts`), `MetacognitionPromptModal.tsx` (reflection prompts), `ElaborationDrill.tsx` (elaboration/reasoning), `TeachBackDrill.tsx` (active recall).

**SDK needed:** No new SDK. Gemini chat already integrated.

**Complexity:** Medium (endpoint exists; needs session flow integration and quality tuning)
**Impact:** High
**Prerequisites:** Careful prompt engineering to keep Socratic dialogue focused and time-efficient. Must not add too much friction to session flow.

---

### Feature 13: Push Notification Study Reminders with Optimal Timing

**What it does:** Uses the existing `push-reminders.ts` cron and push subscription infrastructure to send study reminders at the learner's optimal study time, determined by their `CircadianPerformanceChart` data. Reminders include specific content: "You have 12 overdue reviews in Cardiology" or "Your Pulmonology retention is dropping --- 10 minutes of review would help."

**Why it is valuable:** Consistent study habits are the strongest predictor of PANCE success. The push infrastructure and circadian data already exist. Personalized, data-driven reminders are far more effective than generic "time to study" notifications.

**Builds on:** `/api/push/subscribe` ([contract](../api/API_OVERVIEW.md#post-apipushsubscribe); push subscription endpoint), `push-reminders.ts` cron, aggregate session-timing signals, `UserProgress.nextReviewAt` (due dates), `daily-prescription.ts` (personalized study plans), PWA service worker (already registered via `vite-plugin-pwa`). Reminder copy must avoid behavioral surveillance and should translate timing data into calmer plan adaptation.

**SDK needed:** Web Push API (standard, already implied by push infrastructure). May want `web-push` npm package for VAPID key management.

**Complexity:** Low-Medium
**Impact:** Medium-High
**Prerequisites:** Push subscription UI needs to be wired. VAPID keys need configuration.

---

### Feature 14: Anki/Quizlet Import with FSRS Migration

**What it does:** Allows students to import their existing Anki decks or Quizlet sets into PANaCEa. Maps imported cards to existing conditions using semantic search. Preserves review history where possible and initializes FSRS cards at appropriate stability levels based on the import data.

**Why it is valuable:** Reduces switching cost. Many PA students have existing Anki decks (Rosh Review cards, self-made decks). Importing them into PANaCEa's superior scheduling system with implicit metrics is a powerful acquisition and retention hook.

**Builds on:** Hybrid search pipeline (for mapping cards to conditions), `fsrs.ts` (card initialization), FSRS parameter system, `ContentChunk` (for semantic matching), existing question data model.

**SDK needed:** Anki `.apkg` is SQLite + media files (use `better-sqlite3`). Quizlet has no public API but exports to CSV/text.

**Candidate services:** `better-sqlite3` (npm) for Anki, `papaparse` (already installed) for CSV

**Complexity:** Medium-High
**Impact:** High
**Prerequisites:** Mapping quality depends on embedding coverage. Need UI for review/confirm of card-to-condition mappings.

---

### Feature 15: Collaborative Confusion Atlas

**What it does:** Aggregates anonymized confusion pair data across all users to build a population-level "confusion atlas" showing which condition pairs are most commonly confused by PA students. Surfaces this as a shared knowledge graph visualization. Lets students see "82% of students also confused these two conditions" and access community-validated comparison resources.

**Why it is valuable:** Social proof reduces isolation. Knowing that a confusion is common (not a personal failure) builds trust and motivation. The aggregated data also reveals which contrastive content to prioritize creating.

**Builds on:** `ConfusionPair` model (already stores user-level pairs with counts), `confusionService.ts` (graph building with RRF normalization), `react-force-graph-2d` (already in dependencies), `cytoscape` (already in dependencies), `/api/analytics/confusion-pairs` (endpoint exists), `/api/analytics/peer-stats` (peer comparison exists).

**SDK needed:** No.

**Complexity:** Medium (aggregation queries + privacy-safe anonymization + graph visualization)
**Impact:** Medium-High
**Prerequisites:** Minimum user base for meaningful aggregation. Privacy policy for anonymized data sharing.

---

### Feature 16: Google Calendar Study Block Integration

**What it does:** Connects to the student's Google Calendar to automatically schedule study blocks based on their available free time, optimal circadian window, and pending review load. Creates calendar events with direct deep-links back into PANaCEa sessions.

**Why it is valuable:** PA students on rotations have unpredictable schedules. Automatic scheduling that respects their calendar eliminates the "when should I study?" friction. The Google Calendar MCP is already available in the environment (`gcal_create_event`, `gcal_find_my_free_time`, `gcal_list_events`).

**Builds on:** Circadian performance data, `daily-prescription.ts` (personalized study plans), `UserProgress.nextReviewAt` (review schedule), exam countdown data, Google Calendar MCP (already connected).

**SDK/Integration needed:** Google Calendar API via existing MCP connector.

**Complexity:** Medium
**Impact:** High
**Prerequisites:** OAuth consent for calendar access. User trust in automated calendar modification.

---

### Feature 17: ICD-10 Code-Linked Clinical Reasoning

**What it does:** Leverages the existing `icd10Code` field on the Condition model and the ICD-10 MCP tools (`search_codes`, `lookup_code`, `validate_code`, `get_hierarchy`) to add coding context to clinical questions. After answering a diagnostic question, shows the ICD-10 code hierarchy, related codes, and common coding errors. The `ICDCodingDrill.tsx` component already exists.

**Why it is valuable:** PANCE includes questions about documentation and coding. More importantly, ICD-10 hierarchies reveal clinical relationships (e.g., I25.1 under I20-I25 reveals how stable angina relates to other ischemic heart diseases). This builds diagnostic taxonomy skills.

**Builds on:** `Condition.icd10Code` field, `ICDCodingDrill.tsx` (already exists), ICD-10 MCP tools (already connected: `search_codes`, `lookup_code`, `get_hierarchy`, `get_by_body_system`), `ExplanationPanel.tsx` (for inline code display).

**SDK/Integration needed:** Already available via ICD-10 MCP.

**Complexity:** Low-Medium
**Impact:** Medium
**Prerequisites:** icd10Code field needs to be populated for more conditions.

---

### Feature 18: Real-Time Clinical Trial Awareness

**What it does:** For high-yield conditions, queries the ClinicalTrials.gov MCP (`search_trials`, `get_trial_details`, `analyze_endpoints`) to show active clinical trials relevant to the condition being studied. Presents a "What's Changing" card in the ExplanationPanel showing emerging treatments or diagnostic approaches.

**Why it is valuable:** Medicine evolves. Showing students that "there's an active Phase 3 trial for a new biologic for Crohn's disease" builds clinical awareness beyond static textbook knowledge. Differentiates PANaCEa from static question banks.

**Builds on:** `ExplanationPanel.tsx`, `MedicalContent` (condition context for queries), ClinicalTrials.gov MCP (already connected: `search_trials`, `get_trial_details`), and the adaptive dashboard registry for any student-facing dashboard surface.

**SDK/Integration needed:** Already available via ClinicalTrials.gov MCP.

**Complexity:** Low-Medium
**Impact:** Medium
**Prerequisites:** Rate limiting on MCP calls. Cache trial data per condition (TTL: 7 days). Filter for relevance.

---

### Feature 19: Session Recording + Replay for Self-Review

**What it does:** Captures a compressed record of each study session (question sequence, answers, timing, confidence signals, final outcomes) and allows the student to replay their session in a read-only review mode. Highlights moments where behavioral signals diverged from the outcome (e.g., "you were confident but wrong here" or "you hesitated but got it right").

**Why it is valuable:** Post-session review with behavioral annotation is a powerful metacognitive tool. The data is already captured in `QuestionAttempt` and `ReviewLog` with full telemetry JSON. This is purely a presentation feature.

**Builds on:** `QuestionAttempt.telemetryJson` (full behavioral data per question), `ReviewLog.telemetry` (server-computed metrics), `SessionPostMortem.tsx` (existing post-session review), `implicit_confidence` (stored per attempt), `grade_continuous` (stored per attempt).

**SDK needed:** No.

**Complexity:** Medium (session reconstruction from stored telemetry + annotation UI)
**Impact:** Medium
**Prerequisites:** None. All data already stored.

---

### Feature 20: Sentry-Informed Content Health Monitoring

**What it does:** Extends the existing Sentry tunnel (`/api/sentry-tunnel`) and content health monitoring (`compute-content-health.ts` cron) to detect questions that consistently produce unexpected behavioral patterns: questions where >80% of students hesitate excessively, questions with abnormally high switch rates, or questions where the "correct" answer has lower implicit confidence than a distractor. Flags these for review.

**Why it is valuable:** Poor questions waste student time and erode trust. The behavioral data to detect them already exists. Automated detection using the existing cron infrastructure reduces the human review bottleneck.

**Builds on:** `compute-content-health.ts` cron, `contentHealthService.ts`, `Question.contentHealthScore`, `Question.flagRate` / `Question.flagCount`, `QuestionAttempt` aggregations, `/api/admin/question-review` (admin review endpoint), Sentry MCP (already connected for error tracking).

**SDK needed:** No.

**Complexity:** Low-Medium
**Impact:** Medium-High
**Prerequisites:** Minimum question exposure (50+ attempts) for statistical significance.

---

## C. Best SDK / Integration Opportunities (Ranked)

### Tier 1: MVP Priority

**1. PubMed E-utilities (NCBI)**
Unlocks: Evidence Cards (#8), guideline-grounded explanations, EBM training.
Fits PANaCEa because: PA education requires evidence appraisal competency. The MCP article search tools are already connected. Explanation infrastructure exists.
Risk: Low (free API, well-documented, MCP already available).
Privacy: No student data sent; only condition/treatment queries.
Timeline: MVP.

**2. FSRS Optimizer (`open-spaced-repetition/fsrs-optimizer`)**
Unlocks: Personalized FSRS parameters (#5), reduced review load, better retention.
Fits PANaCEa because: FSRS v6 and the binding library are already installed. ReviewLog has complete history. Just needs the optimization step.
Risk: Low (open-source, well-tested, used by Anki).
Privacy: Uses only local review history; no data leaves the system.
Timeline: MVP.

**3. Google Calendar API (via MCP)**
Unlocks: Smart study scheduling (#16), calendar-aware session planning.
Fits PANaCEa because: PA students on rotations have erratic schedules. Circadian data and daily prescription infrastructure already exist. MCP connector already available.
Risk: Low-Medium (OAuth complexity, but MCP handles transport).
Privacy: Reads/writes calendar events; requires explicit user consent.
Timeline: MVP.

### Tier 2: Post-MVP

**4. ICD-10 Code System (via MCP)**
Unlocks: Code-linked reasoning (#17), diagnostic taxonomy training.
Fits PANaCEa because: `icd10Code` field exists on Condition model. `ICDCodingDrill.tsx` exists. MCP tools already connected.
Risk: Low.
Privacy: No student data exposure.
Timeline: Post-MVP.

**5. ClinicalTrials.gov (via MCP)**
Unlocks: Emerging treatment awareness (#18), "What's Changing" cards.
Fits PANaCEa because: Static medical content becomes dated. Trial data adds freshness. MCP already connected.
Risk: Low.
Privacy: No student data exposure.
Timeline: Post-MVP.

**6. Anki Import (`better-sqlite3`)**
Unlocks: Deck import (#14), reduced switching cost, student acquisition.
Fits PANaCEa because: Many PA students already have Anki decks. Semantic matching infrastructure exists for card-to-condition mapping.
Risk: Medium (mapping quality varies with deck quality).
Privacy: User uploads their own data; stays local.
Timeline: Post-MVP.

**7. Web Push (`web-push` npm)**
Unlocks: Smart study reminders (#13), circadian-timed notifications.
Fits PANaCEa because: Push subscription endpoint and cron infrastructure exist. PWA service worker registered. Just needs VAPID key setup and notification content generation.
Risk: Low.
Privacy: Push tokens stored server-side; content is user-specific.
Timeline: Post-MVP.

### Tier 3: Experimental

**8. Speech-to-Text / Text-to-Speech (Web Speech API or Google Cloud Speech)**
Unlocks: Audio study mode for commuters (maps to existing `commuter_mode`), OSCE verbal practice, pronunciation training for medical terminology.
Fits PANaCEa because: `commuter_mode` is defined but limited. OSCE chat could become verbal.
Risk: Medium-High (accuracy on medical terminology, browser support variance).
Privacy: Audio processing; needs clear consent. Prefer on-device Web Speech API over cloud.
Timeline: Experimental.

**9. Posthog / Mixpanel Analytics SDK**
Unlocks: Product analytics (funnel analysis, feature adoption, retention cohorts), A/B testing for implicit metric weights, conversion tracking.
Fits PANaCEa because: No product analytics layer exists despite rich behavioral data. DailyUserAnalytics tracks learning metrics but not product metrics (which features are used, where do users drop off).
Risk: Low.
Privacy: Requires privacy policy update. Use anonymized events.
Timeline: Experimental but high-value for product decisions.

**10. OpenAI Whisper (via API or local)**
Unlocks: Lecture audio transcription for the content ingestion pipeline (#10), recorded lecture import.
Fits PANaCEa because: PA students often record lectures. Transcription + concept extraction + question generation creates a closed loop.
Risk: Medium (transcription accuracy, audio quality variance).
Privacy: Audio data processing; student consent required.
Timeline: Experimental.

---

## D. Best "Use What We Already Built" Features

These require no new SDKs and minimal new infrastructure. They primarily involve wiring existing modules, adding aggregation queries, or building UI over collected data.

### 1. ~~Wire the Four Unused Confidence Pipeline Modules~~ --- VERIFIED COMPLETE
All four modules are already fully wired in `drillReviewService.ts` at lines 937, 1036, 1050, and 1087 respectively, with research citations (Kornell & Bjork 2008, Bjork & Bjork 2011, Kornell et al. 2009, Metcalfe & Kornell 2005), error handling, and debug logging. No action needed.

### 2. Confusion-Aware Reservoir Pre-Warming
Extend `refillWorker.ts` to accept `confusion:{conditionId}` scope. When confusion pairs are recorded, automatically queue targeted contrastive content in the reservoir. Uses existing reservoir infrastructure and confusion pair data. **Effort: 2-3 days.**

### 3. Behavioral Pattern Dashboard Widgets
Build 3-4 new dashboard widgets from existing telemetry: "Answer Switch Tendency" (per system), "First-Instinct Accuracy" (per system), "Cognitive Load Trend" (RT trajectory across sessions), "Calibration Delta" (predicted vs actual confidence). All data already in QuestionAttempt.telemetryJson and ReviewLog. **Effort: 3-4 days.**

### 4. Session Fatigue Detection + Proactive Breaks
Wire `trendDetector.detectConfidenceTrend()` into `useSessionWellness.ts`. When confidence trend is declining and RT is increasing, trigger the existing `WellnessCheckModal` with a data-backed message ("Your performance has dropped 15% in the last 10 questions"). **Effort: 1-2 days.**

### 5. Auto-Detect Learner Phase from Rotation Schedule
Read user's `currentRotation` and `eorDate` from profile. Map to learner phase in `nccpa-question-weighting.ts` (Didactic/Clinical/PANCE Prep). Adjust blueprint weights automatically. Wire into reservoir refill priority. **Effort: 2-3 days.**

### 6. Drill Mode Recommendations Based on Weakness Profile
Use `UserStatistics.rushedSystems`, `overthinkingSystems`, confusion pair density, and FSRS card state distribution to recommend specific drill modes. E.g., high confusion in derm? Suggest `ContrastiveDrill` for derm conditions. Low recall in pharm? Suggest `RapidRecallDrill` for pharmacology. Surface this as an adaptive widget or study-path recommendation only when it wins eligibility and scoring. **Effort: 3-4 days.**

### 7. Post-Session Behavioral Replay
Build a read-only session replay from stored `QuestionAttempt.telemetryJson`. Show the question sequence with behavioral annotations (confidence signal, switch count, RT classification). Use `SessionPostMortem.tsx` as the base component. **Effort: 4-5 days.**

### 8. OSCE-to-FSRS Feedback Loop
When a student completes an OSCE encounter, extract the conditions discussed and update the relevant FSRS cards. Correct management in OSCE counts as a "Good" review; incorrect as "Again." Uses existing OSCE state machine output + existing FSRS update path. **Effort: 2-3 days.**

### 9. Confusion Graph Visualization
Build a force-directed graph visualization of the user's confusion pairs using `react-force-graph-2d` (already in dependencies). Nodes = conditions, edges = confusion frequency. Clicking an edge opens the contrastive drill for that pair. **Effort: 2-3 days.**

### 10. Smart Question Variant Generation
The `generate-variants.ts` cron exists but is underutilized. Enhance it to specifically generate variants for questions where students show high confidence but get wrong (fluency illusion) or where confusion pairs are most dense. Uses existing generation pipeline + telemetry data to prioritize. **Effort: 3-4 days.**

---

## E. Recommended Roadmap

### NOW (Next 2 Weeks) --- Foundation Activation

These require no new dependencies and unlock value from already-built systems.

1. ~~**Wire the four unused confidence pipeline modules**~~ --- **VERIFIED COMPLETE** (2026-04-03). All four modules (`detectInterference` at line 937, `computeDesirableDifficultyBonus` at line 1036, `detectConfidenceTrend` at line 1050, `modulateDifficultyDelta` at line 1087) are fully wired into `drillReviewService.ts` with research citations, proper error handling, and debug logging.
2. ~~**Session fatigue detection + proactive breaks**~~ --- **IMPLEMENTED** (2026-04-06). Added `detectProactiveFatigue()` to wellnessEngine with rolling-window RT slope + accuracy analysis. Three-level system: `fresh → warming → break_suggested`. New components: `BreakTimer` (full-screen countdown overlay with progress ring), `FatigueBreakPrompt` (inline between feedback and Next button). Wired into QuizView — proactive breaks surface before hard-stop thresholds trigger.
3. ~~**Auto-detect learner phase from rotation schedule**~~ --- **IMPLEMENTED** (2026-04-03). `inferLearnerPhase()` in `nccpa-question-weighting.ts`. Wired into session generation, reservoir refill, and question selection.
4. ~~**Confusion-aware reservoir pre-warming**~~ --- **IMPLEMENTED** (2026-04-06). Wired existing `confusionPairBoost.ts` (was dead code) into `refillWorker.ts` Phase 2.5. Reservoir items targeting active confusion pairs receive tiered priority boosts (+1/+2/+4). Enabled by default via `confusionScope: true` in orchestrator payload.

**Additionally completed:**
- ~~**Internal SDK client layer**~~ --- **IMPLEMENTED** (2026-04-06). `lib/sdk/` with typed core client, 5 domain modules (drills, sessions, srs, user, content), barrel export. 5 hooks migrated from raw fetch. Retry with exponential backoff for transient errors.

**Total: NOW roadmap complete. All 4 foundation items + SDK layer shipped.**

### NEXT (Weeks 3-6) --- Learner-Facing Intelligence

These build learner-facing features on the newly activated foundations.

5. **Metacognitive Mirror Dashboard** (behavioral pattern widgets) --- 3-4 days
6. **Drill mode recommendations from weakness profile** --- 3-4 days
7. **Confusion graph visualization** --- 2-3 days
8. **Predictive exam score with confidence intervals** --- 4-5 days
9. **FSRS parameter optimization (background job)** --- 3-4 days
10. **Retrieval-augmented explanation enhancement** --- 3-4 days

**Total: ~20-24 days. Result: Students see rich metacognitive insights, get personalized drill recommendations, can visualize their confusion patterns, have a data-driven exam readiness prediction, and get deeper explanations with semantic search.**

### LATER (Weeks 7-12) --- Platform Expansion

These require new integrations, more content, or higher implementation complexity.

11. **Push notification study reminders** (Web Push setup) --- 3-4 days
12. **Google Calendar study block integration** --- 4-5 days
13. **Socratic remediation loops** (prompt engineering + flow integration) --- 5-7 days
14. **PubMed evidence cards** --- 4-5 days
15. **Clinical image interpretation with Vision AI** --- 7-10 days
16. **Anki/Quizlet import** --- 5-7 days
17. **Lecture/PDF content ingestion pipeline** --- 8-12 days
18. **Collaborative confusion atlas** (requires user base) --- 4-5 days

**Total: ~40-55 days. Result: PANaCEa becomes a full learning ecosystem with calendar integration, evidence-based explanations, content import, and collaborative insights.**

---

## Appendix: Features That Would Be Exciting But Are Unsafe Until Foundations Are Ready

**Per-user FSRS optimization** is blocked until users have 100+ reviews. Ship the cron job now, but gate execution on review count.

**Collaborative confusion atlas** requires a meaningful user base for statistical validity. Build the aggregation pipeline now, but don't expose the UI until N > 50 active users.

**Lecture ingestion** depends on embedding coverage being comprehensive. If concept-to-condition mapping fails for 30% of uploaded content, the feature feels broken. Expand MedicalContent embeddings to 800+ conditions first.

**Predictive exam score** must clearly communicate uncertainty. An overconfident wrong prediction erodes trust permanently. Always show confidence intervals and caveats.

**Behavioral replay** must be carefully framed. Showing students "you were nervous here" risks anxiety. Frame as "your study patterns" rather than "your weaknesses."
