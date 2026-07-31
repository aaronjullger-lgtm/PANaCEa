/**
 * Agent Pipelines — Production-ready multi-agent workflows.
 *
 * These pipelines compose the middleware layer into complete,
 * production-ready workflows for PANaCEa's content operations:
 *
 * - ClinicalContentQA: Multi-agent clinical content validation
 * - ContentGenerationPipeline: Orchestrator-driven batch content generation with QA gates
 *
 * @module lib/agents/pipelines
 */

export {
  runClinicalContentQA,
  runBatchClinicalContentQA,
  formatQAReport,
  type ClinicalContentQAReport,
  type ClinicalContentQAInput,
  type ClinicalAccuracyResult,
  type BlueprintAlignmentResult,
  type SafetyReviewResult,
  type QAVerdict,
} from './clinicalContentQA';

export {
  runContentGenerationPipeline,
  generateConditionWithQA,
  generateQuestionsWithQA,
  formatPipelineResult,
  type ContentGenerationPipelineResult,
  type ContentGenerationPipelineConfig,
  type GenerationTask,
  type GeneratedItem,
  type ContentType,
} from './contentGenerationPipeline';
