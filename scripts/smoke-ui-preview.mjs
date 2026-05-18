#!/usr/bin/env node

import { spawn } from 'node:child_process';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const port = Number(process.env.PANACEA_SMOKE_PORT ?? 4173);
const host = process.env.PANACEA_SMOKE_HOST ?? '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const viteCliPath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const routes = [
  {
    name: 'landing-desktop',
    path: '/',
    viewport: { width: 1440, height: 1100 },
    heading: /Master the PANCE one clinical case at a time/i,
    forbidModelRequests: true,
    assertions: [
      { description: 'diagnostic story section', selector: '#diagnostic-story' },
      { description: 'training modes dock section', selector: '#training-modes' },
      {
        description: 'dashboard command-center preview copy',
        text: /StudyPanacea readiness command center/i,
      },
      { description: 'synthetic clinical image lab copy', text: /Clinical image training viewer/i },
    ],
  },
  {
    name: 'landing-mobile-reduced-motion',
    path: '/',
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    heading: /Master the PANCE one clinical case at a time/i,
    forbidModelRequests: true,
    checkHorizontalOverflow: true,
    assertions: [
      { description: 'diagnostic story section', selector: '#diagnostic-story' },
      { description: 'training modes dock section', selector: '#training-modes' },
    ],
  },
  {
    name: 'protected-study-route',
    path: '/study',
    viewport: { width: 1280, height: 900 },
    heading: /Sign in to open your adaptive study plan|PANCE readiness command center/i,
    forbidModelRequests: true,
  },
  {
    name: 'protected-visualizer-route',
    path: '/visualizer',
    viewport: { width: 1280, height: 900 },
    heading:
      /Sign in to open the anatomy visualizer|This workspace is not part of the beta yet|Generate anatomy visuals built for recall/i,
    forbidModelRequests: true,
  },
];

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode ?? 0));
    });
    request.on('error', reject);
    request.setTimeout(1000, () => {
      request.destroy(new Error(`Timed out waiting for ${url}`));
    });
  });
}

async function waitForPreview(url) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < 30000) {
    if (previewExit) {
      throw new Error(
        `Preview server exited before becoming ready (${formatPreviewExit(previewExit)}).${previewOutputTail()}`
      );
    }

    try {
      const status = await requestUrl(url);
      if (status >= 200 && status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await Promise.race([delay(500), previewExitPromise]);
  }

  throw new Error(
    `Preview server did not become ready at ${url}: ${lastError?.message ?? 'unknown error'}.${previewOutputTail()}`
  );
}

function mockApiBody(pathname) {
  if (pathname.includes('/api/content')) return [];
  if (pathname.includes('/api/drugs')) return [];
  if (pathname.includes('/api/user')) return { data: null };
  if (pathname.includes('/api/dashboard')) return { data: null };
  if (pathname.includes('/api/today-plan')) return { data: null };
  return { data: null, ok: true };
}

function isAllowedFailedResponse(url) {
  return (
    url.includes('clerk.') ||
    url.includes('/npm/@clerk/') ||
    url.includes('clerk.accounts') ||
    url.includes('clerk.dev') ||
    url.includes('clerk.com')
  );
}

const previewOutput = [];
const previewOutputLimit = 80;

function rememberPreviewOutput(chunk, destination) {
  const text = chunk.toString();
  const lines = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `[${destination}] ${line}`);

  previewOutput.push(...lines);
  if (previewOutput.length > previewOutputLimit) {
    previewOutput.splice(0, previewOutput.length - previewOutputLimit);
  }

  if (process.env.PANACEA_SMOKE_DEBUG === 'true') {
    const stream = destination === 'stderr' ? process.stderr : process.stdout;
    stream.write(chunk);
  }
}

function previewOutputTail() {
  if (previewOutput.length === 0) return '';
  return `\nPreview output:\n${previewOutput.join('\n')}`;
}

function formatPreviewExit(exit) {
  if (!exit) return 'unknown exit';
  if (exit.signal) return `signal ${exit.signal}`;
  return `code ${exit.code ?? 'unknown'}`;
}

