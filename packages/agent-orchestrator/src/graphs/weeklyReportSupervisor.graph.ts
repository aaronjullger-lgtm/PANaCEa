import { getCompiledGraph, registerGraphBuilder, type CompiledStateGraph } from '../orchestrator/graphRegistry.js';
import { buildWeeklyReportSupervisor } from '../agents/weeklyReportSupervisor.js';

registerGraphBuilder('weekly-report-supervisor', () => buildWeeklyReportSupervisor({}));

export default (await getCompiledGraph('weekly-report-supervisor')) as unknown as CompiledStateGraph;