#!/usr/bin/env node
/**
 * Ad-hoc full-impact axe scan (minor/moderate/serious/critical) against a running
 * preview, to surface a11y issues the CI gate (critical/serious only) doesn't fail on.
 * Usage: node scripts/qa/axe-all.mjs [baseUrl]  (default http://127.0.0.1:4173)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const routes = ['/', '/study', '/practice', '/progress'];
const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const browser = await chromium.launch({ headless: true });
const summary = {};
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/api/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
  );
  await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await window.axe.run(document, { resultTypes: ['violations'] });
  });
  summary[route] = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
  }));
  await page.close();
}
await browser.close();
console.log(JSON.stringify(summary, null, 2));
