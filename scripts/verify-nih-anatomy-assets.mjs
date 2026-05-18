#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const modelDir = path.join(publicDir, 'models', 'nih');
const thumbnailDir = path.join(publicDir, 'thumbnails', 'nih');
const registryPath = path.join(root, 'lib', 'anatomy', 'nihAnatomyAssets.ts');
const distServiceWorkerPath = path.join(root, 'dist', 'sw.js');

const requiredMetaFields = [
  'id',
  'title',
  'sourceEntry',
  'source',
  'sourceUrl',
  'downloadUrl',
  'thumbnailUrl',
  'license',
  'author',
  'institution',
  'modelFile',
  'thumbnailFile',
  'modelBytes',
  'thumbnailBytes',
  'modelSha256',
  'thumbnailSha256',
  'accessedDate',
  'safeUse',
];

const allowedLicenses = new Set(['Public Domain', 'CC-BY 4.0']);
const maxSingleModelBytes = 8 * 1024 * 1024;
const maxTotalModelBytes = 32 * 1024 * 1024;

const failures = [];
const warnings = [];

const addFailure = (message) => failures.push(message);
const addWarning = (message) => warnings.push(message);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const sha256 = (filePath) => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const publicPathToFile = (publicPath) => {
  if (!publicPath.startsWith('/')) {
    addFailure(`Public path must start with "/": ${publicPath}`);
    return path.join(publicDir, publicPath);
  }

  return path.join(publicDir, publicPath.slice(1));
};

const hasGlbMagic = (filePath) => {
  const handle = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    fs.readSync(handle, buffer, 0, 4, 0);
    return buffer.toString('utf8') === 'glTF';
  } finally {
    fs.closeSync(handle);
  }
};

const hasPngMagic = (filePath) => {
  const handle = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8);
    fs.readSync(handle, buffer, 0, 8, 0);
    return buffer.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  } finally {
    fs.closeSync(handle);
  }
};

if (!fs.existsSync(modelDir)) addFailure(`Missing model directory: ${modelDir}`);
if (!fs.existsSync(thumbnailDir)) addFailure(`Missing thumbnail directory: ${thumbnailDir}`);
if (!fs.existsSync(registryPath)) addFailure(`Missing registry: ${registryPath}`);

const registryText = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';
const metaFiles = fs.existsSync(modelDir)
  ? fs
      .readdirSync(modelDir)
      .filter((fileName) => fileName.endsWith('.meta.json'))
      .sort()
  : [];

const seenIds = new Set();
const seenEntries = new Set();
const referencedModelFiles = new Set();
const referencedThumbnailFiles = new Set();

