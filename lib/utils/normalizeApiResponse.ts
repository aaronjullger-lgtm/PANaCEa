/**
 * normalizeApiResponse.ts
 *
 * Shared utility for normalizing API responses from reference endpoints.
 * Handles the variety of response shapes across endpoints:
 *   - { data: { success: true, data: [...] } }
 *   - { data: { success: true, labs: [...] } }  (legacy normal-labs format)
 *   - { data: [...] }
 *   - [...]
 */

/**
 * Extract the items array from any reference API response shape.
 * Always returns a valid array (empty if parsing fails).
 */
export function normalizeApiItems(json: any): any[] {
  const payload = json?.data ?? json;
  const items = Array.isArray(payload)
    ? payload
    : (payload?.data ?? payload?.labs ?? []);
  return Array.isArray(items) ? items : [];
}
