# PANaCEa Improvement Timeline — Realistic, Issue-Driven

**Created:** 2026-03-30
**Based on:** Live codebase audit, not theory

---

## Current State (Verified)

### FSRS Pipeline Integration — 1 of 14 drill hooks submits to FSRS

| Drill Hook | Lines | Submits to FSRS? | Has Implicit Metrics? |
|------------|-------|-------------------|-----------------------|
| `use-condition-drill.ts` | 696 | **YES** (but no sessionType → contaminates as 'main') | Partial |
| `use-pharm-drill.ts` | 249 | NO | NO |
| `use-ddx-drill.ts` | 445 | NO | NO |
| `use-anatomy-drill.ts` | 229 | NO | NO |
| `use-first-line-drill.ts` | 278 | NO | NO |
| `use-photo-drill.ts` | 759 | NO | NO |
| `use-mini-lab-drill.ts` | 1522 | NO | NO |
| `use-physiology-drill.ts` | 229 | NO | NO |
| `use-guideline-drill.ts` | 203 | NO | NO |
| `use-ventilator-drill.ts` | 262 | NO | NO |
| `use-polypharmacy-drill.ts` | 210 | NO | NO |
| `use-contrastive-drill.ts` | 98 | NO | NO |
| `use-ecg-drill.ts` (if exists) | - | NO | NO |
| `use-derm-drill.ts` (if exists) | - | NO | NO |

**Also submitting to FSRS (from components directly):**
- `QuizView.tsx` → YES (main session, uses `useImplicitMetrics`)
- `SmartReviewMode.tsx` → YES

### `useImplicitMetrics` hook — exists but only used by QuizView
- 300-line hook at `hooks/useImplicitMetrics.ts`
- Tracks timeToFirstClick, answerSwitches, totalDwellTime, timezone
- Auto-POSTs to `/api/user/behavior-metrics`
- **Only imported by QuizView.tsx** — no drill uses it

### `sessionType` — partially implemented
- The schema accepts `['main', 'cram', 'rapid_recall']` — **no `'drill'` type**
- `use-condition-drill.ts` submits WITHOUT sessionType → defaults to 'main' → **contaminates FSRS**
- `drillReviewService.ts` gates FSRS updates on `sessionType !== 'cram' && sessionType !== 'rapid_recall'`

### DrillShell — only used by ContrastiveDrillSession
- 136-line layout wrapper, zero FSRS awareness
- 15 of 16 drill session components don't use it

### Feedback — `EnhancedFeedbackPanel` is widely used
- 9 drill components already use `EnhancedFeedbackPanel` (good!)
- But it shows no FSRS data (stability, next review, etc.)

### Build/Test environment
- `npm test` fails in this sandbox (missing `@rollup/rollup-linux-arm64-gnu`)
- `tsc --noEmit` OOMs with default memory (needs `--max-old-space-size=4096`)
- These are sandbox issues, not codebase issues

---

## The Timeline

### Week 1: FSRS Foundation (Days 1–3)

**Day 1: Create `useDrillFSRS` hook + add `'drill'` sessionType**

Files to create:
- `hooks/useDrillFSRS.ts` — wraps `useImplicitMetrics` + submission to `/api/drills/submit-review`

Files to modify:
- `functions/api/drills/submit-review.ts` — add `'drill'` to sessionType enum
- `lib/services/drillReviewService.ts` — handle `sessionType === 'drill'` (count for FSRS but tag ReviewLog as `review_type: 'drill'`)

Dependencies: None
Verification: typecheck passes, existing tests pass

**Day 2: Wire PharmDrill + DDxDrill + ConditionDrill**

Files to modify:
- `hooks/game/use-pharm-drill.ts` — add `useDrillFSRS`, wire to answer submission
- `hooks/game/use-ddx-drill.ts` — same
- `hooks/game/use-condition-drill.ts` — replace raw fetch with `useDrillFSRS`, add `sessionType: 'drill'`

Dependencies: Day 1
Verification: typecheck passes

**Day 3: Wire AnatomyDrill + FirstLineDrill + PhotoDrill + MiniLabDrill**

