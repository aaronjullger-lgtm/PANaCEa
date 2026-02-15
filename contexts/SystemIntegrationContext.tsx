/**
 * System Integration Context
 *
 * Provides global access to the SystemIntegrationService that coordinates
 * all 5 modules and 13 AI services.
 *
 * Usage:
 * ```tsx
 * const { integration } = useSystemIntegration();
 * integration.emit({ type: 'DIAGNOSIS_MADE', ... });
 * ```
 */

import React, { createContext, useContext, useMemo } from 'react';
import { createSystemIntegrationService } from '@/services/integration/systemIntegrationService';
import type { SystemIntegrationService } from '@/services/integration/systemIntegrationService';

interface SystemIntegrationContextValue {
  integration: SystemIntegrationService;
}

const SystemIntegrationContext = createContext<SystemIntegrationContextValue | null>(null);

export function SystemIntegrationProvider({ children }: { children: React.ReactNode }) {
  // Create integration service once
  const integration = useMemo(() => createSystemIntegrationService(), []);

  return (
    <SystemIntegrationContext.Provider value={{ integration }}>
      {children}
    </SystemIntegrationContext.Provider>
  );
}

/**
 * Hook to access system integration service.
 */
export function useSystemIntegration() {
  const context = useContext(SystemIntegrationContext);
  if (!context) {
    throw new Error('useSystemIntegration must be used within SystemIntegrationProvider');
  }
  return context;
}
