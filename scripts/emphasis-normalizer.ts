/**
 * Normalize emphasis markers (asterisks and underscores) to correct Markdown syntax.
 * Rules:
 * - Bold: exactly two asterisks (**text**)
 * - Italic: exactly one asterisk (*text*) or one underscore (_text_)
 * - Bold+Italic: exactly three asterisks (***text***)
 * - Underscore bold: exactly two underscores (__text__) (alternative bold)
 * - If mismatched delimiter counts, normalize to the start count (or the minimum).
 * - Extra asterisks are trimmed.
 */

export function normalizeEmphasis(text: string): string {
  // Process asterisk-based emphasis
  let result = text.replace(/(\*+)([^*]+)(\*+)/g, (match, start, content, end) => {
    const startCount = start.length;
    const endCount = end.length;
    // Determine target delimiter count based on start count (prefer start)
    let targetCount = startCount;
    if (startCount >= 3 && endCount >= 3) {
      targetCount = 3; // bold+italic
    } else if (startCount >= 2 && endCount >= 2) {
      targetCount = 2; // bold
    } else if (startCount >= 1 && endCount >= 1) {
      targetCount = 1; // italic
    } else {
      // If one side has zero? shouldn't happen because regex requires at least one.
      targetCount = Math.min(startCount, endCount);
    }
    // If targetCount is more than 3, cap at 3 (unlikely)
    if (targetCount > 3) targetCount = 3;
    const delimiter = '*'.repeat(targetCount);
    return delimiter + content + delimiter;
  });

  // Process underscore-based emphasis (similar but keep underscore)
  result = result.replace(/(_+)([^_]+)(_+)/g, (match, start, content, end) => {
    const startCount = start.length;
    const endCount = end.length;
    // For underscores, we treat 1 as italic, 2 as bold, 3 as bold+italic (though not standard)
    let targetCount = startCount;
    if (startCount >= 3 && endCount >= 3) {
      targetCount = 3;
    } else if (startCount >= 2 && endCount >= 2) {
      targetCount = 2;
    } else if (startCount >= 1 && endCount >= 1) {
      targetCount = 1;
    } else {
      targetCount = Math.min(startCount, endCount);
    }
    if (targetCount > 3) targetCount = 3;
    const delimiter = '_'.repeat(targetCount);
    return delimiter + content + delimiter;
  });

  // Additionally, ensure that bold uses ** (not __) for consistency? We'll keep both.
  // Optional: convert __bold__ to **bold**.
  // result = result.replace(/__([^_]+)__/g, '**$1**');

  return result;
}

// Export only