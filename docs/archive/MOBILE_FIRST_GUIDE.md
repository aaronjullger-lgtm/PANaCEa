# Mobile-First Component Development Guide

## Overview

This guide outlines the principles, patterns, and best practices for building mobile-first components in the PANaCEa platform. Following these guidelines ensures optimal user experience across all device sizes while maintaining accessibility and performance.

## Core Principles

### 1. Mobile-First Design
- **Start with mobile**: Design and implement for the smallest screen first, then enhance for larger screens
- **Progressive enhancement**: Add features and complexity as screen size increases
- **Content priority**: Ensure the most important content is visible and accessible on mobile

### 2. Touch-First Interaction
- **Minimum touch target**: 44×44px (WCAG 2.1 AA requirement)
- **Adequate spacing**: At least 8px between interactive elements
- **Gesture support**: Implement common mobile gestures (swipe, tap, long press)

### 3. Performance First
- **Lazy loading**: Load content and components only when needed
- **Optimized images**: Use responsive images with appropriate sizes
- **Minimal JavaScript**: Keep mobile bundle size small

## Component Patterns

### Responsive Layout Components

#### 1. Container Components
```tsx
import { useBreakpoint, useMediaQuery } from '@/lib/utils/mobileOptimization';

const ResponsiveContainer: React.FC = ({ children }) => {
  const isMobile = useMediaQuery('md'); // Returns true if screen < 768px
  
  return (
    <div className={`
      mx-auto
      ${isMobile ? 'px-4' : 'px-6'}
      ${isMobile ? 'max-w-full' : 'max-w-6xl'}
    `}>
      {children}
    </div>
  );
};
```

#### 2. Responsive Grid
```tsx
const ResponsiveGrid: React.FC = ({ children }) => {
  const breakpoint = useBreakpoint();
  
  const gridCols = {
    xs: 'grid-cols-1',
    sm: 'grid-cols-2',
    md: 'grid-cols-3',
    lg: 'grid-cols-4',
    xl: 'grid-cols-5',
  }[breakpoint];
  
  return (
    <div className={`grid ${gridCols} gap-4`}>
      {children}
    </div>
  );
};
```

### Touch-Optimized Components

#### 1. Touch-Friendly Button
```tsx
import { StandardButton } from '@/components/shared/StandardButton';

const TouchButton: React.FC = ({ onClick, children }) => {
  return (
    <StandardButton
      size="lg" // Larger touch target on mobile
      className="min-h-[44px] min-w-[44px]" // WCAG compliance
      onClick={onClick}
    >
      {children}
    </StandardButton>
  );
};
```

#### 2. Gesture-Enabled Component
```tsx
import { MobileGestureHandler } from '@/components/shared/MobileGestureHandler';

const GestureCard: React.FC = ({ children }) => {
  const handleSwipeLeft = () => {
    // Navigate to next item
  };
  
  const handleSwipeRight = () => {
    // Navigate to previous item
  };
  
  const handleLongPress = () => {
    // Show context menu
  };
  
  return (
    <MobileGestureHandler
      config={{
        enableSwipeNavigation: true,
        enableLongPress: true,
        swipeThreshold: 30,
      }}
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onLongPress={handleLongPress}
    >
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
        {children}
      </div>
    </MobileGestureHandler>
  );
};
```

### Mobile Navigation Components

#### 1. Bottom Navigation Bar
```tsx
const BottomNav: React.FC = () => {
  const isMobile = useMediaQuery('md');
  
  if (!isMobile) return null;
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] p-2">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <TouchButton key={item.id} onClick={item.onClick}>
            {item.icon}
            <span className="text-xs mt-1">{item.label}</span>
          </TouchButton>
        ))}
      </div>
    </nav>
  );
};
```

#### 2. Responsive Sidebar
```tsx
const ResponsiveSidebar: React.FC = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery('md');
  
  return (
    <>
      {/* Mobile: Drawer */}
      {isMobile && (
        <>
          <button onClick={() => setIsOpen(true)}>☰</button>
          <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)}>
            {children}
          </Drawer>
        </>
      )}
      
      {/* Desktop: Fixed sidebar */}
      {!isMobile && (
        <aside className="w-64 fixed left-0 top-0 h-full">
          {children}
        </aside>
      )}
    </>
  );
};
```

## Gesture Implementation Guide

### Available Gesture Hooks

