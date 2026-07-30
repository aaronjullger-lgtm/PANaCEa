import { execSync, exec } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

const WORKTREE_BASE = resolve(process.env.PANACEA_WORKTREE_DIR ?? '/tmp/panacea-worktrees');
const REPO_ROOT = resolve(process.cwd());

export interface Worktree {
  id: string;
  path: string;
  branch: string;
  createdAt: string;
}

const _active = new Map<string, Worktree>();

export function getWorktreePath(id: string): string | null {
  return _active.get(id)?.path ?? null;
}

export async function createWorktree(baseBranch = 'main', taskName?: string): Promise<Worktree> {
  const id = taskName ? `${taskName}-${randomUUID().slice(0, 8)}` : randomUUID();
  const branch = `agent/${id}`;
  const wtPath = join(WORKTREE_BASE, id);

  mkdirSync(WORKTREE_BASE, { recursive: true });

  try {
    execSync(`git worktree add -b "${branch}" "${wtPath}" "${baseBranch}"`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      timeout: 30_000,
    });
  } catch (err) {
    execSync(`git worktree add -b "${branch}" "${wtPath}" "HEAD"`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      timeout: 30_000,
    });
  }

  const wt: Worktree = { id, path: wtPath, branch, createdAt: new Date().toISOString() };
  _active.set(id, wt);
  return wt;
}

export async function destroyWorktree(id: string): Promise<void> {
  const wt = _active.get(id);
  if (!wt) return;
  try {
    execSync(`git worktree remove --force "${wt.path}"`, { cwd: REPO_ROOT, stdio: 'pipe', timeout: 15_000 });
  } catch { /* best effort */ }
  try { execSync(`git branch -D "${wt.branch}"`, { cwd: REPO_ROOT, stdio: 'pipe', timeout: 10_000 }); } catch { /* branch may have a PR */ }
  _active.delete(id);
}

export async function runInWorktree(id: string, command: string, timeoutMs = 120_000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: wt.path,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, CI: 'true' },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code ?? 1 };
  }
}

export function readFileInWorktree(id: string, relPath: string): string {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  const full = join(wt.path, relPath);
  if (!existsSync(full)) throw new Error(`File not found: ${relPath}`);
  return readFileSync(full, 'utf-8');
}

export function writeFileInWorktree(id: string, relPath: string, content: string): void {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  const full = join(wt.path, relPath);
  const dir = resolve(full, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(full, content, 'utf-8');
}

export function listFilesInWorktree(id: string, pattern = '**/*.{ts,tsx}'): string[] {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  try {
    const out = execSync(`find . -type f -name '*.ts' -o -name '*.tsx' | grep -v node_modules | grep -v .wrangler | grep -v dist | head -200`, {
      cwd: wt.path,
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function searchInWorktree(id: string, pattern: string, fileGlob = '*.ts'): string {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  try {
    return execSync(`grep -rn --include='${fileGlob}' '${pattern.replace(/'/g, "'\\''")}' . 2>/dev/null | grep -v node_modules | head -50`, {
      cwd: wt.path,
      encoding: 'utf-8',
      timeout: 15_000,
    });
  } catch {
    return 'No matches found.';
  }
}

export function commitInWorktree(id: string, message: string, files?: string[]): boolean {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  try {
    if (files?.length) {
      execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: wt.path, stdio: 'pipe', timeout: 10_000 });
    } else {
      execSync('git add -A', { cwd: wt.path, stdio: 'pipe', timeout: 10_000 });
    }
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: wt.path, stdio: 'pipe', timeout: 10_000 });
    return true;
  } catch (err) {
    return false;
  }
}

export function getDiff(id: string): string {
  const wt = _active.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  try {
    return execSync('git diff HEAD~1', { cwd: wt.path, encoding: 'utf-8', timeout: 15_000, maxBuffer: 1024 * 1024 });
  } catch {
    return '';
  }
}

export function listActiveWorktrees(): Worktree[] {
  return Array.from(_active.values());
}