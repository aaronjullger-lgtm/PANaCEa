# Interleaver Upgrade Implementation Plan

> **Status:** APPROVED  
> **Created:** 2026-01-14  
> **Target File:** `lib/services/mainSessionQuestionSelector.ts`  
> **Related Files:** `lib/sessionInterleaving.ts` (to be deprecated), `scripts/test-selector.ts`

## Executive Summary

This plan upgrades the question selection algorithm from a simple "Priority Waterfall" to a scientifically rigorous **"Interleaved Assembler"** that strictly enforces:

1. **Never showing the same organ system twice in a row** (strict interleaving)
2. **Prioritizing the hardest "safe" cards** (Desirable Difficulty via Lowest-R selection)

---

## 1. The Problem with Current Implementation

### 1.1 Current Code Issues

**File:** `lib/services/mainSessionQuestionSelector.ts`

#### Issue 1: Weak Interleaving Check (Lines 100-105)
```typescript
// CURRENT: Only checks if LAST N questions are ALL the same system
private wouldViolateInterleaving(selected: SelectedQuestion[], newSystem: string): boolean {
  if (selected.length < MAX_CONSECUTIVE_SAME_SYSTEM) return false;
  const lastN = selected.slice(-MAX_CONSECUTIVE_SAME_SYSTEM);
  return lastN.every(q => q.system === newSystem);
}
// ❌ PROBLEM: Allows sequences like [Cardio, Pulm, Cardio, Cardio]
```

#### Issue 2: No Per-System Cap
A high deficit can force 10+ questions from one system, making interleaving **mathematically impossible**.

#### Issue 3: Random Fallback
When no overdue cards exist for a deficit system, the current code falls through to `selectPriorityC()` which picks **random** unseen questions instead of the "riskiest stable" cards.

### 1.2 Why This Matters (Learning Science)

**Blocked Practice (AAAA-BBBB-CCCC):**
- Creates "Illusion of Competence" - short-term fluency increases but long-term retention suffers
- Brain stops fully retrieving schema for questions 2-5 because it's already in working memory
- Reduces "Contextual Interference" necessary for deep encoding

**Interleaved Practice (ABC-ABC-ABC):**
- Forces brain to reload context for every question
- Higher initial difficulty but significantly better long-term retention
- Research shows 43% better delayed recall vs. blocked practice

---

## 2. Phase 1: The Gathering Phase (Selection)

### 2.1 Constraint 1: The 8-Question Cap (40% Rule)

#### Mathematical Justification

For **strict interleaving** (no two adjacent same-system), we must ensure no single system exceeds `ceil(n/2)` questions where `n` is session size.

For a 20-question session:
- **Mathematical maximum:** `ceil(20/2) = 10`
- **Safe cap:** `8 questions (40%)` - provides safety buffer for edge cases

#### Implementation

```typescript
// lib/services/mainSessionQuestionSelector.ts

/** Maximum questions from a single system (40% of 20 = 8) */
export const MAX_SINGLE_SYSTEM_CAP = 8;

function calculateSystemQuotas(
  deficits: SystemDeficit[], 
  sessionSize: number
): Map<string, number> {
  const quotas = new Map<string, number>();
  
  for (const deficit of deficits) {
    // Calculate ideal slots based on deficit
    const idealSlots = Math.ceil((deficit.deficitPercent / 100) * sessionSize);
    
    // STRICT CAP: Never exceed 8 questions per system
    const cappedSlots = Math.min(idealSlots, MAX_SINGLE_SYSTEM_CAP);
    
    quotas.set(deficit.system, cappedSlots);
  }
  
  return quotas;
}
```

**No database changes required** - this is pure algorithm logic.

---

### 2.2 Constraint 2: The Lowest-Retrievability Fallback

#### The Problem

When no FSRS overdue cards exist for a deficit system, we need to fill the quota. Current behavior picks random unseen questions, which violates the "Desirable Difficulty" principle.

#### The Solution: Query Stable Cards by Lowest R

**APPROVED APPROACH:** Compute Retrievability (R) inside the database using `Prisma.$queryRaw`.

**Why SQL, not TypeScript:**
- Computing R in TypeScript requires fetching ALL user cards, deserializing JSON, computing R for each, then sorting
- For 2,000+ cards, this will timeout Cloudflare Functions
- SQL handles sorting before data transfer, returning only top N rows

#### SQL Implementation (FSRS v5 Formula)

