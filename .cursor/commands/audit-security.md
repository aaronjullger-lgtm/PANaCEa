Open browser to localhost:3000

Act as a Security Engineer. We are performing a "Smoke Test" on security before launch.

**Your Mission:**
1.  **Route Protection:**
    * Try to access `/dashboard` or `/admin` *without* being logged in. (Should redirect to Login).
    * Try to access a Login/Signup page *while* logged in. (Should redirect to Dashboard).
2.  **Input Handling:**
    * Enter standard "dangerous" characters into a flashcard input (e.g., `<script>alert('xss')</script>`).
    * Verify it renders as plain text, NOT as code.
3.  **Session Management:**
    * Log out.
    * Press the browser "Back" button. Can you still see the private page? (You shouldn't).

**Output:**
* If a protected route is exposed, FIX IT IMMEDIATELY.
* If XSS is possible, sanitize the input rendering.
* Log any complex auth issues in `SECURITY_AUDIT.md`.