/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  /** Optional: dev override for localhost to bypass pk_live domain restrictions */
  readonly VITE_CLERK_PUBLISHABLE_KEY_DEV?: string;
  /** Optional: local dev override (same as DEV but for local network) */
  readonly VITE_CLERK_PUBLISHABLE_KEY_LOCAL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENABLE_DEV?: string;
  readonly VITE_CLERK_DEBUG?: string;
  readonly VITE_API_URL?: string;
  /** Optional: Gemini API key when calling AI from client (e.g. Patient Encounter mode) */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Optional: use mock session service when true */
  readonly VITE_USE_MOCK?: string;
  /** Adobe PDF Embed API client ID for SmartPDFViewer */
  readonly VITE_ADOBE_PDF_EMBED_CLIENT_ID?: string;
  /** Adobe client ID for client-side use (e.g. Embed / Firefly) */
  readonly VITE_ADOBE_CLIENT_ID?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
