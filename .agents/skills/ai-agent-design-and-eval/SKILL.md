---
name: ai-agent-design-and-eval
description: Use to design, implement, evaluate, and improve task-specific AI agents such as tutors, schedulers, question generators, diagnosis assistants, study-plan generators, or explainers. Trigger when the user asks to build, refine, evaluate, or instrument an AI agent.
---

1. Audit existing AI and agent code, model providers, prompts, tools, function calls, retrieval systems, schemas, traces, evals, and UI integrations.
2. Define each agent's purpose, scope, input schema, output schema, data access, tool permissions, user-facing behavior, fallback behavior, and non-goals before implementation.
3. Add guardrails appropriate to the domain. For educational or clinical contexts, frame outputs as learning support, avoid diagnosis or treatment advice, cite uncertainty, protect privacy, and refuse unsafe requests.
4. Design evaluations before relying on the agent. Create curated examples, edge cases, expected outputs, grading criteria for correctness, helpfulness, safety, formatting, and regression thresholds.
5. Implement the agent using structured inputs and outputs where practical. Prefer typed schemas, explicit tool contracts, constrained tool permissions, and observable execution traces.
6. Add retrieval or tool calling only when it improves reliability. Validate retrieved context, handle missing data, and avoid leaking private or irrelevant records into prompts.
7. Run baseline evaluations and inspect failures. Refine prompts, retrieval, tools, schemas, or product flow based on measured failure modes rather than isolated anecdotes.
8. Integrate the agent into the UI or API with privacy-preserving logging, user feedback collection, loading/error states, and clear boundaries around generated content.
9. Add tests for schemas, tool routing, safety refusals, formatting, and known regression examples. Avoid brittle tests tied to exact free-form phrasing unless formatting is the behavior.
10. Run evals, unit tests, integration tests, lint, typecheck, and build. Document model/provider assumptions and any evals that require credentials.
11. Acceptance criteria: the agent has a defined contract, guardrails, eval coverage, observable traces, privacy-safe logging, and documented limitations.
12. Finish with architecture changes, eval results, failure modes fixed, commands run, residual risks, and the next improvement loop.
