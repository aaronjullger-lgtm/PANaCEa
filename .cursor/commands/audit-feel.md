Open browser to localhost:3000

Act as an Interaction Designer.

**Your Mission:**
1.  **Hover States:**
    * Hover over every clickable element (Buttons, Cards, Links).
    * Does the cursor change to a pointer?
    * Is there a visible visual change (color shift, slight lift, border color)?
    * **Action:** Add a subtle `hover:bg-opacity-90` or `hover:scale-[1.02]` to interactive elements that lack it.
2.  **Focus States:**
    * Click into a text input.
    * Is there a clear "ring" or border color change?
    * **Action:** Ensure focus states match the brand color (not the default browser blue).
3.  **Transitions:**
    * Do dropdowns or modals just "snap" into existence?
    * **Action:** Add simple CSS transitions (e.g., `transition-all duration-200`) for smoother state changes.

**Output:**
* Add hover effects to any "dead" buttons.
* Fix ugly default browser focus rings.