# Multi-Agent Orchestrator for PANaCEa

A production-grade local multi-model development workflow that coordinates GLM 5.1, OpenAI GPT-4.1, Gemini 3.1 Pro, DeepSeek, and Claude through a brokered message queue with safety controls, automatic retry with exponential backoff, and mandatory Claude oversight.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Claude Code Terminal                     │
│                  (Control Environment)                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              orchestrator.py                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │   │
│  │  │  Queue    │ │  State   │ │  Safety Layer  │   │   │
│  │  │  Manager  │ │  Machine │ │  (loop guard,  │   │   │
│  │  │  (JSONL)  │ │  (JSON)  │ │   dedup, gates)│   │   │
│  │  └────┬─────┘ └────┬─────┘ └───────┬────────┘   │   │
│  │       │             │               │             │   │
│  │  ┌────▼─────────────▼───────────────▼────────┐   │   │
│  │  │              Role Router                    │   │   │
│  │  └──┬──────────┬───────────┬─────────────┬───┘   │   │
│  └─────┼──────────┼───────────┼─────────────┼───────┘   │
│        │          │           │             │            │
│  ┌─────▼───┐ ┌───▼─────┐ ┌──▼──────┐ ┌───▼──────┐ ┌──▼───────┐│
│  │ Gemini  │ │ OpenAI  │ │  GLM    │ │  Claude  │ │ DeepSeek ││
│  │(Planner)│ │(Reviewer)│ │ (Coder) │ │(Overseer)│ │(Fallback)││
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘ └──────────┘│
└─────────────────────────────────────────────────────────┘
```

## Model Roles

| Model | Role | Responsibilities |
|-------|------|-----------------|
| **Gemini 3.1 Pro** | Planner | Execution plans, architecture review, risk analysis |
| **OpenAI GPT-4.1** | Reviewer | Code review, research, alternate implementations, edge cases |
| **GLM 5.1** (Zhipu) | Primary Coder | Code writing, implementation, refactoring, tests |
| **Claude** (Anthropic) | **Mandatory Overseer** | Synthesis, validation, reinjection, final review — every pipeline must pass through Claude |
| **DeepSeek** | Secondary Coder / Fallback | Fallback for GLM coding and OpenAI research; strong reasoning at low cost |

### Identity Honesty

The GLM coder runs behind a Claude Code Anthropic-compatible slot for cost savings. The orchestrator tracks this honestly:
- `target_model`: `claude_code_glm` (the logical slot name)
- `runtime_slot`: `claude_code_sonnet` (what the API thinks it is)
- `actual_backend`: `zhipu_glm` (what actually generates the output)

All logs, events, and history entries include the `actual_backend` field so you always know which model produced what.

## Pipeline Flow

```
1. Human submits task
   │
2. Repo context summary generated
   │
3. Gemini: create execution plan (architecture, steps, risks)
   │
4. OpenAI: review the plan (bugs, edge cases, exact fixes)
   │
5. GLM: implement code (with plan + review context)
   │  ⏳ In safe mode: waits for human approval
   │
6. Claude OVERSEER: synthesize all outputs, validate, APPROVE/REJECT
   │  🛑 If overseer fails, entire pipeline fails
   │
7. Next action queued → safety checks → dispatch or hold
```

## Automatic Retry

All provider calls use `send_with_retry()` with exponential backoff and jitter. Configured per-provider in `config/settings.json`:

- **Retryable errors:** HTTP 429 (rate limit), 5xx (server errors), connection timeouts, SSL errors
- **Non-retryable errors:** HTTP 4xx (bad request, auth failure), missing API keys
- **Backoff:** Exponential with 50-100% jitter (e.g., 1s → 2s → 4s, capped at `max_delay`)
- **Per-provider overrides:** Zhipu gets longer delays (1.5s base, 45s cap) due to occasional rate-limit spikes. Claude gets fewer retries (2) since overseer failure should surface fast.

**Claude overseer is mandatory.** If `overseer_required: true` (default) and Claude fails to validate, the pipeline is marked as failed. No output is considered valid without overseer approval.

## Quick Start

### 1. Setup

```bash
cd .claude/multi-agent
bash setup.sh
```

### 2. Configure API Keys

Edit `.claude/multi-agent/.env`:

```env
ZHIPU_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### 3. Install Claude Code Hooks (Optional)

```bash
python3 .claude/multi-agent/scripts/install_hooks.py
```

### 4. Run Your First Pipeline

```bash
cd .claude/multi-agent
python3 orchestrator.py pipeline "Add error boundary component to DrillShell.tsx"
```

## Daily Usage Commands

```bash
# Full pipeline: plan → review → code → overseer
python3 orchestrator.py pipeline "Your task description"

# Skip optional phases
python3 orchestrator.py pipeline "Quick fix" --no-review
python3 orchestrator.py pipeline "Implement from existing plan" --no-planning

# Enqueue a single task to a specific model
python3 orchestrator.py enqueue code_review "Review the FSRS pipeline changes"
python3 orchestrator.py enqueue code_implementation "Add loading skeleton to QuizView"
python3 orchestrator.py enqueue planning "Plan OSCE simulator refactor"

# Process next approved message
python3 orchestrator.py run

# Approve/reject pending messages
python3 orchestrator.py status
python3 orchestrator.py approve abc123
python3 orchestrator.py reject abc123

# Safety controls
python3 orchestrator.py stop
python3 orchestrator.py resume
python3 orchestrator.py health
```

## Message Schema

Every inter-model communication follows this schema:

