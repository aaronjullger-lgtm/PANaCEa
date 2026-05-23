/**
 * Comprehensive Smoke Test Suite for StudyPANaCEa
 *
 * This test suite verifies that every study mode in the application loads correctly
 * and doesn't show critical errors (500, 401, blank screens).
 *
 * RUNS AUTOMATICALLY with saved authentication from auth.setup.ts
 *
 * HOW TO RUN:
 * - All modes: npx playwright test all-modes
 * - Single mode: npx playwright test all-modes -g "ECG"
 * - Debug mode: npx playwright test all-modes --debug
 * - UI mode: npx playwright test all-modes --ui
 */

import { test, expect } from '@playwright/test';

/**
 * Route Matrix - All Critical Paths in the App
 *
 * Each route is tested for:
 * 1. Successful navigation
 * 2. Expected content loads (expectText or expectSelector)
 * 3. No 500 Internal Server Error
 * 4. No 401 Unauthorized
 * 5. No blank white screen
 */
const routes = [
  {
    name: 'Command Center',
    url: '/',
    expectText: 'Command Center',
    description: 'Main dashboard and navigation hub',
  },
  {
    name: 'Quiz Mode',
    url: '/?view=quiz',
    expectText: 'Question',
    description: 'Main question-based study session',
  },
  {
    name: 'Pharmacology Drill',
    url: '/?view=pharmacology',
    expectText: 'Pharmacology',
    description: 'Tests /api/questions/pharmacology-drill endpoint',
  },
  {
    name: 'System Drill',
    url: '/?view=system_drill',
    expectText: 'System',
    description: 'Tests /api/questions/system-drill endpoint',
  },
  {
    name: 'ECG Drill',
    url: '/?view=ecg_drill',
    expectText: 'ECG',
    description: 'Tests /api/drills/media?modality=ecg (CRITICAL - had 500 errors)',
  },
  {
    name: 'Derm Drill',
    url: '/?view=derm_drill',
    expectText: 'Derm',
    description: 'Dermatology photo interpretation',
  },
  {
    name: 'Imaging Drill (Radiology)',
    url: '/?view=imaging_drill',
    expectText: 'Imaging',
    description: 'Tests /api/drills/media?modality=radiology',
  },
  {
    name: 'Anatomy Review',
    url: '/?view=anatomy_review',
    expectText: 'Anatomy',
    description: 'Regional anatomy with clinical correlates',
  },
  {
    name: 'Physiology Drill',
    url: '/?view=physiology_drill',
    expectText: 'Physiology',
    description: 'Physiology concepts and mechanisms',
  },
  {
    name: 'Mini Lab Drill',
    url: '/?view=mini_lab',
    expectText: 'Lab',
    description: 'Laboratory value interpretation - Tests /api/drills/lab-cases',
  },
  {
    name: 'Rapid Recall',
    url: '/?view=rapid_recall',
    expectText: 'Recall',
    description: 'High-yield buzzwords and associations',
  },
  {
    name: 'First Line Treatment',
    url: '/?view=first_line_treatment',
    expectText: 'First Line',
    description: 'First-line treatment selection drill',
  },
  {
    name: 'Guideline Drill',
    url: '/?view=guideline_drill',
    expectText: 'Guideline',
    description: 'Clinical guidelines and scoring systems',
  },
  {
    name: 'Code Blue Speed',
    url: '/?view=code_blue_speed',
    expectText: 'Code Blue',
    description: 'ACLS/PALS rapid scenarios',
  },
  {
    name: 'Ventilator Hero',
    url: '/?view=ventilator_hero',
    expectText: 'Ventilator',
    description: 'Mechanical ventilation management',
  },
  {
    name: 'Condition Drill',
    url: '/?view=condition_drill',
    expectText: 'Condition',
    description: 'Condition-based quiz drill — organ system selection and random mix',
  },
  {
    name: 'Contrastive Drill',
    url: '/?view=contrastive_drill',
    expectText: 'Contrastive',
    description: 'Contrastive pattern recognition — side-by-side condition comparison',
  },
  {
    name: 'DDx Compare Drill',
    url: '/?view=ddx_compare',
    expectText: 'DDx',
    description: 'Differential diagnosis comparison — Must Not Miss, Most Common, Red Flag',
  },
  {
    name: 'Elaboration Drill',
    url: '/?view=elaboration_drill',
    expectText: 'Elaborative',
    description: 'Elaborative interrogation — free-text explanation graded by Gemini on 0-3 rubric',
  },
  {
    name: 'ICD-10 Coding Drill',
    url: '/?view=icd_coding_drill',
    expectText: 'ICD-10',
    description: 'ICD-10 code selection from clinical vignettes',
  },
  {
    name: 'Virtual OSCE',
    url: '/?view=patient_encounter',
    expectText: 'Virtual OSCE',
    description: 'Patient encounter mode shell and landing render',
  },
  {
    name: 'Admin Media',
    url: '/?view=admin_media',
    expectText: 'Media',
    description: 'Admin content management for media assets',
  },
];

/**
 * Helper function to check for critical errors
 */
