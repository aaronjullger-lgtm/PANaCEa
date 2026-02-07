/**
 * UX Polish E2E — User Simulation + Design Police
 *
 * 1. Full user journey: Dashboard → Start Session / Deck → Flip Card → Rate (1–4) → Complete → Dashboard
 * 2. On every page: run Design Police (contrast, tap targets 44px, spacing, cursor pointer).
 *
 * Run: npx playwright test ux_polish.spec.ts --project=chromium
 * (Uses auth so SRS/Study flow is available.)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/** Minimum tap target size (WCAG 2.5.5) */
const MIN_TAP_PX = 44;

/** R,G,B >= this considered "too light" on light background (e.g. gray-300 on white) */
const LIGHT_GRAY_THRESHOLD = 200;

export type DesignViolation = {
  kind: 'contrast' | 'sizing' | 'spacing' | 'cursor';
  selector: string;
  detail: string;
  tagName?: string;
};

/**
 * Design Police: run in page context, return violations.
 * - Contrast: text color too light (e.g. gray-300 on white)
 * - Sizing: clickable element < 44px height or width
 * - Spacing: container has padding 0 but contains text
 * - Cursors: button/link without cursor: pointer
 */
async function runDesignPolice(page: Page, pageName: string): Promise<DesignViolation[]> {
  const violations = await page.evaluate(
    ({ minTapPx, lightThreshold }) => {
      const out: DesignViolation[] = [];

      function getLuminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function parseRgb(color: string): { r: number; g: number; b: number } | null {
        const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!m) return null;
        return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
      }

      function getBgLuminance(el: Element): number {
        let current: Element | null = el;
        while (current && current !== document.body) {
          const bg = getComputedStyle(current).backgroundColor;
          const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (m) {
            const r = parseInt(m[1], 10);
            const g = parseInt(m[2], 10);
            const b = parseInt(m[3], 10);
            if (r < 255 || g < 255 || b < 255) return getLuminance(r, g, b);
          }
          current = current.parentElement;
        }
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const m = bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m) return getLuminance(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
        return 0.95; // assume light
      }

      // --- Contrast: visible text too light on light background ---
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const textNodes: Text[] = [];
      let n: Node | null = walker.nextNode();
      while (n) {
        if (n.textContent?.trim()) textNodes.push(n as Text);
        n = walker.nextNode();
      }
      const seenEls = new Set<Element>();
      for (const text of textNodes) {
        const el = text.parentElement;
        if (!el || seenEls.has(el)) continue;
        const style = getComputedStyle(el);
        const color = style.color;
        const rgb = parseRgb(color);
        if (!rgb) continue;
        if (rgb.r >= lightThreshold && rgb.g >= lightThreshold && rgb.b >= lightThreshold) {
          const bgLum = getBgLuminance(el);
          if (bgLum > 0.6) {
            seenEls.add(el);
            const sel = el.id ? `#${el.id}` : el.className ? `${el.tagName.toLowerCase()}.${el.className.split(/\s+/)[0]}` : el.tagName.toLowerCase();
            out.push({
              kind: 'contrast',
              selector: sel,
              detail: `Text color ${color} too light on light background (luminance ${bgLum.toFixed(2)})`,
              tagName: el.tagName,
            });
          }
        }
      }

      // --- Sizing: buttons/links < 44px ---
      const clickables = document.querySelectorAll('button, a[href], [role="button"], [role="link"]');
      clickables.forEach((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width < minTapPx || rect.height < minTapPx) {
          const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean)[0] : '');
          out.push({
            kind: 'sizing',
            selector: sel,
            detail: `Tap target ${Math.round(rect.width)}×${Math.round(rect.height)}px (min ${minTapPx}px)`,
            tagName: el.tagName,
          });
        }
      });

      // --- Spacing: container padding 0 with text ---
      const all = document.querySelectorAll('*');
      all.forEach((el) => {
        const style = getComputedStyle(el);
        const pad = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
        const allZero = pad.every((p) => p === '0px');
        const text = (el.textContent || '').trim();
        if (allZero && text.length > 10 && el.children.length > 0) {
          const tag = el.tagName.toLowerCase();
          if (['div', 'section', 'article', 'main', 'aside'].includes(tag)) {
            const sel = el.id ? `#${el.id}` : tag + (el.className ? '.' + (el.className as string).split(/\s+/)[0] : '');
            out.push({
              kind: 'spacing',
              selector: sel,
              detail: 'Container has padding 0 but contains text',
              tagName: el.tagName,
            });
          }
        }
      });

      // --- Cursors: button/link without cursor pointer ---
      const interactives = document.querySelectorAll('button, a[href], [role="button"], [role="link"]');
      interactives.forEach((el) => {
        const cursor = getComputedStyle(el).cursor;
        if (cursor !== 'pointer') {
          const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + (el.className as string).split(/\s+/).filter(Boolean)[0] : '');
          out.push({
            kind: 'cursor',
            selector: sel,
            detail: `cursor: ${cursor} (expected pointer)`,
            tagName: el.tagName,
          });
        }
      });

      return out;
    },
    { minTapPx: MIN_TAP_PX, lightThreshold: LIGHT_GRAY_THRESHOLD }
  );

  const typed = violations as DesignViolation[];
  if (typed.length > 0) {
    console.log(`[Design Police] ${pageName}: ${typed.length} violation(s)`);
    typed.forEach((v) => console.log(`  [${v.kind}] ${v.selector} — ${v.detail}`));
  }
  return typed;
}

