---
name: continuous-learning-v2
description: Instinct-based learning system. Extracts reusable patterns from completed sessions and stores them as confidence-scored instincts. Use at session end, when Aaron says "learn from this", or when the same problem is solved repeatedly.
---

# Continuous Learning v2

Adapted from ECC's continuous-learning-v2 skill. Turns session wins into reusable knowledge.

## When to Use

- End of a substantive session (before /wrap-up)
- When Aaron says "learn from this", "remember this", "save this pattern"
- When the same type of problem has been solved 3+ times
- After discovering a non-obvious solution or workaround

## How It Works

1. **Capture**: At session end, review what was accomplished
2. **Extract**: Identify reusable patterns, gotchas, and decisions
3. **Score**: Assign confidence (0.0-1.0) based on evidence
4. **Store**: Write to `.opencode/knowledge/learnings.md` and memory MCP
5. **Recall**: Future sessions load relevant instincts via SessionStart

## Instinct Format

```markdown
### [INSTINCT] <pattern-name>

**Confidence:** 0.85
**Evidence:** Solved 3 times successfully, failed 0 times
**Context:** PANaCEa Edge functions, Prisma lifecycle
**Pattern:** Always wrap Prisma queries in try/finally with safePrismaDisconnect
**Anti-pattern:** Forgetting safePrismaDisconnect causes connection pool exhaustion
**Examples:**
- functions/api/questions/attempt.ts — correct pattern
- functions/api/drills/submit-review.ts — correct pattern
```

## Extraction Process

### Step 1: Session Review

Ask:
- What problems did we solve?
- What took multiple attempts to get right?
- What did we learn that isn't in the docs?
- What mistakes did we make and correct?

### Step 2: Pattern Identification

Look for:
- **Code patterns** — solutions that worked (e.g., D1 cache pattern)
- **Gotchas** — things that broke unexpectedly (e.g., OOM on full tsc)
- **Decisions** — forks we chose and why (e.g., binary FSRS only)
- **Workflows** — multi-step processes that succeeded (e.g., migration resolution)

### Step 3: Confidence Scoring

| Confidence | Criteria |
|------------|----------|
| 0.9+ | Verified 3+ times, has tests, documented |
| 0.7-0.9 | Worked reliably 2+ times, some evidence |
| 0.5-0.7 | Worked once, plausible but unverified |
| <0.5 | Hypothesis, needs more evidence |

### Step 4: Storage

Write instincts to:
1. `.opencode/knowledge/learnings.md` — session learnings log
2. Memory MCP (`memory_add_observations`) — for cross-session recall
3. Skill files — if the pattern is general enough to be a skill

## Recall

Relevant instincts are surfaced at session start via:
- `.opencode/knowledge/learnings.md` (always loaded)
- Memory MCP search (when relevant keywords match)
- Skill trigger descriptions (when task matches skill scope)

## PANaCEa-Specific Instincts to Maintain

- FSRS binary-only constraint (confidence: 1.0)
- Edge runtime process.env ban (confidence: 1.0)
- Prisma-in-frontend ban (confidence: 1.0)
- safePrismaDisconnect in finally blocks (confidence: 0.95)
- D1 cache pattern for read-heavy endpoints (confidence: 0.8)
- Quality gate opt-in via ENABLE_QUALITY_GATE (confidence: 0.7)
- Scoped typecheck instead of full tsc (confidence: 0.9)
