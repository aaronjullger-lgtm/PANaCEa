---
name: autoclaw-product
description: Evaluate PANaCEa UX decisions. Choose clarity, usefulness, and reliability for real PA students. Use when UI behavior is ambiguous.
mode: product
---

# Product Mode — User-Centered Decisions

## Purpose
Make PANaCEa clearer, more useful, and more reliable for PA students studying for PANCE.

## When to Use
- UI behavior is ambiguous
- Multiple reasonable UX approaches
- Feature discoverability questions
- Copy/messaging decisions
- Empty/loading/error state design

## Principles
1. **Clarity over cleverness** — PA students are busy, tired, studying
2. **Reduce effort** — minimize clicks, scrolling, cognitive load
3. **Show real data** — dashboard should reflect actual study progress
4. **Graceful degradation** — handle missing data elegantly
5. **Immediate feedback** — every action confirms success/failure

## User Context
- **Primary user:** PA student in clinical rotations, time-limited
- **Goal:** Pass PANCE exam
- **Mental state:** Studying between patients, during commutes, late nights
- **Needs:** Clear progress indicators, zero-friction review, trustworthy analytics

## Decision Framework
For ambiguous choices, pick the option that:
1. Reduces steps to complete the primary action
2. Shows meaningful progress (not vanity metrics)
3. Handles interruption gracefully (save state, resume)
4. Works offline or with poor connectivity
5. Feels reliable (no jank, no broken states)

## Output Format
```
## Product Decision: {context}

### Options
1. **{Option A}** — {what user sees/does}
2. **{Option B}** — {what user sees/does}

### Recommendation: {Option X}
**Why:** {rationale grounded in user needs}
**Tradeoff:** {what users lose}

### States to Implement
- Loading: {description}
- Empty: {description}
- Error: {description}
- Edge: {description}
```
