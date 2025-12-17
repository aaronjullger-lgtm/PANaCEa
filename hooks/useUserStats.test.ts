/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useUserStats } from './useUserStats';
import * as srsService from '../lib/services/srsService';
import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';

// Mock the useAuth hook
vi.mock('./useAuth', () => ({
  useAuth: vi.fn(() => ({
    isSignedIn: false,
    user: null,
    getToken: vi.fn(),
    isLoading: false,
    signOut: vi.fn(),
  })),
}));

// Mock srsService
vi.mock('../lib/services/srsService', () => ({
  getAllSRSItems: vi.fn(() => []),
  loadSRSItemsFromCloud: vi.fn(),
}));

describe('useUserStats', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty arrays', () => {
      const { result } = renderHook(() => useUserStats());
      
      expect(result.current.performanceData).toEqual([]);
      expect(result.current.missedQuestions).toEqual([]);
      expect(result.current.flaggedQuestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.lastSyncTime).toBeNull();
      expect(result.current.syncError).toBeNull();
    });

    it('should load data from localStorage if available', () => {
      const testPerformanceData = [
        {
          timestamp: Date.now(),
          system: 'CV' as const,
          subcategory: null,
          conditionId: 'test-id',
          condition: 'Test Condition',
          topic: 'Test Topic',
          isCorrect: true,
          focus: 'all' as const,
          difficulty: 'same' as const,
        },
      ];
      
      localStorage.setItem('panceai_performance_v2', JSON.stringify(testPerformanceData));
      
      const { result } = renderHook(() => useUserStats());
      
      expect(result.current.performanceData).toEqual(testPerformanceData);
    });
  });

  describe('syncToCloud', () => {
    it('should get SRS items from srsService', async () => {
      const mockGetAllSRSItems = vi.spyOn(srsService, 'getAllSRSItems');
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              performanceRecords: [],
              srsItems: [],
              savedQuestions: [],
            },
          }),
        } as Response)
      );
      global.fetch = mockFetch;

      const { useAuth } = await import('./useAuth');
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        user: { clerkId: 'test-user-123' } as any,
        getToken: vi.fn().mockResolvedValue('test-token'),
        isLoading: false,
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useUserStats());
      
      await result.current.syncToCloud();

      await waitFor(() => {
        expect(mockGetAllSRSItems).toHaveBeenCalledWith('test-user-123');
      });
    });

    it('should update local state with server response', async () => {
      const serverData = {
        performanceRecords: [
          {
            timestamp: Date.now(),
            system: 'GI',
            subcategory: null,
            conditionId: 'server-id',
            condition: 'Server Condition',
            topic: 'Server Topic',
            isCorrect: false,
            focus: 'all',
            difficulty: 'same',
          },
        ],
        srsItems: [{ questionId: 'q1', userId: 'test-user-123' }],
        savedQuestions: [
          { questionId: 'q2', type: 'missed', questionText: 'Question 2' },
        ],
      };

      const mockLoadSRSItemsFromCloud = vi.spyOn(srsService, 'loadSRSItemsFromCloud');
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: serverData,
          }),
        } as Response)
      );
      global.fetch = mockFetch;

      const { useAuth } = await import('./useAuth');
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        user: { clerkId: 'test-user-123' } as any,
        getToken: vi.fn().mockResolvedValue('test-token'),
        isLoading: false,
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useUserStats());
      
      await result.current.syncToCloud();

      await waitFor(() => {
        expect(result.current.performanceData).toEqual(serverData.performanceRecords);
        expect(mockLoadSRSItemsFromCloud).toHaveBeenCalledWith(serverData.srsItems);
        expect(result.current.missedQuestions).toEqual([serverData.savedQuestions[0]]);
      });
    });
  });

  describe('syncFromCloud', () => {
    it('should load SRS items from cloud', async () => {
      const serverData = {
        performanceRecords: [],
        srsItems: [{ questionId: 'q1', userId: 'test-user-123' }],
        savedQuestions: [],
      };

      const mockLoadSRSItemsFromCloud = vi.spyOn(srsService, 'loadSRSItemsFromCloud');
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: serverData,
          }),
        } as Response)
      );
      global.fetch = mockFetch;

      const { useAuth } = await import('./useAuth');
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        user: { clerkId: 'test-user-123' } as any,
        getToken: vi.fn().mockResolvedValue('test-token'),
        isLoading: false,
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useUserStats());
      
      await result.current.syncFromCloud();

      await waitFor(() => {
        expect(mockLoadSRSItemsFromCloud).toHaveBeenCalledWith(serverData.srsItems);
      });
    });
  });

  describe('auto-sync on sign-in', () => {
    it('should call syncToCloud if local data exists', async () => {
      const testPerformanceData = [
        {
          timestamp: Date.now(),
          system: 'CV' as const,
          subcategory: null,
          conditionId: 'test-id',
          condition: 'Test Condition',
          topic: 'Test Topic',
          isCorrect: true,
          focus: 'all' as const,
          difficulty: 'same' as const,
        },
      ];

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              performanceRecords: testPerformanceData,
              srsItems: [],
              savedQuestions: [],
            },
          }),
        } as Response)
      );
      global.fetch = mockFetch;

      const { useAuth } = await import('./useAuth');
      // Start signed-out, seed local (in-memory) state, then sign in.
      // This avoids cross-suite flakiness from global/localStorage mutations.
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: false,
        user: null,
        getToken: vi.fn().mockResolvedValue('test-token'),
        isLoading: false,
        signOut: vi.fn(),
      });

      const { result, rerender } = renderHook(() => useUserStats());

      act(() => {
        result.current.setPerformanceData(testPerformanceData);
      });

      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        user: { clerkId: 'test-user-123' } as any,
        getToken: vi.fn().mockResolvedValue('test-token'),
        isLoading: false,
        signOut: vi.fn(),
      });

      rerender();

      // Wait for the auto-sync to trigger
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          getApiEndpoint(API_ENDPOINTS.SYNC),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should call syncFromCloud if no local data exists', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              performanceRecords: [],
              srsItems: [],
              savedQuestions: [],
            },
          }),
        } as Response)
      );
      global.fetch = mockFetch;

      const { useAuth } = await import('./useAuth');
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        user: { clerkId: 'test-user-123' } as any,
        getToken: vi.fn().mockResolvedValue('test-token'),
        isLoading: false,
        signOut: vi.fn(),
      });

      renderHook(() => useUserStats());

      // Wait for the auto-sync to trigger
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          getApiEndpoint(API_ENDPOINTS.SYNC),
          expect.objectContaining({
            method: 'GET',
          })
        );
      });
    });
  });
});
