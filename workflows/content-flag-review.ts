import { createHook, sleep } from 'workflow';
import { FatalError } from 'workflow';
import {
  appendTaskToReport,
  createWorkflowLaneReport,
  persistLaneReport,
  streamLaneTaskEvent,
} from './steps/reporting';
import { applyFlagDecision } from './steps/content-flag';
import type {
  ContentFlagReviewDecision,
  ContentFlagReviewInput,
  ContentFlagReviewResult,
} from './types/content-flag';

export type {
  ContentFlagDecision,
  ContentFlagReviewInput,
  ContentFlagReviewDecision,
  ContentFlagReviewResult,
} from './types/content-flag';

export async function contentFlagReviewWorkflow(
  input: ContentFlagReviewInput
): Promise<ContentFlagReviewResult> {
  'use workflow';

  const { flagId, questionId, flagType, reviewTimeout = '7d' } = input;
  const token = `content-flag-review:${flagId}`;

  const report = createWorkflowLaneReport('Content Flag Review', {
    workflow: 'contentFlagReviewWorkflow',
    flagId,
    questionId,
    flagType,
    hookToken: token,
  });

  const queued = {
    name: 'Await admin decision',
    status: 'completed' as const,
    message: `Hook registered for flag ${flagId} (${flagType})`,
  };
  appendTaskToReport(report, queued);
  await streamLaneTaskEvent(queued);

  const hook = createHook<ContentFlagReviewDecision>({ token });

  const decisionResult = await Promise.race([
    hook.then((decision) => ({ decision, timedOut: false as const })),
    sleep(reviewTimeout).then(() => ({ decision: null, timedOut: true as const })),
  ]);

  if (decisionResult.timedOut || !decisionResult.decision) {
    const timeoutTask = {
      name: 'Review timeout',
      status: 'warning' as const,
      message: `No decision within ${reviewTimeout}`,
    };
    appendTaskToReport(report, timeoutTask);
    await streamLaneTaskEvent(timeoutTask);

    const reportPaths = await persistLaneReport(report, `content-flag-review-${flagId}`);

    return {
      flagId,
      decision: 'requeue',
      reviewerId: 'system:timeout',
      applied: false,
      timedOut: true,
      reportPaths,
      summary: report.summary,
    };
  }

  const { decision, reviewerId, notes } = decisionResult.decision;

  if (!['approve', 'reject', 'requeue'].includes(decision)) {
    throw new FatalError(`Invalid decision: ${decision}`);
  }

  const applyResult = await applyFlagDecision(flagId, {
    decision,
    reviewerId,
    notes,
  });

  const applyTask = {
    name: 'Apply decision',
    status: applyResult.applied ? ('completed' as const) : ('failed' as const),
    message: applyResult.message,
    details: { decision, reviewerId, notes },
  };
  appendTaskToReport(report, applyTask);
  await streamLaneTaskEvent(applyTask);

  const reportPaths = await persistLaneReport(report, `content-flag-review-${flagId}`);

  return {
    flagId,
    decision,
    reviewerId,
    applied: applyResult.applied,
    timedOut: false,
    reportPaths,
    summary: report.summary,
  };
}