async function waitForAppReady(page: Page) {
  await page
    .locator('[data-testid="app-container"], main, #root')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    return await page
      .locator('text=/dashboard|home|menu|command center|Start Session/i')
      .first()
      .isVisible({ timeout: 3000 });
  } catch {
    return false;
  }
}

test.describe('UX Polish — User Simulation + Design Police', () => {
  test.setTimeout(60000);

  test('full journey: dashboard → deck (SRS) → flip card → rate → back + design police on every page', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    await page.waitForTimeout(800);

    const allViolations: { page: string; violations: DesignViolation[] }[] = [];

    // --- Page 1: Dashboard or Landing (/) — always run design police ---
    const dashViolations = await runDesignPolice(page, 'Dashboard (/)');
    allViolations.push({ page: 'Dashboard (/)', violations: dashViolations });

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      // No auth: assert on violations found on landing/sign-in page only
      const total = allViolations.reduce((acc, { violations }) => acc + violations.length, 0);
      if (total > 0) {
        const report = allViolations
          .filter(({ violations }) => violations.length > 0)
          .map(({ page: p, violations }) => `${p}:\n${violations.map((v) => `  [${v.kind}] ${v.selector} — ${v.detail}`).join('\n')}`)
          .join('\n\n');
        throw new Error(`Design Police found ${total} violation(s):\n\n${report}`);
      }
      return;
    }

    // --- Navigate to Study → SRS Flashcards (specific deck) ---
    const studyLink = page.locator('a[href="/study"], [href="/study/"]').first();
    if (await studyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studyLink.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto(BASE_URL + '/study');
      await waitForAppReady(page);
      await page.waitForTimeout(800);
    }

    const resourcesTab = page
      .locator('#study-tools-tab-resources, button:has-text("Clinical Resources")')
      .first();
    if (await resourcesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await resourcesTab.click();
      await page.waitForTimeout(800);
    }

    const srsButton = page.locator('button:has-text("SRS Flashcards")').first();
    await expect(srsButton).toBeVisible({ timeout: 8000 });
    await srsButton.click();
    await page.waitForTimeout(1500);

    const studyViolations = await runDesignPolice(page, 'Study / SRS Flashcards');
    allViolations.push({ page: 'Study / SRS Flashcards', violations: studyViolations });

    // --- Interact: Flip Card → Rating (1–4) ---
    const flipArea = page.locator('[aria-label*="Show question"], [aria-label*="Show answer"], [data-testid="srs-flashcards-heading"]').first();
    const cardArea = page.locator('.cursor-pointer.select-none, [role="button"]').first();
    const ratingGood = page.locator('button:has-text("Good")').first();
    const ratingAgain = page.locator('button:has-text("Again")').first();

    if (await flipArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await flipArea.click();
      await page.waitForTimeout(400);
    } else if (await cardArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cardArea.click();
      await page.waitForTimeout(400);
    }

    if (await ratingGood.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ratingGood.click();
      await page.waitForTimeout(800);
    } else if (await ratingAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ratingAgain.click();
      await page.waitForTimeout(800);
    }

    const srsAfterViolations = await runDesignPolice(page, 'SRS after rating');
    allViolations.push({ page: 'SRS after rating', violations: srsAfterViolations });

    // --- Finish: Back to dashboard ---
    const backBtn = page.locator('button[aria-label="Back"], button:has-text("Back")').first();
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto(BASE_URL + '/');
      await waitForAppReady(page);
    }

    const finalViolations = await runDesignPolice(page, 'Dashboard (after return)');
    allViolations.push({ page: 'Dashboard (after return)', violations: finalViolations });

    // --- Assert: no design police violations (fail and report) ---
    const total = allViolations.reduce((acc, { violations }) => acc + violations.length, 0);
    if (total > 0) {
      const report = allViolations
        .filter(({ violations }) => violations.length > 0)
        .map(({ page: p, violations }) => `${p}:\n${violations.map((v) => `  [${v.kind}] ${v.selector} — ${v.detail}`).join('\n')}`)
        .join('\n\n');
      throw new Error(`Design Police found ${total} violation(s):\n\n${report}`);
    }
  });
});
