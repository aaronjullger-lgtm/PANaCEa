# Loading System Guide

## Overview

The PANaCEa Loading System provides standardized loading patterns for all async operations across the application. It ensures consistent user experience, proper feedback, and accessibility compliance.

## Core Principles

1. **Consistency**: All loading states follow the same visual patterns
2. **Feedback**: Users always know what's happening
3. **Accessibility**: Proper ARIA labels and keyboard navigation
4. **Performance**: Minimal impact on perceived performance
5. **Error Handling**: Graceful degradation and recovery options

## Components

### 1. `useLoadingState` Hook

The foundation of the loading system. Manages loading state with timeout, progress tracking, and error handling.

```typescript
import { useLoadingState } from '@/hooks/useLoadingState';

const [state, actions] = useLoadingState({
  timeoutMs: 30000,
  showProgress: true,
  estimatedDurationMs: 5000,
});

// Start loading
actions.start();

// Update progress
actions.updateProgress(50);

// Complete
actions.complete();

// Handle error
actions.setError('Failed to load data');
```

### 2. `LoadingSystem` Component

Main loading component that handles all states (loading, error, timeout).

```tsx
import { LoadingSystem } from '@/components/shared/LoadingSystem';

<LoadingSystem
  isLoading={isLoading}
  error={error}
  progress={progress}
  message="Loading questions..."
  type="question"
  size="lg"
  fullscreen={true}
  showProgress={true}
  showTime={true}
  onRetry={handleRetry}
  onCancel={handleCancel}
>
  {/* Content shown when not loading */}
  <YourContent />
</LoadingSystem>
```

### 3. `InlineLoader` Component

Small inline loading indicator for minor operations.

```tsx
import { InlineLoader } from '@/components/shared/LoadingSystem';

<InlineLoader 
  size="sm" 
  message="Saving..." 
/>
```

### 4. `LoadingButton` Component

Button with integrated loading state.

```tsx
import { LoadingButton } from '@/components/shared/LoadingSystem';

<LoadingButton
  isLoading={isSubmitting}
  loadingText="Submitting..."
  variant="primary"
  size="md"
  onClick={handleSubmit}
>
  Submit Answer
</LoadingButton>
```

### 5. `ContentSkeleton` Component

Skeleton placeholder for content loading.

```tsx
import { ContentSkeleton } from '@/components/shared/LoadingSystem';

// Text skeleton
<ContentSkeleton type="text" lines={4} />

// Card skeleton
<ContentSkeleton type="card" />

// List skeleton
<ContentSkeleton type="list" lines={3} />
```

## Usage Patterns

### Pattern 1: Basic Async Operation

```tsx
import { useAsyncLoading, LoadingSystem } from '@/components/shared/LoadingSystem';

function MyComponent() {
  const [state, execute, actions] = useAsyncLoading(
    async () => {
      const data = await fetchData();
      return data;
    },
    {
      timeoutMs: 10000,
      onError: (error) => console.error('Failed:', error),
    }
  );

  return (
    <LoadingSystem
      isLoading={state.isLoading}
      error={state.error}
      progress={state.progress}
      message="Fetching data..."
      onRetry={execute}
    >
      <YourContent data={data} />
    </LoadingSystem>
  );
}
```

### Pattern 2: Progress-Based Operation

```tsx
import { useProgressLoading, LoadingSystem } from '@/components/shared/LoadingSystem';

function UploadComponent() {
  const [state, actions] = useProgressLoading({
    estimatedDurationMs: 30000,
  });

  const handleUpload = async () => {
    actions.start();
    
    // Simulate progress updates
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      actions.updateProgress(i);
    }
    
    actions.complete();
  };

  return (
    <LoadingSystem
      isLoading={state.isLoading}
      progress={state.progress}
      message="Uploading file..."
      type="upload"
      showProgress={true}
      showTime={true}
    >
      <button onClick={handleUpload}>Upload</button>
    </LoadingSystem>
  );
}
```

### Pattern 3: Multiple Parallel Operations