```json
{
  "id": "abc123def456",
  "thread_id": "t-abcd1234",
  "parent_id": null,
  "source_model": "human",
  "target_model": "claude_code_glm",
  "role": "task",
  "status": "pending",
  "task_type": "code_implementation",
  "content": "...",
  "allowed_action": "code_write",
  "logical_role": "code_implementation",
  "runtime_slot": "claude_code_sonnet",
  "actual_backend": "zhipu_glm",
  "created_at": "2026-04-06T...",
  "consumed_at": null,
  "approval_required": true,
  "loop_depth": 0,
  "repo_context_ref": "state/latest_context.md",
  "response": null,
  "error": null,
  "metadata": {}
}
```

## Output Contract

All model responses are normalized to a standard structure:

| Field | Required | Description |
|-------|----------|-------------|
| `summary` | Yes | Combined summary of the output |
| `key_findings` | Yes | Main findings or changes |
| `proposed_next_action` | Yes | What to do next |
| `risks` | Yes | Identified concerns |
| `confidence` | Yes | Confidence level |
| `acceptance_check` | Yes | Verification status |
| `handoff_note` | Yes | Decision or recommendation |

A `contract_score` (0.0-1.0) is logged for each response, measuring how well it conforms to the contract.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZHIPU_API_KEY` | Yes | Zhipu BigModel API key (GLM coder) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (GPT-4.1 reviewer) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (planner) |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key (Claude overseer — optional if using Claude Code) |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key (secondary coder / research fallback) |
| `PERPLEXITY_API_KEY` | No | Legacy — Perplexity (not in default pipeline) |
| `ORCHESTRATOR_MODE` | No | `safe_automatic` or `aggressive_automatic` |
| `MAX_LOOP_DEPTH` | No | Override max loop depth (default: 5) |
| `MAX_AUTO_TURNS` | No | Override max auto turns (default: 3) |
| `LOG_LEVEL` | No | INFO, DEBUG, WARN, ERROR |

## File Structure

```
.claude/multi-agent/
├── orchestrator.py          # Main orchestrator CLI + engine
├── setup.sh                 # One-time setup script
├── .env.template            # API key template
├── .env                     # Your API keys (gitignored)
├── README.md                # This file
│
├── config/
│   ├── settings.json        # Model roles, routing, safety, output contract config
│   ├── hooks_config.json    # Claude Code hook definitions
│   └── loader.py            # Config + .env loader
│
├── providers/
│   ├── base.py              # Abstract provider interface
│   ├── zhipu_provider.py    # GLM 5.1 adapter
│   ├── openai_provider.py   # GPT-4.1 adapter
│   ├── gemini_provider.py   # Gemini 3.1 Pro adapter
│   ├── claude_provider.py   # Claude adapter
│   ├── deepseek_provider.py # DeepSeek adapter (secondary coder / fallback)
│   └── perplexity_provider.py  # Legacy (optional)
│
├── scripts/
│   ├── message_schema.py    # Message dataclass + enums + identity fields
│   ├── queue_manager.py     # JSONL queue CRUD (thread-safe)
│   ├── state_manager.py     # Session state + emergency stop (RLock)
│   ├── event_logger.py      # Structured JSONL event log
│   ├── role_router.py       # Task → model routing
│   ├── safety.py            # Safety checks (loop, dedup, gates)
│   ├── output_contract.py   # Response normalization + contract scoring
│   ├── repo_context.py      # Repo summary generator
│   └── install_hooks.py     # Hook installer for Claude Code
│
├── hooks/
│   ├── session_start_context.sh  # SessionStart hook
│   ├── post_task_broker.sh       # PostToolUse hook
│   └── pre_tool_safety.sh        # PreToolUse safety gate
│
├── prompts/
│   ├── coder_system.md      # GLM: narrow, file-aware, constraint-heavy
│   ├── reviewer_system.md   # OpenAI: goal+context+constraints+done-when
│   ├── planner_system.md    # Gemini: concise, structured plans, risks
│   └── supervisor_system.md # Claude overseer: contract-style, mandatory self-check
│
├── queue/
│   └── messages.jsonl       # Message queue (append-only)
│
├── state/
│   ├── session.json         # Session state
│   ├── latest_context.md    # Latest repo context snapshot
│   └── STOP                 # Emergency stop sentinel
│
└── logs/
    └── events.jsonl         # Audit log (includes identity + contract scores)
```

## Safety Controls

| Control | Description | Default |
|---------|-------------|---------|
| Max loop depth | Prevents infinite prompt chains | 5 |
| Max auto-turns | Forces human interaction | 3 |
| Thread message limit | Caps thread length | 50 |
| Stale TTL | Rejects old messages | 120 min |
| Dedup window | Blocks duplicate content | 30 sec |
| Emergency stop | Halts all operations | `state/STOP` file |
| Overseer required | Pipeline fails without Claude validation | `true` |
| Blocked categories | Never auto-execute | force push, delete main, env modification |

## Known Limitations

1. **Reinjection is semi-automatic**: The orchestrator queues the next step, but a human or hook must trigger `orchestrator.py run` to dispatch it.
2. **Claude-as-overseer via API**: When Claude acts as overseer through the Anthropic API, it's a separate API call — not the same Claude Code session.
3. **No streaming**: Provider adapters use synchronous HTTP (httpx).
4. **Token limits**: Thread history is truncated to the last 4 exchanges.
5. **Single-machine**: Queue uses file locking + `threading.RLock`. Not safe across networked filesystems.
6. **GLM fast lane not yet auto-selected**: `glm-5-turbo` is configured but the router doesn't yet auto-switch based on task complexity.
7. **Pipeline dispatches sequentially**: Phases run sequentially to avoid file-based queue race conditions.
8. **httpx required**: Install with `pip3 install httpx`.
