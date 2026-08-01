---
name: context-budget
description: Audit token overhead across agents, skills, MCP servers, and rules files. Use when context window feels heavy, sessions degrade after loading many skills, or before adding new MCP servers. Identifies which components consume the most context budget.
---

# Context Budget Audit

Adapted from ECC's context-budget skill for PANaCEa's multi-harness setup.

## When to Use

- Context window feels heavy (70k+ tokens consumed by config alone)
- Agent quality degrades after loading multiple skills
- Before adding new MCP servers or skills
- After major skill/rule additions
- Session compaction happening too frequently

## Audit Process

### 1. Count MCP Server Overhead

Each MCP server's tool descriptions consume 2-8k tokens. List active MCPs:

```bash
# OpenCode: check opencode.json
cat .opencode/opencode.json 2>/dev/null | grep -c "mcp"

# Claude Code: check config
cat ~/.claude.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('mcpServers',{})))"
```

**Budget rule:** Keep under 10 MCP servers, under 80 tools active per session.

### 2. Measure Skill File Sizes

```bash
# Total bytes in skill files
find .agents/skills/ .claude/skills/ -name "SKILL.md" -exec wc -c {} + 2>/dev/null | sort -rn | head -20

# Largest skills by token estimate (~4 chars per token)
find .agents/skills/ -name "SKILL.md" -exec wc -c {} + 2>/dev/null | sort -rn | head -10 | while read size file; do
  tokens=$((size / 4))
  echo "$tokens tokens: $file"
done
```

**Budget rule:** Individual skills should be under 2k tokens. Trim verbose skills.

### 3. Measure Rules/Config Overhead

```bash
# AGENTS.md + CLAUDE.md size
wc -c AGENTS.md CLAUDE.md 2>/dev/null

# .opencode/ config size
find .opencode/ -type f -exec wc -c {} + 2>/dev/null | sort -rn | head -10
```

**Budget rule:** AGENTS.md + CLAUDE.md combined should be under 15k tokens.

### 4. Identify Bloat Sources

Common bloat patterns:
- Skills with embedded reference docs (move to `references/` subdirectory)
- MCP servers with unused tools (disable with `/mcp`)
- Duplicate rules across `.agents/skills/` and `.claude/skills/`
- Overly detailed trigger descriptions in skill frontmatter

### 5. Remediation Actions

| Issue | Action |
|-------|--------|
| Too many MCPs | Disable unused with `/mcp` (Claude) or edit opencode.json |
| Oversized skills | Split into smaller skills or move detail to `references/` |
| Duplicate skills | Consolidate into `.agents/skills/` (canonical location) |
| Stale AGENTS.md sections | Run CLAUDE.md hygiene check, remove outdated priorities |
| Heavy SessionStart context | Set `ECC_SESSION_START_MAX_CHARS=4000` or `ECC_SESSION_START_CONTEXT=off` |

## PANaCEa-Specific Notes

- PANaCEa has 44+ skills in `.agents/skills/` — audit quarterly
- `.claude/skills/` mirrors some skills — deduplicate
- CLAUDE.md is large (~8k tokens) — keep priorities section current
- Multiple MCP servers active (1password, cloudflare, langfuse, etc.) — audit monthly
