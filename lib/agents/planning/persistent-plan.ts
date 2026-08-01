/**
 * Persistent Plan Files
 *
 * Crash-proof, file-based planning for PANaCEa agents. Implements the
 * planning-with-files pattern (OthmanAdi/planning-with-files, 25.9k★):
 *
 *   1. task_plan.md   — phases + checkboxes; the resume point after /clear
 *   2. findings.md    — research notes and decisions, appended as you go
 *   3. progress.md    — session log and test results
 *
 * Core principle: Context Window = RAM (volatile), Filesystem = Disk (persistent).
 * Anything important gets written to disk so it survives context resets,
 * crashes, and compaction.
 *
 * Integrates with PANaCEa's existing planning module (lib/agents/planning.ts)
 * and filesystem middleware (lib/agents/middleware/filesystem.ts).
 *
 * @module lib/agents/planning/persistent-plan
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { AgentTask, TaskStatus } from '../planning';

const DEFAULT_PLAN_DIR = '.panacea/plans';

export interface PlanPhase {
  name: string;
  status: TaskStatus;
  tasks: AgentTask[];
  startedAt?: string;
  completedAt?: string;
}

export interface PlanFindings {
  decisions: Array<{ timestamp: string; content: string }>;
  research: Array<{ timestamp: string; source: string; content: string }>;
  errors: Array<{ timestamp: string; error: string; resolution?: string }>;
}

export interface PlanProgress {
  sessionId: string;
  startedAt: string;
  lastUpdatedAt: string;
  completedPhases: string[];
  currentPhase: string | null;
  testResults: Array<{ timestamp: string; suite: string; passed: number; failed: number }>;
  log: Array<{ timestamp: string; event: string }>;
}

export interface PersistentPlan {
  id: string;
  title: string;
  goal: string;
  phases: PlanPhase[];
  findings: PlanFindings;
  progress: PlanProgress;
  planDir: string;
}

let _activePlan: PersistentPlan | null = null;

export function getPlanDir(planId?: string): string {
  const base = process.env.PANACEA_PLAN_DIR ?? join(process.cwd(), DEFAULT_PLAN_DIR);
  if (planId) return join(base, planId);
  return base;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function createPlan(title: string, goal: string, planId?: string): PersistentPlan {
  const id = planId ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const planDir = getPlanDir(id);
  ensureDir(planDir);

  const plan: PersistentPlan = {
    id,
    title,
    goal,
    phases: [],
    findings: { decisions: [], research: [], errors: [] },
    progress: {
      sessionId: `session-${Date.now()}`,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      completedPhases: [],
      currentPhase: null,
      testResults: [],
      log: [],
    },
    planDir,
  };

  _activePlan = plan;
  flushPlan(plan);
  return plan;
}

export function loadPlan(planId: string): PersistentPlan | null {
  const planDir = getPlanDir(planId);
  const taskPlanPath = join(planDir, 'task_plan.md');

  if (!existsSync(taskPlanPath)) return null;

  const taskPlanRaw = readFileSync(taskPlanPath, 'utf-8');
  const findingsRaw = existsSync(join(planDir, 'findings.md'))
    ? readFileSync(join(planDir, 'findings.md'), 'utf-8')
    : '';
  const progressRaw = existsSync(join(planDir, 'progress.md'))
    ? readFileSync(join(planDir, 'progress.md'), 'utf-8')
    : '';

  const plan = parseTaskPlan(taskPlanRaw, planId, planDir);
  if (findingsRaw) plan.findings = parseFindings(findingsRaw);
  if (progressRaw) plan.progress = { ...plan.progress, ...parseProgress(progressRaw) };

  _activePlan = plan;
  return plan;
}

export function getActivePlan(): PersistentPlan | null {
  return _activePlan;
}

export function addPhase(plan: PersistentPlan, name: string, tasks: AgentTask[]): void {
  plan.phases.push({
    name,
    status: 'pending',
    tasks,
    startedAt: undefined,
    completedAt: undefined,
  });
  plan.progress.lastUpdatedAt = new Date().toISOString();
  flushPlan(plan);
}

export function startPhase(plan: PersistentPlan, phaseName: string): void {
  const phase = plan.phases.find((p) => p.name === phaseName);
  if (!phase) return;

  phase.status = 'in_progress';
  phase.startedAt = new Date().toISOString();
  plan.progress.currentPhase = phaseName;
  plan.progress.lastUpdatedAt = new Date().toISOString();
  plan.progress.log.push({
    timestamp: new Date().toISOString(),
    event: `Started phase: ${phaseName}`,
  });
  flushPlan(plan);
}

export function completePhase(plan: PersistentPlan, phaseName: string): void {
  const phase = plan.phases.find((p) => p.name === phaseName);
  if (!phase) return;

  phase.status = 'completed';
  phase.completedAt = new Date().toISOString();
  plan.progress.completedPhases.push(phaseName);
  plan.progress.currentPhase = null;
  plan.progress.lastUpdatedAt = new Date().toISOString();
  plan.progress.log.push({
    timestamp: new Date().toISOString(),
    event: `Completed phase: ${phaseName}`,
  });
  flushPlan(plan);
}

export function updateTask(plan: PersistentPlan, phaseName: string, taskId: string, status: TaskStatus): void {
  const phase = plan.phases.find((p) => p.name === phaseName);
  if (!phase) return;

  const task = phase.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.status = status;
  task.updatedAt = new Date().toISOString();
  plan.progress.lastUpdatedAt = new Date().toISOString();
  flushPlan(plan);
}

export function addFinding(plan: PersistentPlan, type: 'decision' | 'research' | 'error', content: string, source?: string): void {
  const timestamp = new Date().toISOString();

  if (type === 'decision') {
    plan.findings.decisions.push({ timestamp, content });
  } else if (type === 'research') {
    plan.findings.research.push({ timestamp, source: source ?? 'unknown', content });
  } else {
    plan.findings.errors.push({ timestamp, error: content });
  }

  plan.progress.lastUpdatedAt = new Date().toISOString();
  flushPlan(plan);
}

export function logProgress(plan: PersistentPlan, event: string): void {
  plan.progress.log.push({
    timestamp: new Date().toISOString(),
    event,
  });
  plan.progress.lastUpdatedAt = new Date().toISOString();
  flushPlan(plan);
}

export function addTestResult(plan: PersistentPlan, suite: string, passed: number, failed: number): void {
  plan.progress.testResults.push({
    timestamp: new Date().toISOString(),
    suite,
    passed,
    failed,
  });
  plan.progress.lastUpdatedAt = new Date().toISOString();
  flushPlan(plan);
}

export function isPlanComplete(plan: PersistentPlan): boolean {
  return plan.phases.length > 0 && plan.phases.every((p) => p.status === 'completed');
}

export function getCompletionReport(plan: PersistentPlan): string {
  const total = plan.phases.length;
  const completed = plan.phases.filter((p) => p.status === 'completed').length;
  const inProgress = plan.phases.filter((p) => p.status === 'in_progress').length;
  const pending = plan.phases.filter((p) => p.status === 'pending').length;

  return [
    `# Plan: ${plan.title}`,
    `Goal: ${plan.goal}`,
    `Progress: ${completed}/${total} phases complete`,
    '',
    ...plan.phases.map((p) => {
      const icon = p.status === 'completed' ? '[x]' : p.status === 'in_progress' ? '[~]' : '[ ]';
      const taskSummary = p.tasks
        .map((t) => `  ${t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[~]' : '[ ]'} ${t.content}`)
        .join('\n');
      return `### ${icon} ${p.name}\n${taskSummary}`;
    }),
    '',
    `Last updated: ${plan.progress.lastUpdatedAt}`,
  ].join('\n');
}

function flushPlan(plan: PersistentPlan): void {
  ensureDir(plan.planDir);

  writeFileSync(join(plan.planDir, 'task_plan.md'), formatTaskPlan(plan), 'utf-8');
  writeFileSync(join(plan.planDir, 'findings.md'), formatFindings(plan.findings), 'utf-8');
  writeFileSync(join(plan.planDir, 'progress.md'), formatProgress(plan.progress), 'utf-8');
}

function formatTaskPlan(plan: PersistentPlan): string {
  const lines = [
    `===BEGIN PLAN DATA===`,
    `# Task Plan: ${plan.title}`,
    `Goal: ${plan.goal}`,
    `Plan ID: ${plan.id}`,
    `Created: ${plan.progress.startedAt}`,
    `Last Updated: ${plan.progress.lastUpdatedAt}`,
    ``,
  ];

  for (const phase of plan.phases) {
    const icon = phase.status === 'completed' ? '[x]' : phase.status === 'in_progress' ? '[~]' : '[ ]';
    lines.push(`## ${icon} Phase: ${phase.name}`);
    lines.push(`Status: ${phase.status}`);
    if (phase.startedAt) lines.push(`Started: ${phase.startedAt}`);
    if (phase.completedAt) lines.push(`Completed: ${phase.completedAt}`);
    lines.push('');

    for (const task of phase.tasks) {
      const tIcon = task.status === 'completed' ? '[x]' : task.status === 'in_progress' ? '[~]' : '[ ]';
      lines.push(`- ${tIcon} ${task.content} (${task.priority})`);
    }
    lines.push('');
  }

  lines.push('===END PLAN DATA===');
  return lines.join('\n');
}

function formatFindings(findings: PlanFindings): string {
  const lines = ['# Findings', ''];

  if (findings.decisions.length > 0) {
    lines.push('## Decisions');
    for (const d of findings.decisions) {
      lines.push(`- [${d.timestamp}] ${d.content}`);
    }
    lines.push('');
  }

  if (findings.research.length > 0) {
    lines.push('## Research');
    for (const r of findings.research) {
      lines.push(`- [${r.timestamp}] (${r.source}) ${r.content}`);
    }
    lines.push('');
  }

  if (findings.errors.length > 0) {
    lines.push('## Errors');
    for (const e of findings.errors) {
      lines.push(`- [${e.timestamp}] ${e.error}${e.resolution ? ` → ${e.resolution}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatProgress(progress: PlanProgress): string {
  const lines = [
    '# Progress Log',
    `Session: ${progress.sessionId}`,
    `Started: ${progress.startedAt}`,
    `Last Updated: ${progress.lastUpdatedAt}`,
    `Current Phase: ${progress.currentPhase ?? 'none'}`,
    `Completed Phases: ${progress.completedPhases.join(', ') || 'none'}`,
    '',
  ];

  if (progress.testResults.length > 0) {
    lines.push('## Test Results');
    for (const t of progress.testResults) {
      lines.push(`- [${t.timestamp}] ${t.suite}: ${t.passed} passed, ${t.failed} failed`);
    }
    lines.push('');
  }

  lines.push('## Event Log');
  for (const e of progress.log) {
    lines.push(`- [${e.timestamp}] ${e.event}`);
  }

  return lines.join('\n');
}

function parseTaskPlan(raw: string, planId: string, planDir: string): PersistentPlan {
  const lines = raw.split('\n');
  let title = 'Untitled Plan';
  let goal = '';
  const phases: PlanPhase[] = [];
  let currentPhase: PlanPhase | null = null;

  for (const line of lines) {
    if (line.startsWith('# Task Plan:')) {
      title = line.replace('# Task Plan:', '').trim();
    } else if (line.startsWith('Goal:')) {
      goal = line.replace('Goal:', '').trim();
    } else if (line.startsWith('## ') && line.includes('Phase:')) {
      if (currentPhase) phases.push(currentPhase);
      const name = line.replace(/^##\s*\[.\]\s*Phase:\s*/, '').trim();
      currentPhase = { name, status: 'pending', tasks: [] };
    } else if (line.startsWith('Status:') && currentPhase) {
      currentPhase.status = line.replace('Status:', '').trim() as TaskStatus;
    } else if (line.startsWith('Started:') && currentPhase) {
      currentPhase.startedAt = line.replace('Started:', '').trim();
    } else if (line.startsWith('Completed:') && currentPhase) {
      currentPhase.completedAt = line.replace('Completed:', '').trim();
    } else if (line.match(/^-\s*\[/) && currentPhase) {
      const status: TaskStatus = line.includes('[x]') ? 'completed' : line.includes('[~]') ? 'in_progress' : 'pending';
      const content = line.replace(/^-\s*\[.\]\s*/, '').replace(/\s*\(.*\)$/, '').trim();
      const priority = line.includes('(high)') ? 'high' : line.includes('(low)') ? 'low' : 'medium';
      currentPhase.tasks.push({
        id: `task-${currentPhase.tasks.length}`,
        content,
        status,
        priority: priority as 'high' | 'medium' | 'low',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  if (currentPhase) phases.push(currentPhase);

  return {
    id: planId,
    title,
    goal,
    phases,
    findings: { decisions: [], research: [], errors: [] },
    progress: {
      sessionId: `recovered-${Date.now()}`,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      completedPhases: phases.filter((p) => p.status === 'completed').map((p) => p.name),
      currentPhase: phases.find((p) => p.status === 'in_progress')?.name ?? null,
      testResults: [],
      log: [],
    },
    planDir,
  };
}

function parseFindings(raw: string): PlanFindings {
  const findings: PlanFindings = { decisions: [], research: [], errors: [] };
  let section: 'decisions' | 'research' | 'errors' | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('## Decisions')) section = 'decisions';
    else if (line.startsWith('## Research')) section = 'research';
    else if (line.startsWith('## Errors')) section = 'errors';
    else if (line.startsWith('- [') && section) {
      const match = line.match(/^-\s*\[(.*?)\]\s*(.*)$/);
      if (match) {
        const timestamp = match[1] ?? '';
        const content = match[2] ?? '';
        if (section === 'decisions') findings.decisions.push({ timestamp, content });
        else if (section === 'research') findings.research.push({ timestamp, source: '', content });
        else findings.errors.push({ timestamp, error: content });
      }
    }
  }

  return findings;
}

function parseProgress(raw: string): Partial<PlanProgress> {
  const progress: Partial<PlanProgress> = { log: [], testResults: [] };
  let inTestResults = false;
  let inEventLog = false;

  for (const line of raw.split('\n')) {
    if (line.startsWith('Session:')) progress.sessionId = line.replace('Session:', '').trim();
    else if (line.startsWith('Started:')) progress.startedAt = line.replace('Started:', '').trim();
    else if (line.startsWith('Last Updated:')) progress.lastUpdatedAt = line.replace('Last Updated:', '').trim();
    else if (line.startsWith('Current Phase:')) {
      const val = line.replace('Current Phase:', '').trim();
      progress.currentPhase = val === 'none' ? null : val;
    } else if (line.startsWith('Completed Phases:')) {
      const val = line.replace('Completed Phases:', '').trim();
      progress.completedPhases = val === 'none' ? [] : val.split(',').map((s) => s.trim());
    } else if (line.startsWith('## Test Results')) {
      inTestResults = true;
      inEventLog = false;
    } else if (line.startsWith('## Event Log')) {
      inTestResults = false;
      inEventLog = true;
    } else if (inTestResults && line.startsWith('- [')) {
      const match = line.match(/^-\s*\[(.*?)\]\s*(.*):\s*(\d+)\s*passed,\s*(\d+)\s*failed/);
      if (match) {
        progress.testResults!.push({
          timestamp: match[1] ?? '',
          suite: match[2] ?? '',
          passed: parseInt(match[3] ?? '0', 10),
          failed: parseInt(match[4] ?? '0', 10),
        });
      }
    } else if (inEventLog && line.startsWith('- [')) {
      const match = line.match(/^-\s*\[(.*?)\]\s*(.*)$/);
      if (match) {
        progress.log!.push({ timestamp: match[1] ?? '', event: match[2] ?? '' });
      }
    }
  }

  return progress;
}
