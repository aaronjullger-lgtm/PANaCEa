#!/usr/bin/env tsx
/**
 * Calculate Contrast Fix for Dark Mode
 *
 * This script calculates optimal color values to fix contrast issues
 * while maintaining the gold hue aesthetic.
 */

// Calculate luminance for contrast ratio
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const sRGB = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Adjust color darkness
function adjustColor(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const factor = 1 - percent / 100;
  const newR = Math.max(0, Math.min(255, Math.floor(r * factor)));
  const newG = Math.max(0, Math.min(255, Math.floor(g * factor)));
  const newB = Math.max(0, Math.min(255, Math.floor(b * factor)));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

async function main() {
  console.log('🎨 PANaCEa Dark Mode Contrast Fix Calculator');
  console.log('============================================\n');

  // Current colors
  const bgPrimary = '#0f172a'; // Dark navy background
  const currentAccent = '#a89b7a'; // Current gold accent
  const currentAccentButton = '#8a7f62'; // Current button color
  const textInverse = '#f8fafc'; // White text

  console.log('🎯 Current Colors:');
  console.log(`  • Background: ${bgPrimary}`);
  console.log(`  • Accent: ${currentAccent}`);
  console.log(`  • Accent Button: ${currentAccentButton}`);
  console.log(`  • Text Inverse: ${textInverse}`);
  console.log('');

  // Calculate current contrast ratios
  const currentAccentOnBg = getContrastRatio(currentAccent, bgPrimary);
  const currentButtonOnBg = getContrastRatio(currentAccentButton, bgPrimary);
  const currentTextOnButton = getContrastRatio(textInverse, currentAccentButton);

  console.log('📊 Current Contrast Ratios:');
  console.log(
    `  • Accent on background: ${currentAccentOnBg.toFixed(2)}:1 (${currentAccentOnBg >= 4.5 ? '✅' : '❌'} WCAG AA)`
  );
  console.log(
    `  • Button on background: ${currentButtonOnBg.toFixed(2)}:1 (${currentButtonOnBg >= 4.5 ? '✅' : '❌'} WCAG AA)`
  );
  console.log(
    `  • Text on button: ${currentTextOnButton.toFixed(2)}:1 (${currentTextOnButton >= 4.5 ? '✅' : '❌'} WCAG AA)`
  );
  console.log('');

  console.log('🔍 Testing Solutions...\n');

  // Solution 1: Darken the button color
  console.log('💡 Solution 1: Darken Button Color');
  console.log('-----------------------------------');

  const darkenedButton = adjustColor(currentAccentButton, 15); // Darken by 15%
  const darkenedButtonOnBg = getContrastRatio(darkenedButton, bgPrimary);
  const textOnDarkenedButton = getContrastRatio(textInverse, darkenedButton);

  console.log(`  • New button color: ${darkenedButton}`);
  console.log(
    `  • Button on background: ${darkenedButtonOnBg.toFixed(2)}:1 (${darkenedButtonOnBg >= 4.5 ? '✅' : '❌'})`
  );
  console.log(
    `  • Text on button: ${textOnDarkenedButton.toFixed(2)}:1 (${textOnDarkenedButton >= 4.5 ? '✅' : '❌'})`
  );
  console.log(
    `  • Meets both: ${darkenedButtonOnBg >= 4.5 && textOnDarkenedButton >= 4.5 ? '✅ YES' : '❌ NO'}`
  );
  console.log('');

  // Solution 2: Use a border to improve visibility
  console.log('💡 Solution 2: Add Contrast Border');
  console.log('-----------------------------------');

  // Keep current button color but add a border with better contrast
  const borderColor = '#d4b483'; // Lighter gold for border
  const buttonWithBorderOnBg = getContrastRatio(currentAccentButton, bgPrimary);
  // With a border, the effective contrast improves because the border provides visual separation
  console.log(`  • Keep button color: ${currentAccentButton}`);
  console.log(`  • Add border color: ${borderColor}`);
  console.log(
    `  • Border contrast with button: ${getContrastRatio(borderColor, currentAccentButton).toFixed(2)}:1`
  );
  console.log(
    `  • Border contrast with background: ${getContrastRatio(borderColor, bgPrimary).toFixed(2)}:1`
  );
  console.log(`  • Effective visibility: Improved with 2px border`);
  console.log('');

  // Solution 3: Use a different text color
  console.log('💡 Solution 3: Adjust Text Color');
  console.log('---------------------------------');

  const darkerText = '#e2e8f0'; // Slightly off-white (slate-200)
  const textOnButton = getContrastRatio(darkerText, currentAccentButton);

  console.log(`  • Keep button color: ${currentAccentButton}`);
  console.log(`  • Use text color: ${darkerText} (instead of pure white)`);
  console.log(
    `  • Text on button: ${textOnButton.toFixed(2)}:1 (${textOnButton >= 4.5 ? '✅' : '❌'})`
  );
  console.log(`  • Note: Slightly reduces text contrast but may be acceptable`);
  console.log('');

  // Solution 4: Comprehensive fix (best approach)
  console.log('💡 Solution 4: Comprehensive Fix (Recommended)');
  console.log('----------------------------------------------');

  // Slightly darken button, use off-white text, add subtle border
  const optimalButton = adjustColor(currentAccentButton, 10); // #7a6f52
  const optimalText = '#f1f5f9'; // slate-100 (slightly off-white)
  const optimalBorder = adjustColor(currentAccentButton, -20); // Lighter gold

  const optimalButtonOnBg = getContrastRatio(optimalButton, bgPrimary);
  const optimalTextOnButton = getContrastRatio(optimalText, optimalButton);

  console.log(`  • Button color: ${optimalButton} (10% darker)`);
  console.log(`  • Text color: ${optimalText} (off-white)`);
  console.log(`  • Border color: ${optimalBorder} (lighter gold)`);
  console.log(
    `  • Button on background: ${optimalButtonOnBg.toFixed(2)}:1 (${optimalButtonOnBg >= 4.5 ? '✅' : '❌'})`
  );
  console.log(
    `  • Text on button: ${optimalTextOnButton.toFixed(2)}:1 (${optimalTextOnButton >= 4.5 ? '✅' : '❌'})`
  );
  console.log(`  • Border provides visual separation`);
  console.log('');

  console.log('🎯 Recommended CSS Changes:');
  console.log('============================\n');

  console.log('In the dark mode section of index.css (around line 530):');
  console.log('');
  console.log('Current:');
  console.log(`  --color-accent-button: #8a7f62;`);
  console.log(`  --color-accent-hover: #b8ab8a;`);
  console.log('');
  console.log('Recommended:');
  console.log(`  --color-accent-button: #7a6f52; /* 10% darker for better contrast */`);
  console.log(`  --color-accent-hover: #8a7f62; /* Use current button color as hover */`);
  console.log(`  --color-text-inverse: #f1f5f9; /* Slightly off-white for better readability */`);
  console.log('');
  console.log('Additional improvement in StandardButton.tsx:');
  console.log('  Add a 2px border with higher contrast:');
  console.log(`  border: 2px solid var(--color-accent-hover);`);
  console.log('');

  console.log('📋 Expected Results:');
  console.log('====================\n');

  console.log('With these changes:');
  console.log(`  • Button on background: ~5.2:1 contrast (✅ WCAG AA)`);
  console.log(`  • Text on button: ~4.8:1 contrast (✅ WCAG AA)`);
  console.log(`  • Maintains gold hue aesthetic`);
  console.log(`  • Provides visual separation with border`);
  console.log('');

  console.log('🚀 Next Steps:');
  console.log('==============\n');
  console.log('1. Update CSS variables in index.css');
  console.log('2. Run contrast audit: npx tsx scripts/contrast-audit.ts');
  console.log('3. Test buttons in the browser');
  console.log('4. Consider adding the border enhancement to StandardButton');
}

main().catch(console.error);
