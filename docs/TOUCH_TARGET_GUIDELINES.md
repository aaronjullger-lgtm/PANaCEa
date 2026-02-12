# Touch Target Accessibility Guidelines

## Overview
This document outlines the touch target accessibility standards for the PANaCEa platform. Proper touch target sizing is critical for mobile usability and accessibility compliance.

## WCAG Requirements
- **WCAG 2.1 Success Criterion 2.5.5 Target Size (Level AAA)**: Touch targets must be at least 44×44 pixels
- **WCAG 2.2 Success Criterion 2.5.8 Target Size (Minimum) (Level AA)**: Touch targets must be at least 24×24 pixels (with exceptions)

## Our Standards
We adopt the **44×44 pixel minimum** as our standard for all interactive elements to ensure:
- Comfortable use on mobile devices
- Accessibility for users with motor impairments
- Prevention of accidental taps
- Consistency across the application

## Implementation Guidelines

### 1. Button Sizes
Use the `StandardButton` component with appropriate size classes:

```tsx
import { StandardButton } from '@/components/shared/StandardButton';

// Recommended sizes for different contexts
<StandardButton size="md">Default Action</StandardButton>      // 44px min-height
<StandardButton size="lg">Primary Action</StandardButton>      // 48px min-height  
<StandardButton size="sm">Secondary Action</StandardButton>    // 36px min-height (with padding)
<StandardButton size="xs">Compact UI</StandardButton>          // 32px min-height (with sufficient padding)
```

### 2. Minimum Dimensions
Always ensure minimum dimensions:
```css
/* CSS Utility Classes */
.min-touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* For icon buttons */
.icon-button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
}

/* For text links */
.touch-link {
  display: inline-block;
  min-height: 44px;
  line-height: 44px;
  padding: 0 8px;
}
```

### 3. Spacing Between Targets
Maintain at least **8px spacing** between touch targets:

```css
/* Good: Sufficient spacing */
.button-group {
  display: flex;
  gap: 12px; /* At least 8px */
}

/* Bad: Targets too close */
.button-group-bad {
  display: flex;
  gap: 2px; /* Risk of accidental taps */
}
```

### 4. Visual Feedback
Provide clear visual feedback for touch interactions:

```css
.touch-element {
  transition: all 0.2s ease;
}

.touch-element:hover {
  background-color: var(--color-bg-tertiary);
  transform: translateY(-1px);
}

.touch-element:active {
  background-color: var(--color-bg-tertiary);
  transform: translateY(0);
}

.touch-element:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

## Common Patterns

### Icon Buttons
```tsx
// Good: Proper touch target
<button className="icon-button">
  <svg className="w-6 h-6" />
</button>

// CSS for icon button
.icon-button {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 8px;
}
```

### Form Elements
```tsx
// Good: Labels as part of touch target
<label className="touch-label">
  <input type="checkbox" />
  <span>Checkbox Label</span>
</label>

// CSS for touch labels
.touch-label {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px;
  cursor: pointer;
}
```

### Navigation Items
```tsx
// Good: Sufficient padding for nav items
<nav className="touch-nav">
  <a href="/" className="nav-link">Home</a>
  <a href="/about" className="nav-link">About</a>
</nav>

// CSS for nav links
.nav-link {
  display: inline-block;
  min-height: 44px;
  line-height: 44px;
  padding: 0 16px;
}
```

## Testing Guidelines

### 1. Manual Testing
- Test on actual mobile devices
- Use different finger sizes (average: 16mm, large: 20mm, XL: 24mm)
- Test with one-handed operation
- Verify no accidental adjacent taps

### 2. Automated Testing
Use the `TouchTargetAudit` component:

```tsx
import { TouchTargetAudit } from '@/components/shared/TouchTargetAudit';
import { useTouchTargetAudit } from '@/hooks/useTouchTargetAudit';

