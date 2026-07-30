import { getCompiledGraph, registerGraphBuilder, type CompiledStateGraph } from '../orchestrator/graphRegistry.js';
import { buildPRTriageAgent } from '../agents/prTriage.js';

registerGraphBuilder('pr-triage', () => buildPRTriageAgent({}));

export default (await getCompiledGraph('pr-triage')) as unknown as CompiledStateGraph;