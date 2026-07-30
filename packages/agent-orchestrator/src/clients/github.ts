/**
 * GitHub client — for the PR-triage agent.
 *
 * Uses raw fetch against the GitHub REST/GraphQL API rather than a heavy SDK,
 * to keep the orchestrator dependency footprint small. Auth via GITHUB_PAT.
 *
 * Doc references (researched 2026-07):
 *  - Pulls PR files/diffs: GET /repos/{owner}/{repo}/pulls/{pr_number}
 *  - Reviews + inline comments: POST /repos/{owner}/{repo}/pulls/{pr_number}/comments
 *
 * @module packages/agent-orchestrator/src/clients/github
 */

import { getEnv, getCapabilities } from '../config/env.js';

export interface PRInfo {
  number: number;
  title: string;
  body: string | null;
  head: string;
  base: string;
  user: string;
  url: string;
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

const GITHUB_API = 'https://api.github.com';

function authHeaders(): Record<string, string> {
  const env = getEnv();
  return {
    Authorization: `Bearer ${env.GITHUB_PAT ?? ''}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'panacea-agent-orchestrator',
  };
}

function parseRepo(): { owner: string; repo: string } | null {
  const env = getEnv();
  const repo = env.GITHUB_REPO;
  if (!repo || !repo.includes('/')) return null;
  const parts = repo.split('/');
  const owner = parts[0];
  const name = parts[1];
  if (!owner || !name) return null;
  return { owner, repo: name };
}

export async function getPR(prNumber: number): Promise<PRInfo | null> {
  if (!getCapabilities().github) return null;
  const r = parseRepo();
  if (!r) return null;
  try {
    const res = await fetch(`${GITHUB_API}/repos/${r.owner}/${r.repo}/pulls/${prNumber}`, {
      headers: authHeaders() as Record<string, string>,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      number: number;
      title: string;
      body: string | null;
      head: { ref: string };
      base: { ref: string };
      user: { login: string };
      html_url: string;
    };
    return {
      number: j.number,
      title: j.title,
      body: j.body,
      head: j.head.ref,
      base: j.base.ref,
      user: j.user?.login ?? 'unknown',
      url: j.html_url,
    };
  } catch (err) {
    console.warn(`[agent-orchestrator] GitHub getPR ${prNumber} failed:`, err);
    return null;
  }
}

export async function getPRFiles(prNumber: number, maxFiles = 30): Promise<PRFile[]> {
  if (!getCapabilities().github) return [];
  const r = parseRepo();
  if (!r) return [];
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${r.owner}/${r.repo}/pulls/${prNumber}/files?per_page=${maxFiles}`,
      { headers: authHeaders() as Record<string, string> },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch: string | null;
    }>;
    return j.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    }));
  } catch (err) {
    console.warn(`[agent-orchestrator] GitHub getPRFiles ${prNumber} failed:`, err);
    return [];
  }
}

export async function postPRReview(
  prNumber: number,
  body: string,
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' = 'COMMENT',
): Promise<boolean> {
  if (!getCapabilities().github) return false;
  const r = parseRepo();
  if (!r) return false;
  try {
    const res = await fetch(`${GITHUB_API}/repos/${r.owner}/${r.repo}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeaders() as Record<string, string>) },
      body: JSON.stringify({ body, event }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[agent-orchestrator] GitHub postPRReview ${prNumber} failed:`, err);
    return false;
  }
}

export function isGitHubEnabled(): boolean {
  return getCapabilities().github;
}

export function getRepo(): string | undefined {
  return getEnv().GITHUB_REPO;
}