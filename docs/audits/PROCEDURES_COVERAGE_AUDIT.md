# Procedures Coverage Audit

Date: 2026-05-02 00:08 EDT

## Grade

Procedure coverage grade: **68/100 (D), P2**

The `Procedure` schema is rich, but procedure content sources are split across treatment, surgery, generators, and DB rows. Procedure APIs exist, but procedure-to-condition and procedure-to-question completeness is not proven from source-controlled data.

Second-pass update: the reference procedure endpoint is DB-backed and closer to production than the sim-lab surface. `functions/api/reference/procedures/index.ts` queries `Procedure` with condition links, while `functions/api/sim-lab/procedure.ts` still returns a hardcoded central-line sample. The procedure generator also drops `ProcedureConditionLink`, so generated procedure rows may not participate in the condition graph.

## Procedure Coverage Table

| Procedure | System | Indications | Contraindications | Steps Present | Complications Present | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|
| Arthrocentesis | MSK | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Verified seed row and PA skill level |
| Lumbar puncture | Neuro/ID | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Papilledema/ICP safety, aftercare |
| Incision and drainage | Derm/EM | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Antibiotic criteria, packing guidance |
| Suturing/laceration repair | Derm/EM | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Wound risk, tetanus, follow-up |
| Endotracheal intubation | EM/Pulm | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | RSI meds, failed airway, complications |
| FAST exam | EM/Trauma | Imaging registry | Imaging contraindications limited | Imaging/procedure split | Schema-supported | Imaging links | Partial | Whether modeled as imaging or procedure |
| Appendectomy | Surgery/GI | Surgery registry | Unknown in Procedure | Surgery source | Surgery source | Unknown | No | Unified surgery->procedure migration |

## Evidence

| Area | Evidence | Notes |
|---|---|---|
| Procedure model | `prisma/schema.prisma:2492` | Rich fields: indications, contraindications, equipment, technique, complications, aftercare |
| Condition link | `prisma/schema.prisma:2540` | Procedure-to-condition link exists |
| API | `functions/api/reference/procedures/index.ts:36` | Authenticated list/filter/search |
| Sim-lab procedure endpoint | `functions/api/sim-lab/procedure.ts:16` | Hardcoded central-line sample, not DB-backed |
| Procedure generator | `scripts/generators/procedure-generator.ts:561` | Explicitly strips condition links |
| Treatment registry | `src/registries/treatmentRegistry.ts:21` | 49 treatment/intervention entries |
| Surgery registry | `src/registries/surgeryRegistry.ts:20` | 51 surgery entries, not clearly unified |

## Findings

| Finding | Severity | Problem | Recommended Fix | Verification |
|---|---|---|---|---|
| Procedure sources are fragmented | P2 | Treatment, surgery, and procedure concepts can diverge | Define one `Procedure` seed manifest with source type | Seed dry-run output |
| Condition links are not proven | P1 | Procedure drills cannot target disease-specific indications | Seed `ProcedureConditionLink` for high-yield conditions | Link count by procedure |
| Emergency relevance exists as field but not coverage proof | P2 | EM procedures may be shallow | Add EM procedure minimum set | Procedure QA checklist |
| No clear procedure API tests found | P2 | Contract drift risk | Add endpoint tests for filters and detail links | Vitest API tests |
| Sim-lab procedure is not using canonical procedures | P2 | Static central-line response | Procedure simulation can diverge from reviewed procedure content | Load from `Procedure` by id/system and require review metadata | Sim-lab endpoint test |
| Generated procedures may be unlinked | P1 | generator excludes `ProcedureConditionLink` | Procedure drills cannot target condition indications | Add link seed step after procedure generation | Procedure-condition link integrity report |