const preview = spawn(
  process.execPath,
  [viteCliPath, 'preview', '--host', host, '--port', String(port), '--strictPort'],
  {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let previewExit;
const previewExitPromise = new Promise((resolve) => {
  preview.once('exit', (code, signal) => {
    previewExit = { code, signal };
    resolve(previewExit);
  });
});

preview.stdout.on('data', (chunk) => {
  rememberPreviewOutput(chunk, 'stdout');
});

preview.stderr.on('data', (chunk) => {
  rememberPreviewOutput(chunk, 'stderr');
});

let browser;

async function stopPreview() {
  if (previewExit) return;

  preview.kill('SIGTERM');
  const stopped = await Promise.race([previewExitPromise, delay(3000).then(() => 'timeout')]);
  if (stopped !== 'timeout') return;

  preview.kill('SIGKILL');
  await Promise.race([previewExitPromise, delay(1000)]);
}

try {
  await waitForPreview(baseUrl);
  browser = await chromium.launch({ headless: true });

  const results = [];

  for (const route of routes) {
    const page = await browser.newPage({ viewport: route.viewport });
    const pageErrors = [];
    const consoleErrors = [];
    const failedResponses = [];
    const forbiddenModelRequests = [];
    const headingFailures = [];
    const assertionFailures = [];
    const assertionsPassed = [];

    await page.route('**/api/**', async (requestRoute) => {
      const requestUrlValue = new URL(requestRoute.request().url());
      await requestRoute.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiBody(requestUrlValue.pathname)),
      });
    });

    if (route.reducedMotion) {
      await page.emulateMedia({ reducedMotion: route.reducedMotion });
    }

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && !text.startsWith('Failed to load resource')) {
        consoleErrors.push(text);
      }
    });
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && !isAllowedFailedResponse(url)) {
        failedResponses.push(`${status} ${url}`);
      }
    });
    page.on('request', (request) => {
      const url = request.url();
      if (route.forbidModelRequests && /\.(?:glb|gltf)(?:[?#].*)?$/i.test(url)) {
        forbiddenModelRequests.push(url);
      }
    });

    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      await page.getByRole('heading', { name: route.heading }).first().waitFor({ timeout: 15000 });
    } catch (error) {
      headingFailures.push(`Expected heading ${route.heading}: ${error.message}`);
    }
    await page
      .locator('main, [role="main"], body')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });

    for (const assertion of route.assertions ?? []) {
      try {
        if (assertion.selector) {
          await page
            .locator(assertion.selector)
            .first()
            .waitFor({ state: 'visible', timeout: 5000 });
        } else if (assertion.text) {
          await page.getByText(assertion.text).first().waitFor({ timeout: 5000 });
        }
        assertionsPassed.push(assertion.description);
      } catch (error) {
        assertionFailures.push(`${assertion.description}: ${error.message}`);
      }
    }

    await page.waitForTimeout(600);

    const hasHorizontalOverflow = route.checkHorizontalOverflow
      ? await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
      : false;

    results.push({
      route: route.name,
      heading: await page.locator('h1').first().textContent(),
      assertionsPassed,
      headingFailures,
      assertionFailures,
      forbiddenModelRequests,
      hasHorizontalOverflow,
      pageErrors,
      consoleErrors,
      failedResponses,
    });

    await page.close();
  }

  const failures = results.filter(
    (result) =>
      result.pageErrors.length > 0 ||
      result.consoleErrors.length > 0 ||
      result.failedResponses.length > 0 ||
      result.headingFailures.length > 0 ||
      result.assertionFailures.length > 0 ||
      result.forbiddenModelRequests.length > 0 ||
      result.hasHorizontalOverflow
  );

  console.log(JSON.stringify({ baseUrl, results }, null, 2));

  if (failures.length > 0) {
    throw new Error(`UI smoke found ${failures.length} route(s) with errors.`);
  }
} finally {
  await browser?.close();
  await stopPreview();
}
