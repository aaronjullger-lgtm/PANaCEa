import { routeAgentRequest } from 'agents';
import { LearnerAgent, StudyPlanRevisionWorkflow } from './LearnerAgent';

export { LearnerAgent, StudyPlanRevisionWorkflow };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return (
      (await routeAgentRequest(request, env, {
        cors: true,
        prefix: '/agents',
      })) ?? new Response('Not found', { status: 404 })
    );
  },
};

interface Env {
  LEARNER_AGENT: DurableObjectNamespace;
  STUDY_PLAN_REVISION_WORKFLOW: Workflow;
  RATE_LIMIT_KV?: KVNamespace;
}
