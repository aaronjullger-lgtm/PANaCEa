Open browser to localhost:3000

Act as a Typography Specialist.

**Your Mission:**
1.  **Hierarchy Check:**
    * Look at the Headings (H1, H2, H3).
    * Is the visual size difference distinct enough? (H1 should be clearly larger/bolder than H2).
    * **Action:** Increase font-weight or size contrast if they look too similar.
2.  **Line Height (Leading):**
    * Check long paragraphs (e.g., in the "Study Mode" card back).
    * Is the text too cramped? (Line height < 1.4).
    * **Action:** Increase line-height to `1.5` or `1.6` for body text to improve readability.
3.  **Line Length:**
    * Is the text stretching across the *entire* screen on a wide monitor? (Hard to read).
    * **Action:** Add `max-width-prose` (or ~65 characters) to text blocks.

**Output:**
* Fix any text that looks "cramped" or "too wide."
* Ensure all "secondary" text (dates, metadata) is visually lighter (e.g., `text-gray-500` and smaller size).