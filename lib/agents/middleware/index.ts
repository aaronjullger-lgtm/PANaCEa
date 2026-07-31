/**
 * Agent Middleware — DeepAgents-inspired composable middleware for agent pipelines.
 *
 * These middleware modules provide the building blocks for constructing
 * sophisticated agent workflows, inspired by the DeepAgents SDK patterns:
 *
 * - SubAgentMiddleware: Parallel agent spawning with timeout/error isolation
 * - TodoListMiddleware: Structured task planning and progress tracking
 * - FilesystemMiddleware: Virtual filesystem for context offloading
 *
 * @module lib/agents/middleware
 */

export {
  spawnSubAgents,
  spawnSubAgentsWithConcurrency,
  executeSubAgentWorkflow,
  type SubAgentDefinition,
  type SubAgentResult,
  type SubAgentBatchResult,
  type SubAgentWorkflowConfig,
} from './subagents';

export {
  createTodoList,
  updateTodoStatus,
  getNextPendingTodo,
  getTodosByStatus,
  isTodoListComplete,
  getTodoProgress,
  executeTodoList,
  executeTodoListParallel,
  serializeTodoList,
  type TodoItem,
  type TodoList,
  type TodoStatus,
  type TodoPriority,
} from './todos';

export {
  createHITLMiddleware,
  createConsoleApprovalHandler,
  type HITLConfig,
  type ApprovalHandler,
  type ApprovalRequest,
  type ApprovalDecision,
} from './hitl';
