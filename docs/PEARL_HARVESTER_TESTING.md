# Pearl Harvester Testing Guide

## Quick Start Testing

### 1. Generate Questions to Harvest Pearls

The Pearl Harvester automatically extracts pearls when questions are generated via Gemini.

**Option A: Manual Question Generation (Development)**

```bash
# Start dev servers
npm run dev:all

# In browser, navigate to any drill mode that generates questions:
# - Grand Rounds Mode → Select a system → Generate questions
# - Daily Challenge → Generate questions
# - Main Session → Select conditions → Generate questions
```

**Option B: Programmatic Generation (Scripts)**

```typescript
// scripts/test-pearl-harvester.ts
import { getQuestionBatch } from '../services/questionService';

const settings = {
  system: 'CARDIO',
  count: 10,
  difficulty: 'SAME',
  conditions: [],
};

// This will automatically harvest pearls
const questions = await getQuestionBatch(settings, async () => 'mock-token');

console.log('Generated questions and harvested pearls!');
```

### 2. Check Pearl Extraction in Console

After generating questions, check browser console for:

```
[Pearl Harvester] Saved 3 pearls for acute-coronary-syndrome
[Pearl Harvester] Saved 2 pearls for heart-failure
[Pearl Harvester] Saved 4 pearls for atrial-fibrillation
```

### 3. Query Pearls via API

**Get pearls for a specific condition:**

```bash
# Using curl (replace {TOKEN} with your Clerk JWT)
curl -H "Authorization: Bearer {TOKEN}" \
  "https://your-app.pages.dev/api/conditions/pearls?conditionId=acute-coronary-syndrome"
```

**Get random pearls for a system:**

```bash
curl -H "Authorization: Bearer {TOKEN}" \
  "https://your-app.pages.dev/api/conditions/pearls?system=CARDIO&random=true"
```

### 4. Test Rapid Recall with Pearls

1. Navigate to Rapid Recall mode
2. Pass a system prop: `<RapidRecallDrill system="CARDIO" />`
3. Check console for: `[RapidRecallDrill] Loaded 47 pearl questions for CARDIO`
4. Play the drill and verify pearl questions appear with "Clinical Pearl" badge
5. Verify fallback to buzzwords if no pearls available

## Database Verification

### Check Pearls in Database

**Using Prisma Studio:**

```bash
npm run db:studio

# Navigate to MedicalContent table
# Click on a condition record
# Expand "content" JSONB field
# Look for "pearls" array
```

**Using SQL:**

```sql
-- Count conditions with pearls
SELECT COUNT(*)
FROM "MedicalContent"
WHERE content::jsonb ? 'pearls';

-- View pearls for a specific condition
SELECT name, content::jsonb->'pearls' as pearls
FROM "MedicalContent"
WHERE id = 'acute-coronary-syndrome';

-- View all pearls across all conditions
SELECT
  name,
  jsonb_array_length(content::jsonb->'pearls') as pearl_count,
  content::jsonb->'pearls' as pearls
FROM "MedicalContent"
WHERE content::jsonb ? 'pearls'
ORDER BY pearl_count DESC;
```

## Expected Pearl Extraction Examples

### Example 1: Key Takeaway Pattern

**Input Rationale:**

```
The patient presents with chest pain radiating to the jaw. This is classic for ACS.

Key Takeaway: STEMI requires emergent reperfusion within 90 minutes of first medical contact. Look for ST elevation in contiguous leads to localize the infarct territory.

Treatment includes aspirin, clopidogrel, and PCI.
```

**Extracted Pearls:**

```json
[
  "STEMI requires emergent reperfusion within 90 minutes of first medical contact",
  "Look for ST elevation in contiguous leads to localize the infarct territory"
]
```

### Example 2: Clinical Keywords Pattern

**Input Rationale:**

```
Heart failure with reduced ejection fraction is diagnosed when LVEF < 40%.

The gold standard diagnostic test is echocardiography with Doppler assessment. First-line therapy includes ACE inhibitors and beta-blockers to reduce mortality.

Classic presentation includes dyspnea on exertion, orthopnea, and peripheral edema.
```

**Extracted Pearls:**

```json
[
  "The gold standard diagnostic test is echocardiography with Doppler assessment",
  "First-line therapy includes ACE inhibitors and beta-blockers to reduce mortality",
  "Classic presentation includes dyspnea on exertion, orthopnea, and peripheral edema"
]
```

### Example 3: Bullet Points Pattern

**Input Rationale:**

```
Atrial fibrillation management requires anticoagulation based on CHA2DS2-VASc score:

• CHA2DS2-VASc ≥2 in men or ≥3 in women warrants anticoagulation
• Rate control targets resting HR 60-80 bpm (lenient) or <80 bpm (strict)
• Rhythm control with cardioversion if AF onset <48 hours or after TEE
• Consider catheter ablation for symptomatic AF refractory to medications

The goal is to prevent thromboembolic stroke.
```

