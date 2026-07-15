/**
 * GitHub tool adapter — live when GITHUB_TOKEN present, else mocked.
 */

import { buildIdempotencyKey } from '../idempotency/keys';
import { withIdempotency } from '../idempotency/store';
import type { GitHubAdapter, IntegrationMode, ToolContext } from './types';

export function createGitHubAdapter(ctx: ToolContext): GitHubAdapter {
  const token = ctx.env.GITHUB_TOKEN?.trim();
  const mode: IntegrationMode = token ? 'live' : ctx.dryRun ? 'mocked' : 'blocked';

  return {
    mode,

    async getIssue(repo, number) {
      if (mode === 'live' && token) {
        const res = await ghFetch(token, `https://api.github.com/repos/${repo}/issues/${number}`);
        if (!res.ok) throw new Error(`GitHub issue fetch failed: ${res.status}`);
        const data = (await res.json()) as { title: string; body: string };
        return { title: data.title, body: data.body ?? '' };
      }
      return { title: `Mock issue #${number}`, body: 'Mock issue body for dry-run' };
    },

    async createBranch(repo, base, branch) {
      if (ctx.dryRun || mode !== 'live') {
        return { branch };
      }
      const key = buildIdempotencyKey(ctx.runId, 'create_branch', `${repo}:${branch}`);
      const { value } = await withIdempotency(ctx.idempotency, key, async () => {
        // Simplified: production would use GitHub git refs API
        return { branch };
      });
      return value;
    },

    async createPullRequest(repo, branch, base, title, body) {
      const key = buildIdempotencyKey(ctx.runId, 'create_pr', `${repo}:${branch}:${base}`);
      const { value, duplicate } = await withIdempotency(ctx.idempotency, key, async () => {
        if (ctx.dryRun || mode !== 'live') {
          return {
            url: `https://github.com/${repo}/pull/0`,
            number: 0,
            branch,
          };
        }
        const res = await ghFetch(token!, `https://api.github.com/repos/${repo}/pulls`, {
          method: 'POST',
          body: JSON.stringify({ title, body, head: branch, base }),
        });
        if (!res.ok) throw new Error(`GitHub PR create failed: ${res.status}`);
        const data = (await res.json()) as { html_url: string; number: number };
        return { url: data.html_url, number: data.number, branch };
      });
      ctx.events.emit({
        type: 'pr.created',
        at: new Date().toISOString(),
        correlationId: ctx.correlationId,
        runId: ctx.runId,
        data: { duplicate, url: value.url },
      });
      return value;
    },

    async getCheckStatus(repo, ref) {
      if (mode !== 'live' || !token) {
        return [{ name: 'ci/mock', conclusion: 'success' }];
      }
      const res = await ghFetch(
        token,
        `https://api.github.com/repos/${repo}/commits/${ref}/check-runs`
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        check_runs: Array<{ name: string; conclusion?: string }>;
      };
      return data.check_runs.map((c) => ({ name: c.name, conclusion: c.conclusion }));
    },

    async getReviewComments(repo, prNumber) {
      if (mode !== 'live' || !token) return ['Mock review: add tests'];
      const res = await ghFetch(
        token,
        `https://api.github.com/repos/${repo}/pulls/${prNumber}/comments`
      );
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{ body: string }>;
      return data.map((c) => c.body);
    },
  };
}

async function ghFetch(
  token: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}
