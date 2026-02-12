# Mobile Typography & Spacing Guidelines

## Overview
This document outlines typography and spacing standards optimized for mobile devices in the PANaCEa platform. Proper typography is critical for readability, accessibility, and user experience on small screens.

## Core Principles

### 1. Readability First
- Text must be legible at arm's length on mobile devices
- Consider varying lighting conditions and user visual acuity
- Support users with visual impairments

### 2. Responsive Design
- Typography should adapt to different screen sizes
- Maintain hierarchy and readability across breakpoints
- Use relative units for scalability

### 3. Accessibility Compliance
- Meet WCAG 2.1 AA standards for contrast and sizing
- Support dynamic text sizing (user font preferences)
- Ensure sufficient touch targets around text

## Typography Standards

### Base Font Size
```css
/* Root font size for mobile */
html {
  font-size: 16px; /* Base for rem calculations */
}

/* Responsive scaling */
@media (min-width: 768px) {
  html {
    font-size: 18px; /* Slightly larger for tablets/desktops */
  }
}
```

### Font Family Hierarchy
```css
/* System fonts for performance and familiarity */
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  --font-heading: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

body {
  font-family: var(--font-sans);
  font-weight: 400;
  line-height: 1.5;
}
```

### Font Size Scale (Mobile First)

| Element | Size (rem) | Size (px) | Weight | Line Height | Use Case |
|---------|------------|-----------|---------|-------------|----------|
| h1 | 2.5rem | 40px | 700 | 1.2 | Page titles |
| h2 | 2rem | 32px | 700 | 1.3 | Section headers |
| h3 | 1.75rem | 28px | 600 | 1.3 | Subsection headers |
| h4 | 1.5rem | 24px | 600 | 1.4 | Card titles |
| h5 | 1.25rem | 20px | 600 | 1.4 | Small headers |
| h6 | 1.125rem | 18px | 600 | 1.4 | Minor headers |
| Body Large | 1.125rem | 18px | 400 | 1.6 | Lead paragraphs |
| Body | 1rem | 16px | 400 | 1.5 | Main content |
| Body Small | 0.875rem | 14px | 400 | 1.4 | Captions, metadata |
| Caption | 0.75rem | 12px | 400 | 1.3 | Labels, footnotes |

### Minimum Font Sizes
```css
/* Absolute minimums for accessibility */
* {
  min-font-size: 12px; /* For very small labels only */
}

/* Recommended minimums */
.body-text {
  font-size: clamp(16px, 1rem, 18px); /* 16px minimum */
}

.interactive-text {
  font-size: clamp(14px, 0.875rem, 16px);
}
```

## Line Height & Spacing

### Line Height Guidelines
```css
/* Optimal line heights for mobile */
.body-text {
  line-height: 1.5; /* 150% of font size */
}

.heading {
  line-height: 1.3; /* Tighter for headings */
}

.small-text {
  line-height: 1.4; /* Slightly tighter for small text */
}

.code {
  line-height: 1.6; /* More spacing for code readability */
}
```

### Vertical Rhythm
```css
/* Consistent vertical spacing using 8px grid */
:root {
  --space-unit: 0.5rem; /* 8px based on 16px root */
  --space-xs: calc(var(--space-unit) * 0.5); /* 4px */
  --space-sm: calc(var(--space-unit) * 1);   /* 8px */
  --space-md: calc(var(--space-unit) * 1.5); /* 12px */
  --space-lg: calc(var(--space-unit) * 2);   /* 16px */
  --space-xl: calc(var(--space-unit) * 3);   /* 24px */
  --space-2xl: calc(var(--space-unit) * 4);  /* 32px */
}

/* Paragraph spacing */
p {
  margin-bottom: var(--space-lg); /* 16px between paragraphs */
}

/* Heading spacing */
h1, h2, h3, h4, h5, h6 {
  margin-top: var(--space-xl); /* 24px above headings */
  margin-bottom: var(--space-md); /* 12px below headings */
}
```

### Letter Spacing
```css
/* Improve readability with subtle letter spacing */
.body-text {
  letter-spacing: 0.01em; /* Slight spacing for body text */
}

.heading {
  letter-spacing: 0.02em; /* Slightly more for headings */
}

.all-caps {
  letter-spacing: 0.1em; /* More spacing for uppercase text */
}

.small-caps {
  letter-spacing: 0.05em;
}
```

