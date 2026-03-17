# Hybrid Content Engine: "The Brain"

The Hybrid Content Engine solves the latency, cost, and quality control issues of pure AI generation by implementing a smart caching and staging system that builds a valuable asset library over time.

## Overview

The system consists of four main components:

1. **Staging Lake Architecture** (Task 108) - Quality control gateway
2. **No-Repeat Logic** (Task 109) - Smart question delivery
3. **Vignette Permutation Storage** (Task 111) - Dynamic question generation
4. **Pearl Harvester** (Task 112) - Clinical knowledge extraction

## Architecture Components

### 1. The "Staging Lake" Architecture (Task 108)

**Problem Solved:** Prevent low-quality AI-generated questions from reaching users immediately.

**How It Works:**

- AI generates questions → saved to `StagingQuestion` table (not shown to users)
- Secondary cheaper AI model (GPT-3.5-Turbo / Gemini-1.5-Flash) runs adequacy checks
- Checks: correct answer exists, explanation > 50 words, no medical inaccuracies
- Auto-promotion: Pass → move to `PreGeneratedQuestion` (live pool)
- Failed questions → Discarded or Flagged for Human Review

**Benefits:**

- Quality control before user-facing
- Reduced costs (cheaper model for validation)
- Human review only for edge cases

**API Endpoints:**

```bash
# Save question to staging
POST /api/questions/staging
Body: { questionData: {...} }

# Run adequacy check
POST /api/questions/staging/:id/check

# Process staging queue (batch)
POST /api/questions/staging/process
Body: { limit: 10 }

# Get staging statistics
GET /api/questions/staging/stats
```

**Usage Example:**

```typescript
import { saveToStaging, processStagingQueue } from './services/stagingQuestionService';

// Generate and stage a question
const aiGeneratedQuestion = {
  type: 'mcq',
  question: '...',
  correctAnswer: 'A',
  explanation: { rationale: '...' },
  system: 'CV',
};
await saveToStaging(aiGeneratedQuestion);

// Run batch processing (can be scheduled)
const results = await processStagingQueue(50);
console.log(`Promoted: ${results.filter((r) => r.status === 'promoted').length}`);
```

### 2. "Infinite" No-Repeat Logic (Task 109)

**Problem Solved:** Users seeing the same questions repeatedly, expensive AI generation on every request.

**How It Works:**

1. User requests "Cardiology" questions
2. System queries: `SELECT * FROM PreGeneratedQuestion WHERE system = 'CV' AND id NOT IN (UserQuestionHistory)`
3. **ONLY if query returns 0 results** → trigger expensive AI generation
4. Every question shown is recorded in `UserQuestionHistory`

**Benefits:**

- Users never see the same question twice
- AI generation only as fallback (cost reduction)
- Builds "Golden Repository" of vetted questions over time

**API Endpoints:**

```bash
# Get questions with no-repeat logic
POST /api/questions/no-repeat
Body: { userId, filter: { system, difficulty }, limit: 10 }

# Record question as seen
POST /api/questions/history
Body: { userId, questionId, metadata: { questionType, system, wasCorrect } }

# Get repository statistics
GET /api/questions/repository/stats
```

**Usage Example:**

```typescript
import { getQuestionsWithNoRepeat, recordQuestionSeen } from './services/noRepeatService';

// Fetch unseen questions
const result = await getQuestionsWithNoRepeat(
  'user-123',
  {
    system: 'CV',
    difficulty: 'medium',
  },
  10
);

if (result.needsGeneration) {
  console.log(`Need to generate ${result.generationNeeded} more questions`);
}

// After showing questions to user
for (const question of result.questions) {
  await recordQuestionSeen('user-123', question.id, {
    questionType: question.questionType,
    system: question.system,
    wasCorrect: true,
  });
}
```

**The "Golden Repository" (Task 110):**

- Every good question becomes a permanent asset in your database
- Over time: 50,000+ vetted questions
- Benefit: Stop paying OpenAI for every quiz, drastically reducing costs while increasing speed

### 3. "Vignette Permutation" Storage (Task 111)

**Problem Solved:** Users can still see the "same" question even with different wording. Storage inefficiency.

**How It Works:**

- Store question "seeds" with variable slots instead of full text
- Example seed:

```json
{
  "corePathology": "Appendicitis",
  "variables": {
    "Age": [10, 25, 60],
    "Sex": ["Male", "Female"],
    "Presentation": ["Classic", "Retrocecal"],
    "Vitals": ["Stable", "Septic"]
  },
  "template": "A {{Age}}-year-old {{Sex}} presents with RLQ pain. Presentation is {{Presentation}}. Vitals show {{Vitals}} hemodynamics."
}
```

