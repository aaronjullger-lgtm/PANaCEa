# Database Seeding

Seeding populates the database with initial content (conditions, questions, drills, etc.). Run seeds in the order below to satisfy foreign keys and dependencies.

## Required order

1. **Conditions / registry** (first)  
   - `npm run seed:registry` — `tsx ./scripts/seedDatabaseFromRegistry.ts`  
   - Populates `MedicalContent` from the condition registry. This is the source of truth for conditions.

2. **Question pool**  
   - `npm run seed:question-pool` — `tsx ./scripts/seed-question-pool.ts`  
   - Depends on conditions/registry.

3. **Optional seeds** (order may vary; run after registry and question pool if needed)  
   - Drills: `scripts/seed-drills.ts`, `scripts/seed-fluids.ts`, `scripts/seed-antibiotics.ts`, `scripts/seed-code-blue.ts`  
   - OSCE: `scripts/seed-osce-cases.ts`  
   - Buzzwords: `scripts/seedBuzzwords.ts`  
   - Other: `scripts/seedMissingContent.ts`, `scripts/db/seed-contrastive-sets.ts`, `scripts/seed/seed-normal-*.ts`, `scripts/generators/seed-all-tables.ts`

## Single-command seed (minimal)

To run the minimal set in order (registry then question pool):

```bash
npm run seed
```

or:

```bash
npm run db:seed
```

This runs `scripts/seed-run.ts`, which executes `seed:registry` then `seed:question-pool`. Use individual `seed:*` scripts for optional content.

## Notes

- Seed scripts use Node `PrismaClient` and are intended for local/CI, not the Edge runtime.
- Ensure migrations are applied (`npm run db:migrate:deploy` or `db:migrate:dev`) before seeding.
- Load environment variables (e.g. `.env`) when running seeds locally.
