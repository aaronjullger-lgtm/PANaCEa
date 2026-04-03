# PANaCEa Feature Dependency Graph

> Generated 2026-04-02. Shows shared infrastructure, schema changes, and build-order dependencies.

## Visual Dependency Map

```
SPRINT 1 (Week 1) ─────────────────────────────────────────────────────────
  [1] Search Grounding ──┐
  [2] Streak Freezes      │  (no deps)
  [3] Blueprint Heatmap   │  (no deps)
                          │
SPRINT 2 (Week 2) ────────┼────────────────────────────────────────────────
  [4] PubMed Grounding ◄──┘  (uses citation UI from #1)
  [5] Interleaving            (no deps, existing logic)
  [6] Confusion Pairs         (uses ContrastiveDrill pattern)
                          │
SPRINT 3 (Week 3) ────────┼────────────────────────────────────────────────
  [7] ICD-10 Drill            (new drill type, no deps)
  [8] Elaboration Drill       (new drill type, no deps)
  [9] Text Highlighter        (enhances QuizView, no deps)
                          │
SPRINT 4 (Week 4) ────────┼────────────────────────────────────────────────
  [10] Peer Stats             (needs schema, QuizView wiring)
  [11] Review Calendar        (uses UserProgress data)
  [12] UX Copy                (no deps)
                          │
SPRINT 5 (Week 5) ────────┼────────────────────────────────────────────────
  [13] Web Worker FSRS        (touches lib/fsrs.ts)
  [14] Background Sync        (enhances syncManager)
  [15] Push Notifications ◄── [11] (uses review forecast data)
                          │
SPRINT 6 (Week 6) ────────┼────────────────────────────────────────────────
  [16] UI Polish              (no deps)
  [17] Teach-Back ◄────────── [8]  (reuses grading pattern)
  [18] Clinical Trials ◄───── [1]  (uses citation UI)
                          │
SPRINT 7+ (Weeks 7-10) ───┼────────────────────────────────────────────────
  [19] 3D Anatomy             (standalone)
  [20] Clinical Eye ◄──────── [19] (shares visual interaction)
  [21] Voice OSCE             (standalone, builds on OSCE)
```

## Shared Schema Changes (Batch Migration Opportunities)

These features require Prisma schema changes. Batching migrations reduces deployment risk.

**Migration Batch A (Sprint 1-2):**
```
- UserPreferences.streakGoalDays         (#2 Streak Freezes)
- UserPreferences.defaultInterleaveMode  (#5 Interleaving)
- ConfusionPair model                    (#6 Confusion Pairs)
```

**Migration Batch B (Sprint 4-5):**
```
- QuestionAnswerDistribution model       (#10 Peer Stats)
- PushSubscription model                 (#15 Push Notifications)
- UserPreferences.pushEnabled            (#15)
- UserPreferences.pushQuietStart         (#15)
- UserPreferences.pushQuietEnd           (#15)
- UserPreferences.pushMaxPerDay          (#15)
```

**Migration Batch C (Sprint 7+):**
```
- AnatomyModel3D model                  (#19 Anatomy Viewer)
- OSCESession.isVoice                   (#21 Voice OSCE)
- OSCESession.audioLogUrl               (#21)
```

## Shared API Endpoints

| Endpoint | Used By | Notes |
|----------|---------|-------|
| `/api/drills/submit-review` | #7, #8, #9, #17, #19, #20 | All new drill types submit here via `useDrillFSRS` |
| `/api/user/preferences` | #2, #5, #12, #15 | Extended with new preference fields |
| `ExplanationPanel.tsx` | #1, #4, #18 | All citation types render here |
| `useDrillFSRS` hook | #7, #8, #17, #19, #20 | All new drill types consume this |
| `DrillShell` component | #7, #8, #17, #19, #20 | All new drills wrap in this |
| `Gemini grading` pattern | #8, #17 | Same rubric-based grading approach |

## Shared Component Infrastructure

| Component/Pattern | Features That Use It | Build Once In |
|-------------------|---------------------|---------------|
| Citation chip UI (source pills) | #1, #4, #18 | Feature #1 |
| Free-text grading endpoint | #8, #17 | Feature #8 |
| New drill type boilerplate (hook + component + DrillShell) | #7, #8, #17 | Feature #7 |
| IndexedDB offline store | #14, #15 | Feature #14 |
| Service worker enhancements | #14, #15 | Feature #14 |

## Critical Path (Longest Sequential Chain)

```
#1 Search Grounding (1.5d)
  → #4 PubMed Grounding (3.5d)
  → #18 Clinical Trials (1.5d)

Total critical path: ~6.5 days
```

All other features can parallelize around this chain.

## Recommended Build Order Within Each Sprint

**Sprint 1:** #2 (quickest) → #1 (enables later features) → #3
**Sprint 2:** #5 (quickest, mostly verification) → #6 → #4 (longest)
**Sprint 3:** #7 → #8 (similar patterns, do together) → #9
**Sprint 4:** #12 (quickest) → #10 → #11
**Sprint 5:** #14 → #15 (depends on SW patterns from #14) → #13
**Sprint 6:** #16 (can do throughout) → #17 → #18
