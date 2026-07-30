import type { NextConfig } from 'next';

const config: NextConfig = {
  // The dashboard talks to the orchestrator HTTP API; rewrites keep the
  // browser-side CORS simple when both run locally / on the same Vercel project.
  async rewrites() {
    const target = process.env.ORCHESTRATOR_API_URL ?? 'http://localhost:4100';
    return [{ source: '/api/orchestrator/:path*', destination: `${target}/:path*` }];
  },
};

export default config;