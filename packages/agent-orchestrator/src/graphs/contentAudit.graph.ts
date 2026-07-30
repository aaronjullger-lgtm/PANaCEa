/**
 * LangGraph Studio entry — content-audit graph.
 *
 * Studio loads this via `langgraph.json` → `graphs.content_audit`. The default
 * export MUST be a compiled graph; we build it at import via the registry so
 * Studio can render + invoke it in its UI.
 *
 * @module packages/agent-orchestrator/src/graphs/contentAudit.graph
 */

import { getCompiledGraph, registerGraphBuilder, type CompiledStateGraph } from '../orchestrator/graphRegistry.js';
import { buildContentAuditAgent } from '../agents/contentAudit.js';

registerGraphBuilder('content-audit', () => buildContentAuditAgent({}));

export default (await getCompiledGraph('content-audit')) as unknown as CompiledStateGraph;