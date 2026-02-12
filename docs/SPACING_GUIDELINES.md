# Spacing & Alignment Guidelines

## Overview
This document defines the standardized spacing system for the PANaCEa platform. Consistent spacing reduces cognitive load and creates a professional, cohesive user experience.

## Spacing Scale
We use Tailwind's default spacing scale with semantic naming:

| Token | Pixels | Use Case |
|-------|--------|----------|
| `space-0` | 0px | No spacing |
| `space-0.5` | 2px | Micro spacing (icon padding, tight elements) |
| `space-1` | 4px | Small spacing (tight grouping) |
| `space-1.5` | 6px | Medium-small spacing |
| `space-2` | 8px | Base spacing (form fields, button padding) |
| `space-2.5` | 10px | Comfortable spacing |
| `space-3` | 12px | Standard spacing (between related elements) |
| `space-3.5` | 14px | Comfortable grouping |
| `space-4` | 16px | Section spacing (between major UI blocks) |
| `space-5` | 20px | Large spacing (between unrelated sections) |
| `space-6` | 24px | Extra large spacing |
| `space-8` | 32px | Hero spacing (major page sections) |
| `space-10` | 40px | Maximum spacing |

## Semantic Spacing Classes

### Vertical Spacing
- `space-y-{size}` - Vertical spacing between child elements
- `gap-{size}` - Grid/flex gap spacing
- `mt-{size}`, `mb-{size}` - Margin top/bottom (use sparingly)

### Horizontal Spacing
- `space-x-{size}` - Horizontal spacing between child elements
- `gap-{size}` - Grid/flex gap spacing
- `ml-{size}`, `mr-{size}` - Margin left/right (use sparingly)

### Padding
- `p-{size}` - All-around padding
- `px-{size}`, `py-{size}` - Horizontal/vertical padding
- `pt-{size}`, `pb-{size}`, `pl-{size}`, `pr-{size}` - Directional padding

## Common Patterns

### 1. Card Layouts
```tsx
// Good: Consistent spacing
<div className="p-4 space-y-4">
  <h3 className="text-lg font-semibold">Title</h3>
  <p className="text-sm text-muted">Description</p>
  <div className="flex gap-2">
    <Button>Action 1</Button>
    <Button variant="outline">Action 2</Button>
  </div>
</div>
```

### 2. Form Layouts
```tsx
// Good: Consistent vertical rhythm
<div className="space-y-4">
  <div className="space-y-2">
    <label className="text-sm font-medium">Email</label>
    <input className="w-full p-2 border rounded" />
  </div>
  <div className="space-y-2">
    <label className="text-sm font-medium">Password</label>
    <input type="password" className="w-full p-2 border rounded" />
  </div>
  <Button className="w-full">Submit</Button>
</div>
```

### 3. Grid Layouts
```tsx
// Good: Consistent gaps
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
  {items.map(item => (
    <Card key={item.id}>{item.content}</Card>
  ))}
</div>
```

### 4. Flex Layouts
```tsx
// Good: Consistent alignment
<div className="flex items-center justify-between gap-3">
  <div className="flex items-center gap-2">
    <Icon />
    <span>Label</span>
  </div>
  <Button>Action</Button>
</div>
```

## Alignment Guidelines

### 1. Text Alignment
- Use `text-left`, `text-center`, `text-right` consistently
- Default to `text-left` for readability
- Use `text-center` only for hero sections, modals, and confirmation dialogs

### 2. Flex Alignment
- `items-center` - Vertical centering
- `justify-between` - Space between elements
- `justify-center` - Horizontal centering
- `justify-start`/`justify-end` - Start/end alignment

### 3. Grid Alignment
- `place-items-center` - Center both axes
- `items-start`/`items-end` - Vertical alignment
- `justify-items-start`/`justify-items-end` - Horizontal alignment

## Anti-Patterns to Avoid

### ❌ Inconsistent Spacing
```tsx
// Bad: Mixed spacing values
<div className="p-3">
  <h3 className="mb-2">Title</h3>
  <p className="mt-3">Description</p> {/* Inconsistent: mt-3 vs mb-2 */}
  <div className="flex gap-1">
    <Button className="mr-4">Action 1</Button> {/* Inconsistent: gap-1 + mr-4 */}
    <Button>Action 2</Button>
  </div>
</div>
```

### ❌ Hardcoded Margins
```tsx
// Bad: Hardcoded margins without semantic meaning
<div style={{ marginBottom: '10px' }}> {/* Use Tailwind classes instead */}
  Content
</div>
```

