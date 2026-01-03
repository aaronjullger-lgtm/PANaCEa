// CJS safety shim for environments where a misloaded bundle expects `exports`/`module` globals.
// Some third-party bundles (e.g., icon packs) can throw if executed without CommonJS scaffolding.
if (typeof (globalThis as any).exports === 'undefined') {
  (globalThis as any).exports = {};
}

if (typeof (globalThis as any).module === 'undefined') {
  (globalThis as any).module = { exports: (globalThis as any).exports };
}
