import { getCompiledGraph, registerGraphBuilder, type CompiledStateGraph } from '../orchestrator/graphRegistry.js';
import { buildIncidentResponderAgent } from '../agents/incidentResponder.js';

registerGraphBuilder('incident-responder', () => buildIncidentResponderAgent({}));

export default (await getCompiledGraph('incident-responder')) as unknown as CompiledStateGraph;