# Post-Encounter Analysis & OSCE Module — Audit Report

**Role:** Senior Full-Stack Architect & QA Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness, refactoring.  
**Reference plan:** Previous turn — “Post-Encounter Analysis” engine at `functions/api/osce/analysis/grade.ts`.

---

## Critical Fixes

### 1. **Session ownership not enforced (complete, chat)**

**Location:** `functions/api/osce/complete.ts`, `functions/api/osce/chat.ts`

**Issue:** Both endpoints update `PatientEncounterSession` by `sessionId` only. They do **not** verify that the session belongs to the authenticated user. Any authenticated user can complete or overwrite another user’s session by guessing or enumerating `sessionId`.

**Evidence:**

- `complete.ts` (lines 36–44): `prisma.patientEncounterSession.update({ where: { id: sessionId }, data: { ... } })` — no `userId` in `where`.
- `chat.ts` (lines 42–47): Same pattern — update by `sessionId` only.

**Fix:** Resolve the user by `clerkId`, then restrict the update to that user’s sessions:

```ts
const user = await prisma.user.findUnique({ where: { clerkId: auth.userId }, select: { id: true } });
if (!user) return { status: 404, error: 'User not found' };
await prisma.patientEncounterSession.updateMany({
  where: { id: sessionId, userId: user.id },
  data: { ... },
});
// Then check result count or use findFirst + update to return 404 if no row matched.
```

Apply the same ownership check in both `complete.ts` and `chat.ts`.

---

### 2. **History endpoint uses non-existent model**

**Location:** `functions/api/osce/history.ts` (line 65)

**Issue:** The handler calls `prisma.encounterChatHistory.findMany(...)`. There is **no** `EncounterChatHistory` model in `prisma/schema.prisma`. The schema has `EncounterResult` (different purpose) and OSCE conversation is stored in `PatientEncounterSession.messages` (JSON). This will throw at runtime when the endpoint is hit.

**Fix (choose one):**

- **Option A:** If chat history should come from the session, change to:
  - `prisma.patientEncounterSession.findFirst({ where: { id: sessionId, userId: user.id }, select: { messages: true } })`
  - Return `messages` (and enforce session ownership by `userId`).
- **Option B:** If a separate chat-history table is desired, add the model to the schema and a migration, then keep the current pattern but add session-ownership checks (e.g. join through `PatientEncounterSession` and filter by `userId`).

---

### 3. **History endpoint does not enforce session ownership**

**Location:** `functions/api/osce/history.ts`

**Issue:** Even after fixing the model name, the current code does not ensure that `sessionId` belongs to the current user. A user could pass another user’s `sessionId` and read their chat history.

**Fix:** Resolve the user by `clerkId`, then query session (and history) only where `userId === user.id` (and optionally `id === sessionId`). Return 404 if no such session exists.

---

### 4. **PatientEncounterSession.create omits required `updatedAt`**

**Location:** `functions/api/osce/session.ts` (lines 57–64), `routes/osce.ts` (lines 68–75)

**Issue:** `PatientEncounterSession` in the schema has `updatedAt DateTime` with no `@default` or `@updatedAt`. Both the Pages Function and the Express route create a session without setting `updatedAt`. Prisma will require this field on create; the call may be failing or relying on DB defaults that are not reflected in the schema.

**Fix:**

- In the schema, either add `@updatedAt` (so Prisma sets it automatically) or `@default(now())` for `updatedAt`.
- Run a migration if you add a default. Ensure all call sites that create sessions do not need to pass `updatedAt` manually.

---

## Logical Omissions

### 1. **ConceptGap system vs repo convention**

**Location:** `functions/api/osce/analysis/grade.ts` — `inferSystemFromCase()` and `ConceptGap.system`

**Issue:** The code writes human-readable system names (e.g. `"Cardiology"`, `"Pulmonary"`) into `ConceptGap.system`. The rest of the repo uses `OrganSystemSchema` in `functions/api/_shared/schemas.ts` with **lowercase** values (e.g. `cardiovascular`, `pulmonary`). Downstream (e.g. Tutor or analytics) may filter or join on `system` and expect the shared enum; mismatched values can cause missed or duplicate targeting.

**Recommendation:** Map inferred system to the same enum (e.g. `cardiovascular`, `pulmonary`, `infectious_disease`, `nephrology`, `psychiatry`, etc.) and store that in `ConceptGap.system`. Add a small mapping from display name → schema value and use it before creating `ConceptGap`.

