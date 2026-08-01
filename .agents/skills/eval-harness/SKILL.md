---
name: eval-harness
description: Eval-driven development framework for PANaCEa AI features. Define capability evals, regression evals, and pass@k metrics for question generation, AI tutoring, OSCE grading, and Ghost Grader. Use when adding new AI features, tuning prompts, or verifying model upgrades.
---

# Eval Harness

Adapted from ECC's eval-harness skill for PANaCEa's AI-heavy workloads.

## When to Use

- Adding a new AI feature (question gen, tutoring, OSCE)
- Tuning prompts or model parameters
- Upgrading Gemini model versions
- Verifying Ghost Grader accuracy
- Before shipping AI-dependent features

## Eval Types

### 1. Capability Evals

Test what the AI **can do**:
- Generate a valid MCQ for a given organ system
- Produce a clinically accurate differential diagnosis
- Grade an OSCE response correctly
- Generate a question at the right Bloom's level

### 2. Regression Evals

Test that changes **don't break** existing behavior:
- Question format still valid after prompt change
- FSRS scheduling unchanged after pipeline edit
- Clinical accuracy maintained after model upgrade

### 3. Pass@k Metrics

Generate k responses, check if at least one passes:
- `pass@1`: Single attempt must be correct
- `pass@3`: One of 3 attempts must be correct
- `pass@5`: One of 5 attempts must be correct

## PANaCEa Eval Domains

| Domain | What to Eval | Key Metric |
|--------|-------------|------------|
| Question Generation | Format validity, clinical accuracy, blueprint alignment | pass@1 format, pass@3 accuracy |
| AI Tutor | Correct explanations, appropriate scope | pass@1 accuracy |
| OSCE Grading | Rubric adherence, fair scoring | inter-rater agreement |
| Ghost Grader | Behavioral rating accuracy vs expert | correlation > 0.7 |
| Content Enrichment | Condition/drug data accuracy | pass@1 accuracy |

## Building an Eval

### Step 1: Define the Task

```typescript
interface EvalTask {
  name: string;
  domain: 'question-gen' | 'tutor' | 'osce' | 'ghost-grader' | 'content';
  input: Record<string, unknown>;
  expected?: Record<string, unknown>; // for deterministic checks
  grader?: 'exact-match' | 'clinical-accuracy' | 'format-valid' | 'llm-judge';
}
```

### Step 2: Create Test Cases

Use real production data (sanitized):
- 10-20 golden examples per domain
- Include edge cases (rare conditions, ambiguous presentations)
- Include negative cases (what should NOT be generated)

### Step 3: Choose a Grader

| Grader | When to Use |
|--------|------------|
| `exact-match` | Deterministic outputs (format, structure) |
| `clinical-accuracy` | Medical content (requires expert or LLM judge) |
| `format-valid` | JSON schema validation, Zod parse |
| `llm-judge` | Subjective quality (use Gemini as judge) |

### Step 4: Run and Score

```bash
# Run eval locally
npx tsx scripts/run-eval.ts --domain question-gen --k 3

# Output
# Domain: question-gen
# Total tasks: 20
# Pass@1: 85% (17/20)
# Pass@3: 95% (19/20)
# Failures: 1 format error, 0 accuracy errors
```

## Langfuse Integration

Evals can be tracked in Langfuse:
- Each eval run = a Langfuse dataset execution
- Each task = a dataset example
- Scores sync to Langfuse for trend tracking

## Regression Gate

Before merging AI changes:
1. Run capability evals on new feature
2. Run regression evals on existing features
3. Pass@1 must not decrease by more than 5%
4. No new critical failures introduced
