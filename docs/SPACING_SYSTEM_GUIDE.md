# Spacing System Guide

## Overview

PANaCEa uses a standardized spacing system based on a **4px base unit** (0.25rem) to ensure consistent layout and alignment across all components. This system provides both numeric scale tokens and semantic tokens for maintainable, predictable spacing.

## Core Principles

1. **4px Base Unit**: All spacing multiples are based on 4px increments
2. **Semantic Naming**: Use descriptive names (e.g., `CONTAINER_PADDING`) not magic numbers
3. **Responsive Design**: Mobile-first responsive spacing utilities
4. **Accessibility First**: Minimum touch targets (44px), proper focus spacing
5. **Consistency**: Same spacing values for similar UI patterns

## Quick Reference

### Numeric Scale (Multiples of 4px)

| Token | Pixels | Rem  | Use Case |
|-------|--------|------|----------|
| `0`   | 0px    | 0rem | Reset/no spacing |
| `1`   | 4px    | 0.25rem | Tiny spacing (icon padding) |
| `2`   | 8px    | 0.5rem | Small spacing (tight groups) |
| `3`   | 12px   | 0.75rem | Form field spacing |
| `4`   | 16px   | 1rem | Base spacing (default) |
| `5`   | 20px   | 1.25rem | Card padding |
| `6`   | 24px   | 1.5rem | Section spacing |
| `8`   | 32px   | 2rem | Large spacing |
| `12`  | 48px   | 3rem | Extra large spacing |
| `16`  | 64px   | 4rem | Hero spacing |

### Semantic Tokens

| Token | Value | Use Case |
|-------|-------|----------|
| `CONTAINER_PADDING` | 16px | Main content container padding |
| `CONTAINER_PADDING_MOBILE` | 12px | Mobile container padding |
| `SECTION_VERTICAL` | 48px | Vertical spacing between sections |
| `CARD_PADDING` | 20px | Card inner padding |
| `CARD_GAP` | 16px | Gap between cards in a grid |
| `FORM_FIELD_GAP` | 12px | Vertical gap between form fields |
| `BUTTON_PADDING_X` | 16px | Button horizontal padding |
| `BUTTON_PADDING_Y` | 10px | Button vertical padding |
| `NAV_BAR_HEIGHT` | 64px | Desktop navigation bar height |
| `GRID_GAP` | 24px | Default grid gap |

## Usage Examples

### Importing Constants

```typescript
import { SPACING } from '@/lib/constants/spacing';
import { Spacing, Container, Stack } from '@/components/shared/SpacingSystem';
```

### Using Numeric Values

```typescript
// Direct numeric values (multiples of 4px)
const padding = SPACING[4]; // "16px"
const margin = SPACING[6];  // "24px"

// Using the helper function
import { getSpacing } from '@/lib/constants/spacing';
const gap = getSpacing(3); // "12px"
```

### Using Semantic Tokens

```typescript
// More maintainable - change in one place
const containerPadding = SPACING.SEMANTIC.CONTAINER_PADDING; // "16px"
const cardPadding = SPACING.SEMANTIC.CARD_PADDING; // "20px"

// Using helper function
const sectionSpacing = getSpacing('SECTION_VERTICAL'); // "48px"
```

### React Components

```tsx
// Basic spacing
<Spacing size={4} direction="vertical" />

// Semantic spacing
<Spacing size="FORM_FIELD_GAP" direction="vertical" />

// Responsive spacing
<Spacing 
  size={4}
  direction="vertical"
  responsive={[3, 4, 6, 8]} // [base, sm, md, lg]
/>

// Container with standardized padding
<Container width="narrow" padding="CONTAINER_PADDING">
  <h1>Content</h1>
</Container>

// Stack for consistent item spacing
<Stack direction="vertical" gap={4} align="center">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>

// Grid with consistent gap
<Grid cols={3} gap="GRID_GAP" responsiveCols={[1, 2, 3]}>
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
</Grid>

// Inset padding
<Inset all={4}>
  <p>Content with padding on all sides</p>
</Inset>

// Center alignment
<Center both>
  <button>Centered Button</button>
</Center>
```

### Convenience Components

```tsx
// Vertical stack (common pattern)
<VStack gap={4}>
  <div>Item 1</div>
  <div>Item 2</div>
</VStack>

// Horizontal stack
<HStack gap={3} align="center">
  <Icon />
  <span>Label</span>
</HStack>

// Card container
<CardContainer>
  <h3>Card Title</h3>
  <p>Card content with standardized padding</p>
</CardContainer>

// Page container
<PageContainer>
  <h1>Page Title</h1>
  <p>Page content with wide container</p>
</PageContainer>

// Section spacing
<SectionSpacing />
```

