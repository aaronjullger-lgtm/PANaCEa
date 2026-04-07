/**
 * @deprecated MOVED to /api/drills/overview — this file is a backward-compat
 * redirect only. Remove after confirming no clients hit this path.
 *
 * Cloudflare Function: Get Drill Overview (legacy redirect)
 * Endpoint: GET /api/drill/overview → 301 → /api/drills/overview
 */

import { withCors } from '../_shared/middleware';

export const onRequestOptions = withCors();

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  url.pathname = url.pathname.replace('/api/drill/overview', '/api/drills/overview');
  return Response.redirect(url.toString(), 301);
};
