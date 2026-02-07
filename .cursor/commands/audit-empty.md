Open browser to localhost:3000

Act as a Product Manager and QA. We need to audit the "New User Experience".

**Your Mission:**
1.  **Simulate New User:**
    * Create a brand new account (or clear local storage/database for a test user).
2.  **Check Key Pages:**
    * **Dashboard:** Does it say "Loading..." forever? Or does it say "Welcome! Create your first deck"?
    * **Stats Page:** Does it crash because of "Division by Zero" (since there are 0 reviews)?
    * **Deck View:** What does an empty deck look like?
3.  **Call to Action:**
    * Is there a clear button to "Create" or "Get Started" when the page is empty?

**Output:**
* Fix any JavaScript errors caused by `null` or `undefined` data.
* If an empty state is just a blank white screen, add a simple "No data yet" text placeholder.