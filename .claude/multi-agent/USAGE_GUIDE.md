# Multi-Agent Orchestrator — Step-by-Step Usage Guide

This guide walks you through setting up and using the PANaCEa multi-agent orchestrator from scratch. It coordinates five AI models — GLM, Gemini, OpenAI, DeepSeek, and Claude — to plan, review, implement, and validate code changes through a single CLI.


## Step 1: Initial Setup

Navigate to the orchestrator directory and run the setup script. This creates your `.env` file, installs dependencies, initializes the queue and state files, and sets hook permissions.

```bash
cd .claude/multi-agent
bash setup.sh
```

You should see output confirming each step. If `httpx` fails to install automatically, install it manually:

```bash
pip3 install httpx --break-system-packages
```


## Step 2: Add Your API Keys

Open the `.env` file created by setup and replace the placeholder values with your real API keys:

```bash
nano .env
```

You need keys for these providers:

| Provider | Key name | Where to get it |
|----------|----------|----------------|
| Zhipu (GLM) | `ZHIPU_API_KEY` | https://open.bigmodel.cn/ |
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| Google Gemini | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| DeepSeek | `DEEPSEEK_API_KEY` | https://platform.deepseek.com/ |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | https://console.anthropic.com/ |

The Anthropic key is optional if you're running Claude Code directly (it uses its own auth). All others are required.


## Step 3: Verify Provider Connections

Run a health check to confirm all providers can reach their APIs:

```bash
python3 orchestrator.py health
```

This sends a tiny "Reply with OK" test to each model. You'll see a pass/fail for each provider. If one fails, double-check that API key in your `.env`.


## Step 4: Run Your First Full Pipeline

The `pipeline` command is the main way to use the orchestrator. It runs all four phases automatically:

```bash
python3 orchestrator.py pipeline "Add error boundary component to DrillShell.tsx"
```

Here's what happens behind the scenes:

1. **Phase 1 — Planning (Gemini `gemini-3.1-pro`):** Creates a step-by-step execution plan with architecture considerations, dependencies, and risks.

2. **Phase 2 — Review (OpenAI `gpt-4.1`):** Reviews the plan for bugs, edge cases, regressions, and suggests exact fixes.

3. **Phase 3 — Implementation (GLM `glm-5.1`):** Writes the actual code, guided by the plan and the review findings. In safe mode (default), this phase pauses and asks for your approval before running.

4. **Phase 4 — Overseer (Claude `claude-sonnet-4-6`):** Synthesizes all outputs, validates correctness, checks for conflicts, and issues a final APPROVE / REJECT / NEEDS_REVISION verdict. This phase is mandatory — if Claude can't validate, the entire pipeline is marked as failed.

When the pipeline finishes, you'll see a summary showing how many characters each phase produced and whether it succeeded.


## Step 5: Approve Code Tasks (Safe Mode)

By default, the orchestrator runs in `safe_automatic` mode. This means planning, reviewing, and oversight run automatically, but code-writing tasks pause for your approval.

When a code task is pending, you'll see a message like:

```
⏳ Code task a1b2c3d4 needs approval.
   Run: python3 orchestrator.py approve a1b2c3d4
```

To approve it:

```bash
python3 orchestrator.py approve a1b2c3d4
```

To reject it instead:

```bash
python3 orchestrator.py reject a1b2c3d4 --reason "I want a different approach"
```

After approving, run the pipeline again or use `run` to dispatch it:

```bash
python3 orchestrator.py run
```


## Step 6: Skip Pipeline Phases (Optional)

You don't always need all four phases. Use flags to skip:

```bash
# Skip the review phase (just plan → code → overseer)
python3 orchestrator.py pipeline "Quick typo fix in README" --no-review

# Skip the planning phase (just review → code → overseer)
python3 orchestrator.py pipeline "Implement this from the existing plan" --no-planning

# Skip both (just code → overseer)
python3 orchestrator.py pipeline "Simple one-liner fix" --no-review --no-planning
```

The Claude overseer phase can never be skipped. Every pipeline must pass through Claude validation.


## Step 7: Enqueue Tasks to Specific Models

Instead of running a full pipeline, you can send a task directly to a specific model:

```bash
# Send a code review to OpenAI
python3 orchestrator.py enqueue code_review "Review the FSRS pipeline changes in lib/fsrs.ts"

# Send a planning task to Gemini
python3 orchestrator.py enqueue planning "Plan the OSCE simulator refactor"

# Send a coding task to GLM
python3 orchestrator.py enqueue code_implementation "Add loading skeleton to QuizView.tsx"

# Send a research task to OpenAI (uses gpt-4.1-mini automatically)
python3 orchestrator.py enqueue research "What's the best approach for WebSocket reconnection?"

# Send to a specific model by key
python3 orchestrator.py enqueue code_implementation "Write unit tests" --model deepseek
```

After enqueueing, the task appears in the queue. Use `run` to dispatch it:

```bash
python3 orchestrator.py run
```


## Step 8: Check Queue and State

See what's in the queue, what's pending approval, and recent events:

```bash
python3 orchestrator.py status
```

This outputs JSON showing the current state, queue stats, pending messages, approved messages, and the last 10 events.


## Step 9: Understand Task-Aware Model Selection

The orchestrator automatically picks the best model variant for each task type. You don't need to do anything — this happens behind the scenes. Here's what gets selected:

