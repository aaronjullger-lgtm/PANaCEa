/**
 * HTTP API server for the orchestrator.
 *
 * Endpoints:
 *   GET  /health                       — env + capability status
 *   GET  /agents                       — list registered agents
 *   POST /agents/:role/invoke          — invoke an agent { messages, threadId } -> result
 *   POST /agents/:role/invoke-stream    — SSE stream of agent.run_stream tokens
 *   GET  /memories/:collection?query=  — recall from Qdrant
 *
 * Auth: simple Bearer token via ORCHESTRATOR_API_TOKEN if set; otherwise open
 * (intended to sit behind Vercel/Cloudflare access + Clerk in the dashboard).
 *
 * Tracing: every /invoke attaches the Langfuse handler; shutdown on SIGTERM.
 *
 * @module packages/agent-orchestrator/src/server/api
 */

import express from 'express';
import cors from 'cors';
import { AGENT_REGISTRY, ALL_ROLES, describeAgents } from '../agents/registry.js';
import { finalResponse } from '../orchestrator/factory.js';
import { envStatus, canRunAgents, optionalEnv, getEnv } from '../config/env.js';
import { ensureAllCollections, remember, recall, COLLECTIONS } from '../clients/qdrant.js';
import { shutdownTracing } from '../clients/tracing.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = getEnv().ORCHESTRATOR_API_TOKEN;
  if (!token) return next();
  const header = req.headers.authorization ?? '';
  if (header !== `Bearer ${token}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, ...envStatus() });
});

app.get('/agents', (_req, res) => {
  res.json({ agents: describeAgents() });
});

app.post('/agents/:role/invoke', authMiddleware, async (req, res) => {
  const role = req.params.role as keyof typeof AGENT_REGISTRY;
  if (!(role in AGENT_REGISTRY)) {
    res.status(404).json({ error: `unknown role "${String(role)}". Available: ${ALL_ROLES.join(', ')}` });
    return;
  }
  if (!canRunAgents()) {
    res.status(503).json({ error: 'no LLM provider configured' });
    return;
  }

  const body = (req.body ?? {}) as { messages?: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }>; threadId?: string };
  const rawMessages = body.messages ?? [];
  if (rawMessages.length === 0) {
    res.status(400).json({ error: 'messages[] required' });
    return;
  }
  const messages = rawMessages.map((m) => ({ role: m.role as 'user' | 'system' | 'assistant' | 'tool', content: m.content }));

  const startedAt = new Date().toISOString();
  const runId = `run_${role}_${Date.now()}`;
  const def = AGENT_REGISTRY[role];

  try {
    const agent = await def.build({});
    const result = await agent.invoke({ messages, threadId: body.threadId ?? runId });
    const output = finalResponse(result.messages);

    await remember(
      'runs',
      runId,
      `${role} ${startedAt}: ${output.slice(0, 500)}`,
      { role, startedAt, finishedAt: new Date().toISOString(), outputPreview: output.slice(0, 2000), via: 'http' },
    );

    res.json({
      runId,
      role,
      startedAt,
      finishedAt: new Date().toISOString(),
      output,
      messageCount: result.messages.length,
    });
  } catch (err) {
    await remember(
      'runs',
      runId,
      `${role} ${startedAt} FAILED: ${err instanceof Error ? err.message : String(err)}`,
      { role, startedAt, error: err instanceof Error ? err.message : String(err), via: 'http' },
    );
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), runId });
  }
});

app.post('/agents/:role/invoke-stream', authMiddleware, async (req, res) => {
  const role = req.params.role as keyof typeof AGENT_REGISTRY;
  if (!(role in AGENT_REGISTRY)) {
    res.status(404).json({ error: `unknown role "${String(role)}"` });
    return;
  }
  if (!canRunAgents()) {
    res.status(503).json({ error: 'no LLM provider configured' });
    return;
  }

  const body = (req.body ?? {}) as { messages?: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }>; threadId?: string };
  const rawMessages = body.messages ?? [];
  if (rawMessages.length === 0) {
    res.status(400).json({ error: 'messages[] required' });
    return;
  }
  const messages = rawMessages.map((m) => ({ role: m.role as 'user' | 'system' | 'assistant' | 'tool', content: m.content }));

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const startedAt = new Date().toISOString();
  const runId = `run_${role}_${Date.now()}`;
  const def = AGENT_REGISTRY[role];

  res.write(`data: ${JSON.stringify({ event: 'start', data: { runId, role, startedAt } })}\n\n`);

  try {
    const agent = await def.build({});
    if (agent.streamEvents) {
      for await (const chunk of agent.streamEvents({ messages, threadId: body.threadId ?? runId })) {
        const evt = chunk.event;
        if (evt === 'on_chat_model_stream' || evt === 'on_tool_start' || evt === 'on_tool_end' || evt === 'on_chain_end') {
          res.write(`data: ${JSON.stringify({ event: evt, data: chunk.data })}\n\n`);
        }
      }
    } else {
      const result = await agent.invoke({ messages, threadId: body.threadId ?? runId });
      res.write(`data: ${JSON.stringify({ event: 'complete', data: { output: finalResponse(result.messages) } })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ event: 'done', data: { runId } })}\n\n`);
    res.end();

    const fallbackOutput = 'streamed run (output in event stream)';
    await remember('runs', runId, `${role} ${startedAt}: ${fallbackOutput}`, {
      role, startedAt, finishedAt: new Date().toISOString(), via: 'http-sse',
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ event: 'error', data: { error: err instanceof Error ? err.message : String(err) } })}\n\n`);
    res.end();
    await remember('runs', runId, `${role} ${startedAt} FAILED: ${err instanceof Error ? err.message : String(err)}`, {
      role, startedAt, error: err instanceof Error ? err.message : String(err), via: 'http-sse',
    });
  }
});

