// CJS safety shim for environments where a misloaded bundle expects `exports`/`module` globals.
// Some third-party bundles (e.g., icon packs) can throw if executed without CommonJS scaffolding.
if (typeof (globalThis as any).exports === 'undefined') {
  (globalThis as any).exports = {};
}

if (typeof (globalThis as any).module === 'undefined') {
  (globalThis as any).module = { exports: (globalThis as any).exports };
}

// Process polyfill for browser compatibility
// Some Node.js libraries check `process.env` or `typeof process` at runtime
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = {
    env: {
      NODE_ENV: import.meta.env?.MODE || 'production',
    },
    cwd: () => '/',
    browser: true,
    version: '',
    versions: {},
    platform: 'browser',
  };
}