Files to modify:
- `hooks/game/use-anatomy-drill.ts`
- `hooks/game/use-first-line-drill.ts`
- `hooks/game/use-photo-drill.ts`
- `hooks/game/use-mini-lab-drill.ts`

Dependencies: Day 1
Verification: typecheck passes

### Week 1: Remaining Drills (Days 4–5)

**Day 4: Wire PhysiologyDrill + GuidelineDrill + VentilatorDrill + PolypharmacyDrill**

Files to modify:
- `hooks/game/use-physiology-drill.ts`
- `hooks/game/use-guideline-drill.ts`
- `hooks/game/use-ventilator-drill.ts`
- `hooks/game/use-polypharmacy-drill.ts`

Dependencies: Day 1

**Day 5: Wire ContrastiveDrill + ECG/Derm/Imaging/System drills + fix any remaining hooks**

Mop up any remaining drill components that have answer submission but no FSRS integration.

Dependencies: Day 1

### Week 2: Quality & Feedback (Days 6–9)

**Day 6: Add FSRS feedback to EnhancedFeedbackPanel**

Files to modify:
- `components/drill/EnhancedFeedbackPanel.tsx` — show stability, difficulty, next review date from FSRS response

Dependencies: Week 1 (drills now return FSRS data)

**Day 7: Behavioral data hygiene — duration cap + rapid-guess exclusion**

From `docs/AUDIT_BEHAVIORAL_DATA_HYGIENE.md`:
- Cap effective duration at 60s before computing latency ratio
- Exclude flagged reviews from FSRS optimizer input
- Add `DURATION_CAP_MS` constant

Files to modify:
- `lib/implicit-metrics.ts` — add duration cap
- `lib/services/drillReviewService.ts` — apply cap before FSRS update

**Day 8: ExplanationPanel structured rationale in QuizView**

From `docs/AUDIT_CORE_SESSION_CHECKLIST.md` item 6:
- QuizView renders `currentQuestion.rationale` as a single HTML blob
- `ExplanationPanel` supports structured rationale (whyCorrect, whyIncorrectA/B/C/D)
- Wire structured fields when available, fall back to string

Files to modify:
- `components/session/QuizView.tsx` — pass structured rationale fields to ExplanationPanel
- `components/questions/ExplanationPanel.tsx` — ensure graceful fallback

**Day 9: OSCE AI prompt hardening**

From `docs/AUDIT_CORE_SESSION_CHECKLIST.md` items 3–4:
- Add lay-language instruction to patient simulator
- Add specific-exam-only instruction (no full-exam dumps)

Files to modify:
- `services/ai/geminiService.ts` (or wherever `chatWithPatientSimulator` lives)

### Week 2: Architecture (Day 10)

**Day 10: DrillShell migration for top 5 drills**

Wrap the 5 most-used drill session components in DrillShell for consistent nav:
- PharmDrillSession, DDxDrillSession, ConditionDrillSession, AnatomyDrillSession, ECGDrillSession

### Week 3+: Ongoing (Daily Task handles these)

- Question data normalization (`correctAnswer` vs `answer` vs `correct_option`)
- QuizView decomposition (extract QuestionRenderer, PostAnswerFeedback)
- Content backfill (Gemini batch for missing medical content fields)
- Remaining DrillShell migrations
- Accessibility fixes from audit docs
- Empty state improvements
- Error boundary additions to drill components

---

## What the Daily Scheduled Task Will Handle

After the initial 10-day push, the `panacea-daily-improvement` task (runs 7:02 AM daily) picks up:
- Remaining items from this timeline
- New issues that emerge from the changes above
- Ongoing code quality improvements (TypeScript errors, dead code, test coverage)
- UI/UX polish (empty states, loading states, dark mode consistency, touch targets)
- Accessibility compliance from audit docs

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| FSRS data corruption from new drill submissions | `sessionType: 'drill'` keeps drill data separable; optimizer can filter |
| Breaking existing QuizView flow | QuizView is untouched in Week 1; only drill hooks change |
| Large refactors causing regressions | One hook per commit; typecheck + build gate every push |
| Behavioral metric noise from drills | Duration cap (Day 7) + rapid-guess filtering already in pipeline |
