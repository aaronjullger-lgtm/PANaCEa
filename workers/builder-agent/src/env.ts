import type { BuilderAgentEnv } from '@/lib/builder-agent/state/types';

export interface Env extends BuilderAgentEnv {
  BUILDER_AGENT: DurableObjectNamespace;
  BUILD_WORKFLOW: Workflow;
  WORKER_LABEL?: string;
}

export const DEFAULT_WORKSPACE_ID = 'panacea';
