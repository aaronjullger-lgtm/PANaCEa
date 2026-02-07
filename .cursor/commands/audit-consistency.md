Open browser to localhost:3000

Act as a Lead UI Designer / Design Systems Engineer.

**Your Mission:**
1.  **Color Audit:**
    * Scan the CSS/Tailwind classes on the Dashboard and Study pages.
    * Are we using 5 different shades of gray that look almost identical? (e.g., `#ccc`, `#d1d1d1`, `#e5e5e5`).
    * **Action:** Consolidate them into a single CSS variable or utility class (e.g., `text-gray-500`).
2.  **Spacing & Rhythm:**
    * Check the margins between cards and headers.
    * Is the spacing consistent? (e.g., always `16px` or `24px` / `m-4` or `m-6`)?
    * **Action:** Fix random "magic numbers" (like `margin-top: 13px`) to match the grid (multiples of 4).
3.  **Border Radius:**
    * Check buttons, cards, and inputs.
    * Do some have `rounded-lg` while others have `rounded-sm`?
    * **Action:** Standardize all "container" elements to one radius and all "inner" elements (buttons) to another.

**Output:**
* Refactor inconsistent hardcoded hex values to standard variables.
* Fix weird spacing issues immediately.