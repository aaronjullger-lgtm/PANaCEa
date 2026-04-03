# Second Chance Review System — Architecture Design

## Status: Implementation Plan (2026-04-02)

---

## 1. Entity Granularity Analysis

### What's too coarse
`UserProgress(userId, conditionId)` — treats "Atrial Fibrillation" as one monolithic unit. If you ace pharmacology (rate-control vs rhythm-control) but fail diagnosis (irregularly irregular rhythm + absent P waves), both collapse into a single 75% accuracy figure. The system cannot schedule the weak dimension independently.

### What's too fine
Individual `Card(userId, questionId)` — leads to **recognition** (memorizing that "the question about the 68-year-old with palpitations" = AFib) rather than **transfer** (knowing that irregularly irregular rhythm + absent P waves = AFib regardless of patient demographics or stem phrasing).

### The right middle layer: Learning Targets
**`UserTopicProgress(userId, conditionId, taskType)`** — ALREADY EXISTS in the schema and is being written to by `drillReviewService.ts` but is NOT read from by the session generator.

This compound key gives us entities like:
- `(atrial-fibrillation, diagnosis)` — can you identify AFib from a novel presentation?
- `(atrial-fibrillation, treatment)` — do you know rate-control vs rhythm-control?
- `(atrial-fibrillation, mechanism)` — do you understand reentrant circuits / pulmonary vein foci?
- `(atrial-fibrillation, workup)` — can you order the right tests (TTE, TSH, CHA₂DS₂-VASc)?

This maps directly to the PANCE blueprint:
| Blueprint Dimension | Maps To |
|---|---|
| System (CV, PULM, ...) | `Condition.system` |
| Condition | `conditionId` |
| Task Area (diagnosis, pharmaceutical, ...) | `taskType` |
| Cognitive Level (1st/2nd/3rd order) | `PreGeneratedQuestion.questionOrder` |

### Why this works
- **8 task types × ~500 conditions = ~4,000 learning targets** — manageable per student
- Matches NCCPA blueprint structure (system × task × condition)
- Already has FSRS fields (stability, difficulty, state, reps, lapses, nextReviewDate)
- Has `variantsUsed: String[]` for tracking which questions were shown
- Indexed on `(userId, nextReviewDate)` for efficient due queries

---

## 2. Second Chance System Design

### Core Concept
When a learning target is due for review, the system:
1. Identifies the *weakest subdomain* within the condition (not just the condition itself)
2. Selects a question targeting that specific subdomain
3. Prefers a **variant** the student hasn't seen before (different stem/distractors/context)
4. Detects **recognition risk** (same question seen within last 3 reviews) and forces a variant
5. Logs which variant was shown and which learning target was updated

### Recognition Risk Detection
A student has "recognition risk" when:
- They've seen the exact same question within their last 3 reviews of this condition
- Their `Card(userId, questionId).reps >= 3` but `UserTopicProgress` stability is low
- Their response time is suspiciously fast relative to question complexity

When recognition risk is high → force a Second Chance variant.

### Variant Selection Priority
1. **Existing unused variant** matching the target taskType (from `QuestionVariant` table)
2. **Different PreGeneratedQuestion** for the same condition + taskType
3. **Same condition, different taskType** — if no variant exists for the weak taskType
4. **Canonical question** — fallback when no variant exists at all

---

## 3. What Changes

### A. New file: `lib/services/secondChanceEngine.ts`
The core engine with these exports:
- `resolveLearningTarget(userId, conditionId)` — returns the weakest subdomain
- `selectSecondChanceQuestion(userId, conditionId, taskType)` — picks a variant
- `detectRecognitionRisk(userId, questionId)` — returns risk score 0-1
- `mapQuestionToLearningTarget(question)` — resolves question → (conditionId, taskType)

