/**
 * Adaptive UI Service
 * 
 * Implements circadian UI adaptation using lumina to adjust dashboard
 * aesthetics based on user's circadian profile and time of day.
 * 
 * Features:
 * - Focus Mode during peak hours (high contrast)
 * - Review Mode during off-hours (warmer tones, reduced contrast)
 * - Rest Mode during late evening (subdued, low energy)
 * - Metacognition widgets embedded in study flow
 * 
 * @module adaptiveUIService
 */

import type {
  UserCircadianProfile,
  UIMode,
  UIThemeConfig,
  AdaptiveUIState,
  UI_MODES,
  MetacognitionWidget,
} from '@/types/interface-fabric-system';

interface AdaptiveUIServiceConfig {
  enableCircadianAdaptation: boolean;
  allowUserOverride: boolean;
}

export class AdaptiveUIService {
  private config: AdaptiveUIServiceConfig;

  constructor(config: AdaptiveUIServiceConfig = { enableCircadianAdaptation: true, allowUserOverride: true }) {
    this.config = config;
  }

  /**
   * Determine optimal UI mode based on circadian profile and current time.
   */
  determineUIMode(profile: UserCircadianProfile, currentTime: Date = new Date()): UIMode {
    const hour = currentTime.getHours();

    // Check user override
    if (!this.config.enableCircadianAdaptation) {
      return 'standard';
    }

    // Peak hours → Focus Mode
    if (profile.peakHours.includes(hour)) {
      return 'focus';
    }

    // Low energy hours → Review Mode
    if (profile.lowEnergyHours.includes(hour)) {
      return 'review';
    }

    // Late evening/night → Rest Mode
    if (hour >= 22 || hour <= 5) {
      return 'rest';
    }

    // Check if in preferred study time
    const dayOfWeek = currentTime.getDay();
    const preferredTime = profile.preferredStudyTimes.find(
      (t) => t.dayOfWeek === dayOfWeek && hour >= t.startHour && hour < t.endHour
    );

    if (preferredTime) {
      return 'focus';
    }

    return 'standard';
  }

  /**
   * Get theme configuration for a UI mode.
   */
  getThemeConfig(mode: UIMode): UIThemeConfig {
    return (UI_MODES as Record<UIMode, UIThemeConfig>)[mode];
  }

  /**
   * Create adaptive UI state.
   */
  createAdaptiveState(
    profile: UserCircadianProfile,
    userOverride?: UIMode
  ): AdaptiveUIState {
    const mode = userOverride ?? this.determineUIMode(profile);
    const theme = this.getThemeConfig(mode);

    let reason: AdaptiveUIState['reason'] = 'standard';
    if (userOverride) {
      reason = 'manual';
    } else {
      const hour = new Date().getHours();
      if (profile.peakHours.includes(hour)) reason = 'peak_hours';
      else if (profile.lowEnergyHours.includes(hour)) reason = 'low_energy';
      else reason = 'time_of_day';
    }

    return {
      currentMode: mode,
      theme,
      reason,
      lastModeChange: new Date().toISOString(),
      userOverride,
    };
  }

  /**
   * Apply theme to DOM.
   */
  applyTheme(theme: UIThemeConfig): void {
    const root = document.documentElement;

    // Apply CSS variables
    root.style.setProperty('--color-bg-primary', theme.colors.background);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-text-primary', theme.colors.text);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-accent', theme.colors.accent);

    // Typography
    root.style.setProperty('--font-family', theme.typography.fontFamily);
    root.style.setProperty('--font-size-base', `${theme.typography.fontSize}px`);
    root.style.setProperty('--line-height', String(theme.typography.lineHeight));
    root.style.setProperty('--font-weight', String(theme.typography.fontWeight));

    // Effects
    root.style.setProperty('--blur-intensity', `${theme.effects.blur}px`);
    root.style.setProperty('--saturation', `${theme.effects.saturation}%`);
    root.style.setProperty('--contrast', `${theme.effects.contrast}%`);
    root.style.setProperty('--brightness', `${theme.effects.brightness}%`);

    // Animations
    if (theme.effects.animations === 'none' || theme.accessibility.reducedMotion) {
      root.style.setProperty('--animation-duration', '0s');
    } else if (theme.effects.animations === 'reduced') {
      root.style.setProperty('--animation-duration', '0.1s');
    } else {
      root.style.setProperty('--animation-duration', '0.3s');
    }
  }
}

/**
 * Factory function.
 */
export function createAdaptiveUIService(): AdaptiveUIService {
  return new AdaptiveUIService();
}
