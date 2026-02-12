# Animation System Guide

## Overview

The PANaCEa animation system provides standardized, accessible animations and transitions that follow WCAG 2.1 Success Criterion 2.3.3 (Animation from Interactions). The system includes both Framer Motion variants and CSS transition utilities for consistent, smooth user experiences.

## Core Principles

1. **Consistency**: Use predefined animation variants for common patterns
2. **Accessibility**: Respect `prefers-reduced-motion` user preferences
3. **Performance**: Optimize animations for 60fps smoothness
4. **Purpose**: Animations should enhance usability, not distract

## Installation & Setup

The animation system is automatically available via:

```typescript
import { 
  ANIMATION_VARIANTS, 
  TRANSITIONS, 
  CSS_TRANSITIONS,
  createAnimationProps,
  createHoverAnimation,
  getStaggerChildren,
  PAGE_TRANSITION,
  MODAL_TRANSITION,
  TOAST_TRANSITION,
  LIST_ITEM_TRANSITION,
} from '@/lib/utils/animations';
```

## Animation Variants

### Standard Variants

| Variant | Description | Use Case |
|---------|-------------|----------|
| `fadeInUp` | Fade in from below | Page content, cards |
| `fadeInDown` | Fade in from above | Dropdowns, tooltips |
| `fadeInLeft` | Fade in from left | Sidebars, navigation |
| `fadeInRight` | Fade in from right | Modals, drawers |
| `scaleIn` | Scale in from center | Popups, alerts |
| `scaleInBounce` | Scale in with bounce | Playful elements |
| `slideUp` | Slide up from bottom | Bottom sheets, keyboards |
| `slideLeft` | Slide in from right | Side panels |

### Usage Example

```tsx
import { motion } from 'framer-motion';
import { ANIMATION_VARIANTS, TRANSITIONS } from '@/lib/utils/animations';

const MyComponent = () => (
  <motion.div
    {...ANIMATION_VARIANTS.fadeInUp}
    transition={TRANSITIONS.normal}
    className="p-4"
  >
    Content with fade-in animation
  </motion.div>
);
```

## Transition Presets

### Timing & Easing

| Preset | Duration | Easing | Use Case |
|--------|----------|--------|----------|
| `fast` | 150ms | `easeOut` | Hover states, micro-interactions |
| `normal` | 200ms | `easeOut` | Standard animations |
| `smooth` | 300ms | `easeInOut` | Page transitions, content changes |
| `bouncy` | 200ms | `bounce` | Playful elements, notifications |
| `spring` | Spring physics | Spring | Modals, natural movements |

### Usage Example

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={TRANSITIONS.spring}
>
  Content with spring animation
</motion.div>
```

## CSS Transition Utilities

### Tailwind Classes

| Class | Properties | Use Case |
|-------|------------|----------|
| `transition-colors` | Colors only | Hover states, theme changes |
| `transition-transform` | Transforms only | Scale, translate, rotate |
| `transition-opacity` | Opacity only | Fade in/out effects |
| `transition-all` | All properties | Complex animations |
| `transition-all duration-150 ease-out` | Fast transitions | Interactive feedback |
| `transition-all duration-300 ease-in-out` | Slow transitions | Dramatic effects |

### Usage Example

```tsx
<div className="transition-colors duration-200 ease-out hover:bg-[var(--color-accent)]">
  Hover over me for color transition
</div>
```

## Common Patterns

### Page Transitions

```tsx
import { PAGE_TRANSITION } from '@/lib/utils/animations';

const PageComponent = () => (
  <motion.div {...PAGE_TRANSITION}>
    Page content with standard transition
  </motion.div>
);
```

### Modal/Dialog Transitions

```tsx
import { MODAL_TRANSITION } from '@/lib/utils/animations';
import { AnimatePresence } from 'framer-motion';

const Modal = ({ isOpen }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div {...MODAL_TRANSITION}>
        Modal content
      </motion.div>
    )}
  </AnimatePresence>
);
```

### Staggered List Animations

```tsx
import { getStaggerChildren, LIST_ITEM_TRANSITION } from '@/lib/utils/animations';

const ListComponent = ({ items }) => (
  <motion.div
    initial="initial"
    animate="animate"
    variants={getStaggerChildren(0.1)}
  >
    {items.map((item) => (
      <motion.div key={item.id} variants={LIST_ITEM_TRANSITION}>
        {item.name}
      </motion.div>
    ))}
  </motion.div>
);
```

### Hover Animations

```tsx
import { createHoverAnimation } from '@/lib/utils/animations';