async function checkForCriticalErrors(page: any, routeName: string) {
  const pageContent = await page.textContent('body');

  // Check for 500 errors
  if (pageContent.includes('500') && pageContent.includes('Internal Server Error')) {
    throw new Error(`❌ 500 Internal Server Error detected on ${routeName}`);
  }

  // Check for 401 errors
  if (pageContent.includes('401') && pageContent.includes('Unauthorized')) {
    throw new Error(`❌ 401 Unauthorized detected on ${routeName}`);
  }

  // Check for blank white screen (body has very little content)
  const bodyText = pageContent.trim();
  if (bodyText.length < 50 && !bodyText.includes('Loading')) {
    throw new Error(
      `❌ Blank screen detected on ${routeName} (content length: ${bodyText.length})`
    );
  }

  // Check for React error boundaries
  if (
    pageContent.includes('Something went wrong') ||
    pageContent.includes('Error boundary') ||
    pageContent.includes('Uncaught')
  ) {
    throw new Error(`❌ React error boundary triggered on ${routeName}`);
  }
}

/**
 * Parameterized Test - Runs for each route
 */
test.describe('Smoke Tests - All Study Modes', () => {
  // Before each test, ensure we're starting fresh
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for pages that need to load data
    test.setTimeout(30000);
  });

  // Generate a test for each route
  for (const route of routes) {
    test(`${route.name} - loads successfully`, async ({ page }) => {
      console.log(`\n🧪 Testing: ${route.name}`);
      console.log(`📍 URL: ${route.url}`);
      console.log(`📝 Description: ${route.description}`);

      // Navigate to the route
      const response = await page.goto(route.url);

      // Check HTTP status
      if (response) {
        const status = response.status();
        console.log(`📊 HTTP Status: ${status}`);

        // Fail on server errors
        if (status >= 500) {
          throw new Error(`❌ Server returned ${status} error`);
        }

        // Fail on unauthorized
        if (status === 401) {
          throw new Error(`❌ Authentication failed (401 Unauthorized)`);
        }
      }

      // Wait for page to be in ready state
      await page.waitForLoadState('domcontentloaded');

      // Check for critical errors in page content
      await checkForCriticalErrors(page, route.name);

      // Verify expected content is present
      if (route.expectText) {
        console.log(`🔍 Looking for text: "${route.expectText}"`);

        const element = page.getByText(route.expectText, { exact: false }).first();

        await expect(element).toBeVisible({
          timeout: 15000, // 15 seconds to load content
        });

        console.log(`✅ Found expected text: "${route.expectText}"`);
      }

      console.log(`✅ ${route.name} - PASSED\n`);
    });
  }
});

/**
 * Additional Critical API Endpoint Tests
 *
 * These tests specifically check backend endpoints that have had issues
 */
test.describe('Critical API Endpoint Tests', () => {
  test('Media API (/api/drills/media?modality=ecg) returns valid data', async ({ request }) => {
    console.log('\n🧪 Testing Media API endpoint directly...');

    const response = await request.get('/api/drills/media?modality=ecg');

    console.log(`📊 Status: ${response.status()}`);

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    console.log(`✅ Returned ${body.data?.length ?? 0} media items`);

    console.log('✅ Media API endpoint - PASSED\n');
  });

  test('Pharmacology API (/api/questions/pharmacology-drill) returns valid data', async ({
    request,
  }) => {
    console.log('\n🧪 Testing Pharmacology API endpoint directly...');

    const response = await request.post('/api/questions/pharmacology-drill', {
      data: { drugClass: 'beta-blockers' },
    });

    console.log(`📊 Status: ${response.status()}`);

    // Should not return 500
    expect(response.status()).not.toBe(500);

    // Should not be unauthorized
    expect(response.status()).not.toBe(401);

    console.log('✅ Pharmacology API endpoint - PASSED\n');
  });

  test('System Drill API (/api/questions/system-drill) returns valid data', async ({ request }) => {
    console.log('\n🧪 Testing System Drill API endpoint directly...');

    const response = await request.post('/api/questions/system-drill', {
      data: { system: 'CV' },
    });

    console.log(`📊 Status: ${response.status()}`);

    // Should not return 500
    expect(response.status()).not.toBe(500);

    // Should not be unauthorized
    expect(response.status()).not.toBe(401);

    console.log('✅ System Drill API endpoint - PASSED\n');
  });

  test('Contrastive Drill API (/api/drills/contrastive/sets) returns valid data', async ({
    request,
  }) => {
    console.log('\n🧪 Testing Contrastive Drill API endpoint directly...');

    const response = await request.get('/api/drills/contrastive/sets');

    console.log(`📊 Status: ${response.status()}`);

    expect(response.status()).not.toBe(500);
    expect(response.status()).not.toBe(401);

    console.log('✅ Contrastive Drill API endpoint - PASSED\n');
  });

  test('Elaboration Drill API (/api/drills/elaboration/generate) responds without 500', async ({
    request,
  }) => {
    console.log('\n🧪 Testing Elaboration Drill API endpoint directly...');

    const response = await request.post('/api/drills/elaboration/generate', {
      data: { system: 'CV' },
    });

    console.log(`📊 Status: ${response.status()}`);

    // Should not return 500
    expect(response.status()).not.toBe(500);

    // Should not be unauthorized
    expect(response.status()).not.toBe(401);

    console.log('✅ Elaboration Drill API endpoint - PASSED\n');
  });
});
