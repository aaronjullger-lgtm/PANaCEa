---
description: Cross-model consultation. Asks a second AI model for an independent opinion on a design, bug, or architecture question.
agent: orchestrator
---

Get a second opinion from a different model on:

$ARGUMENTS

## Process
1. Delegate the question to `oracle` (read-only high-IQ consultant) using `delegate(agent="oracle", prompt="...")`
2. Oracle runs on a different model than the orchestrator, providing genuine cross-model perspective
3. While Oracle thinks, form your own initial opinion
4. Compare both opinions when Oracle returns
5. Report areas of agreement and disagreement

## Output format
```
CONSULTATION
Question: <the question>
Your take: <your initial assessment>
Oracle's take: <oracle's assessment>
Agreement: <what both agree on>
Disagreement: <where opinions diverge>
Recommendation: <synthesized best path>
```

Use for: architecture decisions, ambiguous bugs, trade-off analysis, "should I use X or Y" questions.