- Runtime: randomly pick variables to assemble unique question
- Total permutations: 3 × 2 × 2 × 2 = 24 unique questions from one seed!

**Benefits:**

- Users never see exact same text twice
- Storage efficiency (1 seed = many questions)
- Easy to update (modify seed, all variants update)

**API Endpoints:**

```bash
# Create question seed
POST /api/questions/seeds
Body: { conditionId, questionType, corePathology, variables, template, correctAnswer, explanation, distractors, difficulty, system? }

# Assemble question from seed
GET /api/questions/seeds/:id/assemble

# Assemble multiple questions with filter
POST /api/questions/seeds/assemble
Body: { filter: { system, difficulty }, count: 10 }

# Get seed statistics
GET /api/questions/seeds/stats
```

**Usage Example:**

```typescript
import { createQuestionSeed, assembleQuestionFromSeed } from './services/questionSeedService';

// Create a seed
const seed = await createQuestionSeed({
  conditionId: 'appendicitis',
  questionType: 'vignette',
  system: 'GI',
  corePathology: 'Appendicitis',
  variables: {
    Age: [10, 25, 60],
    Presentation: ['Classic', 'Retrocecal'],
    Vitals: ['Stable', 'Septic'],
  },
  template:
    'A {{Age}}-year-old presents with RLQ pain. The presentation is {{Presentation}}. Vital signs show {{Vitals}} hemodynamics. What is the most likely diagnosis?',
  correctAnswer: 'Acute appendicitis',
  explanation: 'Appendicitis typically presents with...',
  distractors: ['Cholecystitis', 'Diverticulitis', 'Mesenteric ischemia'],
  difficulty: 'medium',
});

// Generate unique instances
const question1 = await assembleQuestionFromSeed(seed.id);
// Result: "A 10-year-old presents with RLQ pain. The presentation is Classic. Vital signs show Stable hemodynamics."

const question2 = await assembleQuestionFromSeed(seed.id);
// Result: "A 60-year-old presents with RLQ pain. The presentation is Retrocecal. Vital signs show Septic hemodynamics."
```

### 4. The "Pearl" Harvester (Task 112)

**Problem Solved:** Students want quick review of key takeaways without re-taking full quizzes.

**How It Works:**

- Extract 1-sentence "Clinical Pearl" from every question explanation using AI
- Store in separate `ClinicalPearl` table
- Features:
  - "Daily Pearl" widget: Show random pearl each day
  - "Review My Pearls": Browse pearls from questions you've taken
  - "Favorite Pearls": Mark useful pearls with personal notes

**Benefits:**

- Quick review mechanism (flashcard-like)
- High-yield facts extraction
- Personalized study aids

**API Endpoints:**

```bash
# Extract pearl from explanation
POST /api/pearls/extract
Body: { questionId, explanation, metadata: { conditionId, system } }

# Get daily pearl
GET /api/pearls/daily?userId=user-123

# Get user's pearls (from questions they've taken)
GET /api/pearls/user/:userId?limit=20

# Get favorite pearls
GET /api/pearls/user/:userId/favorites

# Mark pearl as useful
POST /api/pearls/:pearlId/useful
Body: { userId, notes: "Important for exam!" }

# Search pearls
POST /api/pearls/search
Body: { keywords, system, category, tags }

# Get pearl statistics
GET /api/pearls/stats
```

**Usage Example:**

```typescript
import { createClinicalPearl, getDailyPearl, getUserPearls } from './services/clinicalPearlService';

// Extract pearl from question
const pearl = await createClinicalPearl('question-123', 'Full explanation text here...', {
  conditionId: 'mi',
  system: 'CV',
  difficulty: 'medium',
});

console.log(pearl.pearlText);
// Output: "ST-elevation in leads II, III, aVF indicates inferior wall MI requiring emergent PCI."

// Daily pearl widget
const dailyPearl = await getDailyPearl('user-123');
console.log(`Today's Pearl: ${dailyPearl.pearlText}`);

