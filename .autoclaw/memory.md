# .autoclaw/memory.md — Compressed Durable Facts

_Updated: 2026-05-22 | Keep ≤ 800 tokens_

## Current State
- Repo: 603 components, 77 hooks, 112 services, 81+ API endpoints, 60+ DB models
- Tests: 3200+ passing, 205+ test files
- Model: deepseek-v4-pro (reasoning, 1M context) for all PANaCEa coding
- Active workstreams: UI Phase 3 (dashboard/quiz/analytics), CSS var migration, inline styles → Tailwind

## Key Constraints
- Binary rating ONLY (Again/Good), implicit metrics, no self-rated buttons
- Only MAIN and DRILL sessions update FSRS
- Par time per-question-type, calculated from historical data
- NEVER process.env in Edge → context.env.*
- All Edge functions: try/catch + safePrismaDisconnect in finally
- trash > rm
- "Do it for me" = fully execute, no questions

## Self-Learning Infra
- `~/self-improving/` — HOT/WARM/COLD tiers
- `workspace/brain/` — journal, decisions, lessons
- `.autoclaw/` — project-specific durable memory

## Links
- Project map → .autoclaw/project-map.md
- Repo patterns → .autoclaw/repo-patterns.md
- Agent rules → .autoclaw/agent-rules.md
- Full context → CLAUDE.md (repo root, 472 lines)
