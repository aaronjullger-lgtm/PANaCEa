---
name: autoclaw-performance
description: Audit PANaCEa performance. Identify slow queries, large bundles, inefficient rendering, and optimization opportunities. Use when app feels slow or before production changes.
mode: performance
---

# Performance Mode — Optimization Audit

## Purpose
Find and fix performance issues. Always measure before optimizing.

## When to Use
- App feels slow (page load, interactions, test runs)
- Build times increasing
- Bundle size growing
- Before production deployment
- When adding new dependencies

## Audit Targets

### Build & Bundle
```bash
npm run build 2>&1 | grep -i "size\|chunk\|warning"
du -sh dist/
```
- [ ] Bundle under reasonable size?
- [ ] Code splitting working?
- [ ] Dead code eliminated?
- [ ] Dependencies not duplicated?

### Database
- [ ] Missing indexes on frequent WHERE/JOIN columns?
- [ ] N+1 queries in API endpoints?
- [ ] Unbounded queries (missing LIMIT)?
- [ ] Analytics queries using appropriate aggregations?

### Frontend
- [ ] Large component re-renders (React DevTools Profiler)?
- [ ] Unnecessary state updates?
- [ ] Images optimized?
- [ ] Lazy loading for heavy components?
- [ ] Debouncing on user input?

### API
- [ ] Response payloads trimmed to needed fields?
- [ ] Caching headers set where appropriate?
- [ ] Rate limiting functional?
- [ ] AI calls batched/cached?

## Output Format
```
## Performance Audit

### Findings
1. 🔴 {critical bottleneck} — {location} — {impact} — {fix}
2. 🟡 {improvement opportunity} — {location} — {expected gain}

### Bundle (if relevant)
- Before: {size}
- After: {size}
- Savings: {delta}

### Queries (if relevant)  
- Slowest: {query} — {time} — {fix}

### Recommendations
1. {highest-impact fix first}
2. {next}
```
