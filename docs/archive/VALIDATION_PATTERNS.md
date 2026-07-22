# PANaCEa API Validation Patterns

**Created:** 2026-01-15  
**Sprint:** Security Hardening Sprint 2  
**Purpose:** Standardized input validation across all API endpoints

---

## Overview

This document establishes validation patterns for the PANaCEa API to prevent:

- SQL Injection attacks
- XSS (Cross-Site Scripting)
- DoS (Denial of Service) via oversized payloads
- Type confusion vulnerabilities
- Malformed data causing runtime errors

## Architecture

```
Request → Zod Validation → Business Logic → Response
          ↓ (if fails)
          Error Response (400)
```

---

## Quick Start

### 1. Import the Validator

```typescript
import { validateQuestionGeneration, enforcePayloadSize } from '../_shared/zodSchemas';
```

### 2. Validate Request Body

```typescript
export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    // Parse and validate
    const body = await request.json();
    enforcePayloadSize(body, 'question generation');
    const validated = validateQuestionGeneration(body);

    // validated is now type-safe and guaranteed valid
    const result = await generateQuestion(validated);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error.message.startsWith('Validation failed')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error; // Let error handler catch other errors
  }
}
```

---

## Available Validators

| Validator                    | Schema                     | Use Case                      |
| ---------------------------- | -------------------------- | ----------------------------- |
| `validateQuestionGeneration` | `questionGenerationSchema` | `/api/questions/generate`     |
| `validateReviewSubmission`   | `reviewSubmissionSchema`   | `/api/drills/submit-review`   |
| `validateSessionGeneration`  | `sessionGenerationSchema`  | `/api/study/session/generate` |
| `validatePerformanceMetrics` | `performanceMetricsSchema` | `/api/analytics/*`            |
| `validateContentEnrichment`  | `contentEnrichmentSchema`  | `/api/admin/enrich-condition` |
| `validateQuestionFlag`       | `questionFlagSchema`       | `/api/questions/flag`         |

---

## Common Patterns

### Pattern 1: Simple Validation

```typescript
import { validateQuestionGeneration } from '../_shared/zodSchemas';

export async function onRequestPost(context: any) {
  const body = await context.request.json();
  const validated = validateQuestionGeneration(body);
  // validated.conditionId, validated.questionType are now type-safe
}
```

### Pattern 2: Validation with Custom Error Handling

```typescript
import { validateSchema, questionGenerationSchema } from '../_shared/zodSchemas';

export async function onRequestPost(context: any) {
  const body = await context.request.json();
  const result = validateSchema(questionGenerationSchema, body, 'QuestionAPI');

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        details: result.errors,
      }),
      { status: 400 }
    );
  }

  const validated = result.data;
  // Proceed with validated data
}
```

### Pattern 3: Payload Size Enforcement

```typescript
import { enforcePayloadSize } from '../_shared/zodSchemas';

export async function onRequestPost(context: any) {
  const body = await context.request.json();

  // Throws error if > 1MB
  enforcePayloadSize(body, 'user preferences');

  // Proceed with validation
}
```

### Pattern 4: Multiple Validations

```typescript
import { validateSessionGeneration, enforcePayloadSize, uuidSchema } from '../_shared/zodSchemas';

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const body = await request.json();

  // Check payload size
  enforcePayloadSize(body);

  // Validate main body
  const validated = validateSessionGeneration(body);

  // Additional param validation
  const userId = uuidSchema.parse(validated.userId);

  // All inputs now validated
}
```

---

## Schema Reference

### Question Generation

```typescript
{
  conditionId: "acute-mi",           // lowercase-with-hyphens
  questionType: "clinical_vignette", // enum validation
  difficulty: "medium",              // optional: easy/medium/hard
  includeImages: false,              // boolean
  systemOverride: "CARDIOVASCULAR"   // optional: NCCPA system
}
```

**Constraints:**

- `conditionId`: 2-100 chars, lowercase alphanumeric + hyphens only
- Unknown fields are rejected (`.strict()`)

### Review Submission

```typescript
{
  questionId: "550e8400-e29b-41d4-a716-446655440000", // UUID
  userAnswer: "C",                                     // 1-5000 chars
  rating: 3,                                           // 1, 2, 3, or 4 (FSRS)
  timeSpentMs: 45000,                                  // 0-3600000 (1 hour max)
  confidence: 85                                       // optional: 0-100
}
```

**Constraints:**

- `rating`: Must be exactly 1, 2, 3, or 4 (not 0 or 5)
- `timeSpentMs`: Max 1 hour to prevent bogus data
- `userAnswer`: Cannot be empty

### Session Generation

```typescript
{
  userId: "550e8400-e29b-41d4-a716-446655440000",
  sessionType: "rapid_review",  // enum: rapid_review, deep_learning, exam_simulation, custom
  preferences: {
    questionCount: 20,           // 5-100
    systems: ["CARDIOVASCULAR"], // optional: array of NCCPA systems
    excludeRecent: true,
    targetDifficulty: "adaptive", // adaptive, easy, medium, hard
    focusWeakAreas: true
  }
}
```

---

## Error Handling

### Validation Errors Return 400

```typescript
try {
  const validated = validateQuestionGeneration(body);
} catch (error) {
  if (error.message.startsWith('Validation failed')) {
    // Return 400 Bad Request
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      { status: 400 }
    );
  }
  // Other errors → 500
  throw error;
}
```

