#!/usr/bin/env node
/**
 * Detailed per-route browser QA. For each route: desktop render + console/network
 * capture, stuck-loader check, mobile-viewport + horizontal-overflow check, and a
 * basic keyboard-focus reachability check. /api/** mocked; Clerk allowlisted.
 * Usage: node scripts/qa/route-qa.mjs "/,/sign-in,/sign-up" [baseUrl]
 */
import { chromium } from 'playwright';

const routes = (process.argv[2] || '/').split(',');
const base = process.argv[3] || 'http://127.0.0.1:4173';
const allowed = (u) => /clerk\.|clerk\.com|clerk\.dev|clerk\.accounts|\/npm\/@clerk\//.test(u);

const browser = await chromium.launch({ headless: true });
const report = {};
for (const route of routes) {
  const r = { pageErrors: [], consoleErrors: [], failed: [] };
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/api/**', (rt) =>
    rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null, ok: true }) })
  );
  page.on('pageerror', (e) => r.pageErrors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.startsWith('Failed to load resource')) r.consoleErrors.push(t);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400 && !allowed(resp.url())) r.failed.push(`${resp.status()} ${resp.url()}`);
  });
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('main, [role="main"], #root, body').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(800);
    // Visible UI: first heading text + whether any content rendered.
    r.heading = (await page.locator('h1, h2, [role="heading"]').first().textContent().catch(() => null))?.trim().slice(0, 80) ?? null;
    r.bodyTextLen = (await page.locator('body').innerText().catch(() => '')).length;
    // Stuck-loader heuristic: any persistent spinner/"loading" after settle.
    r.stuckLoader = await page.evaluate(() => {
      const spin = document.querySelector('.animate-spin, [data-testid="loading"], [aria-busy="true"]');
      const txt = (document.body.innerText || '').toLowerCase();
      return Boolean(spin) && (txt.includes('loading') || txt.includes('verifying'));
    });
    // Keyboard a11y: Tab a few times, see if focus reaches an interactive element.
    let focusTag = null;
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      focusTag = await page.evaluate(() => document.activeElement?.tagName ?? null);
      if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(focusTag)) break;
    }
    r.keyboardFocusReaches = focusTag;
    // Mobile viewport + horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    r.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  } catch (e) {
    r.pageErrors.push(`NAV: ${e.message}`);
  }
  r.ok = r.pageErrors.length === 0 && r.consoleErrors.length === 0 && r.failed.length === 0 && !r.stuckLoader && !r.mobileOverflow;
  report[route] = r;
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
