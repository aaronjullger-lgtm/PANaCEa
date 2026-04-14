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
  configureLangSmithEnv,
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