```typescript
/**
 * Select stable (non-overdue) cards sorted by lowest retrievability.
 * FSRS v5 formula: R = (1 + t/S)^-1 where t = elapsed days, S = stability
 */
async selectStableCardsByLowestRetrievability(
  userId: string,
  system: string,
  excludeIds: string[],
  limit: number
): Promise<SelectedQuestion[]> {
  const results = await this.prisma.$queryRaw<Array<{
    id: string;
    conditionId: string;
    system: string;
    current_r: number;
  }>>`
    SELECT 
      up.id,
      up."conditionId",
      mc.system,
      -- FSRS v5: R = (1 + elapsed_days / stability)^-1
      POWER(
        1 + (
          EXTRACT(EPOCH FROM (NOW() - (up."fsrsCard"->>'last_review')::timestamp)) 
          / 86400.0  -- Convert seconds to days
        ) / GREATEST(COALESCE((up."fsrsCard"->>'stability')::float, 1.0), 0.1),
        -1
      ) as current_r
    FROM "UserProgress" up
    JOIN "MedicalContent" mc ON up."conditionId" = mc."conditionId"
    WHERE up."userId" = ${userId}
      AND mc.system = ${system}
      AND up."nextReviewAt" > NOW()  -- NOT overdue (stable)
      ${excludeIds.length > 0 ? Prisma.sql`AND up.id NOT IN (${Prisma.join(excludeIds)})` : Prisma.empty}
    ORDER BY current_r ASC  -- Lowest retrievability first (hardest safe cards)
    LIMIT ${limit}
  `;
  
  return results.map(r => ({
    questionId: r.id, // Will map to actual question in next step
    conditionId: r.conditionId,
    system: normalizeSystemName(r.system),
    priority: 'A' as const,
    source: 'fsrs_stable_lowest_r' as const,
    retrievability: r.current_r,
  }));
}
```

#### Desirable Difficulty Rationale

| Card | Retrievability | Last Seen | Selection Priority |
|------|---------------|-----------|-------------------|
| A | R = 0.98 | Yesterday | ❌ Too easy |
| B | R = 0.91 | 4 months ago | ✅ "Edge of forgetting" |
| C | R = 0.85 | 6 months ago | ✅ High priority |

Both B and C are "stable" (not overdue), but they're at the edge of the forgetting threshold. Retrieving these strengthens memory more than easy R=0.98 cards.

---

## 3. Phase 2: The Ordering Phase (Assembly)

### 3.1 The Constraint-Satisfaction Algorithm

**Concept:** Think of each system as a "color". We need to arrange colored balls so **no two adjacent balls have the same color**.

#### Algorithm: Largest-First Greedy

```typescript
interface SystemPool {
  system: string;
  questions: SelectedQuestion[];
}

/**
 * Assemble questions ensuring no two adjacent have the same system.
 * Uses "Largest-First Greedy" to handle hardest constraints first.
 */
function assembleInterleavedSession(
  pools: Map<string, SelectedQuestion[]>
): { questions: SelectedQuestion[]; violations: InterleavingViolation[] } {
  const result: SelectedQuestion[] = [];
  const violations: InterleavingViolation[] = [];
  
  // Step 1: Track which system was placed last
  let lastPlacedSystem: string | null = null;
  
  // Step 2: Iteratively pick questions
  while (hasQuestionsRemaining(pools)) {
    // Sort systems by remaining pool size (LARGEST FIRST)
    // This ensures we handle the hardest constraints first
    const currentOrder = [...pools.entries()]
      .filter(([_, questions]) => questions.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([system]) => system);
    
    let placed = false;
    
    for (const system of currentOrder) {
      // STRICT RULE: Cannot pick same system as last placed
      if (system !== lastPlacedSystem) {
        const question = pools.get(system)!.shift()!;
        result.push(question);
        lastPlacedSystem = system;
        placed = true;
        break;
      }
    }
    
    // CORNER CASE: Forced to repeat (only one system has questions left)
    if (!placed && currentOrder.length > 0) {
      const forcedSystem = currentOrder[0];
      const question = pools.get(forcedSystem)!.shift()!;
      result.push(question);
      lastPlacedSystem = forcedSystem;
      
      // LOG WARNING (Permissive Mode - don't crash)
      violations.push({
        position: result.length - 1,
        system: forcedSystem,
        reason: 'only_system_remaining',
      });
      
      console.warn(
        `[Interleaver] FORCED REPEAT: ${forcedSystem} at position ${result.length}`
      );
    }
  }
  
  return { questions: result, violations };
}

function hasQuestionsRemaining(pools: Map<string, SelectedQuestion[]>): boolean {
  return [...pools.values()].some(arr => arr.length > 0);
}
```

