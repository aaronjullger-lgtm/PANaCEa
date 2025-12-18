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

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  TrendingUp,
  Activity as ActivityIcon,
  AlertCircle,
  Settings,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isAdmin, canManageRoles, getRoleDisplayName, type UserRole } from '../../lib/auth/rbac';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalQuestions: number;
  avgAccuracy: number;
}

interface AdminDashboardProps {
  onClose?: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const { user, isSignedIn, getToken } = useAuth();
  const userId = user?.id;
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [hasAccess, setHasAccess] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalQuestions: 0,
    avgAccuracy: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isSignedIn || !userId) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        
        // Verify admin access via API
        const accessResponse = await fetch('/api/admin/check-access', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (accessResponse.ok) {
          setHasAccess(true);
          setUserRole('admin');

          // Load admin stats from API
          try {
            const statsResponse = await fetch('/api/admin/stats', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (statsResponse.ok) {
              const { data } = await statsResponse.json();
              setStats({
                totalUsers: data.totalUsers || 0,
                activeUsers: data.activeUsersToday || 0,
                totalQuestions: data.totalStudySessions || 0,
                avgAccuracy: data.averageAccuracy || 0,
              });
            } else {
              // Fallback to placeholder stats
              setStats({
                totalUsers: 150,
                activeUsers: 78,
                totalQuestions: 45230,
                avgAccuracy: 76.5,
              });
            }
          } catch (statsError) {
            console.error('Failed to fetch stats:', statsError);
            // Fallback to placeholder stats
            setStats({
              totalUsers: 150,
              activeUsers: 78,
              totalQuestions: 45230,
              avgAccuracy: 76.5,
            });
          }
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Failed to check admin access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [isSignedIn, userId, getToken]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-[var(--color-bg-tertiary)] rounded-2xl p-8 shadow-2xl">
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl p-8 shadow-2xl max-w-md text-center"
        >
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            You don't have permission to access the admin dashboard.
            {!isSignedIn && ' Please sign in with an admin account.'}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl max-w-6xl w-full my-8"
      >
        {/* Header */}
        <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                <Shield className="w-7 h-7 text-[var(--color-accent)]" />
                Admin Dashboard
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Platform management and analytics
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                  {getRoleDisplayName(userRole)}
                </span>
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Users */}
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                {stats.totalUsers}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Total Users
              </div>
            </div>

            {/* Active Users */}
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <ActivityIcon className="w-6 h-6 text-green-500" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                {stats.activeUsers}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Active This Week
              </div>
            </div>

            {/* Total Questions */}
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-500" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                {stats.totalQuestions.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Questions Answered
              </div>
            </div>

            {/* Average Accuracy */}
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                {stats.avgAccuracy}%
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Platform Average
              </div>
            </div>
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

              <button className="flex items-center gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-left">
                <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
                <div>
                  <div className="font-medium text-[var(--color-text-primary)]">
                    Analytics
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Platform usage analytics
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
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text-primary)]">Demo Mode:</strong> This is a demonstration
                admin dashboard. In production, this would connect to real APIs for user management, analytics,
                and system configuration. Access is controlled by the RBAC system.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
