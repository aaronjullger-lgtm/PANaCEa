# Auth Header Audit Report
**Generated:** January 9, 2026

## Executive Summary
Found **35+ fetch calls** in component files that may be missing authentication headers. These are potential 401 error sources in production.

---

## 🚨 CRITICAL: Admin Endpoints (Require Auth)

These endpoints access sensitive data and MUST have auth:

| File | Line | Endpoint | Status |
|------|------|----------|--------|
| `admin/MediaApprovalDashboard.tsx` | 82 | `/api/admin/media/upload` | ✅ HAS AUTH |
| `admin/MediaApprovalDashboard.tsx` | 124 | `/api/admin/media/approve` | ✅ HAS AUTH |
| `admin/MediaApprovalDashboard.tsx` | 156 | `/api/admin/media/approve` | ✅ HAS AUTH |
| `admin/MediaApprovalDashboard.tsx` | 639 | `/api/admin/media/upload` | ✅ HAS AUTH |
| `admin/FlaggedQuestionsDashboard.tsx` | 100 | `/api/questions/flags` | ✅ HAS AUTH |
| `admin/FlaggedQuestionsDashboard.tsx` | 162 | `/api/questions/flag/.../resolve` | ✅ HAS AUTH |
| `admin/QuestionPerformanceDashboard.tsx` | 77 | `/api/questions/performance` | ✅ HAS AUTH |
| `admin/QuestionCurationPanel.tsx` | 47 | `/api/questions/pool?mode=curation` | ✅ HAS AUTH |
| `admin/QuestionCurationPanel.tsx` | 81 | `/api/questions/curate` | ✅ HAS AUTH |
| `admin/ContentEditor.tsx` | 126 | `/api/admin/generate-draft` | ⚠️ NEEDS REVIEW |

---

## ⚠️ HIGH: User-Specific Endpoints (Likely Need Auth)

| File | Line | Endpoint | Status |
|------|------|----------|--------|
| `dashboard/RetentionWidget.tsx` | 40 | `/api/srs/stats` | ⚠️ NEEDS REVIEW |
| `dashboard/GapAnalysisDashboard.tsx` | 192 | `/api/analytics/performance-deltas` | ⚠️ NEEDS REVIEW |
| `analytics/AnalyticsDashboard.tsx` | 45 | `/api/user/stability-trend` | ⚠️ NEEDS REVIEW |
| `social/StudyGroupDashboard.tsx` | 69 | `/api/social/groups` | ⚠️ NEEDS REVIEW |
| `social/StudyGroupDashboard.tsx` | 93 | `/api/social/leaderboard` | ⚠️ NEEDS REVIEW |
| `social/StudyGroupDashboard.tsx` | 118 | `/api/social/groups` | ⚠️ NEEDS REVIEW |
| `social/StudyGroupDashboard.tsx` | 148 | `/api/social/groups/join` | ⚠️ NEEDS REVIEW |
| `modes/SmartReviewMode.tsx` | 46 | `/api/drills/smart-review` | ⚠️ NEEDS REVIEW |
| `modes/SmartReviewMode.tsx` | 90 | `/api/drills/submit-review` | ⚠️ NEEDS REVIEW |

---

## 📋 MEDIUM: Drill/Mode Endpoints (Check API Requirements)

These may or may not require auth depending on API design:

| File | Line | Endpoint | Status |
|------|------|----------|--------|
| `drill/SystemDrillSession.tsx` | 81 | `/api/questions/system-drill` | ⚠️ CHECK |
| `drill/PharmacologyDrillSession.tsx` | 82 | `/api/questions/pharmacology-drill` | ⚠️ CHECK |
| `drill/DrillSetup.tsx` | 96 | `/api/conditions` | ⚠️ CHECK |
| `drill/EnhancedFeedbackPanel.tsx` | 101 | `/api/drills/related-content` | ⚠️ CHECK |
| `drill/recall/RapidRecallDrill.tsx` | 69 | (dynamic) | ⚠️ CHECK |
| `modes/CodeBlueSpeedMode.tsx` | 49 | `/api/drills/code-blue` | ⚠️ CHECK |
| `modes/FluidElectrolyteMode.tsx` | 80 | `/api/drills/fluids` | ⚠️ CHECK |
| `modes/GrandRoundsMode.tsx` | 109 | `/api/grand-rounds/system/` | ⚠️ CHECK |
| `modes/GrandRoundsMode.tsx` | 235 | `/api/grand-rounds/submit` | ⚠️ CHECK |
| `modes/CramMode.tsx` | 189 | `/api/conditions/high-yield` | ⚠️ CHECK |
| `modes/DdxTrainer.tsx` | 23 | DDX generate endpoint | ⚠️ CHECK |
| `modes/AntibioticMode.tsx` | 52 | `/api/drills/antibiotics` | ⚠️ CHECK |

---

## ℹ️ LOW: Public Endpoints (May Not Need Auth)

| File | Line | Endpoint | Status |
|------|------|----------|--------|
| `conditions/ConditionPreviewGrid.tsx` | 32 | (dynamic API URL) | 🔍 VERIFY |
| `CommandPalette.tsx` | 109 | (dynamic) | 🔍 VERIFY |
| `ConditionDetailModal.tsx` | 123 | `/api/conditions/.../extended` | 🔍 VERIFY |
| `library/ContextWidget.tsx` | 29 | (dynamic) | 🔍 VERIFY |
| `library/ClinicalReferenceLibrary.tsx` | 161 | `/api/drugs` | 🔍 VERIFY |
| `dashboard/DashboardPage.tsx` | 40 | (dynamic) | 🔍 VERIFY |

---

## ✅ FIXED

| File | Line | Endpoint | Status |
|------|------|----------|--------|
| `toolkit/ClinicalLibrary.tsx` | 54 | `/api/content/library` | ✅ FIXED (commit 3f16e80) |

---

## Recommended Fix Pattern

For each component that needs auth, apply this pattern:

```tsx
import { useAuth } from '@clerk/clerk-react';

// Inside component:
const { getToken, isSignedIn } = useAuth();

// In fetch function:
if (!isSignedIn) {
  setError('Please sign in to access this feature');
  return;
}

const token = await getToken();
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  },
});
```

---

## Next Steps

1. **Priority 1:** Fix all CRITICAL admin endpoints
2. **Priority 2:** Fix HIGH user-specific endpoints  
3. **Priority 3:** Audit each API endpoint to determine if auth is required
4. **Priority 4:** Add E2E tests for authenticated routes

---

## API Auth Requirements Reference

Check `functions/api/_shared/auth.ts` for endpoints that call `authenticateRequest()`.

Run this to find which APIs require auth:
```bash
grep -rn "authenticateRequest" --include="*.ts" functions/api/ | grep -v "_shared"
```
