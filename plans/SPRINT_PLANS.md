# PANaCEa — 21-Feature Sprint Implementation Plans

> Generated 2026-04-02. All file paths, function signatures, and patterns verified against the live codebase.

---

# SPRINT 1 — Foundation (Week 1)

---

## Feature 1: Google Search Grounding on Gemini Calls

### 1. Goal & PANCE Impact

Adding Google Search grounding to Gemini question generation and explanation calls ensures that generated content reflects current clinical guidelines rather than stale training data. This directly prevents hallucinated drug dosages, outdated screening recommendations, and superseded guideline references (e.g., JNC 8 → ACC/AHA 2017 hypertension guidelines). For a PANCE-prep platform, factual accuracy is non-negotiable — UWorld's credibility comes from cited, current content. Search grounding closes this gap with a single API parameter change.

### 2. Prerequisites & Risks

**Dependencies:** None. This is foundational — other features (PubMed grounding, Clinical Trials) build on the pattern established here.

**Risks:**
1. **Latency increase** — Search grounding adds ~500-1500ms per Gemini call. *Mitigation:* Only enable on generation calls (not real-time tutor unless already triggered by keyword heuristics). Question generation is already async/batch, so latency is acceptable.
2. **Grounding metadata format changes** — Google may change the `groundingMetadata` response shape. *Mitigation:* Add a defensive parser that extracts citations when available, falls back gracefully when missing.
3. **Cost increase** — Search-grounded calls cost more. *Mitigation:* Only enable on question generation and explanation enrichment, not on every tutor turn. The tutor endpoint already gates search behind keyword heuristics.

### 3. Schema Changes

No schema changes required. Grounding sources will be stored in the existing `PreGeneratedQuestion.questionData` JSON field as a new `groundingSources` array inside the rationale object.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `lib/services/question/generationService.ts` | Modify | Add `tools: [{ googleSearch: {} }]` to Gemini request, parse `groundingMetadata` from response |
| `functions/api/_shared/question-generator.ts` | Modify | Add search grounding to the few-shot question generation endpoint |
| `functions/api/intelligence/tutor.ts` | Modify | Already has search grounding — extend to always-on for guideline-heavy topics, add structured citation extraction |
| `lib/types/question.ts` (or equivalent type file) | Modify | Add `groundingSources?: { uri: string; title: string }[]` to the rationale type |
| `components/questions/ExplanationPanel.tsx` | Modify | Render grounding sources as clickable citation chips in an "Evidence" section |
| `lib/services/question/generationService.test.ts` | Create | Unit tests for grounding metadata parsing |

### 5. Implementation Steps

**Step 1: Add search grounding to question generation service (1 hour)**
- Open `lib/services/question/generationService.ts`
- In the `generateReviewQuestion` method, add `tools: [{ googleSearch: {} }]` to the Gemini API request body
- After receiving the response, extract `response.candidates[0].groundingMetadata.groundingChunks` (each has `.web.uri` and `.web.title`)
- Append extracted sources to the rationale object as `groundingSources: { uri, title }[]`
- Follow the existing pattern in `functions/api/intelligence/tutor.ts` lines 342-370 for grounding extraction
- **Acceptance:** Generate a question for "hypertension management" and verify the rationale JSON includes `groundingSources` with real URLs

**Step 2: Add search grounding to the Edge question generator (1 hour)**
- Open `functions/api/_shared/question-generator.ts`
- Add the same `tools: [{ googleSearch: {} }]` parameter to the Gemini request
- Parse grounding metadata identically to Step 1
- **Acceptance:** POST to `/api/questions/generate-enhanced` and verify the response includes grounding sources

**Step 3: Add citation type to question types (30 min)**
- Find the TypeScript interface for question rationale (in `questionData` shape)
- Add `groundingSources?: Array<{ uri: string; title: string }>` to the rationale type
- **Acceptance:** `npm run typecheck` passes

**Step 4: Display citations in ExplanationPanel (1 hour)**
- Open `components/questions/ExplanationPanel.tsx`
- After the existing rationale sections (bottomLine, whyCorrect, clinicalPearl), add a conditional "Evidence" section
- Render each grounding source as a small pill/chip with an external link icon: `[Source Title ↗](uri)`
- Style with existing Tailwind classes: `text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]`
- Only render if `rationale.groundingSources?.length > 0`
- **Acceptance:** View an explanation for a grounded question and see clickable source links

**Step 5: Enhance tutor citation display (30 min)**
- The tutor already returns `groundingSources` when search is triggered — verify the client-side tutor UI renders them
- If not rendered, add the same citation chip pattern from Step 4 to the tutor response display
- **Acceptance:** Ask the tutor "What is the latest ACC/AHA hypertension guideline?" and see source citations

### 6. Testing Strategy

- **Unit tests:** `lib/services/question/generationService.test.ts` — mock Gemini response with and without `groundingMetadata`, verify extraction logic handles missing/malformed metadata gracefully
- **Integration:** No new API endpoints — test existing endpoints with search grounding enabled
- **Manual verification:** Generate 5 questions across different systems, verify each has at least 1 grounding source. Check that sources are real URLs (not hallucinated).

### 7. Estimated Effort

Total: **1–1.5 days**
- Backend (generation service + edge generator): 0.5 day
- Frontend (ExplanationPanel + tutor): 0.5 day
- Testing + polish: 0.25 day

### 8. Self-Check Queries

1. "Does question generation still work when Google Search returns zero results (e.g., very niche topic)?"
2. "Are grounding sources persisted in `questionData` so they display on subsequent reviews, not just first generation?"
3. "Does the tutor's existing keyword-heuristic search still work, and does it now also pass citations to the UI?"
4. "Is there any increase in 429 rate-limit errors from Gemini after enabling search grounding?"
5. "Do the citation URLs actually resolve to real pages, or are any broken?"

---

## Feature 2: Streak Freezes + Weekend Mode

### 1. Goal & PANCE Impact

Students on clinical rotations (your current phase) frequently have 12-hour shifts or overnight call that make daily study impossible. A broken streak is psychologically demoralizing and is the #1 predictor of app abandonment in gamified learning tools (Hamari et al., 2014). Streak freezes allow a configurable number of "grace days" where missing a day doesn't reset the streak. Weekend mode excludes Saturday/Sunday from streak calculations entirely. Together, these reduce anxiety and increase long-term retention by keeping students engaged through their toughest rotation weeks.

### 2. Prerequisites & Risks

**Dependencies:** None.

**Key discovery:** The codebase already has most of this built! `streakCalc.ts` supports `StreakGoalDays = 'all' | 'weekdays'`, `computeCurrentStreak` accepts `frozenDates`, the `StreakFreezeUse` model exists, `UserPreferences.streakFreezes` stores available freezes, and `functions/api/streaks/use-freeze.ts` handles the freeze API. The gap is: (a) no automatic freeze application when a day is missed, (b) the settings UI toggle for weekdays-only doesn't wire to `streakGoalDays`, and (c) no way to earn/purchase freezes.

**Risks:**
1. **Retroactive streak recalculation** — Changing `streakGoalDays` mid-streak could inflate/deflate the displayed streak. *Mitigation:* Always recalculate from raw `DailyStreak` + `StreakFreezeUse` data using `computeCurrentStreak`. No cached streak values.
2. **Timezone edge cases** — A student ending a shift at 11:55 PM might miss the streak window. *Mitigation:* Use the client's local date (already sent as timezone in other calls) for streak date calculations.

### 3. Schema Changes

Add `streakGoalDays` to `UserPreferences`:

```prisma
model UserPreferences {
  // ... existing fields ...
  streakFreezes       Int      @default(0)   // Already exists
  streakGoalDays      String   @default("all") // NEW: 'all' | 'weekdays'
}
```

Migration: `npx prisma migrate dev --name add-streak-goal-days`

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `streakGoalDays` field to `UserPreferences` |
| `functions/api/streaks/auto-freeze.ts` | Create | Endpoint called on app open to auto-apply freeze for missed days |
| `functions/api/user/preferences.ts` | Modify | Handle `streakGoalDays` in GET/PUT |
| `lib/streakCalc.ts` | Verify | Already supports `streakGoalDays` and `frozenDates` — verify edge cases |
| `lib/services/streakService.ts` | Modify | Update `getCurrentStreak` to use `computeCurrentStreak` from `streakCalc.ts` instead of legacy walk-back logic, pass `streakGoalDays` and `frozenDates` |
| `components/settings/StreakSettings.tsx` (or equivalent) | Modify | Wire weekday toggle to `streakGoalDays` preference, show freeze count |
| `components/quiz/StreakVisualization.tsx` | Modify | Display freeze indicators on frozen days, show available freezes |
| `hooks/useStreakAutoFreeze.ts` | Create | Client hook that calls auto-freeze on app mount |

### 5. Implementation Steps

**Step 1: Schema migration (15 min)**
- Add `streakGoalDays String @default("all")` to `UserPreferences` in `prisma/schema.prisma`
- Run `npx prisma migrate dev --name add-streak-goal-days`
- **Acceptance:** `npx prisma generate` succeeds, new field visible in Prisma Studio

**Step 2: Update streakService to use streakCalc (1 hour)**
- Open `lib/services/streakService.ts`
- Replace the legacy `getCurrentStreak` logic with a call to `computeCurrentStreak` from `lib/streakCalc.ts`
- Fetch the user's `streakGoalDays` from `UserPreferences`
- Fetch `StreakFreezeUse` records for the user to build `frozenDates` set
- Fetch `DailyStreak` records to build `activityDates` set
- Pass all to `computeCurrentStreak({ activityDates, frozenDates, today, streakGoalDays })`
- **Acceptance:** `getStreakStats()` returns correct streak count that matches `computeCurrentStreak` output