```tsx
import { useMultiLoading, LoadingSystem } from '@/components/shared/LoadingSystem';

function DashboardComponent() {
  const { states, actions, overallProgress } = useMultiLoading(3, {
    showProgress: true,
  });

  const loadAllData = async () => {
    actions[0].start();
    actions[1].start();
    actions[2].start();

    // Load data in parallel
    await Promise.all([
      loadUserData().then(() => actions[0].complete()),
      loadStatsData().then(() => actions[1].complete()),
      loadAnalyticsData().then(() => actions[2].complete()),
    ]);
  };

  return (
    <LoadingSystem
      isLoading={states.some(s => s.isLoading)}
      progress={overallProgress}
      message="Loading dashboard data..."
      showProgress={true}
    >
      <DashboardContent />
    </LoadingSystem>
  );
}
```

## Type-Specific Loading

Different operation types have specific visual treatments:

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `default` | Loader2 | Accent | General operations |
| `question` | Brain | Primary | Loading questions |
| `data` | Zap | Data | Data fetching |
| `ai` | Brain | AI | AI processing |
| `auth` | CheckCircle | Success | Authentication |
| `media` | Zap | Media | Media loading |
| `upload` | Upload | Warning | File uploads |

## Size Variants

| Size | Icon | Text | Use Case |
|------|------|------|----------|
| `xs` | 16px | text-xs | Inline text |
| `sm` | 20px | text-sm | Small buttons |
| `md` | 24px | text-base | Default |
| `lg` | 32px | text-lg | Page loading |
| `xl` | 48px | text-xl | Fullscreen loading |

## Accessibility Requirements

1. **ARIA Labels**: All loading components must have proper `aria-live` and `aria-busy` attributes
2. **Keyboard Navigation**: Loading states shouldn't trap keyboard focus
3. **Screen Readers**: Provide meaningful status updates
4. **Reduced Motion**: Respect user motion preferences

```tsx
<LoadingSystem
  isLoading={isLoading}
  message="Loading questions..."
  // Automatically adds:
  // role="status"
  // aria-live="polite"
  // aria-busy={isLoading}
/>
```

## Migration Guide

### From Old Patterns

**Before (inconsistent):**
```tsx
{isLoading ? (
  <div className="flex items-center">
    <Loader2 className="w-5 h-5 animate-spin mr-2" />
    Loading...
  </div>
) : (
  <Content />
)}
```

**After (standardized):**
```tsx
<LoadingSystem
  isLoading={isLoading}
  message="Loading..."
  size="sm"
>
  <Content />
</LoadingSystem>
```

### From Custom Spinners

**Before:**
```tsx
<button disabled={isLoading}>
  {isLoading ? (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  ) : (
    'Submit'
  )}
</button>
```

**After:**
```tsx
<LoadingButton
  isLoading={isLoading}
  loadingText="Submitting..."
  variant="primary"
>
  Submit
</LoadingButton>
```

## Testing Checklist

- [ ] Loading states appear for all async operations
- [ ] Progress indicators update smoothly
- [ ] Timeout handling works correctly
- [ ] Error states provide actionable feedback
- [ ] Retry functionality works
- [ ] Accessibility requirements met
- [ ] Mobile responsiveness maintained
- [ ] Performance impact minimal
- [ ] No layout shift during loading

## Common Pitfalls

1. **Missing Loading States**: Always show loading for operations > 100ms
2. **Blocking UI**: Don't prevent user interaction unnecessarily
3. **Infinite Loading**: Always implement timeouts
4. **Poor Error Messages**: Provide specific, actionable error messages
5. **Ignoring Progress**: For long operations (> 3s), show progress

## Performance Considerations

1. **Debounce Rapid Updates**: Throttle progress updates to 60fps
2. **Lazy Load Components**: Use React.lazy() for code splitting
3. **Optimistic Updates**: Show expected results while loading
4. **Cache Results**: Avoid reloading identical data
5. **Cancel Unneeded Requests**: Clean up on component unmount

## Integration with Existing Components

The loading system integrates with:

1. **EnhancedLoader**: Enhanced authentication loading
2. **QuestionSkeleton**: Question loading placeholders
3. **DrillLoadingState**: Drill mode loading
4. **SkeletonLoader**: General skeleton screens

Update existing components to use the new loading system for consistency.