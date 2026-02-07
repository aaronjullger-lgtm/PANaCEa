Open browser to localhost:3000

Act as a Performance Engineer. We need to stop the app from feeling "sluggish".

**Your Mission:**
1.  **Asset Check:**
    * identify any images larger than 500KB.
    * identify any layout shifts (CLS) where the page "jumps" as it loads.
2.  **Bundle Inspection:**
    * Check the Network tab. Are we loading unnecessary libraries on the homepage?
3.  **Memory Leak Check:**
    * Navigate between "Study Mode" and "Dashboard" 10 times quickly.
    * Does the browser get noticeably slower?

**Output:**
* Compress any massive images immediately.
* If a component re-renders 100 times in the console logs, flag it.