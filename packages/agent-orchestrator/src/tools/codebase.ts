import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { canWrite, canRun } from '../autonomous/guardrails.js';
import {
  createWorktree,
  destroyWorktree,
  readFileInWorktree,
  writeFileInWorktree,
  listFilesInWorktree,
  searchInWorktree,
  runInWorktree,
  commitInWorktree,
  getDiff,
  type Worktree,
} from '../autonomous/worktree.js';
import { getEnv } from '../config/env.js';

export function createCodebaseTools(worktree: Worktree) {
  const readTool = tool(
    async ({ path }) => {
      try {
        const content = readFileInWorktree(worktree.id, path);
        return content.length > 8000 ? content.slice(0, 8000) + '\n... [truncated]' : content;
      } catch (err) {
        return `Error reading ${path}: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: 'read_file',
      description: 'Read a file from the codebase in the current worktree. Returns up to 8000 chars.',
      schema: z.object({ path: z.string().describe('Repo-relative path, e.g. "components/session/QuizView.tsx"') }),
    },
  );

  const writeTool = tool(
    async ({ path, content }) => {
      const guard = canWrite(path);
      if (!guard.ok) return `BLOCKED: ${guard.reason}`;
      try {
        writeFileInWorktree(worktree.id, path, content);
        return `Wrote ${content.length} chars to ${path}`;
      } catch (err) {
        return `Error writing ${path}: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: 'write_file',
      description: 'Write/create a file in the worktree. Blocked on protected paths (schema.prisma, .env, auth.ts, fsrs.ts, etc.).',
      schema: z.object({
        path: z.string().describe('Repo-relative path'),
        content: z.string().describe('Full file content'),
      }),
    },
  );

  const searchTool = tool(
    async ({ pattern, fileGlob }) => searchInWorktree(worktree.id, pattern, fileGlob),
    {
      name: 'search_code',
      description: 'Grep for a pattern across the codebase in the current worktree.',
      schema: z.object({
        pattern: z.string().describe('Regex or literal pattern to search for'),
        fileGlob: z.string().default('*.ts').describe('File glob, e.g. "*.tsx" or "*.ts"'),
      }),
    },
  );

  const listFilesTool = tool(
    async () => {
      const files = listFilesInWorktree(worktree.id);
      return files.slice(0, 100).join('\n') || 'No files found.';
    },
    {
      name: 'list_files',
      description: 'List TypeScript/TSX files in the worktree (first 100).',
      schema: z.object({}),
    },
  );

  const runCommandTool = tool(
    async ({ command }) => {
      const guard = canRun(command);
      if (!guard.ok) return `BLOCKED: ${guard.reason}`;
      const result = await runInWorktree(worktree.id, command, 120_000);
      const out = (result.stdout + result.stderr).slice(0, 6000);
      return `[exit ${result.exitCode}]\n${out}`;
    },
    {
      name: 'run_command',
      description: 'Run a shell command in the worktree. Blocked on: prisma migrate, wrangler deploy, rm -rf, git push --force, git reset --hard.',
      schema: z.object({ command: z.string().describe('Shell command to run in the worktree') }),
    },
  );

  const commitTool = tool(
    async ({ message, files }) => {
      const ok = commitInWorktree(worktree.id, message, files);
      return ok ? `Committed: ${message}` : 'Commit failed (nothing to commit or git error)';
    },
    {
      name: 'git_commit',
      description: 'Stage and commit changes in the worktree.',
      schema: z.object({
        message: z.string().describe('Conventional commit message'),
        files: z.array(z.string()).optional().describe('Specific files to stage. If omitted, stages all changes.'),
      }),
    },
  );

  const diffTool = tool(
    async () => {
      const diff = getDiff(worktree.id);
      return diff.slice(0, 8000) || 'No changes found.';
    },
    {
      name: 'get_diff',
      description: 'Get the git diff of the latest commit in the worktree.',
      schema: z.object({}),
    },
  );

  return [readTool, writeTool, searchTool, listFilesTool, runCommandTool, commitTool, diffTool];
}

export type CodebaseToolSet = ReturnType<typeof createCodebaseTools>;