/**
 * System Event Hooks
 * 
 * React hooks for subscribing to and emitting system events
 * across all modules.
 */

import { useEffect, useCallback } from 'react';
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';
import type { SystemEvent, SystemEventType } from '@/types/unified-system-integration';

/**
 * Subscribe to a specific system event type.
 */
export function useSystemEvent(
  eventType: SystemEventType,
  callback: (event: SystemEvent) => void,
  deps: React.DependencyList = []
) {
  const { integration } = useSystemIntegration();

  useEffect(() => {
    const unsubscribe = integration.on(eventType, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration, eventType, ...deps]);
}

/**
 * Get function to emit system events.
 */
export function useSystemEmit() {
  const { integration } = useSystemIntegration();

  return useCallback(
    (event: SystemEvent) => {
      integration.emit(event);
    },
    [integration]
  );
}
