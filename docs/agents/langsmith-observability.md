# LangSmith Observability — PANaCEa Agent Monitoring

> **Date:** 2026-07-31 | **Status:** Configuration documented, ready for deployment

---

## Overview

This document describes the LangSmith observability configuration for PANaCEa's agent infrastructure. LangSmith provides full visibility into agent behavior: individual traces, performance dashboards, automated alerts, and online evaluations.

PANaCEa already has LangSmith tracing enabled (via `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY`). This document adds the **dashboard, alert, and evaluation** layers.

---

## 1. Current Tracing Coverage

| System | Tracing | Notes |
|--------|---------|-------|
| `lib/langchain/` | ✅ LangSmith auto-instrumentation | All LangGraph graphs, chains, and agents |
| `lib/agents/` | ✅ Langfuse CallbackHandler | Edge-side agents via `invokeWithTracing` |
| `packages/agent-orchestrator/` | ✅ Langfuse + LangSmith | Dual tracing on every agent invoke |
| `functions/api/agents/` | ✅ Partial | `/health` reports registry/MCP/model status; `/invoke` and `/invoke/stream` traced via LangGraph; `/run` and admin tool-loop endpoints emit telemetry; Agent Protocol (`/runs`, `/threads`) and `/mcp` are prototype surfaces |

---

## 2. Recommended Dashboards

### 2.1 Agent Performance Overview

**Purpose:** High-level view of all agent activity.

**Metrics:**
- Total agent invocations (by agent, by tier)
- Success rate (% of invocations with status='ok')
- Average latency (p50, p95, p99)
- Error rate by error type
- Token consumption (total, by model)
- Cost estimate (by agent, by model)

**LangSmith Dashboard Config:**
```json
{
  "name": "PANaCEa Agent Performance",
  "description": "High-level agent activity and performance",
  "charts": [
    {
      "title": "Agent Invocations (24h)",
      "type": "bar",
      "metric": "count",
      "groupBy": "metadata.agent_name",
      "timeRange": "24h"
    },
    {
      "title": "Success Rate by Agent",
      "type": "gauge",
      "metric": "success_rate",
      "filter": "error = false",
      "groupBy": "metadata.agent_name"
    },
    {
      "title": "P95 Latency by Agent",
      "type": "line",
      "metric": "duration_ms",
      "aggregation": "p95",
      "groupBy": "metadata.agent_name",
      "timeRange": "7d"
    },
    {
      "title": "Token Consumption by Model",
      "type": "stacked_bar",
      "metric": "tokens_total",
      "groupBy": "metadata.model",
      "timeRange": "7d"
    },
    {
      "title": "Error Distribution",
      "type": "pie",
      "metric": "count",
      "filter": "error = true",
      "groupBy": "metadata.error_code",
      "timeRange": "24h"
    }
  ]
}
```

### 2.2 Clinical Agent Quality

**Purpose:** Monitor clinical agent output quality and safety.

**Metrics:**
- OSCE grading accuracy (SPBench scores over time)
- Question generation quality (critique pass rate)
- Clinical research confidence scores
- Safety block rate
- Content audit findings (by severity)

**LangSmith Dashboard Config:**
```json
{
  "name": "PANaCEa Clinical Agent Quality",
  "description": "Clinical agent output quality and safety monitoring",
  "charts": [
    {
      "title": "OSCE SPBench Scores (7d avg)",
      "type": "line",
      "metric": "metadata.scores.overallScore",
      "aggregation": "avg",
      "filter": "tags contains 'osce'",
      "timeRange": "7d"
    },
    {
      "title": "Question Pipeline Pass Rate",
      "type": "gauge",
      "metric": "success_rate",
      "filter": "tags contains 'question-pipeline' AND metadata.phase = 'complete'"
    },
    {
      "title": "Clinical Research Confidence Distribution",
      "type": "histogram",
      "metric": "metadata.confidence",
      "filter": "tags contains 'clinical-research'"
    },
    {
      "title": "Safety Blocks (24h)",
      "type": "counter",
      "metric": "count",
      "filter": "metadata.status = 'safety_blocked'",
      "timeRange": "24h"
    }
  ]
}
```

