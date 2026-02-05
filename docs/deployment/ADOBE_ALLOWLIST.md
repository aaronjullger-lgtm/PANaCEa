# Adobe API hostname allowlist

**Cloudflare Pages Functions allow outbound traffic by default.** There is no dashboard allowlist to configure. The restriction is enforced in **code**: `functions/api/_shared/adobeAllowlist.ts`.

Before any Adobe API `fetch`, the code calls `assertAdobeHostAllowed(url)`. If the URL’s host is not in `ADOBE_ALLOWED_HOSTS`, it throws. To allow a new Adobe host (e.g. a new region or service), **edit `adobeAllowlist.ts`** and add the hostname to `ADOBE_ALLOWED_HOSTS`.

Reference list of hostnames currently allowed in code:

## Required for all Adobe API clients

| Hostname | Purpose |
|----------|---------|
| `ims-na1.adobelogin.com` | IMS authentication (OAuth/token); required for all clients |

## Firefly (image generation)

| Hostname | Purpose |
|----------|---------|
| `firefly-api.adobe.io` | Firefly image generation (condition mnemonics, visualizer, etc.) |

## PDF Services SDK (4.x and 3.x)

### United States (default) region

| Hostname | Required |
|----------|----------|
| `pdf-services.adobe.io` | Yes (default URI) |
| `pdf-services-ue1.adobe.io` | Yes |
| `dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com` | No, if using external storage for both input and output |

### Europe region

| Hostname | Required |
|----------|----------|
| `pdf-services-ew1.adobe.io` | Yes |
| `dcplatformstorageservice-prod-eu-west-1.s3.amazonaws.com` | No, if using external storage for both input and output |

## PDF Services SDK (up to 2.x)

| Hostname | Purpose |
|----------|---------|
| `cpf-ue1.adobe.io` | Legacy US endpoint |

## Where it’s enforced (code)

**File:** `functions/api/_shared/adobeAllowlist.ts`

- **`ADOBE_ALLOWED_HOSTS`** – `Set<string>` of allowed hostnames. Add new Adobe hosts here.
- **`isAdobeHostAllowed(url)`** – returns whether the URL’s host is in the set.
- **`assertAdobeHostAllowed(url)`** – throws if the host is not in the set. All Adobe API calls (IMS, Firefly, PDF Services) use this before `fetch`.

## Environment variables (GitHub / Cloudflare)

Configure these in your deployment (e.g. GitHub Actions / Cloudflare Pages env):

| Variable | Use |
|----------|-----|
| `ADOBE_CLIENT_ID` | Server-side: IMS + Firefly + PDF Services |
| `ADOBE_CLIENT_SECRET` | Server-side: IMS token exchange (never expose to client) |
| `VITE_ADOBE_CLIENT_ID` | Client-side: optional; same or separate client ID for Embed/Firefly if needed in browser |
| `VITE_ADOBE_PDF_EMBED_CLIENT_ID` | Client-side: Adobe PDF Embed API for SmartPDFViewer |

Optional: `ADOBE_ACCESS_TOKEN` – pre-obtained token (avoids IMS call when set).
