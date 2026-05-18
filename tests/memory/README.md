# Memory Test Plan

This directory is reserved for focused memory-system tests. Do not add tests that require production data or real user records.

Recommended files:

- `test_retrieval.ts`: vector/keyword retrieval, metadata filters, citations, no-context failure.
- `test_graph_memory.ts`: graph edge types, entity/relation extraction fixtures, traversal direction, path weights.
- `test_tabular_memory.ts`: learner-state queries, tenant isolation, cache expiry/deletion.
- `test_memory_safety.ts`: prompt-injection fixtures, memory poisoning, PII/log redaction, external cache deletion.

Fixture rules:

- Use synthetic medical content or approved public content.
- Never include production learner identifiers.
- Prefer deterministic seeded Prisma fixtures.
- Mock Gemini and external services unless running an explicit integration profile.
- Keep golden-query expectations in `evals/memory/golden_queries.yaml`.
