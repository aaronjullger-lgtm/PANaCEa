---
name: repo-operating-system
description: Use for initial repository audits and setup of AGENTS.md, repo maps, architecture docs, development commands, verification rules, and project standards. Trigger when the user asks to audit the repo, map the architecture, or establish project guidelines; do not use for ordinary feature implementation.
---

1. Inspect the repository root before editing. Read `package.json`, lockfiles, framework config, database config, CI config, and the top-level source/test directories. Identify the package manager from the lockfile and preserve existing commands and conventions.
2. Determine the project stack: framework, runtime, database clients, authentication, payments, API layer, test tools, linting, type checking, build tooling, deployment target, and generated-code directories.
3. Create or update `docs/repo-map.md` with the folder structure, module responsibilities, data flows, ownership boundaries, and files that agents should avoid editing without explicit need.
4. Create or update `docs/architecture.md` with the application architecture, client/server boundaries, database and API responsibilities, external services, background jobs, and known high-risk areas.
5. Create or update `docs/dev-commands.md` with install, lint, typecheck, test, build, database, local dev, preview, deploy, and troubleshooting commands. Use only commands that exist in the repo or clearly mark missing commands as gaps.
6. Create or update `AGENTS.md` following the open agent skills standard. Include product identity, target users, design principles, visual tokens when the app has UI, preferred stacks, animation rules, implementation rules, safety rules, and verification steps.
7. Document environment variable names and purposes without exposing secret values. Separate required local variables, CI variables, deployment variables, and optional integrations.
8. Add a verification checklist that uses the detected package manager and existing scripts. Prefer lint, typecheck, tests, and build; if a script is missing, record that as a setup gap instead of inventing it.
9. Preserve existing functionality. Do not delete user files, reset git state, expose secrets, replace established project conventions, or perform broad refactors during documentation setup.
10. Verify by running the documented commands that are available in the repo. At minimum, inspect `npm run`, `pnpm run`, `yarn run`, or the equivalent package-manager command to confirm script names.
11. Finish with a concise summary of changed documentation, discovered risks, missing commands, and recommended next steps.
