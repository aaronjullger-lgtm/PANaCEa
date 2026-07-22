# Learner Agent Evaluations

Repeatable evaluation suite for recommendation faithfulness, grounding, and safety.

## Baseline procedure

Run before changing `LEARNER_AGENT_SYSTEM_PROMPT` or NBA weights.

```bash
npm test -- tests/learner-agent
```

## Evaluation dimensions

| Dimension | Test / method | Pass criteria |
|-----------|---------------|---------------|
| Recommendation faithfulness | `surgeryRotationFixture` + `learnerNextActionService.test.ts` | Overdue FSRS ranks first for surgery rotation fixture |
| No FSRS in model path | `learnerEngineBoundary.test.ts` | NBA service has no LLM imports |
| Tool category boundary | `learnerEngineBoundary.test.ts` | NBA tool is `compute`; `record_attempt` is `canonical_write` |
| Memory persistence | `memoryStore.test.ts` | Confirmed/pending memories in Postgres customSettings |
| Attempt pipeline | `recordAttempt.test.ts` | Delegates to submitDrillReview with idempotency |
| API flow | `recommendationSessionFlow.test.ts` | Recommendation → idempotent session start |
| Run grounding | `runGroundingEval.test.ts` | Run endpoint wires memories + canonical_write tools |
| Memory confirmation | `memoryPolicy.test.ts` | Inferred schedule requires confirmation |
| Log redaction | `security.test.ts` | Secrets redacted |
| Prompt injection awareness | `security.test.ts` | Untrusted wrapper pattern documented |
| Missing school data | Manual / future eval script | Agent must refuse invented assignment dates |
| Session recovery | Worker integration (staging) | DO restores `pendingRecommendation` on reconnect |

## Surgery rotation scenario

Fixture: `tests/learner-agent/surgeryRotationFixture.ts`

Balances:

- 12 overdue FSRS reviews
- Surgery rotation (GI/CV/MSK scope)
- Assignment due within 24h
- 40 available minutes
- Targeted-heavy allocator

**Expected primary action:** `nba:fsrs_overdue:*` (deterministic score 112 > plan task 100)

## Future automated evals (Sprint 2)

- LLM judge on `POST /api/learner-agent/run` — recommendation text must cite tool output fields
- Grounding: `retrieve_grounded_content` citations present in explanations
- Consistency: same context → same `getNextBestAction` id

## Recording baselines

```bash
npm test -- tests/learner-agent 2>&1 | tee docs/evaluations/baselines/learner-agent-$(date +%Y%m%d).log
```

## CI integration

Add to `agent-verify.yml` or dedicated workflow:

```yaml
- run: npm test -- tests/learner-agent
```
