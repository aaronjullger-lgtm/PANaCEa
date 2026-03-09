/**
 * Refined emphasis fixing with lookahead/lookbehind to avoid over-correction.
 */

function fixEmphasisRefined2(text: string): string {
  let result = text;

  // Helper to avoid matching when extra asterisks present
  // Use negative lookahead/lookbehind where supported (ES2018)
  // Note: Node supports lookbehind.

  // 1. Fix ***text** (three start, two end) -> **text**
  // Ensure the two end asterisks are not followed by a third.
  result = result.replace(/\*\*\*([^*]+)\*\*(?!\*)/g, '**$1**');

  // 2. Fix **text*** (two start, three end) -> **text**
  // Ensure the three end asterisks are not followed by a fourth.
  result = result.replace(/\*\*([^*]+)\*\*\*(?!\*)/g, '**$1**');

  // 3. Fix **text* (missing closing asterisk)
  // Ensure the trailing * is not followed by another *
  result = result.replace(/\*\*([^*]+)\*(?!\*)/g, '**$1**');

  // 4. Fix *text** (missing opening asterisk)
  // Ensure the leading * is not preceded by * and the two end asterisks are not followed by *
  result = result.replace(/(?<!\*)\*([^*]+)\*\*(?!\*)/g, '**$1**');

  // 5. Fix __text_ (missing closing underscore)
  result = result.replace(/__([^_]+)_(?!_)/g, '__$1__');

  // 6. Fix _text__ (missing opening underscore)
  result = result.replace(/(?<!_) _([^_]+)__(?!_)/g, '__$1__');

  // 7. Preserve correct bold+italic ***text*** (already fine)
  // 8. Preserve correct bold **text** and italic *text* / _text_
  // 9. Preserve alternative bold __text__ (already fine)

  // 10. Optional: convert __bold__ to **bold** for consistency? We'll skip.

  return result;
}

const testCases = [
  // Already correct
  '**text**',
  '*text*',
  '_text_',
  '__text__',
  '***text***',
  '**_text_**',
  // Mismatched patterns
  '***text**',   // three start, two end
  '**text***',   // two start, three end
  '**text*',     // missing closing
  '*text**',     // missing opening
  '__text_',     // missing closing _
  '_text__',     // missing opening _
  // Potential over-correction cases
  '**text**',    // should stay same
  '***text***',  // should stay same
  '**_text_**',  // should stay same
  // Multiple occurrences
  '**text** and *italic*',
  '***text** and **text***',
  // Edge cases with asterisks inside text
  '**text*with*asterisk**', // contains asterisk inside
  '**text** **another**',
  // More complex
  '***text*** **bold**',
  '***text** and ***text**', // multiple mismatched
];

console.log('Testing refined emphasis fixing logic\n');
for (const input of testCases) {
  const output = fixEmphasisRefined2(input);
  console.log(`Input:  "${input}"`);
  console.log(`Output: "${output}"`);
  console.log(`Change? ${input !== output ? 'YES' : 'NO'}`);
  console.log('---');
}