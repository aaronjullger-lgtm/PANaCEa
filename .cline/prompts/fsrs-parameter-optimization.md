# FSRS Parameter Optimization

## Trigger
"Optimize my review intervals."

## Steps
1. **Extract History:** Query the `ReviewLog` table via Prisma for all "Main Session" reviews.
2. **Run Optimizer:** Feed these logs into the FSRS-RS WASM binding optimizer.
3. **Apply Weights:** Take the resulting parameters (`w`) and update the User table configuration.
4. **Reschedule:** Recalculate the `due_date` for all Card entries based on the new weights.