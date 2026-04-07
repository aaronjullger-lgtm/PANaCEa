/**
 * Stub for @sentry/cloudflare
 * Used during testing to avoid dynamic import errors
 */

export const captureException = () => {};
export const captureMessage = () => {};
export const withScope = (callback: () => void) => callback();

export default {
  captureException,
  captureMessage,
  withScope,
};
