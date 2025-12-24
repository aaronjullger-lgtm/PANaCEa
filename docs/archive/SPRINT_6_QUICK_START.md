# Sprint 6 - Quick Start Guide

**Current Status**: Core infrastructure complete, drill modes pending

---

## What's Been Done ✅

1. **4 API Routes Created**
   - `/api/content/library` - Clinical library content
   - `/api/content/context-widgets` - Related pharm/physio
   - `/api/questions/system-drill` - System-specific questions
   - `/api/questions/pharmacology-drill` - Pharm questions

2. **3 UI Components Created**
   - `LibraryCard` - Content display
   - `ContextWidget` - Related info
   - `LibraryFilters` - Search/filter

3. **1 Component Refactored**
   - `ClinicalLibrary` - Now database-driven

4. **Build Passing** ✅

---

## What's Next ❌

### Task 1: Test API Endpoints (30 min)

```bash
# Set your auth token
export AUTH_TOKEN="your_clerk_token_here"

# Test library endpoint
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "https://studypanacea.com/api/content/library?system=CV&limit=5"

# Test context widget
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "https://studypanacea.com/api/content/context-widgets?conditionId=CONDITION_ID&type=pharm"

# Test system drill
curl -X POST -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"system":"CV","difficulty":"MEDIUM"}' \
  "https://studypanacea.com/api/questions/system-drill"

# Test pharmacology drill
curl -X POST -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"drugClass":"Beta Blockers","difficulty":"MEDIUM"}' \
  "https://studypanacea.com/api/questions/pharmacology-drill"
```

**Expected**: JSON responses with content/questions  
**If fails**: Check Cloudflare Functions logs

---

### Task 2: Refactor SystemDrillSession (1-2 hours)

**File**: `components/drill/SystemDrillSession.tsx`

**Changes Needed**:

1. Remove old import:
```typescript
// DELETE THIS
import { conditionDataLoader } from '../services/conditionDataLoader';
```

2. Add API function:
```typescript
const fetchSystemQuestion = async (system: string, difficulty?: string) => {
  const response = await fetch('/api/questions/system-drill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, difficulty }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch question');
  return response.json();
};
```

3. Update question loading:
```typescript
// IN handleSystemSelect or similar
const question = await fetchSystemQuestion(systemId, difficulty);
setCurrentQuestion(question);
```

4. Pass to QuizView (already there, just ensure data format matches)

**Test**: Select each system (CV, PULM, GI, etc.) and verify questions load

---

### Task 3: Create PharmacologyDrillSession (2-3 hours)

**File**: `components/drill/PharmacologyDrillSession.tsx` (NEW)

**Pattern**: Copy SystemDrillSession and modify:

1. **Change landing page**:
```typescript
<DrillLandingPage
  title="Pharmacology Drill"
  description="Master drug classes and mechanisms"
  icon={Pill}
  accentColor="green"
  // ...
/>
```

2. **Drug class selector** instead of system selector:
```typescript
const DRUG_CLASSES = [
  { id: 'beta-blockers', name: 'Beta Blockers', icon: Heart },
  { id: 'antibiotics', name: 'Antibiotics', icon: Shield },
  { id: 'antihypertensives', name: 'Antihypertensives', icon: Activity },
  // ... add more
];
```

3. **Fetch function**:
```typescript
const fetchPharmQuestion = async (drugClass?: string, difficulty?: string) => {
  const response = await fetch('/api/questions/pharmacology-drill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugClass, difficulty }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch question');
  return response.json();
};
```

4. **Export and wire up** in App.tsx or MenuView.tsx

**Test**: Select drug classes and verify questions load

---

### Task 4: Manual QA (1 hour)

**Clinical Library**:
- [ ] Open library
- [ ] Select different systems (CV, PULM, GI)
- [ ] Search for conditions ("diabetes", "pneumonia")
- [ ] Click condition card
- [ ] Verify LibraryCard displays all sections
- [ ] Verify Context Widgets load (pharm + physio)
- [ ] Click back button
- [ ] Try on mobile (Chrome DevTools)

**System Drill**:
- [ ] Select System Drill
- [ ] Choose CV system
- [ ] Verify question loads
- [ ] Answer question
- [ ] Verify rationale shows
- [ ] Try Next Question
- [ ] Test with different systems

**Pharmacology Drill**:
- [ ] Select Pharmacology Drill
- [ ] Choose drug class
- [ ] Verify question loads
- [ ] Answer question
- [ ] Verify drug-specific content shows
- [ ] Try Next Question
- [ ] Test with different classes

---

### Task 5: Error Handling (30 min)

**Test These Scenarios**:

1. **Network failure**: 
   - Disconnect WiFi mid-request
   - Should show friendly error message
   - Should have "Retry" button

