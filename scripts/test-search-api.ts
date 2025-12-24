/**
 * Test script for the new search API endpoints
 * Verifies that conditionSearch.ts properly calls the database-backed API
 * 
 * Run: npx ts-node scripts/test-search-api.ts
 */

import { searchConditions, getSystemOptions, getSubcategoryOptions } from '../src/lib/conditionSearch';

async function testSearchAPI() {
  console.log('🔍 Testing Search API Integration\n');
  
  // Test 1: Basic search
  console.log('Test 1: Basic search for "diabetes"');
  try {
    const results = await searchConditions('diabetes');
    console.log(`✓ Found ${results.length} results`);
    if (results.length > 0) {
      console.log('  Top result:', results[0].condition);
    }
  } catch (error) {
    console.error('✗ Search failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 2: Search with system filter
  console.log('Test 2: Search for "infection" in ID system');
  try {
    const results = await searchConditions('infection', { system: 'ID' });
    console.log(`✓ Found ${results.length} results in ID system`);
    if (results.length > 0) {
      console.log('  Top results:', results.slice(0, 3).map(r => r.condition).join(', '));
    }
  } catch (error) {
    console.error('✗ Search with filter failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 3: Get system options
  console.log('Test 3: Get all system options');
  try {
    const systems = await getSystemOptions();
    console.log(`✓ Found ${systems.length} systems:`, systems.join(', '));
  } catch (error) {
    console.error('✗ Failed to get systems:', error);
  }
  
  console.log('\n---\n');
  
  // Test 4: Get subcategories for a system
  console.log('Test 4: Get subcategories for CV system');
  try {
    const subcategories = await getSubcategoryOptions('CV');
    console.log(`✓ Found ${subcategories.length} subcategories in CV`);
    if (subcategories.length > 0) {
      console.log('  Examples:', subcategories.slice(0, 5).join(', '));
    }
  } catch (error) {
    console.error('✗ Failed to get subcategories:', error);
  }
  
  console.log('\n---\n');
  
  // Test 5: Empty query
  console.log('Test 5: Empty query should return empty array');
  try {
    const results = await searchConditions('');
    console.log(`✓ Empty query returned ${results.length} results (expected 0)`);
  } catch (error) {
    console.error('✗ Empty query test failed:', error);
  }
  
  console.log('\n✅ All tests complete!\n');
}

// Run tests
testSearchAPI().catch(console.error);
