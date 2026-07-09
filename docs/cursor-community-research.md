# Cursor / Agent Community Research

Curated review of community Cursor/agent-workflow sources, the patterns extracted, and what was (and wasn't) adopted into PANaCEa's `.cursor/` setup. **All community content was treated as untrusted**: nothing was executed, no installer scripts were run, no external rules/skills were copied verbatim, and no MCP servers were installed. Patterns were adapted to this repo's real stack (React 19 + Vite 6 + React Router 7, Cloudflare Pages Functions, Prisma 7 + Supabase, Clerk, Tailwind/Radix/Framer Motion) and constraints.

## Sources reviewed

| Source | Relevance | Adoption signal (as observed mid-2026) | Verdict |
|--------|-----------|----------------------------------------|---------|
| [PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) | Canonical `.mdc` rules collection | ~40.3k★, ~3.4k forks, 90 contributors, last push 2026-05-30, CC0 | Patterns adopted (adapted) |
| [spencerpauly/awesome-cursor-skills](https://github.com/spencerpauly/awesome-cursor-skills) | Curated Cursor `SKILL.md` list + ecosystem index (skills.sh, cursor.directory, AgentDepot) | Active curated list; links to leaderboards/directories | Patterns adopted (adapted) |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | Large multi-agent skills catalog (Cursor/Claude/Codex) | Active, multi-agent; exact stars not verified this pass | Patterns adopted (adapted) |
| [continuedev/awesome-rules](https://github.com/continuedev/awesome-rules) | Cross-tool "rules" collection from Continue.dev | Active; exact stars not verified this pass | Patterns adopted (adapted) |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Skills/hooks/subagent/orchestration patterns | ~49.5k★, ~4.3k forks, last push 2026-07-08; **mid-reorg, maintainer warns of spam submissions** | Patterns adopted with caution |
| Cursor Docs — [Rules](https://cursor.com/docs/rules) / [Skills](https://cursor.com/docs/skills) / [Hooks](https://cursor.com/docs/hooks) | Authoritative schema for `.mdc`, `SKILL.md`, `hooks.json` | Official | Followed as ground truth |
| Claude Code best practices (official) | Hooks = deterministic gate; CLAUDE.md = short/advisory; subagents = isolated context; adversarial/verification review | Official | Principles adopted (documented, not all enforced) |
| Cursor Directory ([cursor.directory](https://cursor.directory/)) + skills.sh / AgentDepot.dev | Community directories for rules/skills/MCP ranking | Community directories | Used for discovery only |
| GitHub topics: `cursor-rules`, `cursor-skills`, `agent-skills`, `cursorrules`, `ai-agent-rules` | Breadth of community patterns | Thousands of repos (variable quality) | Discovery only; not copied |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Browser/visual QA MCP | Official Microsoft server | Recommended (template only) |
| Supabase MCP (`@supabase/mcp-server-supabase`) | DB inspection | Official; ships `--read-only` recommended default | Recommended dev/read-only only |
| `@modelcontextprotocol/server-sequential-thinking` | Planning/reasoning scratchpad | MCP reference server | Recommended optional |
| Excalidraw/Mermaid MCP (community) | Diagram/architecture sketches | Community (multiple variants, some security-hardened) | Optional, "later", template only |
| [awesome-mcp-servers] index | MCP breadth | ~85k★ index | Discovery only |

## Patterns extracted and where implemented

| Pattern (theme) | Source signal | Where implemented in this repo |
|-----------------|---------------|--------------------------------|
| Repo memory / context persistence | awesome-claude-code, Claude Code "keep memory short" | `repo-memory-and-context.mdc`, skills `repo-memory-update` + `long-running-handoff`; AGENTS.md handoff section |
| Agent planning / task decomposition | Claude Code plan/subagent model | `agent-planning-and-handoff.mdc`, skill `agent-task-planning` |
| Rules hygiene (focused, scoped, `globs`) | awesome-cursorrules, Cursor docs | Kept rules focused/scoped; dedupe pass (`cursor-automation-dedupe.md`) |
| Hooks/safety gates (deterministic) | Claude Code "hooks mandatory, memory advisory" | `.cursor/hooks.json` guard + format check; `mcp-and-tool-safety.mdc` |
| Browser / visual QA | playwright-mcp accessibility-tree approach | `browser-verification.mdc`, skills `ui-polish-pass`, existing `verifying-in-browser`/`visual-qa-testing` |
| Accessibility QA | community a11y skills | existing `accessibility.mdc` + `accessibility-auditing` skill (kept) |
| PR review gate | awesome-claude-code review agents | `pr-review-quality-gate.mdc`, skill `pr-review` |
| Security review | community security skills | existing `security-review.mdc` + `auditing-security` (kept) |
| Test-failure triage | community "fix failing tests" workflows | skill `failure-triage` (references existing `parallel-test-fixing`) |
| Design-system enforcement | design-system rules | `visual-design-quality-gate.mdc`, skill `design-system-enforcement` (reference `ui-design-system.mdc`) |
| Multi-agent / subagent orchestration | Claude Code subagents (separate context) | Documented in `cursor-agent-operating-system.md` (workflows), not auto-enforced |
| MCP safety | Supabase read-only default, prompt-injection warnings | `mcp-and-tool-safety.mdc`, skill `mcp-safety-review`, `cursor-mcp-cloud-setup.md` |
| "Don't lie / verify before claiming success" | recurring community + Claude Code adversarial review | existing `testing-and-verification.mdc`, `agent-operating-procedure.mdc`; reinforced in `cloud-agent-final-report` skill |
| Avoiding AI slop in UI | design-system + product intent (AGENTS.md "should NOT feel like…") | skill `no-ai-slop-visual-audit`, `visual-design-quality-gate.mdc` |
| Avoiding hallucinated imports/files | recurring pain point | `anti-hallucination-imports.mdc`, skill `route-and-import-verification` |
| Long-running agent handoff | Claude Code context-isolation + handoff | `long-running-handoff` skill, `cloud-agent-operating-mode.mdc` |
| Community research method | this task | skill `community-pattern-research` |
| Dependency safety | supply-chain concerns | `dependency-and-package-safety.mdc`, skill `dependency-review` |
| Code-mod safety | large-refactor risk | skill `code-mod-safety` |

## Ideas rejected (and why)

- **Copying framework `.mdc` files wholesale (awesome-cursorrules)** — most are Next.js/other-stack specific; this repo is React+Vite, not Next.js. Copying would inject stale/incorrect guidance. Adapted the *structure* (focused, `globs`-scoped rules) instead.
- **Installer scripts / one-click "add all skills" flows** — untrusted execution; violates the no-random-scripts constraint. We author repo-native skills instead.
- **Auto-invoking MCP servers or bundling community MCPs** — supply-chain + prompt-injection risk. We ship documented, secret-free templates only (`.cursor/mcp.example.json`) and require dashboard setup.
- **Heavy `stop`/`postToolUse` hooks that run full typecheck/test on every turn** — slow and can loop; Claude Code guidance also caps `Stop` loops. Kept hooks lightweight (guard + per-file format check); documented optional heavier hooks in `cursor-hooks-notes.md`.
- **Auto-format-on-edit by default** — surprising large diffs; made it opt-in (`CURSOR_HOOK_AUTOFORMAT=1`), default is check-only.
- **Large `CLAUDE.md`/`AGENTS.md` dumps of all rules** — official guidance says agent memory must stay short or it backfires. Kept AGENTS.md additions concise and pointed to `.cursor/`.
- **Legacy single `.cursorrules`** — deprecated; preserved only as a compatibility file, new guidance lives in `.cursor/rules/*.mdc`.
- **Blindly trusting awesome-claude-code entries** — repo is mid-reorg and the maintainer explicitly warns of spam submissions; we used it for pattern ideas only, not as a trusted source of copyable content.

## Safety notes

- No secrets, tokens, or production credentials were added. `.cursor/mcp.json` remains gitignored.
- No production database/service was contacted. MCP recommendations default to read-only/dev.
- The primary MCP risk is **prompt injection** via untrusted content an agent reads while holding write-capable tools; mitigations are documented in `docs/cursor-mcp-cloud-setup.md` and `mcp-and-tool-safety.mdc`.
