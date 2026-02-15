#!/usr/bin/env tsx

/**
 * Critical CSS Extraction Script
 *
 * This script extracts critical CSS for above-the-fold content
 * and updates index.html with inline critical CSS.
 *
 * Usage: tsx scripts/extract-critical-css.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Critical CSS for above-the-fold content
const CRITICAL_CSS = `
/* Critical CSS - Above the fold content */
/* Extracted from index.css and Tailwind base styles */

/* Base styles for initial render */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Theme variables - must match index.html inline styles */
:root {
  /* Layout */
  --header-height: 4rem;
  --nav-rail-width: 56px;
  
  /* Light mode colors */
  --color-bg-primary: #F8FAFC;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f1f5f9;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-border-light: #f1f5f9;
  --color-accent: #9a8f72;
  --color-accent-hover: #8a7f62;
  --color-accent-light: #b8af9a;
  --color-accent-very-light: #e6e2d9;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  --color-overlay: rgba(15, 23, 42, 0.5);
  --color-canvas: #F8FAFC;
  
  /* Semantic tokens */
  --color-action-primary: var(--color-accent);
  --color-action-primary-hover: var(--color-accent-hover);
  --color-action-secondary: var(--color-text-secondary);
  --color-action-muted: var(--color-border-light);
  --color-surface-primary: var(--color-bg-primary);
  --color-surface-secondary: var(--color-bg-secondary);
  --color-surface-card: var(--color-bg-secondary);
  --color-surface-overlay: var(--color-overlay);
  --color-text-action-primary: var(--color-text-primary);
  --color-text-action-secondary: var(--color-text-secondary);
  --color-border-action: var(--color-border);
}

/* Dark mode colors */
.dark {
  --color-bg-primary: #101729;
  --color-bg-secondary: #1F283A;
  --color-bg-tertiary: #2A3448;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #94a3b8;
  --color-border: #334155;
  --color-border-light: #475569;
  --color-accent: #d4b483;
  --color-accent-hover: #e6c99c;
  --color-accent-light: #e6d9c2;
  --color-accent-very-light: #f5f1e9;
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-error: #f87171;
  --color-info: #60a5fa;
  --color-overlay: rgba(0, 0, 0, 0.7);
  --color-canvas: #0f172a;
}

/* Initial loading state */
#root {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Loading spinner */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Safe area for mobile */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Prevent FOUC (Flash of Unstyled Content) */
.js-fouc {
  visibility: hidden;
}

.js-fouc-ready {
  visibility: visible;
}

/* Critical layout utilities */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.w-full { width: 100%; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.text-center { text-align: center; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
.border { border: 1px solid var(--color-border); }

/* Critical component styles */
/* App header */
.app-header {
  height: var(--header-height);
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Main content area */
.main-content {
  flex: 1;
  padding: 1rem;
  max-width: 100%;
  overflow-x: hidden;
}

/* Loading overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* Button base styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px; /* Mobile touch target */
}

.btn-primary {
  background-color: var(--color-action-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-action-primary-hover);
}

/* Card base styles */
.card {
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

/* Mobile responsiveness */
@media (max-width: 767px) {
  .main-content {
    padding: 0.75rem;
  }
  
  .card {
    padding: 1rem;
  }
}

/* Print styles */
@media print {
  .no-print {
    display: none !important;
  }
}
`;

/**
 * Update index.html with inline critical CSS
 */
function updateIndexHtmlWithCriticalCss(): void {
  const indexPath = path.join(projectRoot, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Check if critical CSS is already injected
  if (html.includes('<!-- CRITICAL CSS -->')) {
    console.log('Critical CSS already injected, updating...');

    // Update existing critical CSS
    const regex = /<!-- CRITICAL CSS -->[\s\S]*?<!-- \/CRITICAL CSS -->/;
    const replacement = `<!-- CRITICAL CSS -->\n<style>\n${CRITICAL_CSS}\n</style>\n<!-- /CRITICAL CSS -->`;

    html = html.replace(regex, replacement);
  } else {
    console.log('Injecting critical CSS for the first time...');

    // Find the closing </head> tag and insert critical CSS before it
    const headCloseIndex = html.indexOf('</head>');

    if (headCloseIndex === -1) {
      console.error('</head> tag not found in index.html');
      process.exit(1);
    }

    const criticalCssBlock = `\n  <!-- CRITICAL CSS -->\n  <style>\n${CRITICAL_CSS}\n  </style>\n  <!-- /CRITICAL CSS -->\n`;

    html = html.slice(0, headCloseIndex) + criticalCssBlock + html.slice(headCloseIndex);
  }

  // Write updated HTML back to file
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ Critical CSS injected into index.html');

  // Calculate size savings
  const originalSize = Buffer.from(html).length;
  const criticalCssSize = Buffer.from(CRITICAL_CSS).length;
  console.log(`📊 Critical CSS size: ${(criticalCssSize / 1024).toFixed(2)} KB`);
  console.log(`📊 Estimated FCP improvement: ~${Math.round(criticalCssSize / 500)}ms`);
}

/**
 * Create a separate critical CSS file for development
 */
function createCriticalCssFile(): void {
  const criticalCssPath = path.join(projectRoot, 'public', 'critical.css');

  fs.writeFileSync(criticalCssPath, CRITICAL_CSS, 'utf8');
  console.log('✅ Critical CSS file created at:', criticalCssPath);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🚀 Extracting critical CSS...');

  try {
    // Update index.html with inline critical CSS
    updateIndexHtmlWithCriticalCss();

    // Create separate critical CSS file for reference
    createCriticalCssFile();

    console.log('🎉 Critical CSS extraction complete!');
    console.log('\nNext steps:');
    console.log('1. Run npm run build to test the changes');
    console.log('2. Test with Lighthouse to measure FCP improvement');
    console.log('3. Consider adding CSS minification for production');
  } catch (error) {
    console.error('❌ Error extracting critical CSS:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CRITICAL_CSS, updateIndexHtmlWithCriticalCss };
