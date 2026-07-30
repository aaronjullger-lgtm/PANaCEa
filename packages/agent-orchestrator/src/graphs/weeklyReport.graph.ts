import { getCompiledGraph, registerGraphBuilder, type CompiledStateGraph } from '../orchestrator/graphRegistry.js';
import { buildWeeklyReportAgent } from '../agents/weeklyReport.js';

registerGraphBuilder('weekly-report', () => buildWeeklyReportAgent({}));

export default (await getCompiledGraph('weekly-report')) as unknown as CompiledStateGraph;