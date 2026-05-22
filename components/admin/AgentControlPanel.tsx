/**
 * AgentControlPanel — Admin UI for PANaCEa Production Agents
 *
 * Lets admins trigger agent runs, view results, and monitor
 * agent health. Follows existing admin component patterns
 * (admin/* subdirectories, Tailwind + semantic tokens).
 *
 * @module components/admin/AgentControlPanel
 */

import { useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentRunRequest {
  action: string;
  system?: string;
  targetId?: string;
  targetName?: string;
  includeSteps?: boolean;
}

interface AgentRunResult {
  finalText: string;
  stopReason: string;
  iterations: number;
  tokensUsed: { input: number; output: number; total: number };
  durationMs: number;
  error?: { message: string; code?: string };
  steps?: unknown[];
}

type AgentStatus = 'idle' | 'running' | 'done' | 'error';

// ─── Agent Definitions ──────────────────────────────────────────────────────

interface AgentDef {
  id: string;
  label: string;
  endpoint: string;
  actions: { value: string; label: string; description: string }[];
  icon: string;
  color: string;
}

const AGENTS: AgentDef[] = [
  {
    id: 'quality-check',
    label: 'Content Quality',
    endpoint: '/api/agents/quality-check',
    icon: '🔍',
    color: 'amber',
    actions: [
      { value: 'audit_all', label: 'Audit All', description: 'Full content quality audit across all systems' },
      { value: 'check_question', label: 'Check Question', description: 'Psychometric analysis of a specific question' },
      { value: 'verify_condition', label: 'Verify Condition', description: 'Validate clinical accuracy of a condition' },
      { value: 'scan_quality', label: 'Scan Quality', description: 'Find flagged and low-health questions' },
    ],
  },
  {
    id: 'coverage-audit',
    label: 'Coverage Audit',
    endpoint: '/api/agents/coverage-audit',
    icon: '📊',
    color: 'blue',
    actions: [
      { value: 'blueprint_coverage', label: 'Blueprint Coverage', description: 'NCCPA weight vs actual question counts' },
      { value: 'drill_coverage', label: 'Drill Coverage', description: 'Content audit for all 13 drill types' },
      { value: 'full_coverage', label: 'Full Coverage', description: 'Combined blueprint + drill coverage report' },
    ],
  },
  {
    id: 'infra-health',
    label: 'Infrastructure Health',
    endpoint: '/api/agents/infra-health',
    icon: '🩺',
    color: 'emerald',
    actions: [
      { value: 'db_integrity', label: 'DB Integrity', description: 'Orphan records and FK constraint check' },
      { value: 'fsrs_health', label: 'FSRS Health', description: 'Scheduling calibration and overdue analysis' },
      { value: 'full_health', label: 'Full Health', description: 'Comprehensive infrastructure audit' },
    ],
  },
  {
    id: 'verify-condition',
    label: 'Verify Condition',
    endpoint: '/api/agents/verify-condition',
    icon: '✅',
    color: 'rose',
    actions: [
      { value: 'verify', label: 'Verify', description: 'Validate clinical accuracy and completeness' },
      { value: 'verify_crossref', label: 'Verify + Cross-Ref', description: 'Verify and cross-reference with library' },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function AgentControlPanel() {
  const [selectedAgent, setSelectedAgent] = useState<AgentDef>(AGENTS[0]!);
  const [selectedAction, setSelectedAction] = useState(AGENTS[0]!.actions[0]!);
  const [systemFilter, setSystemFilter] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [includeSteps, setIncludeSteps] = useState(false);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const needsTarget = selectedAction.value === 'check_question' || selectedAction.value === 'verify';
  const needsTargetName = selectedAction.value === 'verify_condition' || selectedAction.value === 'verify';

  const runAgent = useCallback(async () => {
    setStatus('running');
    setErrorMsg('');
    setResult(null);

    const body: AgentRunRequest = {
      action: selectedAction.value,
      includeSteps,
    };
    if (systemFilter.trim()) body.system = systemFilter.trim();
    if (targetId.trim()) body.targetId = targetId.trim();
    if (targetName.trim()) body.targetName = targetName.trim();

    try {
      // In development, use the local API. In production, uses the deploy URL.
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}${selectedAgent.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setResult(json.data ?? json);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [selectedAction, selectedAgent, systemFilter, targetId, targetName, includeSteps]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-deep-plum dark:text-steel-blue-100">
          Agent Control Panel
        </h2>
        <p className="text-sm text-steel-blue-500 dark:text-steel-blue-400 mt-1">
          Trigger production agents and monitor execution results.
        </p>
      </div>

      {/* Agent Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => {
              setSelectedAgent(agent);
              setSelectedAction(agent.actions[0]!);
              setResult(null);
              setStatus('idle');
              setErrorMsg('');
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedAgent.id === agent.id
                ? 'border-gold-400 bg-gold-50 dark:bg-gold-900/10 shadow-sm'
                : 'border-steel-blue-200 dark:border-steel-blue-700 hover:border-steel-blue-400'
            }`}
          >
            <div className="text-2xl mb-1">{agent.icon}</div>
            <div className="font-medium text-sm">{agent.label}</div>
            <div className="text-xs text-steel-blue-500 mt-0.5">
              {agent.actions.length} actions
            </div>
          </button>
        ))}
      </div>

      {/* Action Selector */}
      <div className="bg-white dark:bg-steel-blue-900 rounded-lg border border-steel-blue-200 dark:border-steel-blue-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{selectedAgent.icon}</span>
          <h3 className="font-medium">{selectedAgent.label}</h3>
        </div>

        <div className="space-y-2 mb-4">
          {selectedAgent.actions.map((action) => (
            <label
              key={action.value}
              className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                selectedAction.value === action.value
                  ? 'border-gold-400 bg-gold-50 dark:bg-gold-900/10'
                  : 'border-transparent hover:bg-steel-blue-50 dark:hover:bg-steel-blue-800/50'
              }`}
            >
              <input
                type="radio"
                name="agentAction"
                value={action.value}
                checked={selectedAction.value === action.value}
                onChange={() => {
                  setSelectedAction(action);
                  setResult(null);
                  setStatus('idle');
                }}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-sm">{action.label}</div>
                <div className="text-xs text-steel-blue-500 mt-0.5">
                  {action.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-steel-blue-600 mb-1">
              System Filter (optional)
            </label>
            <input
              type="text"
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              placeholder="e.g. Cardiovascular"
              className="w-full px-3 py-1.5 text-sm border border-steel-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-gold-400"
            />
          </div>

          {needsTarget && (
            <div>
              <label className="block text-xs font-medium text-steel-blue-600 mb-1">
                Target ID
              </label>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Question or Condition ID"
                className="w-full px-3 py-1.5 text-sm border border-steel-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-gold-400"
              />
            </div>
          )}

          {needsTargetName && (
            <div>
              <label className="block text-xs font-medium text-steel-blue-600 mb-1">
                Target Name
              </label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="e.g. Hypertension"
                className="w-full px-3 py-1.5 text-sm border border-steel-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-gold-400"
              />
            </div>
          )}
        </div>

        {/* Options */}
        <label className="flex items-center gap-2 text-sm text-steel-blue-600 mb-4">
          <input
            type="checkbox"
            checked={includeSteps}
            onChange={(e) => setIncludeSteps(e.target.checked)}
          />
          Include step transcript (debug)
        </label>

        {/* Run Button */}
        <button
          onClick={runAgent}
          disabled={status === 'running'}
          className={`px-5 py-2 rounded font-medium text-sm transition-colors ${
            status === 'running'
              ? 'bg-steel-blue-300 cursor-not-allowed'
              : 'bg-gold-500 hover:bg-gold-600 text-white shadow-sm'
          }`}
        >
          {status === 'running' ? 'Running...' : `Run ${selectedAction.label}`}
        </button>
      </div>

      {/* Results */}
      {status === 'done' && result && (
        <div className="bg-white dark:bg-steel-blue-900 rounded-lg border border-steel-blue-200 dark:border-steel-blue-700 p-5">
          <h3 className="font-medium mb-3">Results</h3>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-steel-blue-500">
            <span>
              Stop reason:{' '}
              <span className="font-mono font-medium">{result.stopReason}</span>
            </span>
            <span>
              Iterations:{' '}
              <span className="font-mono font-medium">{result.iterations}</span>
            </span>
            <span>
              Tokens:{' '}
              <span className="font-mono font-medium">{result.tokensUsed.total}</span>
            </span>
            <span>
              Duration:{' '}
              <span className="font-mono font-medium">{(result.durationMs / 1000).toFixed(1)}s</span>
            </span>
          </div>

          {/* Output */}
          <div className="bg-steel-blue-50 dark:bg-steel-blue-800/50 rounded p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
            {result.finalText || '(no text output)'}
          </div>

          {result.error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
              <span className="font-medium">Error:</span> {result.error.message}
              {result.error.code && (
                <span className="ml-2 font-mono text-xs">
                  [{result.error.code}]
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          <span className="font-medium">Agent run failed:</span> {errorMsg}
        </div>
      )}
    </div>
  );
}
