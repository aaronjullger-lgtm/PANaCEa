# Security Headers Configuration

This document explains the security headers configured for PANaCEa, implemented via the `public/_headers` file for Cloudflare Pages deployment.

## Overview

Security headers are HTTP response headers that help protect the application from common web vulnerabilities such as:
- Cross-Site Scripting (XSS)
- Clickjacking
- Code injection attacks
- Man-in-the-middle attacks
- MIME type sniffing

## Content Security Policy (CSP)

The Content Security Policy is the primary security mechanism that controls which resources can be loaded and executed on the page.

### Current Configuration

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://static.cloudflareinsights.com https://aistudiocdn.com; 
  script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://static.cloudflareinsights.com https://aistudiocdn.com; 
  worker-src 'self' blob:; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
  font-src 'self' https://fonts.gstatic.com data:; 
  img-src 'self' data: blob: https:; 
  media-src 'self' blob: https:; 
  connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.dev https://*.supabase.co https://generativelanguage.googleapis.com https://cloudflareinsights.com wss://*.supabase.co; 
  frame-src 'self' https://*.clerk.accounts.dev; 
  object-src 'none'; 
  base-uri 'self'; 
  form-action 'self'; 
  frame-ancestors 'none'; 
  upgrade-insecure-requests;
```

### Directive Breakdown

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Default fallback - only allow resources from same origin |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' + trusted domains` | Allow scripts from app, inline scripts, and trusted third parties |
| `script-src-elem` | Same as script-src | Explicitly control `<script>` elements |
| `worker-src` | `'self' blob:` | Allow service workers from same origin and blob URLs |
| `style-src` | `'self' 'unsafe-inline' + Google Fonts` | Allow styles from app, inline styles, and Google Fonts |
| `font-src` | `'self' + Google Fonts + data:` | Allow fonts from app, Google Fonts, and data URIs |
| `img-src` | `'self' data: blob: https:` | Allow images from any HTTPS source, data URIs, and blobs |
| `media-src` | `'self' blob: https:` | Allow media from any HTTPS source and blobs |
| `connect-src` | `'self' + trusted APIs` | Allow connections to backend APIs (Clerk, Supabase, Gemini) |
| `frame-src` | `'self' + Clerk` | Allow iframes only from same origin and Clerk |
| `object-src` | `'none'` | Block plugins (Flash, Java, etc.) |
| `base-uri` | `'self'` | Prevent base tag injection attacks |
| `form-action` | `'self'` | Only allow forms to submit to same origin |
| `frame-ancestors` | `'none'` | Prevent page from being embedded in iframes (clickjacking protection) |
| `upgrade-insecure-requests` | - | Automatically upgrade HTTP to HTTPS |

### Trusted Domains

The following external domains are explicitly allowed:

#### Authentication (Clerk)
- `https://*.clerk.accounts.dev` - Clerk authentication widgets and flows
- `https://api.clerk.dev` - Clerk API endpoints

#### Infrastructure (Cloudflare)
- `https://challenges.cloudflare.com` - Cloudflare bot protection challenges
- `https://static.cloudflareinsights.com` - Cloudflare Web Analytics
- `https://cloudflareinsights.com` - Analytics data collection

#### CDN
- `https://aistudiocdn.com` - React 19 and other dependencies via import maps

#### Database (Supabase)
- `https://*.supabase.co` - Supabase database connections
- `wss://*.supabase.co` - Supabase real-time subscriptions (WebSocket)

#### AI Services (Google Gemini)
- `https://generativelanguage.googleapis.com` - Google Gemini API

#### Fonts
- `https://fonts.googleapis.com` - Google Fonts CSS
- `https://fonts.gstatic.com` - Google Fonts files

### Security Notes

⚠️ **`'unsafe-inline'` and `'unsafe-eval'`**: Currently used for:
- React 19 inline script execution
- Vite build artifacts with inline scripts
- Third-party libraries that use `eval()` or `Function()`

**Future Improvement**: Consider using nonces or hashes for inline scripts to remove `'unsafe-inline'`.

## Other Security Headers

### Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
- Forces HTTPS connections for 1 year (31,536,000 seconds)
- Applies to all subdomains
- Eligible for browser HSTS preload list

### X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
- Prevents browsers from MIME-sniffing responses
- Reduces risk of drive-by download attacks

### X-Frame-Options
```
X-Frame-Options: DENY
```
- Prevents page from being embedded in iframes
- Protects against clickjacking attacks
- Reinforces `frame-ancestors 'none'` from CSP

### X-XSS-Protection (Removed)

This header was previously included but has been removed because:
- It's deprecated and can introduce security vulnerabilities
- Modern browsers rely on CSP for XSS protection
- Can cause false positives and break legitimate functionality
- Our comprehensive CSP provides superior protection

### Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
- Sends full URL for same-origin requests
- Only sends origin for cross-origin HTTPS requests
- No referrer sent when downgrading from HTTPS to HTTP

### Permissions-Policy
```
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
```
- Disables access to sensitive device features
- Prevents third-party scripts from accessing hardware
- Reduces attack surface

## Cache Control

### Static Assets
```
Cache-Control: public, max-age=31536000, immutable
```
- Cached for 1 year
- Can be cached by CDN and browsers
- Marked as immutable (content never changes)
- Vite adds content hashes to filenames for cache busting

### Service Worker Files
```
Cache-Control: no-cache, no-store, must-revalidate
```
- Never cached
- Always fetched fresh
- Ensures users get latest service worker updates

### HTML Files
```
Cache-Control: no-cache, no-store, must-revalidate
```
- Never cached
- Always fetched fresh
- Ensures users get latest app version

## Deployment

The `_headers` file is automatically deployed to Cloudflare Pages:

1. File location: `public/_headers`
2. Vite copies it to `dist/_headers` during build
3. Cloudflare Pages reads it and applies headers to all matching routes
4. Headers take effect immediately after deployment

## Testing CSP

To test the CSP configuration:

1. Deploy to Cloudflare Pages
2. Open browser DevTools Console
3. Check for CSP violation errors
4. Verify all necessary resources load correctly

### Expected Behavior

✅ **No CSP violations** - All scripts, styles, and resources should load without errors

❌ **Before Fix**: `script-src 'none'` blocked all scripts and showed violations

## Monitoring

CSP violations can be monitored using:
- Browser DevTools Console
- Cloudflare Web Analytics
- Custom CSP reporting endpoint (future enhancement)

## Future Enhancements

1. **Implement CSP Reporting**
   - Add `report-uri` or `report-to` directive
   - Collect and analyze CSP violations
   - Use data to further tighten policy

2. **Remove `'unsafe-inline'`**
   - Use nonces for inline scripts
   - Move inline styles to CSS files
   - Use strict-dynamic for better security

3. **Remove `'unsafe-eval'`**
   - Identify and replace libraries using `eval()`
   - Use safer alternatives
   - Consider bundler optimizations

4. **Subresource Integrity (SRI)**
   - Add integrity hashes to external scripts
   - Verify CDN resources haven't been tampered with
   - Provides additional security layer

## Resources

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Cloudflare Pages: Headers](https://developers.cloudflare.com/pages/platform/headers/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [OWASP: Secure Headers Project](https://owasp.org/www-project-secure-headers/)