## Contrast & Color

### Text Contrast Ratios
```css
/* WCAG 2.1 AA compliance */
:root {
  --text-primary: oklch(20% 0.02 260); /* High contrast */
  --text-secondary: oklch(45% 0.02 260);
  --text-muted: oklch(55% 0.02 260);
  --text-inverse: oklch(95% 0.02 260);
}

/* Contrast validation */
.primary-text {
  color: var(--text-primary);
  /* Contrast: 7:1+ against white background */
}

.secondary-text {
  color: var(--text-secondary);
  /* Contrast: 4.5:1+ against white background */
}
```

### Text on Colored Backgrounds
```css
/* Ensure sufficient contrast on colored backgrounds */
.text-on-dark {
  color: var(--text-inverse);
  background-color: oklch(25% 0.1 260);
  /* Contrast: 7:1+ */
}

.text-on-light {
  color: var(--text-primary);
  background-color: oklch(95% 0.02 260);
  /* Contrast: 7:1+ */
}

.warning-text {
  color: oklch(40% 0.2 70); /* Dark yellow/orange */
  background-color: oklch(95% 0.1 70);
}
```

## Responsive Typography

### Fluid Typography with clamp()
```css
/* Fluid scaling between breakpoints */
.heading-fluid {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  line-height: clamp(1.3, 1.5, 1.6);
}

.body-fluid {
  font-size: clamp(1rem, 2.5vw, 1.125rem);
  line-height: clamp(1.5, 1.6, 1.7);
}
```

### Breakpoint-Specific Adjustments
```css
/* Mobile (default) */
.text-element {
  font-size: 1rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .text-element {
    font-size: 1.125rem;
    line-height: 1.6;
    margin-bottom: 1.125rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .text-element {
    font-size: 1.25rem;
    line-height: 1.7;
    margin-bottom: 1.25rem;
  }
}
```

## Component-Specific Guidelines

### Buttons & Interactive Elements
```css
.button-text {
  font-size: 1rem; /* 16px minimum */
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.2;
  padding: 0.75rem 1.5rem; /* Sufficient touch target */
  min-height: 44px; /* WCAG touch target */
}

.icon-button {
  font-size: 0.875rem;
  min-width: 44px;
  min-height: 44px;
  padding: 0.5rem;
}
```

### Form Elements
```css
.input-label {
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 0.5rem;
  display: block;
}

.input-text {
  font-size: 1rem; /* 16px minimum for form inputs */
  line-height: 1.5;
  padding: 0.75rem;
  min-height: 44px;
}

.input-help {
  font-size: 0.75rem; /* 12px */
  line-height: 1.3;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
```

### Cards & Containers
```css
.card-title {
  font-size: 1.25rem; /* 20px */
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}

.card-body {
  font-size: 0.875rem; /* 14px */
  line-height: 1.5;
  margin-bottom: 1rem;
}

.card-meta {
  font-size: 0.75rem; /* 12px */
  line-height: 1.3;
  color: var(--text-muted);
}
```

### Navigation
```css
.nav-item {
  font-size: 1rem; /* 16px */
  font-weight: 500;
  line-height: 1.2;
  padding: 0.75rem 1rem;
  min-height: 44px;
}

.nav-label {
  font-size: 0.75rem; /* 12px */
  line-height: 1.3;
  margin-top: 0.25rem;
}
```

## Accessibility Considerations

### Dynamic Text Sizing
```css
/* Support user font size preferences */
html {
  font-size: 100%; /* Respect browser default */
}

body {
  font-size: 1rem;
  line-height: 1.5;
}

/* Use rem for all font sizes */
.text-element {
  font-size: 1rem; /* Scales with root font size */
  line-height: 1.5;
}

/* Don't disable zoom */
@media (pointer: coarse) {
  /* Ensure sufficient spacing for larger text */
  .interactive-element {
    min-height: 48px; /* Larger for zoomed text */
    padding: 1rem;
  }
}
```

