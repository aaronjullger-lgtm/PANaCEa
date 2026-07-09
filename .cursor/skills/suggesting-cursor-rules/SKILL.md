---
name: suggesting-cursor-rules
description: Propose or draft new .cursor/rules/*.mdc rules when recurring conventions, mistakes, or review comments should be encoded as durable guidance. Use when the user asks to add/improve Cursor rules or when a pattern keeps recurring.
---

# Suggesting Cursor rules

Turn repeated conventions or mistakes into focused, scoped `.mdc` rules.

## When to use

- The same correction/convention comes up more than once.
- The user asks to add or improve project rules.
- A subsystem needs guardrails not yet captured in `.cursor/rules/`.

## Instructions

1. Check existing rules first (`.cursor/rules/*.mdc`) — extend an existing rule rather than duplicating. Do **not** overwrite `ui-design-system.mdc` or other authoritative rules.
2. Keep rules **focused** (one concern per file), not one giant file.
3. Use valid frontmatter:
   ```
   ---
   description: <what it covers and when to load it>
   globs: "**/*.tsx"        # optional: scope to file types/paths
   alwaysApply: false        # true only for core, always-relevant context
   ---
   ```
   - Use `globs` + `alwaysApply: false` for file-type-scoped rules.
   - Use `alwaysApply: true` sparingly (core context only) to avoid context bloat.
4. Each rule should state: scope, when it applies, non-negotiable conventions, anti-hallucination checks, commands to run before claiming success, and common failure modes.
5. Write the exact repo commands (npm scripts), not generic placeholders.

## Verification

- Frontmatter parses (valid YAML, `---` delimited).
- Globs match the intended files and nothing surprising.
- `git diff --stat` shows only new/edited rule files.

## Failure recovery

- Rule too broad or noisy → split it or add `globs` to scope it.
- Rule conflicts with an existing one → reconcile and reference the authoritative rule instead of duplicating.
