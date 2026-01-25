// Client-safe ContrastiveSet interface (structural typing, no Prisma import)
interface ContrastiveSetLike {
  symptom: string;
  distinguishers: Record<string, string[]> | unknown;
}

export interface GeneratedContrastiveQuestion {
  vignette: string;
  keyDistinguishers: string[];
  whyNotOthers: { [otherCondition: string]: string };
}

export function buildContrastivePrompt(
  set: ContrastiveSetLike,
  targetCondition: string,
  otherConditions: string[]
): string {
  const distinguishers = set.distinguishers as Record<string, string[]>;
  const targetDistinguishers = distinguishers[targetCondition];

  return `
Generate a clinical vignette for a CONTRASTIVE LEARNING drill.

SYMPTOM: ${set.symptom}
TARGET CONDITION: ${targetCondition}
OTHER CONDITIONS IN SET: ${otherConditions.join(', ')}

Requirements:
1. The vignette MUST include 2-3 KEY DISTINGUISHING FEATURES that make ${targetCondition} the clear answer.
2. The distinguishing features should be UNIQUE to ${targetCondition} and NOT present in the other conditions.
3. Include subtle "red herrings" that might initially suggest other conditions, but include a definitive rule-out or rule-in for the target.
4. The question should test the learner's ability to DISCRIMINATE between similar presentations.
5. Do NOT mention the condition name in the vignette.

Distinguishing features for ${targetCondition} (use these):
${JSON.stringify(targetDistinguishers)}

Return ONLY valid JSON in the following format:
{
  "vignette": "The clinical scenario text...",
  "keyDistinguishers": ["Feature 1", "Feature 2"],
  "whyNotOthers": {
    "Other Condition 1": "Reason why it is excluded...",
    "Other Condition 2": "Reason why it is excluded..."
  }
}
`;
}
