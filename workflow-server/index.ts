/**
 * Workflow DevKit HTTP server for PANaCEa durable automation.
 *
 * Started via `npm run workflow:dev` (Nitro). Routes mirror the automation lanes
 * in scripts/automation/ and the panacea-verify ladder.
 */
import express from 'express';
import { getRun, resumeHook, start } from 'workflow/api';
import {
  contentFlagReviewWorkflow,
  dailyOpsWorkflow,
  dbHealthCycleWorkflow,
  verifyChangeWorkflow,
  weeklyMaintenanceWorkflow,
} from '../workflows/index';

const app = express();
app.use(express.json());

function workflowError(res: express.Response, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Unknown workflow error';
  return res.status(status).json({ error: message });
}

app.get('/api/workflows/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'panacea-workflows',
    workflows: [
      'verify-change',
      'db-health-cycle',
      'daily-ops',
      'weekly-maintenance',
      'content-flag-review',
    ],
  });
});

app.post('/api/workflows/verify-change', async (req, res) => {
  try {
    const run = await start(verifyChangeWorkflow, [req.body ?? {}]);
    return res.status(202).json({ runId: run.runId, status: 'started' });
  } catch (error) {
    return workflowError(res, error);
  }
});

app.post('/api/workflows/db-health-cycle', async (req, res) => {
  try {
    const run = await start(dbHealthCycleWorkflow, [req.body ?? {}]);
    return res.status(202).json({ runId: run.runId, status: 'started' });
  } catch (error) {
    return workflowError(res, error);
  }
});

app.post('/api/workflows/daily-ops', async (req, res) => {
  try {
    const run = await start(dailyOpsWorkflow, [req.body ?? {}]);
    return res.status(202).json({ runId: run.runId, status: 'started' });
  } catch (error) {
    return workflowError(res, error);
  }
});

app.post('/api/workflows/weekly-maintenance', async (req, res) => {
  try {
    const run = await start(weeklyMaintenanceWorkflow, [req.body ?? {}]);
    return res.status(202).json({ runId: run.runId, status: 'started' });
  } catch (error) {
    return workflowError(res, error);
  }
});

app.post('/api/workflows/content-flag-review', async (req, res) => {
  try {
    const { flagId, questionId, flagType, reviewerId, reviewTimeout } = req.body ?? {};
    if (!flagId || !questionId || !flagType) {
      return res.status(400).json({
        error: 'flagId, questionId, and flagType are required',
      });
    }
    const run = await start(contentFlagReviewWorkflow, [
      { flagId, questionId, flagType, reviewerId, reviewTimeout },
    ]);
    return res.status(202).json({
      runId: run.runId,
      status: 'started',
      hookToken: `content-flag-review:${flagId}`,
    });
  } catch (error) {
    return workflowError(res, error);
  }
});

/** Resume a hook (e.g. admin approve/reject for content-flag-review). */
app.post('/api/workflows/resume', async (req, res) => {
  try {
    const { token, data } = req.body ?? {};
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }
    await resumeHook(token, data);
    return res.json({ ok: true, token });
  } catch (error) {
    return workflowError(res, error);
  }
});

app.get('/api/workflows/runs/:runId', async (req, res) => {
  try {
    const run = getRun(req.params.runId);
    const status = await run.status;
    const payload: Record<string, unknown> = { runId: req.params.runId, status };

    if (status === 'completed') {
      payload.result = await run.returnValue;
    }

    return res.json(payload);
  } catch (error) {
    return workflowError(res, error, 404);
  }
});

export default app;
