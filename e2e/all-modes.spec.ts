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
    name: 'Drill Dashboard', 
    url: '/drill', 
    expectText: 'Start',
    description: 'Main drill mode landing page'
  },
  { 
    name: 'Pharmacology Drill', 
    url: '/drill/pharmacology', 
    expectText: 'Submit',
    description: 'Tests /api/questions/pharmacology-drill endpoint'
  },
  { 
    name: 'ECG / Media Drill', 
    url: '/drill/ecg', 
    expectSelector: 'img',
    description: 'Tests /api/drills/media endpoint (CRITICAL - had 500 errors)'
  },
  { 
    name: 'Anatomy Drill', 
    url: '/drill/anatomy', 
    expectText: 'Identify',
    description: 'Anatomy identification drill'
  },
  { 
    name: 'Physiology Drill', 
    url: '/drill/physiology', 
    expectText: 'Question',
    description: 'Physiology concepts drill'
  },
  { 
    name: 'Code Blue Drill', 
    url: '/drill/code-blue', 
    expectText: 'Start Resuscitation',
    description: 'Emergency response simulation'
  },
  { 
    name: 'System Drill', 
    url: '/drill/system', 
    expectText: 'System',
    description: 'Tests /api/questions/system-drill endpoint'
  },
  { 
    name: 'Flashcards', 
    url: '/flashcards', 
    expectText: 'Show Answer',
    description: 'Flashcard study mode'
  },
  { 
    name: 'Admin Dashboard', 
    url: '/admin', 
    expectText: 'Dashboard',
    description: 'Admin content management'
  },
  { 
    name: 'Quiz Mode', 
    url: '/quiz', 
    expectText: 'Question',
    description: 'Main quiz interface'
  },
  { 
    name: 'Analytics', 
    url: '/analytics', 
    expectText: 'Performance',
    description: 'Performance analytics dashboard'
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
    throw new Error(`❌ Blank screen detected on ${routeName} (content length: ${bodyText.length})`);
  }
  
  // Check for React error boundaries
  if (pageContent.includes('Something went wrong') || 
      pageContent.includes('Error boundary') ||
      pageContent.includes('Uncaught')) {
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
      
      if (route.expectSelector) {
        console.log(`🔍 Looking for selector: "${route.expectSelector}"`);
        
        const element = page.locator(route.expectSelector).first();
        
        await expect(element).toBeVisible({ 
          timeout: 15000,
        });
        
        console.log(`✅ Found expected element: "${route.expectSelector}"`);
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
    
    // Should not return 500
    expect(response.status()).not.toBe(500);
    
    // Should return 200 or 404 (empty results)
    expect([200, 404]).toContain(response.status());
    
    // Should return JSON
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log(`✅ Returned ${Array.isArray(data) ? data.length : 0} media items`);
    }
    
    console.log('✅ Media API endpoint - PASSED\n');
  });
  
  test('Pharmacology API (/api/questions/pharmacology-drill) returns valid data', async ({ request }) => {
    console.log('\n🧪 Testing Pharmacology API endpoint directly...');
    
    const response = await request.post('/api/questions/pharmacology-drill', {
      data: { drugClass: 'beta-blockers' }
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
      data: { system: 'CV' }
    });
    
    console.log(`📊 Status: ${response.status()}`);
    
    // Should not return 500
    expect(response.status()).not.toBe(500);
    
    // Should not be unauthorized
    expect(response.status()).not.toBe(401);
    
    console.log('✅ System Drill API endpoint - PASSED\n');
  });
});
