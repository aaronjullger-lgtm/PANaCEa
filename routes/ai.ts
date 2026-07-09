/**
 * AI Routes (Legacy - local dev only)
 *
 * Gemini proxy has been migrated to Cloudflare Pages Functions:
 * - Non-streaming: POST /api/gemini (see functions/api/gemini/index.ts)
 * - Streaming: POST /api/gemini/stream (see functions/api/gemini/stream.ts)
 *
 * This router is kept for potential future AI routes; /geminiProxy was removed.
 */

import { Router } from 'express';

const router = Router();

export default router;