### B. New file: `lib/services/blueprintMappingService.ts`
Exam blueprint abstraction:
- `ExamBlueprint` interface with system weights, task weights, condition lists
- `PANCE_BLUEPRINT`, `PANRE_BLUEPRINT`, `PEAE_BLUEPRINT` constants
- `mapLearningTargetToBlueprint(conditionId, taskType, examType)` — returns blueprint cell
- `getWeakBlueprintCells(userId, examType)` — returns sorted weak areas

### C. Modified: `lib/services/conceptQuestionSelector.ts`
- `fetchDueReviews()` now queries `UserTopicProgress` instead of only `UserProgress`
- Due reviews are fetched at the *subdomain* level (condition + taskType)
- Question selection targets the specific weak taskType
- Recognition risk check before serving a question

### D. Modified: `lib/services/drillReviewService.ts`
- After computing FSRS update, writes to `UserTopicProgress` with the question's resolved taskType
- Logs `taskType`, `isVariant`, `isSecondChance`, `recognitionRisk` in ReviewLog telemetry
- Updates `variantsUsed[]` on UserTopicProgress

### E. New file: `lib/services/recognitionRiskDetector.ts`
- Analyzes review history for recognition patterns
- Fast response time + high accuracy + same question = flag
- Feeds into variant selection logic

---

## 4. PANCE / PANRE / PEAE Blueprint Mapping

### Blueprint Structure
```
ExamBlueprint {
  examType: 'PANCE' | 'PANRE' | 'PEAE'
  systemWeights: Record<string, number>     // CV: 0.11, PULM: 0.09, ...
  taskWeights: Record<string, number>       // diagnosis: 0.18, pharmaceutical: 0.15, ...
  conditionsBySystem: Record<string, string[]>  // CV: ['atrial-fibrillation', ...]
}
```

### How Learning Targets Map
```
LearningTarget = (conditionId, taskType)
BlueprintCell = (system, taskCategory, conditionId)

Mapping:
  conditionId → Condition.system → BlueprintCell.system
  taskType → nearest taskCategory mapping → BlueprintCell.taskCategory

Example:
  LearningTarget('atrial-fibrillation', 'treatment')
  → BlueprintCell('CV', 'pharmaceutical', 'atrial-fibrillation')
```

### Task Type → PANCE Task Category Mapping
| Internal TaskType | PANCE taskCategory |
|---|---|
| diagnosis | diagnosis |
| treatment | clinical_intervention + pharmaceutical |
| mechanism | basic_science |
| workup | diagnostic_lab |
| prevention | health_maintenance |
| prognosis | diagnosis (prognosis is part of dx reasoning) |
| complication | clinical_intervention |
| clinical_pearl | (maps to strongest associated task) |

---

## 5. Data Flow

### Before (current):
```
Due review → UserProgress(conditionId) → pick least-seen question → show → update UserProgress
```

### After (Second Chance):
```
Due review → UserTopicProgress(conditionId, taskType) → resolve weakest subdomain
  → check recognition risk for available questions
  → select variant targeting weak subdomain
  → show → update UserTopicProgress + UserProgress + ReviewLog
  → log variant_shown, learning_target, recognition_risk, is_second_chance
```

---

## 6. Safety / Fallback Behavior

1. **No UserTopicProgress exists** → fall back to UserProgress (condition-level scheduling)
2. **No variant exists for target taskType** → use canonical question, still update topic progress
3. **Task type inference fails** → default to 'diagnosis', log the gap
4. **Blueprint mapping missing for condition** → skip blueprint weighting, use FSRS schedule only
5. **Recognition risk detector has insufficient data** → return risk=0 (no intervention)
6. **All variants exhausted for a condition** → re-use least-recently-seen, log "variant_exhausted"

---

## 7. What We Do NOT Change

- FSRS v6 algorithm itself (lib/fsrs.ts) — untouched
- Confidence pipeline v3 — untouched (still applies to all reviews)
- Sibling propagation (KAR3L) — still works at condition level
- Session UI — questions render identically
- Existing card-level tracking — `Card` table continues as dual-write
