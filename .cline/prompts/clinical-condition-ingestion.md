# Clinical Condition Ingestion (Database-First)

## Trigger
"Ingest [Medical Condition] notes."

## Steps
1. **Analyze Notes:** Read the provided medical notes for [Condition].
2. **Map to Schema:** Map the symptoms, labs, and treatments to the Condition model in `prisma/schema.prisma`.
3. **Generate Seed:** Write a TypeScript function within `prisma/seed.ts` to upsert this data. Do not create a static file.
4. **Verify:** Run `npx tsx prisma/seed.ts` and confirm via `npm run db:studio` that the entry exists.