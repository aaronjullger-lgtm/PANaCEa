/**
 * @deprecated MOVED to /api/drills/contrastive-batch — this file is a
 * backward-compat redirect only. Remove after confirming no clients hit
 * this path.
 *
 * Cloudflare Function: Get Contrastive Drill Batch (legacy redirect)
 * Endpoint: GET /api/drill/contrastive-batch → 301 → /api/drills/contrastive-batch
 */

import { withCors } from '../_shared/middleware';

export const onRequestOptions = withCors();

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  url.pathname = url.pathname.replace(
    '/api/drill/contrastive-batch',
    '/api/drills/contrastive-batch'
  );
  return Response.redirect(url.toString(), 301);
};
