#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = ['components', 'hooks', 'lib'];
const extensions = new Set(['.ts', '.tsx']);

const ignoredPathParts = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}lib${path.sep}sdk${path.sep}`,
  `${path.sep}lib${path.sep}services${path.sep}medical-apis${path.sep}`,
  `${path.sep}lib${path.sep}evaluation${path.sep}`,
  `${path.sep}lib${path.sep}utils${path.sep}apiEnvelope`,
  `${path.sep}lib${path.sep}utils${path.sep}safeJsonResponse`,
];

const knownExternalOrRawClients = [
  'lib/gemini.ts',
  'lib/open-i.ts',
  'lib/search.ts',
  'lib/services/search/hybridSearch.ts',
  'lib/services/question/trialEnricher.ts',
  'lib/services/semanticValidationService.ts',
  'lib/utils/cachingStrategies.ts',
  'lib/utils/cachingStrategies.tsx',
  'lib/utils/errorHandlingUtils.ts',
  'lib/utils/streamingClient.ts',
  'lib/errors/apiErrorHandler.ts',
  'lib/fsrsOptimizerSidecar.ts',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function isIgnored(file) {
  const normalized = file.split(path.sep).join('/');
  if (knownExternalOrRawClients.includes(normalized)) return true;
  return ignoredPathParts.some((part) => file.includes(part));
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function hasInternalApiFetch(source) {
  return (
    /fetch\s*\(\s*['"`]\/api\//.test(source) ||
    /fetch\s*\(\s*(?:getApiEndpoint|buildApiUrl)\s*\(/.test(source) ||
    /fetch\s*\(\s*endpoint\b/.test(source)
  );
}

function hasRawJsonRead(source) {
  return /(?:await\s+)?(?:res|response)\.json\s*\(/.test(source);
}

function hasEnvelopeHandling(source) {
  return (
    source.includes('unwrapApiEnvelope') ||
    source.includes('getApiEnvelopeError') ||
    source.includes('createApiClient') ||
    source.includes('callApi(') ||
    source.includes('api.get<') ||
    source.includes('unwrapProfileResponse') ||
    source.includes('unwrapSyncResponse')
  );
}

const findings = [];

for (const scanRoot of scanRoots) {
  for (const file of walk(path.join(root, scanRoot))) {
    const rel = path.relative(root, file);
    if (isIgnored(rel)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (!hasInternalApiFetch(source) || !hasRawJsonRead(source) || hasEnvelopeHandling(source)) {
      continue;
    }

    const fetchMatch = source.match(/fetch\s*\(/);
    findings.push({
      file: rel,
      line: fetchMatch ? lineOf(source, fetchMatch.index ?? 0) : 1,
    });
  }
}

if (findings.length === 0) {
  console.log('No unaudited internal API JSON callers found.');
  process.exit(0);
}

console.log('Unaudited internal API JSON callers:');
for (const finding of findings) {
  console.log(`- ${finding.file}:${finding.line}`);
}

if (process.argv.includes('--fail-on-findings')) {
  process.exit(1);
}
