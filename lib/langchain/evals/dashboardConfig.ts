/**
 * LangSmith Dashboard Configuration
 *
 * Defines dashboard layouts, metric cards, and alert rules for
 * monitoring PANaCEa's agent and LLM performance in LangSmith.
 *
 * This file serves as documentation and can be used to programmatically
 * create dashboards via the LangSmith API. The actual dashboards are
 * created in the LangSmith UI using these configurations as templates.
 *
 * Sprint 1: LangSmith Observability Upgrade
 *
 * @module lib/langchain/evals/dashboardConfig
 */

// ─── Dashboard: Agent Performance Overview ────────────────────────────────

/**
 * Agent Performance Dashboard
 *
 * Purpose: Monitor all PANaCEa agents (Edge + Node) for latency,
 * success rate, cost, and token efficiency.
 *
 * Filters:
 *   - Tags: panacea
 *   - Metadata.agent_tier: encounter | ops | orchestrator
 *
 * Layout:
 *   Row 1: Summary cards (total invocations, avg latency, success rate, total cost)
 *   Row 2: Latency by agent (bar chart)
 *   Row 3: Success rate by agent tier (pie chart)
 *   Row 4: Cost by provider (stacked bar)
 *   Row 5: Token usage over time (line chart)
 *   Row 6: Recent errors (table)
 */
export const AGENT_PERFORMANCE_DASHBOARD = {
  name: 'PANaCEa Agent Performance',
  description: 'Monitor all PANaCEa agents for latency, success rate, cost, and token efficiency.',
  filters: {
    tags: ['panacea'],
    metadata: {
      framework: 'langchain',
    },
  },
  cards: [
    {
      title: 'Total Agent Invocations',
      metric: 'count',
      chartType: 'stat',
      position: { row: 1, col: 1 },
    },
    {
      title: 'Average Latency (ms)',
      metric: 'avg(latency_ms)',
      chartType: 'stat',
      position: { row: 1, col: 2 },
    },
    {
      title: 'Success Rate',
      metric: 'success_rate',
      chartType: 'stat',
      position: { row: 1, col: 3 },
    },
    {
      title: 'Total Estimated Cost (USD)',
      metric: 'sum(estimated_cost_usd)',
      chartType: 'stat',
      position: { row: 1, col: 4 },
    },
    {
      title: 'Latency by Agent',
      metric: 'avg(latency_ms)',
      groupBy: 'metadata.agent_name',
      chartType: 'bar',
      position: { row: 2, col: 1, colSpan: 2 },
    },
    {
      title: 'Success Rate by Agent Tier',
      metric: 'success_rate',
      groupBy: 'metadata.agent_tier',
      chartType: 'pie',
      position: { row: 2, col: 3, colSpan: 2 },
    },
    {
      title: 'Cost by Provider',
      metric: 'sum(estimated_cost_usd)',
      groupBy: 'metadata.provider',
      chartType: 'stacked_bar',
      position: { row: 3, col: 1, colSpan: 2 },
    },
    {
      title: 'Token Usage Over Time',
      metric: 'sum(total_tokens)',
      chartType: 'line',
      timeInterval: '1h',
      position: { row: 3, col: 3, colSpan: 2 },
    },
    {
      title: 'Recent Errors',
      metric: 'count',
      filter: "status = 'error'",
      chartType: 'table',
      columns: ['timestamp', 'metadata.agent_name', 'error'],
      position: { row: 4, col: 1, colSpan: 4 },
    },
  ],
  alerts: [
    {
      name: 'High Agent Error Rate',
      condition: "success_rate < 0.90 AND count > 10",
      window: '1h',
      severity: 'warning',
      channels: ['email'],
    },
    {
      name: 'Agent Latency Spike',
      condition: 'avg(latency_ms) > 15000',
      window: '15m',
      severity: 'warning',
      channels: ['email'],
    },
    {
      name: 'Cost Overrun',
      condition: 'sum(estimated_cost_usd) > 5.00',
      window: '1h',
      severity: 'critical',
      channels: ['email'],
    },
  ],
} as const;

// ─── Dashboard: Question Generation Quality ───────────────────────────────

/**
 * Question Generation Quality Dashboard
 *
 * Purpose: Monitor the quality of AI-generated medical questions.
 * Tracks structural completeness, clinical accuracy signals,
 * and online evaluation scores.
 *
 * Filters:
 *   - Tags: generation, questions
 *   - Metadata.eval_context: question-quality
 */
export const QUESTION_QUALITY_DASHBOARD = {
  name: 'PANaCEa Question Generation Quality',
  description: 'Monitor AI-generated question quality, structural completeness, and clinical accuracy.',
  filters: {
    tags: ['generation', 'questions'],
  },
  cards: [
    {
      title: 'Questions Generated',
      metric: 'count',
      chartType: 'stat',
      position: { row: 1, col: 1 },
    },
    {
      title: 'Average Quality Score',
      metric: 'avg(feedback.question_quality_score)',
      chartType: 'stat',
      position: { row: 1, col: 2 },
    },
    {
      title: 'Pass Rate (score ≥ 0.7)',
      metric: 'pass_rate',
      chartType: 'stat',
      position: { row: 1, col: 3 },
    },
    {
      title: 'Quality Score Distribution',
      metric: 'count',
      groupBy: 'feedback.question_quality_label',
      chartType: 'pie',
      position: { row: 2, col: 1, colSpan: 2 },
    },
    {
      title: 'Quality by Organ System',
      metric: 'avg(feedback.question_quality_score)',
      groupBy: 'metadata.organSystem',
      chartType: 'bar',
      position: { row: 2, col: 3, colSpan: 2 },
    },
    {
      title: 'Quality Trend',
      metric: 'avg(feedback.question_quality_score)',
      chartType: 'line',
      timeInterval: '1d',
      position: { row: 3, col: 1, colSpan: 4 },
    },
  ],
  alerts: [
    {
      name: 'Low Question Quality',
      condition: 'avg(feedback.question_quality_score) < 0.5 AND count > 5',
      window: '1h',
      severity: 'warning',
      channels: ['email'],
    },
  ],
} as const;

