/**
 * Disaster Recovery Dashboard
 *
 * Admin interface for managing backups, recovery points, and disaster scenarios
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton } from '@/components/shared/StandardButton';
import { InlineSpinner } from '@/components/loading';

interface DisasterRecoveryDashboardProps {
  /** Whether the dashboard is open */
  isOpen: boolean;
  /** Callback when dashboard is closed */
  onClose: () => void;
}

export const DisasterRecoveryDashboard: React.FC<DisasterRecoveryDashboardProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'backups' | 'scenarios' | 'config'>(
    'overview'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate loading data
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disaster recovery data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateBackup = async (type: 'full' | 'incremental') => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate backup creation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} backup created successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteRecovery = async (scenarioId: string) => {
    if (
      !confirm(
        'Are you sure you want to execute this disaster recovery scenario? This may cause service disruption.'
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate recovery execution
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSuccess(`Disaster recovery for ${scenarioId} executed successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute disaster recovery');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
         
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Disaster Recovery Dashboard
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Manage backups, recovery points, and disaster scenarios
                </p>
              </div>
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </StandardButton>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--color-border)]">
              <div className="flex space-x-1 px-6">
                {(['overview', 'backups', 'scenarios', 'config'] as const).map((tab) => (
                  <StandardButton
                    key={tab}
                    variant={activeTab === tab ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab)}
                    className="capitalize"
                  >
                    {tab}
                  </StandardButton>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {isLoading && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-label="Loading disaster recovery data"
                  className="flex items-center justify-center py-12"
                >
                  <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-data-fail/10 border border-data-fail/20 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-data-fail" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-data-fail">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-data-pass/10 border border-data-pass/20 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-data-pass"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-data-pass">{success}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Backup Status */}
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                        Backup Status
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--color-text-muted)]">
                            Total Backups
                          </span>
                          <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                            12
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--color-text-muted)]">Total Size</span>
                          <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {formatBytes(1024 * 1024 * 250)} {/* 250MB */}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--color-text-muted)]">
                            Latest Backup
                          </span>
                          <span className="text-sm text-[var(--color-text-primary)]">
                            {formatDate(new Date())}
                          </span>
                        </div>
                      </div>
                      <div className="mt-6 flex space-x-3">
                        <StandardButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleCreateBackup('full')}
                          disabled={isLoading}
                        >
                          Create Full Backup
                        </StandardButton>
                        <StandardButton
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateBackup('incremental')}
                          disabled={isLoading}
                        >
                          Create Incremental
                        </StandardButton>
                      </div>
                    </div>

                    {/* Disaster Scenarios */}
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                        Disaster Scenarios
                      </h3>
                      <div className="space-y-3">
                        {[
                          {
                            id: 'db-corruption',
                            name: 'Database Corruption',
                            severity: 'critical',
                          },
                          { id: 'server-failure', name: 'Server Failure', severity: 'high' },
                          { id: 'cdn-failure', name: 'CDN Failure', severity: 'medium' },
                        ].map((scenario) => (
                          <div
                            key={scenario.id}
                            className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
                          >
                            <div>
                              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                {scenario.name}
                              </span>
                              <div className="flex items-center mt-1">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    scenario.severity === 'critical'
                                      ? 'bg-data-fail/20 text-data-fail'
                                      : scenario.severity === 'high'
                                        ? 'bg-[var(--color-data-provisional)]/100/20 text-[var(--color-data-provisional)]'
                                        : 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
                                  }`}
                                >
                                  {scenario.severity}
                                </span>
                              </div>
                            </div>
                            <StandardButton
                              variant="outline"
                              size="xs"
                              onClick={() => handleExecuteRecovery(scenario.id)}
                              disabled={isLoading}
                            >
                              Execute
                            </StandardButton>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6">
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('scenarios')}
                          className="w-full"
                        >
                          View All Scenarios
                        </StandardButton>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <StandardButton
                        variant="outline"
                        onClick={() => handleCreateBackup('full')}
                        disabled={isLoading}
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                          />
                        </svg>
                        Full Backup
                      </StandardButton>
                      <StandardButton variant="outline" onClick={loadData} disabled={isLoading}>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Refresh Data
                      </StandardButton>
                      <StandardButton variant="outline" onClick={() => setActiveTab('config')}>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Configuration
                      </StandardButton>
                    </div>
                  </div>
                </div>
              )}

              {/* Backups Tab */}
              {activeTab === 'backups' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Recovery Points
                    </h3>
                    <div className="flex space-x-3">
                      <StandardButton
                        variant="primary"
                        size="sm"
                        onClick={() => handleCreateBackup('full')}
                        disabled={isLoading}
                      >
                        Create New Backup
                      </StandardButton>
                      <StandardButton
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={isLoading}
                      >
                        Refresh
                      </StandardButton>
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-[var(--color-border)]">
                        <thead>
                          <tr className="bg-[var(--color-bg-tertiary)]">
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                              Timestamp
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                              Size
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {[
                            {
                              id: 1,
                              timestamp: new Date(Date.now() - 3600000),
                              type: 'incremental',
                              size: 1024 * 1024 * 10,
                              status: 'valid',
                            },
                            {
                              id: 2,
                              timestamp: new Date(Date.now() - 86400000),
                              type: 'full',
                              size: 1024 * 1024 * 250,
                              status: 'valid',
                            },
                            {
                              id: 3,
                              timestamp: new Date(Date.now() - 172800000),
                              type: 'incremental',
                              size: 1024 * 1024 * 15,
                              status: 'valid',
                            },
                          ].map((backup) => (
                            <tr key={backup.id} className="hover:bg-[var(--color-bg-tertiary)]">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-[var(--color-text-primary)]">
                                  {formatDate(backup.timestamp)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    backup.type === 'full'
                                      ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] text-[var(--color-category-practice)]'
                                      : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                                  }`}
                                >
                                  {backup.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-[var(--color-text-primary)]">
                                  {formatBytes(backup.size)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    backup.status === 'valid'
                                      ? 'bg-data-pass/20 text-data-pass'
                                      : 'bg-data-fail/20 text-data-fail'
                                  }`}
                                >
                                  {backup.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Scenarios Tab */}
              {activeTab === 'scenarios' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Disaster Scenarios
                    </h3>
                    <StandardButton
                      variant="outline"
                      size="sm"
                      onClick={loadData}
                      disabled={isLoading}
                    >
                      Refresh
                    </StandardButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      {
                        id: 'db-corruption',
                        name: 'Database Corruption',
                        severity: 'critical',
                        description: 'Database corruption or data inconsistency detected',
                        rto: 240,
                        rpo: 15,
                        procedures: [
                          'Switch to read-only mode',
                          'Restore from backup',
                          'Validate data integrity',
                        ],
                      },
                      {
                        id: 'server-failure',
                        name: 'Application Server Failure',
                        severity: 'high',
                        description: 'Application server crash or unavailability',
                        rto: 120,
                        rpo: 5,
                        procedures: ['Redirect traffic', 'Restart services', 'Scale resources'],
                      },
                      {
                        id: 'data-center-outage',
                        name: 'Data Center Outage',
                        severity: 'critical',
                        description: 'Complete data center or region outage',
                        rto: 360,
                        rpo: 60,
                        procedures: ['Activate DR site', 'Update DNS', 'Restore from geo-backups'],
                      },
                      {
                        id: 'security-breach',
                        name: 'Security Breach',
                        severity: 'critical',
                        description: 'Unauthorized access or data exfiltration',
                        rto: 480,
                        rpo: 0,
                        procedures: [
                          'Isolate systems',
                          'Revoke credentials',
                          'Restore from clean backups',
                        ],
                      },
                    ].map((scenario) => (
                      <div
                        key={scenario.id}
                        className="bg-[var(--color-bg-secondary)] rounded-xl p-6"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">
                              {scenario.name}
                            </h4>
                            <div className="flex items-center mt-2">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  scenario.severity === 'critical'
                                    ? 'bg-data-fail/20 text-data-fail'
                                    : scenario.severity === 'high'
                                      ? 'bg-[var(--color-data-provisional)]/100/20 text-[var(--color-data-provisional)]'
                                      : 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
                                }`}
                              >
                                {scenario.severity.toUpperCase()}
                              </span>
                              <span className="text-xs text-[var(--color-text-muted)] ml-3">
                                RTO: {scenario.rto}m • RPO: {scenario.rpo}m
                              </span>
                            </div>
                          </div>
                          <StandardButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleExecuteRecovery(scenario.id)}
                            disabled={isLoading}
                          >
                            Execute
                          </StandardButton>
                        </div>

                        <p className="text-sm text-[var(--color-text-muted)] mb-4">
                          {scenario.description}
                        </p>

                        <div>
                          <h5 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                            Recovery Procedures
                          </h5>
                          <ol className="list-decimal list-inside space-y-1">
                            {scenario.procedures.map((procedure, index) => (
                              <li key={index} className="text-sm text-[var(--color-text-muted)]">
                                {procedure}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Config Tab */}
              {activeTab === 'config' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Backup Configuration
                    </h3>
                    <StandardButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSuccess('Configuration saved successfully');
                      }}
                    >
                      Save Configuration
                    </StandardButton>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                          Backup Frequency
                        </label>
                        <select className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]">
                          <option value="15">Every 15 minutes</option>
                          <option value="30">Every 30 minutes</option>
                          <option value="60" selected>
                            Every hour
                          </option>
                          <option value="240">Every 4 hours</option>
                          <option value="1440">Daily</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                          Retention Period
                        </label>
                        <select className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]">
                          <option value="7">7 days</option>
                          <option value="30" selected>
                            30 days
                          </option>
                          <option value="90">90 days</option>
                          <option value="365">1 year</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                          Maximum Backup Size
                        </label>
                        <select className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]">
                          <option value="256">256 MB</option>
                          <option value="512">512 MB</option>
                          <option value="1024" selected>
                            1 GB
                          </option>
                          <option value="2048">2 GB</option>
                          <option value="5120">5 GB</option>
                        </select>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="compress"
                            className="h-4 w-4 text-[var(--color-accent)] rounded border-[var(--color-border)]"
                            defaultChecked
                          />
                          <label
                            htmlFor="compress"
                            className="ml-2 text-sm text-[var(--color-text-primary)]"
                          >
                            Enable compression
                          </label>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="encrypt"
                            className="h-4 w-4 text-[var(--color-accent)] rounded border-[var(--color-border)]"
                            defaultChecked
                          />
                          <label
                            htmlFor="encrypt"
                            className="ml-2 text-sm text-[var(--color-text-primary)]"
                          >
                            Enable encryption
                          </label>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="cloud"
                            className="h-4 w-4 text-[var(--color-accent)] rounded border-[var(--color-border)]"
                            defaultChecked
                          />
                          <label
                            htmlFor="cloud"
                            className="ml-2 text-sm text-[var(--color-text-primary)]"
                          >
                            Upload to cloud storage
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--color-text-muted)]">
                  Last updated: {formatDate(new Date())}
                </div>
                <div className="flex space-x-3">
                  <StandardButton variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </StandardButton>
                  <StandardButton
                    variant="primary"
                    size="sm"
                    onClick={loadData}
                    disabled={isLoading}
                  >
                    Refresh All
                  </StandardButton>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
