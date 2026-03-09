#!/usr/bin/env npx tsx

import { findPdfsForTerm } from './file-discovery';

async function test() {
  const term = 'Urinary Retention';
  const system = 'GU';
  console.log(`Testing "${term}" with system "${system}"...`);
  const pdfs = await findPdfsForTerm(term, 10, system);
  console.log(`Found ${pdfs.length} PDF(s):`);
  pdfs.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  if (pdfs.length === 0) {
    console.log('No PDFs found even with fallback.');
  }
}

test().catch(console.error);