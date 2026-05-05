# Dashboard Implementation - Historical Notes

This document describes the earlier dashboard implementation. The current signed-in
study dashboard is the adaptive command center mounted through
`components/navigation/CommandCenterHub.tsx` →
`components/navigation/command-center/CommandCenterWorkspace.tsx` →
`components/dashboard/adaptive/page/DashboardPage.tsx`.

## Installed Dependencies

All required dependencies have been successfully installed:

- ✅ **recharts** (3.6.0) - For data visualization charts
- ✅ **swr** (2.3.4) - For data fetching and caching
- ✅ **react-router-dom** (7.11.0) - For navigation and routing

## File Structure

### Components Created

```
components/
├── navigation/
│   └── command-center/
│       └── CommandCenterWorkspace.tsx # Active /study adapter
└── dashboard/
    └── adaptive/
        ├── page/DashboardPage.tsx     # Adaptive dashboard shell
        ├── engine/                    # Signal normalization + resolver
        ├── widgets/                   # Registry-driven widgets
        └── visuals/                   # Semantic medical visuals

config/
├── navigation.ts                  # Navigation structure
├── routes.ts                      # Route definitions
└── (other existing configs)

functions/api/stats/
└── retention.ts                   # Retention data API endpoint
```

## Features Implemented

### 1. Adaptive Dashboard Page

- **Fixed shell**: goal context, Today command, evidence stack, secondary widgets, below-fold analytics
- **Adaptive content**: registry-driven widgets selected by eligibility, score, suppression, and visual budget
- **Today command**: one dominant primary action
- **Trust mechanisms**: attribution drawer, confidence bands, low-data safeguards, and partial-failure states

### 2. Navigation System

- **Sidebar**: Professional medical aesthetic
- **Categories**: Overview, Core Study, Reference, Daily Practice
- **Features**: Active states, smooth animations, responsive
- **Icons**: Lucide React icons throughout

### 3. Chart Components

- **DecayCurve**: 30-day retention projection with danger zone
- **StabilityPyramid**: Distribution of cards by stability level
- **Styling**: Clean, professional, dark mode support

### 4. API Endpoint

- **Path**: `/api/stats/retention`
- **Auth**: Clerk authentication required
- **Data**: Decay curve, stability buckets, tuning info
- **Database**: Prisma with Supabase

## Usage

### Active Dashboard Wiring

Do not import a standalone dashboard page for `/study`. The active route should
continue to use `CommandCenterHub`, which delegates to `CommandCenterWorkspace`
and renders the adaptive dashboard.

### Use the Sidebar

```tsx
import { MainLayout } from './components/layout';

function App() {
  return (
    <MainLayout>
      <YourContent />
    </MainLayout>
  );
}
```

### Fetch Retention Data

```tsx
import useSWR from 'swr';

const { data, error, isLoading } = useSWR('/api/stats/retention', fetcher);
```

## Design Principles

✅ Clean, professional medical aesthetic  
✅ White/Gray/Blue color scheme (dark mode compatible)  
✅ Dense, information-rich layouts  
✅ Subtle animations, no gimmicks  
✅ Responsive (mobile → desktop)  
✅ Accessible (proper contrast, ARIA labels)

## Next Steps

1. **Integrate into App.tsx**: Add dashboard view to your existing routing
2. **Connect Real Data**: Replace mock streak/predictor with actual data
3. **Test API**: Ensure `/api/stats/retention` returns proper data
4. **Customize Colors**: Adjust brand colors in Tailwind config if needed

## API Requirements

The retention API expects:

- Clerk authentication token in request headers
- Supabase database with `SRSItem` table
- Environment variables: `DATABASE_URL`, `CLERK_SECRET_KEY`

## Notes

- This is a **Vite/React** app, not Next.js
- Navigation uses `react-router-dom` for routing
- All components support dark mode out of the box
- Charts are responsive and mobile-friendly
