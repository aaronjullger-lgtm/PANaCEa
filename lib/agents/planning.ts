/**
 * Agent Planning Middleware
 *
 * Implements the Deep Agents TodoListMiddleware pattern using existing
 * LangGraph infrastructure. Provides structured task planning for
 * multi-step agent workflows — agents can create, update, and track
 * tasks during execution.
 *
 * Pattern source: Deep Agents `todoListMiddleware()` from `langchain`
 * package. Reimplemented here to avoid the npm dependency while
 * maintaining API compatibility for future migration.
 *
 * Key behaviors:
 * - Tasks have status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
 * - Tasks have priority: 'high' | 'medium' | 'low'
 * - Only one task in_progress at a time
 * - Tasks persist in agent state for cross-turn visibility
 * - Planning tool is exposed as a LangChain-compatible structured tool
 *
 * @module lib/agents/planning
 */

import { z } from 'zod';

// ─── Task Types ───────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface AgentTask {
  /** Unique task identifier */
  id: string;
  /** Human-readable task description */
  content: string;
  /** Current status */
  status: TaskStatus;
  /** Priority level */
  priority: TaskPriority;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Optional: agent assigned to this task */
  assignedTo?: string;
  /** Optional: result or output from completed task */
  result?: string;
  /** Optional: parent task ID for hierarchical planning */
  parentId?: string;
}

export interface TaskList {
  tasks: AgentTask[];
  /** ISO timestamp of last modification */
  lastModified: string;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  id: z.string().min(1).describe('Unique task identifier (kebab-case recommended)'),
  content: z.string().min(1).max(300).describe('Human-readable task description'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).describe('Current task status'),
  priority: z.enum(['high', 'medium', 'low']).describe('Task priority level'),
  assignedTo: z.string().optional().describe('Agent assigned to this task'),
  result: z.string().optional().describe('Output or result from completed task'),
  parentId: z.string().optional().describe('Parent task ID for hierarchical planning'),
});

export const WriteTodosInput = z.object({
  tasks: z.array(TaskSchema).min(1).max(20).describe('List of tasks to create or update'),
  merge: z.boolean().default(true).describe('If true, merge with existing tasks. If false, replace all.'),
});

export type WriteTodosInputType = z.infer<typeof WriteTodosInput>;

// ─── Planning State ───────────────────────────────────────────────────────

export interface PlanningState {
  taskList: TaskList;
}

export function createEmptyTaskList(): TaskList {
  return {
    tasks: [],
    lastModified: new Date().toISOString(),
  };
}

// ─── Task Operations ──────────────────────────────────────────────────────

let taskCounter = 0;

function generateTaskId(): string {
  taskCounter += 1;
  return `task-${Date.now()}-${taskCounter}`;
}

/**
 * Merge incoming tasks with existing task list.
 * - Tasks with matching IDs are updated in place
 * - New tasks (no ID match) are appended
 * - Enforces single in_progress constraint
 */
export function mergeTasks(
  existing: TaskList,
  incoming: WriteTodosInputType['tasks'],
): TaskList {
  const now = new Date().toISOString();
  const taskMap = new Map<string, AgentTask>();

  // Index existing tasks
  for (const task of existing.tasks) {
    taskMap.set(task.id, task);
  }

  // Count current in_progress tasks
  let inProgressCount = 0;
  for (const task of taskMap.values()) {
    if (task.status === 'in_progress') inProgressCount++;
  }

  // Merge incoming tasks
  for (const incomingTask of incoming) {
    const existingTask = taskMap.get(incomingTask.id);

    if (existingTask) {
      // Update existing task
      const updated: AgentTask = {
        ...existingTask,
        content: incomingTask.content || existingTask.content,
        status: incomingTask.status,
        priority: incomingTask.priority || existingTask.priority,
        updatedAt: now,
        assignedTo: incomingTask.assignedTo ?? existingTask.assignedTo,
        result: incomingTask.result ?? existingTask.result,
        parentId: incomingTask.parentId ?? existingTask.parentId,
      };

      // Enforce single in_progress
      if (updated.status === 'in_progress' && existingTask.status !== 'in_progress') {
        inProgressCount++;
      } else if (updated.status !== 'in_progress' && existingTask.status === 'in_progress') {
        inProgressCount--;
      }

      taskMap.set(incomingTask.id, updated);
    } else {
      // New task
      const newTask: AgentTask = {
        id: incomingTask.id || generateTaskId(),
        content: incomingTask.content,
        status: incomingTask.status,
        priority: incomingTask.priority,
        createdAt: now,
        updatedAt: now,
        assignedTo: incomingTask.assignedTo,
        result: incomingTask.result,
        parentId: incomingTask.parentId,
      };

      if (newTask.status === 'in_progress') {
        inProgressCount++;
      }

      taskMap.set(newTask.id, newTask);
    }
  }

  // Auto-complete other in_progress tasks if a new one was set
  if (inProgressCount > 1) {
    let foundNew = false;
    for (const task of taskMap.values()) {
      if (task.status === 'in_progress') {
        if (foundNew) {
          task.status = 'pending';
          task.updatedAt = now;
        }
        foundNew = true;
      }
    }
  }

  return {
    tasks: Array.from(taskMap.values()),
    lastModified: now,
  };
}

/**
 * Replace the entire task list with new tasks.
 */
export function replaceTasks(_existing: TaskList, incoming: WriteTodosInputType['tasks']): TaskList {
  const now = new Date().toISOString();
  return {
    tasks: incoming.map((t): AgentTask => ({
      id: t.id || generateTaskId(),
      content: t.content,
      status: t.status,
      priority: t.priority,
      createdAt: now,
      updatedAt: now,
      assignedTo: t.assignedTo,
      result: t.result,
      parentId: t.parentId,
    })),
    lastModified: now,
  };
}

