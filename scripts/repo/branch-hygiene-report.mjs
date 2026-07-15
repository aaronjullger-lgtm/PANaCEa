#!/usr/bin/env node
/**
 * Branch Hygiene Report (read-only) — Implementation Expansion Pass, Phase 9.
 *
 * Lists remote branches with last-commit author/date/age and flags stale ones.
 * The audit flagged 250+ branches as a hygiene crisis; this makes the state
 * visible so the owner can decide what to prune.
 *
 * SAFETY: This script NEVER deletes, pushes, or modifies anything. It only reads
 * `git for-each-ref`. Deletion remains a manual/approval-gated owner action.
 *
 * Usage:
 *   node scripts/repo/branch-hygiene-report.mjs [--stale-days=90] [--json]
 */

import { execSync } from 'node:child_process';

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

const staleDays = Number.parseInt(arg('stale-days', '90'), 10);
const asJson = process.argv.includes('--json');
const now = Date.now();
const STALE_MS = staleDays * 24 * 60 * 60 * 1000;

// Protected branches never flagged for cleanup.
const PROTECTED = new Set(['origin/main', 'origin/master', 'origin/HEAD']);

function readBranches() {
  // %(refname:short)\t%(committerdate:iso8601)\t%(authorname)
  const out = execSync(
    'git for-each-ref --sort=-committerdate refs/remotes/origin ' +
      "--format='%(refname:short)%09%(committerdate:iso8601)%09%(authorname)'",
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  return out
    .split('\n')
    .map((l) => l.replace(/^'|'$/g, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [name, date, author] = line.split('\t');
      const ageMs = now - new Date(date).getTime();
      return {
        name,
        date,
        author: author ?? 'unknown',
        ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
        stale: ageMs > STALE_MS && !PROTECTED.has(name),
        protected: PROTECTED.has(name),
      };
    });
}

function main() {
  let branches;
  try {
    branches = readBranches();
  } catch (err) {
    console.error('[branch-hygiene] failed to read branches:', err.message);
    process.exit(0); // non-fatal: report tool, never breaks CI
    return;
  }

  const stale = branches.filter((b) => b.stale);
  const summary = {
    total: branches.length,
    protected: branches.filter((b) => b.protected).length,
    staleThresholdDays: staleDays,
    staleCount: stale.length,
    generatedAt: new Date().toISOString(),
  };

  if (asJson) {
    console.log(JSON.stringify({ summary, stale }, null, 2));
    return;
  }

  console.log('=== PANaCEa Branch Hygiene Report (read-only) ===');
  console.log(
    `Total remote branches: ${summary.total} | stale (>${staleDays}d): ${summary.staleCount}\n`
  );
  console.log(`Top ${Math.min(30, stale.length)} stale branches (oldest by last commit):`);
  for (const b of stale.slice(-30).reverse()) {
    console.log(`  ${String(b.ageDays).padStart(4)}d  ${b.name}  (${b.author})`);
  }
  console.log(
    '\nNo branches were deleted. To prune, review the list and delete manually,\n' +
      'e.g.: git push origin --delete <branch>  (owner action; approval-gated).'
  );
}

main();
