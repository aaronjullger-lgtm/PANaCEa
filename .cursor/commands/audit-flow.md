Open browser to localhost:3000

Act as a QA Lead. We need to verify the "Happy Path" for a medical student using this app.

**Your Mission:**
1.  **Simulate a User:**
    * Log in (or assume logged in state).
    * Create a new resource (e.g., a new study session).
    * Use that resource.
    * Close that resource.
2.  **Verify Integrity:**
    * Did the UI update immediately after the action? (Optimistic UI check).
    * Did the Console throw any 400/500 errors during these requests?
3.  **The "Click Test":**
    * Click every interactive button on the Dashboard. If a button does nothing, flag it.
    * Submit forms with empty data. Did the validation trigger?

**Output:**
* Fix any broken links or simple validation errors.
* If a feature is completely broken (500 error), stop and generate a detailed bug report in `CRITICAL_BUGS.md`.