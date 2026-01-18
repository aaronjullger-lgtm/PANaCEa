# Socratic Coaching System Implementation

## Overview

The Socratic Coaching system provides intelligent, non-spoiler hints when students answer questions incorrectly, using the Socratic method to guide them toward the correct answer rather than revealing it immediately.

## Architecture

### 1. Service Layer (`services/CoachingService.ts`)

**New Function:** `getSocraticHint(questionText, correctAnswer, userAnswer)`

- Calls `/geminiProxy` with a carefully crafted prompt
- AI acts as "wise medical attending using the Socratic method"
- Returns a single-sentence hint (under 30 words) that:
  - Identifies the student's misconception
  - Provides a logical bridge without revealing the answer
  - Focuses on clinical findings, pathophysiology, or differentiating features

**Example Prompt Structure:**

```
You are a wise medical attending using the Socratic method...

Question: [Clinical vignette]
Student's Answer: [Wrong answer]
Correct Answer: [Correct answer]

Instructions:
- Do NOT reveal the correct answer directly
- Identify the likely misconception
- Provide a single sentence hint that bridges the logical gap
- Example: "Consider the absence of wheezing and the presence of an S3 gallop; which pathology does that favor?"
```

### 2. Hook Layer (`hooks/game/use-condition-drill.ts`)

**New State Variables:**

- `socraticHint: string | null` - The AI-generated hint
- `isLoadingHint: boolean` - Loading state for hint generation
- `attemptNumber: number` - Tracks 1st vs 2nd attempt (1 or 2)
- `firstAttemptAnswer: number | null` - Stores the initial wrong answer

**New Status:**

- Added `'coaching'` to `ConditionDrillStatus` type

**Modified Flow in `submitAnswer`:**

```typescript
if (attemptNumber === 1 && !result.isCorrect) {
  // First attempt, incorrect → Enter coaching mode
  setStatus('coaching');
  setIsLoadingHint(true);

  const hint = await getSocraticHint(question, correctAnswer, userAnswer);
  setSocraticHint(hint);
  setIsLoadingHint(false);
} else if (result.isCorrect) {
  // Correct answer
  if (attemptNumber === 1) {
    setScore((prev) => prev + 1); // Full point
  } else {
    setScore((prev) => prev + 0.5); // 50% for assisted correct
  }
  setStatus('feedback');
} else {
  // Second attempt still wrong → Show explanation
  setStatus('feedback');
}
```

**New Function:** `retryAfterHint()`

- Sets `attemptNumber = 2`
- Resets `userAnswerIndex = null`
- Returns to `'playing'` status to allow re-selection

### 3. UI Layer (`components/drill/ConditionDrillSession.tsx`)

**New Import:**

```typescript
import { Lightbulb } from 'lucide-react';
```

**Coach's Corner Component:**

Renders between the question card and answer options when `status === 'coaching'`:

