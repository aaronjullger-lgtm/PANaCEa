# .autoclaw/skill-registry.md — Tracked Skills

## Managed Skills (in ~/.openclaw-autoclaw/skills/)
27 active skills after pruning. Full list in workspace.

### Key Coding Skills
| Skill | Purpose | Trust |
|-------|---------|-------|
| panacea-coding v2.0 | Full PANaCEa context + autonomous execution + model routing | Created locally |
| code-1.0.4 | Coding workflow with planning/verification | ClawHub |
| debug-pro-1.0.0 | 7-step debugging protocol | ClawHub |
| test-runner-1.0.0 | Vitest/Jest/pytest test patterns | ClawHub |
| architecture-designer-0.1.0 | System design + ADRs | ClawHub |
| frontend-design | Production-grade UI components | ClawHub |
| git-essentials-1.0.0 | Git commands and workflows | ClawHub |
| github-1 | GitHub CLI (issues, PRs, CI) | ClawHub |
| agentic-coding | Contract-first implementation + PACT loop | ClawHub |
| brainstorming | Feature planning + design validation | ClawHub |
| executing-plans-0.1.0 | Plan execution with review checkpoints | ClawHub |
| writing-plans-0.1.0 | Implementation plan creation | ClawHub |
| memory-1.0.2 | Infinite organized memory | ClawHub |
| self-improving-1.1.3 | Self-reflection + memory tiers | ClawHub |
| hermes-evolution | User-approved AGENTS.md/MEMORY.md updates | ClawHub |

## Workspace Skills (35 total, under evaluation)
Key ones for PANaCEa:
- react-expert — React patterns
- typescript-mastery — TypeScript patterns
- prisma — Prisma patterns
- vitest-testing — Test patterns
- refactor-safely — Safe refactoring
- code-quality-guard — Pre-deployment quality
- cloudflare-toolkit — Cloudflare Edge
- tailwind-design-system — Design tokens
- token-optimization — Context optimization

## Archived Skills (75 in _archived/)
Stock analysis, weather, Feishu, news, social media, video tools, etc.
Move back if needed by copying from `_archived/` to skills dir.

## Local Agent Mode Skills (11 created 2026-05-22)
| Skill | Mode | Purpose |
|-------|------|---------|
| autoclaw-scout | Scout | Explore code before editing |
| autoclaw-architect | Architect | Design decisions + ADRs |
| autoclaw-builder | Builder | Sprint-based implementation |
| autoclaw-reviewer | Reviewer | Self-critique code changes |
| autoclaw-research | Research | Web/docs research |
| autoclaw-debugger | Debugger | Systematic root cause analysis |
| autoclaw-qa | QA | End-to-end verification |
| autoclaw-security | Security | Risk reduction + secret audit |
| autoclaw-product | Product | UX decisions for PA students |
| autoclaw-performance | Performance | Optimization audit |
| autoclaw-orchestrator | Orchestrator | Multi-agent coordination |

**Location:** `.autoclaw/skills/<mode>/SKILL.md` (copied to `~/.openclaw-autoclaw/skills/autoclaw-<mode>/`)

## Creation Template
```
.autoclaw/skills/<skill-name>/SKILL.md
- name, purpose, when to use, when not to use
- required context, exact workflow, commands
- validation checklist, common failures, security notes
```
