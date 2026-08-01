---
name: agent-introspection
description: Four-phase agent self-debugging loop (capture → diagnosis → recovery → report). Use when an agent workflow fails repeatedly, produces wrong results, or degrades in quality over a session.
---

# Agent Introspection Debugging

Adapted from ECC's agent-introspection-debugging skill.

## When to Use

- Agent workflow keeps failing on the same step
- AI-generated output quality degrades mid-session
- An agent loop produces unexpected results
- After a compaction event causes quality drop

## Four-Phase Loop

### Phase 1: Capture

Record what happened:
- What was the input?
- What was the expected output?
- What actually happened?
- What was the agent's reasoning?
- What tools were called and with what parameters?

```markdown
## Capture Log
- Task: Generate 5 CV questions
- Expected: 5 valid MCQs in staging
- Actual: 0 questions generated, Gemini returned empty JSON
- Agent reasoning: "Calling generateBatchForSystem('CV', 5)"
- Tools called: aiGateway.generate(), qualityGate.validate()
- Error: JSON parse failure on Gemini response
```

### Phase 2: Diagnosis

Identify root cause:
- Was the prompt malformed?
- Was the model overloaded/rate-limited?
- Was the JSON parser too strict?
- Was the quality gate blocking valid output?
- Was there a context window issue?

Common diagnoses:
| Symptom | Likely Cause |
|---------|-------------|
| Empty JSON response | Model overloaded, retry needed |
| Malformed JSON | Prompt ambiguity, schema mismatch |
| Wrong format | Missing format instruction in prompt |
| Hallucinated content | RAG context missing or irrelevant |
| Quality gate blocks all | Threshold too strict |

### Phase 3: Recovery

Apply the fix:
- **Prompt fix:** Add explicit format instructions
- **Parser fix:** Add schema repair pass (already in aiGateway)
- **Model fix:** Fall back to different model tier
- **Gate fix:** Relax threshold or disable temporarily
- **Context fix:** Compact and retry with fresh context

### Phase 4: Report

Document what was learned:
```markdown
## Introspection Report
- Root cause: Gemini response had trailing markdown fence
- Fix applied: Enhanced JSON parser to strip ```json fences
- Prevention: Added test case for fenced JSON
- Pattern: Always strip markdown fences before JSON.parse
```

## PANaCEa-Specific Applications

### Question Generation Pipeline
- Capture: What system, count, and prompt was used
- Diagnose: Was it a prompt issue, model issue, or parser issue
- Recover: Retry with adjusted prompt or different model tier
- Report: Add to learnings.md

### FSRS Submission Pipeline
- Capture: What telemetry was collected, what rating was derived
- Diagnose: Was the implicit metric calculation correct
- Recover: Fix the metric or add missing signal
- Report: Update drillReviewService comments

### OSCE Grading
- Capture: What was the student response, what was the expected
- Diagnose: Was the rubric applied correctly
- Recover: Adjust rubric weights or add missing criteria
- Report: Update OSCE skill configuration
