/**
 * Adobe API hostname allowlist for IMS, Firefly, and PDF Services SDK.
 * Restriction is enforced in code only: call assertAdobeHostAllowed(url) before
 * any fetch to Adobe; if the host is not in ADOBE_ALLOWED_HOSTS, it throws.
 * Cloudflare Pages allow outbound traffic by default—no dashboard allowlist.
 * See docs/deployment/ADOBE_ALLOWLIST.md.
 */

/** Required for all Adobe API clients (IMS auth). */
export const ADOBE_IMS_HOST = 'ims-na1.adobelogin.com';

/** Firefly image generation. */
export const ADOBE_FIREFLY_HOST = 'firefly-api.adobe.io';

/**
 * PDF Services SDK (4.x / 3.x) – US (default).
 * Omit S3 storage host if using external storage for input and output.
 */
export const ADOBE_PDF_SERVICES_US = [
  'pdf-services.adobe.io',
  'pdf-services-ue1.adobe.io',
  'dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com',
] as const;

/**
 * PDF Services SDK (4.x / 3.x) – Europe.
 * Omit S3 storage host if using external storage for input and output.
 */
export const ADOBE_PDF_SERVICES_EU = [
  'pdf-services-ew1.adobe.io',
  'dcplatformstorageservice-prod-eu-west-1.s3.amazonaws.com',
] as const;

/** PDF Services SDK up to 2.x (US). */
export const ADOBE_PDF_SERVICES_LEGACY_US = 'cpf-ue1.adobe.io';

/** All hostnames we are allowed to call (IMS + Firefly + PDF Services US/EU + legacy). */
export const ADOBE_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  ADOBE_IMS_HOST,
  ADOBE_FIREFLY_HOST,
  ...ADOBE_PDF_SERVICES_US,
  ...ADOBE_PDF_SERVICES_EU,
  ADOBE_PDF_SERVICES_LEGACY_US,
]);

/**
 * Returns true if the URL's host is in the Adobe allowlist.
 * Call before fetch() when using Adobe APIs.
 */
export function isAdobeHostAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ADOBE_ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * Throws if the URL's host is not in the Adobe allowlist.
 * Use before fetch() to enforce allowlist in serverless.
 */
export function assertAdobeHostAllowed(url: string): void {
  if (!isAdobeHostAllowed(url)) {
    throw new Error(`Adobe API host not allowlisted: ${url}`);
  }
}