### 2.3 Ops Agent Health

**Purpose:** Monitor operational agent reliability.

**Metrics:**
- Schema drift detection runs
- Env var audit findings
- Gemini API call site audit results
- Prompt contract validation pass rate

**LangSmith Dashboard Config:**
```json
{
  "name": "PANaCEa Ops Agent Health",
  "description": "Operational agent reliability and findings",
  "charts": [
    {
      "title": "Ops Agent Runs (7d)",
      "type": "bar",
      "metric": "count",
      "filter": "tags contains 'ops'",
      "groupBy": "metadata.agent_name",
      "timeRange": "7d"
    },
    {
      "title": "Schema Drift Detections",
      "type": "counter",
      "metric": "count",
      "filter": "metadata.agent_name = 'schema-drift-detector' AND metadata.driftDetected = true"
    },
    {
      "title": "Env Var Audit Findings",
      "type": "table",
      "metric": "metadata.missing_count",
      "filter": "metadata.agent_name = 'env-var-auditor'"
    }
  ]
}
```

---

## 3. Recommended Alerts

### 3.1 Critical Alerts (P0 — immediate attention)

| Alert | Condition | Threshold | Channel |
|-------|-----------|-----------|---------|
| Agent failure spike | Error rate > 20% over 5min | > 20% | Slack #panacea-alerts |
| Clinical safety block | Any safety_blocked status | > 0 | Slack #panacea-alerts |
| OSCE grading failure | Grading error rate > 10% | > 10% | Slack #panacea-alerts |
| Model API failure | Model error rate > 50% | > 50% | Slack #panacea-alerts |

### 3.2 Warning Alerts (P1 — review within 1h)

| Alert | Condition | Threshold | Channel |
|-------|-----------|-----------|---------|
| Agent latency degradation | P95 latency > 2x 7d baseline | > 2x | Slack #panacea-ops |
| Token cost spike | Daily cost > 3x 7d average | > 3x | Slack #panacea-ops |
| Content audit findings | High-severity finding detected | > 0 | Slack #panacea-content |
| Question quality drop | Pipeline pass rate < 70% | < 70% | Slack #panacea-content |

### 3.3 Info Alerts (P2 — review in dashboard)

| Alert | Condition | Threshold |
|-------|-----------|-----------|
| New agent registered | Agent count change | Any change |
| Model fallback triggered | Fallback model used | > 0 |
| Low confidence synthesis | Confidence < 0.3 | < 0.3 |

### LangSmith Alert Rule Config (API)

```bash
# Create alert rules via LangSmith API
# Requires LANGSMITH_API_KEY with admin scope

# Agent failure spike
curl -X POST https://api.smith.langchain.com/v1/rules \
  -H "Authorization: Bearer $LANGSMITH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "panacea-agent-failure-spike",
    "description": "Agent error rate exceeds 20% over 5 minutes",
    "condition": "error_rate > 0.2",
    "window": "5m",
    "channels": ["slack:panacea-alerts"],
    "enabled": true
  }'

# Clinical safety block
curl -X POST https://api.smith.langchain.com/v1/rules \
  -H "Authorization: Bearer $LANGSMITH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "panacea-clinical-safety-block",
    "description": "Any clinical safety block detected",
    "condition": "count(metadata.status == \"safety_blocked\") > 0",
    "window": "5m",
    "channels": ["slack:panacea-alerts"],
    "enabled": true
  }'
```

---

## 4. Online Evaluations

### 4.1 Continuous Quality Evaluation

Run LLM-as-judge evaluations on a sample of agent outputs:

```typescript
// lib/langchain/evals/onlineEvals.ts (to be created)
export interface OnlineEvalConfig {
  /** Agent to evaluate */
  agent: string;
  /** Sample rate (0-1) */
  sampleRate: number;
  /** Evaluation rubric */
  rubric: EvalRubric;
  /** Minimum score threshold */
  minScore: number;
}

export interface EvalRubric {
  /** Evaluation criteria */
  criteria: Array<{
    name: string;
    description: string;
    weight: number;
  }>;
  /** Scoring scale */
  scale: { min: number; max: number };
}
```

### 4.2 Recommended Evaluation Rubrics

**Clinical Agent Rubric:**
- Clinical accuracy (weight: 0.4) — Is the medical information correct?
- Completeness (weight: 0.2) — Are all relevant aspects covered?
- Safety (weight: 0.3) — Are there any safety concerns?
- Clarity (weight: 0.1) — Is the output clear and actionable?

**Content Generation Rubric:**
- Blueprint alignment (weight: 0.3) — Does it match NCCPA blueprint?
- Question quality (weight: 0.3) — Is the stem clear, are distractors plausible?
- Explanation quality (weight: 0.2) — Is the rationale comprehensive?
- Board relevance (weight: 0.2) — Would this appear on PANCE/PANRE?

**Research Agent Rubric:**
- Evidence quality (weight: 0.4) — Are sources credible and properly cited?
- Synthesis quality (weight: 0.3) — Is the synthesis balanced and accurate?
- Recommendation actionability (weight: 0.2) — Are recommendations clinically useful?
- Confidence calibration (weight: 0.1) — Is the confidence score well-calibrated?

---

## 5. Agent Health Endpoint

`GET /api/agents/health` (`functions/api/agents/health.ts`) reports:
- Agent registry status (registered agents by tier, capabilities, production readiness)
- MCP server configuration (registered servers, tool counts)
- Model availability (configured providers, `MODEL_REGISTRY`, `TASK_MODEL_MAP`)
- Overall status (`healthy` | `degraded` | `unhealthy`)

**Still planned (not yet in the health payload):**
- Recent agent activity (last N invocations)
- Error summary (error counts by agent, last 24h)

See `docs/api/API_OVERVIEW.md` for the shipped response schema.

### Planned additions (not yet implemented)

Activity counters and per-agent error summaries remain on the roadmap:

```typescript
interface AgentHealthActivity {
  invocations24h: number;
  errors24h: number;
  avgLatencyMs24h: number;
}
```

---

## 6. Implementation Checklist

- [ ] Create LangSmith dashboards (3 dashboards documented above)
- [ ] Configure alert rules (4 critical, 4 warning, 3 info)
- [ ] Set up online evaluation pipeline (`lib/langchain/evals/onlineEvals.ts`)
- [x] Enhance agent health endpoint (`functions/api/agents/health.ts`) — registry, MCP, model, and capability summary shipped; activity/error counters still TODO
- [ ] Add agent invocation counters for dashboard metrics
- [ ] Document dashboard URLs in team runbook
- [ ] Set up Slack webhook for alert notifications

---

## 7. Cost Estimate

| Component | LangSmith Plan | Monthly Cost (est.) |
|-----------|---------------|---------------------|
| Tracing (existing) | Developer (free) | $0 |
| Dashboards | Developer (free) | $0 |
| Alert rules | Developer (free) | $0 |
| Online evaluations | Developer (free, limited) | $0 |
| **Total** | **Developer** | **$0** |

For higher trace volumes or longer retention, upgrade to LangSmith Plus ($39/mo) or Enterprise.

---

## 8. References

- [LangSmith Observability Docs](https://docs.langchain.com/langsmith/observability)
- [LangSmith Dashboards](https://docs.langchain.com/langsmith/dashboards)
- [LangSmith Rules & Alerts](https://docs.langchain.com/langsmith/rules)
- [LangSmith Online Evaluations](https://docs.langchain.com/langsmith/online-evaluations)
- [PANaCEa Agent Runbook](./RUNBOOK.md)
- [LangChain Ecosystem Audit](./LANGCHAIN_ECOSYSTEM_AUDIT.md)