#### Why Largest-First?

Consider this scenario:
- Pool: `{ Cardio: 8, Pulm: 4, GI: 4, MSK: 4 }` (Total: 20)

**Bad approach (random order):**
```
Pulm-GI-MSK-Pulm-GI-MSK-Pulm-GI-MSK-Pulm-GI-MSK → 8 Cardio stuck at end!
```

**Good approach (largest first):**
```
Cardio-Pulm-Cardio-GI-Cardio-MSK-Cardio-Pulm-Cardio-GI-Cardio-MSK-Cardio-Pulm-Cardio-GI-Cardio-MSK-Pulm-GI
```

By distributing Cardio throughout (odd positions), we guarantee perfect interleaving.

---

### 3.2 Corner Case: Forced Repeat Handling

#### APPROVED DECISION: Warning Only (Permissive Mode)

**Rationale:**
- A system crash harms user trust more than a single blocked pair
- In "Cold Start" scenarios (users < 50 questions) or filtered decks, perfect interleaving may be mathematically impossible
- Maintains the "Zero-Friction" principle

#### Implementation

```typescript
interface InterleavingViolation {
  position: number;
  system: string;
  reason: 'only_system_remaining' | 'pool_exhausted' | 'cold_start';
}

interface SessionGenerationResult {
  questionIds: string[];
  questions: SelectedQuestion[];
  deficitsAddressed: SystemDeficit[];
  priorityBreakdown: {
    A: number;
    B: number;
    C: number;
  };
  interleavingEnforced: boolean;
  
  // NEW: Track any forced violations
  interleavingViolations: InterleavingViolation[];
}
```

**Telemetry:** Log `forced_repeat_warning` events for monitoring but return the session to the user.

---

## 4. Deprecation: `lib/sessionInterleaving.ts`

### APPROVED DECISION: Delete and Consolidate

**Rationale:**
Interleaving is not a "post-processing" effect—it's a **selection constraint**.

