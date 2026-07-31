#!/usr/bin/env node
/**
 * Check evaluation results against quality gates.
 * Exit with non-zero code if any gate fails.
 *
 * Usage: node scripts/check-eval-gates.mjs
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
    failures.push(`Average overall score ${(avgOverall * 100).toFixed(1)}% < ${(GATES.minOverallScore * 100).toFixed(1)}%`);
    passed = false;
  }

  // Check average medical accuracy
  const avgMedical = results.reduce((sum, r) => sum + r.scores.medicalAccuracy, 0) / results.length;
  if (avgMedical < GATES.minMedicalAccuracy) {
    failures.push(`Average medical accuracy ${(avgMedical * 100).toFixed(1)}% < ${(GATES.minMedicalAccuracy * 100).toFixed(1)}%`);
    passed = false;
  }

  // Check average latency
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  if (avgLatency > GATES.maxLatencyMs) {
    failures.push(`Average latency ${avgLatency.toFixed(0)}ms > ${GATES.maxLatencyMs}ms`);
    passed = false;
  }

  // Check individual example scores
  const lowScores = results.filter(r => r.scores.overall < GATES.minExampleScore);
  if (lowScores.length > 0) {
    failures.push(`${lowScores.length} examples scored below ${(GATES.minExampleScore * 100).toFixed(1)}%`);
    passed = false;
  }

  // Report
  console.log('\n=== Quality Gate Check ===');
  console.log(`Overall score: ${(avgOverall * 100).toFixed(1)}% (threshold: ${(GATES.minOverallScore * 100).toFixed(1)}%)`);
  console.log(`Medical accuracy: ${(avgMedical * 100).toFixed(1)}% (threshold: ${(GATES.minMedicalAccuracy * 100).toFixed(1)}%)`);
  console.log(`Average latency: ${avgLatency.toFixed(0)}ms (threshold: ${GATES.maxLatencyMs}ms)`);
  console.log(`Low-scoring examples: ${lowScores.length}`);

  if (passed) {
    console.log('\n✅ All quality gates passed.');
    process.exit(0);
  } else {
    console.log('\n❌ Quality gate failures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main();