#### 1. `useGestures` - Comprehensive gesture detection
```tsx
import { useGestures } from '@/lib/utils/mobileOptimization';

const GestureComponent: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  
  useGestures(ref, {
    onSwipeLeft: () => console.log('Swiped left'),
    onSwipeRight: () => console.log('Swiped right'),
    onLongPress: () => console.log('Long pressed'),
    onDoubleTap: () => console.log('Double tapped'),
    swipeThreshold: 50,
    longPressDelay: 500,
  });
  
  return <div ref={ref}>Swipe me!</div>;
};
```

#### 2. `MobileGestureHandler` - Component wrapper
```tsx
import { MobileGestureHandler } from '@/components/shared/MobileGestureHandler';

const AppContent: React.FC = ({ children }) => {
  return (
    <MobileGestureHandler
      config={{
        enableSwipeNavigation: true,
        enablePullToRefresh: true,
        enableLongPress: true,
      }}
      onSwipeLeft={() => navigateBack()}
      onSwipeRight={() => navigateForward()}
      onPullToRefresh={() => refreshData()}
    >
      {children}
    </MobileGestureHandler>
  );
};
```

#### 3. `PullToRefresh` - Specialized component
```tsx
import { PullToRefresh } from '@/components/shared/MobileGestureHandler';

const RefreshableList: React.FC = ({ items }) => {
  const [data, setData] = useState(items);
  
  const handleRefresh = async () => {
    const newData = await fetchData();
    setData(newData);
  };
  
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <ul>
        {data.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </PullToRefresh>
  );
};
```

### Gesture Best Practices

1. **Provide visual feedback**: Show users when gestures are detected
2. **Maintain consistency**: Use the same gestures for similar actions across the app
3. **Don't override system gestures**: Avoid interfering with browser navigation gestures
4. **Provide alternatives**: Ensure all gesture actions have button alternatives for accessibility

## Responsive Image Patterns

### 1. OptimizedImage Component
```tsx
import { OptimizedImage } from '@/lib/utils/imageOptimization';

const ProductImage: React.FC = ({ src, alt }) => {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      loading="lazy"
      className="rounded-lg"
    />
  );
};
```

### 2. Responsive Background Images
```tsx
const HeroSection: React.FC = () => {
  return (
    <div className="relative h-64 md:h-96">
      {/* Mobile image */}
      <img
        src="/hero-mobile.jpg"
        alt="Hero"
        className="md:hidden w-full h-full object-cover"
      />
      
      {/* Desktop image */}
      <img
        src="/hero-desktop.jpg"
        alt="Hero"
        className="hidden md:block w-full h-full object-cover"
      />
    </div>
  );
};
```

## Mobile Performance Optimization

### 1. Lazy Loading Components
```tsx
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  );
};
```

### 2. Conditional Loading
```tsx
const FeatureComponent: React.FC = () => {
  const isMobile = useMediaQuery('md');
  
  // Don't load heavy features on mobile
  if (isMobile) {
    return <MobileVersion />;
  }
  
  return <DesktopVersion />;
};
```

### 3. Optimized Bundles
```tsx
// Use dynamic imports for mobile-specific code
const loadMobileModule = () => import('./mobileModule');

const Component: React.FC = () => {
  useEffect(() => {
    if (isMobile) {
      loadMobileModule();
    }
  }, [isMobile]);
  
  return <div>Content</div>;
};
```

## Accessibility Considerations

### 1. Touch Target Size
```css
/* Minimum touch target */
.min-touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px; /* Increases touch area */
}
```

### 2. Gesture Accessibility
```tsx
const AccessibleGestureComponent: React.FC = () => {
  return (
    <div role="region" aria-label="Swipeable content">
      {/* Provide button alternatives for gestures */}
      <button 
        className="sr-only" 
        onClick={() => handleSwipeLeft()}
        aria-label="Swipe left alternative"
      >
        Previous
      </button>
      
      <div className="gesture-area">
        {/* Gesture content */}
      </div>
      
      <button 
        className="sr-only" 
        onClick={() => handleSwipeRight()}
        aria-label="Swipe right alternative"
      >
        Next
      </button>
    </div>
  );
};
```

### 3. Reduced Motion Support
```tsx
import { prefersReducedMotion } from '@/lib/utils/animations';

const AnimatedComponent: React.FC = () => {
  const shouldReduceMotion = prefersReducedMotion();
  
  return (
    <motion.div
      animate={{
        opacity: 1,
        x: shouldReduceMotion ? 0 : 100,
      }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
      }}
    >
      Content
    </motion.div>
  );
};
```

