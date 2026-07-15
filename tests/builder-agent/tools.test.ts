import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '@/lib/builder-agent/idempotency/store';
import { CollectingEventSink } from '@/lib/builder-agent/observability/events';
import { createBuilderToolRegistry } from '@/lib/builder-agent/tools/registry';
import type { ToolContext } from '@/lib/builder-agent/tools/types';

describe('BuilderAgent tools', () => {
  const baseCtx = (): ToolContext => ({
    env: {},
    correlationId: 'corr_test',
    runId: 'run_test',
    dryRun: true,
    idempotency: new InMemoryIdempotencyStore(),
    events: new CollectingEventSink(),
  });

  it('uses mocked GitHub in dry-run without token', async () => {
    const tools = createBuilderToolRegistry(baseCtx());
    expect(tools.github.mode).toBe('mocked');
    const pr = await tools.github.createPullRequest(
      'org/repo',
      'feature/test',
      'main',
      'title',
      'body'
    );
    expect(pr.url).toContain('github.com');
  });

  it('deduplicates PR creation', async () => {
    const ctx = baseCtx();
    const tools = createBuilderToolRegistry(ctx);
    const a = await tools.github.createPullRequest('org/repo', 'b1', 'main', 't', 'b');
    const b = await tools.github.createPullRequest('org/repo', 'b1', 'main', 't', 'b');
    expect(a.url).toBe(b.url);
  });

  it('returns mock Sentry issue', async () => {
    const tools = createBuilderToolRegistry(baseCtx());
    const issue = await tools.sentry.getIssue('123');
    expect(issue.title).toContain('Mock Sentry');
  });

  it('idempotent Linear comments', async () => {
    const ctx = baseCtx();
    const tools = createBuilderToolRegistry(ctx);
    const key = 'linear-key-1';
    const a = await tools.linear.addComment('issue-1', 'progress', key);
    const b = await tools.linear.addComment('issue-1', 'progress', key);
    expect(a.commentId).toBeDefined();
    expect(b.commentId).toContain('dup');
  });
});
