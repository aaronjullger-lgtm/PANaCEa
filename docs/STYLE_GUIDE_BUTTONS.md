# Button Style Guide

## Overview
This document defines the standardized button system for PANaCEa to ensure consistent styling, hover states, disabled states, and accessibility across the application.

## Core Principles

1. **Semantic Design Tokens**: All colors must use CSS custom properties (CSS variables) defined in the theme
2. **Consistent Hover States**: All buttons should have predictable hover/active states
3. **Mobile Accessibility**: Minimum touch target of 44px height for interactive elements
4. **Disabled States**: Clear visual indication when buttons are disabled
5. **Focus States**: Visible focus rings for keyboard navigation

## Button Variants

### Primary (`variant="primary"`)
- **Usage**: Main call-to-action buttons, primary user actions
- **Style**: `bg-[var(--color-accent)] text-[var(--color-text-inverse)]`
- **Hover**: `hover:bg-[var(--color-accent)]/90`
- **Example**: "Start Session", "Submit Answer", "Save Changes"

### Secondary (`variant="secondary"`)
- **Usage**: Secondary actions, less prominent than primary
- **Style**: `bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]`
- **Hover**: `hover:bg-[var(--color-bg-tertiary)]/80`
- **Example**: "Cancel", "Back", "View Details"

### Outline (`variant="outline"`)
- **Usage**: Border-only buttons, subtle actions
- **Style**: `bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border)]`
- **Hover**: `hover:bg-[var(--color-bg-tertiary)]/50 hover:border-[var(--color-accent)]`
- **Example**: "Edit Profile", "Add Note", "Filter"

### Ghost (`variant="ghost"`)
- **Usage**: Minimal buttons, icon-only actions
- **Style**: `bg-transparent text-[var(--color-text-primary)] border border-transparent`
- **Hover**: `hover:bg-[var(--color-bg-tertiary)]/50`
- **Example**: "Close", "Menu Toggle", "Settings"

### Success (`variant="success"`)
- **Usage**: Positive actions, confirmations
- **Style**: `bg-[var(--color-data-pass)] text-[var(--color-text-inverse)]`
- **Hover**: `hover:bg-[var(--color-data-pass)]/90`
- **Example**: "Approve", "Complete", "Mark as Done"

### Warning (`variant="warning"`)
- **Usage**: Cautionary actions, warnings
- **Style**: `bg-[var(--color-data-provisional)] text-[var(--color-text-inverse)]`
- **Hover**: `hover:bg-[var(--color-data-provisional)]/90`
- **Example**: "Retry", "Review", "Needs Attention"

### Danger (`variant="danger"`)
- **Usage**: Destructive actions, deletions
- **Style**: `bg-[var(--color-data-fail)] text-[var(--color-text-inverse)]`
- **Hover**: `hover:bg-[var(--color-data-fail)]/90`
- **Example**: "Delete", "Remove", "Cancel Account"

### Accent (`variant="accent"`)
- **Usage**: Alternative accent styling
- **Style**: `bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30`
- **Hover**: `hover:bg-[var(--color-accent)]/20`
- **Example**: "Learn More", "Upgrade", "Featured Action"

## Button Sizes

### Extra Small (`size="xs"`)
- **Height**: 32px
- **Padding**: `px-2 py-1`
- **Text**: `text-xs`
- **Usage**: Compact spaces, table actions

### Small (`size="sm"`)
- **Height**: 36px
- **Padding**: `px-3 py-1.5`
- **Text**: `text-sm`
- **Usage**: Secondary actions, form buttons

### Medium (`size="md"`) - DEFAULT
- **Height**: 44px (minimum touch target)
- **Padding**: `px-4 py-2`
- **Text**: `text-sm`
- **Usage**: Most buttons, primary actions

### Large (`size="lg"`)
- **Height**: 48px
- **Padding**: `px-6 py-3`
- **Text**: `text-base`
- **Usage**: Prominent CTAs, hero sections

### Extra Large (`size="xl"`)
- **Height**: 52px
- **Padding**: `px-8 py-4`
- **Text**: `text-lg`
- **Usage**: Landing page CTAs, very prominent actions

## Usage Examples

### Import
```typescript
import { 
  StandardButton, 
  PrimaryButton, 
  SecondaryButton,
  OutlineButton,
  SuccessButton,
  DangerButton,
  WarningButton 
} from '@/components/shared/StandardButton';
```

### Basic Usage
```tsx
<StandardButton variant="primary" size="md">
  Start Session
</StandardButton>

<PrimaryButton>Save Changes</PrimaryButton>
<SecondaryButton>Cancel</SecondaryButton>
<OutlineButton>Edit</OutlineButton>
<SuccessButton>Approve</SuccessButton>
<DangerButton>Delete</DangerButton>
```

### With Icons
```tsx
<StandardButton 
  variant="primary" 
  leftIcon={<PlayIcon />}
  rightIcon={<ArrowRightIcon />}
>
  Start Session
</StandardButton>
```

### Loading State
```tsx
<StandardButton variant="primary" loading>
  Processing...
</StandardButton>
```

### Disabled State
```tsx
<StandardButton variant="primary" disabled>
  Unavailable
</StandardButton>
```

### Full Width
```tsx
<StandardButton variant="primary" fullWidth>
  Full Width Button
</StandardButton>
```

## Migration Guidelines

### DO
- ✅ Use `StandardButton` component for all new buttons
- ✅ Use semantic variants (`primary`, `secondary`, etc.)
- ✅ Ensure minimum height of 44px for touch targets
- ✅ Include proper hover and disabled states
- ✅ Use focus rings for accessibility

### DON'T
- ❌ Use hardcoded colors (`bg-blue-500`, `text-red-600`)
- ❌ Create custom button styles without reviewing this guide
- ❌ Use inconsistent hover opacity values
- ❌ Forget disabled states for async actions
- ❌ Skip focus states for keyboard users

## Common Patterns

### Form Buttons
```tsx
<div className="flex gap-3">
  <SecondaryButton type="button" onClick={onCancel}>
    Cancel
  </SecondaryButton>
  <PrimaryButton type="submit" loading={isSubmitting}>
    {isSubmitting ? 'Saving...' : 'Save Changes'}
  </PrimaryButton>
</div>
```

### Action Row
```tsx
<div className="flex items-center gap-2">
  <OutlineButton size="sm" leftIcon={<EditIcon />}>
    Edit
  </OutlineButton>
  <DangerButton size="sm" leftIcon={<TrashIcon />}>
    Delete
  </DangerButton>
</div>
```

### Card Actions
```tsx
<div className="p-4 border rounded-lg">
  <h3>Card Title</h3>
  <p>Card content...</p>
  <div className="mt-4 flex justify-end">
    <PrimaryButton size="sm">
      Action
    </PrimaryButton>
  </div>
</div>
```

## Accessibility Requirements

1. **Minimum Touch Target**: 44px × 44px (WCAG 2.1)
2. **Focus Indicator**: Visible focus ring with `focus-visible:ring-2`
3. **Color Contrast**: Minimum 4.5:1 for text (ensured by semantic tokens)
4. **Disabled State**: Clear visual distinction with reduced opacity
5. **ARIA Labels**: Provide descriptive labels for icon-only buttons

## Testing Checklist

- [ ] Hover states work correctly
- [ ] Active/pressed states are visible
- [ ] Focus rings appear on keyboard navigation
- [ ] Disabled states prevent interaction
- [ ] Loading states show spinner
- [ ] Touch targets are at least 44px
- [ ] Color contrast meets WCAG standards
- [ ] Screen readers announce button text correctly