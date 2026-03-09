import { findPdfsForTerm } from './library-enrichment/file-discovery';

async function main() {
  console.log('Testing findPdfsForTerm for drug "indomethacin" with system DRUG...');
  const pdfs = await findPdfsForTerm('indomethacin', 10, 'DRUG');
  console.log('Found PDFs:', pdfs.length);
  pdfs.forEach(p => console.log(' -', p));
}

main().catch(console.error);