# Workflow: The FSRS v6 Optimization Loop

**Trigger:** "Optimize system parameters."

1. **Data Extraction:**
   - Query `ReviewLog`.
   - **Filter:** `WHERE session_type = 'MAIN'` (Enforcing the single difficulty rule).
   - Export to a temporary JSON format required by `fsrs-rs`.
2. **WASM Execution:**
   - Run the `@open-spaced-repetition/binding` optimizer script.
   - Capture the new `w` (weights) array.
3. **Migration:**
   - Create a Prisma migration to update the `User` table's default `fsrs_weights` column.
   - Run a "Reschedule" script that recalculates `due_date` for all `Card` entries based on the new weights.
4. **Verification:**
   - Run a simulation on 5 random cards to ensure the new intervals are logical (e.g., not jumping from 1 day to 5 years instantly).