// ─── Planning Tool Definition ─────────────────────────────────────────────

/**
 * Tool definition compatible with LangChain StructuredTool interface.
 * Can be passed directly to createAgent() or used in LangGraph tool nodes.
 */
export const writeTodosTool = {
  name: 'write_todos',
  description: `Create and manage a structured task list for multi-step work.

Use this tool to:
- Plan complex tasks before executing them
- Track progress through multi-step workflows
- Mark tasks as in_progress when starting work
- Mark tasks as completed when finished
- Cancel tasks that are no longer needed

Rules:
- Only ONE task in_progress at a time
- Complete current tasks before starting new ones
- Use clear, specific task descriptions
- Group related tasks under a parent task ID`,
  schema: WriteTodosInput,
};

/**
 * Execute the write_todos tool against a task list.
 */
export function executeWriteTodos(
  currentList: TaskList,
  input: WriteTodosInputType,
): { result: string; updatedList: TaskList } {
  const updatedList = input.merge
    ? mergeTasks(currentList, input.tasks)
    : replaceTasks(currentList, input.tasks);

  const summary = summarizeTaskList(updatedList);
  return { result: summary, updatedList };
}

// ─── Task List Formatting ─────────────────────────────────────────────────

/**
 * Format a task list as a human-readable summary for the agent.
 */
export function summarizeTaskList(list: TaskList): string {
  if (list.tasks.length === 0) {
    return 'No tasks in the plan.';
  }

  const statusEmoji: Record<TaskStatus, string> = {
    pending: '⬜',
    in_progress: '🔄',
    completed: '✅',
    cancelled: '❌',
  };

  const priorityLabel: Record<TaskPriority, string> = {
    high: '[HIGH]',
    medium: '[MED]',
    low: '[LOW]',
  };

  const lines = list.tasks.map((t) => {
    const emoji = statusEmoji[t.status];
    const prio = priorityLabel[t.priority];
    const result = t.result ? ` → ${t.result.slice(0, 80)}` : '';
    return `${emoji} ${prio} ${t.content}${result}`;
  });

  const counts = {
    total: list.tasks.length,
    completed: list.tasks.filter((t) => t.status === 'completed').length,
    inProgress: list.tasks.filter((t) => t.status === 'in_progress').length,
    pending: list.tasks.filter((t) => t.status === 'pending').length,
  };

  return [
    `Task Plan (${counts.completed}/${counts.total} done, ${counts.inProgress} in progress, ${counts.pending} pending):`,
    ...lines,
  ].join('\n');
}

/**
 * Format a task list for inclusion in agent system prompts.
 */
export function formatTaskListForPrompt(list: TaskList): string {
  if (list.tasks.length === 0) return '';

  const active = list.tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  if (active.length === 0) return '';

  const lines = ['## Current Task Plan'];
  for (const task of active) {
    const marker = task.status === 'in_progress' ? '▶' : '·';
    lines.push(`${marker} ${task.content}`);
  }
  return lines.join('\n');
}

// ─── Planning Middleware Factory ───────────────────────────────────────────

export interface PlanningMiddlewareConfig {
  /** Maximum number of tasks allowed */
  maxTasks?: number;
  /** Whether to auto-complete other tasks when a new one starts */
  autoCompleteOnNew?: boolean;
  /** Whether to include task list in system prompts */
  includeInPrompt?: boolean;
}

/**
 * Create a planning middleware compatible with the orchestrator pattern.
 * Returns an object that can be used to manage task state across agent turns.
 */
export function createPlanningMiddleware(config: PlanningMiddlewareConfig = {}) {
  const maxTasks = config.maxTasks ?? 20;
  const autoComplete = config.autoCompleteOnNew ?? true;
  const includeInPrompt = config.includeInPrompt ?? true;

  let taskList = createEmptyTaskList();

  return {
    /** Get the current task list */
    getTaskList: (): TaskList => taskList,

    /** Set the task list (e.g., after loading from persistence) */
    setTaskList: (list: TaskList): void => {
      taskList = list;
    },

    /** Execute the write_todos tool */
    writeTodos: (input: WriteTodosInputType): string => {
      if (input.tasks.length > maxTasks) {
        return `Error: Cannot create more than ${maxTasks} tasks at once. Got ${input.tasks.length}.`;
      }

      const { result, updatedList } = executeWriteTodos(taskList, input);
      taskList = updatedList;
      return result;
    },

    /** Get the current task summary for prompts */
    getPromptContext: (): string => {
      if (!includeInPrompt) return '';
      return formatTaskListForPrompt(taskList);
    },

    /** Check if all tasks are complete */
    isComplete: (): boolean => {
      return taskList.tasks.length > 0 &&
        taskList.tasks.every((t) => t.status === 'completed' || t.status === 'cancelled');
    },

    /** Get the current in-progress task, if any */
    getCurrentTask: (): AgentTask | undefined => {
      return taskList.tasks.find((t) => t.status === 'in_progress');
    },

    /** Get next pending task by priority */
    getNextTask: (): AgentTask | undefined => {
      const priorityOrder: TaskPriority[] = ['high', 'medium', 'low'];
      for (const prio of priorityOrder) {
        const task = taskList.tasks.find(
          (t) => t.status === 'pending' && t.priority === prio,
        );
        if (task) return task;
      }
      return taskList.tasks.find((t) => t.status === 'pending');
    },

    /** Reset the task list */
    reset: (): void => {
      taskList = createEmptyTaskList();
    },
  };
}

export type PlanningMiddleware = ReturnType<typeof createPlanningMiddleware>;