const InteractiveCard = () => {
  const hoverAnimation = createHoverAnimation(1.02, -2);
  
  return (
    <motion.div
      {...hoverAnimation}
      className="p-4 border rounded-lg cursor-pointer"
    >
      Hover over me
    </motion.div>
  );
};
```

## Accessibility Considerations

### Respecting User Preferences

Always check for reduced motion preferences:

```typescript
import { prefersReducedMotion, getSafeAnimation } from '@/lib/utils/animations';

const MyComponent = () => {
  const animation = getSafeAnimation(
    ANIMATION_VARIANTS.fadeInUp,
    { initial: { opacity: 1 }, animate: { opacity: 1 } }
  );
  
  return <motion.div {...animation}>Content</motion.div>;
};
```

### Focus Animations

```tsx
import { createFocusAnimation } from '@/lib/utils/animations';

const AccessibleButton = () => {
  const focusAnimation = createFocusAnimation();
  
  return (
    <motion.button
      {...focusAnimation}
      className="px-4 py-2 rounded-lg"
    >
      Accessible button
    </motion.button>
  );
};
```

## Migration Guide

### From Inconsistent Animations

**Before:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25 }}
>
  Content
</motion.div>
```

**After:**
```tsx
import { createAnimationProps } from '@/lib/utils/animations';

const animationProps = createAnimationProps('fadeInUp', 'normal');

<motion.div {...animationProps}>
  Content
</motion.div>
```

### From Hardcoded CSS Transitions

**Before:**
```tsx
<div className="transition duration-300 ease-in-out hover:scale-105">
  Card
</div>
```

**After:**
```tsx
import { CSS_TRANSITIONS, createHoverAnimation } from '@/lib/utils/animations';

const Card = () => {
  const hoverAnimation = createHoverAnimation(1.05, 0);
  
  return (
    <motion.div
      {...hoverAnimation}
      className={`p-4 rounded-lg ${CSS_TRANSITIONS.all}`}
    >
      Card with standardized hover
    </motion.div>
  );
};
```

## Best Practices

### 1. Use Appropriate Timing
- **Fast (150ms)**: Button presses, hover states
- **Normal (200ms)**: Content changes, menu toggles
- **Slow (300ms)**: Page transitions, modal appearances

### 2. Choose the Right Easing
- **`easeOut`**: Most UI elements (feels responsive)
- **`easeInOut`**: Smooth transitions between states
- **`bounce`**: Playful elements (use sparingly)
- **`spring`**: Natural, physical movements

### 3. Stagger Animations
Use `getStaggerChildren()` for lists and grids to create pleasing sequential animations.

### 4. Test with Reduced Motion
Always test your animations with `prefers-reduced-motion: reduce` enabled.

### 5. Avoid Animation Overload
- Don't animate more than 3-4 elements simultaneously
- Use subtle animations for frequent interactions
- Reserve dramatic animations for important events

## Performance Tips

1. **Use `will-change` sparingly**: Only for elements that will definitely animate
2. **Prefer transforms over layout properties**: `transform` and `opacity` are GPU-accelerated
3. **Limit simultaneous animations**: Too many concurrent animations can cause jank
4. **Use `AnimatePresence mode="wait"`**: For sequential page transitions

## Troubleshooting

### Animation Not Working
1. Check that Framer Motion is imported correctly
2. Verify the component is wrapped in `AnimatePresence` if using exit animations
3. Ensure the animation variant is properly spread: `{...ANIMATION_VARIANTS.fadeInUp}`

### Janky Animations
1. Reduce the number of simultaneous animations
2. Use simpler easing functions
3. Consider using CSS transitions instead of JavaScript animations for simple effects

### Accessibility Issues
1. Always respect `prefers-reduced-motion`
2. Provide alternative visual indicators for motion-dependent interactions
3. Test with screen readers to ensure animations don't interfere

## Examples

See the `AnimationDemo` component for live examples of all animation patterns:

```tsx
import { AnimationDemo } from '@/components/shared/AnimationDemo';

const ExamplePage = () => (
  <div className="p-6">
    <h1>Animation Examples</h1>
    <AnimationDemo />
  </div>
);
```

## Further Reading

- [Framer Motion Documentation](https://www.framer.com/motion/)
- [WCAG 2.1 Success Criterion 2.3.3](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [MDN: CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions)
- [Google Web Fundamentals: Animations](https://developers.google.com/web/fundamentals/design-and-ux/animations)