/**
 * Mobile Layout Audit — 320px viewport (iPhone SE)
 *
 * Hunts for "The Squish":
 * - Awkward text wrap (single letter on new line)
 * - Horizontal scrolling inside cards/containers
 * - Double headers (page title + navbar competing)
 *
 * Run: npx playwright test mobile_layout_audit.spec.ts --project=mobile-layout
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VIEWPORT = { width: 320, height: 568 };

export type LayoutViolation = {
  kind: 'horizontal_scroll' | 'awkward_wrap' | 'double_header';
  selector: string;
  detail: string;
};

async function waitForAppReady(page: Page) {
  await page
    .locator('[data-testid="app-container"], main, #root')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
}

/** Detect horizontal overflow on body or main content areas */
async function checkHorizontalScroll(page: Page): Promise<LayoutViolation[]> {
  return page.evaluate(() => {
    const out: LayoutViolation[] = [];
    const scrollables = document.querySelectorAll('body, main, [data-testid="app-container"], #root, [role="main"]');
    scrollables.forEach((el) => {
      const overflowX = getComputedStyle(el).overflowX;
      const scrollWidth = (el as HTMLElement).scrollWidth;
      const clientWidth = (el as HTMLElement).clientWidth;
      if (scrollWidth > clientWidth + 2) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        out.push({
          kind: 'horizontal_scroll',
          selector: tag + id || tag,
          detail: `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
        });
      }
    });
    return out;
  });
}

/** Detect elements that might be cramped (narrow flex row with multiple children) */
async function checkCrampedFlexRows(page: Page): Promise<LayoutViolation[]> {
  return page.evaluate(() => {
    const out: LayoutViolation[] = [];
    document.querySelectorAll('[class*="flex-row"]').forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const children = el.children.length;
      if (rect.width < 280 && children >= 2) {
        const cls = (el.className as string).split(/\s+/).find((c) => c.startsWith('flex'));
        out.push({
          kind: 'awkward_wrap',
          selector: el.tagName.toLowerCase() + (el.className ? '.' + (el.className as string).split(/\s+/).slice(0, 2).join('.').replace(/\./g, '_') : ''),
          detail: `flex-row at ${Math.round(rect.width)}px with ${children} children`,
        });
      }
    });
    return out;
  });
}

/** Detect multiple h1/h2 in header area (double header) */
async function checkDoubleHeaders(page: Page): Promise<LayoutViolation[]> {
  return page.evaluate(() => {
    const out: LayoutViolation[] = [];
    const headers = document.querySelectorAll('h1, h2');
    const viewportHeight = window.innerHeight;
    const topThird = viewportHeight * 0.35;
    const headingsInTop: Element[] = [];
    headers.forEach((h) => {
      const rect = h.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < topThird) headingsInTop.push(h);
    });
    if (headingsInTop.length >= 2) {
      out.push({
        kind: 'double_header',
        selector: 'header-area',
        detail: `${headingsInTop.length} headings (h1/h2) in top third of viewport`,
      });
    }
    return out;
  });
}

test.describe('Mobile Layout Audit (320px)', () => {
  test.setTimeout(45000);

  test.use({ viewport: VIEWPORT });

  test('audit landing/dashboard for squish: horizontal scroll, cramped flex, double headers', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    await page.waitForTimeout(1500);

    const violations: LayoutViolation[] = [];

    const scrollViolations = await checkHorizontalScroll(page);
    violations.push(...scrollViolations);

    const crampedViolations = await checkCrampedFlexRows(page);
    violations.push(...crampedViolations);

    const headerViolations = await checkDoubleHeaders(page);
    violations.push(...headerViolations);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `[${v.kind}] ${v.selector} — ${v.detail}`)
        .join('\n');
      throw new Error(`Mobile layout violations (320px):\n${report}`);
    }
  });

  test('audit /study for horizontal overflow and cramped layout', async ({ page }) => {
    await page.goto(BASE_URL + '/study');
    await waitForAppReady(page);
    await page.waitForTimeout(1200);

    const scrollViolations = await checkHorizontalScroll(page);
    const crampedViolations = await checkCrampedFlexRows(page);

    const all = [...scrollViolations, ...crampedViolations];
    if (all.length > 0) {
      const report = all.map((v) => `[${v.kind}] ${v.selector} — ${v.detail}`).join('\n');
      throw new Error(`Mobile layout violations on /study (320px):\n${report}`);
    }
  });
});
