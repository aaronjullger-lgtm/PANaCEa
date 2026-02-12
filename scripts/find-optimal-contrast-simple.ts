#!/usr/bin/env tsx
/**
 * Find Optimal Contrast Color - Simple Version
 * 
 * This script finds an optimal color value that balances both contrast requirements.
 */

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

function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Generate a range of colors by adjusting lightness
function generateColorRange(baseHex: string, steps: number = 20): string[] {
  const colors: string[] = [];
  
  // Parse base color
  const baseR = parseInt(baseHex.slice(1, 3), 16);
  const baseG = parseInt(baseHex.slice(3, 5), 16);
  const baseB = parseInt(baseHex.slice(5, 7), 16);
  
  // Generate darker and lighter versions
  for (let i = -steps; i <= steps; i++) {
    const factor = 1 + (i * 0.03); // Adjust lightness by 3% per step
    
    const r = Math.max(0, Math.min(255, Math.floor(baseR * factor)));
    const g = Math.max(0, Math.min(255, Math.floor(baseG * factor)));
    const b = Math.max(0, Math.min(255, Math.floor(baseB * factor)));
    
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    colors.push(hex);
  }
  
  return colors;
}

async function main() {
  console.log('🎨 PANaCEa Optimal Contrast Finder');
  console.log('==================================\n');
  
  const bgPrimary = '#0f172a';    // Dark navy background
  const textInverse = '#f8fafc';  // White text
  const currentAccent = '#8a7f62'; // Current gold accent
  
  console.log('🎯 Target Requirements:');
  console.log('  1. Button on background: ≥ 4.5:1 contrast (WCAG AA)');
  console.log('  2. White text on button: ≥ 4.5:1 contrast (WCAG AA)');
  console.log('');
  
  console.log('📊 Current Performance:');
  const currentOnBg = getContrastRatio(currentAccent, bgPrimary);
  const currentTextOnBtn = getContrastRatio(textInverse, currentAccent);
  console.log(`  • Button on background: ${currentOnBg.toFixed(2)}:1 (${currentOnBg >= 4.5 ? '✅' : '❌'})`);
  console.log(`  • Text on button: ${currentTextOnBtn.toFixed(2)}:1 (${currentTextOnBtn >= 4.5 ? '✅' : '❌'})`);
  console.log('');
  
  // Generate and test color variations
  console.log('🔍 Testing color variations...\n');
  const colors = generateColorRange(currentAccent, 15);
  
  const candidates: Array<{
    hex: string;
    contrastOnBg: number;
    textContrast: number;
    meetsBoth: boolean;
    minContrast: number;
  }> = [];
  
  for (const hex of colors) {
    const contrastOnBg = getContrastRatio(hex, bgPrimary);
    const textContrast = getContrastRatio(textInverse, hex);
    const meetsBoth = contrastOnBg >= 4.5 && textContrast >= 4.5;
    const minContrast = Math.min(contrastOnBg, textContrast);
    
    candidates.push({
      hex,
      contrastOnBg,
      textContrast,
      meetsBoth,
      minContrast
    });
  }
  
  // Sort by whether they meet both requirements, then by minimum contrast
  candidates.sort((a, b) => {
    if (a.meetsBoth && !b.meetsBoth) return -1;
    if (!a.meetsBoth && b.meetsBoth) return 1;
    return b.minContrast - a.minContrast;
  });
  
  console.log('🏆 Top 5 Candidates:');
  console.log('====================\n');
  
  const topCandidates = candidates.slice(0, 5);
  topCandidates.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.hex}`);
    console.log(`   Button on background: ${candidate.contrastOnBg.toFixed(2)}:1 (${candidate.contrastOnBg >= 4.5 ? '✅' : '❌'})`);
    console.log(`   Text on button: ${candidate.textContrast.toFixed(2)}:1 (${candidate.textContrast >= 4.5 ? '✅' : '❌'})`);
    console.log(`   Meets both requirements: ${candidate.meetsBoth ? '✅ YES' : '❌ NO'}`);
    console.log('');
  });
  
  // Find the best candidate that meets both requirements
  const bestCandidate = candidates.find(c => c.meetsBoth);
  
  console.log('💡 Recommendation:');
  console.log('==================\n');
  
  if (bestCandidate) {
    console.log(`✅ Found optimal color: ${bestCandidate.hex}`);
    console.log(`   This color meets both WCAG AA requirements:`);
    console.log(`   • Button on background: ${bestCandidate.contrastOnBg.toFixed(2)}:1`);
    console.log(`   • Text on button: ${bestCandidate.textContrast.toFixed(2)}:1`);
    console.log('');
    console.log(`📋 CSS Change:`);
    console.log(`   Change --color-accent-button from ${currentAccent} to ${bestCandidate.hex}`);
    
    // Calculate suggested hover color (slightly lighter)
    const hoverR = Math.min(255, parseInt(bestCandidate.hex.slice(1, 3), 16) + 20);
    const hoverG = Math.min(255, parseInt(bestCandidate.hex.slice(3, 5), 16) + 20);
    const hoverB = Math.min(255, parseInt(bestCandidate.hex.slice(5, 7), 16) + 20);
    const suggestedHover = `#${hoverR.toString(16).padStart(2, '0')}${hoverG.toString(16).padStart(2, '0')}${hoverB.toString(16).padStart(2, '0')}`;
    
    console.log(`   Consider updating --color-accent-hover from #b8ab8a to ${suggestedHover}`);
  } else {
    console.log('❌ No single color meets both requirements with the current hue.');
    console.log('');
    console.log('💡 Alternative Solutions:');
    console.log('  1. Use a border or outline on buttons to improve visibility');
    console.log('  2. Use a slightly different text color on buttons');
    console.log('  3. Adjust the background color for buttons');
    console.log('  4. Use a different hue for accent buttons');
  }
}

main().catch(console.error);