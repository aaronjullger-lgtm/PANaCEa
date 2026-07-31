import { cronEndpoint, ok } from '../_shared/endpoint';
import { d1PurgeExpired, d1Count } from '../_shared/d1-cache';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const db = context.env.EDGE_DB;
    if (!db) return ok({ purged: 0, skipped: true, reason: 'EDGE_DB not bound' });

    const before = await d1Count(db);
    const purged = await d1PurgeExpired(db);
    const after = await d1Count(db);

    return ok({ purged, before, after });
  },
});
