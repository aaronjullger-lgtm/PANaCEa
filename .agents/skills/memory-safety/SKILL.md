---
name: memory-safety
description: Use this skill when reviewing memory ingestion, prompt context, cached content, retention/deletion, privacy, provenance, memory poisoning, prompt injection, or source governance.
---

# Memory Safety

Use this skill when reviewing memory ingestion, prompt context, cached content, retention/deletion, privacy, provenance, memory poisoning, prompt injection, or source governance.

## First Files

- `functions/api/knowledge/cache/student-context.ts`
- `functions/api/knowledge/cache.ts`
- `functions/api/knowledge/cache/[id].ts`
- `functions/api/knowledge/cache/[name].ts`
- `functions/api/knowledge/upload.ts`
- `functions/api/content/library/extract.ts`
- `functions/api/content/library/ingest.ts`
- `services/domain/educationalResourceService.ts`
- `functions/api/content/textbook-retrieve.ts`
- `.env.example`
- `wrangler.toml`

## Loop

scan memory inputs -> detect PII/secrets/injection attempts -> validate provenance -> enforce retention policy -> quarantine risky memory -> log decisions -> run safety tests

## Checks

- Browser-exposed env vars do not include server AI keys.
- Raw upstream/internal errors are not returned to users.
- External cached content can be deleted and verified.
- Uploaded and extracted content has provenance and review state.
- Public retrieval endpoints only expose public/licensed content.
- Retrieved text is treated as untrusted prompt context.
- Sensitive learner data is not logged.

## Failure Handling

- Quarantine unsafe memory.
- Skip embedding/indexing for untrusted content.
- Delete external cache and local record when retention expires.
- Record metadata-only audit decision.
- Mark unresolved behavior as `Unclear`.

## Commands

- `npm run test:memory`
- `npm run eval:memory`
