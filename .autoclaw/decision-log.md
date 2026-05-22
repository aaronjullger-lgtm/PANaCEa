# .autoclaw/decision-log.md

## 2026-05-22 — Autoclaw Infrastructure Setup
**Decision:** Create `.autoclaw/` memory system in PANaCEa repo for durable project memory
**Alternatives:** Use only workspace files, use external wiki, use Notion
**Why:** Must survive session restarts, be Git-tracked, accessible to all agent modes
**Risks:** File bloat if not curated — compaction rules in agent-rules.md mitigate this
**Rollback:** Delete `.autoclaw/` directory — all knowledge is derivative from source code

## 2026-05-22 — Model Selection
**Decision:** deepseek-v4-pro as primary for all PANaCEa coding
**Alternatives:** zai_auto (GLM), gemini-3.1-pro, Claude Sonnet
**Why:** Reasoning capability catches edge cases; 1M context for 603-component codebase
**Risks:** Higher latency than flash models — use flash for trivial edits
**Rollback:** `openclaw config set agents.defaults.model.primary zai/zai_auto`

## 2026-05-22 — Skills Pruning
**Decision:** Reduce 108 skills → 27 coding-relevant skills
**Alternatives:** Keep all, delete all, manual curation
**Why:** ~5K tokens reclaimed per prompt, no more stock/weather/feishu pollution
**Risks:** May need archived skill later — all 75 archived skills in `skills/_archived/`
**Rollback:** Move skills back from `_archived/` to skills dir
