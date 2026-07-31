# Skill Index — Canonical Routing Table

> **Source of truth for skill selection.** When multiple skills match a task,
> use the **Primary** column. Secondary skills may supplement but never replace.

## Exact Duplicates (delete one copy)

| Skill | Keep | Delete |
|-------|------|--------|
| panacea-verify | `.agents/skills/panacea-verify` | `.claude/skills/panacea-verify` |
| panacea-navigator | `.agents/skills/panacea-navigator` | `.claude/skills/panacea-navigator` |

## Overlap Groups — Canonical Primary

### General Dev & Navigation
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Where does code go? | `panacea-navigator` | — |
| General project patterns | `panacea-dev` | — |
| Study session / quiz / drill submit | `panacea-session-pipeline` | supersedes `session-orchestration` |
| Component sprint / improvement | `panacea-component-sprint` | — |
| Multi-skill coordination | `panacea-syncytium-coordinator` | — |

### FSRS & Spaced Repetition
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| FSRS pipeline + telemetry | `panacea-fsrs-guardrails` | supersedes `fsrs-pipeline` |
| FSRS math / domain theory | `fsrs-domain` | — |
| Wiring components to FSRS | `panacea-fsrs-wiring` | — |
| Scheduling improvements | `spaced-repetition-scheduler-improve` | — |

### Clinical Content & Question Generation
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Question generation pipeline | `panacea-question-generation` | supersedes `clinical-content-gen` |
| Content refinery / library / staging | `panacea-content-refinery` | — |
| Clinical accuracy audit | `panacea-clinical-content-auditor` | — |
| Patient safety review | `clinical-safety-review` | — |
| Clinical library search / embeddings | `clinical-library-search` | — |
| OSCE simulation | `panacea-osce-simulation` | — |
| NCCPA blueprint coverage | `clinical-content-gen` (keep for blueprint taxonomy) | — |

### Database & Prisma
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Schema / migrations / data integrity | `panacea-prisma-data-integrity` | supersedes `prisma-data-integrity` |
| Safe migration workflow | `migration-safety` | — |
| Supabase-specific ops | `supabase` | — |

### Verification & Testing
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Choose verification commands | `panacea-verify` | — |
| Write Vitest tests | `vitest-author` | — |
| Scoped typecheck (avoid OOM) | `scoped-typecheck` | — |
| Regression test hunting | `panacea-regression-guard` | — |
| CI/CD setup | `optimize-ci-cd` | — |

### Auth & Security
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| PANaCEa auth / Clerk / RBAC | `panacea-auth-guard` | supersedes `auth-policy-review` |
| Security / privacy audit | `security-and-privacy-audit` | — |
| Secret detection | `secret-detector` | — |

### Performance & Edge
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Bundle size / cold starts | `perf-bundle-edge` | — |
| Cloudflare Pages Functions API | `cf-edge-api` | — |
| Edge runtime safety guard | `edge-runtime-guard` | — |
| Performance audit | `performance-audit-optimise` | — |

### UI & Frontend
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Design system / tokens / style | `panacea-style-system` | — |
| View composition / routing | `panacea-view-composition` | — |
| Loading/error/empty states | `async-state-hardening` | — |
| UI primitive consolidation | `ui-primitive-consolidation` | — |
| AIDesigner frontend generation | `aidesigner-frontend` | — |

### Dashboard & Analytics
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| Dashboard metrics / charts | `panacea-dashboard-analytics` | supersedes `dashboard-trust` |

### AI Safety & Model Routing
| Task | Primary Skill | Merged/Deprecated |
|------|--------------|-------------------|
| AI generation safety / Gemini | `ai-generation-safety` | — |
| Model routing / escalation | `model-routing-escalation` | — |
| Langfuse tracing | `langfuse` | — |

## Consolidation Actions (after user approval)

1. Delete `.claude/skills/panacea-verify` (exact dup of `.agents/`)
2. Delete `.claude/skills/panacea-navigator` (exact dup of `.agents/`)
3. Merge `fsrs-pipeline` → `panacea-fsrs-guardrails` (keep guardrails as canonical)
4. Merge `clinical-content-gen` → `panacea-question-generation` (keep question-gen as canonical; extract blueprint taxonomy into its own skill)
5. Merge `prisma-data-integrity` → `panacea-prisma-data-integrity` (keep panacea-prefixed as canonical)
6. Merge `auth-policy-review` → `panacea-auth-guard` (keep panacea-prefixed as canonical)
7. Merge `dashboard-trust` → `panacea-dashboard-analytics` (keep panacea-prefixed as canonical)

## Statistics
- Total skills: ~137 (103 in `.agents/`, 34 in `.claude/`)
- Exact duplicates: 2
- Merge candidates: 5 overlap groups
- Post-consolidation target: ~125 skills
