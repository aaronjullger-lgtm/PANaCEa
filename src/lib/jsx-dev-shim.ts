/**
 * Production shim for react/jsx-dev-runtime
 *
 * In development, React uses jsx-dev-runtime which exports `jsxDEV`.
 * In production builds, only jsx-runtime is available (exports `jsx` and `jsxs`).
 *
 * Some dependencies or code compiled with the dev JSX transform reference `jsxDEV`,
 * which doesn't exist in the production jsx-runtime. This shim re-exports `jsx` as
 * `jsxDEV` so those references work in production builds.
 *
 * See: https://github.com/facebook/react/issues/24304
 */
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

export { Fragment };
export const jsxDEV = jsx;
export const jsxsDEV = jsxs;

// Also export as default for compatibility
export default { jsxDEV: jsx, jsxsDEV: jsxs, Fragment };