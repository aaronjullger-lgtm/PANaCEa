/**
 * PANaCEa SDK — User Domain Client
 *
 * Wraps:
 *   GET  /api/user/profile
 *   GET  /api/user/stats
 *   GET  /api/user/fsrs-params
 *   PUT  /api/user/preferences
 *
 * @module lib/sdk/userClient
 */

import type { ApiClient } from './core';
import type { UserProfile, UserStats, FSRSParams } from './types';

export interface FSRSParamsResponse {
  params: FSRSParams;
  canOptimize: boolean;
  reviewsNeeded: number;
  message: string;
  isDefault: boolean;
}

export interface UserClient {
  getProfile(): Promise<UserProfile>;
  getStats(): Promise<UserStats>;
  getFSRSParams(): Promise<FSRSParamsResponse>;
  updatePreferences(prefs: Record<string, unknown>): Promise<{ success: boolean }>;
}

export function createUserClient(api: ApiClient): UserClient {
  return {
    getProfile() {
      return api.get<UserProfile>('/api/user/profile');
    },
    getStats() {
      return api.get<UserStats>('/api/user/stats');
    },
    getFSRSParams() {
      return api.get<FSRSParamsResponse>('/api/user/fsrs-params');
    },
    updatePreferences(prefs) {
      return api.put<{ success: boolean }>('/api/user/preferences', prefs);
    },
  };
}
