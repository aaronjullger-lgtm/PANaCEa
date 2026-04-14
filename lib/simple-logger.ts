/**
 * Compatibility shim for legacy imports.
 *
 * Several hooks and services still import `@/lib/simple-logger`.
 * The canonical logger implementation now lives in `lib/logger.ts`,
 * so this file preserves the older import path without changing callers.
 */

export { logger } from './logger';
