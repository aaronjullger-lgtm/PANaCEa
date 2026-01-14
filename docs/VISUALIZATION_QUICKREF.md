# 📊 Data Visualization Components - Quick Reference

## Components Created

### 1. RadialProgress
**Location:** `components/ui/RadialProgress.tsx`  
**Purpose:** Circular progress indicators for percentages (0-100)

```tsx
import RadialProgress from '@/components/ui/RadialProgress';

<RadialProgress
  value={78}
  size={120}
  strokeWidth={8}
  showValue={true}
  label="Overall Accuracy"
/>
```

**Color Logic:**
- 80%+ → Green (`#10b981`)
- 60-80% → Amber (`#f59e0b`)
- <60% → Red (`#ef4444`)

---

### 2. TrendSparkline
**Location:** `components/ui/TrendSparkline.tsx`  
**Purpose:** Small line charts for showing performance trends

```tsx
import TrendSparkline from '@/components/ui/TrendSparkline';

<TrendSparkline
  data={[75, 78, 80, 82, 85, 88]}
  width={200}
  height={60}
  colorScheme="auto"
  showTrend={true}
  showValue={true}
  label="Last 10 Sessions"
/>
```

**Trend Logic:**
- Recent avg > Early avg (+2%+) → ↗ Up (green)
- Recent avg < Early avg (-2%-) → ↘ Down (red)
- Otherwise → — Stable (gray)

---

### 3. ActivityHeatmap
**Location:** `components/analytics/ActivityHeatmap.tsx`  
**Purpose:** GitHub-style contribution calendar

```tsx
import ActivityHeatmap from '@/components/analytics/ActivityHeatmap';

<ActivityHeatmap
  performanceData={performanceData}
  weeks={13}
/>
```

**Intensity Scale:**
- 0 questions → Light gray (no activity)
- 1-5 questions → Light blue
- 6-15 questions → Medium blue
- 16-30 questions → Dark blue
- 30+ questions → Darkest blue

---

## Where They're Used

### SettingsStatsModal (Statistics Tab)
**File:** `components/SettingsStatsModal.tsx`  
**Lines:** 810-845

1. **Recent Form Card** → Uses `TrendSparkline`
2. **Current Streak Card** → Plain text (enhanced styling)
3. **Overall Accuracy Card** → Uses `RadialProgress`

### Activity Tab
**File:** `components/SettingsStatsModal.tsx`  
**Lines:** 960-980

- **ActivityHeatmap** → Already implemented and working!

---

## Quick Import Guide

```tsx
// Individual imports
import RadialProgress from '@/components/ui/RadialProgress';
import TrendSparkline from '@/components/ui/TrendSparkline';
import ActivityHeatmap from '@/components/analytics/ActivityHeatmap';

// Compact variants
import { RadialProgressCompact } from '@/components/ui/RadialProgress';
import { TrendSparklineCompact } from '@/components/ui/TrendSparkline';

// Multi-comparison
import { MultiRadialProgress } from '@/components/ui/RadialProgress';
```

---

## Common Patterns

### Stat Card with Radial Progress
```tsx
<div className="bg-white dark:bg-gray-900 rounded-xl p-6">
  <h3 className="text-sm text-gray-500 mb-4">Overall Accuracy</h3>
  <RadialProgress value={78} size={120} />
</div>
```

### Stat Card with Sparkline
```tsx
<div className="bg-white dark:bg-gray-900 rounded-xl p-6">
  <div className="flex items-center justify-between mb-3">
    <span className="text-sm text-gray-500">Recent Form</span>
    <span className="text-xl font-bold text-green-500">+5%</span>
  </div>
  <TrendSparkline data={[70, 75, 78, 80, 85]} width={200} height={50} />
</div>
```

### Full Activity Calendar
```tsx
<div className="bg-white dark:bg-gray-900 rounded-xl p-6">
  <h3 className="text-lg font-semibold mb-4">Study Activity</h3>
  <ActivityHeatmap performanceData={data} weeks={13} />
  <p className="text-xs text-gray-500 mt-4">
    Click any day for detailed stats
  </p>
</div>
```

---

## Props Cheat Sheet

### RadialProgress Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | required | Percentage (0-100) |
| `size` | `number` | `120` | Circle diameter in pixels |
| `strokeWidth` | `number` | `8` | Ring thickness |
| `color` | `string` | auto | Ring color (auto-colored by value) |
| `showValue` | `boolean` | `true` | Show percentage in center |
| `label` | `string` | `undefined` | Text below circle |

### TrendSparkline Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `number[]` | required | Array of values to plot |
| `width` | `number` | `120` | Width in pixels |
| `height` | `number` | `40` | Height in pixels |
| `colorScheme` | `string` | `'auto'` | 'auto' \| 'success' \| 'warning' \| 'danger' \| 'neutral' |
| `showTrend` | `boolean` | `true` | Show trend arrow icon |
| `showValue` | `boolean` | `true` | Show latest value |
| `label` | `string` | `undefined` | Label text |

### ActivityHeatmap Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `performanceData` | `PerformanceRecord[]` | required | User's performance records |
| `weeks` | `number` | `13` | Number of weeks to display |

---

## Performance Tips

✅ **Do:**
- Use `useMemo` for data calculations
- Keep data arrays reasonable size (<100 points for sparklines)
- Debounce rapid value updates

❌ **Don't:**
- Re-calculate data on every render
- Pass unstable object references as props
- Animate on scroll (causes jank)

---

## Accessibility

All components include:
- ✅ Semantic HTML where possible
- ✅ Color + text/icons (not color alone)
- ✅ Keyboard navigation support (heatmap)
- ✅ Screen reader friendly labels
- ✅ Sufficient color contrast (WCAG AA)

---

## Demo Page

**Visit:** `components/demo/VisualizationDemoPage.tsx`

Interactive demos of:
1. All RadialProgress sizes and colors
2. TrendSparkline with different trends
3. ActivityHeatmap with sample data
4. Combined dashboard preview

---

## Files Summary

**Created (3 files):**
1. `components/ui/RadialProgress.tsx` - 164 lines
2. `components/ui/TrendSparkline.tsx` - 241 lines  
3. `components/demo/VisualizationDemoPage.tsx` - 500+ lines

**Modified (1 file):**
1. `components/SettingsStatsModal.tsx` - Added imports & displays

**Documentation (2 files):**
1. `docs/VISUALIZATION_IMPLEMENTATION.md` - Full guide
2. `components/examples/VisualizationExamples.tsx` - 12 examples

---

## Next Steps

1. ✅ Build successful
2. ✅ Dev server running
3. 🎯 Test in browser: Open Statistics tab
4. 🎯 View demo: Navigate to demo page
5. 🎯 Customize: Adjust colors/sizes to your brand

---

## Support

- **Full Documentation:** `docs/VISUALIZATION_IMPLEMENTATION.md`
- **Code Examples:** `components/examples/VisualizationExamples.tsx`
- **Interactive Demo:** `components/demo/VisualizationDemoPage.tsx`

---

**Questions?** All components are fully typed with TypeScript and include JSDoc comments for IntelliSense support! 🎉
