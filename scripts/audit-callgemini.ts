#!/usr/bin/env tsx
/**
 * scripts/audit-callgemini.ts
 *
 * Runs the `callgemini-auditor` LangGraph agent against the current
 * repository and prints a markdown migration report to stdout. Designed
 * for two call sites:
 *   1. Local dev:  `npm run audit:callgemini`
 *   2. CI:         `.github/workflows/ai-stack-audit.yml` captures stdout
 *                  and posts it as a PR comment via actions/github-script.
 *
 * Exit codes:
 *   0 — audit ran successfully (regardless of how many call sites found)
 *   1 — audit itself failed (env error, scan error, schema invalid)
 *
 * The script does NOT fail when direct_callGemini count is high — that's
 * a separate policy decision owned by CI. This script just reports.
 */

import { invokeAgent } from '@/lib/agents/registry';

interface CliOptions {
  rootDir?: string;
  maxFiles?: number;
  json?: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--root=')) opts.rootDir = arg.slice('--root='.length);
    else if (arg.startsWith('--max-files=')) opts.maxFiles = Number(arg.slice('--max-files='.length));
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npm run audit:callgemini [--root=<path>] [--max-files=<n>] [--json]

Options:
  --root=<path>       Repository root to scan (default: process.cwd())
  --max-files=<n>     Maximum files to scan (default: 5000)
  --json              Emit JSON instead of markdown
  -h, --help          Show this help
`);
      process.exit(0);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);

  const result = await invokeAgent(
    'callgemini-auditor',
    {
      rootDir: opts.rootDir ?? process.cwd(),
      maxFiles: opts.maxFiles,
    },
    // Ops agents don't need GEMINI_API_KEY — pass an empty env.
    { env: {} },
  );

  if (result.status !== 'ok' || !result.output) {
    console.error(`Audit failed: ${result.status}`);
    if (result.error) console.error(`  ${result.error.message}`);
    process.exit(1);
  }

  const report = result.output;

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // ─── Markdown report ────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`# callGemini Migration Audit`);
  lines.push('');
  lines.push(`**Repository:** \`${report.rootDir}\``);
  lines.push(`**Files scanned:** ${report.totalFilesScanned.toLocaleString()}`);
  lines.push(`**Audit duration:** ${result.durationMs} ms`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push('| Stage | Count |');
  lines.push('|---|---:|');
  lines.push(`| \`direct_callGemini\` (deprecated, needs migration) | ${report.summary.direct_callGemini} |`);
  lines.push(`| \`callAIMultiProvider\` (multi-provider, LangChain-routed) | ${report.summary.callAIMultiProvider} |`);
  lines.push(`| \`streamGemini\` (streaming, gateway-migrated) | ${report.summary.streamGemini} |`);
  lines.push(`| \`gateway_migrated\` (via aiGateway.ts) | ${report.summary.gateway_migrated} |`);
  lines.push(`| **Total call sites** | **${report.summary.totalCallSites}** |`);
  lines.push('');

  if (report.callSites.length === 0) {
    lines.push('No call sites found — codebase is fully migrated. ✅');
  } else {
    // Group direct_callGemini findings by file (highest-priority migration targets).
    const directByFile = new Map<string, number>();
    for (const cs of report.callSites) {
      if (cs.stage !== 'direct_callGemini') continue;
      directByFile.set(cs.file, (directByFile.get(cs.file) ?? 0) + 1);
    }
    const ranked = [...directByFile.entries()].sort((a, b) => b[1] - a[1]);

    if (ranked.length > 0) {
      lines.push('## Migration targets (files with `direct_callGemini` calls)');
      lines.push('');
      lines.push('| File | Direct calls |');
      lines.push('|---|---:|');
      for (const [file, count] of ranked.slice(0, 25)) {
        lines.push(`| \`${file}\` | ${count} |`);
      }
      if (ranked.length > 25) {
        lines.push('');
        lines.push(`_…and ${ranked.length - 25} more files. Run with \`--json\` for the full list._`);
      }
      lines.push('');
    }

    lines.push('## Sample call sites');
    lines.push('');
    lines.push('<details><summary>First 15 findings (click to expand)</summary>');
    lines.push('');
    for (const cs of report.callSites.slice(0, 15)) {
      lines.push(`- \`${cs.file}:${cs.line}\` — **${cs.callee}** (${cs.stage})`);
      lines.push(`  \`${cs.snippet}\``);
    }
    lines.push('');
    lines.push('</details>');
  }

  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error('Unhandled error in audit script:', err);
  process.exit(1);
});