// Review my pearls
const myPearls = await getUserPearls('user-123', 20);
console.log(`You have ${myPearls.length} pearls from questions you've answered`);
```

## Database Schema

### New Tables

**StagingQuestion**

- Holds AI-generated questions before quality approval
- Tracks adequacy check results (pass/fail/flagged)

**UserQuestionHistory**

- Records every question a user has ever seen
- Enables no-repeat logic and "seen" tracking

**QuestionSeed**

- Stores question templates with variable slots
- Enables runtime permutation generation

**ClinicalPearl**

- Stores extracted clinical takeaways
- Tracks view counts and usefulness votes

**UserPearl**

- Links users to pearls they've viewed
- Stores personal notes and favorites

## Cost & Performance Benefits

### Before Hybrid Content Engine:

- Every quiz request → AI generation (slow, expensive)
- No quality control → bad questions reach users
- Users see repeated questions
- Cost: ~$0.02 per question × 1000 questions/day = **$20/day = $7,300/year**

### After Hybrid Content Engine:

- First 30 days: Building the repository (AI generation with staging)
- After 30 days: 90% of questions from database (instant, free)
- 10% AI generation for new content
- Cost reduction: **$7,300 → $730/year (90% savings)**
- Speed improvement: **2-5 seconds → 50ms (40-100x faster)**
- Quality: All questions vetted before reaching users

## Implementation Roadmap

1. **Week 1:** Deploy staging architecture
   - Set up background job to process staging queue
   - Configure cheaper AI model for adequacy checks
2. **Week 2:** Implement no-repeat logic
   - Integrate with existing quiz flow
   - Start building golden repository
3. **Week 3:** Add question seeds
   - Create seed templates for top 50 conditions
   - Integrate seed assembly into question fetching
4. **Week 4:** Deploy pearl harvester
   - Add "Daily Pearl" widget to dashboard
   - Create "Review My Pearls" page

## Monitoring & Maintenance

### Key Metrics to Track:

- Staging queue size and processing rate
- Question promotion rate (pass/fail/flagged)
- Golden repository size and growth rate
- Cache hit rate (questions from DB vs. AI generation)
- Cost per question (trending down over time)
- Average question delivery latency

### Scheduled Jobs:

```bash
# Process staging queue every 15 minutes
*/15 * * * * curl -X POST http://localhost:3001/api/questions/staging/process

# Generate questions for low-inventory topics (nightly)
0 2 * * * node scripts/generateQuestionsForLowInventory.js

# Extract pearls from new questions (nightly)
0 3 * * * node scripts/extractPearlsFromNewQuestions.js
```

## API Quick Reference

All endpoints return JSON with format:

```json
{
  "success": true,
  "data": {...},
  "error": "Error message if success is false"
}
```

### Staging Lake (Task 108)

- `POST /api/questions/staging` - Save question to staging
- `POST /api/questions/staging/:id/check` - Run adequacy check
- `POST /api/questions/staging/process` - Process staging queue
- `GET /api/questions/staging/stats` - Get staging statistics

### No-Repeat Logic (Task 109)

- `POST /api/questions/no-repeat` - Get unseen questions
- `POST /api/questions/history` - Record question seen
- `GET /api/questions/repository/stats` - Get repository stats

### Question Seeds (Task 111)

- `POST /api/questions/seeds` - Create question seed
- `GET /api/questions/seeds/:id/assemble` - Assemble from seed
- `POST /api/questions/seeds/assemble` - Assemble multiple
- `GET /api/questions/seeds/stats` - Get seed statistics

### Clinical Pearls (Task 112)

- `POST /api/pearls/extract` - Extract pearl from explanation
- `GET /api/pearls/daily` - Get daily pearl
- `GET /api/pearls/user/:userId` - Get user's pearls
- `GET /api/pearls/user/:userId/favorites` - Get favorites
- `POST /api/pearls/:pearlId/useful` - Mark as useful
- `POST /api/pearls/search` - Search pearls
- `GET /api/pearls/stats` - Get pearl statistics

## Security Considerations

1. **Rate Limiting:** All endpoints are rate-limited (100 requests per 15 minutes)
2. **Authentication:** User IDs should be validated from authenticated sessions
3. **Data Sanitization:** All inputs are sanitized to prevent injection attacks
4. **Database Access:** Prisma ORM prevents SQL injection
5. **API Keys:** Never expose GEMINI_API_KEY to client (server-side only)

## Support & Troubleshooting

**Issue:** Staging queue backing up

- **Solution:** Increase `processStagingQueue` frequency or batch size

**Issue:** AI generation still happening frequently

- **Solution:** Create more question seeds for high-traffic topics

**Issue:** Questions not passing adequacy check

- **Solution:** Review flagged questions, adjust AI prompts

**Issue:** Users reporting repeated questions

- **Solution:** Verify `recordQuestionSeen` is being called after each question

## Conclusion

The Hybrid Content Engine transforms PANaCEa from an expensive, slow AI-generation system into a fast, cost-effective platform with a growing asset library. Over time, you build a proprietary bank of 50,000+ vetted questions, drastically reducing operating costs while increasing speed and quality.

**Key Takeaway:** You're not just building a quiz platform—you're building a valuable medical education asset that grows more valuable every day.
