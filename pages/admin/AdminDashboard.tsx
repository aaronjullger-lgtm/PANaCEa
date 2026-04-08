/**
 * Admin Dashboard Page
 * Example protected route demonstrating RBAC
 * Only accessible to users with admin or superadmin roles
 *
 * SECURITY NOTE:
 * ---------------
 * Client-side access checks in this component are for UI/UX purposes only.
 * All administrative data is protected server-side via:
 *   - /api/admin/check-access - requireAdmin() middleware (verifies access)
 *   - /api/admin/stats - requireAdmin() middleware (returns system statistics)
 *
 * The server validates Clerk JWT tokens and verifies admin role in database
 * (or ADMIN_USER_IDS/SUPERADMIN_USER_IDS env fallback) before returning data.
 * Client-side checks prevent unnecessary API calls but do NOT provide security.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  TrendingUp,
  Activity as ActivityIcon,
  AlertCircle,
  Settings,
  BarChart3,
  Flag,
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  BookOpen,
  Map,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { canManageRoles, getRoleDisplayName, type UserRole } from '../../lib/auth/rbac';
import { ROUTES } from '../../config/routes';
import { FlaggedQuestionsDashboard } from '../../components/admin/FlaggedQuestionsDashboard';
import { QuestionPerformanceDashboard } from '../../components/admin/QuestionPerformanceDashboard';
import QuestionCurationPanel from '../../components/admin/QuestionCurationPanel';
import { QuestionQualityDashboard } from '../../components/admin/QuestionQualityDashboard';
import { MappingEnrichmentDashboard } from '../../components/admin/MappingEnrichmentDashboard';
import { LibraryEnrichmentDashboard } from '../../components/admin/LibraryEnrichmentDashboard';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalQuestions: number;
  avgAccuracy: number;
  pendingFlags: number;
}

interface AdminDashboardProps {
  onClose?: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { user, isSignedIn, getToken } = useAuth();
  const userId = user?.id;
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [hasAccess, setHasAccess] = useState(false);
  const [activePanel, setActivePanel] = useState<
    'dashboard' | 'flags' | 'performance' | 'curation' | 'questionQuality' | 'mappingEnrichment' | 'libraryEnrichment'
  >('dashboard');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalQuestions: 0,
    avgAccuracy: 0,
    pendingFlags: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Exponential backoff: 1s, 2s, 4s, 8s, etc. (capped at 30s)
  const getBackoffDelay = (count: number) => Math.min(1000 * Math.pow(2, count), 30000);

  const fetchStats = useCallback(async (token: string | null, retries = 0) => {
    if (!token) return;
    setStatsError(null);
    setStatsLoading(true);
    try {
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Handle rate limiting with exponential backoff
      if (statsResponse.status === 429 && retries < 3) {
        const backoffDelay = getBackoffDelay(retries);
        setStatsError(`Rate limited. Retrying in ${Math.round(backoffDelay / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        setRetryCount(retries + 1);
        return fetchStats(token, retries + 1);
      }

      const res = (await statsResponse.json()) as {
        data?: {
          totalUsers?: number;
          activeUsersToday?: number;
          totalStudySessions?: number;
          averageAccuracy?: number;
          pendingFlags?: number;
        };
        error?: string;
      };

      // Check for API error response
      if (!statsResponse.ok) {
        const errorMsg = res?.error || `Server error: ${statsResponse.status}`;
        setStatsError(errorMsg);
        setStatsLoading(false);
        return;
      }

      // API returns { success, data: { totalUsers, activeUsersToday, ... } }
      const statsData = res?.data ?? {};
      setStats({
        totalUsers: statsData.totalUsers ?? 0,
        activeUsers: statsData.activeUsersToday ?? 0,
        totalQuestions: statsData.totalStudySessions ?? 0,
        avgAccuracy: statsData.averageAccuracy ?? 0,
        pendingFlags: statsData.pendingFlags ?? 0,
      });
      setRetryCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stats';
      setStatsError(message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Keep stable refs to callbacks that are recreated on every render by useAuth()
  // so the effect below can call them without triggering re-runs.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const fetchStatsRef = useRef(fetchStats);
  fetchStatsRef.current = fetchStats;

  useEffect(() => {
    const checkAccess = async (retries = 0) => {
      setAccessError(null);
      if (!isSignedIn || !userId) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      try {
        const token = await getTokenRef.current();

        const accessResponse = await fetch('/api/admin/check-access', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Handle rate limiting with exponential backoff
        if (accessResponse.status === 429 && retries < 3) {
          const backoffDelay = getBackoffDelay(retries);
          setAccessError(`Rate limited. Retrying in ${Math.round(backoffDelay / 1000)}s...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          return checkAccess(retries + 1);
        }

        if (accessResponse.ok) {
          const accessJson = (await accessResponse.json()) as {
            data?: { role?: string };
            role?: string;
          };
          const role = accessJson?.data?.role ?? accessJson?.role;
          setHasAccess(true);
          setUserRole(role === 'superadmin' ? 'superadmin' : 'admin');
          await fetchStatsRef.current(token);
        } else {
          setHasAccess(false);
          const errBody = (await accessResponse.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          setAccessError(errBody?.error ?? errBody?.message ?? 'Access denied');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to verify access';
        setAccessError(message);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [isSignedIn, userId]); // Only re-run when auth state actually changes

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-[var(--color-bg-tertiary)] rounded-2xl p-8 shadow-[0_18px_42px_var(--color-shadow-soft)]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--color-text-primary)]">Verifying access...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl p-8 shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-md text-center"
        >
          <AlertCircle className="w-16 h-16 text-[var(--color-data-fail)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            You don't have permission to access the admin dashboard.
            {!isSignedIn && ' Please sign in with an admin account.'}
          </p>
          {accessError && (
            <p className="text-sm text-[var(--color-data-fail)] mb-4 px-4 py-2 bg-[var(--color-data-fail)]/10 rounded-lg">
              {accessError}
            </p>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-6xl w-full my-8"
      >
        {/* Header */}
        <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {activePanel !== 'dashboard' && (
                <button
                  type="button"
                  onClick={() => setActivePanel('dashboard')}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" aria-hidden />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                  {activePanel === 'flags' ? (
                    <>
                      <Flag className="w-7 h-7 text-[var(--color-data-fail)]" />
                      Flagged Questions
                    </>
                  ) : activePanel === 'performance' ? (
                    <>
                      <BarChart3 className="w-7 h-7 text-[var(--color-accent)]" />
                      Question Performance
                    </>
                  ) : activePanel === 'curation' ? (
                    <>
                      <Sparkles className="w-7 h-7 text-[var(--color-data-provisional)]" />
                      Question Curation
                    </>
                  ) : activePanel === 'questionQuality' ? (
                    <>
                      <BarChart3 className="w-7 h-7 text-[var(--color-data-provisional)]" />
                      Question Analytics
                    </>
                  ) : activePanel === 'mappingEnrichment' ? (
                    <>
                      <Map className="w-7 h-7 text-[var(--color-data-provisional)]" />
                      System Mapping Enrichment
                    </>
                  ) : activePanel === 'libraryEnrichment' ? (
                    <>
                      <BookOpen className="w-7 h-7 text-[var(--color-data-provisional)]" />
                      Library Enrichment
                    </>
                  ) : (
                    <>
                      <Shield className="w-7 h-7 text-[var(--color-accent)]" />
                      Admin Dashboard
                    </>
                  )}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {activePanel === 'flags'
                    ? 'Review and resolve user-reported issues'
                    : activePanel === 'performance'
                      ? 'Identify and improve low-performing questions'
                      : activePanel === 'curation'
                        ? 'Review and approve AI-generated questions'
                        : activePanel === 'questionQuality'
                          ? 'Pool health, quality distribution, and low-quality flags'
                          : activePanel === 'mappingEnrichment'
                          ? 'Enrich taxonomy-system mappings with AI suggestions'
                          : activePanel === 'libraryEnrichment'
                            ? 'Monitor automated field extraction from medical library'
                          : 'Platform management and analytics'}
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                    {getRoleDisplayName(userRole)}
                  </span>
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Close admin dashboard"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Panel Content */}
        {activePanel === 'flags' ? (
          <div className="p-6">
            <FlaggedQuestionsDashboard />
          </div>
        ) : activePanel === 'performance' ? (
          <div className="p-6">
            <QuestionPerformanceDashboard />
          </div>
        ) : activePanel === 'curation' ? (
          <div className="p-6">
            <QuestionCurationPanel />
          </div>
        ) : activePanel === 'questionQuality' ? (
          <div className="p-6">
            <QuestionQualityDashboard />
          </div>
        ) : activePanel === 'mappingEnrichment' ? (
          <div className="p-6">
            <MappingEnrichmentDashboard />
          </div>
        ) : activePanel === 'libraryEnrichment' ? (
          <div className="p-6">
            <LibraryEnrichmentDashboard />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="p-6">
              {statsError && (
                <motion.div
                  initial={{ y: -8 }}
                  animate={{ y: 0 }}
                  className="mb-4 flex items-center justify-between gap-3 p-4 rounded-xl bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 text-[var(--color-data-fail)]"
                >
                  <span className="text-sm">{statsError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRetryCount(0);
                      getToken().then((token) => fetchStats(token, 0));
                    }}
                    disabled={statsLoading}
                    aria-label="Retry loading stats"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-data-fail)]/20 hover:bg-[var(--color-data-fail)]/30 text-[var(--color-data-fail)] text-sm font-medium disabled:opacity-50"
                  >
                    {statsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="w-4 h-4" aria-hidden />
                    )}
                    Retry
                  </button>
                </motion.div>
              )}
              {statsLoading && !statsError && (
                <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading stats…
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {/* Total Users */}
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-[var(--color-accent)]/20 rounded-lg">
                      <Users className="w-6 h-6 text-[var(--color-accent)]" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-[var(--color-data-pass)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                    {stats.totalUsers}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">Total Users</div>
                </div>

                {/* Active Users */}
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-[var(--color-data-pass)]/20 rounded-lg">
                      <ActivityIcon className="w-6 h-6 text-[var(--color-data-pass)]" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-[var(--color-data-pass)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                    {stats.activeUsers}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">Active This Week</div>
                </div>

                {/* Total Questions */}
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-[var(--color-accent)]/20 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-[var(--color-accent)]" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-[var(--color-data-pass)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                    {stats.totalQuestions.toLocaleString()}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">Questions Answered</div>
                </div>

                {/* Average Accuracy */}
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-[var(--color-data-provisional)]/20 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-[var(--color-data-provisional)]" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-[var(--color-data-pass)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                    {stats.avgAccuracy}%
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">Platform Average</div>
                </div>

                {/* Pending Flags */}
                <button
                  onClick={() => setActivePanel('flags')}
                  className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] hover:border-[var(--color-data-fail)]/50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-[var(--color-data-fail)]/20 rounded-lg">
                      <Flag className="w-6 h-6 text-[var(--color-data-fail)]" />
                    </div>
                    {stats.pendingFlags > 0 && (
                      <span className="px-2 py-1 text-xs font-medium bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] rounded-full">
                        Action Needed
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                    {stats.pendingFlags}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">Pending Flags</div>
                </button>
              </div>

              {/* Admin Actions */}
              <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Administrative Actions
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a
                    href="/admin/content-management"
                    className="flex items-center gap-3 p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg hover:bg-[var(--color-accent)]/20 transition-colors text-left"
                  >
                    <ActivityIcon className="w-5 h-5 text-[var(--color-accent)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Content Management
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Edit clinical content, conditions, and drugs
                      </div>
                    </div>
                  </a>

                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.ADMIN_REFINERY)}
                    className="flex items-center gap-3 p-4 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg hover:bg-[var(--color-data-provisional)]/20 transition-colors text-left"
                  >
                    <BookOpen className="w-5 h-5 text-[var(--color-data-provisional)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Content Refinery
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Triage drafts, media, and questions
                      </div>
                    </div>
                  </button>

                  <button className="flex items-center gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-left">
                    <Users className="w-5 h-5 text-[var(--color-accent)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        User Management
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        View and manage user accounts
                      </div>
                    </div>
                  </button>

                  {canManageRoles(userRole) && (
                    <button className="flex items-center gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-left">
                      <Shield className="w-5 h-5 text-[var(--color-accent)]" />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">
                          Role Management
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Assign and manage user roles
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => setActivePanel('performance')}
                    className="flex items-center gap-3 p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg hover:bg-[var(--color-accent)]/20 transition-colors text-left"
                  >
                    <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Question Performance
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Identify low-performing questions
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActivePanel('curation')}
                    className="flex items-center gap-3 p-4 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg hover:bg-[var(--color-data-provisional)]/20 transition-colors text-left"
                  >
                    <Sparkles className="w-5 h-5 text-[var(--color-data-provisional)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Question Curation
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Review AI-generated questions
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActivePanel('questionQuality')}
                    className="flex items-center gap-3 p-4 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg hover:bg-[var(--color-data-provisional)]/20 transition-colors text-left"
                  >
                    <BarChart3 className="w-5 h-5 text-[var(--color-data-provisional)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Question Analytics
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Pool health and quality distribution
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActivePanel('mappingEnrichment')}
                    className="flex items-center gap-3 p-4 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg hover:bg-[var(--color-data-provisional)]/20 transition-colors text-left"
                  >
                    <Map className="w-5 h-5 text-[var(--color-data-provisional)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        System Mapping Enrichment
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Review AI‑suggested system mappings
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActivePanel('libraryEnrichment')}
                    className="flex items-center gap-3 p-4 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg hover:bg-[var(--color-data-provisional)]/20 transition-colors text-left"
                  >
                    <BookOpen className="w-5 h-5 text-[var(--color-data-provisional)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Library Enrichment
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Monitor automated field extraction from medical library
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActivePanel('flags')}
                    className="flex items-center gap-3 p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-lg hover:bg-[var(--color-data-fail)]/20 transition-colors text-left"
                  >
                    <Flag className="w-5 h-5 text-[var(--color-data-fail)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        Flagged Questions
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Review user-reported issues
                      </div>
                    </div>
                  </button>

                  <button className="flex items-center gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-left">
                    <Settings className="w-5 h-5 text-[var(--color-accent)]" />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        System Settings
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Configure platform settings
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Info Note */}
              <div className="mt-6 p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--color-text-muted)]">
                    <strong className="text-[var(--color-text-primary)]">Demo Mode:</strong> This is
                    a demonstration admin dashboard. In production, this would connect to real APIs
                    for user management, analytics, and system configuration. Access is controlled
                    by the RBAC system.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
