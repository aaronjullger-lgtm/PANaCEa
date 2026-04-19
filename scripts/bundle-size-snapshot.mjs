#!/usr/bin/env node

/**
 * Bundle Size Snapshot + Delta
 *
 * Companion to `check-bundle-size.mjs`. That script enforces budgets;
 * this one produces a structured snapshot and (if a baseline is provided)
 * a markdown delta suitable for posting as a PR comment.
 *
 * Designed to be wired into CI later — today it's additive and safe to
 * run locally as `node scripts/bundle-size-snapshot.mjs`.
 *
 * Usage:
 *   # Write a snapshot of the current build.
 *   node scripts/bundle-size-snapshot.mjs --out .bundle-snapshot.json
 *
 *   # Compare against a baseline and print markdown.
 *   node scripts/bundle-size-snapshot.mjs \
 *     --baseline .bundle-snapshot-main.json \
 *     --out .bundle-snapshot.json \
 *     --markdown .bundle-delta.md
 *
 * Exit codes:
 *   0 — success (or delta generated, regardless of direction)
 *   2 — build output not found
 *   3 — baseline file not found
 *
 * Snapshot schema (v1):
 *   {
 *     "version": 1,
 *     "generatedAt": "2026-04-18T…",
 *     "totals": { "jsKB": …, "cssKB": …, "chunkCount": … },
 *     "largestChunk": { "name": …, "kB": … },
 *     "topChunks": [ { "name": …, "kB": … }, … ]
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── CLI parsing ──────────────────────────────────────────────────────────

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : fallback;
}

const DIST = argValue('--dist', 'dist');
const OUT = argValue('--out', null);
const BASELINE = argValue('--baseline', null);
const MARKDOWN = argValue('--markdown', null);
const TOP_N = 10;

// ─── Snapshot ─────────────────────────────────────────────────────────────

function toKB(bytes) {
  return Math.round((bytes / 1024) * 100) / 100;
}

function snapshot(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error(`Bundle snapshot: assets directory not found (${assetsDir}). Run "npm run build" first.`);
    process.exit(2);
  }

  const files = fs.readdirSync(assetsDir, { recursive: true });
  const js = [];
  const css = [];

  for (const file of files) {
    const name = String(file);
    const full = path.join(assetsDir, name);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    if (name.endsWith('.js')) js.push({ name, kB: toKB(stat.size) });
    else if (name.endsWith('.css')) css.push({ name, kB: toKB(stat.size) });
  }

  js.sort((a, b) => b.kB - a.kB);
  css.sort((a, b) => b.kB - a.kB);

  const totalJs = js.reduce((s, f) => s + f.kB, 0);
  const totalCss = css.reduce((s, f) => s + f.kB, 0);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totals: {
      jsKB: Math.round(totalJs * 100) / 100,
      cssKB: Math.round(totalCss * 100) / 100,
      chunkCount: js.length,
    },
    largestChunk: js[0] ?? { name: 'none', kB: 0 },
    topChunks: js.slice(0, TOP_N),
    topCss: css.slice(0, TOP_N),
  };
}

// ─── Delta markdown ───────────────────────────────────────────────────────

function fmtDelta(current, base) {
  const diff = Math.round((current - base) * 100) / 100;
  if (diff === 0) return '±0 kB';
  const sign = diff > 0 ? '+' : '';
  const pct = base > 0 ? ` (${sign}${((diff / base) * 100).toFixed(1)}%)` : '';
  return `${sign}${diff} kB${pct}`;
}

function statusEmoji(current, base, budget) {
  const pct = budget > 0 ? current / budget : 0;
  if (pct > 1) return ':red_circle:';
  if (pct > 0.85) return ':yellow_circle:';
  if (current > base) return ':arrow_up:';
  if (current < base) return ':arrow_down:';
  return ':green_circle:';
}

function renderMarkdown(current, base) {
  const lines = [];
  lines.push('### Bundle Size Report');
  lines.push('');
  lines.push('| Metric | Current | Baseline | Delta |');
  lines.push('|---|---:|---:|---:|');

  const rows = [
    ['Total JS', current.totals.jsKB, base?.totals?.jsKB ?? 0, 1400],
    ['Total CSS', current.totals.cssKB, base?.totals?.cssKB ?? 0, 200],
    ['Largest chunk', current.largestChunk.kB, base?.largestChunk?.kB ?? 0, 350],
    ['Chunk count', current.totals.chunkCount, base?.totals?.chunkCount ?? 0, 0],
  ];

  for (const [label, cur, bas, budget] of rows) {
    const emoji = budget > 0 ? statusEmoji(cur, bas, budget) : '';
    const deltaStr = typeof cur === 'number' && typeof bas === 'number' && bas > 0
      ? fmtDelta(cur, bas)
      : '—';
    const budgetStr = budget > 0 ? ` / ${budget}` : '';
    lines.push(`| ${emoji} ${label} | ${cur}${budgetStr} | ${bas || '—'} | ${deltaStr} |`);
  }

  lines.push('');
  lines.push('<details><summary>Top chunks</summary>');
  lines.push('');
  lines.push('| Chunk | Size |');
  lines.push('|---|---:|');
  for (const c of current.topChunks) {
    lines.push(`| \`${c.name}\` | ${c.kB} kB |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push(`_Generated at ${current.generatedAt}_`);
  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────

const current = snapshot(DIST);

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify(current, null, 2) + '\n');
  console.log(`Wrote snapshot → ${OUT}`);
}

let base = null;
if (BASELINE) {
  if (!fs.existsSync(BASELINE)) {
    console.error(`Bundle snapshot: baseline file not found (${BASELINE}).`);
    process.exit(3);
  }
  try {
    base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  } catch (err) {
    console.error(`Bundle snapshot: baseline file is not valid JSON: ${err.message}`);
    process.exit(3);
  }
}

const md = renderMarkdown(current, base);

if (MARKDOWN) {
  fs.writeFileSync(MARKDOWN, md + '\n');
  console.log(`Wrote markdown delta → ${MARKDOWN}`);
} else {
  console.log('\n' + md + '\n');
}
