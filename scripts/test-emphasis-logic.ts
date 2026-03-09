/**
 * Test emphasis fixing logic with sample strings.
 */

function fixEmphasisOld(text: string): string {
  let result = text;
  // Fix ***text** → **_text_**
  result = result.replace(/\*\*\*([^*]+)\*\*/g, '**_$1_**');
  // Fix **text* (missing closing *)
  result = result.replace(/\*\*([^*]+)\*/g, '**$1**');
  // Fix *text** (missing opening *)
  result = result.replace(/\*([^*]+)\*\*/g, '**$1**');
  // Fix __text_ (missing closing _)
  result = result.replace(/__([^_]+)_/g, '__$1__');
  // Fix _text__ (missing opening _)
  result = result.replace(/_([^_]+)__/g, '__$1__');
  return result;
}

function fixEmphasisRefined(text: string): string {
  let result = text;

  // 1. Fix mismatched triple-double asterisks: ***text** -> **text** (drop extra start asterisk)
  result = result.replace(/\*\*\*([^*]+)\*\*/g, '**$1**');

  // 2. Fix mismatched double-triple asterisks: **text*** -> **text** (drop extra end asterisk)
  result = result.replace(/\*\*([^*]+)\*\*\*/g, '**$1**');

  // 3. Fix missing closing asterisk: **text* -> **text**
  // Ensure the trailing * is not followed by another *
  result = result.replace(/\*\*([^*]+)\*(?!\*)/g, '**$1**');

  // 4. Fix missing opening asterisk: *text** -> **text**
  // Ensure the leading * is not preceded by *
  result = result.replace(/(?<!\*)\*([^*]+)\*\*/g, '**$1**');

  // 5. Fix mismatched underscores: __text_ -> __text__
  result = result.replace(/__([^_]+)_/g, '__$1__');

  // 6. Fix mismatched underscores: _text__ -> __text__
  result = result.replace(/_([^_]+)__/g, '__$1__');

  // 7. Preserve correct bold+italic ***text*** (do nothing)
  // 8. Preserve correct bold **text** and italic *text* / _text_

  // 9. Ensure bold uses ** (not __)?? We'll keep __ as alternative bold (maybe convert?)
  // Optional: convert __bold__ to **bold** for consistency.
  // We'll skip for now.

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
];

console.log('Testing emphasis fixing logic\n');
for (const input of testCases) {
  const oldOut = fixEmphasisOld(input);
  const newOut = fixEmphasisRefined(input);
  console.log(`Input:    "${input}"`);
  console.log(`Old:      "${oldOut}"`);
  console.log(`Refined:  "${newOut}"`);
  console.log(`Same? ${oldOut === newOut ? 'Yes' : 'No'}`);
  console.log('---');
}