app.get('/memories/:collection', async (req, res) => {
  const collectionKey = req.params.collection as keyof typeof COLLECTIONS;
  if (!(collectionKey in COLLECTIONS)) {
    res.status(400).json({ error: `invalid collection. Available: ${Object.keys(COLLECTIONS).join(', ')}` });
    return;
  }
  const query = (req.query.query as string | undefined) ?? '';
  const limit = Math.min(Number(req.query.limit ?? 5), 50);
  const results = await recall(collectionKey, query, limit);
  res.json({ collection: COLLECTIONS[collectionKey], query, results });
});

app.post('/ensure-collections', authMiddleware, async (_req, res) => {
  await ensureAllCollections();
  res.json({ ok: true, collections: Object.values(COLLECTIONS) });
});

// ─── Autonomous fleet endpoints ──────────────────────────────────────────────

app.get('/fleet/tasks', async (_req, res) => {
  const { getActiveTasks } = await import('../autonomous/scheduler.js');
  const tasks = await getActiveTasks();
  res.json({ tasks, count: tasks.length });
});

app.post('/fleet/enqueue', authMiddleware, async (req, res) => {
  const { enqueueTask } = await import('../autonomous/scheduler.js');
  const body = (req.body ?? {}) as { type?: string; title?: string; description?: string; priority?: number; tags?: string[] };
  if (!body.title || !body.description) {
    res.status(400).json({ error: 'title + description required' });
    return;
  }
  const task = await enqueueTask({
    type: (body.type as 'bugfix' | 'feature' | 'refactor' | 'test' | 'review' | 'docs' | 'content' | 'monitor' | 'custom') ?? 'custom',
    title: body.title,
    description: body.description,
    priority: body.priority,
    tags: body.tags,
  });
  res.json({ ok: true, task });
});

app.post('/fleet/tick', authMiddleware, async (_req, res) => {
  const { tick } = await import('../autonomous/scheduler.js');
  const result = await tick();
  res.json(result);
});

let _schedulerHandle: { stop: () => void } | null = null;

app.post('/fleet/start', authMiddleware, async (req, res) => {
  if (_schedulerHandle) {
    res.json({ ok: true, message: 'scheduler already running' });
    return;
  }
  const { startScheduler } = await import('../autonomous/scheduler.js');
  const interval = Number(req.body?.intervalMs ?? 60_000);
  _schedulerHandle = startScheduler(interval);
  res.json({ ok: true, intervalMs: interval });
});

