# Workflow: The Clinical Ingestion Pipeline

**Trigger:** "Ingest notes for [Medical Topic]."

1. **Deep Analysis:** Scan the raw notes. Identify "Pearls," "Symptoms," "Labs," and "Treatments."
2. **Blueprint Check:** Cross-reference the topic with `panceblueprint.md`. If it's missing or miscategorized, flag it.
3. **Schema Mapping:**
   - Does this `Condition` exist? -> `upsert`
   - Do these `Symptoms` exist? -> `connectOrCreate`
   - **Crucial:** Do not write a JSON file. Write a function in `prisma/seed.ts`.
4. **Permutation Generation:** Generate 3 distinct `Question` templates (Vignettes) for this condition using the Gemini API context, but *save them to the DB immediately* as "Vetted" status.
5. **Clean Up:** Check if this topic exists in `conditionRegistry.ts`. If yes, delete it from that file to reduce technical debt.