/**
 * GET /api/recommendations
 *
 * Re-exports from list.ts to handle the base route.
 * Cloudflare Pages Functions requires index.ts for /api/recommendations
 */

export { onRequestGet, onRequestOptions } from './list';