**Current Problem:**
If we separate Selection from Interleaving, the Selector might fetch 20 "Cardiology" questions (because they're all due), then hand a block to the Interleaver that's **impossible to interleave**.

**Solution:**
The new `MainSessionQuestionSelector` acts as a "Constraint-Satisfaction Assembler" that **simultaneously** respects:
1. Blueprint Quota (Selection)
2. System Variance (Ordering)

#### Migration Steps

1. Move the `ensureInterleaving()` logic directly into `assembleInterleavedSession()`
2. Keep validation utilities (`findInterleavingViolations`, `getInterleavingMetrics`) as internal helpers
3. Delete `lib/sessionInterleaving.ts`
4. Update any imports that reference the deleted file

---

## 5. Verification Strategy

### 5.1 New Test Case: High-Deficit Scenario

Add to `scripts/test-selector.ts`:

```typescript
/**
 * TEST: Force 8 Cardio questions and verify NO adjacency violations
 */
async function testHighDeficitInterleaving(): Promise<void> {
  printSubheader('TEST: High-Deficit Interleaving (8 Cardio)');
  
  // Scenario: User needs 8 Cardio, 4 Pulm, 4 GI, 4 MSK
  const mockPools = new Map<string, MockQuestion[]>([
    ['Cardiovascular', createMockQuestions('Cardiovascular', 8)],
    ['Pulmonary', createMockQuestions('Pulmonary', 4)],
    ['Gastrointestinal', createMockQuestions('Gastrointestinal', 4)],
    ['Musculoskeletal', createMockQuestions('Musculoskeletal', 4)],
  ]);
  
  const { questions, violations } = assembleInterleavedSession(mockPools);
  
  // ASSERTION 1: No two adjacent questions have the same system
  let adjacentViolations = 0;
  for (let i = 1; i < questions.length; i++) {
    if (questions[i].system === questions[i - 1].system) {
      adjacentViolations++;
      console.log(colorize(
        `  ✗ VIOLATION at position ${i}: ${questions[i - 1].system} → ${questions[i].system}`,
        'red'
      ));
    }
  }
  
  // Print sequence for visual verification
  console.log('\n  Session sequence:');
  console.log('  ' + questions.map(q => q.system.substring(0, 4)).join(' → '));
  
  // ASSERTION 2: Algorithm detected same violations
  console.log(`\n  Algorithm-reported violations: ${violations.length}`);
  
  if (adjacentViolations === 0) {
    console.log(colorize('\n  ✓ PASS: Zero adjacent same-system questions', 'green'));
  } else {
    console.log(colorize(`\n  ✗ FAIL: ${adjacentViolations} adjacency violations`, 'red'));
    throw new Error('Interleaving test failed');
  }
}

function createMockQuestions(system: string, count: number): MockQuestion[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      questionId: `${system.toLowerCase()}-${i}`,
      conditionId: `condition-${system.toLowerCase()}-${i}`,
      system,
      priority: 'A' as const,
      source: 'test' as const,
    }));
}
```

### 5.2 Additional Test Cases

| Test Name | Input | Expected |
|-----------|-------|----------|
| Single System Dominance | 8 Cardio, 1 Pulm, 1 GI | Minimal forced repeats, logged |
| Equal Distribution | 5 each of 4 systems | Perfect interleaving, 0 violations |
| Two Systems Only | 10 Cardio, 10 Pulm | Alternating pattern |
| Cold Start | 3 Cardio only | Graceful handling, warning logged |

---

## 6. Implementation Checklist

| Step | Description | File | Priority |
|------|-------------|------|----------|
| 1 | Add `MAX_SINGLE_SYSTEM_CAP = 8` constant | `mainSessionQuestionSelector.ts` | P0 |
| 2 | Modify `calculateSystemDeficits()` to apply cap | `mainSessionQuestionSelector.ts` | P0 |
| 3 | Add `selectStableCardsByLowestRetrievability()` with SQL | `mainSessionQuestionSelector.ts` | P0 |
| 4 | Implement `assembleInterleavedSession()` function | `mainSessionQuestionSelector.ts` | P0 |
| 5 | Add `InterleavingViolation` type and tracking | `mainSessionQuestionSelector.ts` | P0 |
| 6 | Update `SessionGenerationResult` interface | `mainSessionQuestionSelector.ts` | P1 |
| 7 | Delete `lib/sessionInterleaving.ts` | - | P1 |
| 8 | Update imports in any files using old interleaving | Various | P1 |
| 9 | Add `testHighDeficitInterleaving()` test | `scripts/test-selector.ts` | P1 |
| 10 | Add telemetry for forced repeats | `mainSessionQuestionSelector.ts` | P2 |

---

## 7. Success Metrics

### 7.1 Test Command

```bash
npx tsx scripts/test-selector.ts
```

### 7.2 Expected Output

```
======================================================================
  MAIN SESSION QUESTION SELECTOR - VERIFICATION TEST (v2.0)
======================================================================

✓ PASS: System cap enforced (max 8 per system)
✓ PASS: Lowest-R fallback used for stable cards (SQL query)
✓ PASS: Zero adjacent same-system questions
✓ PASS: High-deficit scenario (8 Cardio) successfully interleaved

Interleaving Quality Report:
  Total Questions: 20
  Unique Systems: 4
  Max Consecutive (Same System): 1  ← Target: 1
  Violations: 0

======================================================================
  Interleaved Assembler working correctly!
======================================================================
```

---

## 8. Rollback Plan

If issues arise in production:

1. **Immediate:** Set `USE_LEGACY_INTERLEAVING = true` flag to bypass new algorithm
2. **Short-term:** Restore `lib/sessionInterleaving.ts` from git history
3. **Long-term:** Debug with detailed logs and fix specific edge cases

---

## Appendix A: FSRS v5 Retrievability Formula

```
R(t) = (1 + t/S)^(-1)

Where:
- R = Retrievability (probability of successful recall, 0-1)
- t = Elapsed time since last review (days)
- S = Stability (time for R to decay to ~37%)
```

**Example:**
- Card reviewed 30 days ago with Stability = 60 days
- R = (1 + 30/60)^(-1) = (1.5)^(-1) = 0.667 (67% recall probability)

---

## Appendix B: References

1. **Interleaving Research:** Rohrer, D. (2012). "Interleaving helps students distinguish among similar concepts"
2. **FSRS Algorithm:** https://github.com/open-spaced-repetition/fsrs4anki
3. **Desirable Difficulty:** Bjork, R. A. (1994). "Memory and metamemory considerations in the training of human beings"
4. **PANaCEa Architecture:** `.clinerules` - Database-First, FSRS v5, Cloudflare Functions