### Reduced Motion
```css
/* Respect user motion preferences */
.text-transition {
  transition: color 0.2s ease, background-color 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .text-transition {
    transition: none;
  }
}
```

### High Contrast Mode
```css
/* Support Windows High Contrast Mode */
@media (forced-colors: active) {
  .text-element {
    color: CanvasText;
    background-color: Canvas;
  }
  
  /* Ensure text remains visible */
  .text-on-colored-bg {
    forced-color-adjust: none;
  }
}
```

## Testing Guidelines

### Manual Testing Checklist
- [ ] Test on actual mobile devices (iOS, Android)
- [ ] Verify readability in bright sunlight
- [ ] Test with increased font size (Settings → Display → Font Size)
- [ ] Check contrast with color blindness simulators
- [ ] Verify no text truncation or overflow
- [ ] Test with screen readers (VoiceOver, TalkBack)
- [ ] Verify touch targets around text elements
- [ ] Test in landscape and portrait orientations

### Automated Testing
```javascript
// Use the TypographyAudit component
import { TypographyAudit } from '@/components/shared/TypographyAudit';
import { useTypographyAudit } from '@/hooks/useTypographyAudit';

function TestComponent() {
  const { openAudit, getReadabilityScore } = useTypographyAudit();
  
  const score = getReadabilityScore();
  console.log(`Typography readability score: ${score}%`);
  
  return (
    <button onClick={openAudit}>Check Typography</button>
  );
}
```

### Common Issues & Fixes

#### Issue: Text Too Small on Mobile
```css
/* Before */
.small-text {
  font-size: 12px;
}

/* After */
.small-text {
  font-size: clamp(14px, 0.875rem, 16px);
  line-height: 1.4;
}
```

#### Issue: Poor Line Spacing
```css
/* Before */
.tight-text {
  line-height: 1.2;
}

/* After */
.tight-text {
  line-height: 1.5;
  margin-bottom: 1rem;
}
```

#### Issue: Insufficient Contrast
```css
/* Before */
.low-contrast {
  color: #888888;
  background: #ffffff;
}

/* After */
.low-contrast {
  color: #555555; /* Higher contrast */
  background: #ffffff;
}
```

#### Issue: Text Overflow
```css
/* Before */
.overflow-text {
  white-space: nowrap;
}

/* After */
.overflow-text {
  overflow-wrap: break-word;
  hyphens: auto;
  word-break: break-word;
}
```

## Performance Optimization

### Font Loading Strategy
```css
/* System fonts first, custom fonts as enhancement */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.fonts-loaded body {
  font-family: 'Custom Font', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

### Font Display Control
```css
@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap; /* Show system font first, swap when loaded */
  font-weight: 400;
  font-style: normal;
}
```

### Text Rendering Optimization
```css
/* Improve text rendering on mobile */
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* For high-DPI screens */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  body {
    -webkit-font-smoothing: subpixel-antialiased;
  }
}
```

## Tools & Resources

### Built-in Tools
- `TypographyAudit` component
- `useTypographyAudit` hook
- Contrast ratio checker utilities

### Browser DevTools
- Chrome: Device toolbar for mobile testing
- Firefox: Responsive Design Mode with font inspection
- Safari: Develop → Show Fonts

### External Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [Type Scale Generator](https://type-scale.com/)
- [Fluid Type Scale Calculator](https://utopia.fyi/type/calculator/)

## Compliance Checklist

- [ ] All body text ≥16px on mobile
- [ ] Line height between 1.4-1.8 for body text
- [ ] Sufficient contrast (4.5:1 minimum)
- [ ] Responsive typography scaling
- [ ] Support for dynamic text sizing
- [ ] Proper heading hierarchy
- [ ] Adequate spacing between elements
- [ ] No text overflow or truncation
- [ ] Tested on multiple devices
- [ ] Accessibility compliance verified

## Related Documents
- [TOUCH_TARGET_GUIDELINES.md](./TOUCH_TARGET_GUIDELINES.md) - Touch target standards
- [ACCESSIBILITY_GUIDELINES.md](./ACCESSIBILITY_GUIDELINES.md) - General accessibility
- [STYLE_GUIDE_BUTTONS.md](./STYLE_GUIDE_BUTTONS.md) - Button styling standards