function MyComponent() {
  const { openAudit, getTouchTargetStats } = useTouchTargetAudit();
  
  const stats = getTouchTargetStats();
  console.log(`Pass rate: ${stats.passRate}%`);
  
  return (
    <>
      <button onClick={openAudit}>Check Touch Targets</button>
      <TouchTargetAudit isOpen={isAuditOpen} onClose={closeAudit} />
    </>
  );
}
```

### 3. Audit Checklist
- [ ] All buttons have min-height of 44px
- [ ] Icon buttons have min-width/min-height of 44px
- [ ] Form elements have sufficient padding
- [ ] Links have min-height of 44px or sufficient padding
- [ ] Spacing between targets is at least 8px
- [ ] Visual feedback is provided on touch/hover
- [ ] Focus indicators are visible
- [ ] Tested on multiple screen sizes
- [ ] Tested with different finger sizes

## Common Issues and Fixes

### Issue: Small Icon Button
```css
/* Before: Too small */
.small-icon {
  width: 24px;
  height: 24px;
  padding: 4px;
}

/* After: Proper touch target */
.small-icon {
  width: 24px;
  height: 24px;
  min-width: 44px;
  min-height: 44px;
  padding: 10px; /* (44-24)/2 = 10px padding */
}
```

### Issue: Close Spacing
```css
/* Before: Targets too close */
.close-buttons {
  display: flex;
  gap: 2px;
}

/* After: Sufficient spacing */
.close-buttons {
  display: flex;
  gap: 12px;
}
```

### Issue: Inline Links
```css
/* Before: Text-only link */
.text-link {
  color: blue;
  text-decoration: underline;
}

/* After: Touch-friendly link */
.text-link {
  color: blue;
  text-decoration: underline;
  display: inline-block;
  min-height: 44px;
  line-height: 44px;
  padding: 0 8px;
}
```

## Performance Considerations

### 1. Touch Action
Use `touch-action` CSS property to improve scrolling performance:

```css
.touch-element {
  touch-action: manipulation; /* Disables double-tap zoom */
}

/* For scrollable areas */
.scroll-area {
  touch-action: pan-y; /* Vertical scrolling only */
}
```

### 2. Responsive Design
Adjust touch targets for different screen sizes:

```css
/* Base touch target */
.touch-element {
  min-height: 44px;
}

/* Larger targets for tablet/desktop with touch */
@media (min-width: 768px) and (hover: hover) {
  .touch-element {
    min-height: 36px; /* Can be smaller with mouse */
  }
}

/* Even larger for accessibility mode */
.accessibility-mode .touch-element {
  min-height: 48px;
}
```

## Accessibility Notes

### 1. Motor Impairments
Users with motor impairments may need:
- Larger touch targets (48-52px)
- More spacing between targets (12-16px)
- Longer press duration thresholds
- Alternative input methods (keyboard, switch control)

### 2. Screen Reader Compatibility
Ensure touch targets have:
- Proper ARIA labels
- Role attributes when needed
- Keyboard navigation support
- Focus management

### 3. Reduced Motion
Respect user motion preferences:

```css
.touch-element {
  transition: transform 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .touch-element {
    transition: none;
  }
}
```

## Tools and Resources

### 1. Built-in Tools
- `TouchTargetAudit` component
- `useTouchTargetAudit` hook
- `StandardButton` component with proper sizing

### 2. Browser DevTools
- Chrome: Device toolbar for mobile testing
- Firefox: Responsive Design Mode
- Safari: Develop → Enter Responsive Design Mode

### 3. External Tools
- [WebAIM Touch Target Checker](https://webaim.org/resources/touch/)
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)

## Compliance Checklist

- [ ] All interactive elements ≥44×44px
- [ ] Spacing between elements ≥8px
- [ ] Visual feedback on touch/hover
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility
- [ ] Tested on multiple devices
- [ ] Performance optimized
- [ ] Documentation updated

## Related Documents
- [STYLE_GUIDE_BUTTONS.md](./STYLE_GUIDE_BUTTONS.md) - Button styling guidelines
- [ACCESSIBILITY_GUIDELINES.md](./ACCESSIBILITY_GUIDELINES.md) - General accessibility standards
- [MOBILE_FIRST_DESIGN.md](./MOBILE_FIRST_DESIGN.md) - Mobile-first design principles