**Step 3: Create auto-freeze endpoint (1 hour)**
- Create `functions/api/streaks/auto-freeze.ts`
- On POST: check if yesterday (user's local date) was a goal day, had no activity, and no existing freeze
- If so, and `UserPreferences.streakFreezes > 0`, auto-apply: create `StreakFreezeUse` record, decrement `streakFreezes`
- Return `{ freezeApplied: boolean, remainingFreezes: number, currentStreak: number }`
- Follow `functions/api/streaks/use-freeze.ts` pattern for auth and Prisma usage
- **Acceptance:** Miss a day, call the endpoint, verify freeze is applied and streak is preserved

**Step 4: Wire settings UI (1 hour)**
- Find the streak/study settings component (likely in `components/settings/`)
- Add a toggle switch for "Weekdays only" that PUTs `streakGoalDays: 'weekdays'` to `/api/user/preferences`
- Display current freeze count with a snowflake icon
- Add a brief explanation: "Streak freezes automatically save your streak when you miss a study day"
- **Acceptance:** Toggle weekday mode, refresh, verify the preference persists and streak recalculates

**Step 5: Client-side auto-freeze hook (30 min)**
- Create `hooks/useStreakAutoFreeze.ts`
- On app mount (in the main layout or dashboard), call POST `/api/streaks/auto-freeze`
- Show a toast notification if a freeze was applied: "Streak freeze used! 🧊 X freezes remaining"
- **Acceptance:** Miss a day, open app, see freeze toast, streak unchanged

**Step 6: Update streak visualization (30 min)**
- In `components/quiz/StreakVisualization.tsx`, render frozen days with a distinct visual (snowflake icon, blue tint)
- Show available freezes count near the streak flame
- **Acceptance:** View streak calendar, frozen days show differently from active study days

### 6. Testing Strategy

- **Unit tests:** Test `computeCurrentStreak` with: weekday mode skipping weekends, freeze filling a gap, multiple consecutive missed days with insufficient freezes, timezone boundary (11:59 PM activity)
- **Integration:** Test auto-freeze endpoint: call with/without available freezes, call when yesterday was already frozen, call when yesterday was a weekend in weekday mode
- **Manual:** Toggle weekday mode on Friday evening, verify Saturday/Sunday don't show as missed. Miss a Monday, verify auto-freeze triggers on Tuesday login.

### 7. Estimated Effort

Total: **0.75–1 day** (much of the infrastructure already exists)
- Schema + backend: 0.25 day
- Frontend (settings + visualization): 0.25 day
- Auto-freeze logic + hook: 0.25 day
- Testing: 0.25 day

### 8. Self-Check Queries

1. "If a student switches from 'all' to 'weekdays' mid-streak, does the streak recalculate correctly without inflating?"
2. "What happens when a student has 0 freezes and misses a day — does the streak reset cleanly?"
3. "Does the auto-freeze endpoint handle the case where the student opens the app at 12:01 AM and yesterday was already frozen?"
4. "Are streak freezes earned automatically (e.g., 1 per 7-day streak) or only granted manually? If manual, is there a UI to add them?"
5. "Does the streak flame level (0-5 tiers in streakService) still calculate correctly with frozen days counted?"

---

## Feature 3: Blueprint Gap Heatmap

### 1. Goal & PANCE Impact

The PANCE blueprint specifies exact percentages per organ system (Cardiovascular 11%, Pulmonary 9%, etc.). Students who practice proportional to the blueprint score higher (NCCPA, 2024 exam analysis). A visual heatmap showing "Cardiovascular is 11% of PANCE but only 6% of your practice" directly tells students where to focus. This leverages data that already exists in the codebase — `NCCPA_2025_BLUEPRINT` weights and per-system attempt counts — and surfaces it as an actionable visualization.

### 2. Prerequisites & Risks

**Dependencies:** None. Uses existing data.

**Key discovery:** `BlueprintProgressBar.tsx` already exists and shows coverage per system. `lib/constants/blueprint.ts` has full NCCPA 2025 weights, `calculateTargetDistribution()`, and `getSystemsByWeight()`. The question selector already computes system deficits. The gap is a heatmap visualization that overlays actual practice % vs. target %, color-coded by gap severity.

**Risks:**
1. **Cold start** — Students with <50 questions have meaningless distributions. *Mitigation:* Show an "insufficient data" state until 50+ questions answered (same threshold as `MainSessionQuestionSelector.COLD_START_THRESHOLD`).
2. **Misleading with small Ns** — A student who answered 2/2 correct in Nephrology looks "mastered." *Mitigation:* Show both percentage gap AND absolute question count per system.

### 3. Schema Changes

No schema changes required. All data comes from existing `QuestionAttempt` aggregation and `NCCPA_2025_BLUEPRINT`.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `functions/api/analytics/blueprint-gaps.ts` | Create | Endpoint: compute per-system actual vs. target distribution for a user |
| `components/dashboard/BlueprintGapHeatmap.tsx` | Create | Sorted horizontal bar chart with gap highlighting |
| `hooks/useBlueprintGaps.ts` | Create | Client hook to fetch and cache blueprint gap data |
| `components/dashboard/DashboardPage.tsx` (or equivalent) | Modify | Add BlueprintGapHeatmap to the dashboard |

### 5. Implementation Steps

**Step 1: Create blueprint gaps API endpoint (1.5 hours)**
- Create `functions/api/analytics/blueprint-gaps.ts`
- Use `authenticatedEndpoint` wrapper
- Query `QuestionAttempt` grouped by system for the authenticated user: `GROUP BY system, COUNT(*), AVG(isCorrect)`
- Compare actual distribution against `NCCPA_2025_BLUEPRINT` weights
- Return `{ systems: [{ name, targetPercent, actualPercent, gapPercent, questionCount, accuracy }], totalQuestions }`
- Follow the deficit calculation pattern from `MainSessionQuestionSelector` (lines computing `SystemDeficit`)
- **Acceptance:** Call the endpoint, verify returned gaps match manual calculation from DB data

**Step 2: Build the heatmap component (1.5 hours)**
- Create `components/dashboard/BlueprintGapHeatmap.tsx`
- Design: Sorted horizontal bar chart (NOT radar — per the UX audit recommendation)
- Each row: system name | target bar (outline) overlaid with actual bar (filled)
- Color coding: Green (actual ≥ target), Yellow (within 3%), Orange (3-5% under), Red (>5% under)
- Bottom-3 systems highlighted with an orange accent border
- Show "N questions" count next to each bar
- Cold start state: If `totalQuestions < 50`, show a message: "Answer 50+ questions to see your blueprint gaps" with a progress indicator
- Use Framer Motion for bar animation on mount
- **Acceptance:** Component renders with mock data, bars are correctly proportioned, colors match gap severity

**Step 3: Create client hook (30 min)**
- Create `hooks/useBlueprintGaps.ts`
- Fetch from `/api/analytics/blueprint-gaps` with Clerk token
- Cache in React state (no need for SWR — dashboard data refreshes on mount)
- Return `{ gaps, totalQuestions, isLoading, error }`
- **Acceptance:** Hook fetches and returns data on dashboard mount

**Step 4: Integrate into dashboard (30 min)**
- Add `BlueprintGapHeatmap` to the dashboard page, alongside `BlueprintProgressBar`
- Position below the existing progress bar or in a new "PANCE Blueprint" section
- Consider replacing the existing `BlueprintProgressBar` if the heatmap is strictly superior — check with a quick A/B of both
- **Acceptance:** Dashboard shows the heatmap with real user data

### 6. Testing Strategy

- **Unit tests:** Test the gap calculation: all systems at target (no gaps), one system massively under-represented, cold start with 10 questions returns appropriate state
- **Integration:** Test the API endpoint returns correct shape, handles user with zero attempts
- **Manual:** Answer 50+ questions biased toward one system, verify the heatmap correctly shows the imbalance

### 7. Estimated Effort

Total: **1.5–2 days**
- Backend (API endpoint): 0.5 day
- Frontend (heatmap component): 0.75 day
- Integration + testing: 0.25 day

### 8. Self-Check Queries

1. "Does the heatmap update after completing a study session, or only on page refresh?"
2. "Are the system names normalized correctly? (e.g., 'CV' in attempts maps to 'Cardiovascular' in blueprint via `SYSTEM_ALIASES`)"
3. "What does the heatmap show for a brand-new user with 0 questions?"
4. "Does the 'bottom 3' highlighting change dynamically as the student addresses gaps?"
5. "Is the data consistent with what `BlueprintProgressBar` shows, or are they computing from different sources?"

---

# SPRINT 2 — Content Quality (Week 2)

---

## Feature 4: PubMed-Grounded Explanations & Question Generation

### 1. Goal & PANCE Impact

Adding PubMed citations transforms explanations from "the AI thinks X" to "per Smith et al., NEJM 2024, X." This matches UWorld's citation-backed approach and teaches evidence-based medicine — a core PA competency. When generating questions, PubMed abstracts provide grounding context that reduces hallucination and ensures clinical accuracy. The PubMed MCP is already connected (`search_articles`, `get_article_metadata`, `get_full_text_article`), making this primarily a wiring task.

### 2. Prerequisites & Risks

**Dependencies:** Feature 1 (Search Grounding) should be done first — it establishes the citation display pattern in `ExplanationPanel`. PubMed citations will use the same UI component.

**Risks:**
1. **PubMed API latency** — MCP calls add network round-trips. *Mitigation:* Cache PubMed results per condition. Once a condition's citations are fetched, store them in the question's `questionData.groundingSources`. Subsequent reviews don't re-query.
2. **Irrelevant citations** — PubMed search may return tangential papers. *Mitigation:* Search with specific terms: `"[condition] AND (diagnosis OR treatment OR management) AND (review OR meta-analysis)"`. Limit to top 3 results sorted by relevance.
3. **Citation freshness** — Old papers may cite outdated guidelines. *Mitigation:* Add date filter to PubMed queries: last 5 years for treatment topics, last 10 years for foundational science.

### 3. Schema Changes

No schema changes required. Citations stored in existing `questionData` JSON field.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `lib/services/question/pubmedEnricher.ts` | Create | Service to query PubMed MCP and format citations |
| `lib/services/question/generationService.ts` | Modify | Call pubmedEnricher before/during question generation to inject abstract context |
| `functions/api/_shared/question-generator.ts` | Modify | Add PubMed context to the generation prompt |
| `components/questions/ExplanationPanel.tsx` | Modify | Extend the "Evidence" section (from Feature 1) to show PubMed citations with PMIDs |
| `lib/types/question.ts` | Modify | Add `pubmedCitations?: { pmid: string; title: string; authors: string; journal: string; year: number; url: string }[]` to rationale type |

### 5. Implementation Steps

**Step 1: Create PubMed enricher service (1.5 hours)**
- Create `lib/services/question/pubmedEnricher.ts`
- Function: `enrichWithPubMed(condition: string, topic?: string): Promise<PubMedCitation[]>`
- Use the PubMed MCP's `search_articles` tool with query: `"${condition} AND (diagnosis OR treatment) AND (review[pt] OR meta-analysis[pt])"`
- Filter: last 5 years, limit 3 results
- For each result, call `get_article_metadata` to get structured citation data
- Return formatted citations: `{ pmid, title, authors (first author + et al.), journal, year, url: "https://pubmed.ncbi.nlm.nih.gov/${pmid}" }`
- **Acceptance:** Call with "community-acquired pneumonia", get 3 relevant citations

**Step 2: Inject PubMed context into question generation (1 hour)**
- In `generationService.ts`, before the Gemini call, call `enrichWithPubMed(content.condition)`
- Append to the generation prompt: `"Ground your rationale in these evidence sources: [citation summaries]. Include at least one PMID reference in the clinicalPearl or rationale."`
- Store the citations in the returned rationale as `pubmedCitations`
- **Acceptance:** Generate a question, verify the rationale references a real PMID

**Step 3: Do the same for the Edge question generator (1 hour)**
- In `functions/api/_shared/question-generator.ts`, add PubMed enrichment
- Note: Edge functions can't directly use MCP — instead, call PubMed's REST API directly (`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` + `efetch.fcgi`)
- Alternatively, create a thin proxy endpoint that the Edge function calls
- **Acceptance:** Edge-generated questions include PubMed citations

**Step 4: Extend ExplanationPanel citations (1 hour)**
- In `components/questions/ExplanationPanel.tsx`, extend the "Evidence" section to distinguish Google Search sources from PubMed citations
- PubMed citations render as: `Author et al. (Year). "Title." Journal. PMID: [linked]`
- Group under a "📚 References" subsection below the Google Search "🔍 Sources"
- **Acceptance:** Explanation shows formatted PubMed citations with clickable PMID links

**Step 5: Add fallback for conditions without PubMed results (30 min)**
- Handle cases where PubMed returns 0 results (rare conditions, anatomy topics)
- Fall back to Google Search grounding only (Feature 1)
- Log conditions with no PubMed results for future content gap analysis
- **Acceptance:** Generate a question for a niche topic, verify no errors when PubMed returns empty

### 6. Testing Strategy

- **Unit tests:** Mock PubMed API responses, test citation formatting, test empty result handling, test query construction for different conditions
- **Integration:** End-to-end question generation with PubMed enrichment enabled
- **Manual:** Generate questions for 5 high-yield conditions (CHF, COPD, DM2, pneumonia, appendicitis), verify citations are relevant and PMIDs resolve

### 7. Estimated Effort

Total: **3–4 days**
- PubMed enricher service: 0.75 day
- Generation service integration: 0.75 day
- Edge function integration: 0.5 day
- Frontend citation display: 0.5 day
- Testing + edge cases: 0.5 day

### 8. Self-Check Queries

1. "Are PubMed citations persisted in `questionData` so they survive across review sessions?"
2. "What happens when the PubMed API is down? Does question generation still work?"
3. "Are the PMID links correct? (Test 3 randomly by clicking through to PubMed)"
4. "Does the search query produce clinically relevant results, not basic science papers?"
5. "Is there a noticeable latency increase on question generation? (Target: <2s added)"

---

## Feature 5: Interleaving Enforcement

### 1. Goal & PANCE Impact

Interleaved practice — mixing conditions from different organ systems within a single session — improves diagnostic accuracy by 9 percentage points over blocked practice (Rohrer & Taylor, 2007; Birnbaum et al., 2013). This is one of the strongest findings in learning science. The codebase already has interleaving in `MainSessionQuestionSelector` (Interleaved Assembler v2.0 with "no two adjacent questions share the same system" rule), but users need an explicit toggle to opt in/out and understand why it matters.

### 2. Prerequisites & Risks

**Dependencies:** None. Feature 3 (Blueprint Gap Heatmap) is complementary — the heatmap shows where to focus, interleaving implements the focus.

**Key discovery:** `MainSessionQuestionSelector` already enforces interleaving by default with its "Largest-First Greedy" algorithm. The session API (`/api/questions/session`) supports `mode: 'interleaved'`. The gap is: (a) no user-facing toggle in the session setup UI, (b) no explanation of why interleaving helps, (c) blocked mode (single system) may be the default for some session types.

**Risks:**
1. **User confusion** — Students may want to study one system intensely before a rotation-specific exam (EOR). *Mitigation:* Keep "Focus Mode" (single system) as an option, but make interleaved the default with a brief explanation tooltip.
2. **Blueprint compliance** — Interleaved sessions should still respect blueprint weights. *Mitigation:* Already handled — the selector uses `calculateTargetDistribution` weighted by NCCPA blueprint.

### 3. Schema Changes

```prisma
model UserPreferences {
  // ... existing fields ...
  defaultInterleaveMode  String  @default("interleaved") // 'interleaved' | 'focused'
}
```

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `defaultInterleaveMode` to UserPreferences |
| `components/session/SessionSetup.tsx` (or equivalent) | Modify | Add interleave toggle with explanation |
| `hooks/useSessionSetup.ts` (or equivalent) | Modify | Pass interleave mode to session API |
| `lib/services/mainSessionQuestionSelector.ts` | Verify | Confirm interleaving already works, add a bypass for "focused" mode |

### 5. Implementation Steps

**Step 1: Schema migration (15 min)**
- Add `defaultInterleaveMode String @default("interleaved")` to `UserPreferences`
- Run migration
- **Acceptance:** Field exists in Prisma Studio

**Step 2: Verify existing interleaving (30 min)**
- Read `MainSessionQuestionSelector.ts` — confirm that the interleaving assembler is active by default
- Verify the `mode: 'interleaved'` parameter in the session API
- Check if there's a "standard" mode that blocks by system
- **Acceptance:** Understand exactly which code paths produce interleaved vs. blocked sessions

**Step 3: Add toggle to session setup UI (1.5 hours)**
- Find the session setup/configuration component (where students start a new session)
- Add a toggle: "🔀 Interleaved Practice" (on by default) with tooltip: "Mix questions across systems. Research shows this improves PANCE scores by ~9% compared to studying one system at a time."
- When off, show a system selector dropdown for focused single-system practice
- Save preference to `UserPreferences.defaultInterleaveMode`
- Pass the mode to the session API call
- **Acceptance:** Toggle interleaving off, start a session, verify all questions are from one system. Toggle on, verify mixed systems.

**Step 4: Add learning science callout (30 min)**
- On first use of interleaved mode, show a one-time educational tooltip or banner: "💡 Interleaved practice is proven to improve exam performance. Your brain builds stronger discrimination skills when it alternates between different conditions."
- Dismiss and don't show again (store in localStorage)
- **Acceptance:** New users see the callout once, returning users don't

### 6. Testing Strategy

- **Unit tests:** Verify `MainSessionQuestionSelector` with interleaving on produces ≥3 distinct systems per 20-question block. Verify focused mode produces single-system sessions.
- **Manual:** Start 3 sessions — one interleaved (default), one focused on Cardiovascular, one focused on Pulmonary. Verify question distributions match expectations.

### 7. Estimated Effort

Total: **1–1.5 days** (most logic already exists)
- Schema + backend verification: 0.25 day
- Frontend toggle + UX: 0.5 day
- Testing + polish: 0.25 day

### 8. Self-Check Queries

1. "Does the interleave toggle state persist across sessions via UserPreferences?"
2. "In focused mode, does the session still pull overdue FSRS cards from other systems, or strictly one system?"
3. "Does the EOR mode (rotation-specific study) override the interleave toggle appropriately?"
4. "Is the interleaving violation count (`interleavingViolations`) logged somewhere for monitoring?"

---

## Feature 6: Confusion Pair Detection → Targeted Drills

### 1. Goal & PANCE Impact

The PANCE heavily tests discrimination between similar conditions (Crohn's vs. UC, Type 1 vs. Type 2 DM, epidural vs. subdural hematoma). The codebase already tracks confusion pairs in `drillReviewService.ts`. Surfacing these to students and auto-generating focused comparison drills directly targets the highest-yield learning opportunity: the conditions they actually confuse. This leverages the "desirable difficulty" principle (Bjork, 1994) — drilling specifically where confusion exists produces stronger memory encoding than reviewing already-mastered material.

### 2. Prerequisites & Risks

**Dependencies:** The contrastive drill pattern already exists (`ContrastiveDrill.tsx`, `use-contrastive-drill.ts`). This feature extends it with auto-generated confusion pair sets.

**Risks:**
1. **Insufficient data** — New students won't have enough attempts to identify confusion pairs. *Mitigation:* Require ≥3 attempts involving the pair before surfacing. Fall back to common population-level confusion pairs (Crohn's/UC, etc.) for new users.
2. **Pair detection accuracy** — A student who answers incorrectly once may not truly confuse those conditions. *Mitigation:* Only flag pairs where the wrong answer matches a specific distractor condition ≥2 times.

### 3. Schema Changes

```prisma
model ConfusionPair {
  id             String   @id @default(cuid())
  userId         String
  conditionA     String   // The target condition
  conditionB     String   // The confused condition (distractor chosen)
  occurrenceCount Int     @default(1)
  lastOccurrence DateTime @default(now())
  resolved       Boolean  @default(false) // Set true after successful targeted drill
  createdAt      DateTime @default(now())
  User           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, conditionA, conditionB])
  @@index([userId, resolved])
}
```

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `ConfusionPair` model |
| `lib/services/drillReviewService.ts` | Modify | After incorrect answers, upsert confusion pairs based on distractor analysis |
| `functions/api/analytics/confusion-pairs.ts` | Create | GET endpoint returning user's top confusion pairs |
| `functions/api/drills/confusion-targeted.ts` | Create | Generate a contrastive drill set for a specific confusion pair |
| `components/dashboard/ConfusionPairCard.tsx` | Create | Dashboard card showing top 3 confusion pairs with "Drill This" buttons |
| `hooks/useConfusionPairs.ts` | Create | Client hook to fetch confusion pairs |

### 5. Implementation Steps

**Step 1: Schema migration (15 min)**
- Add `ConfusionPair` model to schema
- Run migration
- **Acceptance:** Table exists, Prisma generates types

**Step 2: Record confusion pairs in drillReviewService (1.5 hours)**
- In `lib/services/drillReviewService.ts`, after an incorrect answer is resolved:
- Identify the condition of the correct answer and the condition of the selected (wrong) answer
- This requires mapping selected distractor → condition. Check if `questionData.options` includes condition metadata, or if the distractor text can be mapped to conditions
- Upsert `ConfusionPair`: increment `occurrenceCount`, update `lastOccurrence`
- **Acceptance:** Answer a question wrong, verify a `ConfusionPair` record is created

**Step 3: Create confusion pairs API endpoint (1 hour)**
- Create `functions/api/analytics/confusion-pairs.ts`
- GET: Return top 10 unresolved confusion pairs ordered by `occurrenceCount DESC`
- Include condition names and occurrence counts
- **Acceptance:** Endpoint returns pairs for a user with incorrect attempts

**Step 4: Create targeted drill generator (1 hour)**
- Create `functions/api/drills/confusion-targeted.ts`
- Given `conditionA` and `conditionB`, generate a contrastive drill set:
  - Fetch questions where either condition is the subject
  - Use Gemini to generate comparison questions if insufficient pre-generated ones exist
  - Return a contrastive set compatible with `ContrastiveDrill.tsx`
- **Acceptance:** Request a drill for "Crohn's" vs "UC", get a contrastive question set

**Step 5: Build confusion pair dashboard card (1 hour)**
- Create `components/dashboard/ConfusionPairCard.tsx`
- Show top 3 pairs: "You confuse [A] with [B] (seen X times)"
- Each pair has a "Drill This →" button that launches a targeted contrastive drill
- Empty state: "No confusion patterns detected yet. Keep studying!"
- **Acceptance:** Dashboard shows pairs with functional drill launch buttons

**Step 6: Mark pairs as resolved after successful drill (30 min)**
- After a student completes a targeted confusion drill with ≥80% accuracy, mark the pair `resolved: true`
- **Acceptance:** Complete a confusion drill successfully, pair disappears from the dashboard card

### 6. Testing Strategy

- **Unit tests:** Test confusion pair detection logic: correct answer shouldn't create a pair, wrong answer with identifiable condition distractor should, duplicate wrong answers increment count
- **Integration:** End-to-end: answer wrong → pair created → API returns pair → targeted drill works → drill completion resolves pair
- **Manual:** Deliberately confuse two conditions 3+ times, verify the dashboard surfaces the pair

### 7. Estimated Effort

Total: **2.5–3 days**
- Schema + detection logic: 0.75 day
- API endpoints: 0.5 day
- Targeted drill generation: 0.5 day
- Dashboard card + resolution: 0.5 day
- Testing: 0.5 day

### 8. Self-Check Queries

1. "Can the system identify which specific condition each distractor represents, or are distractors just text strings?"
2. "Does the confusion pair count persist across different question variants about the same conditions?"
3. "What happens when a pair is resolved but the student confuses them again later — does it reopen?"
4. "Are confusion pairs surfaced in the `StudyActionCard` priority system alongside overdue cards?"
5. "Does the targeted drill submit to FSRS via `useDrillFSRS`?"

---

# SPRINT 3 — New Drill Types (Week 3)

---

## Feature 7: ICD-10 Coding Drill

### 1. Goal & PANCE Impact

The PANCE includes medical coding knowledge questions — students must match clinical scenarios to appropriate ICD-10 codes. Currently PANaCEa has zero coding features. The ICD-10 MCP is connected with `lookup_code`, `search_codes`, `get_by_body_system`, and `validate_code` tools, providing the full code hierarchy for generating plausible distractors. This drill directly targets a PANCE content area with no current coverage.

### 2. Prerequisites & Risks

**Dependencies:** None. Follows existing drill pattern exactly.

**Risks:**
1. **ICD-10 complexity** — The code hierarchy is enormous. *Mitigation:* Focus on high-yield codes per PANCE blueprint (common diagnoses, not rare billing codes). Curate a starter set of ~200 high-yield codes.
2. **MCP availability** — If the ICD-10 MCP is slow or unavailable, drills break. *Mitigation:* Pre-fetch and cache code data. Use the MCP at question-generation time, not at quiz time.

### 3. Schema Changes

No schema changes required. ICD-10 drill questions stored as `PreGeneratedQuestion` with `drillType: 'icd10'`.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `hooks/game/use-icd-drill.ts` | Create | Drill hook managing ICD-10 question state, answer submission, FSRS integration |
| `components/drill/ICDCodingDrill.tsx` | Create | UI component: vignette + code option selection inside DrillShell |
| `functions/api/drills/icd10/generate.ts` | Create | Generate ICD-10 drill questions using MCP + Gemini |
| `functions/api/drills/icd10/submit.ts` | Create | Submit answers (or use existing `/api/drills/submit-review`) |
| `lib/constants/high-yield-icd10.ts` | Create | Curated list of high-yield ICD-10 codes for PANCE |

### 5. Implementation Steps

**Step 1: Curate high-yield ICD-10 codes (1 hour)**
- Create `lib/constants/high-yield-icd10.ts`
- Use the ICD-10 MCP's `get_by_body_system` to pull codes for each PANCE blueprint system
- Curate ~200 codes covering the most commonly tested conditions
- Structure: `{ code: string, description: string, system: string, category: string }`
- **Acceptance:** File contains 200+ codes covering all 16 PANCE systems

**Step 2: Create question generation endpoint (1.5 hours)**
- Create `functions/api/drills/icd10/generate.ts`
- Given a system (optional), select a random high-yield code
- Use Gemini to generate a clinical vignette for that condition
- Use the ICD-10 MCP's `search_codes` to find 4 plausible distractors from related body system codes
- Return: `{ vignette, correctCode, correctDescription, options: [{ code, description }] }`
- **Acceptance:** Generate a question, verify correct code is among options and distractors are plausible

**Step 3: Create drill hook (1 hour)**
- Create `hooks/game/use-icd-drill.ts` following `use-pharm-drill.ts` pattern
- Queue-based prefetching (queue size 5)
- State machine: landing → menu (optional system filter) → playing → feedback
- Integrate `useDrillFSRS({ drillType: 'icd10' })`
- **Acceptance:** Hook cycles through questions, submits answers to FSRS

**Step 4: Create drill component (1 hour)**
- Create `components/drill/ICDCodingDrill.tsx` following `PharmDrillSession.tsx` pattern
- Wrap in `DrillShell` with breadcrumb
- Display: clinical vignette at top, ICD-10 code options below (each showing code + description)
- Feedback: show correct code, link to the full ICD-10 hierarchy, explain why distractors are wrong
- **Acceptance:** Complete a 10-question drill, see scores and FSRS feedback

**Step 5: Register drill in navigation (30 min)**
- Add ICD-10 Coding Drill to the drill hub/practice page
- Add routing entry
- **Acceptance:** Can navigate to and launch the drill from the practice page

### 6. Testing Strategy

- **Unit tests:** Test distractor generation (no duplicate codes, all from same body system), test vignette-to-code mapping
- **Integration:** Full drill flow: generate → answer → FSRS submission → feedback
- **Manual:** Complete 20 ICD-10 questions, verify codes are real and distractors are plausible

### 7. Estimated Effort

Total: **2–3 days**
- Code curation + generation endpoint: 0.75 day
- Drill hook: 0.5 day
- Drill component: 0.5 day
- Integration + testing: 0.5 day

### 8. Self-Check Queries

1. "Do the generated distractors come from the same body system chapter to be genuinely confusable?"
2. "Is the FSRS pipeline receiving submissions with `sessionType: 'drill'`?"
3. "What happens when the ICD-10 MCP is unavailable — does the drill show an error or use cached codes?"
4. "Are ICD-10 drill questions tracked in `QuestionAttempt` for analytics?"

---

## Feature 8: Elaborative Interrogation Drill

### 1. Goal & PANCE Impact

Elaborative interrogation — forcing students to explain *why* a fact is true before revealing the mechanism — produces 2-3x better retention than passive review (Pressley et al., 1987; Dunlosky et al., 2013). Present "Furosemide causes hypokalemia" and force the student to explain the mechanism via free-text before revealing the answer. Gemini grades the explanation for completeness. This is the highest-yield study technique that PANaCEa doesn't yet implement.

### 2. Prerequisites & Risks

**Dependencies:** None. New drill type.

**Risks:**
1. **Free-text grading quality** — Gemini may be too lenient or too strict. *Mitigation:* Use a structured rubric prompt with specific grading criteria (mechanism identified, key intermediaries mentioned, clinical relevance addressed). Start with a 3-point scale (incomplete/partial/complete).
2. **Student frustration with open-ended format** — Some students prefer MCQ. *Mitigation:* Provide optional hints and a "skip to explanation" button (with an FSRS penalty per existing hint logic).

### 3. Schema Changes

No schema changes required. Uses existing `QuestionAttempt` with metadata for free-text response and Gemini grade.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `hooks/game/use-elaboration-drill.ts` | Create | Drill hook: present fact, collect free-text, grade via Gemini, submit to FSRS |
| `components/drill/ElaborationDrill.tsx` | Create | UI: fact prompt, text input area, graded feedback with model explanation |
| `functions/api/drills/elaboration/grade.ts` | Create | Gemini grading endpoint for free-text explanations |
| `functions/api/drills/elaboration/generate.ts` | Create | Generate "explain why" prompts from medical content |

### 5. Implementation Steps

**Step 1: Create fact generation endpoint (1 hour)**
- Create `functions/api/drills/elaboration/generate.ts`
- Query `MedicalContent` or `Condition` tables for a condition
- Generate a clinical fact + the hidden mechanism using Gemini
- Return: `{ fact: "Furosemide causes hypokalemia", conditionId, system, hiddenMechanism: "...", gradingRubric: [...] }`
- **Acceptance:** Endpoint returns a fact with a grading rubric

**Step 2: Create Gemini grading endpoint (1.5 hours)**
- Create `functions/api/drills/elaboration/grade.ts`
- Accept: `{ fact, studentExplanation, gradingRubric }`
- Prompt Gemini (gemini-2.5-flash, temp 0.3) with a structured rubric:
  - Score 0-3: 0=no relevant content, 1=partially correct mechanism, 2=correct mechanism missing details, 3=complete with clinical relevance
  - Return: `{ score, maxScore: 3, feedback: string, missingConcepts: string[], modelExplanation: string }`
- Follow the grading pattern from `functions/api/osce/analysis/grade.ts`
- **Acceptance:** Submit a correct explanation, get score 3. Submit nonsense, get score 0.

**Step 3: Create drill hook (1 hour)**
- Create `hooks/game/use-elaboration-drill.ts`
- States: fact_presented → typing → submitted → graded → feedback
- Integrate `useDrillFSRS`: map score 0-1 → Again, score 2-3 → Good (binary FSRS)
- Track time-to-first-keystroke as implicit metric
- **Acceptance:** Hook manages full lifecycle from fact presentation to FSRS submission

**Step 4: Create drill component (1.5 hours)**
- Create `components/drill/ElaborationDrill.tsx`
- Layout: Fact card at top ("Explain: Why does furosemide cause hypokalemia?")
- Multi-line text input with character count
- "I'm stuck — show hint" button (applies hint penalty per existing logic)
- After submission: show score badge (0-3), model explanation with missing concepts highlighted in orange
- Use Framer Motion for the reveal animation
- Wrap in DrillShell
- **Acceptance:** Complete a full drill cycle with visual feedback

**Step 5: Register and integrate (30 min)**
- Add to drill hub navigation
- **Acceptance:** Launchable from practice page, FSRS submissions visible in ReviewLog

### 6. Testing Strategy

- **Unit tests:** Test score-to-FSRS-rating mapping (0-1→Again, 2-3→Good), test grading rubric generation
- **Integration:** Full flow: generate fact → type explanation → grade → FSRS submit
- **Manual:** Test with 3 explanations of varying quality, verify grading consistency

### 7. Estimated Effort

Total: **3–4 days**
- Generation + grading endpoints: 1 day
- Drill hook: 0.5 day
- Drill component: 1 day
- Testing + polish: 0.5 day

### 8. Self-Check Queries

1. "Is the Gemini grading consistent across multiple submissions of the same explanation?"
2. "Does the hint penalty correctly apply to FSRS via the existing hint-viewed penalty (0.4 grade penalty)?"
3. "What is the minimum explanation length before submission is allowed?"
4. "Does this drill type count toward daily streak activity?"

---

## Feature 9: Text Highlighter + Strikethrough in Quiz Sessions

### 1. Goal & PANCE Impact

The actual PANCE exam interface provides text highlighting and answer strikethrough tools. Students who practice with these tools build muscle memory for exam day, reducing cognitive load during the real test. QuizView already has basic text highlighting (mouseup creates `<span class="user-highlight">`), but it lacks: strikethrough on answer options, highlight color choices, and undo capability. This feature rounds out test-day fidelity.

### 2. Prerequisites & Risks

**Dependencies:** None.

**Key discovery:** `QuizView.tsx` lines 172-206 already implement text selection highlighting via a mouseup handler that wraps selected text in `<span class="user-highlight">`. The gap is: no strikethrough on options, no undo, no visual indicator that highlighting is active, and the highlight doesn't survive answer navigation.

**Risks:**
1. **DOM manipulation fragility** — `range.surroundContents(span)` can fail on partial selections across elements. *Mitigation:* Wrap in try-catch (already done). Consider using a more robust library like `mark.js` if edge cases persist.
2. **Performance on long vignettes** — Many highlights could slow re-renders. *Mitigation:* Store highlights in a ref (not state) to avoid re-renders. Current approach already uses DOM manipulation, not React state.

### 3. Schema Changes

No schema changes required. Highlights and strikethroughs are per-question, stored in component state (not persisted to DB).

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `components/session/QuizView.tsx` | Modify | Enhance existing highlight, add strikethrough on answer options, add toolbar |
| `components/session/HighlightToolbar.tsx` | Create | Small floating toolbar: highlight, strikethrough, clear highlights |
| `hooks/useQuestionAnnotations.ts` | Create | Manage per-question highlight/strikethrough state |

### 5. Implementation Steps

**Step 1: Create annotation state hook (1 hour)**
- Create `hooks/useQuestionAnnotations.ts`
- Manage: `highlights: Map<questionId, HighlightData[]>`, `strikethroughs: Map<questionId, Set<number>>` (option indices)
- Functions: `addHighlight(questionId, range)`, `removeHighlight(questionId, index)`, `toggleStrikethrough(questionId, optionIndex)`, `clearAnnotations(questionId)`
- Store in ref to avoid re-renders — expose through callbacks
- **Acceptance:** Hook correctly tracks annotations per question

**Step 2: Enhance text highlighting (1 hour)**
- In `QuizView.tsx`, replace the raw mouseup handler with the hook
- Add a small floating toolbar that appears on text selection: [Highlight Yellow] [Highlight Green] [Clear]
- Use Framer Motion for toolbar appearance animation
- Add double-click-to-remove on existing highlights
- **Acceptance:** Select text, see toolbar, click highlight color, text stays highlighted. Double-click to remove.

**Step 3: Add answer strikethrough (1 hour)**
- In the answer options rendering section of QuizView, add a right-click context menu or long-press handler
- On trigger: toggle `line-through` style on the option text, dim opacity to 0.4
- Visual: strikethrough text with muted color, but option still selectable
- Store in annotation hook per question
- **Acceptance:** Right-click an answer option, see it struck through. Can still select it if desired.

**Step 4: Add toolbar component (30 min)**
- Create `components/session/HighlightToolbar.tsx`
- Floating toolbar positioned near the question area
- Buttons: 🖍 Highlight (toggle mode), ✂ Strikethrough (toggle mode), 🗑 Clear All
- Keyboard shortcuts: H for highlight mode, S for strikethrough mode, Esc to clear mode
- **Acceptance:** Toolbar visible during quiz, keyboard shortcuts work

**Step 5: Handle navigation (30 min)**
- When navigating to the next question, clear DOM highlights but preserve state in the hook
- When navigating back to a previously annotated question, re-apply highlights from state
- **Acceptance:** Highlight text on Q1, go to Q2, come back to Q1, highlights are restored

### 6. Testing Strategy

- **Unit tests:** Test annotation hook: add/remove highlights, toggle strikethrough, clear all, per-question isolation
- **Manual:** Full quiz session with highlighting and strikethrough. Test: selection across HTML elements, very long vignettes, mobile touch events, keyboard shortcuts
- **Accessibility:** Verify strikethrough options are still screen-reader accessible (use `aria-label` or `aria-describedby`)

### 7. Estimated Effort

Total: **2 days**
- Annotation hook: 0.5 day
- Highlight enhancement + toolbar: 0.75 day
- Strikethrough + navigation: 0.5 day
- Testing: 0.25 day

### 8. Self-Check Queries

1. "Does highlighting work on questions with embedded HTML tables (QuizView supports this)?"
2. "Does strikethrough state reset when starting a new session?"
3. "On mobile, what gesture triggers strikethrough? (Right-click doesn't exist on touch)"
4. "Do highlights interfere with the implicit metrics collection (mouseup events could conflict)?"
5. "Is there a maximum number of highlights per question before performance degrades?"

---

# SPRINT 4 — Social & Analytics (Week 4)

---

## Feature 10: Peer Validation Stats

### 1. Goal & PANCE Impact

"42% of peers also chose B" normalizes mistakes and reduces test anxiety. Social proof data shows students that commonly missed questions are genuinely difficult, not a personal failure. This is already partially built — `AnswerFeedback.tsx` renders `answerDistribution` data when provided. The gap is computing and serving this aggregation from the backend.

### 2. Prerequisites & Risks

**Dependencies:** None. UI already exists.

**Key discovery:** `AnswerFeedback.tsx` lines 96-112 already render peer stats when `answerDistribution` prop is provided. The prop type is `{ optionLetter: string; count: number; percent: number }[] | null`. The gap is: (a) no backend endpoint computing this aggregation, (b) QuizView doesn't yet pass this prop with real data.

**Risks:**
1. **Privacy** — Aggregated stats are anonymous, but small cohort sizes could be identifying. *Mitigation:* Only show peer stats when ≥10 students have attempted the question.
2. **Performance** — Aggregating across all users per question on every request is expensive. *Mitigation:* Pre-compute and cache. Update aggregation hourly or on a materialized view.

### 3. Schema Changes

```prisma
model QuestionAnswerDistribution {
  id           String   @id @default(cuid())
  questionId   String   @unique
  distribution Json     // { A: count, B: count, C: count, D: count, E: count }
  totalAttempts Int
  lastUpdated  DateTime @default(now())

  @@index([questionId])
}
```

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `QuestionAnswerDistribution` model |
| `functions/api/analytics/answer-distribution.ts` | Create | GET endpoint: return distribution for a question ID |
| `functions/api/cron/aggregate-distributions.ts` | Create | Scheduled job to compute distributions from QuestionAttempt |
| `components/session/QuizView.tsx` | Modify | Fetch and pass `answerDistribution` to `AnswerFeedback` after answer submission |
| `hooks/useAnswerDistribution.ts` | Create | Fetch distribution for current question after answering |

### 5. Implementation Steps

**Step 1: Schema migration (15 min)**
- Add `QuestionAnswerDistribution` model
- Run migration
- **Acceptance:** Table exists

**Step 2: Create aggregation logic (1 hour)**
- Create `functions/api/cron/aggregate-distributions.ts`
- Query: `SELECT questionId, selectedAnswer, COUNT(*) FROM QuestionAttempt GROUP BY questionId, selectedAnswer`
- Compute percentages per option
- Upsert into `QuestionAnswerDistribution`
- This can run as a Cloudflare Cron Trigger or be called manually
- **Acceptance:** After running aggregation, distribution table is populated

**Step 3: Create distribution API endpoint (45 min)**
- Create `functions/api/analytics/answer-distribution.ts`
- GET with `?questionId=xxx`
- Return `{ distribution: [{ optionLetter, count, percent }], totalAttempts }` or null if <10 attempts
- **Acceptance:** Endpoint returns correct distribution for a question with attempts

**Step 4: Wire into QuizView (1 hour)**
- In `QuizView.tsx`, after the student submits an answer, fetch the distribution for the current question
- Pass as the `answerDistribution` prop to `AnswerFeedback`
- The existing UI rendering (lines 96-112 of AnswerFeedback) handles the display
- **Acceptance:** Answer a question, see "X% of peers also chose Y" in the feedback

**Step 5: Initial data population (30 min)**
- Run the aggregation once to populate initial data
- Set up a schedule (daily) for ongoing updates
- **Acceptance:** Questions with ≥10 attempts show peer stats

### 6. Testing Strategy

- **Unit tests:** Test aggregation logic: correct percentage calculation, handling of questions with <10 attempts (should return null)
- **Integration:** Answer a question → fetch distribution → verify UI renders
- **Manual:** Find a question attempted by many test users, verify the percentages look reasonable

### 7. Estimated Effort

Total: **2 days**
- Schema + aggregation: 0.5 day
- API endpoint: 0.25 day
- QuizView integration: 0.5 day
- Testing + initial data run: 0.5 day

### 8. Self-Check Queries

1. "Does the distribution update in near-real-time, or only on the scheduled aggregation run?"
2. "Are distributions computed across ALL users or only within a cohort/institution?"
3. "Does the 10-attempt minimum threshold prevent showing stats for rare questions?"
4. "Does this query put excessive load on the database? (Check query plan)"

---

## Feature 11: Spaced Retrieval Calendar View

### 1. Goal & PANCE Impact

Replace the flat "12 cards due" number with a visual calendar showing upcoming review load. Students can see "Monday: 45 cards, Tuesday: 12 cards" and plan study time around clinical rotations. This directly improves adherence to the SRS schedule — the #1 factor in FSRS effectiveness. Pairs well with the Google Calendar MCP for auto-blocking study time.

### 2. Prerequisites & Risks

**Dependencies:** None. Uses existing `UserProgress.nextReviewAt` data.

**Risks:**
1. **Stale predictions** — FSRS `nextReviewAt` changes after every review, making future projections inherently unstable. *Mitigation:* Show "estimated" language and a note that the forecast updates after each session. Only project 7 days ahead.
2. **Performance** — Querying all user's cards with future review dates. *Mitigation:* Use a single aggregate query: `SELECT DATE(nextReviewAt), COUNT(*) FROM UserProgress WHERE userId=? AND nextReviewAt BETWEEN now AND now+7days GROUP BY DATE(nextReviewAt)`.

### 3. Schema Changes

No schema changes required. Uses existing `UserProgress.nextReviewAt`.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `functions/api/analytics/review-forecast.ts` | Create | Endpoint: 7-day review forecast by date |
| `components/dashboard/ReviewCalendar.tsx` | Create | 7-day calendar strip with review counts |
| `hooks/useReviewForecast.ts` | Create | Fetch forecast data |

### 5. Implementation Steps

**Step 1: Create forecast endpoint (1 hour)**
- Create `functions/api/analytics/review-forecast.ts`
- Query `UserProgress` for the user: group by `DATE(nextReviewAt)` for next 7 days
- Also include count of overdue (nextReviewAt < now)
- Return: `{ overdue: number, forecast: [{ date: string, count: number }] }`
- **Acceptance:** Endpoint returns accurate day-by-day counts

**Step 2: Build calendar component (1.5 hours)**
- Create `components/dashboard/ReviewCalendar.tsx`
- Design: Horizontal strip showing 7 days (Mon-Sun) with card counts
- Color intensity proportional to load (light green for <10, medium for 10-30, dark for 30+)
- Today highlighted with a ring indicator
- Overdue count shown prominently in red
- Tap a day to see "45 cards due: 12 CV, 8 Pulm, ..." breakdown
- **Acceptance:** Calendar renders with real data, color coding is intuitive

**Step 3: Hook and dashboard integration (30 min)**
- Create `hooks/useReviewForecast.ts`, fetch on mount
- Add `ReviewCalendar` to the dashboard above the existing study action cards
- **Acceptance:** Dashboard shows the calendar with live forecast data

**Step 4: Google Calendar integration (optional, 1 hour)**
- Use the Google Calendar MCP (`gcal_create_event`) to offer "Block study time"
- When a day has 30+ cards, show a button: "📅 Block 30 min for review"
- Creates a calendar event with title "PANaCEa Review: 45 cards" at the user's preferred study time
- **Acceptance:** Clicking the button creates a Google Calendar event

### 6. Testing Strategy

- **Unit tests:** Test forecast query aggregation, test overdue calculation
- **Manual:** Check forecast against actual `UserProgress` records in Prisma Studio

### 7. Estimated Effort

Total: **2–3 days**
- Backend: 0.5 day
- Frontend: 1 day
- Calendar MCP integration: 0.5 day (optional)
- Testing: 0.25 day

### 8. Self-Check Queries

1. "Does the forecast account for timezone differences (user's local date vs. UTC)?"
2. "Does completing a session immediately update the forecast on the dashboard?"
3. "What does the calendar show for a new user with 0 review cards?"

---

## Feature 12: UX Copy Refinements

### 1. Goal & PANCE Impact

Words matter for motivation. "Missed Questions" frames errors negatively; "Learning Opportunities" reframes them as growth. Standardizing the app's voice to "Encouraging Professional" maintains the clinical tone while reducing anxiety. These changes take minutes each but compound into a meaningfully less stressful study experience.

### 2. Prerequisites & Risks

**Dependencies:** None. Pure text changes.

**Risks:** Minimal. Only risk is changing copy that users have already habituated to. *Mitigation:* Make changes in a single batch so the app feels "refreshed" rather than randomly different.

### 3. Schema Changes

No schema changes required.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| Multiple component files | Modify | Text string replacements |
| `lib/constants/copy.ts` | Create | Centralized copy constants for consistent voice |

### 5. Implementation Steps

**Step 1: Create centralized copy constants (30 min)**
- Create `lib/constants/copy.ts`
- Define all user-facing strings that should be consistent:
  - `MISSED_QUESTIONS → "Learning Opportunities"`
  - `WEAKNESS_STUDY_GUIDE → "Focus Areas"`
  - `CLEAR_DATA → "Reset Study Data"` (demoted to text link)
  - `ZERO_ACCURACY → "Not yet assessed"` instead of `"0%"`
- **Acceptance:** File exists with all copy constants

**Step 2: Global search and replace (1 hour)**
- Search codebase for: "Missed Questions", "Weakness", "Clear Data", "0% Accuracy"
- Replace with constants from `copy.ts`
- Add info-icon tooltips (using existing tooltip component) to AI-derived scores
- **Acceptance:** All instances replaced, `grep` returns 0 hits for old strings

**Step 3: Add tooltips to AI scores (30 min)**
- Find components displaying confidence scores, mastery scores, implicit ratings
- Add tooltip: "This score is derived from your response patterns (speed, answer changes, dwell time). It helps the system schedule your reviews optimally."
- **Acceptance:** Hover over any AI score, see explanation tooltip

### 6. Testing Strategy

- **Manual:** Read through all screens end-to-end, verify no "Missed Questions" or other old copy remains. Check tooltips on all AI scores.

### 7. Estimated Effort

Total: **1 day**
- Copy constants + replacements: 0.5 day
- Tooltips + polish: 0.5 day

### 8. Self-Check Queries

1. "Are all instances of 'Missed Questions' replaced, including in analytics and email notifications?"
2. "Do the new terms make sense in all contexts? ('Focus Areas' works for the study guide but does it work in chart labels?)"
3. "Are the tooltips accessible (keyboard focusable, screen reader compatible)?"

---

# SPRINT 5 — Performance & Infra (Week 5)

---

## Feature 13: Web Worker for FSRS Calculations

### 1. Goal & PANCE Impact

FSRS calculations currently run on the main thread. For bulk scheduling recalculations (end-of-session with 50+ cards), this can cause UI jank — visible frame drops during the stability/difficulty computations. Moving FSRS into a Web Worker ensures smooth 60fps animations and instant UI responsiveness, which is especially noticeable on lower-powered devices that PA students often use (older iPads during rotations).

### 2. Prerequisites & Risks

**Dependencies:** None.

**Risks:**
1. **Worker communication overhead** — Transferring card data to/from the worker adds serialization cost. *Mitigation:* Use `Comlink` for ergonomic async calls. Batch cards in a single message rather than one-by-one.
2. **Fallback for unsupported browsers** — Some older WebViews don't support Workers. *Mitigation:* Feature-detect, fall back to main thread if unavailable.

### 3. Schema Changes

No schema changes required.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `lib/workers/fsrs.worker.ts` | Create | Web Worker running FSRS v6 calculations |
| `lib/workers/fsrsWorkerClient.ts` | Create | Comlink wrapper for ergonomic API |
| `lib/fsrs.ts` | Modify | Add export of pure calculation functions (already mostly pure) |
| `vite.config.ts` | Modify | Configure worker bundling |
| `lib/services/drillReviewService.ts` | Modify | Use worker client for bulk calculations |

### 5. Implementation Steps

**Step 1: Install Comlink and configure Vite (30 min)**
- `npm install comlink`
- In `vite.config.ts`, ensure worker files are bundled correctly (Vite supports `?worker` imports)
- **Acceptance:** A test worker builds and runs

**Step 2: Extract FSRS pure functions (30 min)**
- Verify `lib/fsrs.ts` exports pure functions that can run in a worker (no DOM, no React, no Prisma)
- If any FSRS functions depend on non-transferable objects, refactor to accept plain data
- **Acceptance:** All FSRS calculation functions work with plain JS objects

**Step 3: Create FSRS worker (1 hour)**
- Create `lib/workers/fsrs.worker.ts`
- Import FSRS functions, expose via `Comlink.expose`
- API: `calculateNextReview(card, rating, params)`, `batchCalculate(cards[], ratings[], params)`
- **Acceptance:** Worker responds correctly to test messages

**Step 4: Create worker client (30 min)**
- Create `lib/workers/fsrsWorkerClient.ts`
- Use `Comlink.wrap` to create a typed async interface
- Add feature detection and main-thread fallback
- Singleton pattern: one worker instance shared across the app
- **Acceptance:** Client calls worker and receives results

**Step 5: Integrate into drillReviewService (1 hour)**
- Where `drillReviewService.ts` does bulk FSRS calculations, use the worker client
- For single-card calculations (per-question submission), keep main thread (overhead not worth it)
- Only use worker for batch operations (end-of-session, bulk reschedule)
- **Acceptance:** End-of-session with 50+ cards shows no UI jank

### 6. Testing Strategy

- **Unit tests:** Test worker calculations match main-thread calculations exactly (same inputs → same outputs)
- **Performance:** Measure frame drops during 100-card batch calculation with and without worker
- **Manual:** Complete a 50-question session, verify smooth animations during end-of-session FSRS updates

### 7. Estimated Effort

Total: **2 days**
- Setup + worker creation: 0.75 day
- Client + integration: 0.75 day
- Testing + fallback: 0.5 day

### 8. Self-Check Queries

1. "Does the worker correctly handle the 21-parameter FSRS v6 configuration?"
2. "Is there a race condition if two components request FSRS calculations simultaneously?"
3. "Does the fallback work on Safari iOS WebView?"
4. "What is the actual measured improvement in frame time for a 50-card batch?"

---

## Feature 14: Background Sync for Offline Drill Submissions

### 1. Goal & PANCE Impact

"Commuter Mode" — study on the subway, everything syncs when you surface. The SyncManager already queues answers in localStorage with retry logic. True Background Sync API registers a sync event with the service worker, which retries automatically when connectivity returns — even if the app is closed. This transforms PANaCEa from "works offline-ish" to "genuinely offline-first."

### 2. Prerequisites & Risks

**Dependencies:** None. Enhances existing SyncManager.

**Key discovery:** SyncManager in `lib/services/sync/syncManager.ts` already queues `OfflineAnswer` and `OfflineReview` in localStorage with exponential backoff retry. Service worker is registered via `lib/utils/serviceWorkerRegistration.ts`. The gap is: (a) no Background Sync API registration, (b) service worker doesn't handle sync events, (c) no IndexedDB (localStorage is synchronous and size-limited).

**Risks:**
1. **iOS support** — Safari doesn't support Background Sync API. *Mitigation:* Keep existing localStorage + polling as fallback. Background Sync is a progressive enhancement for Android/Chrome/desktop.
2. **Data integrity** — IndexedDB transactions must be atomic. *Mitigation:* Use `idb` library for promise-based IndexedDB access with proper transaction handling.

### 3. Schema Changes

No schema changes required.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `lib/services/sync/offlineStore.ts` | Create | IndexedDB wrapper for offline queue (replaces localStorage) |
| `lib/services/sync/syncManager.ts` | Modify | Use IndexedDB instead of localStorage, register Background Sync |
| `public/sw.js` | Modify | Add `sync` event handler for background retry |
| `lib/utils/serviceWorkerRegistration.ts` | Modify | Register sync events |

### 5. Implementation Steps

**Step 1: Create IndexedDB store (1 hour)**
- `npm install idb`
- Create `lib/services/sync/offlineStore.ts`
- Database: `panacea_offline`, stores: `answers`, `reviews`, `pearl_actions`
- CRUD operations: `add`, `getAll`, `markSynced`, `removeSynced`
- **Acceptance:** Can store and retrieve offline records via IndexedDB

**Step 2: Migrate SyncManager to IndexedDB (1 hour)**
- Update `syncManager.ts` to use `offlineStore` instead of localStorage
- Keep localStorage as fallback if IndexedDB unavailable
- **Acceptance:** Queue an answer offline, verify it appears in IndexedDB (DevTools → Application → IndexedDB)

**Step 3: Add Background Sync registration (1 hour)**
- In SyncManager, after queueing a record, register a sync:
  ```typescript
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-answers');
  }
  ```
- **Acceptance:** Sync event registered (visible in DevTools → Application → Service Workers → Sync)

**Step 4: Add sync handler to service worker (1.5 hours)**
- In `public/sw.js`, add:
  ```javascript
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-answers') {
      event.waitUntil(syncOfflineData());
    }
  });
  ```
- `syncOfflineData()`: read from IndexedDB, POST each to the appropriate API endpoint, mark synced on success
- Handle auth: store a refresh token or use a long-lived session token
- **Acceptance:** Go offline, answer questions, close app, go online — answers sync automatically

**Step 5: Add UI indicator (30 min)**
- Update `OfflineSyncIndicator` to show IndexedDB queue count
- Show "X answers will sync when you're back online" message
- **Acceptance:** Offline indicator shows pending count, syncs and clears on reconnect

### 6. Testing Strategy

- **Manual:** Go to airplane mode → complete a drill → close the browser → turn off airplane mode → verify answers synced (check ReviewLog in DB)
- **Fallback:** Test on Safari iOS → verify localStorage fallback still works

### 7. Estimated Effort

Total: **3 days**
- IndexedDB store: 0.5 day
- SyncManager migration: 0.5 day
- Background Sync + service worker: 1 day
- Testing + fallback: 0.5 day
- UI updates: 0.25 day

### 8. Self-Check Queries

1. "Does the service worker have access to the auth token needed for API calls?"
2. "What happens if Background Sync fires but the server is still unreachable?"
3. "Is there a conflict resolution strategy if the same question was answered online and offline?"
4. "Does IndexedDB storage persist across browser updates?"

---

## Feature 15: Push Notifications for SRS Reminders

### 1. Goal & PANCE Impact

Adaptive push notifications for spaced repetition significantly improve engagement — "You have 12 cards due — 5 min review" sent at optimal times based on the student's study patterns. Research shows timely reminders increase SRS adherence by 40%+ (Kornell, 2009). The PWA already has a service worker; adding push is a progressive enhancement.

### 2. Prerequisites & Risks

**Dependencies:** Feature 14 (Background Sync) establishes service worker patterns. Feature 11 (Calendar View) provides the review count data.

**Risks:**
1. **iOS PWA push limitations** — iOS 16.4+ supports push for Home Screen PWAs, but the permission flow is non-standard. *Mitigation:* Feature-detect and only prompt on supported platforms. Show an in-app reminder for unsupported platforms.
2. **Notification fatigue** — Too many notifications cause users to disable them. *Mitigation:* Max 2 per day. Time based on circadian model (existing `lib/circadian.ts`). Respect quiet hours.

### 3. Schema Changes

```prisma
model PushSubscription {
  id           String   @id @default(cuid())
  userId       String
  endpoint     String
  p256dh       String
  auth         String
  createdAt    DateTime @default(now())
  User         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
  @@index([userId])
}

model UserPreferences {
  // ... existing ...
  pushEnabled        Boolean @default(false)
  pushQuietStart     String  @default("22:00") // HH:MM
  pushQuietEnd       String  @default("07:00")
  pushMaxPerDay      Int     @default(2)
}
```

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `prisma/schema.prisma` | Modify | Add PushSubscription model + push preferences |
| `functions/api/push/subscribe.ts` | Create | Store push subscription |
| `functions/api/push/send.ts` | Create | Send push notification (called by cron) |
| `functions/api/cron/push-reminders.ts` | Create | Scheduled job: find users with due cards, send push |
| `public/sw.js` | Modify | Handle push event, show notification |
| `hooks/usePushNotifications.ts` | Create | Permission request, subscription management |
| `components/settings/NotificationSettings.tsx` | Create | Push preferences UI |

### 5. Implementation Steps

**Step 1: Schema + VAPID setup (1 hour)**
- Add models to schema, run migration
- Generate VAPID keys: `npx web-push generate-vapid-keys`
- Store VAPID keys in Cloudflare environment variables
- **Acceptance:** Schema migrated, VAPID keys in env

**Step 2: Create subscription endpoint (1 hour)**
- Create `functions/api/push/subscribe.ts`
- POST: receive `{ endpoint, keys: { p256dh, auth } }`, store as PushSubscription
- DELETE: remove subscription
- **Acceptance:** Subscription stored in DB after permission grant

**Step 3: Add push event handler to service worker (1 hour)**
- In `public/sw.js`, add push event handler
- Parse notification data, show notification with title, body, icon, and click action (open app to dashboard)
- **Acceptance:** Test push via DevTools → Application → Service Workers → Push shows notification

**Step 4: Create push sending logic (1.5 hours)**
- Create `functions/api/push/send.ts`
- Use `web-push` library (or raw fetch to Web Push Protocol endpoint)
- Create `functions/api/cron/push-reminders.ts`: query users with `pushEnabled`, check due card count, respect quiet hours, send if due > 0 and within daily limit
- **Acceptance:** Cron trigger sends notification to subscribed user with due cards

**Step 5: Client-side hook + settings UI (1 hour)**
- Create `hooks/usePushNotifications.ts`: check permission, request if needed, subscribe/unsubscribe
- Create `components/settings/NotificationSettings.tsx`: toggle push on/off, set quiet hours, test notification button
- **Acceptance:** Settings UI controls push preferences, test button triggers a notification

### 6. Testing Strategy

- **Integration:** Subscribe → trigger cron → receive notification → click → app opens to dashboard
- **Manual:** Set quiet hours to current time, verify no notification sent. Set to future time, verify notification arrives.

### 7. Estimated Effort

Total: **3–4 days**
- Schema + VAPID: 0.25 day
- Backend (subscribe + send + cron): 1.5 days
- Service worker + client: 1 day
- Settings UI: 0.5 day
- Testing: 0.5 day

### 8. Self-Check Queries

1. "Does the cron job account for user timezones when checking quiet hours?"
2. "What happens when a push subscription expires (endpoint rotates)?"
3. "Is the notification actionable — does clicking it open the app to the review session?"
4. "Does the 2-per-day limit reset at midnight in the user's timezone?"

---

# SPRINT 6 — Polish (Week 6)

---

## Feature 16: UI Fixes from Audit

### 1. Goal & PANCE Impact

Polish items directly affect usability and accessibility. 44×44px touch targets, focus rings, and proper color contrast are WCAG 2.1 AA requirements — failing them means the app is less usable for students with motor or visual impairments. Replacing the mastery slider with a sparkline prevents misuse. These fixes collectively improve the "feels professional" factor that drives long-term retention.

### 2. Prerequisites & Risks

**Dependencies:** None. Independent fixes.

### 3. Schema Changes

No schema changes required.

### 4. Files to Create or Modify

This is a polish sprint — many files touched with small changes. Key items:

| Fix | File(s) | Description |
|-----|---------|-------------|
| Mastery slider → sparkline | Dashboard mastery component | Replace interactive slider with read-only sparkline/histogram |
| Radar → horizontal bar | Analytics chart component | Replace radar chart with sorted bar chart, bottom-3 highlighted |
| Checkbox → toggle | Settings components | Replace checkboxes with toggle switches for on/off modes |
| 0% → "Not yet assessed" | Analytics/stat display components | Conditional rendering for zero-state metrics |
| Clear Data demotion | Settings page | Move to text link with typed confirmation ("type DELETE to confirm") |
| CSV export button | Analytics dashboard | Add export button (move from settings) |
| Dropdown chevrons | Form components | Add ChevronDown icon to all select/dropdown inputs |
| 44×44px touch targets | All interactive elements | Audit and fix minimum sizes |
| Focus rings | Global CSS / Tailwind config | Add `focus-visible:ring-2 focus-visible:ring-blue-500` globally |
| Color contrast | Multiple components | Audit `text-slate-300` and similar low-contrast combinations |

### 5. Implementation Steps

**Step 1: Focus rings and touch targets (1 hour)**
- Add global focus-visible ring styles to `tailwind.config.ts` or global CSS
- Audit all buttons, links, and interactive elements for 44×44px minimum
- **Acceptance:** Tab through the entire app, every interactive element has a visible focus ring. No touch target smaller than 44×44px.

**Step 2: Color contrast audit (1 hour)**
- Run WebAIM contrast checker on key screens
- Fix all `text-slate-300` on light backgrounds (needs ≥4.5:1 ratio for AA)
- Update CSS variables for muted text to meet AA standards
- **Acceptance:** No color contrast failures on primary screens

**Step 3: Component replacements (2 hours)**
- Replace mastery slider with sparkline (use a simple inline SVG or existing chart library)
- Replace radar chart with sorted horizontal bar chart
- Replace checkboxes with toggle switches
- Replace 0% displays with conditional "Not yet assessed"
- **Acceptance:** Visual verification of each replacement

**Step 4: UI refinements (1 hour)**
- Demote "Clear Data" to text link with typed confirmation
- Add CSV export to analytics dashboard
- Add chevron icons to all dropdowns
- **Acceptance:** Each refinement verified manually

### 6. Testing Strategy

- **Accessibility audit:** Run Lighthouse accessibility audit, target 95+ score
- **Manual:** Tab through entire app for keyboard navigation. Test on mobile for touch targets.

### 7. Estimated Effort

Total: **5–7 days** (spread across the sprint)
- Accessibility (focus, touch, contrast): 2 days
- Component replacements: 2 days
- UI refinements: 1-2 days
- Audit + verification: 1 day

### 8. Self-Check Queries

1. "Does Lighthouse accessibility score meet 95+?"
2. "Can the entire app be navigated with keyboard only?"
3. "Are the new toggle switches accessible (proper ARIA roles)?"

---

## Feature 17: Teach-Back Mode

### 1. Goal & PANCE Impact

After mastering a topic (FSRS stability above threshold), prompt the student to explain the concept as if teaching a classmate. Gemini grades the explanation for completeness and accuracy. This targets the highest tier of Bloom's taxonomy (Create/Evaluate) and locks in long-term retention. Research shows teaching produces a 50% improvement in delayed test performance over studying alone (Nestojko et al., 2014).

### 2. Prerequisites & Risks

**Dependencies:** Feature 8 (Elaborative Interrogation) establishes the free-text grading pattern. Reuse the grading endpoint.

**Risks:**
1. **When to trigger** — Too early frustrates; too late wastes the opportunity. *Mitigation:* Trigger when `UserProgress.stability > 30 days` AND the card has been reviewed ≥5 times (deep familiarity threshold).
2. **Grading leniency** — Teaching explanations are informal; strict grading discourages. *Mitigation:* Use a more lenient rubric focused on "did they cover the key concepts" rather than clinical precision.

### 3. Schema Changes

No schema changes required. Uses existing `QuestionAttempt` with metadata.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `hooks/game/use-teachback-drill.ts` | Create | Drill hook for teach-back mode |
| `components/drill/TeachBackDrill.tsx` | Create | UI: topic prompt, text area, graded feedback |
| `functions/api/drills/teachback/generate.ts` | Create | Select a mastered topic for teach-back |
| `functions/api/drills/teachback/grade.ts` | Create | Grade teaching explanation (reuse elaboration grading pattern) |

### 5. Implementation Steps

Follow the same pattern as Feature 8 (Elaborative Interrogation), with these differences:
- Question selection: Only topics where `UserProgress.stability > 30` AND `reviewCount >= 5`
- Prompt: "Explain [condition] to a classmate who's never seen it. Cover: what it is, how it presents, how you diagnose it, and first-line treatment."
- Grading rubric: 4 categories (definition, presentation, diagnosis, treatment), each scored 0-1
- FSRS integration: Score ≥3/4 → Good (reinforces stability), Score <3/4 → Again (resurfaces for review)

### 6. Testing Strategy

Same as Feature 8. Additional test: verify topic selection only surfaces mastered content.

### 7. Estimated Effort

Total: **2–3 days** (leverages Feature 8 patterns)

### 8. Self-Check Queries

1. "Are mastered topics correctly identified using the stability threshold?"
2. "Does a failed teach-back actually decrease the card's stability via FSRS?"
3. "Is the grading rubric lenient enough for informal teaching explanations?"

---

## Feature 18: Clinical Trials in Explanations

### 1. Goal & PANCE Impact

Surfacing relevant active clinical trials ("Note: A Phase III trial NCT12345 is testing a new SGLT2 inhibitor for this condition") teaches evidence-based medicine thinking and keeps content feeling current. The Clinical Trials MCP is connected with `search_trials` and `get_trial_details` tools.

### 2. Prerequisites & Risks

**Dependencies:** Feature 1 (Search Grounding) establishes the citation display pattern.

**Risks:**
1. **Relevance** — Most conditions won't have noteworthy active trials. *Mitigation:* Only show trials for conditions where a Phase III or IV trial exists. This naturally filters to clinically significant research.
2. **Distraction** — Trial details could overwhelm the explanation. *Mitigation:* Show as a single collapsed "Active Research" pill at the bottom of ExplanationPanel. One line: title + phase + NCT number.

### 3. Schema Changes

No schema changes required.

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `lib/services/question/trialEnricher.ts` | Create | Query Clinical Trials MCP for relevant trials |
| `components/questions/ExplanationPanel.tsx` | Modify | Add "Active Research" section |
| `lib/services/question/generationService.ts` | Modify | Optionally enrich questions with trial data |

### 5. Implementation Steps

**Step 1: Create trial enricher (1 hour)**
- Query Clinical Trials MCP `search_trials` with condition name, filter Phase III/IV, status: Recruiting
- Return top 1-2 trials: `{ nctId, title, phase, status, url }`
- Cache per condition (trials don't change frequently)

**Step 2: Add to ExplanationPanel (1 hour)**
- Collapsible "🔬 Active Research" section
- One line per trial: "[Phase III] Title — NCT12345 ↗"
- **Acceptance:** Explanation for a common condition shows relevant trial

**Step 3: Integration (30 min)**
- Call trial enricher during question generation
- Store in `questionData` for persistence

### 6. Testing Strategy

- **Manual:** Generate questions for 5 conditions (DM2, CHF, NSCLC, RA, depression), verify trial relevance

### 7. Estimated Effort

Total: **1.5–2 days**

### 8. Self-Check Queries

1. "Are trial links to clinicaltrials.gov correct and functional?"
2. "Does the trial section appear only when relevant trials exist?"
3. "Is the trial data cached to avoid repeated MCP calls on review?"

---

# SPRINT 7+ — Transformative (Weeks 7-10)

---

## Feature 19: Three.js Anatomy Viewer Activation

### 1. Goal & PANCE Impact

Visual/spatial anatomy understanding is tested on PANCE. Interactive 3D models where students can rotate, label, and drill on structures are more effective than 2D diagrams (Preece et al., 2013). The codebase has `AnatomyModelViewer.tsx` as a placeholder, types in `types/anatomy-model.ts`, and Supabase storage configured. Just needs actual rendering and model data.

### 2. Prerequisites & Risks

**Dependencies:** None, but large standalone effort.

**Risks:**
1. **3D model sourcing** — GLB models must be anatomically accurate and licensed. *Mitigation:* Source from NIH 3D Print Exchange (public domain) and Sketchfab (CC-licensed). Start with 5 high-yield models: heart, brain, knee, spine, abdomen.
2. **Performance on mobile** — Three.js can be heavy. *Mitigation:* Use React Three Fiber with LOD (level of detail), compress GLB files with Draco, lazy-load the viewer.
3. **File size** — GLB models can be 10-50MB. *Mitigation:* Store in Supabase Storage (already configured), stream via CDN, compress with `gltf-transform`.

### 3. Schema Changes

Leverage existing `AnatomyStructure` table. May need:
```prisma
model AnatomyModel3D {
  id            String   @id @default(cuid())
  name          String
  system        String
  storageUrl    String   // Supabase Storage URL
  fileSizeBytes Int
  annotations   Json     // [{ position: [x,y,z], label: string, structureId: string }]
  createdAt     DateTime @default(now())
}
```

### 4. Files to Create or Modify

| File Path | Action | Purpose |
|-----------|--------|---------|
| `prisma/schema.prisma` | Modify | Add AnatomyModel3D |
| `components/drill/AnatomyModelViewer.tsx` | Modify | Replace placeholder with React Three Fiber scene |
| `hooks/useAnatomyModel.ts` | Create | Load and manage 3D model data |
| `components/drill/AnatomyDrillSession.tsx` | Modify | Wire 3D viewer into anatomy drill flow |
| `functions/api/anatomy/models.ts` | Create | Endpoint to list and serve model metadata |

### 5. Implementation Steps

High-level (1-2 weeks):
1. Install React Three Fiber + Drei: `npm install @react-three/fiber @react-three/drei`
2. Source and compress 5 GLB models, upload to Supabase Storage
3. Build annotation data (JSON positions for each labeled structure)
4. Replace placeholder viewer with actual R3F scene: OrbitControls, model loading, annotation hotspots
5. Wire into anatomy drill: click a structure → identify it → FSRS submit
6. Add progressive loading: skeleton while model downloads

### 6. Testing Strategy

- **Performance:** Test on iPad Safari, Chrome mobile, low-end Android
- **Manual:** Rotate all 5 models, click all annotations, complete an anatomy drill

### 7. Estimated Effort

Total: **7–10 days**
- Model sourcing + preparation: 2 days
- R3F viewer implementation: 3 days
- Annotation system: 2 days
- Drill integration + testing: 2 days

### 8. Self-Check Queries

1. "Do models load within 5 seconds on a 4G connection?"
2. "Does the viewer work on iPad Safari (WebGL compatibility)?"
3. "Are annotations correctly positioned after model rotation?"

---

## Feature 20: Gemini Spatial + Clinical Eye for Radiology

### 1. Goal & PANCE Impact

Visual diagnosis is heavily tested on PANCE. "Find the pathology" drills — upload an X-ray, Gemini returns bounding boxes, student must identify the finding — are more effective than passive image viewing. `types/clinical-eye-system.ts` defines the full data model but the implementation (reveal-on-hover) isn't built.

### 2. Prerequisites & Risks

**Dependencies:** Feature 19 (Anatomy Viewer) establishes 3D/visual interaction patterns.

**Risks:**
1. **Gemini spatial accuracy** — Bounding boxes may be imprecise for subtle findings. *Mitigation:* Use a curated image set with pre-validated annotations as ground truth. Gemini can supplement but shouldn't be the sole source.
2. **Medical image licensing** — Radiology images require explicit licensing. *Mitigation:* Source from Radiopaedia (CC-BY-NC-SA) and NIH Open-i.

### 3. Schema Changes

Leverage types from `types/clinical-eye-system.ts`. May need a `RadiologyImage` table.

### 4. Implementation Steps (High-level, 1-2 weeks)

1. Source 50 curated radiology images with verified annotations
2. Build the image viewer component with hover-reveal bounding boxes
3. Create drill flow: show image → student clicks suspected finding → reveal vs. actual annotation
4. Gemini integration: for new/uncurated images, call Gemini Vision with spatial prompt to generate candidate annotations
5. Wire into FSRS as a drill type

### 7. Estimated Effort

Total: **7–10 days**

---

## Feature 21: Voice OSCE via Gemini Live API

### 1. Goal & PANCE Impact

Voice-based patient encounters directly train the 16% "History Taking" PANCE weight. No competitor has this. Barge-in capability tests real clinical communication skills. The existing text-based OSCE is feature-complete; this adds an audio I/O layer.

### 2. Prerequisites & Risks

**Dependencies:** None, but builds on existing OSCE infrastructure.

**Risks:**
1. **Gemini Live API stability** — Live API may have latency or reliability issues. *Mitigation:* Start with Google Cloud TTS/STT (simpler, no WebSocket) as a stepping stone. Upgrade to Live API when stable.
2. **Browser audio permissions** — PWA audio capture has inconsistent support. *Mitigation:* Feature-detect, fall back to text OSCE on unsupported browsers.
3. **Cost** — Live API with audio is significantly more expensive than text. *Mitigation:* Limit voice OSCE sessions to 10 minutes. Show a timer.

### 3. Schema Changes

```prisma
model OSCESession {
  // ... existing fields ...
  isVoice       Boolean  @default(false)
  audioLogUrl   String?  // Optional audio recording URL
}
```

### 4. Implementation Steps (High-level, 2-3 weeks)

1. **Phase 1 (TTS/STT bridge):** Use Google Cloud TTS to read patient responses aloud + STT to transcribe student speech → feed into existing text-based OSCE state machine
2. **Phase 2 (Gemini Live):** WebSocket connection: client audio → Edge Function for ephemeral token → Gemini Live. Bidirectional streaming with barge-in support
3. **Phase 3 (Polish):** Add voice activity detection, turn-taking indicators, audio recording for review

### 7. Estimated Effort

Total: **15–20 days**
- Phase 1 (TTS/STT bridge): 5 days
- Phase 2 (Gemini Live): 7 days
- Phase 3 (Polish): 3-5 days

---

*Sprint plans complete. See DEPENDENCY_GRAPH.md and RISK_REGISTER.md for cross-cutting analysis.*
