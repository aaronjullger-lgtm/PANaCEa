Open browser to localhost:3000

Act as a Data Engineer and Backend Specialist. We are auditing the FSRS (Free Spaced Repetition Scheduler) implementation.

**Your Mission:**
1.  **Enter Study Mode:** Start a review session with a dummy deck.
2.  **The "Algorithm Check":**
    * Open the browser console/network tab context.
    * Answer a card with "Again" (1). Check the network payload/response.
    * Answer the next card with "Good" (3). Check the network payload/response.
3.  **Verify Logic:**
    * **Intervals:** Did the "Good" card get a future date? Did the "Again" card stay near 'now'?
    * **Stability/Difficulty:** Are these values changing in the database/local state?
    * **NaN Check:** SEARCH the logs and state for `NaN`, `null`, or `undefined` in any date calculation fields.

**Output:**
* This is a "High Risk" audit. Do not auto-fix logic unless it's a syntax error.
* Report the calculated intervals you observed in `FSRS_AUDIT.md`.
* Flag if the 'Next Review' date is in the past.