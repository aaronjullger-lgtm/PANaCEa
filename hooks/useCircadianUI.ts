/**
 * Circadian UI Hook
 *
 * Automatically adapts UI theme based on time of day and user's circadian profile.
 * Implements Module 5: Interface Fabric adaptive UI system.
 */

import { useState, useEffect, useCallback } from 'react';
import { createAdaptiveUIService } from '@/services/ui/adaptiveUIService';
import type { UIMode, UserCircadianProfile } from '@/types/interface-fabric-system';

export function useCircadianUI(userProfile?: UserCircadianProfile) {
  const [currentMode, setCurrentMode] = useState<UIMode>('standard');
  const [service] = useState(() => createAdaptiveUIService());

  // Default circadian profile if none provided
  const defaultProfile: UserCircadianProfile = {
    userId: 'default',
    peakHours: [9, 10, 11], // 9 AM - 12 PM
    lowEnergyHours: [14, 15], // 2-4 PM
    preferredStudyTimes: [
      { dayOfWeek: 1, startHour: 9, endHour: 12 }, // Monday 9-12
      { dayOfWeek: 3, startHour: 14, endHour: 17 }, // Wednesday 2-5
    ],
    timezone: 'America/New_York',
    updatedAt: new Date().toISOString(),
  };

  const profile = userProfile || defaultProfile;

  /**
   * Update UI mode based on current time.
   */
  const updateUIMode = useCallback(() => {
    const mode = service.determineUIMode(profile);
    setCurrentMode(mode);

    const theme = service.getThemeConfig(mode);
    service.applyTheme(theme);

    console.log(`[Circadian UI] Switched to ${mode} mode`);
  }, [service, profile]);

  // Initialize and update every 15 minutes
  useEffect(() => {
    updateUIMode();

    const interval = setInterval(updateUIMode, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [updateUIMode]);

  /**
   * Manually override UI mode.
   */
  const setMode = useCallback(
    (mode: UIMode) => {
      setCurrentMode(mode);
      const theme = service.getThemeConfig(mode);
      service.applyTheme(theme);
    },
    [service]
  );

  return {
    currentMode,
    setMode,
    updateUIMode,
  };
}