### ❌ Over-nesting with Spacing
```tsx
// Bad: Over-nested spacing
<div className="p-4">
  <div className="mb-3">
    <h3>Title</h3>
  </div>
  <div className="mb-3">
    <p>Description</p>
  </div>
  <div>
    <Button>Action</Button>
  </div>
</div>

// Good: Use space-y-* instead
<div className="p-4 space-y-3">
  <h3>Title</h3>
  <p>Description</p>
  <Button>Action</Button>
</div>
```

## Component-Specific Guidelines

### 1. Buttons
- Use `px-4 py-2` for standard buttons
- Use `px-3 py-1.5` for small buttons
- Use `px-6 py-3` for large/hero buttons
- Always include `min-h-[44px]` for touch targets on mobile

### 2. Cards
- Use `p-4` or `p-6` for card padding
- Use `space-y-3` or `space-y-4` for internal spacing
- Use `rounded-lg` or `rounded-xl` for consistent corner radius

### 3. Modals & Dialogs
- Use `p-6` for modal content padding
- Use `space-y-4` for form content
- Use `gap-3` for button groups

### 4. Navigation
- Use `gap-2` or `gap-3` for navigation items
- Use `px-3 py-2` for nav link padding
- Ensure minimum touch target of 44px

## Responsive Spacing

### Mobile-First Approach
```tsx
// Good: Responsive spacing
<div className="space-y-4 md:space-y-6">
  <h3 className="text-lg md:text-xl">Title</h3>
  <p className="text-sm md:text-base">Description</p>
</div>
```

### Breakpoint-Specific Spacing
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+
- `2xl:` - 1536px+

## Testing Checklist

### Visual Consistency
- [ ] All cards have consistent padding
- [ ] All buttons have consistent padding
- [ ] All form fields have consistent spacing
- [ ] All navigation items have consistent spacing
- [ ] All modal/dialog content has consistent spacing

### Responsive Behavior
- [ ] Spacing scales appropriately on mobile
- [ ] Touch targets are at least 44px on mobile
- [ ] Grid gaps adjust for screen size
- [ ] Text alignment remains readable

### Accessibility
- [ ] Sufficient spacing for readability
- [ ] Clear visual hierarchy through spacing
- [ ] No overlapping elements
- [ ] Consistent focus states with adequate spacing

## Migration Guide

### From Inconsistent Spacing
1. Replace hardcoded margins/padding with Tailwind classes
2. Use `space-y-*` instead of individual `mb-*` on siblings
3. Standardize on common spacing values (2, 3, 4, 6, 8)
4. Use `gap-*` instead of `space-x-*` + `space-y-*` for grids

### Common Conversions
- `margin: 8px` → `m-2`
- `padding: 16px` → `p-4`
- `gap: 12px` → `gap-3`
- `margin-bottom: 20px` → `mb-5`

## Tools & Utilities

### Spacing Audit Component
Use the `SpacingAudit` component to visualize and test spacing consistency:

```tsx
import { SpacingAudit } from '@/components/shared/SpacingAudit';

// In your component
<SpacingAudit />
```

### CSS Custom Properties
For dynamic spacing, use CSS custom properties:

```css
:root {
  --spacing-xs: 0.25rem;  /* 4px */
  --spacing-sm: 0.5rem;   /* 8px */
  --spacing-md: 1rem;     /* 16px */
  --spacing-lg: 1.5rem;   /* 24px */
  --spacing-xl: 2rem;     /* 32px */
}
```

## Examples

### Well-Spaced Component
```tsx
export const WellSpacedCard = () => (
  <div className="p-6 space-y-4 rounded-xl border bg-card">
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Card Title</h3>
      <p className="text-sm text-muted">
        This card demonstrates proper spacing with consistent padding,
        vertical rhythm, and appropriate touch targets.
      </p>
    </div>
    
    <div className="flex flex-wrap gap-2">
      <Button size="sm">Action 1</Button>
      <Button size="sm" variant="outline">Action 2</Button>
    </div>
    
    <div className="pt-4 border-t">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Footer text</span>
        <Button size="xs" variant="ghost">Learn more</Button>
      </div>
    </div>
  </div>
);
```

### Poorly Spaced Component (Before)
```tsx
export const PoorlySpacedCard = () => (
  <div className="p-3"> {/* Inconsistent padding */}
    <h3 className="mb-1">Card Title</h3> {/* Too tight */}
    <p className="mt-2 mb-4">Description</p> {/* Inconsistent margins */}
    <div className="flex">
      <Button className="mr-2">Action 1</Button> {/* Use gap instead */}
      <Button>Action 2</Button>
    </div>
  </div>
);