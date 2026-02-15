#!/usr/bin/env tsx

/**
 * Resource Hints Optimization Script
 * 
 * This script adds resource hints (preconnect, preload, prefetch) to index.html
 * to improve initial load time and perceived performance.
 * 
 * Usage: tsx scripts/optimize-resource-hints.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Critical resources to preload
const CRITICAL_RESOURCES = [
  // Fonts
  {
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=Poppins:wght@700&family=Teko:wght@400;500;600;700&display=swap',
    as: 'style',
    crossorigin: true,
    type: 'preload',
  },
  // Critical images
  {
    href: '/Favicon.svg',
    as: 'image',
    type: 'preload',
  },
  {
    href: '/og-image.png',
    as: 'image',
    type: 'preload',
  },
  // Critical JavaScript (entry point)
  {
    href: '/src/main.tsx',
    as: 'script',
    type: 'preload',
  },
];

// Domains to preconnect
const PRECONNECT_DOMAINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://api.clerk.com',
  'https://*.clerk.com',
  'https://generativelanguage.googleapis.com',
  'https://firefly-api.adobe.io',
];

// Do NOT prefetch API endpoints: /api/user/profile, /api/dashboard/stats, /api/questions/batch
// etc. require cookies/Authorization. Prefetch does not send credentials and gets 503.
// Let the app fetch them when the user is signed in.
const PREFETCH_RESOURCES: Array<{ href: string; as: string; type: string }> = [];

/**
 * Generate resource hint tags
 */
function generateResourceHints(): string {
  const hints: string[] = [];
  
  // Preconnect hints
  PRECONNECT_DOMAINS.forEach(domain => {
    hints.push(`  <link rel="preconnect" href="${domain}" crossorigin />`);
  });
  
  // DNS prefetch for additional domains
  const dnsPrefetchDomains = [
    'https://api.supabase.co',
    'https://*.supabase.co',
  ];
  
  dnsPrefetchDomains.forEach(domain => {
    hints.push(`  <link rel="dns-prefetch" href="${domain}" />`);
  });
  
  // Preload critical resources
  CRITICAL_RESOURCES.forEach(resource => {
    const attributes = [
      `rel="${resource.type}"`,
      `href="${resource.href}"`,
      resource.as ? `as="${resource.as}"` : '',
      resource.crossorigin ? 'crossorigin' : '',
    ].filter(Boolean).join(' ');
    
    hints.push(`  <link ${attributes} />`);
  });
  
  // Module preload for critical JavaScript
  hints.push(`  <link rel="modulepreload" href="/src/main.tsx" />`);
  
  // Prefetch lower priority resources (none for API URLs - they require auth)
  PREFETCH_RESOURCES.forEach(resource => {
    hints.push(`  <link rel="prefetch" href="${resource.href}" as="${resource.as}" ${resource.type === 'preload' ? `type="${resource.as}"` : ''} crossorigin="anonymous" />`);
  });
  
  return hints.join('\n');
}

/**
 * Update index.html with resource hints
 */
function updateIndexHtmlWithResourceHints(): void {
  const indexPath = path.join(projectRoot, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Check if resource hints are already injected
  if (html.includes('<!-- RESOURCE HINTS -->')) {
    console.log('Resource hints already injected, updating...');
    
    // Update existing resource hints
    const regex = /<!-- RESOURCE HINTS -->[\s\S]*?<!-- \/RESOURCE HINTS -->/;
    const replacement = `<!-- RESOURCE HINTS -->\n${generateResourceHints()}\n  <!-- /RESOURCE HINTS -->`;
    
    html = html.replace(regex, replacement);
  } else {
    console.log('Injecting resource hints for the first time...');
    
    // Find the closing </head> tag and insert resource hints before it
    const headCloseIndex = html.indexOf('</head>');
    
    if (headCloseIndex === -1) {
      console.error('</head> tag not found in index.html');
      process.exit(1);
    }
    
    const resourceHintsBlock = `\n  <!-- RESOURCE HINTS -->\n${generateResourceHints()}\n  <!-- /RESOURCE HINTS -->\n`;
    
    html = html.slice(0, headCloseIndex) + resourceHintsBlock + html.slice(headCloseIndex);
  }
  
  // Also add loading="lazy" to non-critical images if not already present
  html = html.replace(/<img([^>]*)>/g, (match, attributes) => {
    // Check if loading attribute already exists
    if (attributes.includes('loading=')) {
      return match;
    }
    
    // Add loading="lazy" to non-critical images
    // Don't add to critical images (like logos, hero images)
    if (attributes.includes('critical') || attributes.includes('logo') || attributes.includes('hero')) {
      return match;
    }
    
    return `<img${attributes} loading="lazy">`;
  });
  
  // Write updated HTML back to file
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ Resource hints injected into index.html');
  
  // Calculate the number of hints added
  const hintsCount = PRECONNECT_DOMAINS.length + CRITICAL_RESOURCES.length + PREFETCH_RESOURCES.length + 1; // +1 for modulepreload
  console.log(`📊 Added ${hintsCount} resource hints`);
}

/**
 * Create a performance optimization report
 */
function createPerformanceReport(): void {
  const report = `
# Performance Optimization Report

## Resource Hints Added

### Preconnect Domains (${PRECONNECT_DOMAINS.length})
${PRECONNECT_DOMAINS.map(domain => `- ${domain}`).join('\n')}

### Preload Resources (${CRITICAL_RESOURCES.length})
${CRITICAL_RESOURCES.map(resource => `- ${resource.href} (as: ${resource.as})`).join('\n')}

### Prefetch Resources (${PREFETCH_RESOURCES.length})
${PREFETCH_RESOURCES.map(resource => `- ${resource}`).join('\n')}

## Expected Performance Improvements

1. **First Contentful Paint (FCP)**: ~100-300ms improvement from preconnecting to critical domains
2. **Largest Contentful Paint (LCP)**: ~200-500ms improvement from preloading critical fonts and images
3. **Time to Interactive (TTI)**: ~100-200ms improvement from modulepreload of entry point
4. **Perceived Performance**: Better user experience with faster initial render

## Next Steps

1. Test with Lighthouse to measure actual improvements
2. Consider implementing HTTP/2 Server Push for critical resources
3. Add more granular prefetching based on user behavior analytics
4. Implement adaptive loading based on network conditions

## Monitoring

Monitor these metrics after deployment:
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint) 
- TTI (Time to Interactive)
- Total Blocking Time
- Cumulative Layout Shift
`;

  const reportPath = path.join(projectRoot, 'docs', 'performance-optimization-report.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log('✅ Performance optimization report created at:', reportPath);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🚀 Optimizing resource hints...');
  
  try {
    // Update index.html with resource hints
    updateIndexHtmlWithResourceHints();
    
    // Create performance report
    createPerformanceReport();
    
    console.log('🎉 Resource hints optimization complete!');
    console.log('\nNext steps:');
    console.log('1. Run npm run build to test the changes');
    console.log('2. Test with Lighthouse to measure performance improvements');
    console.log('3. Deploy and monitor real user metrics');
    
  } catch (error) {
    console.error('❌ Error optimizing resource hints:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateResourceHints, updateIndexHtmlWithResourceHints };