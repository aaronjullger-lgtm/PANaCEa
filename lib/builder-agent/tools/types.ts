/**
 * Builder Agent tool adapter types.
 */

import type { BuilderAgentEnv } from '../state/types';
import type { IdempotencyStore } from '../idempotency/store';
import type { EventSink } from '../observability/events';

export type IntegrationMode = 'live' | 'mocked' | 'blocked';

export interface ToolContext {
  env: Partial<BuilderAgentEnv>;
  correlationId: string;
  runId: string;
  dryRun: boolean;
  idempotency: IdempotencyStore;
  events: EventSink;
}

export interface GitHubPullRequest {
  url: string;
  number: number;
  branch: string;
}

export interface GitHubAdapter {
  mode: IntegrationMode;
  getIssue(repo: string, number: number): Promise<{ title: string; body: string }>;
  createBranch(repo: string, base: string, branch: string): Promise<{ branch: string }>;
  createPullRequest(
    repo: string,
    branch: string,
    base: string,
    title: string,
    body: string
  ): Promise<GitHubPullRequest>;
  getCheckStatus(repo: string, ref: string): Promise<Array<{ name: string; conclusion?: string }>>;
  getReviewComments(repo: string, prNumber: number): Promise<string[]>;
}

export interface LinearAdapter {
  mode: IntegrationMode;
  getIssue(id: string): Promise<{ title: string; description: string }>;
  addComment(issueId: string, body: string, idempotencyKey: string): Promise<{ commentId: string }>;
}

export interface SentryAdapter {
  mode: IntegrationMode;
  getIssue(issueId: string): Promise<{
    title: string;
    culprit?: string;
    stackTrace?: string;
    release?: string;
  }>;
}

export interface DocsAdapter {
  mode: IntegrationMode;
  query(query: string, libraryId?: string): Promise<{ answer: string; sources: string[] }>;
}

export interface CodeRabbitAdapter {
  mode: IntegrationMode;
  getReviewFeedback(prUrl: string): Promise<string[]>;
}

export interface BuilderToolRegistry {
  github: GitHubAdapter;
  linear: LinearAdapter;
  sentry: SentryAdapter;
  docs: DocsAdapter;
  coderabbit: CodeRabbitAdapter;
}
