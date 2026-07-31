/**
 * TodoList Middleware — DeepAgents-inspired structured task planning.
 *
 * Provides `write_todos` and `read_todos` capabilities for agent pipelines.
 * Inspired by the DeepAgents SDK's TodoListMiddleware, this enables:
 * - Structured task decomposition before execution
 * - Progress tracking across multi-step agent workflows
 * - Automatic status transitions (pending → in_progress → completed)
 * - Integration with LangSmith tracing for observability
 *
 * Key patterns:
 * - Agents write a todo list before starting work
 * - Each todo has: id, content, status, priority
 * - The orchestrator reads the todo list to track progress
 * - Completed todos are logged to LangSmith as span events
 *
 * @module lib/agents/middleware/todos
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'high' | 'medium' | 'low';

export interface TodoItem {
  /** Unique identifier within the todo list */
  id: string;
  /** Human-readable task description */
  content: string;
  /** Current status */
  status: TodoStatus;
  /** Priority level */
  priority: TodoPriority;
  /** Optional: agent assigned to this task */
  assignedTo?: string;
  /** Optional: expected output description */
  expectedOutput?: string;
  /** Timestamp when created */
  createdAt: string;
  /** Timestamp when last updated */
  updatedAt: string;
  /** Timestamp when completed (if done) */
  completedAt?: string;
}

export interface TodoList {
  /** Unique run identifier */
  runId: string;
  /** The task items */
  todos: TodoItem[];
  /** Overall pipeline name */
  pipelineName: string;
  /** When the todo list was created */
  createdAt: string;
  /** When the todo list was last modified */
  updatedAt: string;
}

// ─── Todo List Manager ─────────────────────────────────────────────────────

/**
 * Create a new todo list for an agent pipeline run.
 */
export function createTodoList(
  pipelineName: string,
  items: Array<{
    content: string;
    priority?: TodoPriority;
    assignedTo?: string;
    expectedOutput?: string;
  }>,
): TodoList {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const todos: TodoItem[] = items.map((item, index) => ({
    id: `todo_${index + 1}`,
    content: item.content,
    status: 'pending' as TodoStatus,
    priority: item.priority ?? 'medium',
    assignedTo: item.assignedTo,
    expectedOutput: item.expectedOutput,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    runId,
    todos,
    pipelineName,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Transition a todo to a new status with timestamp tracking.
 */
export function updateTodoStatus(
  list: TodoList,
  todoId: string,
  newStatus: TodoStatus,
): TodoList {
  const now = new Date().toISOString();
  const updatedTodos = list.todos.map((todo) => {
    if (todo.id !== todoId) return todo;

    const updates: Partial<TodoItem> = {
      status: newStatus,
      updatedAt: now,
    };

    if (newStatus === 'completed') {
      updates.completedAt = now;
    }

    return { ...todo, ...updates };
  });

  return {
    ...list,
    todos: updatedTodos,
    updatedAt: now,
  };
}

/**
 * Get the next pending todo (for sequential execution).
 */
export function getNextPendingTodo(list: TodoList): TodoItem | undefined {
  return list.todos.find((t) => t.status === 'pending');
}

/**
 * Get all todos by status.
 */
export function getTodosByStatus(
  list: TodoList,
  status: TodoStatus,
): TodoItem[] {
  return list.todos.filter((t) => t.status === status);
}

/**
 * Check if all todos are completed or cancelled.
 */
export function isTodoListComplete(list: TodoList): boolean {
  return list.todos.every(
    (t) => t.status === 'completed' || t.status === 'cancelled',
  );
}

/**
 * Get progress summary for logging/tracing.
 */
export function getTodoProgress(list: TodoList): {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  percentComplete: number;
} {
  const total = list.todos.length;
  const pending = getTodosByStatus(list, 'pending').length;
  const inProgress = getTodosByStatus(list, 'in_progress').length;
  const completed = getTodosByStatus(list, 'completed').length;
  const cancelled = getTodosByStatus(list, 'cancelled').length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, pending, inProgress, completed, cancelled, percentComplete };
}

// ─── Todo-Driven Execution ─────────────────────────────────────────────────

/**
 * Execute a todo list sequentially, calling the executor for each todo.
 * Automatically manages status transitions.
 *
 * @example
 * ```ts
 * const list = createTodoList('content-generation', [
 *   { content: 'Generate cardiology questions', priority: 'high' },
 *   { content: 'Generate pulmonology questions', priority: 'high' },
 *   { content: 'Validate all questions', priority: 'high' },
 * ]);
 *
 * const results = await executeTodoList(list, async (todo, updateFn) => {
 *   // Mark as in_progress
 *   updateFn('in_progress');
 *   // Do the work
 *   const output = await generateQuestions(todo.content);
 *   // Mark as completed
 *   updateFn('completed');
 *   return output;
 * });
 * ```
 */
export async function executeTodoList<T>(
  list: TodoList,
  executor: (
    todo: TodoItem,
    updateStatus: (status: TodoStatus) => void,
  ) => Promise<T>,
): Promise<{
  list: TodoList;
  results: Array<{ todoId: string; output: T; error?: string }>;
}> {
  let currentList = { ...list };
  const results: Array<{ todoId: string; output: T; error?: string }> = [];

  for (const todo of currentList.todos) {
    if (todo.status === 'cancelled') continue;

    const updateStatus = (status: TodoStatus) => {
      currentList = updateTodoStatus(currentList, todo.id, status);
    };

    try {
      updateStatus('in_progress');
      const output = await executor(todo, updateStatus);
      updateStatus('completed');
      results.push({ todoId: todo.id, output });
    } catch (err) {
      updateStatus('cancelled');
      results.push({
        todoId: todo.id,
        output: null as unknown as T,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { list: currentList, results };
}

/**
 * Execute a todo list in parallel with concurrency control.
 * Each todo is executed independently; status transitions are atomic.
 */
export async function executeTodoListParallel<T>(
  list: TodoList,
  executor: (
    todo: TodoItem,
    updateStatus: (status: TodoStatus) => void,
  ) => Promise<T>,
  concurrency: number = 3,
): Promise<{
  list: TodoList;
  results: Array<{ todoId: string; output: T; error?: string }>;
}> {
  let currentList = { ...list };
  const results: Array<{ todoId: string; output: T; error?: string }> = [];
  const pending = currentList.todos.filter(
    (t) => t.status === 'pending',
  );

  // Process in batches
  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (todo) => {
        const updateStatus = (status: TodoStatus) => {
          currentList = updateTodoStatus(currentList, todo.id, status);
        };

        try {
          updateStatus('in_progress');
          const output = await executor(todo, updateStatus);
          updateStatus('completed');
          return { todoId: todo.id, output };
        } catch (err) {
          updateStatus('cancelled');
          return {
            todoId: todo.id,
            output: null as unknown as T,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    results.push(...batchResults);
  }

  return { list: currentList, results };
}

// ─── Serialization ─────────────────────────────────────────────────────────

/**
 * Serialize a todo list to a plain object for LangSmith metadata.
 */
export function serializeTodoList(list: TodoList): Record<string, unknown> {
  return {
    runId: list.runId,
    pipelineName: list.pipelineName,
    progress: getTodoProgress(list),
    todos: list.todos.map((t) => ({
      id: t.id,
      content: t.content,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assignedTo,
      duration: t.completedAt && t.createdAt
        ? new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()
        : undefined,
    })),
  };
}
