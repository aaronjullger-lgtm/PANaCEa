# Tooltip Guidelines for PANaCEa

## Overview
Tooltips provide contextual information for icon-only buttons, unclear controls, and complex UI elements. This document outlines when and how to use tooltips in the PANaCEa application.

## When to Use Tooltips

### ✅ Use Tooltips For:
1. **Icon-only buttons** - Any button that uses only an icon without text
2. **Unclear controls** - UI elements where the purpose isn't immediately obvious
3. **Complex features** - Advanced features that need brief explanation
4. **Keyboard shortcuts** - To show available keyboard commands
5. **Status indicators** - To explain what a status icon means
6. **Form fields** - To provide additional context for input requirements
7. **Medical terminology** - To define clinical terms for students

### ❌ Avoid Tooltips For:
1. **Text buttons** - If the button has clear text, tooltips are redundant
2. **Obvious controls** - Don't add tooltips to self-explanatory elements
3. **Critical information** - Important instructions should be visible, not hidden
4. **Mobile-only interfaces** - Consider alternative patterns for touch devices

## Tooltip Variants

### 1. IconTooltip Component
Use for icon-only buttons and unclear controls:

```tsx
import { InfoTooltip, HelpTooltip, WarningTooltip } from '@/components/shared/IconTooltip';

// Basic usage
<InfoTooltip content="View detailed analytics dashboard" />

// With custom icon
<HelpTooltip 
  content="Click to enable commuter mode with larger buttons and voice support"
  icon={<CommuterIcon />}
  position="right"
/>
```

### 2. FieldTooltip Component
Use for form fields and input explanations:

```tsx
import { FieldTooltip } from '@/components/shared/FieldTooltip';

<FieldTooltip 
  fieldId="goal-title"
  content="Enter a specific, measurable goal like 'Complete 40 questions daily'"
  severity="info"
/>
```

### 3. KeyboardShortcutTooltip Component
Use to show keyboard shortcuts:

```tsx
import { KeyboardShortcutTooltip } from '@/components/shared/KeyboardShortcutTooltip';

<KeyboardShortcutTooltip 
  content="Toggle sidebar"
  shortcut="["
  position="left"
/>
```

## Implementation Standards

### Accessibility Requirements
1. **Always include `aria-label`** - Tooltips should duplicate or complement aria-label
2. **Keyboard navigation** - Tooltips must be accessible via keyboard (Tab, Enter, Escape)
3. **Screen reader support** - Use `role="tooltip"` and proper ARIA attributes
4. **Focus management** - Ensure tooltips don't trap focus
5. **Touch devices** - Consider longer delay or tap-to-show on mobile

### Visual Design
1. **Consistent styling** - Use semantic color tokens from design system
2. **Positioning** - Default to top, adjust based on viewport constraints
3. **Delay** - 300ms delay for hover, immediate for focus
4. **Duration** - 150ms animation duration with ease-out timing
5. **Max width** - 240px maximum to prevent overly wide tooltips

### Content Guidelines
1. **Be concise** - Keep tooltip text under 120 characters
2. **Use action-oriented language** - Start with verbs when appropriate
3. **Avoid jargon** - Use clear, simple language
4. **Include shortcuts** - Mention keyboard shortcuts when available
5. **Be helpful, not obvious** - Don't state the obvious

## Common Patterns

### Navigation Icons
```tsx
// NavRail items
<InfoTooltip content="Dashboard - Overview of your progress" />
<InfoTooltip content="Study Library - Browse medical conditions" />
<InfoTooltip content="Analytics - View performance metrics" />
<InfoTooltip content="Settings - Configure your preferences" />
```

### Action Buttons
```tsx
// Quiz controls
<InfoTooltip content="Flag question for review (F)" />
<InfoTooltip content="Show explanation (E)" />
<InfoTooltip content="End session (Esc)" />
<InfoTooltip content="Toggle stats overlay (S)" />
```

### Status Indicators
```tsx
// Status icons
<WarningTooltip content="Low accuracy - Consider reviewing this topic" />
<SuccessTooltip content="High mastery - You're doing great with this system!" />
<ErrorTooltip content="Connection issue - Some features may be limited" />
```

### Form Fields
```tsx
// Goal creation
<FieldTooltip 
  fieldId="goal-type"
  content="Select whether this is a daily habit or a one-time achievement"
  severity="info"
/>
```

## Migration Checklist

When adding tooltips to existing components:

1. [ ] Identify all icon-only buttons
2. [ ] Check for existing `title` attributes (convert to proper tooltips)
3. [ ] Verify `aria-label` is present and matches tooltip content
4. [ ] Test keyboard navigation
5. [ ] Test screen reader announcements
6. [ ] Verify mobile touch interactions
7. [ ] Check tooltip positioning doesn't overflow viewport
8. [ ] Ensure tooltips don't interfere with other interactive elements

## Testing

### Manual Testing Checklist
- [ ] Hover over icon shows tooltip after 300ms delay
- [ ] Focus via keyboard shows tooltip immediately
- [ ] Press Escape closes tooltip
- [ ] Tooltip stays within viewport boundaries
- [ ] Tooltip doesn't interfere with clicking underlying element
- [ ] Screen reader announces tooltip content
- [ ] Mobile touch shows tooltip on tap (with longer delay)

### Automated Testing
```typescript
// Example test for tooltip component
describe('IconTooltip', () => {
  it('shows tooltip on hover', async () => {
    render(<InfoTooltip content="Test tooltip" />);
    await userEvent.hover(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });
});
```

## Component Reference

### IconTooltip Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | string | required | Tooltip text content |
| `variant` | 'info'\|'help'\|'warning'\|'success'\|'error'\|'action' | 'info' | Visual variant |
| `position` | 'top'\|'bottom'\|'left'\|'right' | 'top' | Position relative to icon |
| `delay` | number | 300 | Delay in milliseconds before showing |
| `maxWidth` | number | 240 | Maximum width in pixels |
| `showArrow` | boolean | true | Whether to show arrow pointer |
| `ariaLabel` | string | content | Accessibility label (defaults to content) |
| `interactive` | boolean | false | Whether tooltip can be interacted with |

### Convenience Components
- `InfoTooltip` - Blue info variant
- `HelpTooltip` - Purple help variant  
- `WarningTooltip` - Amber warning variant
- `SuccessTooltip` - Green success variant
- `ErrorTooltip` - Red error variant
- `ActionTooltip` - Accent color action variant

## Examples in Codebase

See these files for implementation examples:
- `components/shared/IconTooltip.tsx` - Main component implementation
- `components/layout/NavRail.tsx` - Navigation tooltips
- `components/session/QuizView.tsx` - Quiz control tooltips
- `components/Goals/GoalCreateModal.tsx` - Form field tooltips