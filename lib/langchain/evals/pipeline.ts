/**
 * LangSmith Automated Evaluation Pipeline Configuration
 *
 * Defines evaluation schedules, quality gates, and alerting thresholds
 * for PANaCEa agent quality monitoring.
 *
 * @module lib.langchain.evals.pipeline
 */

// ─── Pipeline Configuration ─────────────────────────────────────────────

export interface EvalPipelineConfig {
  /** Pipeline name */
  name: string;
  /** Description */
  description: string;
  /** Evaluation schedule */
  schedule: {
    /** Cron expression for scheduled runs */
    cron: string;
    /** Run on PRs touching agent code */
    onPR: boolean;
    /** Run on push to main */
    onMain: boolean;
  };
  /** Agent types to evaluate */
  agentTypes: string[];
  /** Difficulty levels to test */
  difficulties: ('basic' | 'intermediate' | 'advanced')[];
  /** Quality gates */
  qualityGates: {
    /** Minimum overall score (0-1) */
    minOverallScore: number;
    /** Minimum medical accuracy (0-1) */
    minMedicalAccuracy: number;
    /** Maximum acceptable latency (ms) */
    maxLatencyMs: number;
    /** Fail if any example scores below this threshold */
    minExampleScore: number;
  };
  /** Alerting thresholds */
  alerting: {
    /** Slack webhook URL (optional) */
    slackWebhook?: string;
    /** Email recipients (optional) */
    emails?: string[];
    /** Alert if score drops below this threshold */
    scoreDropThreshold: number;
  };
}

// ─── Default Pipeline ───────────────────────────────────────────────────

export const defaultPipelineConfig: EvalPipelineConfig = {
  name: 'panacea-agent-evals',
  description: 'Automated evaluation pipeline for PANaCEa encounter agents',
  schedule: {
    // Run daily at 2 AM UTC
    cron: '0 2 * * *',
    // Run on PRs that touch agent code
    onPR: true,
    // Run on push to main
    onMain: true,
  },
  agentTypes: [
    'standardized-patient',
    'ddx-generator',
    'soap-note-grader',
    'feedback-summarizer',
  ],
  difficulties: ['basic', 'intermediate', 'advanced'],
  qualityGates: {
    // Minimum 70% overall score to pass
    minOverallScore: 0.7,
    // Minimum 60% medical accuracy
    minMedicalAccuracy: 0.6,
    // Maximum 30 seconds latency
    maxLatencyMs: 30000,
    // No example should score below 40%
    minExampleScore: 0.4,
  },
  alerting: {
    // Alert if score drops more than 10% from baseline
    scoreDropThreshold: 0.1,
  },
};

// ─── GitHub Actions Workflow ────────────────────────────────────────────

export const githubActionsWorkflow = `
name: Agent Evaluations

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  push:
    branches: [main]
    paths:
      - 'lib/langchain/**'
      - 'lib/agents/**'
      - 'functions/api/agents/**'
  pull_request:
    branches: [main]
    paths:
      - 'lib/langchain/**'
      - 'lib/agents/**'
      - 'functions/api/agents/**'

jobs:
  evaluate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate Prisma client
        run: npx prisma generate
        
      - name: Run agent evaluations
        env:
          LANGSMITH_API_KEY: \${{ secrets.LANGSMITH_API_KEY }}
          LANGSMITH_PROJECT: panacea-dev-agents
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
        run: npm run eval:agents
        
      - name: Check quality gates
        if: always()
        run: |
          # Parse evaluation results and check quality gates
          # This script would read the eval output and fail if gates aren't met
          node scripts/check-eval-gates.mjs
          
      - name: Upload evaluation results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: |
            eval-results.json
            eval-summary.md
          retention-days: 30
`;

// ─── Quality Gate Checker ───────────────────────────────────────────────

export const qualityGateCheckerScript = `#!/usr/bin/env node
/**
 * Check evaluation results against quality gates.
 * Exit with non-zero code if any gate fails.
 */

import { readFileSync, existsSync } from 'fs';

const RESULTS_FILE = 'eval-results.json';
const GATES = {
  minOverallScore: 0.7,
  minMedicalAccuracy: 0.6,
  maxLatencyMs: 30000,
  minExampleScore: 0.4,
};

function main() {
  if (!existsSync(RESULTS_FILE)) {
    console.log('No evaluation results found. Skipping quality gate check.');
    process.exit(0);
  }

  const results = JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'));
  
  let passed = true;
  const failures = [];

  // Check average overall score
  const avgOverall = results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length;
  if (avgOverall < GATES.minOverallScore) {
    failures.push(\`Average overall score \${(avgOverall * 100).toFixed(1)}% < \${(GATES.minOverallScore * 100).toFixed(1)}%\`);
    passed = false;
  }

  // Check average medical accuracy
  const avgMedical = results.reduce((sum, r) => sum + r.scores.medicalAccuracy, 0) / results.length;
  if (avgMedical < GATES.minMedicalAccuracy) {
    failures.push(\`Average medical accuracy \${(avgMedical * 100).toFixed(1)}% < \${(GATES.minMedicalAccuracy * 100).toFixed(1)}%\`);
    passed = false;
  }

  // Check average latency
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  if (avgLatency > GATES.maxLatencyMs) {
    failures.push(\`Average latency \${avgLatency.toFixed(0)}ms > \${GATES.maxLatencyMs}ms\`);
    passed = false;
  }

  // Check individual example scores
  const lowScores = results.filter(r => r.scores.overall < GATES.minExampleScore);
  if (lowScores.length > 0) {
    failures.push(\`\${lowScores.length} examples scored below \${(GATES.minExampleScore * 100).toFixed(1)}%\`);
    passed = false;
  }

  // Report
  console.log('\\n=== Quality Gate Check ===');
  console.log(\`Overall score: \${(avgOverall * 100).toFixed(1)}% (threshold: \${(GATES.minOverallScore * 100).toFixed(1)}%)\`);
  console.log(\`Medical accuracy: \${(avgMedical * 100).toFixed(1)}% (threshold: \${(GATES.minMedicalAccuracy * 100).toFixed(1)}%)\`);
  console.log(\`Average latency: \${avgLatency.toFixed(0)}ms (threshold: \${GATES.maxLatencyMs}ms)\`);
  console.log(\`Low-scoring examples: \${lowScores.length}\`);

  if (passed) {
    console.log('\\n✅ All quality gates passed.');
    process.exit(0);
  } else {
    console.log('\\n❌ Quality gate failures:');
    failures.forEach(f => console.log(\`  - \${f}\`));
    process.exit(1);
  }
}

main();
`;

// ─── Exports ────────────────────────────────────────────────────────────

export function getPipelineConfig(): EvalPipelineConfig {
  return { ...defaultPipelineConfig };
}

export function getGitHubActionsWorkflow(): string {
  return githubActionsWorkflow;
}

export function getQualityGateCheckerScript(): string {
  return qualityGateCheckerScript;
}
