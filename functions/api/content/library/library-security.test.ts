import { beforeEach, describe, expect, it, vi } from 'vitest';

const cmsEndpointMock = vi.fn(() => async () => new Response(null, { status: 204 }));
const authenticatedEndpointMock = vi.fn(() => async () => new Response(null, { status: 204 }));

vi.mock('../../_shared/middleware', () => ({
  cmsEndpoint: cmsEndpointMock,
  authenticatedEndpoint: authenticatedEndpointMock,
}));

vi.mock('../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../_shared/pdfServices', () => ({
  createPdfAsset: vi.fn(),
  downloadResultZip: vi.fn(),
  getPdfServicesToken: vi.fn(),
  pollExtractJobStatus: vi.fn(),
  submitExtractJob: vi.fn(),
  uploadToPresignedUri: vi.fn(),
}));

vi.mock('../../_shared/env-validation', () => ({
  MissingEnvError: class MissingEnvError extends Error {
    toResponse() {
      return new Response(null, { status: 500 });
    }
  },
  validateFunctionEnv: vi.fn(),
}));

describe('content library write endpoint security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('registers shared resource extract writes behind CMS role checks', async () => {
    await import('./ingest');
    await import('./extract');

    expect(cmsEndpointMock).toHaveBeenCalledTimes(3);
    expect(authenticatedEndpointMock).not.toHaveBeenCalled();
  });
});
