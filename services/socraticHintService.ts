/**
 * Socratic Hint Service
 * 
 * Provides AI-powered hints that guide learners toward the answer
 * without giving it away. Uses Gemini Flash for low-latency responses.
 * 
 * Pedagogical Approach:
 * - Never reveal the correct answer
 * - Guide thinking with leading questions
 * - Reference clinical reasoning patterns
 * - Adapt hint depth based on request count
 */

import type { Question } from '../types';

export interface SocraticHint {
  hint: string;
  hintLevel: number; // 1-3, increasing specificity
  thinkingPrompt: string; // A question to prompt reflection
}

export interface HintRequestOptions {
  question: Question;
  selectedAnswer?: number; // If they've already selected something
  previousHints?: SocraticHint[];
  hintLevel?: number; // 1 = vague, 2 = moderate, 3 = strong
}

const HINT_LEVEL_DESCRIPTIONS = {
  1: 'very subtle, broad clinical reasoning question',
  2: 'moderate guidance pointing toward relevant clinical concepts',
  3: 'strong hint that narrows down the answer without revealing it',
};

/**
 * Generate a Socratic hint for a given question
 */
export async function generateSocraticHint(options: HintRequestOptions): Promise<SocraticHint> {
  const { question, selectedAnswer, previousHints = [], hintLevel = 1 } = options;

  const previousHintText = previousHints.length > 0
    ? `\n\nPrevious hints given:\n${previousHints.map((h, i) => `${i + 1}. ${h.hint}`).join('\n')}`
    : '';

  const selectedAnswerText = selectedAnswer !== undefined
    ? `\n\nThe student has currently selected answer choice ${selectedAnswer + 1}: "${question.options[selectedAnswer]}"`
    : '';

  const prompt = `You are a medical educator using the Socratic method. A PA student is stuck on a question and needs guidance WITHOUT being given the answer.

QUESTION:
${question.question}

ANSWER CHOICES:
${question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORRECT ANSWER INDEX: ${question.correctAnswerIndex + 1} (DO NOT REVEAL THIS)

Topic: ${question.topic}
Condition: ${question.condition}
${selectedAnswerText}
${previousHintText}

HINT LEVEL REQUESTED: ${hintLevel} (${HINT_LEVEL_DESCRIPTIONS[hintLevel as keyof typeof HINT_LEVEL_DESCRIPTIONS]})

Generate a Socratic hint that:
1. Does NOT reveal the correct answer
2. Guides the student's clinical reasoning
3. References relevant pathophysiology, buzzwords, or clinical patterns
4. Asks a thought-provoking follow-up question
5. Is appropriate for the requested hint level

Respond in this exact JSON format:
{
  "hint": "Your guiding hint here (2-3 sentences max)",
  "thinkingPrompt": "A question to prompt their reflection"
}`;

  try {
    const response = await fetch('/geminiProxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: 'flash', // Use Flash for low latency
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hint generation failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse the response
    let parsed: { hint: string; thinkingPrompt: string };
    try {
      // Handle both raw JSON and markdown-wrapped JSON
      const textContent = typeof data === 'string' ? data : data.text || JSON.stringify(data);
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // Fallback if parsing fails
      parsed = {
        hint: 'Think about the key clinical features mentioned in the question stem. What patterns do they suggest?',
        thinkingPrompt: 'What diagnosis would you consider first, and why?',
      };
    }

    return {
      hint: parsed.hint,
      hintLevel,
      thinkingPrompt: parsed.thinkingPrompt,
    };
  } catch (error) {
    console.error('Socratic hint generation error:', error);
    
    // Return a generic fallback hint
    return getFallbackHint(question, hintLevel);
  }
}

/**
 * Generate a fallback hint without AI (for offline or error cases)
 */
function getFallbackHint(question: Question, hintLevel: number): SocraticHint {
  const hints: Record<number, SocraticHint> = {
    1: {
      hint: `Consider the key presenting symptoms and what they suggest about the underlying pathophysiology.`,
      hintLevel: 1,
      thinkingPrompt: `What organ system is most likely affected based on the clinical presentation?`,
    },
    2: {
      hint: `This question relates to ${question.topic}. Think about the classic presentation patterns for conditions in this category.`,
      hintLevel: 2,
      thinkingPrompt: `What are the "buzzwords" or pathognomonic findings you associate with ${question.condition || 'this condition'}?`,
    },
    3: {
      hint: `Focus on ${question.condition || 'the condition'}. The answer relates to either diagnosis, management, or a key clinical feature that distinguishes it from similar conditions.`,
      hintLevel: 3,
      thinkingPrompt: `If you had to explain the most important distinguishing feature of this condition to a colleague, what would it be?`,
    },
  };

  return hints[hintLevel] || hints[1];
}

/**
 * Check if hints are available (requires network)
 */
export function areHintsAvailable(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Rate limit helper - tracks hint requests per session
 */
const hintCounts = new Map<string, number>();

export function getHintCount(questionId: string): number {
  return hintCounts.get(questionId) || 0;
}

export function incrementHintCount(questionId: string): number {
  const current = getHintCount(questionId);
  const newCount = current + 1;
  hintCounts.set(questionId, newCount);
  return newCount;
}

export function resetHintCount(questionId: string): void {
  hintCounts.delete(questionId);
}

export function clearAllHintCounts(): void {
  hintCounts.clear();
}
