# Tooltip Style Guide

## Overview

Tooltips provide contextual information for icon-only buttons, unclear controls, and complex UI elements. This guide establishes standards for consistent, accessible tooltip implementation across the PANaCEa platform.

## Tooltip Types

### 1. IconTooltip (Primary Component)
- **Purpose**: Standard tooltip for icon-only buttons and unclear controls
- **Component**: `IconTooltip` from `@/components/shared/IconTooltip.tsx`
- **Variants**: `info`, `help`, `warning`, `success`, `error`, `action`
- **Position**: `top` (default), `bottom`, `left`, `right`

### 2. DefinitionTooltip (Medical Terms)
- **Purpose**: Medical terminology definitions
- **Component**: `DefinitionTooltip` from `@/components/ui/DefinitionTooltip.tsx`
- **Usage**: Wrap text with `HighlightableTerm` component

### 3. ExplainabilityTooltip (Calculations)
- **Purpose**: Explain AI-derived metrics and calculations
- **Component**: `ExplainabilityTooltip` from `@/components/ui/ExplainabilityTooltip.tsx`
- **Usage**: Show formulas and calculation methods

## When to Use Tooltips

### ✅ Use Tooltips For:
- Icon-only buttons without text labels
- Controls with ambiguous functionality
- Medical terms that need definition
- Complex calculations that need explanation
- Abbreviations and acronyms
- Feature limitations or requirements
- Keyboard shortcuts

### ❌ Avoid Tooltips For:
- Information critical to task completion
- Error messages that require immediate action
- Primary navigation labels
- Content that should be permanently visible
- Redundant information (if icon is already clear)

## Accessibility Requirements

### Keyboard Navigation
- Tooltips must be focusable via `tabindex="0"`
- Show on `focus`, hide on `blur`
- Support `Escape` key to dismiss
- Support `Enter`/`Space` to toggle (for interactive tooltips)

### Screen Readers
- Provide `aria-label` for icon-only buttons
- Use `role="tooltip"` for tooltip containers
- Ensure tooltip content is announced when shown
- Hide tooltips from screen readers when not visible (`aria-hidden="true"`)

### Timing & Delay
- **Show delay**: 300ms (prevents accidental triggering)
- **Hide delay**: 100ms (allows moving cursor to tooltip)
- **Duration**: Minimum 1 second visible time

## Implementation Guidelines

### Basic IconTooltip Usage
```tsx
import { IconTooltip, InfoTooltip } from '@/components/shared/IconTooltip';
import { Settings } from 'lucide-react';

// Basic usage
<IconTooltip
  icon={<Settings className="w-5 h-5" />}
  content="Configure application settings"
  variant="info"
  position="top"
  ariaLabel="Settings configuration"
/>

// Convenience component
<InfoTooltip
  icon={<Settings className="w-5 h-5" />}
  content="Configure application settings"
/>
```

### Medical Term Tooltips
```tsx
import { HighlightableTerm } from '@/components/ui/DefinitionTooltip';

// Wrap medical terms
<p>
  Patients with <HighlightableTerm term="STEMI">STEMI</HighlightableTerm>
  require immediate reperfusion therapy.
</p>
```

### Explainability Tooltips
```tsx
import { ExplainabilityTooltip } from '@/components/ui/ExplainabilityTooltip';

// Show calculation explanation
<div className="flex items-center gap-2">
  <span>Predicted PANCE Score</span>
  <ExplainabilityTooltip
    formula="Based on your last 336 questions, weighted by difficulty and time decay."
    ariaLabel="How is the PANCE score calculated?"
  />
</div>
```

## Variant Specifications

| Variant | Icon | Background | Text | Border | Use Case |
|---------|------|------------|------|--------|----------|
| `info` | ℹ️ | `bg-[var(--color-info-bg)]` | `text-[var(--color-info-text)]` | `border-[var(--color-info-border)]` | General information, settings |
| `help` | ❓ | `bg-[var(--color-help-bg)]` | `text-[var(--color-help-text)]` | `border-[var(--color-help-border)]` | Help text, guidance |
| `warning` | ⚠️ | `bg-[var(--color-warning-bg)]` | `text-[var(--color-warning-text)]` | `border-[var(--color-warning-border)]` | Warnings, limitations |
| `success` | ✅ | `bg-[var(--color-success-bg)]` | `text-[var(--color-success-text)]` | `border-[var(--color-success-border)]` | Success states, completion |
| `error` | ❌ | `bg-[var(--color-error-bg)]` | `text-[var(--color-error-text)]` | `border-[var(--color-error-border)]` | Errors, failures |
| `action` | ➡️ | `bg-[var(--color-action-bg)]` | `text-[var(--color-action-text)]` | `border-[var(--color-action-border)]` | Actions, navigation |