**Extracted Pearls:**

```json
[
  "CHA2DS2-VASc ≥2 in men or ≥3 in women warrants anticoagulation",
  "Rate control targets resting HR 60-80 bpm (lenient) or <80 bpm (strict)",
  "Rhythm control with cardioversion if AF onset <48 hours or after TEE",
  "Consider catheter ablation for symptomatic AF refractory to medications"
]
```

## Troubleshooting

### Issue: No pearls extracted

**Check:**

1. Is the rationale field populated in the generated question?
2. Does the rationale contain keywords like "Key Takeaway", "Clinical Pearl", "gold standard", "first-line", etc.?
3. Check console for extraction logs

**Solution:**

- Refine Gemini prompts to include "Include a 'Key Takeaway' section with high-yield clinical pearls"
- Adjust regex patterns in `extractPearlsFromRationale()` if needed

### Issue: Low-quality pearls extracted

**Check:**

1. Are pearls too short (<20 chars)?
2. Are pearls too long (>300 chars)?
3. Do pearls contain generic phrases like "the correct answer is"?

**Solution:**

- Adjust length filters in `extractPearlsFromRationale()`
- Add more blacklist phrases to filter out generic content
- Consider implementing AI-powered quality scoring

### Issue: RapidRecallDrill not using pearls

**Check:**

1. Is the `system` prop passed to `<RapidRecallDrill system="CARDIO" />`?
2. Are pearls available for the specified system?
3. Check network tab for 401/403 errors on `/api/conditions/pearls`

**Solution:**

- Ensure Clerk authentication is working
- Generate questions for the system to populate pearls
- Verify `usePearls` state is true in component

### Issue: Duplicate pearls

**Check:**

1. Are pearls being deduplicated in POST endpoint?
2. Is case-insensitive comparison working?

**Solution:**

- Verify `uniquePearls` logic in `/api/conditions/pearls` POST handler
- Check that `toLowerCase().trim()` is applied during deduplication

## Performance Metrics

### Expected Benchmarks

**Pearl Extraction:**

- Time per question: <10ms
- Success rate: 60-80% of questions yield 1+ pearls
- Average pearls per question: 2-4

**Pearl Retrieval:**

- Database query: 10-50ms
- Gemini API call: 500-2000ms
- Speedup: 10-200x

**Cost Savings:**

- Gemini call: ~$0.001 per question
- Database query: ~$0.0000001 per query
- Savings: 99.99% per cached pearl question

### Monitoring Queries

```sql
-- Pearl extraction rate (conditions with pearls / total conditions)
SELECT
  COUNT(CASE WHEN content::jsonb ? 'pearls' THEN 1 END) as with_pearls,
  COUNT(*) as total_conditions,
  ROUND(100.0 * COUNT(CASE WHEN content::jsonb ? 'pearls' THEN 1 END) / COUNT(*), 2) as extraction_rate_pct
FROM "MedicalContent";

-- Average pearls per condition
SELECT
  AVG(jsonb_array_length(content::jsonb->'pearls')) as avg_pearls,
  MIN(jsonb_array_length(content::jsonb->'pearls')) as min_pearls,
  MAX(jsonb_array_length(content::jsonb->'pearls')) as max_pearls
FROM "MedicalContent"
WHERE content::jsonb ? 'pearls';

-- Total pearls across all systems
SELECT
  system,
  COUNT(*) as conditions_with_pearls,
  SUM(jsonb_array_length(content::jsonb->'pearls')) as total_pearls
FROM "MedicalContent"
WHERE content::jsonb ? 'pearls'
GROUP BY system
ORDER BY total_pearls DESC;
```

## Next Steps After Testing

1. **Monitor Extraction Quality**: Review extracted pearls in Prisma Studio after 50+ questions
2. **Adjust Regex Patterns**: Fine-tune extraction based on quality feedback
3. **Populate All Systems**: Run batch question generation for all 14 PANCE systems
4. **Build Admin Dashboard**: Create UI for pearl curation and quality control
5. **Track Cost Savings**: Monitor Gemini API usage before/after pearl implementation

## Success Criteria

✅ Pearls extracted from >60% of generated questions
✅ Pearls stored in MedicalContent.content.pearls JSONB field
✅ RapidRecallDrill loads pearls first, falls back to buzzwords
✅ Pearl questions display "Clinical Pearl" badge
✅ Console logs confirm pearl harvesting and loading
✅ Database queries return cached pearls
✅ No TypeScript/runtime errors

## Contact

If you encounter issues or have questions:

- Check `docs/PEARL_HARVESTER_PATTERN.md` for detailed documentation
- Review console logs for extraction/loading feedback
- Verify database schema includes pearls field
- Ensure API authentication is working correctly