---

### 2. **Duplicate ConceptGaps on re-grade**

**Location:** `functions/api/osce/analysis/grade.ts` — `persistGradeAndConceptGap()`

**Issue:** Each time the same session is graded and “differential failed” is true, a new `ConceptGap` row is created for the same `(userId, system, sourceType: 'osce', sourceId)`. Re-grading the same encounter can create many duplicate gaps for the same concept/system.

**Recommendation:** Before creating a ConceptGap, check for an existing row for the same `userId`, `system`, `sourceType = 'osce'`, and `sourceId = savedResult.id` (or same `sessionId`). Create only if none exists; optionally update a “lastSeenAt” or count if you want to track repeat failures.

---

### 3. **No way to create CaseRubric**

**Location:** Schema and OSCE APIs

**Issue:** The grading flow assumes a `CaseRubric` exists for each `PatientEncounterCase`. There is no API or seed path documented to create rubrics. Grading returns 404 with “No rubric found for this case” until rubrics are created out-of-band.

**Recommendation:** Add at least one of: (a) a seed script or migration that creates default rubrics from existing cases (e.g. from `essentialQuestions` / `idealWorkup`), (b) an admin or internal API to create/update `CaseRubric` for a given `caseId`, or (c) a fallback in the grader that builds a minimal rubric from case fields when no rubric exists (and optionally persist it). Document the chosen approach.

---

### 4. **Gemini rate limit not applied to grade endpoint**

**Location:** `functions/api/osce/analysis/grade.ts` vs `functions/api/gemini/index.ts`, `functions/api/clinical-eye/analyze.ts`

**Issue:** Other Gemini-consuming endpoints use `withRateLimit(env, identifier, 'gemini')` to cap expensive calls. The grade endpoint uses only the generic rate limit from `authenticatedEndpoint`. A single user can trigger many grading requests and burn quota.

**Recommendation:** After validating env (e.g. `GEMINI`), call the same `withRateLimit(..., 'gemini')` (and `getRateLimitIdentifier(request)`) before calling Gemini in the grade handler; return 429 and appropriate headers when over limit.

---

## Technical Debt

### 1. **Validation schema shape (`body.body`)**

**Location:** All OSCE endpoints using `authenticatedEndpoint` with a schema like `z.object({ body: z.object({ sessionId: IDSchema }) })`.

**Issue:** Validated shape is `validated.body.sessionId`. So the **client** must send `{ body: { sessionId: "..." } }`. That double-wrapping is easy to get wrong and is not documented in the audit scope.

**Recommendation:** Document the expected request body (e.g. in OpenAPI or README). If the rest of the API uses a flat body, consider aligning OSCE on a flat shape (e.g. `z.object({ sessionId: IDSchema })`) and use a single wrapper in middleware if needed.

---

### 2. **Parse / persistence error handling in grade**

**Location:** `functions/api/osce/analysis/grade.ts`

**Issue:** `parseGradePayload()` only checks that `checklist` and `redFlagsMissed` are arrays; it does not validate that each checklist item has `item`, `status` in `['PASS','FAIL']`, and `feedback`. Malformed Gemini output could persist invalid JSON into `OsceResult.checklist`. `persistGradeAndConceptGap` throws on “Failed to persist OsceResult”; that throw is caught by the outer handler and returned as 500, which is acceptable but could be logged with more context (e.g. sessionId).

**Recommendation:** Validate checklist items with a Zod schema (e.g. `z.object({ item: z.string(), status: z.enum(['PASS','FAIL']), feedback: z.string() })`) and coerce or reject invalid entries. Enrich the catch block for persist failures with sessionId and a short message for debugging.

---

### 3. **RLS not extended to new OSCE tables**

**Location:** `prisma/migrations/20260104_add_rls_policies/migration.sql`

**Issue:** RLS is enabled on several user-data tables; `PatientEncounterSession`, `OsceResult`, `ConceptGap`, and `CaseRubric` are not included. If Supabase is used with anon/key and RLS is relied on elsewhere, these tables are only protected by the API. That is consistent with “API enforces ownership” but should be explicit.

**Recommendation:** Document that OSCE tables are protected at the API layer (and fix ownership in complete/chat/history as above). If you later move to RLS for OSCE, add policies for `PatientEncounterSession` (and related tables) so that `userId` is constrained by `auth.uid()` / Clerk mapping.

