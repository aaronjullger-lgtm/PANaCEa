# Deprecated Scripts

These scripts are **historical** and are **not run by automation**.

They were entry-generator scripts for populating taxonomy tables (differential diagnoses, lab tests, imaging studies, physical exam findings, procedures, ECG patterns, etc.). The codebase has migrated to a **database-first** pattern with API flows and consolidated generators.

**Do not run these scripts** unless you have a specific reason to reproduce legacy data generation. For current data pipelines, see:

- `scripts/` (root) – active maintenance, seed, and orchestration scripts
- `scripts/generators/` – current content generators
- `scripts/automation/` – hourly, daily, weekly automation jobs
