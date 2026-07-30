import { getCompiledGraph, registerGraphBuilder, type CompiledStateGraph } from '../orchestrator/graphRegistry.js';
import { buildContentEnrichmentAgent } from '../agents/contentEnrichment.js';

registerGraphBuilder('content-enrichment', () => buildContentEnrichmentAgent({}));

export default (await getCompiledGraph('content-enrichment')) as unknown as CompiledStateGraph;