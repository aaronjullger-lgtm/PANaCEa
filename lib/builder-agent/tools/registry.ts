import { createCodeRabbitAdapter } from './coderabbit';
import { createDocsAdapter } from './docs';
import { createGitHubAdapter } from './github';
import { createLinearAdapter } from './linear';
import { createSentryAdapter } from './sentry';
import type { BuilderToolRegistry, ToolContext } from './types';

export function createBuilderToolRegistry(ctx: ToolContext): BuilderToolRegistry {
  return {
    github: createGitHubAdapter(ctx),
    linear: createLinearAdapter(ctx),
    sentry: createSentryAdapter(ctx),
    docs: createDocsAdapter(ctx),
    coderabbit: createCodeRabbitAdapter(ctx),
  };
}

export function integrationStatus(registry: BuilderToolRegistry): Record<string, 'live' | 'mocked' | 'blocked'> {
  return {
    github: registry.github.mode,
    linear: registry.linear.mode,
    sentry: registry.sentry.mode,
    docs: registry.docs.mode,
    coderabbit: registry.coderabbit.mode,
  };
}
