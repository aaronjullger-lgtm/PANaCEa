# AI-Vetted Content Pipeline (CI/CD)

## Overview
This document outlines the automated content verification pipeline that uses a secondary LLM to verify generated medical content before it's saved to the database.

## Architecture

```
┌─────────────────┐
│ Content Creator │ (Primary LLM - Gemini)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Verification   │ (Secondary LLM - Claude/GPT-4)
│     Queue       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Verifier      │
│    Service      │
└────────┬────────┘
         │
         ├──── Pass ────► Database
         │
         └──── Fail ────► Review Queue
```

## Pipeline Stages

### Stage 1: Content Generation
Primary LLM generates medical questions, explanations, or vignettes.

**Input:**
- Topic/condition ID
- Difficulty level
- Question type
- Context (related conditions, differential diagnoses)

**Output:**
- Generated question/content
- Metadata (system, subcategory, condition)

### Stage 2: Verification Queue
Content is queued for verification before database insertion.

**Queue Structure:**
```typescript
interface VerificationQueueItem {
  id: string;
  contentType: 'question' | 'explanation' | 'vignette';
  content: any;
  generatedBy: 'gemini-pro' | string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}
```

### Stage 3: Secondary LLM Verification
A different LLM model verifies the content for accuracy.

**Verification Criteria:**
1. **Medical Accuracy**: Dosages, mechanisms, indications correct
2. **Clinical Relevance**: Appropriate for PANCE-level
3. **Logical Consistency**: No contradictions in explanation
4. **Safety**: No dangerous recommendations
5. **Completeness**: All required fields present

**Verification Prompt Template:**
```
You are a medical content auditor. Review the following PANCE-level medical question for:

1. Factual accuracy (especially dosages, medications, lab values)
2. Clinical appropriateness for PA certification exam
3. Logical consistency in explanation
4. Safety concerns or dangerous recommendations
5. Completeness of required information

Content to verify:
[CONTENT]

Respond with:
{
  "approved": true/false,
  "confidence": 0-100,
  "issues": [
    {
      "field": "dosage",
      "severity": "critical|major|minor",
      "description": "Issue description",
      "suggestion": "Corrected value"
    }
  ],
  "recommendation": "approve|reject|manual_review"
}
```

### Stage 4: Decision Logic

```typescript
async function processVerification(
  content: any,
  verificationResult: VerificationResult
): Promise<void> {
  // Critical issues = automatic rejection
  const criticalIssues = verificationResult.issues.filter(
    i => i.severity === 'critical'
  );
  
  if (criticalIssues.length > 0) {
    await sendToReviewQueue(content, verificationResult);
    await notifyAdmins('critical_content_issue', { content, issues: criticalIssues });
    return;
  }
  
  // High confidence + no major issues = auto-approve
  if (verificationResult.confidence > 90 && verificationResult.approved) {
    await saveToDatabase(content);
    await logVerification(content.id, 'approved_auto', verificationResult);
    return;
  }
  
  // Medium confidence or minor issues = manual review
  if (verificationResult.confidence > 70) {
    await sendToReviewQueue(content, verificationResult);
    await logVerification(content.id, 'pending_review', verificationResult);
    return;
  }
  
  // Low confidence = reject
  await logVerification(content.id, 'rejected', verificationResult);
  await notifyContentTeam('low_quality_content', { content, verificationResult });
}
```

### Stage 5: Manual Review Queue
Content that requires human review is stored with verification details.

**Review Interface Shows:**
- Original generated content
- Verification results with highlighted issues
- Side-by-side comparison with suggested corrections
- Accept/Reject/Edit options

## Implementation (Node.js/TypeScript)

```typescript
// scripts/verifyContent.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

interface VerificationResult {
  approved: boolean;
  confidence: number;
  issues: Array<{
    field: string;
    severity: 'critical' | 'major' | 'minor';
    description: string;
    suggestion?: string;
  }>;
  recommendation: 'approve' | 'reject' | 'manual_review';
}

/**
 * Verify content using secondary LLM
 */
export async function verifyMedicalContent(
  content: any,
  contentType: 'question' | 'explanation' | 'vignette'
): Promise<VerificationResult> {
  // Use Claude (Anthropic) as secondary verifier
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = buildVerificationPrompt(content, contentType);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const verificationText = response.content[0].text;
    const result: VerificationResult = JSON.parse(verificationText);
    
    return result;
  } catch (error) {
    console.error('Verification failed:', error);
    // On verification failure, send to manual review
    return {
      approved: false,
      confidence: 0,
      issues: [{
        field: 'verification',
        severity: 'critical',
        description: 'Verification service failed'
      }],
      recommendation: 'manual_review'
    };
  }
}

/**
 * Build verification prompt based on content type
 */
function buildVerificationPrompt(
  content: any,
  contentType: string
): string {
  const basePrompt = `You are a medical content auditor specializing in PA certification exam content. 
Review the following ${contentType} for accuracy and safety.`;

  let specificInstructions = '';
  
  if (contentType === 'question') {
    specificInstructions = `
Focus on:
- Correct answer accuracy
- Dosage accuracy (if medications mentioned)
- Lab value ranges
- Clinical decision-making logic
- Distractor plausibility
    `;
  } else if (contentType === 'explanation') {
    specificInstructions = `
Focus on:
- Mechanism accuracy
- Drug interactions
- Contraindications
- Side effect profiles
    `;
  }

  return `${basePrompt}\n${specificInstructions}\n\nContent:\n${JSON.stringify(content, null, 2)}`;
}

/**
 * Process verification result
 */
export async function processVerificationResult(
  contentId: string,
  content: any,
  result: VerificationResult
): Promise<void> {
  const criticalIssues = result.issues.filter(i => i.severity === 'critical');
  
  if (criticalIssues.length > 0) {
    await sendToReviewQueue(contentId, content, result);
    return;
  }
  
  if (result.confidence > 90 && result.approved) {
    await saveToDatabase(content);
    return;
  }
  
  await sendToReviewQueue(contentId, content, result);
}

// Mock functions for demonstration
async function sendToReviewQueue(
  contentId: string,
  content: any,
  result: VerificationResult
): Promise<void> {
  console.log(`Sent to review queue: ${contentId}`);
}

async function saveToDatabase(content: any): Promise<void> {
  console.log('Saved to database:', content);
}
```

## GitHub Actions Workflow

```yaml
# .github/workflows/verify-content.yml

name: Content Verification Pipeline

on:
  push:
    paths:
      - 'generated-content/**'
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run content verification
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npm run verify:content
      
      - name: Upload verification report
        uses: actions/upload-artifact@v3
        with:
          name: verification-report
          path: reports/verification-*.json
      
      - name: Comment on PR if issues found
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Content verification found issues. Review the verification report artifact.'
            })
```

## Monitoring & Alerts

1. **Slack Notifications**: Critical issues trigger immediate alerts
2. **Dashboard**: Real-time verification statistics
3. **Audit Log**: Complete history of all verifications
4. **Performance Metrics**: Track verification accuracy over time

## Cost Optimization

- Batch verification requests
- Cache common verification patterns
- Use cheaper models for initial screening, expensive models for deep verification
- Rate limiting to control API costs

## Future Enhancements

1. **Ensemble Verification**: Use 3+ models and vote
2. **Human-in-the-Loop**: SMEs provide ground truth for model training
3. **Automated Correction**: Auto-fix minor issues based on suggestions
4. **Versioning**: Track content changes and reverification needs
