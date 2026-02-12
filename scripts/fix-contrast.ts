#!/usr/bin/env tsx
/**
 * Fix Contrast Issues
 * 
 * This script calculates and suggests improved color values for contrast issues
 * identified in the contrast audit.
 */

interface ColorAdjustment {
  variable: string;
  currentValue: string;
  suggestedValue: string;
  contrastImprovement: number;
  reason: string;
}

// Simple color adjustment functions
function darkenHex(hex: string, percent: number): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Darken by percent
  const factor = 1 - (percent / 100);
  const newR = Math.max(0, Math.min(255, Math.floor(r * factor)));
  const newG = Math.max(0, Math.min(255, Math.floor(g * factor)));
  const newB = Math.max(0, Math.min(255, Math.floor(b * factor)));
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

function lightenHex(hex: string, percent: number): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Lighten by percent
  const factor = 1 + (percent / 100);
  const newR = Math.max(0, Math.min(255, Math.floor(r * factor)));
  const newG = Math.max(0, Math.min(255, Math.floor(g * factor)));
  const newB = Math.max(0, Math.min(255, Math.floor(b * factor)));
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Calculate luminance for contrast ratio
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const sRGB = [r, g, b].map(c => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function getContrastRatio(foreground: string, background: string): number {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

async function main() {
  console.log('🎨 PANaCEa Contrast Fix Calculator');
  console.log('==================================\n');
  
  // Based on the audit results, we have two issues in dark mode:
  // 1. --color-accent-button on --color-bg-primary: 4.50:1 (needs 4.5:1, but borderline)
  // 2. --color-text-inverse on --color-accent-button: 3.97:1 (needs 4.5:1)
  
  const darkModeColors = {
    'bg-primary': '#0f172a',
    'accent-button': '#8a7f62',
    'text-inverse': '#f8fafc'
  };
  
  console.log('📊 Current Dark Mode Colors:');
  console.log(`  • --color-bg-primary: ${darkModeColors['bg-primary']}`);
  console.log(`  • --color-accent-button: ${darkModeColors['accent-button']}`);
  console.log(`  • --color-text-inverse: ${darkModeColors['text-inverse']}`);
  console.log('');
  
  // Calculate current contrast ratios
  const currentAccentOnBg = getContrastRatio(darkModeColors['accent-button'], darkModeColors['bg-primary']);
  const currentTextOnAccent = getContrastRatio(darkModeColors['text-inverse'], darkModeColors['accent-button']);
  
  console.log('📈 Current Contrast Ratios:');
  console.log(`  • Accent button on primary background: ${currentAccentOnBg.toFixed(2)}:1`);
  console.log(`  • White text on accent button: ${currentTextOnAccent.toFixed(2)}:1`);
  console.log('');
  
  const adjustments: ColorAdjustment[] = [];
  
  // Fix 1: Accent button on primary background (4.50:1 is borderline, let's improve to 5:1)
  if (currentAccentOnBg < 5) {
    // Darken the accent button slightly for better contrast against dark background
    const suggestedAccent = darkenHex(darkModeColors['accent-button'], 10);
    const newContrast = getContrastRatio(suggestedAccent, darkModeColors['bg-primary']);
    
    adjustments.push({
      variable: '--color-accent-button',
      currentValue: darkModeColors['accent-button'],
      suggestedValue: suggestedAccent,
      contrastImprovement: newContrast - currentAccentOnBg,
      reason: `Improve contrast from ${currentAccentOnBg.toFixed(2)}:1 to ${newContrast.toFixed(2)}:1`
    });
  }
  
  // Fix 2: White text on accent button (3.97:1 needs improvement)
  if (currentTextOnAccent < 4.5) {
    // Option 1: Darken the accent button more (which also helps with issue 1)
    const suggestedAccent = darkenHex(darkModeColors['accent-button'], 15);
    const newContrast = getContrastRatio(darkModeColors['text-inverse'], suggestedAccent);
    
    adjustments.push({
      variable: '--color-accent-button',
      currentValue: darkModeColors['accent-button'],
      suggestedValue: suggestedAccent,
      contrastImprovement: newContrast - currentTextOnAccent,
      reason: `Improve text contrast from ${currentTextOnAccent.toFixed(2)}:1 to ${newContrast.toFixed(2)}:1`
    });
  }
  
  console.log('💡 Suggested Adjustments:');
  console.log('=========================\n');
  
  if (adjustments.length === 0) {
    console.log('✅ No adjustments needed! All contrast ratios meet WCAG AA standards.');
    return;
  }
  
  // Group by variable
  const byVariable: Record<string, ColorAdjustment[]> = {};
  adjustments.forEach(adj => {
    if (!byVariable[adj.variable]) byVariable[adj.variable] = [];
    byVariable[adj.variable].push(adj);
  });
  
  // Show suggestions
  Object.entries(byVariable).forEach(([variable, adjList]) => {
    console.log(`🔧 ${variable}:`);
    console.log(`   Current: ${adjList[0].currentValue}`);
    
    // Find the darkest suggested value (most conservative improvement)
    const darkest = adjList.reduce((prev, curr) => {
      const prevLum = getLuminance(prev.suggestedValue);
      const currLum = getLuminance(curr.suggestedValue);
      return currLum < prevLum ? curr : prev;
    });
    
    console.log(`   Suggested: ${darkest.suggestedValue}`);
    console.log(`   Reason: ${darkest.reason}`);
    
    // Calculate new contrast ratios with the suggested value
    if (variable === '--color-accent-button') {
      const newAccentOnBg = getContrastRatio(darkest.suggestedValue, darkModeColors['bg-primary']);
      const newTextOnAccent = getContrastRatio(darkModeColors['text-inverse'], darkest.suggestedValue);
      
      console.log(`   New contrast ratios:`);
      console.log(`     • On bg-primary: ${newAccentOnBg.toFixed(2)}:1 (${newAccentOnBg >= 4.5 ? '✅' : '❌'} WCAG AA)`);
      console.log(`     • Text on button: ${newTextOnAccent.toFixed(2)}:1 (${newTextOnAccent >= 4.5 ? '✅' : '❌'} WCAG AA)`);
    }
    console.log('');
  });
  
  console.log('📋 Implementation Steps:');
  console.log('=======================\n');
  console.log('1. Open index.css');
  console.log('2. Find the dark mode section (around line 530)');
  console.log('3. Update the --color-accent-button value');
  console.log('4. Run the contrast audit again: npx tsx scripts/contrast-audit.ts');
  console.log('5. Test the changes in the browser');
  console.log('');
  
  // Show exact CSS changes
  console.log('🎯 Exact CSS Changes Needed:');
  console.log('============================\n');
  
  Object.entries(byVariable).forEach(([variable, adjList]) => {
    const darkest = adjList.reduce((prev, curr) => {
      const prevLum = getLuminance(prev.suggestedValue);
      const currLum = getLuminance(curr.suggestedValue);
      return currLum < prevLum ? curr : prev;
    });
    
    console.log(`In the dark mode section of index.css:`);
    console.log(`Change: ${variable}: ${darkest.currentValue};`);
    console.log(`To:     ${variable}: ${darkest.suggestedValue};`);
    console.log('');
  });
}

main().catch(console.error);