app.post('/fleet/stop', authMiddleware, async (_req, res) => {
  if (_schedulerHandle) {
    _schedulerHandle.stop();
    _schedulerHandle = null;
  }
  res.json({ ok: true });
});

app.get('/fleet/status', async (_req, res) => {
  res.json({ schedulerRunning: !!_schedulerHandle });
});

app.get('/specialists', async (_req, res) => {
  const { describeSpecialists } = await import('../agents/specialists.js');
  res.json({ specialists: describeSpecialists() });
});

app.post('/specialists/:role/invoke', authMiddleware, async (req, res) => {
  const role = req.params.role;
  const { buildSpecialist, SPECIALIST_ROLES } = await import('../agents/specialists.js');
  if (!SPECIALIST_ROLES.includes(role as never)) {
    res.status(404).json({ error: `unknown specialist. Available: ${SPECIALIST_ROLES.join(', ')}` });
    return;
  }
  if (!canRunAgents()) { res.status(503).json({ error: 'no LLM provider configured' }); return; }
  const body = (req.body ?? {}) as { messages?: Array<{ role: string; content: string }> };
  if (!body.messages?.length) { res.status(400).json({ error: 'messages[] required' }); return; }
  try {
    const agent = await buildSpecialist(role as never, {});
    const result = await agent.invoke({ messages: body.messages.map((m) => ({ role: m.role as 'user', content: m.content })) });
    const output = finalResponse(result.messages);
    res.json({ role: req.params.role, output, messageCount: result.messages.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/pipelines', async (_req, res) => {
  const { describePipelines } = await import('../autonomous/pipelines.js');
  res.json({ pipelines: describePipelines() });
});

app.post('/pipelines/:id/launch', authMiddleware, async (req, res) => {
  const { launchPipeline } = await import('../autonomous/pipelines.js');
  const context = (req.body?.context as string) ?? '';
  if (!context) { res.status(400).json({ error: 'context required' }); return; }
  try {
    const result = await launchPipeline(req.params.id as string, context);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/eval/datasets', async (_req, res) => {
  const { describeDatasets } = await import('../eval/datasets.js');
  res.json({ datasets: describeDatasets() });
});

app.post('/intake', async (req, res) => {
  const message = (req.body?.message as string) ?? '';
  if (!message || message.trim().length < 5) {
    res.status(400).json({ error: 'message required (min 5 chars)' });
    return;
  }
  if (!canRunAgents()) {
    res.status(503).json({ error: 'no LLM provider configured' });
    return;
  }
  try {
    const { processIntake } = await import('../autonomous/intake.js');
    const result = await processIntake(message);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/fleet/autonomous-dev', authMiddleware, async (req, res) => {
  const { runAutonomousDev } = await import('../autonomous/autonomousDev.js');
  const { claimNextTask } = await import('../autonomous/workQueue.js');
  const task = await claimNextTask('autonomous-dev');
  if (!task) {
    res.json({ ok: false, message: 'no tasks in queue' });
    return;
  }
  res.json({ ok: true, taskId: task.id, message: 'autonomous dev started — check logs for progress' });
  runAutonomousDev(task).then((result) => {
    console.log(`[autonomous-dev] task ${task.id} → ${result.success ? 'SUCCESS' : 'FAILED'}: ${result.finalStatus}`);
    if (result.prUrl) console.log(`[autonomous-dev] PR: ${result.prUrl}`);
  }).catch((err) => {
    console.error(`[autonomous-dev] task ${task.id} crashed:`, err);
  });
});

const port = parseInt(optionalEnv('ORCHESTRATOR_PORT', '4100'), 10);
const server = app.listen(port, () => {
  console.log(`[agent-orchestrator] API listening on http://localhost:${port}`);
  console.log(`[agent-orchestrator] status:`, JSON.stringify(envStatus()));
});

async function shutdown(): Promise<void> {
  console.log('[agent-orchestrator] shutting down…');
  await shutdownTracing();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server };