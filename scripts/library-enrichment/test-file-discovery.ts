#!/usr/bin/env npx tsx

import { findPdfsForTerm, pickBestCandidate } from './file-discovery';

async function test() {
  const terms = ['Diabetes', 'Urinary Retention', 'Hypertension', 'Asthma'];
  for (const term of terms) {
    console.log(`\n🔍 Searching for "${term}"...`);
    const pdfs = await findPdfsForTerm(term, 5);
    console.log(`   Found ${pdfs.length} PDF(s):`);
    pdfs.forEach((p, i) => console.log(`     ${i + 1}. ${p}`));
    const best = pickBestCandidate(pdfs, term);
    console.log(`   Best candidate: ${best || '(none)'}`);
  }
}

test().catch(console.error);