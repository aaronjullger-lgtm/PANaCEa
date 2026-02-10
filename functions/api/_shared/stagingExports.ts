/**
 * Re-export staging question processing for admin/staging routes.
 * Ensures Cloudflare Pages Functions bundler resolves processStagingQueueWithCritic.
 */
export { processStagingQueueWithCritic } from './staging-questions';
