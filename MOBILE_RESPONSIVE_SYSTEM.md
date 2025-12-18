# Mobile-Responsive Navigation & Layout System

## Overview

PANaCEa now features a comprehensive mobile-responsive system optimized for phones and tablets. The system includes responsive breakpoint hooks, bottom tab navigation, stacked drill layouts, and touch-optimized UI components.

## Architecture

### 1. Breakpoint Utilities (`lib/utils/responsive.ts`)

Custom React hooks for detecting viewport sizes and categories:

```typescript
// Mobile detection (<768px)
const isMobile = useIsMobile();

// Tablet detection (768px - 1024px)
const isTablet = useIsTablet();

// Viewport category
const category = useViewportCategory(); // 'mobile' | 'tablet' | 'desktop'
```

**Key Constants:**
- `MOBILE_BREAKPOINT = 768` (matches Tailwind's `md` breakpoint)
- `MIN_TOUCH_TARGET_SIZE = 44px` (iOS/Android accessibility guidelines)

### 2. Mobile Navigation (MenuView.tsx)

#### Desktop (≥768px)
- Traditional vertical layout
- Full sidebar with all content visible
- Horizontal spacing optimized for wide screens

#### Mobile (<768px)
- **Bottom Tab Bar**: Fixed navigation with 3 tabs
  - **Home**: Welcome card, daily prescription, session controls
  - **Stats**: Widget grid, heatmap calendar, system comparison
  - **Modes**: Training menu access, integrations hub

**Tab Bar Features:**
- Fixed positioning (`bottom-0`)
- 44px minimum touch targets
- Active state with primary color accent
- Semantic icons (Home, BarChart3, Dumbbell)

```tsx
{isMobile && (
  <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
    <div className="grid grid-cols-3 gap-0">
      <button className="min-h-[44px]">...</button>
    </div>
  </div>
)}
```

### 3. Drill Layout Optimizations (MiniDrillLayout.tsx)

#### Header Improvements
- **Exit Button**: 44x44px touch target (hidden text label on mobile)
- **Title**: Truncates with `px-2` padding
- **Score**: Hidden on extra-small screens (`hidden xs:block`)
- **Streak**: Larger icons (5x5 → 6x6 on sm+)

#### Content Area
- **Padding**: Increased from `px-3` to `px-3 sm:px-6`
- **Bottom Padding**: `pb-20` to avoid tab bar overlap

#### Answer Buttons
- **Touch Targets**: Minimum `56px` height (`min-h-[56px]`)
- **Padding**: `p-4` for comfortable tapping
- **Grid Layout**: **`grid-cols-1` on mobile** (stacked), `grid-cols-2` on larger screens
- **Text Size**: `text-sm sm:text-base` for readability

```tsx
<button className="w-full p-4 min-h-[56px] rounded-lg">
  {/* Answer content */}
</button>
```

#### Reset Button
- Floating FAB with `min-h-[44px]` and `min-w-[44px]`
- Centered icon with `flex items-center justify-center`

### 4. Touch Target Guidelines

All interactive elements follow **WCAG 2.5.5 Level AAA** and **Apple/Google guidelines**:

| Element | Min Size | Implementation |
|---------|----------|----------------|
| Tab bar buttons | 44x44px | `min-h-[44px]` + `py-3` |
| Answer options | 56px height | `min-h-[56px]` + `p-4` |
| Exit button | 44x44px | `min-h-[44px] min-w-[44px]` |
| Reset FAB | 44x44px | `min-h-[44px] min-w-[44px]` |
| Streak counter | 44px height | `min-h-[44px]` wrapper |

## Responsive Patterns

### Tailwind Class Conventions

```tsx
// Stack on mobile, row on desktop
className="flex flex-col md:flex-row"

// Hide on mobile, show on small+
className="hidden sm:block"

// Responsive padding
className="px-3 sm:px-6"

// Responsive text size
className="text-sm sm:text-base"

// Mobile-specific bottom spacing
className={`${isMobile ? 'pb-20' : ''}`}
```

### Grid Layouts

**Answer Options:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  {/* Stacked on mobile, 2-column on desktop */}
</div>
```

**Quick Actions:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
  {/* Responsive card grid */}
</div>
```

## Mobile-Specific Features

### 1. Tab-Based Navigation
- Content filtered by `activeTab` state
- Smooth transitions with Framer Motion
- Persistent tab bar (doesn't scroll away)

### 2. Conditional Rendering
```tsx
{(!isMobile || activeTab === 'home') && (
  <WelcomeCard />
)}

{isMobile && activeTab === 'stats' && (
  <StatsView />
)}
```

### 3. Safe Area Support
- `pb-safe` class for devices with notches
- Bottom navigation respects device chrome

## Performance Optimizations

### 1. Resize Listener Cleanup
```typescript
useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

### 2. Conditional Component Loading
- Mobile-only components render only when needed
- Desktop-only features hidden on mobile

### 3. Reduced Motion Support
- Existing `useAccessibleTransition` hook compatible
- Framer Motion respects `prefers-reduced-motion`

## Testing Checklist

### Mobile (375px - 767px)
- ✅ Bottom tab bar visible and functional
- ✅ All buttons ≥44px touch targets
- ✅ Answer options stacked (1 column)
- ✅ No horizontal scroll
- ✅ Text readable without zooming
- ✅ Tab switching smooth and instant

### Tablet (768px - 1023px)
- ✅ Standard desktop layout
- ✅ 2-column answer grids
- ✅ Full sidebar visible
- ✅ Comfortable spacing

### Desktop (≥1024px)
- ✅ Optimal use of screen space
- ✅ All features accessible
- ✅ Hover states functional

### Touch Devices
- ✅ No accidental taps (proper spacing)
- ✅ Thumb-friendly navigation
- ✅ Scroll performance smooth

## Browser Support

- **iOS Safari**: 15+
- **Chrome Mobile**: 90+
- **Samsung Internet**: 14+
- **Firefox Mobile**: 90+

**Features:**
- `window.innerWidth` (universal support)
- CSS Grid (universal support)
- Flexbox (universal support)
- CSS Variables (iOS 9.3+)

## Migration Guide

### Adding Mobile Support to New Components

1. **Import the hook:**
```tsx
import { useIsMobile } from '../lib/utils/responsive';
```

2. **Use in component:**
```tsx
const MyComponent = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className={isMobile ? 'p-3' : 'p-6'}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
};
```

3. **Ensure touch targets:**
```tsx
<button className="min-h-[44px] min-w-[44px] p-3">
  Tap Me
</button>
```

## Future Enhancements

- [ ] Landscape mode optimizations for phones
- [ ] Swipe gestures for tab navigation
- [ ] Pull-to-refresh on mobile
- [ ] Offline mode indicator
- [ ] Progressive Web App (PWA) manifest
- [ ] Install prompt for mobile home screen

---

**Last Updated**: December 2024  
**Status**: ✅ Production-ready  
**Coverage**: MenuView, MiniDrillLayout, all drill modes
