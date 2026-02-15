/**
 * Test Google Drive connection for Content Refinery.
 *
 * Usage:
 *   npx tsx scripts/refinery/test-drive-connection.ts --folderId=YOUR_FOLDER_ID
 *
 * Requires: GOOGLE_SERVICE_ACCOUNT_JSON (base64-encoded service account JSON) in .env
 */

import { config } from 'dotenv';
config();

import { listFilesInFolder } from '../../lib/google-drive';

function parseArgs(): { folderId: string | null } {
  const arg = process.argv.find((a) => a.startsWith('--folderId='));
  if (!arg) return { folderId: null };
  return { folderId: arg.split('=')[1]?.trim() ?? null };
}

async function main(): Promise<void> {
  const { folderId } = parseArgs();
  if (!folderId) {
    console.error(
      'Usage: npx tsx scripts/refinery/test-drive-connection.ts --folderId=YOUR_FOLDER_ID'
    );
    process.exit(1);
  }

  console.log('Testing Google Drive connection…');
  console.log('Folder ID:', folderId);

  try {
    const files = await listFilesInFolder(folderId);
    console.log(`\nFound ${files.length} file(s). First 5:\n`);
    files.slice(0, 5).forEach((f, i) => {
      console.log(`${i + 1}. ${f.name}`);
      console.log(`   id: ${f.id}`);
      console.log(`   mimeType: ${f.mimeType ?? '—'}`);
      console.log(`   webViewLink: ${f.webViewLink ?? '—'}`);
      console.log('');
    });
    if (files.length === 0) {
      console.log('(No files in this folder, or folder not shared with the service account.)');
    }
    console.log('Connection OK.');
  } catch (e) {
    console.error('Connection failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
