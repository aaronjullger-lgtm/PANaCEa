// Estimate a fair par time for a question based on length and assets.
// Includes a base decision buffer so short questions don't penalize deliberate thinkers.
// userSpeedFactor (optional): personalizes par time to user's reading/processing speed.
//   > 1.0 = user is faster than average → shorter par time
//   < 1.0 = user is slower → longer par time
//   Derived from userTimingProfileService. Default 1.0 (population baseline).
export function calculateParTime(question: any, userSpeedFactor: number = 1.0): number {
  const stem =
    typeof question?.stem === 'string'
      ? question.stem
      : question?.question || question?.vignette || question?.text || '';

  const choiceTexts: string[] = Array.isArray(question?.choices)
    ? question.choices.map((c: any) => (typeof c === 'string' ? c : c?.text || c?.label || ''))
    : Array.isArray(question?.options)
      ? question.options.map((c: any) => (typeof c === 'string' ? c : c?.text || c?.label || ''))
      : [];

  const text = `${stem} ${choiceTexts.join(' ')}`.trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  let parSeconds = wordCount / 3; // ~3 words/sec (180 wpm)

  // Base decision buffer: accounts for cognitive processing, option comparison,
  // and deliberation time that is independent of reading speed. Without this,
  // a 15-word question gets only 10s par, making a 15-second deliberate answer
  // look "slow" (latency ratio 1.5 → Hard territory).
  const DECISION_BUFFER_SECONDS = 8;
  // Additional time per answer option for comparison
  const optionCount = choiceTexts.length || 4; // Default to 4 choices
  const SECONDS_PER_OPTION = 2;
  parSeconds += DECISION_BUFFER_SECONDS + optionCount * SECONDS_PER_OPTION;

  const imageUrl = question?.imageUrl || question?.image || question?.mediaUrl;
  const hasLabs = Boolean(
    question?.hasLabs || (question?.labs && question.labs.length > 0) || stem.includes('mmol/L')
  );

  if (imageUrl) parSeconds += 10; // Image review buffer
  if (hasLabs) parSeconds += 15; // Lab interpretation buffer

  // Apply user speed factor: divide par time by speed factor so faster users get
  // shorter par and slower users get longer par. The reading portion scales but
  // the decision buffer is speed-independent (cognitive, not reading).
  // Split: reading time = wordCount / 3, decision time = everything else
  const readingSeconds = wordCount / 3;
  const decisionSeconds = parSeconds - readingSeconds;
  const personalizedSeconds = (readingSeconds / Math.max(0.5, userSpeedFactor)) + decisionSeconds;

  return Math.max(personalizedSeconds, 15) * 1000; // ms, floor raised to 15s
}
