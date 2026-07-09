# LICENSE Decision Needed (Phase 3 — owner action)

**Status:** the repository has **no `LICENSE` file** (verified). This mission does **not** choose a license — that is an owner-only decision. This document lays out the options and consequences so the owner can pick.

## Why it matters
Without an explicit license, **default copyright applies**: no third party has legal permission to use, copy, modify, or (re)distribute the code. For a solo-owned proprietary product this may be intended, but it should be a deliberate choice, and CI/deploy contributor tooling (agents, cloud CI) technically operate on all-rights-reserved code.

## Options
| Option | When to choose | Consequence |
|---|---|---|
| **Proprietary / All Rights Reserved** (add an explicit `LICENSE` stating this) | PANaCEa is a closed commercial product (most likely here) | Clear "no external use" statement; keeps everything closed. Recommended if not open-sourcing. |
| **Source-available** (e.g. BSL 1.1, PolyForm Noncommercial) | Want code visible but not freely reusable/competable | Restricts commercial/competing use; converts to OSS after a date (BSL). |
| **Apache-2.0** | Want permissive OSS **with** explicit patent grant | Others may use/modify/distribute; includes patent protection + NOTICE requirements. |
| **MIT** | Want simplest permissive OSS | Maximal reuse; minimal restrictions; no patent grant. |

## Recommendation (non-binding)
Given PANaCEa is a premium commercial PANCE-prep platform with proprietary clinical content and FSRS IP, a **Proprietary / All-Rights-Reserved `LICENSE`** (or a source-available BSL-1.1 if visibility is desired) is the most consistent choice. **Owner must confirm** before any `LICENSE` is added.

## Also recommended (owner to accept)
- `SECURITY.md` (vulnerability disclosure contact/process).
- `.github/dependabot.yml` (automated dependency PRs).
These are low-risk repo files but are **not added here** pending the license/ownership decision, to avoid implying an OSS posture the owner hasn't chosen.

**No license was selected or added by this mission.**
