#!/usr/bin/env node
/**
 * PANaCEa Security Scanner — Secret + config scanner for pre-commit.
 *
 * Scans staged files for hardcoded secrets, suspicious patterns,
 * Edge-runtime violations, and Prisma-in-frontend imports.
 *
 * Usage: node scripts/security-scan.js [--all] [--path=dir] [--fix]
 * Exit: 0=clean, 1=warnings, 2=critical (blocks commit)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SECRET_PATTERNS = [
  { name: 'OpenAI Key', pattern: /sk-[a-zA-Z0-9]{20,}/, sev: 'critical' },
  { name: 'Anthropic Key', pattern: /sk-ant-[a-zA-Z0-9]{20,}/, sev: 'critical' },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9]{36,}/, sev: 'critical' },
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/, sev: 'critical' },
  { name: 'Generic Secret Assign', pattern: /(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/i, sev: 'high' },
  { name: 'Clerk Secret', pattern: /sk_(?:test_|live_)[a-zA-Z0-9]{40,}/, sev: 'critical' },
  { name: 'Supabase JWT', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{40,}/, sev: 'critical' },
  { name: 'Gemini Key', pattern: /AIza[a-zA-Z0-9_-]{35}/, sev: 'critical' },
  { name: 'Sentry Token', pattern: /sntrys_[a-zA-Z0-9_-]{40,}/, sev: 'critical' },
  { name: 'Postgres URL with creds', pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/, sev: 'critical' },
];

const CODE_CHECKS = [
  {
    name: 'process.env in Edge function',
    test: (line) => /process\.env\./.test(line),
    sev: 'high',
    fileFilter: (f) => f.startsWith('functions/'),
    msg: 'Use context.env.* in Edge functions',
  },
  {
    name: 'Prisma import in frontend',
    test: (line) => /(?:from\s+['"]@prisma\/client['"]|require\(['"]@prisma\/client['"]\))/.test(line),
    sev: 'critical',
    fileFilter: (f) => f.startsWith('components/') || f.startsWith('pages/'),
    msg: 'Prisma client must not be imported in frontend code',
  },
  {
    name: 'Binary FSRS violation',
    test: (line) => /\brating\s*[=:]\s*(?:3|4)\b/.test(line) || /\b(?:ratingValue|srsRating)\s*[=:]\s*(?:3|4)\b/.test(line),
    sev: 'critical',
    fileFilter: (f) => f.includes('fsrs') || f.includes('drill') || f.includes('review'),
    msg: 'PANaCEa uses binary Again(0)/Good(1) only — values 3 and 4 are deprecated',
  },
];

function getStagedFiles() {
  try { return execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' }).trim().split('\n').filter(Boolean); }
  catch { return []; }
}

function getAllTracked() {
  try { return execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n').filter(Boolean); }
  catch { return []; }
}

function scanFile(filePath, content) {
  const issues = [];
  if (filePath.endsWith('.env') || filePath.includes('.env.')) {
    issues.push({ file: filePath, line: 0, pattern: 'env-tracked', sev: 'critical', msg: '.env file tracked in git' });
    return issues;
  }
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.json', '.toml', '.yaml', '.yml', '.md', '.sh', '.sql'].includes(ext)) return issues;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isComment = line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#');
    const isEnvRef = line.includes('process.env.') || line.includes('context.env.') || line.includes('env.');

    for (const { name, pattern, sev } of SECRET_PATTERNS) {
      if (isComment || isEnvRef) continue;
      const m = line.match(pattern);
      if (m) issues.push({ file: filePath, line: i + 1, pattern: name, sev, msg: `${name}: ${m[0].substring(0, 15)}...` });
    }

    for (const { name, test, sev, fileFilter, msg } of CODE_CHECKS) {
      if (fileFilter && !fileFilter(filePath)) continue;
      if (test(line)) issues.push({ file: filePath, line: i + 1, pattern: name, sev, msg });
    }
  }
  return issues;
}

function main() {
  const args = process.argv.slice(2);
  const scanAll = args.includes('--all');
  const pathArg = args.find((a) => a.startsWith('--path='))?.split('=')[1];

  let files;
  if (pathArg) files = getAllTracked().filter((f) => f.startsWith(pathArg));
  else if (scanAll) files = getAllTracked().filter((f) => /\.(ts|tsx|js|jsx|json|toml|yaml|yml|sh|sql|env)$/.test(f));
  else files = getStagedFiles();

  if (files.length === 0) { console.log('[security-scan] No files to scan.'); process.exit(0); }
  console.log(`[security-scan] Scanning ${files.length} files...`);

  const all = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    all.push(...scanFile(f, fs.readFileSync(f, 'utf8')));
  }

  if (all.length === 0) { console.log('[security-scan] Clean.'); process.exit(0); }

  const crit = all.filter((i) => i.sev === 'critical');
  const high = all.filter((i) => i.sev === 'high');

  if (crit.length) {
    console.error('\n\u{1F534} CRITICAL:');
    crit.forEach((i) => console.error(`  ${i.file}:${i.line} [${i.pattern}] ${i.msg}`));
  }
  if (high.length) {
    console.error('\n\u{1F7E0} HIGH:');
    high.forEach((i) => console.error(`  ${i.file}:${i.line} [${i.pattern}] ${i.msg}`));
  }

  console.log(`\n[security-scan] ${all.length} issues (${crit.length} critical, ${high.length} high)`);
  process.exit(crit.length ? 2 : high.length ? 1 : 0);
}

main();