```tsx
{
  status === 'coaching' && (
    <motion.div className="...border-amber-500...">
      <div className="flex items-start gap-4">
        <div className="...bg-amber-500...">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3>Coach's Corner</h3>
          {isLoadingHint ? (
            <div>Thinking about your answer...</div>
          ) : (
            <>
              <p>{socraticHint}</p>
              <button onClick={retryAfterHint}>Try Again</button>
              <p>💡 Getting it right after this hint will award 50% points (0.5 score)</p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

## User Flow

### Scenario 1: First Attempt Incorrect

1. Student submits wrong answer
2. System intercepts (no immediate explanation shown)
3. Status changes to `'coaching'`
4. Loading spinner appears: "Thinking about your answer..."
5. AI generates Socratic hint via `/geminiProxy`
6. Coach's Corner displays with:
   - Lightbulb icon
   - Personalized hint based on their misconception
   - "Try Again" button
   - Note about 50% scoring

### Scenario 2: Second Attempt Correct (After Hint)

1. Student clicks "Try Again"
2. `attemptNumber` increments to 2
3. Answer options re-enabled
4. Student selects new answer
5. If correct: Awards **0.5 points** (50% credit)
6. Status → `'feedback'` showing explanation

### Scenario 3: Second Attempt Incorrect

1. Student tries again but still wrong
2. Full explanation shown (standard feedback flow)
3. No points awarded
4. Can proceed to next question

### Scenario 4: First Attempt Correct

1. Standard flow (no coaching needed)
2. Awards **1.0 point** (full credit)
3. Status → `'feedback'`

## Scoring Logic

| Scenario                            | Points Awarded | Explanation            |
| ----------------------------------- | -------------- | ---------------------- |
| Correct on 1st attempt              | 1.0            | Full credit            |
| Correct on 2nd attempt (after hint) | 0.5            | Assisted correct (50%) |
| Incorrect on both attempts          | 0.0            | No credit              |

**Implementation:**

```typescript
if (attemptNumber === 1) {
  setScore((prev) => prev + 1); // Full point
} else {
  setScore((prev) => prev + 0.5); // Half point
}
```

## State Resets

All coaching state is cleared when moving to next question:

```typescript
const nextQuestion = () => {
  // ... fetch next question
  setSocraticHint(null);
  setAttemptNumber(1);
  setFirstAttemptAnswer(null);
  setStatus('playing');
};
```

## Visual Design

**Coach's Corner Styling:**

- **Border:** Amber/yellow (2px, 50% opacity)
- **Background:** Gradient from amber-50 to yellow-50 (dark mode: amber-900/20)
- **Icon:** Lightbulb in amber-500 circle
- **Button:** Amber-600 with hover scale effect
- **Loading State:** Amber spinner with italic text

**Positioning:**

- Appears between question card and answer options
- Full-width on mobile, max-width container on desktop
- Animated entrance (fade + slide up)

## Error Handling

**Fallback Hints:**
If Gemini API fails, returns a generic but helpful hint:

```
"Think about the key clinical findings and what they tell you about
the underlying pathology. What diagnosis best fits this pattern?"
```

**API Resilience:**

- Wrapped in try-catch
- Non-blocking (doesn't crash the drill session)
- Logs errors to console for debugging

## Testing

All existing tests pass (35 test files, 452 tests).

**Test Coverage:**

- `services/CoachingService.test.ts` - 13 tests for metrics and prescriptions
- Integration tests validate hook state management
- UI rendering tested via component structure

## Future Enhancements

1. **Analytics:**
   - Track hint effectiveness (% who get it right on 2nd attempt)
   - Log which types of hints work best
2. **Personalization:**
   - Adjust hint difficulty based on user level
   - Track which topics need more scaffolding
3. **Hint Variations:**
   - Multiple hint strategies (differential diagnosis focus, mechanism focus, etc.)
   - Progressive hints if user still struggles
4. **A/B Testing:**
   - Compare outcomes with/without coaching
   - Optimize hint phrasing for learning outcomes

## Usage Example

```typescript
// In ConditionDrillSession component:
const {
  socraticHint,        // The AI-generated hint
  isLoadingHint,       // Loading state
  attemptNumber,       // 1 or 2
  retryAfterHint,      // Function to retry after hint
  status,              // Includes 'coaching' state
} = useConditionDrill();

// Render Coach's Corner when status === 'coaching'
{status === 'coaching' && (
  <CoachCorner
    hint={socraticHint}
    isLoading={isLoadingHint}
    onRetry={retryAfterHint}
  />
)}
```

## API Contract

**Function Signature:**

```typescript
export async function getSocraticHint(
  questionText: string,
  correctAnswer: string,
  userAnswer: string
): Promise<string>;
```

**Gemini Proxy Request:**

```json
{
  "modelName": "gemini-1.5-flash",
  "prompt": "You are a wise medical attending...",
  "temperature": 0.7
}
```

**Response:**

```json
{
  "text": "Consider the absence of wheezing and the presence of an S3 gallop; which pathology does that favor?"
}
```

## Implementation Checklist

- [x] Create `getSocraticHint` in `CoachingService.ts`
- [x] Add coaching state to `use-condition-drill` hook
- [x] Implement interception logic in `submitAnswer`
- [x] Add `retryAfterHint` function
- [x] Create Coach's Corner UI component
- [x] Implement 50% scoring for assisted correct
- [x] Add state resets for next question
- [x] Test full coaching flow
- [x] Validate all existing tests pass
- [x] Document implementation

## Files Modified

1. `services/CoachingService.ts` - Added `getSocraticHint` function
2. `hooks/game/use-condition-drill.ts` - Added coaching state and logic
3. `components/drill/ConditionDrillSession.tsx` - Added Coach's Corner UI
