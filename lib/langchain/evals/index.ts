/**
 * LangSmith Evaluation Module for PANaCEa Agents
 *
 * Provides evaluation datasets, runners, and pipeline configuration
 * for measuring and monitoring agent quality.
 *
 * @module lib.langchain.evals
 */

export {
  // Datasets
  standardizedPatientExamples,
  ddxGeneratorExamples,
  soapNoteGraderExamples,
  feedbackSummarizerExamples,
  allEvalDatasets,
  getExamplesForAgent,
  getExamplesByTag,
  getExamplesByDifficulty,
  type EvalExample,
  type EvalDataset,
} from './datasets';

export {
  // Pipeline configuration
  defaultPipelineConfig,
  getPipelineConfig,
  getGitHubActionsWorkflow,
  getQualityGateCheckerScript,
  type EvalPipelineConfig,
} from './pipeline';

// Runner is exported as a script, not a module
// Use: npm run eval:agents
