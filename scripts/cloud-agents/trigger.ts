#!/usr/bin/env npx tsx
/**
 * Fire-and-forget: launch a Cloud Agent with a custom instruction.
 * Manual-only helper. PANaCEa does not schedule generic cloud-agent runs.
 * Usage:
 *   npx tsx scripts/cloud-agents/trigger.ts --instruction "Refactor X to Y"
 *   npx tsx scripts/cloud-agents/trigger.ts --instruction "Add tests for lib/foo.ts" --branch main
 *   CURSOR_AGENTS_API_KEY=xxx npx tsx scripts/cloud-agents/trigger.ts -i "Fix lint in components/"
 *
 * Requires CURSOR_AGENTS_API_KEY in env (or .env). Optional: CURSOR_AGENTS_REPO (defaults to current git remote).
 */

import { execSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

import { launchAgent } from './client.js';

function getRepoFromGit(): string | undefined {
  try {
    const out = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    if (out.startsWith('https://github.com/') || out.startsWith('git@github.com:')) {
      return out.replace(/^git@github.com:/, 'https://github.com/').replace(/\.git$/, '');
    }
    return out;
  } catch {
    return undefined;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let instruction = '';
  let branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'main';
  let repo = process.env.CURSOR_AGENTS_REPO || process.env.GITHUB_REPOSITORY;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instruction' || args[i] === '-i') {
      instruction = args[++i] ?? '';
    } else if (args[i] === '--branch' || args[i] === '-b') {
      branch = args[++i] ?? branch;
    } else if (args[i] === '--repo' || args[i] === '-r') {
      repo = args[++i] ?? repo;
    }
  }

  if (!instruction.trim()) {
    console.error(
      'Usage: npx tsx scripts/cloud-agents/trigger.ts --instruction "<task>" [--branch BRANCH] [--repo URL]'
    );
    process.exit(1);
  }

  const repository = repo?.includes('/')
    ? repo.startsWith('http')
      ? repo
      : `https://github.com/${repo}`
    : getRepoFromGit();

  const result = await launchAgent({
    instruction,
    repository: repository || undefined,
    ref: branch,
    autoCreatePr: false,
  });

  console.log('Agent launched:', result.id);
  console.log('(Fire-and-forget; check Cursor Dashboard or webhook for status.)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
