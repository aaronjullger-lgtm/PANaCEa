import { enqueueTask, type TaskType } from './workQueue.js';
import { remember } from '../clients/qdrant.js';

export interface PipelineStage {
  name: string;
  taskType: TaskType;
  title: string;
  description: string;
  priority: number;
  dependsOn?: string[];
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
}

export const PIPELINES: Pipeline[] = [
  {
    id: 'feature-dev',
    name: 'Feature Development Pipeline',
    description: 'Full feature development: plan → develop → test → review → security-audit → deploy-check',
    stages: [
      {
        name: 'plan', taskType: 'custom', title: 'Architecture plan for feature',
        description: 'Run the architecture-planner agent to break the feature into ordered implementation steps.',
        priority: 1,
      },
      {
        name: 'develop', taskType: 'feature', title: 'Implement the feature',
        description: 'Run the code-developer agent in a worktree following the plan. Write focused changes, typecheck, commit.',
        priority: 1, dependsOn: ['plan'],
      },
      {
        name: 'test', taskType: 'test', title: 'Run test suite',
        description: 'Run the test-runner agent to verify typecheck + lint + tests pass.',
        priority: 1, dependsOn: ['develop'],
      },
      {
        name: 'review', taskType: 'review', title: 'Adversarial code review',
        description: 'Run the code-reviewer agent against the diff. REQUEST_CHANGES loops back to develop.',
        priority: 2, dependsOn: ['test'],
      },
      {
        name: 'security', taskType: 'review', title: 'Security audit',
        description: 'Run the security-auditor agent on the diff. Check for auth bypass, RLS gaps, secret leaks.',
        priority: 2, dependsOn: ['review'],
      },
      {
        name: 'deploy-check', taskType: 'review', title: 'Deploy readiness check',
        description: 'Run the deploy-readiness agent. 10-point checklist. BLOCK if any critical check fails.',
        priority: 2, dependsOn: ['security'],
      },
    ],
  },
  {
    id: 'content-quality',
    name: 'Content Quality Pipeline',
    description: 'Content generation → clinical validation → question scoring → gap analysis → audit',
    stages: [
      {
        name: 'generate', taskType: 'content', title: 'Generate/enrich content',
        description: 'Run the content-enrichment agent to propose enrichment candidates from provided sources.',
        priority: 1,
      },
      {
        name: 'validate', taskType: 'content', title: 'Clinical validation',
        description: 'Run the clinical-validator agent against the generated content + source. Flag UNVERIFIED/INCORRECT.',
        priority: 1, dependsOn: ['generate'],
      },
      {
        name: 'score', taskType: 'content', title: 'Question quality scoring',
        description: 'Run the question-scorer agent on any generated questions. Flag overall < 0.7 for revision.',
        priority: 2, dependsOn: ['validate'],
      },
      {
        name: 'gap', taskType: 'content', title: 'Blueprint gap analysis',
        description: 'Run the content-gap-analyzer to check blueprint coverage after the new content.',
        priority: 3, dependsOn: ['score'],
      },
      {
        name: 'audit', taskType: 'content', title: 'Content audit',
        description: 'Run the content-audit agent on the updated content set. File Linear issues for findings.',
        priority: 3, dependsOn: ['gap'],
      },
    ],
  },
  {
    id: 'incident-response',
    name: 'Incident Response Pipeline',
    description: 'Detect → triage → file → postmortem → deploy-check',
    stages: [
      {
        name: 'triage', taskType: 'monitor', title: 'Incident triage',
        description: 'Run the incident-responder agent on recent Sentry issues. Score severity, file Linear.',
        priority: 0,
      },
      {
        name: 'fix', taskType: 'bugfix', title: 'Develop fix',
        description: 'Run the code-developer agent to fix the incident root cause in a worktree.',
        priority: 1, dependsOn: ['triage'],
      },
      {
        name: 'postmortem', taskType: 'custom', title: 'Write postmortem',
        description: 'Run the postmortem-writer agent to produce a structured RCA.',
        priority: 2, dependsOn: ['fix'],
      },
    ],
  },
  {
    id: 'pr-gate',
    name: 'PR Gate Pipeline',
    description: 'Review → security → accessibility → performance → merge-readiness',
    stages: [
      {
        name: 'review', taskType: 'review', title: 'Code review',
        description: 'Run the code-reviewer agent on the PR diff.',
        priority: 1,
      },
      {
        name: 'security', taskType: 'review', title: 'Security audit',
        description: 'Run the security-auditor on the PR diff.',
        priority: 1, dependsOn: ['review'],
      },
      {
        name: 'a11y', taskType: 'review', title: 'Accessibility audit',
        description: 'Run the accessibility-auditor on any changed components.',
        priority: 2, dependsOn: ['security'],
      },
      {
        name: 'perf', taskType: 'review', title: 'Performance check',
        description: 'Run the performance-optimizer on the changed modules.',
        priority: 2, dependsOn: ['a11y'],
      },
    ],
  },
];

export async function launchPipeline(pipelineId: string, context: string): Promise<{ enqueued: number; pipelineName: string }> {
  const pipeline = PIPELINES.find((p) => p.id === pipelineId);
  if (!pipeline) throw new Error(`Pipeline "${pipelineId}" not found. Available: ${PIPELINES.map((p) => p.id).join(', ')}`);

  let enqueued = 0;
  for (const stage of pipeline.stages) {
    const task = await enqueueTask({
      type: stage.taskType,
      title: `[${pipeline.name}] ${stage.title}`,
      description: `${stage.description}\n\nContext: ${context}`,
      priority: stage.priority,
      tags: ['pipeline', pipeline.id, stage.name],
    });
    enqueued++;
    console.log(`  enqueued stage "${stage.name}": ${task.id}`);
  }

  await remember('context', `pipeline_${pipelineId}_${Date.now()}`, `pipeline ${pipeline.name} launched with context: ${context}`, {
    kind: 'pipeline_launch', pipelineId, pipelineName: pipeline.name, stagesEnqueued: enqueued,
  });

  return { enqueued, pipelineName: pipeline.name };
}

export function describePipelines(): Array<{ id: string; name: string; description: string; stageCount: number }> {
  return PIPELINES.map((p) => ({ id: p.id, name: p.name, description: p.description, stageCount: p.stages.length }));
}