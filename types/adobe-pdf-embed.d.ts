/**
 * Type declarations for Adobe PDF Embed API (documentcloud.adobe.com/view-sdk/main.js).
 * Loaded via script tag; AdobeDC is attached to window on "adobe_dc_view_sdk.ready".
 */
declare global {
  interface Window {
    AdobeDC?: typeof AdobeDC;
  }
}

export interface AdobeDCViewConfig {
  clientId: string;
  divId: string;
  locale?: string;
  downloadWithCredentials?: boolean;
}

export interface AdobeDCViewPreviewConfig {
  embedMode?: 'FULL_WINDOW' | 'SIZED_CONTAINER' | 'IN_LINE' | 'LIGHT_BOX';
  defaultViewMode?: 'FIT_PAGE' | 'FIT_WIDTH' | 'CONTINUOUS' | 'SINGLE_PAGE';
  showDownloadPDF?: boolean;
  showPrintPDF?: boolean;
  showPageControls?: boolean;
  dockPageControls?: boolean;
  showAnnotationTools?: boolean;
  showLeftHandPanel?: boolean;
  enableFormFilling?: boolean;
  enableLinearization?: boolean;
  enableSearchAPIs?: boolean;
  focusOnRendering?: boolean;
}

export interface AdobeDCViewContent {
  location?: { url: string; headers?: Array<{ key: string; value: string }> };
  promise?: Promise<ArrayBuffer>;
  linearizationInfo?: unknown;
}

export interface AdobeDCViewMetaData {
  fileName: string;
  id?: string;
}

export interface AdobeDCView {
  previewFile(
    config: {
      content: AdobeDCViewContent;
      metaData: AdobeDCViewMetaData;
    },
    viewerConfig?: AdobeDCViewPreviewConfig
  ): Promise<AdobeDCViewerAPIs>;
}

export interface AdobeDCViewerAPIs {
  getAPIs(): Promise<AdobeDCViewerAPI>;
}

export interface AdobeDCViewerAPI {
  getCurrentPage(): Promise<number>;
  getSelectedContent(): Promise<{ type: string; data: string }>;
  getPDFMetadata(): Promise<{ numPages: number; pdfTitle?: string }>;
  gotoLocation(page: number, x?: number, y?: number): Promise<void>;
  getZoomAPIs?(): unknown;
  search?(term: string): Promise<unknown>;
}

export interface AdobeDC {
  View: new (config: AdobeDCViewConfig) => AdobeDCView;
  Enum?: {
    CallbackType?: Record<string, string>;
    ApiResponseCode?: Record<string, number>;
  };
}

export {};
