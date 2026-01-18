# PANaCEa - Lifelong Medical Companion

**Universal Learning System for PA Students, Board Preppers, and Practicing Clinicians**

---

## Design Philosophy

### Clear & Direct

No buzzwords. Each feature name describes exactly what it does.

### Universal Terminology

- ❌ Avoid: "Didactics" (student-only), "CME" (professional-only)
- ✅ Use: "Education", "Reference", "Skills" (universal)

### Professional Aesthetic

Clean, high-utility design focused on data and learning outcomes.

---

## Navigation Structure

### 🎓 Education & Retention

_Adaptive learning tools for knowledge acquisition and maintenance_

**Routes:**

- **Adaptive Review** → `/education/adaptive`
  - Algorithm-driven spaced repetition for optimal retention
- **Question Bank** → `/education/qbank`
  - Clinical vignettes and board-style practice questions
- **Simulated Exams** → `/education/simulator`
  - Full-length mock assessments in realistic testing conditions
- **Case Studies** → `/education/cases`
  - Complex clinical reasoning scenarios with detailed analysis

---

### 📚 Clinical Reference

_Comprehensive index of medical content_

**Routes:**

- **Conditions** → `/reference/conditions`
  - Pathology and disease management across all PANCE systems
- **Pharmacology** → `/reference/drugs`
  - Drug index, mechanisms, therapeutics, and adverse effects
- **Diagnostics** → `/reference/diagnostics`
  - Laboratory tests, imaging modalities, and diagnostic procedures
- **Guidelines** → `/reference/guidelines`
  - Evidence-based clinical practice guidelines and protocols

**Features:**

- Universal search bar for instant access
- Command palette (Cmd/Ctrl + K)
- Weekly content updates

---

### ⚡ Skill Refinement

_Rapid-fire tools to sharpen clinical reflexes_

**Routes:**

- **Medical Terminology** → `/skills/terminology`
  - Vocabulary, nomenclature, and root word mastery drills
- **Rapid Recall** → `/skills/rapid`
  - High-speed flashcard sessions for instant retrieval practice
- **Visual Diagnostics** → `/skills/visuals`
  - Pattern recognition for radiology, ECGs, and dermatology

**Performance Metrics:**

- Average response time tracking
- Pattern recognition accuracy
- Speed improvement analytics

---

## Component Architecture

### SectorGrid Component

**Location:** `components/layout/SectorGrid.tsx`

**Design:**

- Clean, modern card-based navigation
- Professional hover effects (border highlight, arrow animation)
- Responsive grid: 1 → 2 → 3 columns
- Subtle background patterns on hover
- Icon badges with color coding

**Usage:**

```tsx
import { SectorGrid, SectorItem } from '@/components/layout/SectorGrid';

const items: SectorItem[] = [
  {
    id: 'example',
    title: 'Feature Name',
    description: 'Clear description of what this does.',
    icon: IconComponent,
    path: '/path/to/feature',
    color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
  },
];

<SectorGrid items={items} onNavigate={(path) => handleNav(path)} />;
```

---

## Page Components

### Education Page

**File:** `app/education/page.tsx`

**Features:**

- 4 learning modes (adaptive, questions, exams, cases)
- Stats footer with key metrics
- Responsive grid layout

### Reference Page

**File:** `app/reference/page.tsx`

**Features:**

- 4 reference categories (conditions, drugs, diagnostics, guidelines)
- Universal search bar
- Database statistics
- Quick access tip (command palette)

### Skills Page

**File:** `app/skills/page.tsx`

**Features:**

- 3 drill categories (terminology, rapid recall, visual diagnostics)
- Performance metrics display
- Training recommendations
- Daily practice tip

---

## Color Coding System

**Education:**

- Adaptive Review: Blue (`bg-blue-50`)
- Question Bank: Purple (`bg-purple-50`)
- Simulated Exams: Orange (`bg-orange-50`)
- Case Studies: Green (`bg-green-50`)

**Reference:**

- Conditions: Red (`bg-red-50`)
- Pharmacology: Blue (`bg-blue-50`)
- Diagnostics: Purple (`bg-purple-50`)
- Guidelines: Green (`bg-green-50`)

**Skills:**

- Medical Terminology: Indigo (`bg-indigo-50`)
- Rapid Recall: Yellow (`bg-yellow-50`)
- Visual Diagnostics: Cyan (`bg-cyan-50`)

---

## Navigation Configuration

**File:** `config/navigation.ts`

The navigation structure is centralized and type-safe:

```typescript
export const NAVIGATION_STRUCTURE: NavigationCategory[] = [
  {
    category: 'Education',
    items: [
      { label: 'Adaptive Review', path: '/education/adaptive', icon: 'BrainCircuit' },
      // ...
    ],
  },
  // ...
];
```

**Route Definitions:** `config/routes.ts`

```typescript
export const ROUTES = {
  ADAPTIVE_REVIEW: '/education/adaptive',
  QUESTION_BANK: '/education/qbank',
  // ...
} as const;
```

---

## Responsive Design

All sector pages are fully responsive:

**Mobile (< 768px):**

- Single column grid
- Full-width search bar
- Stacked stat cards

**Tablet (768px - 1024px):**

- 2-column grid
- Compact navigation

**Desktop (> 1024px):**

- 3-column grid
- Expanded layouts
- Multi-column stats

---

## Accessibility

- ✅ Proper ARIA labels on interactive elements
- ✅ Keyboard navigation support
- ✅ High contrast ratios (WCAG AA compliant)
- ✅ Focus indicators on all interactive elements
- ✅ Screen reader friendly

---

## Integration Guide

### Adding to App Routing

```tsx
import { EducationPage, ReferencePage, SkillsPage } from './app';

// In your router:
<Route path="/education" element={<EducationPage />} />
<Route path="/reference" element={<ReferencePage />} />
<Route path="/skills" element={<SkillsPage />} />
```

### Custom Navigation Handler

```tsx
const handleNavigate = (path: string) => {
  // Custom logic (analytics, guards, etc.)
  router.push(path);
};

<SectorGrid items={items} onNavigate={handleNavigate} />;
```

---

## Benefits of Universal Terminology

### For Students

- Clear learning progression
- No intimidating jargon
- Focus on skill building

### For Board Preppers

- Exam-relevant organization
- Quick reference access
- Targeted practice tools

### For Clinicians

- Continuing education pathways
- Evidence-based guidelines
- Clinical decision support

---

## Future Expansion

The structure supports easy addition of new sectors:

1. Add new page in `app/[sector]/page.tsx`
2. Create `SectorItem[]` array with features
3. Update `config/navigation.ts`
4. Add routes to `config/routes.ts`

**Potential Future Sectors:**

- **Community** (peer learning, study groups)
- **Professional** (career development, networking)
- **Research** (journal reviews, literature search)

---

## Maintenance

**Weekly Tasks:**

- Review content metrics
- Update database statistics
- Check for broken navigation links

**Monthly Tasks:**

- Analyze user flow through sectors
- Optimize sector descriptions based on engagement
- Update color coding if needed

---

## Support

For questions or feature requests, refer to:

- Navigation config: `config/navigation.ts`
- Component documentation: Inline JSDoc comments
- Route definitions: `config/routes.ts`
