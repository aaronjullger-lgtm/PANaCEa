/**
 * Safe JSON response parsing for fetch()
 *
 * Prevents "Unexpected token <" when API returns HTML (e.g. 502/503 error pages)
 * instead of JSON. Throws ServerConfigError so error boundaries can show
 * MaintenancePage instead of a broken white screen.
 */

export class ServerConfigError extends Error {
  readonly status?: number;
  readonly url?: string;

  constructor(message: string, options?: { status?: number; url?: string }) {
    super(message);
    this.name = 'ServerConfigError';
    this.status = options?.status;
    this.url = options?.url;
  }
}

/**
 * Parse JSON from a fetch Response. If the response has a non-JSON Content-Type
 * (e.g. HTML from a 502/503 error page), throws ServerConfigError instead of
 * SyntaxError, so the app can show a Maintenance page.
 *
 * @throws ServerConfigError when response is not JSON (e.g. HTML error page)
 */
export async function parseJsonOrThrow<T = unknown>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson =
    contentType.includes('application/json') ||
    contentType.includes('application/vnd.api+json');

  if (!isJson) {
    const status = response.status;
    const url = response.url || response.headers.get('x-request-url') || undefined;
    throw new ServerConfigError(
      'Server configuration error. Please try again or contact support.',
      { status, url }
    );
  }

  try {
    return (await response.json()) as T;
  } catch (err) {
    // response.json() threw (e.g. invalid JSON body)
    if (err instanceof SyntaxError) {
      throw new ServerConfigError(
        'Server configuration error. Please try again or contact support.',
        { status: response.status, url: response.url }
      );
    }
    throw err;
  }
}