## Positioning Rules

### Default Positioning
- **Top**: Default for most tooltips
- **Bottom**: When element is at top of viewport
- **Left/Right**: When vertical space is limited

### Viewport Boundary Detection
Tooltips automatically adjust to stay within viewport:
- Minimum 8px margin from edges
- Flip position if would overflow
- Adjust arrow position accordingly

## Content Guidelines

### Text Content
- **Length**: 1-2 sentences maximum (240px width)
- **Tone**: Clear, concise, helpful
- **Language**: Plain English, avoid jargon
- **Format**: Complete sentences with proper punctuation

### Icons
- Use Lucide React icons (`lucide-react`)
- Standard size: `w-5 h-5` (20px)
- Hover effect: Scale 105% and background change
- Color: Use semantic color tokens

## Performance Considerations

### Lazy Loading
- Tooltip content should not block initial render
- Consider lazy loading for complex tooltips
- Use `React.lazy()` for heavy tooltip components

### Memory Management
- Clear timeouts on unmount
- Limit simultaneous tooltips (max 3 visible)
- Debounce rapid hover events

## Testing Checklist

### Visual Testing
- [ ] Tooltip appears on hover/focus
- [ ] Proper positioning (no viewport overflow)
- [ ] Correct variant styling
- [ ] Arrow points to target element
- [ ] Smooth animations (300ms fade)

### Accessibility Testing
- [ ] Screen reader announces tooltip content
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] `aria-label` present on icon-only buttons
- [ ] Tooltip hides on blur/Escape
- [ ] Color contrast meets WCAG AA standards

### Functional Testing
- [ ] Tooltip shows after 300ms delay
- [ ] Tooltip hides after mouse leave
- [ ] Multiple tooltips don't interfere
- [ ] Tooltip content updates correctly
- [ ] Mobile touch interactions work

## Common Patterns

### Icon-Only Navigation
```tsx
<nav className="flex gap-2">
  <IconTooltip
    icon={<Home className="w-5 h-5" />}
    content="Return to dashboard"
    variant="action"
    ariaLabel="Home dashboard"
  />
  <IconTooltip
    icon={<Settings className="w-5 h-5" />}
    content="Application settings"
    variant="info"
    ariaLabel="Settings"
  />
</nav>
```

### Form Field Help
```tsx
<div className="flex items-center gap-2">
  <label htmlFor="email">Email Address</label>
  <HelpTooltip
    content="We'll use this for account notifications and password resets."
    ariaLabel="Email address help"
  />
</div>
```

### Status Indicators
```tsx
<div className="flex items-center gap-2">
  <span>Calibration Status</span>
  {isCalibrated ? (
    <SuccessTooltip
      content="FSRS model is fully calibrated with your learning patterns"
      ariaLabel="Calibration complete"
    />
  ) : (
    <WarningTooltip
      content="Complete 60+ reviews for accurate due date predictions"
      ariaLabel="Calibration in progress"
    />
  )}
</div>
```

## Migration Guide

### Replacing Inline Tooltips
**Before:**
```tsx
<div className="relative group">
  <button className="p-2">
    <Settings className="w-5 h-5" />
  </button>
  <div className="absolute hidden group-hover:block ...">
    Settings configuration
  </div>
</div>
```

**After:**
```tsx
<IconTooltip
  icon={<Settings className="w-5 h-5" />}
  content="Settings configuration"
  variant="info"
  ariaLabel="Settings"
/>
```

### Adding Missing Tooltips
1. Identify icon-only buttons without `aria-label`
2. Add appropriate `IconTooltip` wrapper
3. Provide descriptive content
4. Test keyboard navigation
5. Verify screen reader announcements

## Troubleshooting

### Tooltip Not Appearing
- Check `delay` prop (default 300ms)
- Verify `isVisible` state management
- Ensure parent container isn't clipping overflow
- Check z-index conflicts

### Positioning Issues
- Use `position` prop to override auto-positioning
- Check viewport boundary detection
- Ensure target element has `position: relative`

### Accessibility Problems
- Add missing `aria-label` attributes
- Ensure `role="tooltip"` is present
- Test with keyboard navigation
- Verify screen reader announcements

## Related Components
- `StandardButton` - Button component with tooltip support
- `FormValidation` - Form validation with tooltip messages
- `KeyboardAccessibilityAudit` - Tooltip accessibility testing
- `ContrastAudit` - Tooltip color contrast verification