| When you enqueue... | The orchestrator uses... | Why |
|---------------------|-------------------------|-----|
| `code_implementation` to GLM | `glm-5.1` | Full model for heavy coding |
| `test_generation` to GLM | `glm-5-turbo` | Fast model for lighter test writing |
| `code_review` to OpenAI | `gpt-4.1` | Full model for thorough review |
| `research` to OpenAI | `gpt-4.1-mini` | Faster, cheaper for lookups |
| `planning` to Gemini | `gemini-3.1-pro` | Full model for architecture plans |
| `critique` to Gemini | `gemini-2.5-flash` | Fast model for quick feedback |
| `architecture_review` to DeepSeek | `deepseek-reasoner` | Deep reasoning for analysis |
| `code_implementation` to DeepSeek | `deepseek-chat` | Fast chat model for coding |
| Any overseer task to Claude | `claude-sonnet-4-6` | Always the full model |

To customize these mappings, edit the `model_variants` section in `config/settings.json`. For example, to make GLM always use the turbo model for refactoring:

```json
"refactor": {
  "zhipu": "glm-5-turbo"
}
```


## Step 10: Use Safety Controls

The orchestrator has several safety mechanisms:

**Emergency stop** — halts all operations immediately:

```bash
python3 orchestrator.py stop
```

This creates a `state/STOP` file. No messages will be dispatched until you resume:

```bash
python3 orchestrator.py resume
```

**Automatic protections** (always active, configurable in `config/settings.json`):

- Loop depth limit (default: 5) prevents infinite prompt chains
- Auto-turn limit (default: 3) forces human interaction
- Thread message limit (default: 50) caps thread length
- Stale message TTL (default: 120 min) rejects old messages
- Dedup window (default: 30 sec) blocks duplicate submissions
- Blocked categories: `git_force_push`, `branch_delete_main`, and `env_modification` are never auto-executed


## Step 11: Switch Operating Modes

The orchestrator has two modes. Change by editing `config/settings.json`:

**`safe_automatic` (default):** Planning, reviewing, and oversight run automatically. Code writing, refactoring, and git commits require manual approval.

**`aggressive_automatic`:** Everything runs automatically except git commits, pushes, and file deletes. Use this when you trust the pipeline and want speed.

```json
"mode": "aggressive_automatic"
```

You can also override the mode via environment variable:

```bash
ORCHESTRATOR_MODE=aggressive_automatic python3 orchestrator.py pipeline "Your task"
```


## Step 12: Install Claude Code Hooks (Optional)

Hooks integrate the orchestrator into your Claude Code session so tasks are automatically brokered when you use Claude Code:

```bash
python3 scripts/install_hooks.py
```

Or manually add to your `.claude/settings.local.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{"type": "command", "command": "bash .claude/multi-agent/hooks/session_start_context.sh", "timeout": 5}]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{"type": "command", "command": "bash .claude/multi-agent/hooks/post_task_broker.sh", "timeout": 5, "async": true}]
    }],
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{"type": "command", "command": "bash .claude/multi-agent/hooks/pre_tool_safety.sh", "timeout": 5}]
    }]
  }
}
```

- **SessionStart:** Generates a repo context snapshot when a Claude Code session begins.
- **PostToolUse:** After a Bash command, checks if the result should be brokered to another model.
- **PreToolUse:** Safety gate that can block dangerous operations.


## Step 13: Read the Logs

All events are logged to `logs/events.jsonl` as structured JSON. Each entry includes timestamps, model identity, contract scores, and variant selections.

To see recent events:

```bash
tail -20 logs/events.jsonl | python3 -m json.tool
```

Look for these event types:

- `dispatch` — a message was sent to a provider
- `response` — a provider returned a result
- `identity` — flags when `actual_backend` differs from `target_model` (e.g., GLM behind Claude Code slot)
- `variant_selection` — when a task-specific model variant was chosen (e.g., `glm-5-turbo` instead of `glm-5.1`)
- `contract` — output contract conformance score (0.0–1.0)
- `safety` — safety check pass/fail events
- `error` — something went wrong


## Quick Reference: All Commands

```bash
# ── Full pipeline ──
python3 orchestrator.py pipeline "Your task"
python3 orchestrator.py pipeline "Your task" --no-review
python3 orchestrator.py pipeline "Your task" --no-planning
python3 orchestrator.py pipeline "Your task" --no-review --no-planning

# ── Single-task dispatch ──
python3 orchestrator.py enqueue <task_type> "Description"
python3 orchestrator.py enqueue <task_type> "Description" --model <model_key>
python3 orchestrator.py run

# ── Queue management ──
python3 orchestrator.py status
python3 orchestrator.py approve <msg_id>
python3 orchestrator.py reject <msg_id> --reason "explanation"

# ── Safety ──
python3 orchestrator.py stop
python3 orchestrator.py resume
python3 orchestrator.py health
```

Valid `<task_type>` values: `code_implementation`, `refactor`, `test_generation`, `planning`, `architecture_review`, `risk_analysis`, `code_review`, `research`, `alternate_implementation`, `critique`, `synthesis`, `validation`, `supervisor_review`, `overseer`.

Valid `<model_key>` values: `claude_code_glm`, `gemini`, `openai`, `deepseek`, `claude`.


## Troubleshooting

**"No provider found for model: X"** — The model key doesn't match anything in `config/settings.json`. Check the `models` section for valid keys.

**Pipeline hangs at code phase** — You're in `safe_automatic` mode and the code task needs approval. Run `python3 orchestrator.py status` to find the pending message ID, then `python3 orchestrator.py approve <id>`.

**"PIPELINE FAILED: mandatory Claude overseer did not complete"** — The Claude API call failed (key missing, rate limited, or network issue). Check your `ANTHROPIC_API_KEY` in `.env` and run `python3 orchestrator.py health`.

**"All 3 attempts failed"** — The provider returned retryable errors (429, 5xx) on all retry attempts. Wait a minute and try again, or check your API quota.

**Provider health check fails** — Confirm the API key is set in `.env` (not still a placeholder value like `your_key_here`). Restart your terminal if you just edited `.env`.
