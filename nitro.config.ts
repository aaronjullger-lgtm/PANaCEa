import { defineNitroConfig } from 'nitro/config';

/**
 * Nitro + Workflow DevKit runtime for PANaCEa durable automation.
 *
 * Separate from the main Vite frontend build — does not affect `npm run dev` / `npm run build`.
 * Start with: npm run workflow:dev
 */
export default defineNitroConfig({
  modules: ['workflow/nitro'],
  vercel: { entryFormat: 'node' },
  alias: {
    '@': '.',
  },
  serverEntry: {
    handler: './workflow-server/index.ts',
    format: 'node',
  },
});