### Error Message Format

```
Validation failed: conditionId: Condition ID must be at least 2 characters; questionType: Invalid question type
```

---

## Security Best Practices

### ✅ DO

1. **Always validate at the API boundary**

   ```typescript
   const validated = validateQuestionGeneration(await request.json());
   ```

2. **Enforce payload size limits**

   ```typescript
   enforcePayloadSize(body, 'endpoint-name');
   ```

3. **Use strict schemas** (reject unknown fields)

   ```typescript
   .strict() // Already applied to all schemas
   ```

4. **Validate nested data**

   ```typescript
   const userId = uuidSchema.parse(validated.userId);
   ```

5. **Return clear error messages**
   ```typescript
   return new Response(JSON.stringify({ error: error.message }), { status: 400 });
   ```

### ❌ DON'T

1. **Don't trust client data**

   ```typescript
   // BAD
   const questionType = request.body.questionType; // Unvalidated!

   // GOOD
   const validated = validateQuestionGeneration(request.body);
   const questionType = validated.questionType; // Type-safe & validated
   ```

2. **Don't skip validation "just this once"**

   ```typescript
   // BAD
   if (isInternalRequest) {
     // Skip validation
   }

   // GOOD
   // Always validate, even for internal requests
   ```

3. **Don't create custom validators**

   ```typescript
   // BAD
   if (body.rating < 1 || body.rating > 4) { ... }

   // GOOD
   const validated = validateReviewSubmission(body);
   ```

4. **Don't ignore payload size**

   ```typescript
   // BAD
   const body = await request.json(); // Could be 100MB!

   // GOOD
   const body = await request.json();
   enforcePayloadSize(body);
   ```

---

## Testing Validation

### Unit Test Example

```typescript
import { validateQuestionGeneration } from '../zodSchemas';

describe('questionGenerationSchema', () => {
  it('accepts valid input', () => {
    const valid = {
      conditionId: 'acute-mi',
      questionType: 'clinical_vignette',
    };
    expect(() => validateQuestionGeneration(valid)).not.toThrow();
  });

  it('rejects invalid condition ID', () => {
    const invalid = {
      conditionId: 'Invalid_ID', // Uppercase not allowed
      questionType: 'clinical_vignette',
    };
    expect(() => validateQuestionGeneration(invalid)).toThrow('Validation failed');
  });

  it('rejects unknown fields', () => {
    const withExtra = {
      conditionId: 'acute-mi',
      questionType: 'clinical_vignette',
      hackerField: 'malicious',
    };
    expect(() => validateQuestionGeneration(withExtra)).toThrow();
  });
});
```

---

## Migration Guide

### Before (Unsafe)

```typescript
export async function onRequestPost(context: any) {
  const body = await context.request.json();

  // No validation!
  const conditionId = body.conditionId;
  const questionType = body.questionType;

  // Runtime errors possible
  const result = await generateQuestion(conditionId, questionType);
  return new Response(JSON.stringify(result));
}
```

### After (Secure)

```typescript
import { validateQuestionGeneration, enforcePayloadSize } from '../_shared/zodSchemas';
import { secureLog } from '../_shared/secureLogger';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    enforcePayloadSize(body, 'question generation');

    const validated = validateQuestionGeneration(body);

    const result = await generateQuestion(validated);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error.message.startsWith('Validation failed')) {
      secureLog('warn', 'Validation error', { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
      });
    }
    secureLog('error', 'Question generation failed', { error });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
```

---

## Extending Validation

### Adding a New Schema

1. Define the schema in `zodSchemas.ts`:

   ```typescript
   export const myNewSchema = z
     .object({
       field1: z.string().min(1).max(100),
       field2: z.number().int().positive(),
     })
     .strict();
   ```

2. Create a validator:

   ```typescript
   export const validateMyNew = createValidator(myNewSchema);
   ```

3. Document it in this file

4. Use it in your endpoint:
   ```typescript
   import { validateMyNew } from '../_shared/zodSchemas';
   const validated = validateMyNew(body);
   ```

---

## Performance Considerations

- **Zod validation is fast**: ~0.1-1ms for typical requests
- **Payload size check**: Negligible overhead (~0.01ms)
- **Trade-off**: Small performance cost for massive security gain

---

## Checklist: Securing an Endpoint

- [ ] Import validator from `zodSchemas.ts`
- [ ] Enforce payload size with `enforcePayloadSize()`
- [ ] Validate request body with appropriate validator
- [ ] Use validated data (type-safe) in business logic
- [ ] Return 400 for validation errors
- [ ] Log validation failures with `secureLog()`
- [ ] Add unit tests for validation
- [ ] Update this documentation if new schemas added

---

## Next Steps (Sprint 3)

1. Create API middleware pattern (`withValidation`, `withAuth`)
2. Apply validation to remaining 200+ endpoints
3. Add integration tests for validated endpoints
4. Monitor validation error rates in production

---

## References

- **Zod Documentation:** https://zod.dev
- **Security Sprint 1 Report:** `/docs/SECURITY_SPRINT_1_REPORT.md`
- **Schema File:** `/functions/api/_shared/zodSchemas.ts`
- **OWASP Input Validation:** https://owasp.org/www-project-proactive-controls/v3/en/c5-validate-inputs
