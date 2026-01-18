// Estimate a fair par time for a question based on length and assets
export function calculateParTime(question: any): number {
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

  const imageUrl = question?.imageUrl || question?.image || question?.mediaUrl;
  const hasLabs = Boolean(
    question?.hasLabs || (question?.labs && question.labs.length > 0) || stem.includes('mmol/L')
  );

  if (imageUrl) parSeconds += 10; // Image review buffer
  if (hasLabs) parSeconds += 15; // Lab interpretation buffer

  return Math.max(parSeconds, 10) * 1000; // ms
}
