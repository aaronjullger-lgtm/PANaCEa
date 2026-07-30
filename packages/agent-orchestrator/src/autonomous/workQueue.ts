import { remember, recall } from '../clients/qdrant.js';
import { randomUUID } from 'node:crypto';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'blocked';
export type TaskType = 'bugfix' | 'feature' | 'refactor' | 'test' | 'review' | 'docs' | 'content' | 'monitor' | 'custom';

export interface WorkTask {
  id: string;
  kind?: string;
  type: TaskType;
  title: string;
  description: string;
  priority: number;
  status: TaskStatus;
  assignedAgent?: string;
  worktreeId?: string;
  prUrl?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  tags?: string[];
}

export async function enqueueTask(input: {
  type: TaskType;
  title: string;
  description: string;
  priority?: number;
  tags?: string[];
}): Promise<WorkTask> {
  const id = randomUUID();
  const task: WorkTask = {
    id,
    kind: 'work_task',
    type: input.type,
    title: input.title,
    description: input.description,
    priority: input.priority ?? 2,
    status: 'pending',
    createdAt: new Date().toISOString(),
    tags: input.tags,
  };

  await remember('context', task.id, `${task.type} ${task.title} ${task.description}`, {
    kind: 'work_task',
    ...task,
  });

  return task;
}

export async function claimNextTask(agentRole: string): Promise<WorkTask | null> {
  const results = await recall('context', 'work_task pending priority', 20);
  const pending = results
    .map((r) => r.payload as unknown as WorkTask)
    .filter((t) => t.status === 'pending' && t.kind === 'work_task')
    .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));

  if (pending.length === 0) return null;

  const task = pending[0]!;
  task.status = 'in_progress';
  task.assignedAgent = agentRole;
  task.startedAt = new Date().toISOString();

  await remember('context', task.id, `${task.type} ${task.title} ${task.description}`, {
    kind: 'work_task',
    ...task,
  });

  return task;
}

export async function completeTask(task: WorkTask, result: string): Promise<void> {
  task.status = 'done';
  task.finishedAt = new Date().toISOString();
  task.result = result;

  await remember('context', task.id, `${task.type} ${task.title} ${task.description}`, {
    kind: 'work_task',
    ...task,
  });
}

export async function failTask(task: WorkTask, error: string): Promise<void> {
  task.status = 'failed';
  task.finishedAt = new Date().toISOString();
  task.error = error;

  await remember('context', task.id, `${task.type} ${task.title} ${task.description}`, {
    kind: 'work_task',
    ...task,
  });
}

export async function getActiveTasks(): Promise<WorkTask[]> {
  const results = await recall('context', 'work_task', 50);
  return results
    .map((r) => r.payload as unknown as WorkTask)
    .filter((t) => t.kind === 'work_task' && (t.status === 'pending' || t.status === 'in_progress'))
    .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
}