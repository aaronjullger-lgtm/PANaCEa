'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getHealth,
  listAgents,
  invokeAgent,
  streamAgent,
  recallMemory,
  type AgentInfo,
  type HealthInfo,
  type InvokeResult,
  type MemoryResult,
  type StreamEvent,
} from '../lib/orchestrator';

const CAPABILITY_LABELS: Array<[keyof HealthInfo, string]> = [
  ['langfuse', 'Langfuse'],
  ['langsmith', 'LangSmith'],
  ['qdrant', 'Qdrant'],
  ['composio', 'Composio'],
  ['linear', 'Linear'],
  ['n8n', 'n8n'],
  ['github', 'GitHub'],
  ['sentry', 'Sentry'],
  ['vercel', 'Vercel'],
];

export default function Page() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [active, setActive] = useState<AgentInfo | null>(null);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useStream, setUseStream] = useState(true);
  const [liveOutput, setLiveOutput] = useState('');
  const [memQuery, setMemQuery] = useState('');
  const [memCollection, setMemCollection] = useState<'runs' | 'decisions' | 'context'>('decisions');
  const [memories, setMemories] = useState<MemoryResult | null>(null);
  const [memError, setMemError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([getHealth(), listAgents()]);
      setHealth(h);
      setAgents(a.agents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPick = (agent: AgentInfo): void => {
    setActive(agent);
    setPrompt('');
    setResult(null);
    setError(null);
  };

  const onRun = async (): Promise<void> => {
    if (!active) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setLiveOutput('');
    const userMsg = prompt || defaultPromptFor(active.role);
    try {
      if (useStream) {
        let acc = '';
        for await (const evt of streamAgent(active.role, [{ role: 'user', content: userMsg }])) {
          if (evt.event === 'on_chat_model_stream') {
            const chunk = evt.data as { chunk?: { content?: string } };
            const text = typeof chunk?.chunk?.content === 'string' ? chunk.chunk.content : '';
            if (text) {
              acc += text;
              setLiveOutput(acc);
            }
          } else if (evt.event === 'on_tool_start') {
            const name = (evt.data as { name?: string })?.name ?? 'tool';
            acc += `\n[→ ${name}]\n`;
            setLiveOutput(acc);
          } else if (evt.event === 'on_tool_end') {
            const name = (evt.data as { name?: string })?.name ?? 'tool';
            acc += `\n[✓ ${name}]\n`;
            setLiveOutput(acc);
          } else if (evt.event === 'complete') {
            const out = (evt.data as { output?: string })?.output ?? '';
            if (out) { acc = out; setLiveOutput(acc); }
          } else if (evt.event === 'error') {
            throw new Error((evt.data as { error?: string })?.error ?? 'stream error');
          }
        }
        setResult({ runId: 'stream', role: active.role, startedAt: '', finishedAt: '', output: acc, messageCount: 0 });
      } else {
        const r = await invokeAgent(active.role, [{ role: 'user', content: userMsg }]);
        setResult(r);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const onRecall = async (): Promise<void> => {
    setMemError(null);
    setMemories(null);
    try {
      const r = await recallMemory(memCollection, memQuery);
      setMemories(r);
    } catch (err) {
      setMemError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>PANaCEa Agent Orchestrator</h1>
        <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>
          LangGraph agents · Langfuse + LangSmith traced · Qdrant long-term memory
        </p>
      </header>

      <HealthPanel health={health} />

      {error && (
        <div style={{ background: '#3f1d1d', border: '1px solid #7f1d1d', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Error:</strong> <code style={{ color: '#fca5a5' }}>{error}</code>
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={sectionH}>Agents</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {agents.map((a) => (
            <button
              key={a.role}
              onClick={() => onPick(a)}
              style={{
                textAlign: 'left',
                padding: 16,
                borderRadius: 12,
                border: `1px solid ${active?.role === a.role ? '#9a8f72' : '#334155'}`,
                background: active?.role === a.role ? '#1f283a' : '#16203a',
                cursor: 'pointer',
                color: '#f1f5f9',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.name}</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>{a.description}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>{a.inputHint}</div>
            </button>
          ))}
        </div>
      </section>

      {active && (
        <section style={{ marginTop: 24, background: '#1f283a', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
          <h2 style={{ ...sectionH, marginTop: 0 }}>Run · {active.name}</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={defaultPromptFor(active.role)}
            rows={5}
            style={inputStyle}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={onRun} disabled={running} style={runBtn(running)}>
              {running ? 'Running…' : 'Run agent'}
            </button>
            <label style={{ fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} style={{ marginRight: 6 }} />
              Stream live
            </label>
          </div>
          {running && useStream && liveOutput && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#9a8f72', marginBottom: 4 }}>⚡ streaming…</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#101729', padding: 12, borderRadius: 8, border: '1px solid #334155', maxHeight: 360, overflow: 'auto' }}>
                {liveOutput}
              </pre>
            </div>
          )}
          {result && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                {result.runId} · {result.messageCount} messages · {result.startedAt} → {result.finishedAt}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#101729', padding: 12, borderRadius: 8, border: '1px solid #334155', maxHeight: 480, overflow: 'auto' }}>
                {result.output}
              </pre>
              <LangfuseHint />
            </div>
          )}
        </section>
      )}

      <section style={{ marginTop: 24, background: '#1f283a', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
        <h2 style={{ ...sectionH, marginTop: 0 }}>Memory Inspector (Qdrant)</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={memCollection} onChange={(e) => setMemCollection(e.target.value as typeof memCollection)} style={inputStyle}>
            <option value="decisions">decisions</option>
            <option value="runs">runs</option>
            <option value="context">context</option>
          </select>
          <input
            value={memQuery}
            onChange={(e) => setMemQuery(e.target.value)}
            placeholder="semantic query…"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button onClick={onRecall} style={runBtn(false)}>Recall</button>
        </div>
        {memError && <div style={{ color: '#fca5a5', marginTop: 8 }}>{memError}</div>}
        {memories && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              {memories.collection} · {memories.results.length} matches
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#101729', padding: 12, borderRadius: 8, border: '1px solid #334155', maxHeight: 360, overflow: 'auto' }}>
              {JSON.stringify(memories.results, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <footer style={{ marginTop: 32, fontSize: 12, color: '#64748b' }}>
        Orchestrator: <code>packages/agent-orchestrator</code> · Runbook: <code>docs/agents/RUNBOOK.md</code>
      </footer>
    </main>
  );
}

function HealthPanel({ health }: { health: HealthInfo | null }) {
  if (!health) return <div style={{ color: '#94a3b8' }}>Loading orchestrator health… (is it running on :4100?)</div>;
  return (
    <section style={{ background: '#1f283a', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ ...sectionH, margin: 0 }}>Capabilities</h2>
        <span style={{ fontSize: 12, color: health.runnable ? '#86efac' : '#fca5a5' }}>
          {health.runnable ? '● runnable' : '● no LLM key'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={`LLM: ${health.llm}`} ok={health.llm !== 'none'} />
        <Chip label={`model: ${health.model}`} ok />
        <Chip label={`env: ${health.environment}`} ok />
        {CAPABILITY_LABELS.map(([k, label]) => (
          <Chip key={k} label={label} ok={Boolean(health[k])} />
        ))}
      </div>
    </section>
  );
}

function Chip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${ok ? '#3b5e54' : '#4b2020'}`,
        background: ok ? '#16271d' : '#241616',
        color: ok ? '#86efac' : '#fca5a5',
      }}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function LangfuseHint() {
  return (
    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
      Trace in Langfuse: filter by tags <code>panacea</code> / agent role · LangSmith auto-traces under project <code>panacea-agents</code> (env <code>LANGSMITH_TRACING=true</code>).
    </div>
  );
}

const sectionH: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#cbd5e1', margin: '0 0 12px' };
const inputStyle: React.CSSProperties = {
  background: '#101729',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};
function runBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#475569' : '#7a6f52',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function defaultPromptFor(role: string): string {
  switch (role) {
    case 'content-audit':
      return 'Run a content audit pass. Use recall_memory for the latest known audit run; file Linear issues for actionable findings.';
    case 'pr-triage':
      return 'Triage the most recent open PR. Use get_pr_info, then post_pr_review (COMMENT default).';
    case 'incident-responder':
      return 'Triage recent unresolved Sentry issues. File Linear issues for P0-P2.';
    case 'content-enrichment':
      return 'Propose enrichment candidates for: "<condition name + source URL>". Use recall_memory for prior decisions.';
    case 'weekly-report':
      return "Produce the weekly digest for the current ISO week. Recall agent runs + count open Linear issues + top Sentry trends.";
    default:
      return 'Run.';
  }
}