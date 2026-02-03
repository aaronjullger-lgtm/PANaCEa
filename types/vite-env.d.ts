/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENABLE_DEV?: string;
  readonly VITE_CLERK_DEBUG?: string;
  readonly VITE_API_URL?: string;
  /** Adobe PDF Embed API client ID for SmartPDFViewer */
  readonly VITE_ADOBE_PDF_EMBED_CLIENT_ID?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