// ─── Dashboard: OSCE Encounter Performance ────────────────────────────────

/**
 * OSCE Encounter Performance Dashboard
 *
 * Purpose: Monitor OSCE simulation quality — SPBench grading
 * completeness, latency, and model performance.
 *
 * Filters:
 *   - Tags: osce, simulation
 *   - Metadata.eval_context: osce-grading
 */
export const OSCE_PERFORMANCE_DASHBOARD = {
  name: 'PANaCEa OSCE Encounter Performance',
  description: 'Monitor OSCE simulation grading quality, latency, and model performance.',
  filters: {
    tags: ['osce', 'simulation'],
  },
  cards: [
    {
      title: 'OSCE Encounters',
      metric: 'count',
      chartType: 'stat',
      position: { row: 1, col: 1 },
    },
    {
      title: 'Grading Completeness',
      metric: 'avg(feedback.osce_grading_score)',
      chartType: 'stat',
      position: { row: 1, col: 2 },
    },
    {
      title: 'Average Encounter Duration',
      metric: 'avg(latency_ms)',
      chartType: 'stat',
      position: { row: 1, col: 3 },
    },
    {
      title: 'SPBench Dimension Coverage',
      metric: 'avg(feedback.dimensions_present)',
      chartType: 'stat',
      position: { row: 1, col: 4 },
    },
    {
      title: 'Grading Score Distribution',
      metric: 'count',
      groupBy: 'feedback.osce_grading_label',
      chartType: 'pie',
      position: { row: 2, col: 1, colSpan: 2 },
    },
    {
      title: 'Latency by Model',
      metric: 'avg(latency_ms)',
      groupBy: 'metadata.model_name',
      chartType: 'bar',
      position: { row: 2, col: 3, colSpan: 2 },
    },
  ],
  alerts: [
    {
      name: 'Incomplete OSCE Grading',
      condition: 'avg(feedback.osce_grading_score) < 0.5 AND count > 3',
      window: '1h',
      severity: 'warning',
      channels: ['email'],
    },
  ],
} as const;

// ─── Dashboard: Cost & Efficiency ─────────────────────────────────────────

/**
 * Cost & Efficiency Dashboard
 *
 * Purpose: Track AI spending across all providers, models, and
 * agent tiers. Identify cost anomalies and optimization opportunities.
 *
 * Filters:
 *   - Tags: panacea
 *   - Metadata.cost_tier: free | budget | mid | premium
 */
export const COST_EFFICIENCY_DASHBOARD = {
  name: 'PANaCEa Cost & Efficiency',
  description: 'Track AI spending, identify cost anomalies, and find optimization opportunities.',
  filters: {
    tags: ['panacea'],
  },
  cards: [
    {
      title: 'Total Cost (24h)',
      metric: 'sum(estimated_cost_usd)',
      chartType: 'stat',
      position: { row: 1, col: 1 },
    },
    {
      title: 'Avg Cost per Invocation',
      metric: 'avg(estimated_cost_usd)',
      chartType: 'stat',
      position: { row: 1, col: 2 },
    },
    {
      title: 'Total Tokens (24h)',
      metric: 'sum(total_tokens)',
      chartType: 'stat',
      position: { row: 1, col: 3 },
    },
    {
      title: 'Free Tier Usage %',
      metric: 'free_tier_pct',
      chartType: 'stat',
      position: { row: 1, col: 4 },
    },
    {
      title: 'Cost by Provider (Stacked)',
      metric: 'sum(estimated_cost_usd)',
      groupBy: 'metadata.provider',
      chartType: 'stacked_bar',
      position: { row: 2, col: 1, colSpan: 2 },
    },
    {
      title: 'Cost by Cost Tier',
      metric: 'sum(estimated_cost_usd)',
      groupBy: 'metadata.cost_tier',
      chartType: 'pie',
      position: { row: 2, col: 3, colSpan: 2 },
    },
    {
      title: 'Cost Trend (7d)',
      metric: 'sum(estimated_cost_usd)',
      chartType: 'line',
      timeInterval: '1d',
      position: { row: 3, col: 1, colSpan: 2 },
    },
    {
      title: 'Token Efficiency (tokens/$)',
      metric: 'token_efficiency',
      groupBy: 'metadata.model_name',
      chartType: 'bar',
      position: { row: 3, col: 3, colSpan: 2 },
    },
  ],
  alerts: [
    {
      name: 'Daily Cost Spike',
      condition: 'sum(estimated_cost_usd) > 20.00',
      window: '1h',
      severity: 'critical',
      channels: ['email'],
    },
    {
      name: 'Premium Model Overuse',
      condition: "count > 50 AND metadata.cost_tier = 'premium'",
      window: '1h',
      severity: 'warning',
      channels: ['email'],
    },
  ],
} as const;

// ─── Dashboard Registry ───────────────────────────────────────────────────

/**
 * All PANaCEa LangSmith dashboards.
 * Use these configs to create dashboards via the LangSmith UI or API.
 */
export const DASHBOARD_CONFIGS = {
  agentPerformance: AGENT_PERFORMANCE_DASHBOARD,
  questionQuality: QUESTION_QUALITY_DASHBOARD,
  oscePerformance: OSCE_PERFORMANCE_DASHBOARD,
  costEfficiency: COST_EFFICIENCY_DASHBOARD,
} as const;

export type DashboardName = keyof typeof DASHBOARD_CONFIGS;
