/**
 * Comparison Generator Service
 * 
 * Uses Gemini AI to generate distinguishing feature comparison tables
 * for commonly confused medical conditions.
 * 
 * @architecture Edge-Compatible: Uses fetch API, no Node.js dependencies
 */

export interface ComparisonTable {
  conditions: {
    id: string;
    name: string;
  }[];
  features: ComparisonFeature[];
  summary: string;
  keyDistinguishers: string[];
}

export interface ComparisonFeature {
  category: 'clinical' | 'diagnostic' | 'treatment' | 'pathophysiology' | 'prognosis';
  feature: string;
  values: Record<string, string>; // conditionId -> value
  distinguishing: boolean; // Is this feature useful for distinguishing?
}

export interface GenerateComparisonOptions {
  correctConditionId: string;
  selectedConditionId: string;
  correctConditionName: string;
  selectedConditionName: string;
  apiKey: string;
}

/**
 * Generate a comparison table between two commonly confused conditions
 */
export async function generateComparison(
  options: GenerateComparisonOptions
): Promise<ComparisonTable | null> {
  const { correctConditionName, selectedConditionName, apiKey } = options;

  const prompt = buildComparisonPrompt(correctConditionName, selectedConditionName);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3, // Lower temperature for factual accuracy
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('No text in Gemini response');
      return null;
    }

    const parsed = JSON.parse(text);

    // Add condition IDs to the response
    return {
      ...parsed,
      conditions: [
        { id: options.correctConditionId, name: correctConditionName },
        { id: options.selectedConditionId, name: selectedConditionName },
      ],
    };
  } catch (error) {
    console.error('Failed to generate comparison:', error);
    return null;
  }
}

function buildComparisonPrompt(condition1: string, condition2: string): string {
  return `You are a medical education expert. Generate a detailed comparison table between two conditions that students commonly confuse.

**Condition 1:** ${condition1}
**Condition 2:** ${condition2}

Generate a JSON comparison with the following structure:

{
  "summary": "Brief 2-3 sentence explanation of why these conditions are commonly confused and how to distinguish them",
  "keyDistinguishers": ["Top 3 most important distinguishing features as bullet points"],
  "features": [
    {
      "category": "clinical" | "diagnostic" | "treatment" | "pathophysiology" | "prognosis",
      "feature": "Name of the feature (e.g., 'Chest Pain Character', 'ECG Findings')",
      "values": {
        "${condition1}": "How this feature presents in condition 1",
        "${condition2}": "How this feature presents in condition 2"
      },
      "distinguishing": true/false (whether this feature is useful for distinguishing)
    }
  ]
}

**Requirements:**
1. Include 8-12 features across all categories
2. Mark 3-5 features as "distinguishing" (most useful for differentiation)
3. Be concise but clinically accurate
4. Focus on practical, bedside-applicable features
5. Include at least one feature from each category if applicable

**Categories:**
- clinical: Signs, symptoms, presentation patterns
- diagnostic: Lab values, imaging findings, diagnostic criteria
- treatment: First-line therapy, management approaches
- pathophysiology: Underlying mechanisms
- prognosis: Expected outcomes, complications

Return ONLY valid JSON, no additional text.`;
}

/**
 * Batch generate comparisons for multiple confusion pairs
 */
export async function batchGenerateComparisons(
  pairs: Array<{
    correctConditionId: string;
    selectedConditionId: string;
    correctConditionName: string;
    selectedConditionName: string;
  }>,
  apiKey: string,
  delayMs = 1000 // Rate limiting
): Promise<Array<{ pairIndex: number; comparison: ComparisonTable | null }>> {
  const results: Array<{ pairIndex: number; comparison: ComparisonTable | null }> = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (!pair) {
      results.push({ pairIndex: i, comparison: null });
      continue;
    }
    const opts: GenerateComparisonOptions = {
      correctConditionId: pair.correctConditionId,
      selectedConditionId: pair.selectedConditionId,
      correctConditionName: pair.correctConditionName,
      selectedConditionName: pair.selectedConditionName,
      apiKey,
    };
    if (
      !opts.correctConditionId ||
      !opts.selectedConditionId ||
      !opts.correctConditionName ||
      !opts.selectedConditionName
    ) {
      results.push({ pairIndex: i, comparison: null });
      continue;
    }
    const comparison = await generateComparison(opts);
    results.push({ pairIndex: i, comparison });

    // Rate limiting delay
    if (i < pairs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
