---
name: autoclaw-research
description: Research current best practices, docs, and patterns for PANaCEa. Use web search, official docs, and open-source repos. Summarize only what applies.
mode: research
---

# Research Mode — External Knowledge

## Purpose
Find reliable, current information to inform PANaCEa development.

## When to Use
- Framework/library behavior may have changed
- Need official docs for an API
- Unfamiliar error messages
- Current best practices matter
- Open-source repos may show better patterns

## Source Priority
1. Official documentation (react.dev, prisma.io, clerk.com, etc.)
2. Official source repository (GitHub)
3. Release notes / changelog
4. Well-maintained reference implementations
5. Reputable engineering blogs
6. GitHub issues/discussions
7. Stack Overflow (only as debugging clues)

## Workflow
1. Form specific query
2. Search with web_search or web_fetch
3. Extract only what applies to PANaCEa
4. Cross-check important claims
5. Adapt patterns to this repo's architecture
6. Record in .autoclaw/research-notes.md

## Output Format
```
## Research: {topic}
**Source:** {URL} | **Date:** {when checked}
**Finding:** {key insight, 2-3 bullets}
**Applicability:** {how this applies to PANaCEa}
**Caveats:** {version, context, limitations}
**Action:** {recommended next step}
```

## Rules
- Never copy code blindly — adapt to PANaCEa patterns
- Never add dependencies just because a tutorial uses them
- Note version compatibility
- Cross-check important claims against official docs
- Record all research in research-notes.md
