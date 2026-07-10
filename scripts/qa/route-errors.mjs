#!/usr/bin/env node
/**
 * Ad-hoc route error sweep: visits a set of routes against a running preview with
 * all /api/** mocked, and reports page errors, console errors, and failed network
 * responses per route. Clerk requests are allowlisted (auth-gated routes redirect
 * to a sign-in prompt). Usage: node scripts/qa/route-errors.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const routes = [
  '/', '/study', '/practice', '/progress', '/explorer', '/clinical-profile',
  '/medical-database', '/technique-check', '/daily-challenges', '/gap-analysis',
  '/study/review', '/study/path', '/visualizer',
  '/this-route-does-not-exist-404',
];

function allowed(url) {
  return /clerk\.|clerk\.com|clerk\.dev|clerk\.accounts|\/npm\/@clerk\//.test(url);
}

const browser = await chromium.launch({ headless: true });
const out = {};
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  const failed = [];
  await page.route('**/api/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null, ok: true }) })
  );
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.startsWith('Failed to load resource')) consoleErrors.push(t);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400 && !allowed(resp.url())) failed.push(`${resp.status()} ${resp.url()}`);
  });
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('main, [role="main"], #root, body').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(700);
  } catch (e) {
    pageErrors.push(`NAV: ${e.message}`);
  }
  out[route] = {
    ok: pageErrors.length === 0 && consoleErrors.length === 0 && failed.length === 0,
    pageErrors, consoleErrors, failed,
  };
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
const broken = Object.entries(out).filter(([, v]) => !v.ok);
console.log(`\nSUMMARY: ${Object.keys(out).length - broken.length}/${Object.keys(out).length} routes clean`);
if (broken.length) console.log('BROKEN:', broken.map(([r]) => r).join(', '));