for (const metaFileName of metaFiles) {
  const metaPath = path.join(modelDir, metaFileName);
  let meta;

  try {
    meta = readJson(metaPath);
  } catch (error) {
    addFailure(
      `${metaFileName}: invalid JSON (${error instanceof Error ? error.message : 'unknown error'})`
    );
    continue;
  }

  for (const field of requiredMetaFields) {
    if (meta[field] === undefined || meta[field] === null || meta[field] === '') {
      addFailure(`${metaFileName}: missing required field "${field}"`);
    }
  }

  if (seenIds.has(meta.id)) addFailure(`${metaFileName}: duplicate id "${meta.id}"`);
  seenIds.add(meta.id);

  if (seenEntries.has(meta.sourceEntry)) {
    addFailure(`${metaFileName}: duplicate sourceEntry "${meta.sourceEntry}"`);
  }
  seenEntries.add(meta.sourceEntry);

  if (!/^3DPX-\d{6}$/.test(meta.sourceEntry ?? '')) {
    addFailure(`${metaFileName}: invalid NIH sourceEntry "${meta.sourceEntry}"`);
  }

  if (meta.source !== 'NIH 3D') addFailure(`${metaFileName}: source must be "NIH 3D"`);
  if (!allowedLicenses.has(meta.license)) {
    addFailure(`${metaFileName}: unsupported license "${meta.license}"`);
  }

  if (
    meta.license === 'CC-BY 4.0' &&
    !String(meta.licenseUrl ?? '').includes('creativecommons.org/licenses/by/4.0')
  ) {
    addFailure(`${metaFileName}: CC-BY asset must include licenseUrl`);
  }

  if (!String(meta.sourceUrl ?? '').startsWith(`https://3d.nih.gov/entries/${meta.sourceEntry}`)) {
    addFailure(`${metaFileName}: sourceUrl must point to the NIH entry`);
  }

  if (!String(meta.downloadUrl ?? '').startsWith('https://3d.nih.gov/api/download?')) {
    addFailure(`${metaFileName}: downloadUrl must use the NIH download API`);
  }

  if (!String(meta.thumbnailUrl ?? '').startsWith('https://3d.nih.gov/api/submissions/')) {
    addFailure(`${metaFileName}: thumbnailUrl must use the NIH submissions API`);
  }

  if (!Array.isArray(meta.safeUse) || meta.safeUse.length < 2) {
    addFailure(`${metaFileName}: safeUse must include at least two guardrails`);
  } else {
    const safeUseText = meta.safeUse.join(' ');
    if (!safeUseText.includes('educational')) {
      addFailure(`${metaFileName}: safeUse must frame the asset as educational`);
    }
    if (!safeUseText.includes('Do not present as patient-specific anatomy')) {
      addFailure(`${metaFileName}: safeUse must prohibit patient-specific presentation`);
    }
  }

  const modelPath = publicPathToFile(meta.modelFile ?? '');
  const thumbnailPath = publicPathToFile(meta.thumbnailFile ?? '');
  referencedModelFiles.add(modelPath);
  referencedThumbnailFiles.add(thumbnailPath);

  if (!fs.existsSync(modelPath)) {
    addFailure(`${metaFileName}: missing model file ${meta.modelFile}`);
  } else {
    const stats = fs.statSync(modelPath);
    if (stats.size > maxSingleModelBytes) {
      addFailure(
        `${metaFileName}: model file is ${(stats.size / (1024 * 1024)).toFixed(2)} MB; keep individual atlas GLBs under ${(maxSingleModelBytes / (1024 * 1024)).toFixed(0)} MB`
      );
    }
    if (stats.size !== meta.modelBytes) {
      addFailure(`${metaFileName}: modelBytes ${meta.modelBytes} does not match ${stats.size}`);
    }
    if (sha256(modelPath) !== meta.modelSha256) {
      addFailure(`${metaFileName}: modelSha256 mismatch`);
    }
    if (!hasGlbMagic(modelPath)) {
      addFailure(`${metaFileName}: model file is not a GLB binary`);
    }
  }

  if (!fs.existsSync(thumbnailPath)) {
    addFailure(`${metaFileName}: missing thumbnail file ${meta.thumbnailFile}`);
  } else {
    const stats = fs.statSync(thumbnailPath);
    if (stats.size !== meta.thumbnailBytes) {
      addFailure(
        `${metaFileName}: thumbnailBytes ${meta.thumbnailBytes} does not match ${stats.size}`
      );
    }
    if (sha256(thumbnailPath) !== meta.thumbnailSha256) {
      addFailure(`${metaFileName}: thumbnailSha256 mismatch`);
    }
    if (!hasPngMagic(thumbnailPath)) {
      addFailure(`${metaFileName}: thumbnail file is not a PNG`);
    }
  }

  for (const registryNeedle of [
    `id: '${meta.id}'`,
    `modelId: '${meta.sourceEntry}'`,
    `modelUrl: '${meta.modelFile}'`,
    `thumbnailUrl: '${meta.thumbnailFile}'`,
    `assetSizeBytes: ${meta.modelBytes}`,
  ]) {
    if (!registryText.includes(registryNeedle)) {
      addFailure(`${metaFileName}: registry missing ${registryNeedle}`);
    }
  }
}

const glbFiles = fs.existsSync(modelDir)
  ? fs
      .readdirSync(modelDir)
      .filter((fileName) => fileName.endsWith('.glb'))
      .map((fileName) => path.join(modelDir, fileName))
  : [];

for (const glbPath of glbFiles) {
  if (!referencedModelFiles.has(glbPath)) {
    addFailure(`Unreferenced GLB file: ${path.relative(root, glbPath)}`);
  }
}

const pngFiles = fs.existsSync(thumbnailDir)
  ? fs
      .readdirSync(thumbnailDir)
      .filter((fileName) => fileName.endsWith('.png'))
      .map((fileName) => path.join(thumbnailDir, fileName))
  : [];

for (const pngPath of pngFiles) {
  if (!referencedThumbnailFiles.has(pngPath)) {
    addFailure(`Unreferenced thumbnail file: ${path.relative(root, pngPath)}`);
  }
}

if (fs.existsSync(distServiceWorkerPath)) {
  const swText = fs.readFileSync(distServiceWorkerPath, 'utf8');
  if (swText.includes('.glb')) {
    addFailure('dist/sw.js includes .glb assets; 3D scenes must remain out of precache');
  }
} else {
  addWarning('dist/sw.js not found; run a production build to verify precache exclusion');
}

const totalModelBytes = metaFiles.reduce((total, metaFileName) => {
  const meta = readJson(path.join(modelDir, metaFileName));
  return total + Number(meta.modelBytes || 0);
}, 0);

if (totalModelBytes > maxTotalModelBytes) {
  addFailure(
    `Total NIH atlas model payload is ${(totalModelBytes / (1024 * 1024)).toFixed(2)} MB; keep checked-in GLBs under ${(maxTotalModelBytes / (1024 * 1024)).toFixed(0)} MB total`
  );
}

const summary = {
  assets: metaFiles.length,
  totalModelMB: Number((totalModelBytes / (1024 * 1024)).toFixed(2)),
  maxSingleModelMB: Number((maxSingleModelBytes / (1024 * 1024)).toFixed(2)),
  maxTotalModelMB: Number((maxTotalModelBytes / (1024 * 1024)).toFixed(2)),
  warnings: warnings.length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length > 0) {
  console.error('\nFailures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
