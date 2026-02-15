#!/usr/bin/env tsx
/**
 * Contrast Ratio Audit Script
 *
 * This script analyzes the color combinations in the PANaCEa application
 * to identify WCAG contrast ratio issues and provide recommendations.
 */

interface ColorPair {
  foreground: string;
  background: string;
  foregroundName: string;
  backgroundName: string;
  description: string;
}

interface ContrastIssue {
  foreground: string;
  background: string;
  foregroundName: string;
  backgroundName: string;
  description: string;
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

// Color definitions from the CSS custom properties
const LIGHT_MODE_COLORS = {
  // Background colors
  'bg-primary': '#F8FAFC', // slate-50
  'bg-secondary': '#ffffff',
  'bg-tertiary': '#f1f5f9',

  // Text colors
  'text-primary': '#0f172a', // slate-900
  'text-secondary': '#475569', // slate-600
  'text-muted': '#64748b', // slate-500

  // Accent colors - UPDATED for better contrast
  accent: '#7a6f52', // darker gold (was: #9a8f72)
  'accent-button': '#7B6C4F', // darker gold for buttons
  'accent-hover': '#6a5f42', // updated to match

  // Semantic colors - UPDATED for better contrast
  'data-pass': '#0a766c', // teal-700 (was: #0d9488)
  'data-fail': '#b91c1c', // red-700
  'data-provisional': '#b45309', // amber-700

  // Border colors
  border: '#e2e8f0',
  'border-light': '#f1f5f9',

  // Category colors - UPDATED for better contrast
  'category-visual': '#8c6666', // Dusty Rose 600 (was: #a67f7f)
  'category-simulation': '#806680', // Deep Plum 600 (was: #9a7f9a)
  'category-practice': '#728ba6', // Steel Blue
  'category-specialty': '#b39b6c', // Muted Amber
  'category-toolkit': '#7a8f6e', // Sage
  'category-command': '#5e8686', // Slate-Teal
};

const DARK_MODE_COLORS = {
  // Background colors
  'bg-primary': '#0f172a', // slate-900
  'bg-secondary': '#1e293b', // slate-800
  'bg-tertiary': '#334155', // slate-700

  // Text colors
  'text-primary': '#f1f5f9', // slate-50
  'text-secondary': '#cbd5e1', // slate-300
  'text-muted': '#94a3b8', // slate-400

  // Accent colors
  accent: '#a89b7a', // gold (lighter)
  'accent-button': '#8a7f62', // lighter gold for 4.5:1 contrast with dark background (was: #7a6f52)
  'accent-hover': '#b8ab8a',

  // Semantic colors
  'data-pass': '#14b8a6', // teal-500
  'data-fail': '#ef4444', // red-500
  'data-provisional': '#d97706', // amber-600

  // Border colors
  border: '#475569',
  'border-light': '#334155',

  // Category colors (lighter versions for dark mode)
  'category-visual': '#c09e9e', // Dusty Rose (lighter)
  'category-simulation': '#b6a0b6', // Deep Plum (lighter)
  'category-practice': '#91a6bd', // Steel Blue (lighter)
  'category-specialty': '#c5b38a', // Muted Amber (lighter)
  'category-toolkit': '#96a78a', // Sage (lighter)
  'category-command': '#7da3a3', // Slate-Teal (lighter)
};

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b];
}