## Testing Guidelines

### 1. Device Testing Matrix
| Device Type | Screen Size | Orientation | Key Tests |
|-------------|-------------|-------------|-----------|
| iPhone SE | 375×667 | Portrait | Touch targets, navigation |
| iPhone 14 Pro | 393×852 | Portrait/Landscape | Gestures, responsive layout |
| iPad | 1024×1366 | Portrait/Landscape | Tablet optimization |
| Android (Pixel) | 412×915 | Portrait | Cross-platform consistency |

### 2. Automated Testing
```typescript
// Playwright mobile tests
test.describe('Mobile Experience', () => {
  test('should have proper touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const buttons = await page.locator('button');
    
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
  
  test('should support swipe gestures', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('.swipeable').first().swipe('left');
    // Verify navigation occurred
  });
});
```

### 3. Manual Testing Checklist
- [ ] All interactive elements are at least 44×44px
- [ ] No horizontal scrolling on mobile
- [ ] Text is readable without zooming
- [ ] Forms are easy to fill on mobile
- [ ] Gestures work as expected
- [ ] Keyboard doesn't cover form inputs
- [ ] Images load quickly on mobile data
- [ ] Touch feedback is visible
- [ ] No content is cut off on small screens

## Common Mobile Patterns

### 1. Mobile-First Modal
```tsx
const MobileModal: React.FC = ({ isOpen, onClose, children }) => {
  const isMobile = useMediaQuery('md');
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={onClose} />
      
      {/* Modal content */}
      <div className={`
        absolute bg-[var(--color-bg-primary)] rounded-t-2xl
        ${isMobile ? 'bottom-0 left-0 right-0 max-h-[90vh]' : 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-lg'}
      `}>
        {/* Close button at top for mobile */}
        {isMobile && (
          <div className="flex justify-center p-2">
            <div className="w-12 h-1 bg-[var(--color-border)] rounded-full" />
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
};
```

### 2. Responsive Data Table
```tsx
const ResponsiveTable: React.FC<{ data: any[] }> = ({ data }) => {
  const isMobile = useMediaQuery('md');
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.id} className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
            <div className="font-semibold">{item.name}</div>
            <div className="text-sm text-[var(--color-text-muted)]">{item.description}</div>
            <div className="mt-2 text-right">{item.value}</div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.description}</td>
            <td>{item.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

## Troubleshooting

### Common Issues and Solutions

#### 1. iOS Safari Viewport Issues
```html
<!-- Add to index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

#### 2. Mobile Keyboard Covering Inputs
```tsx
const MobileInput: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    
    const scrollIntoView = () => {
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    };
    
    input.addEventListener('focus', scrollIntoView);
    return () => input.removeEventListener('focus', scrollIntoView);
  }, []);
  
  return <input ref={inputRef} />;
};
```

#### 3. Double-Tap Zoom Prevention
```css
/* Prevent double-tap zoom */
.touch-element {
  touch-action: manipulation;
}
```

#### 4. 100vh Issues on Mobile
```tsx
const MobileFullHeight: React.FC = () => {
  const [height, setHeight] = useState('100vh');
  
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setHeight('calc(var(--vh, 1vh) * 100)');
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);
  
  return <div style={{ height }}>Content</div>;
};
```

## Resources

### 1. Tools
- **Chrome DevTools**: Device emulation and performance profiling
- **Lighthouse**: Mobile performance and accessibility audits
- **BrowserStack**: Cross-browser and device testing

### 2. References
- [WCAG 2.1 Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Google Mobile-First Indexing](https://developers.google.com/search/mobile-sites/mobile-first-indexing)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

### 3. Component Library
- `@/components/shared/MobileGestureHandler` - Gesture detection
- `@/components/shared/StandardButton` - Touch-optimized buttons
- `@/lib/utils/mobileOptimization` - Mobile utilities
- `@/lib/utils/imageOptimization` - Responsive images

## Conclusion

Building mobile-first components requires careful consideration of touch interactions, performance, and responsive design. By following these patterns and using the provided utilities, you can create components that provide an excellent experience across all device sizes while maintaining accessibility and performance standards.

Remember: **Mobile isn't just a smaller screen—it's a different interaction paradigm.** Design for touch, prioritize content, and optimize for performance.