### Inline Styles

```tsx
// Generate spacing styles
import { generateSpacingStyles } from '@/lib/constants/spacing';

const styles = generateSpacingStyles({
  padding: [4, 6], // vertical, horizontal
  margin: 'SECTION_VERTICAL',
  gap: 3,
});

<div style={styles}>Content</div>
```

### Responsive Spacing

```tsx
// Responsive spacing utility
import { responsiveSpacing } from '@/lib/constants/spacing';

const className = responsiveSpacing(4, 6, 8, 12);
// Returns: "16px sm:24px md:32px lg:48px"

<div className={className}>Responsive content</div>
```

## CSS Variables

The spacing system also provides CSS custom properties that can be used in CSS files:

```css
.container {
  padding: var(--spacing-container-padding); /* 16px */
  margin-bottom: var(--spacing-section-vertical); /* 48px */
}

.card {
  padding: var(--spacing-card-padding); /* 20px */
  gap: var(--spacing-card-gap); /* 16px */
}

.button {
  padding: var(--spacing-button-padding-y) var(--spacing-button-padding-x); /* 10px 16px */
}

/* Accessibility */
.touch-target {
  min-height: var(--spacing-min-touch-target); /* 44px */
  min-width: var(--spacing-min-touch-target); /* 44px */
}
```

## Common Patterns

### Form Layout

```tsx
<Stack direction="vertical" gap="FORM_FIELD_GAP">
  <label>Email</label>
  <input type="email" />
  
  <label>Password</label>
  <input type="password" />
  
  <HStack gap="FORM_BUTTON_GAP">
    <button>Cancel</button>
    <button>Submit</button>
  </HStack>
</Stack>
```

### Card Grid

```tsx
<Grid cols={3} gap="GRID_GAP" responsiveCols={[1, 2, 3]}>
  {cards.map(card => (
    <Inset all="CARD_PADDING" key={card.id}>
      <h3>{card.title}</h3>
      <p>{card.description}</p>
    </Inset>
  ))}
</Grid>
```

### Page Layout

```tsx
<Container width="wide">
  <Spacing size="SECTION_VERTICAL" direction="vertical" />
  
  <h1>Page Title</h1>
  
  <Spacing size={6} direction="vertical" />
  
  <Grid cols={2} gap={6}>
    <div>Left column</div>
    <div>Right column</div>
  </Grid>
  
  <Spacing size="SECTION_VERTICAL" direction="vertical" />
</Container>
```

## Migration Guide

### Before (Inconsistent)

```tsx
<div className="p-4"> {/* Sometimes p-4 (16px) */}</div>
<div className="p-5"> {/* Sometimes p-5 (20px) */}</div>
<div style={{ padding: '12px' }}> {/* Magic number */}</div>
<div className="mb-8"> {/* Sometimes mb-8 (32px) */}</div>
```

### After (Standardized)

```tsx
<Inset all={4}> {/* Uses SPACING[4] = 16px */}</Inset>
<Inset all="CARD_PADDING"> {/* Uses SEMANTIC.CARD_PADDING = 20px */}</Inset>
<Inset all={3}> {/* Uses SPACING[3] = 12px */}</Inset>
<Spacing size={8} direction="vertical"> {/* Uses SPACING[8] = 32px */}</Spacing>
```

## Best Practices

1. **Use Semantic Tokens First**: Prefer `getSpacing('CONTAINER_PADDING')` over `getSpacing(4)`
2. **Be Responsive**: Use responsive utilities for mobile-first design
3. **Maintain Consistency**: Use the same spacing for similar UI patterns
4. **Accessibility**: Ensure minimum touch targets (44px) for interactive elements
5. **Document Exceptions**: If you need non-standard spacing, document why

## Testing

Verify spacing consistency by:
1. Checking visual alignment in different viewports
2. Ensuring touch targets meet accessibility standards
3. Validating responsive behavior
4. Comparing similar components for consistency

## Troubleshooting

**Problem**: Spacing looks inconsistent between components
**Solution**: Check that both components use the same semantic token or numeric value

**Problem**: Mobile spacing is too tight
**Solution**: Use responsive spacing utilities with smaller values for mobile

**Problem**: Touch targets are too small
**Solution**: Ensure interactive elements use `min-height: var(--spacing-min-touch-target)` (44px)

---

*Last Updated: ${new Date().toISOString().split('T')[0]}*