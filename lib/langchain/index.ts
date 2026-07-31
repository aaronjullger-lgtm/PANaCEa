/**
 * LangChain Integration — Barrel Export
 *
 * Central entry point for PANaCEa's LangChain integration.
 * Import everything from `@/lib/langchain` rather than
 * reaching into submodules.
 *
 * @module lib/langchain
 * Sprint: LangChain Integration — Sprint 1
 */

// ─── Configuration ────────────────────────────────────────────────────────
export {
  MODEL_REGISTRY,
  TASK_MODEL_MAP,
  DEFAULT_PARAMS,
  getTracingConfig,
  type ModelProvider,
  type ModelConfig,
  type ModelName,
  type TaskType,
  type TracingConfig,
} from './config';

// ─── Model Factory ────────────────────────────────────────────────────────
export {
  createModel,
  getAvailableProviders,
  isModelAvailable,
  type AIEnvKeys,
  type CreateModelOptions,
} from './models';

// ─── Router ───────────────────────────────────────────────────────────────
export {
  routeTask,
  routeStructured,
  type RouteOptions,
  type RouteResult,
} from './router';

// ─── Tracing ──────────────────────────────────────────────────────────────
export {
  buildTracingConfig,
  isTracingEnabled,
  type TracingOptions,
  type TracingConfig as TracingConfigResult,
} from './tracing';

// ─── Environment Adapters ─────────────────────────────────────────────────
export {
  fromCloudflareEnv,
  fromProcessEnv,
  fromExplicitKeys,
} from './envAdapter';

// ─── Chains ───────────────────────────────────────────────────────────────
export {
  generateQuestions,
  critiqueQuestion,
  rewriteQuestion,
  generateConditionContentLC,
  generateLabContentLC,
  generateImagingContentLC,
  generateTreatmentContentLC,
  generatePhysiologyContentLC,
  type QuestionGenerationParams,
  type QuestionGenerationResult,
  type ContentGenerationResult,
  type ContentGenerationOptions,
} from './chains';

// ─── Agent Factory ───────────────────────────────────────────────────────
export {
  createAgent,
  createQuestionGeneratorAgent,
  createTutorAgent,
  createOsceAgent,
  type AgentConfig,
  type AgentInstance,
} from './agent';

// ─── Graph Pipelines ─────────────────────────────────────────────────────
export {
  compiledQuestionPipeline,
  runQuestionPipeline,
  type PipelineResult,
  type PipelineInput,
  type QuestionDraft,
} from './graphs/questionPipeline';

// ─── OSCE Encounter Graph ────────────────────────────────────────────────
export {
  compiledOsceGraph,
  OsceEncounterState,
  StudentIntentSchema,
  type OsceState,
  type OsceUpdate,
  type OscePhase,
  type OsceGraphInput,
  type TranscriptMessage,
  type StudentIntent,
  type StudentIntentResult,
  type CompiledOsceGraph,
} from './graphs/osceEncounter';

// ─── Clinical Deep Research Graph ────────────────────────────────────────
export {
  compiledClinicalResearchGraph,
  runClinicalResearch,
  type ClinicalResearchInput,
  type ClinicalResearchResult,
  type ClinicalReport,
  type ResearchTask,
  type ResearchSource,
  type ReportSection,
} from './graphs/clinicalResearch';

// ─── Deep Agent Harness (deepagents wrapper) ─────────────────────────────
export {
  createPanaceaAgent,
  createContentAgent,
  createTutorAgent as createDeepTutorAgent,
  createQuestionAgent,
  createEdgeAgent,
  type PanaceaDeepAgentConfig,
  type PanaceaAgent,
} from './deepagent';

// ─── MCP Tools Integration ───────────────────────────────────────────────
export {
  loadPanaceaMcpTools,
  checkMcpHealth,
  prefixMcpTools,
  filterEdgeSafeServers,
  PANACEA_MCP_SERVERS,
  type McpServerConfig,
  type McpToolsResult,
} from './mcp';