---

### 4. **Migration: CaseRubric.updatedAt**

**Location:** `prisma/migrations/20260201190000_add_osce_analysis_models/migration.sql`

**Issue:** `CaseRubric` has `"updatedAt" TIMESTAMP(3) NOT NULL` with no default. Inserts via Prisma will send `updatedAt` because of `@updatedAt` in the schema, so runtime inserts are fine. Raw SQL inserts would need to supply `updatedAt`; the migration itself only creates the table, so no change required unless you add seed data in SQL.

**Recommendation:** No change required for current usage. If you add seed SQL later, set `updatedAt` explicitly (e.g. `CURRENT_TIMESTAMP`).

---

## Verification Steps

1. **Ownership and security**
   - As User A, create an OSCE session and get `sessionId`.
   - As User B (different account), call:
     - `POST /api/osce/complete` with User A’s `sessionId`.
     - `POST /api/osce/chat` with User A’s `sessionId` and a body with messages.
   - **Expected:** Both should fail (404 or 403) after you add the ownership checks. Today they can succeed and modify User A’s data.
   - After fixing history: as User B, call `GET /api/osce/history?sessionId=<User A's sessionId>`. **Expected:** 404 or empty, not User A’s history.

2. **History endpoint**
   - Call `GET /api/osce/history?sessionId=<valid-session-id>` with a session that exists and has messages.
   - **Expected (current):** Likely runtime error due to `encounterChatHistory`. After fix, expect 200 and history derived from that session (with ownership enforced).

3. **Session creation**
   - Create a new OSCE session via `POST /api/osce/session` with a valid `caseId`.
   - **Expected:** 200 and a new session. If you see DB errors about `updatedAt`, add `@updatedAt` or `@default(now())` to `PatientEncounterSession.updatedAt` and migrate.

4. **Grading flow**
   - Create a `CaseRubric` for a case (via script or future API).
   - Complete a session (status = completed) that has messages.
   - Call `POST /api/osce/analysis/grade` with body `{ body: { sessionId: "<that-session-id>" } }`.
   - **Expected:** 200, `data.resultId`, `data.score`, `data.checklist`, `data.conceptGapCreated` (true when differential fails or red flags missed). No 502 from parse or Gemini.
   - Re-call grade with the same sessionId; **expected:** 200 and updated result; check that ConceptGap duplication (if any) is acceptable or reduced by the dedup logic.

5. **ConceptGap and Tutor**
   - Run a grading that triggers a ConceptGap (e.g. low clinicalReasoningScore or redFlagsMissed).
   - Query `ConceptGap` for that user; confirm `system` and `sourceType`/`sourceId`.
   - If the Tutor filters by `system`, confirm it uses the same convention (e.g. lowercase) as `ConceptGap.system` after you align the enum.

6. **Rate limit**
   - After adding Gemini rate limit to the grade endpoint, send many grade requests in a short window; **expected:** 429 after the configured limit.

7. **Schema and migration**
   - Run `npx prisma migrate deploy` (or your pipeline) against a copy of production DB; resolve any shadow-DB or migration-order issues.
   - Run `npx prisma generate` and run the test suite; fix any type or model references (e.g. `encounterChatHistory`).

---

## Summary Table

| Category            | Item                                      | Severity | Owner fix |
|---------------------|-------------------------------------------|----------|-----------|
| Critical            | complete.ts / chat.ts no session ownership | High     | Yes       |
| Critical            | history.ts uses non-existent model        | High     | Yes       |
| Critical            | history.ts no session ownership           | High     | Yes       |
| Critical            | PatientEncounterSession.create missing updatedAt | Medium   | Yes       |
| Logical             | ConceptGap.system vs OrganSystemSchema    | Medium   | Recommended |
| Logical             | Duplicate ConceptGaps on re-grade         | Low      | Recommended |
| Logical             | No CaseRubric creation path               | Medium   | Recommended |
| Logical             | Grade endpoint no Gemini rate limit       | Medium   | Recommended |
| Technical debt      | Request body double-wrap documentation   | Low      | Optional  |
| Technical debt      | Checklist item validation in grade        | Low      | Optional  |
| Technical debt      | RLS vs API-layer security documented      | Low      | Optional  |

This audit focuses on the Post-Encounter Analysis implementation and the OSCE module patterns; addressing the critical fixes first will close the main security and correctness gaps before scaling or refactors.
