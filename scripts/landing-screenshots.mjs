// One-off visual-review capture for the landing page. Not part of CI.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_URL || 'http://localhost:4173/';
const OUT = 'docs/design/screenshots';
mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: process.env.REDUCED === '1' ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500); // let the engine settle a beat
    const suffix = process.env.REDUCED === '1' ? '-reduced' : '';
    await page.screenshot({ path: `${OUT}/${vp.name}${suffix}-fold.png` });
    await page.screenshot({ path: `${OUT}/${vp.name}${suffix}-full.png`, fullPage: true });
    console.log(`captured ${vp.name}${suffix}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
