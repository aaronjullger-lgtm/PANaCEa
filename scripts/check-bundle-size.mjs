#!/usr/bin/env node

/**
 * Bundle Size Budget Check
 *
 * Reads the Vite build manifest or scans dist/assets/ to enforce size limits.
 * Fails CI if any chunk or the total bundle exceeds the configured budget.
 *
 * Phase 3 improvement: prevents bundle size regressions in CI.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs [--dist dist]
 *
 * Exit codes:
 *   0 — within budget
 *   1 — budget exceeded
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Budget Configuration ──────────────────────────────────────────────────

function readBudgetEnv(key, fallback) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BUDGETS = {
  // Rebaselined to the current production bundle on 2026-04-26.
  // Keep this as a regression guard; tighten after route-level splitting lands.
  totalJs: readBudgetEnv('BUNDLE_BUDGET_TOTAL_JS_KB', 8200),
  totalCss: readBudgetEnv('BUNDLE_BUDGET_TOTAL_CSS_KB', 300),
  maxChunk: readBudgetEnv('BUNDLE_BUDGET_MAX_CHUNK_KB', 1250),
  warnAt: readBudgetEnv('BUNDLE_BUDGET_WARN_AT', 0.85),
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function toKB(bytes) {
  return Math.round((bytes / 1024) * 100) / 100;
}

function findDist() {
  const args = process.argv.slice(2);
  const distIdx = args.indexOf('--dist');
  return distIdx !== -1 && args[distIdx + 1] ? args[distIdx + 1] : 'dist';
}

function scanAssets(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error(`❌ Assets directory not found: ${assetsDir}`);
    console.error('   Run "npm run build" first.');
    process.exit(1);
  }

  const files = fs.readdirSync(assetsDir, { recursive: true });
  const jsFiles = [];
  const cssFiles = [];

  for (const file of files) {
    const filePath = path.join(assetsDir, String(file));
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const name = String(file);
    const sizeKB = toKB(stat.size);

    if (name.endsWith('.js')) {
      jsFiles.push({ name, sizeKB, bytes: stat.size });
    } else if (name.endsWith('.css')) {
      cssFiles.push({ name, sizeKB, bytes: stat.size });
    }
  }

  return { jsFiles, cssFiles };
}

// ─── Main ──────────────────────────────────────────────────────────────────

const distDir = findDist();
const { jsFiles, cssFiles } = scanAssets(distDir);

const totalJsKB = jsFiles.reduce((sum, f) => sum + f.sizeKB, 0);
const totalCssKB = cssFiles.reduce((sum, f) => sum + f.sizeKB, 0);
const largestChunk = jsFiles.reduce((max, f) => (f.sizeKB > max.sizeKB ? f : max), { name: 'none', sizeKB: 0 });

let hasError = false;
let hasWarning = false;

// ─── Report ────────────────────────────────────────────────────────────────

console.log('\n📦 Bundle Size Report\n');
console.log('─'.repeat(60));

// Top 10 largest JS chunks
const sortedJs = [...jsFiles].sort((a, b) => b.sizeKB - a.sizeKB).slice(0, 10);
console.log('\nTop JS chunks:');
for (const f of sortedJs) {
  const pct = ((f.sizeKB / BUDGETS.maxChunk) * 100).toFixed(0);
  const icon = f.sizeKB > BUDGETS.maxChunk ? '🔴' : f.sizeKB > BUDGETS.maxChunk * BUDGETS.warnAt ? '🟡' : '🟢';
  console.log(`  ${icon} ${f.name.padEnd(45)} ${f.sizeKB.toFixed(1).padStart(8)} kB  (${pct}% of chunk budget)`);
}

console.log('\n─'.repeat(60));
console.log('\nBudget Summary:');

// Total JS
const jsIcon = totalJsKB > BUDGETS.totalJs ? '🔴' : totalJsKB > BUDGETS.totalJs * BUDGETS.warnAt ? '🟡' : '🟢';
console.log(`  ${jsIcon} Total JS:       ${totalJsKB.toFixed(1).padStart(8)} kB / ${BUDGETS.totalJs} kB  (${((totalJsKB / BUDGETS.totalJs) * 100).toFixed(0)}%)`);
if (totalJsKB > BUDGETS.totalJs) hasError = true;
if (totalJsKB > BUDGETS.totalJs * BUDGETS.warnAt) hasWarning = true;

// Total CSS
const cssIcon = totalCssKB > BUDGETS.totalCss ? '🔴' : totalCssKB > BUDGETS.totalCss * BUDGETS.warnAt ? '🟡' : '🟢';
console.log(`  ${cssIcon} Total CSS:      ${totalCssKB.toFixed(1).padStart(8)} kB / ${BUDGETS.totalCss} kB  (${((totalCssKB / BUDGETS.totalCss) * 100).toFixed(0)}%)`);
if (totalCssKB > BUDGETS.totalCss) hasError = true;

// Largest chunk
const chunkIcon = largestChunk.sizeKB > BUDGETS.maxChunk ? '🔴' : largestChunk.sizeKB > BUDGETS.maxChunk * BUDGETS.warnAt ? '🟡' : '🟢';
console.log(`  ${chunkIcon} Largest chunk:  ${largestChunk.sizeKB.toFixed(1).padStart(8)} kB / ${BUDGETS.maxChunk} kB  (${largestChunk.name})`);
if (largestChunk.sizeKB > BUDGETS.maxChunk) hasError = true;

console.log(`\n  📊 ${jsFiles.length} JS files, ${cssFiles.length} CSS files\n`);

if (hasError) {
  console.log('❌ Bundle size budget EXCEEDED. Please reduce bundle size before merging.\n');
  process.exit(1);
} else if (hasWarning) {
  console.log('⚠️  Bundle size approaching budget limit. Consider code-splitting.\n');
  process.exit(0);
} else {
  console.log('✅ Bundle size within budget.\n');
  process.exit(0);
}
