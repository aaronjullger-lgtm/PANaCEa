const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/**
 * pg-connection-string currently treats sslmode=require as certificate-verifying
 * unless libpq compatibility is explicitly requested. Local Supabase-style direct
 * URLs commonly use sslmode=require with a managed/self-signed chain, so opt into
 * libpq semantics for the local PG adapter without changing production URLs.
 */
export function normalizeLocalPgConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);

    if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
      return connectionString;
    }

    if (url.searchParams.get('sslmode') !== 'require') {
      return connectionString;
    }

    if (url.searchParams.has('uselibpqcompat')) {
      return connectionString;
    }

    url.searchParams.set('uselibpqcompat', 'true');
    return url.toString();
  } catch {
    return connectionString;
  }
}