2. **401 Unauthorized**:
   - Clear Clerk session/cookies
   - Should redirect to login or show auth error

3. **404 No Content**:
   - Query system with no questions (unlikely but test)
   - Should show "No questions available" message

4. **500 Server Error**:
   - (Hard to test, but verify error boundary works)

---

## Files Reference

### API Routes
- `functions/api/content/library.ts`
- `functions/api/content/context-widgets.ts`
- `functions/api/questions/system-drill.ts`
- `functions/api/questions/pharmacology-drill.ts`

### Components
- `components/library/LibraryCard.tsx`
- `components/library/ContextWidget.tsx`
- `components/library/LibraryFilters.tsx`
- `components/toolkit/ClinicalLibrary.tsx`
- `components/drill/SystemDrillSession.tsx` (to modify)
- `components/drill/PharmacologyDrillSession.tsx` (to create)

### Documentation
- `SPRINT_6_IMPLEMENTATION.md` - Detailed tracking
- `SPRINT_6_SUMMARY.md` - Executive summary
- `SPRINT_6_QUICK_START.md` - This guide

---

## Common Issues & Solutions

### Issue: API returns 401

**Solution**: Check Clerk authentication
```typescript
// Verify authenticateRequest is working
const { user, error } = await authenticateRequest(context);
console.log('User:', user, 'Error:', error);
```

### Issue: Context widgets don't load

**Solution**: Check conditionId format
```typescript
// Both formats should work
conditionId: selectedContent.conditionId || selected Content.id
```

### Issue: Questions not random enough

**Solution**: Use proper random skip
```typescript
const randomSkip = Math.floor(Math.random() * totalCount);
const question = await prisma.question.findFirst({
  where,
  skip: randomSkip,
  take: 1,
});
```

### Issue: LibraryCard shows raw JSON

**Solution**: Ensure data is properly formatted
```typescript
// Check renderContent function handles your data type
if (typeof content === 'string') {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
```

---

## Deployment Checklist

Before marking Sprint 6 complete:

- [ ] All API endpoints tested
- [ ] All components tested manually
- [ ] Mobile responsive verified
- [ ] Error handling tested
- [ ] Performance acceptable (<1s loads)
- [ ] Build passes (`npm run build`)
- [ ] No console errors in production
- [ ] Documentation updated
- [ ] Code committed to git
- [ ] Deployed to Cloudflare Pages

---

## Performance Targets

| Metric | Target | How to Test |
|--------|--------|-------------|
| Library load | <1s | Chrome DevTools Network tab |
| Context widget | <500ms | Network tab, filter by API call |
| Question fetch | <300ms | Network tab, filter by API call |
| Card render | <100ms | React DevTools Profiler |
| Search debounce | 300ms | Type and observe delay |

---

## Support Resources

**Documentation**:
- `DATABASE_FIRST_ARCHITECTURE.md` - Architecture overview
- `CLOUDFLARE_FUNCTIONS_GUIDE.md` - API patterns
- `SPRINT_5_COMPLETE.md` - Previous sprint reference

**Code Examples**:
- `QuizView.tsx` - Question fetching pattern
- `components/drill/SystemDrillSession.tsx` - Drill mode pattern
- `functions/api/questions/generate.ts` - Question generation example

**Getting Help**:
- Check Cloudflare Functions logs (dashboard)
- Use browser DevTools Console/Network
- Review Prisma schema for data structure
- Check this repo's GitHub issues

---

## Time Estimates

| Task | Estimate | Priority |
|------|----------|----------|
| Test API endpoints | 30 min | HIGH |
| Refactor SystemDrillSession | 1-2 hours | HIGH |
| Create PharmacologyDrillSession | 2-3 hours | HIGH |
| Manual QA | 1 hour | MEDIUM |
| Error handling | 30 min | MEDIUM |
| Performance testing | 30 min | LOW |

**Total**: 5-7 hours to complete Sprint 6

---

## Success Criteria

Sprint 6 is **DONE** when:

✅ All API endpoints work  
✅ Clinical Library browses all conditions  
✅ Context widgets show related content  
✅ System Drill works for all 13 systems  
✅ Pharmacology Drill works for major drug classes  
✅ No static imports in drill/library code  
✅ Mobile responsive  
✅ Build passes  
✅ QA complete  
✅ Deployed to production  

---

**Ready to continue?** Start with Task 1 (test API endpoints) and work through sequentially.

**Questions?** Check `SPRINT_6_IMPLEMENTATION.md` for detailed context.

**Stuck?** Review code examples in `QuizView.tsx` and existing drill modes.

---

**Created**: December 24, 2025  
**For**: Sprint 6 continuation  
**Estimated completion**: 5-7 hours of focused work