function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const normalized = c / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(foreground: string, background: string): number {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  const l1 = getLuminance(fgRgb);
  const l2 = getLuminance(bgRgb);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

function meetsContrastStandard(
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean {
  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7;
  }
  return size === 'large' ? ratio >= 3 : ratio >= 4.5;
}

function getSeverity(ratio: number): 'low' | 'medium' | 'high' {
  if (ratio < 3) return 'high'; // Fails even large text AA
  if (ratio < 4.5) return 'medium'; // Fails normal text AA
  if (ratio < 7) return 'low'; // Fails AAA but passes AA
  return 'low'; // Passes AAA
}

function getRecommendation(
  foregroundName: string,
  backgroundName: string,
  ratio: number,
  severity: 'low' | 'medium' | 'high'
): string {
  const recommendations = {
    high: `CRITICAL: Ratio ${ratio.toFixed(2)}:1 fails WCAG AA for large text. Consider using a darker foreground or lighter background.`,
    medium: `IMPORTANT: Ratio ${ratio.toFixed(2)}:1 fails WCAG AA for normal text. Consider increasing contrast by at least ${(4.5 - ratio).toFixed(2)}.`,
    low: `GOOD: Ratio ${ratio.toFixed(2)}:1 passes WCAG AA. For AAA compliance, aim for 7:1 or higher.`,
  };

  return recommendations[severity];
}

function analyzeColorPairs(
  colors: Record<string, string>,
  mode: 'light' | 'dark'
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  // Common color combinations to check
  const colorPairs: ColorPair[] = [
    // Primary text combinations
    {
      foreground: colors['text-primary'],
      background: colors['bg-primary'],
      foregroundName: 'text-primary',
      backgroundName: 'bg-primary',
      description: 'Primary text on primary background',
    },
    {
      foreground: colors['text-primary'],
      background: colors['bg-secondary'],
      foregroundName: 'text-primary',
      backgroundName: 'bg-secondary',
      description: 'Primary text on secondary background',
    },
    {
      foreground: colors['text-secondary'],
      background: colors['bg-primary'],
      foregroundName: 'text-secondary',
      backgroundName: 'bg-primary',
      description: 'Secondary text on primary background',
    },
    {
      foreground: colors['text-muted'],
      background: colors['bg-primary'],
      foregroundName: 'text-muted',
      backgroundName: 'bg-primary',
      description: 'Muted text on primary background',
    },

    // Accent color combinations
    {
      foreground: colors['accent'],
      background: colors['bg-primary'],
      foregroundName: 'accent',
      backgroundName: 'bg-primary',
      description: 'Accent color on primary background',
    },
    {
      foreground: colors['accent-button'],
      background: colors['bg-primary'],
      foregroundName: 'accent-button',
      backgroundName: 'bg-primary',
      description: 'Accent button color on primary background',
    },

    // Button text on accent backgrounds
    {
      foreground: '#ffffff', // White text
      background: colors['accent-button'],
      foregroundName: 'white',
      backgroundName: 'accent-button',
      description: 'White text on accent button background',
    },

    // Semantic data colors
    {
      foreground: colors['data-pass'],
      background: colors['bg-primary'],
      foregroundName: 'data-pass',
      backgroundName: 'bg-primary',
      description: 'Pass/success color on primary background',
    },
    {
      foreground: colors['data-fail'],
      background: colors['bg-primary'],
      foregroundName: 'data-fail',
      backgroundName: 'bg-primary',
      description: 'Fail/error color on primary background',
    },
    {
      foreground: colors['data-provisional'],
      background: colors['bg-primary'],
      foregroundName: 'data-provisional',
      backgroundName: 'bg-primary',
      description: 'Provisional/warning color on primary background',
    },

    // Category colors
    {
      foreground: colors['category-visual'],
      background: colors['bg-primary'],
      foregroundName: 'category-visual',
      backgroundName: 'bg-primary',
      description: 'Visual category color on primary background',
    },
    {
      foreground: colors['category-simulation'],
      background: colors['bg-primary'],
      foregroundName: 'category-simulation',
      backgroundName: 'bg-primary',
      description: 'Simulation category color on primary background',
    },
  ];

  for (const pair of colorPairs) {
    const ratio = getContrastRatio(pair.foreground, pair.background);
    const meetsAA = meetsContrastStandard(ratio, 'AA', 'normal');
    const meetsAAA = meetsContrastStandard(ratio, 'AAA', 'normal');
    const severity = getSeverity(ratio);
    const recommendation = getRecommendation(
      pair.foregroundName,
      pair.backgroundName,
      ratio,
      severity
    );

    issues.push({
      foreground: pair.foreground,
      background: pair.background,
      foregroundName: pair.foregroundName,
      backgroundName: pair.backgroundName,
      description: pair.description,
      ratio,
      meetsAA,
      meetsAAA,
      severity,
      recommendation,
    });
  }

  return issues;
}

function printResults(issues: ContrastIssue[], mode: 'light' | 'dark') {
  console.log(`\n=== ${mode.toUpperCase()} MODE CONTRAST AUDIT ===\n`);

  const highIssues = issues.filter((i) => i.severity === 'high');
  const mediumIssues = issues.filter((i) => i.severity === 'medium');
  const lowIssues = issues.filter((i) => i.severity === 'low');

  console.log(`📊 Summary:`);
  console.log(`  • High priority issues: ${highIssues.length}`);
  console.log(`  • Medium priority issues: ${mediumIssues.length}`);
  console.log(`  • Low priority issues: ${lowIssues.length}`);
  console.log(`  • Total combinations checked: ${issues.length}\n`);

  if (highIssues.length > 0) {
    console.log(`🚨 HIGH PRIORITY ISSUES (Fails WCAG AA for large text):`);
    highIssues.forEach((issue) => {
      console.log(`  • ${issue.description}`);
      console.log(
        `    Ratio: ${issue.ratio.toFixed(2)}:1 (AA: ${issue.meetsAA ? '✓' : '✗'}, AAA: ${issue.meetsAAA ? '✓' : '✗'})`
      );
      console.log(`    Recommendation: ${issue.recommendation}\n`);
    });
  }

  if (mediumIssues.length > 0) {
    console.log(`⚠️ MEDIUM PRIORITY ISSUES (Fails WCAG AA for normal text):`);
    mediumIssues.forEach((issue) => {
      console.log(`  • ${issue.description}`);
      console.log(
        `    Ratio: ${issue.ratio.toFixed(2)}:1 (AA: ${issue.meetsAA ? '✓' : '✗'}, AAA: ${issue.meetsAAA ? '✓' : '✗'})`
      );
      console.log(`    Recommendation: ${issue.recommendation}\n`);
    });
  }

  if (lowIssues.length > 0) {
    console.log(`✅ GOOD CONTRAST RATIOS (Passes WCAG AA):`);
    lowIssues.forEach((issue) => {
      console.log(`  • ${issue.description}`);
      console.log(
        `    Ratio: ${issue.ratio.toFixed(2)}:1 (AA: ✓, AAA: ${issue.meetsAAA ? '✓' : '✗'})`
      );
    });
  }
}

function generateFixRecommendations(issues: ContrastIssue[]): string[] {
  const recommendations: string[] = [];

  issues.forEach((issue) => {
    if (issue.severity === 'high' || issue.severity === 'medium') {
      const currentRatio = issue.ratio;
      const targetRatio = issue.severity === 'high' ? 3 : 4.5;
      const neededImprovement = (targetRatio - currentRatio).toFixed(2);

      recommendations.push(
        `Fix ${issue.foregroundName} on ${issue.backgroundName}: ` +
          `Current ratio ${currentRatio.toFixed(2)}:1 needs ${neededImprovement} improvement ` +
          `to reach WCAG ${issue.severity === 'high' ? 'AA (large text)' : 'AA (normal text)'}`
      );
    }
  });

  return recommendations;
}

async function main() {
  console.log('🔍 PANaCEa Contrast Ratio Audit');
  console.log('================================\n');

  // Analyze light mode
  const lightIssues = analyzeColorPairs(LIGHT_MODE_COLORS, 'light');
  printResults(lightIssues, 'light');

  // Analyze dark mode
  const darkIssues = analyzeColorPairs(DARK_MODE_COLORS, 'dark');
  printResults(darkIssues, 'dark');

  // Generate overall recommendations
  console.log('\n💡 RECOMMENDATIONS FOR IMPROVEMENT:\n');

  const allIssues = [...lightIssues, ...darkIssues];
  const highMediumIssues = allIssues.filter(
    (i) => i.severity === 'high' || i.severity === 'medium'
  );

  if (highMediumIssues.length === 0) {
    console.log('✅ All color combinations meet WCAG AA standards!');
    console.log('Consider aiming for AAA compliance (7:1 ratio) for critical text.');
  } else {
    const recommendations = generateFixRecommendations(highMediumIssues);
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    console.log('\n🎯 PRIORITY ACTIONS:');
    console.log('1. Focus on high priority issues first (fails large text AA)');
    console.log('2. Use the ContrastRatioAudit component to test fixes');
    console.log('3. Update CSS custom properties in index.css');
    console.log('4. Test with real users who have visual impairments');
  }

  console.log('\n📋 NEXT STEPS:');
  console.log('1. Run the ContrastRatioAudit component in the app');
  console.log('2. Use browser dev tools to test color combinations');
  console.log('3. Consider implementing automatic contrast checking in CI/CD');
  console.log('4. Document contrast requirements in design system');
}

main().catch(console.error);
