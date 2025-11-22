
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

declare global {
  // Deprecated filters left for backward compatibility with older bundles.
  // Keeping these defined prevents ReferenceErrors in environments that may
  // still reference the old global variables.
  // eslint-disable-next-line no-var
  var systemFilter: unknown;
  // eslint-disable-next-line no-var
  var subcategoryFilter: unknown;
}

// Ensure globals exist so any legacy references do not throw at runtime.
// These are intentionally side-effectful and should not be tree-shaken.
(globalThis as any).systemFilter = (globalThis as any).systemFilter ?? undefined;
(globalThis as any).subcategoryFilter =
  (globalThis as any).subcategoryFilter ?? undefined;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
