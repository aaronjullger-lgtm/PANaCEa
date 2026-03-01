/**
 * PANaCEa Medical Education Compliance Dashboard
 *
 * Comprehensive dashboard for monitoring and managing medical education compliance
 * with NCCPA, ARC-PA, AAPA, and other regulatory standards.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMedicalCompliance } from '@/hooks/useMedicalCompliance';
import { StandardButton } from '@/components/shared/StandardButton';
import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Shield,
  Calendar,
  Users,
  Target,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Search,
  X,
} from 'lucide-react';

interface ComplianceDashboardProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const MedicalComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  isOpen = true,
  onClose,
}) => {
  const {
    isLoading,
    dashboardData,
    complianceIssues,
    refreshCompliance,
    runComprehensiveAudit,
    resolveIssue,
    calculateBlueprintAdherence,
  } = useMedicalCompliance();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'standards' | 'issues' | 'blueprint' | 'reports'
  >('overview');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Refresh compliance data on mount
  useEffect(() => {
    if (isOpen) {
      refreshCompliance();
    }
  }, [isOpen, refreshCompliance]);

  const handleRunAudit = async () => {
    await runComprehensiveAudit();
  };

  const handleResolveIssue = async (issueId: string) => {
    if (!resolutionText.trim()) {
      alert('Please provide a resolution description');
      return;
    }

    await resolveIssue(issueId, resolutionText);
    setResolutionText('');
    setSelectedIssue(null);
  };

  const filteredIssues = complianceIssues.filter((issue) => {
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (searchQuery && !issue.description.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-data-fail/20 text-data-fail border-data-fail/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'low':
        return 'bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] text-[var(--color-category-practice)] border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]';
      default:
        return 'bg-data-neutral/20 text-data-neutral dark:text-data-neutral border-data-neutral/30 dark:border-data-neutral/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-data-pass/20 text-data-pass border-data-pass/30';
      case 'non_compliant':
        return 'bg-data-fail/20 text-data-fail border-data-fail/30';
      case 'partial':
        return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'pending':
        return 'bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] text-[var(--color-category-practice)] border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]';
      default:
        return 'bg-data-neutral/20 text-data-neutral dark:text-data-neutral border-data-neutral/30 dark:border-data-neutral/30';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-category-practice)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">Loading compliance dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-[var(--color-category-practice)]" />
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    Medical Education Compliance Dashboard
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Monitor NCCPA, ARC-PA, AAPA, and regulatory compliance
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StandardButton
                  variant="outline"
                  size="sm"
                  onClick={handleRunAudit}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  Run Full Audit
                </StandardButton>
                {onClose && (
                  <StandardButton
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    icon={<X className="w-4 h-4" />}
                  >
                    Close
                  </StandardButton>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--color-border)]">
              <div className="flex px-6">
                {(['overview', 'standards', 'issues', 'blueprint', 'reports'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                        activeTab === tab
                          ? 'text-[var(--color-category-practice)]'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-category-practice)]"
                        />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-5 border border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-data-pass/10 rounded-lg">
                          <CheckCircle className="w-6 h-6 text-data-pass" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-data-pass/20 text-data-pass">
                          {dashboardData.complianceScore.toFixed(1)}%
                        </span>
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Overall Compliance
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Across all standards and requirements
                      </p>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-5 border border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-data-fail/10 rounded-lg">
                          <AlertTriangle className="w-6 h-6 text-data-fail" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-data-fail/20 text-data-fail">
                          {
                            complianceIssues.filter(
                              (i) => i.severity === 'critical' || i.severity === 'high'
                            ).length
                          }
                        </span>
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Critical Issues
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Requires immediate attention
                      </p>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-5 border border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] rounded-lg">
                          <Target className="w-6 h-6 text-[var(--color-category-practice)]" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] text-[var(--color-category-practice)]">
                          {(dashboardData.blueprintAdherence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Blueprint Adherence
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        NCCPA PANCE distribution
                      </p>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-5 border border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Calendar className="w-6 h-6 text-purple-500" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-600">
                          {dashboardData.upcomingReviews.length}
                        </span>
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Upcoming Reviews
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Scheduled compliance checks
                      </p>
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
                    <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <StandardButton
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('standards')}
                        icon={<FileText className="w-4 h-4" />}
                      >
                        View Standards
                      </StandardButton>
                      <StandardButton
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('issues')}
                        icon={<AlertTriangle className="w-4 h-4" />}
                      >
                        View Issues
                      </StandardButton>
                      <StandardButton
                        variant="primary"
                        size="sm"
                        onClick={() => setActiveTab('reports')}
                        icon={<Download className="w-4 h-4" />}
                      >
                        Generate Report
                      </StandardButton>
                    </div>
                  </div>
                </div>
              )}

              {/* Standards Tab */}
              {activeTab === 'standards' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">
                      Medical Education Standards
                    </h3>
                    <StandardButton
                      variant="primary"
                      size="sm"
                      icon={<FileText className="w-4 h-4" />}
                    >
                      Add Standard
                    </StandardButton>
                  </div>

                  <div className="space-y-4">
                    {dashboardData.standards.map((standard) => (
                      <div
                        key={standard.id}
                        className="bg-[var(--color-bg-secondary)] rounded-xl p-5 border border-[var(--color-border)]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                standard.status === 'compliant'
                                  ? 'bg-data-pass/10'
                                  : standard.status === 'partial'
                                    ? 'bg-yellow-500/10'
                                    : 'bg-data-fail/10'
                              }`}
                            >
                              {standard.status === 'compliant' ? (
                                <CheckCircle className="w-5 h-5 text-data-pass" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-[var(--color-text-primary)]">
                                {standard.name}
                              </h4>
                              <p className="text-sm text-[var(--color-text-muted)]">
                                {standard.organization} • {standard.version}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 text-sm rounded-full ${getStatusColor(standard.status)}`}
                          >
                            {standard.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] mb-3">
                          {standard.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--color-text-muted)]">
                            Compliance: {standard.complianceRate}%
                          </span>
                          <StandardButton variant="ghost" size="xs">
                            View Details
                          </StandardButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues Tab */}
              {activeTab === 'issues' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">
                      Compliance Issues
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                        <input
                          type="text"
                          placeholder="Search issues..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-category-practice)] focus:border-transparent"
                        />
                      </div>
                      <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value)}
                        className="px-3 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-category-practice)] focus:border-transparent"
                        title="Filter issues by severity"
                        aria-label="Filter issues by severity"
                      >
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {filteredIssues.length === 0 ? (
                      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 text-center border border-[var(--color-border)]">
                        <CheckCircle className="w-12 h-12 text-data-pass mx-auto mb-4" />
                        <h4 className="font-semibold text-[var(--color-text-primary)] mb-2">
                          No Compliance Issues Found
                        </h4>
                        <p className="text-sm text-[var(--color-text-muted)] mb-4">
                          All standards are currently compliant with medical education requirements.
                        </p>
                        <StandardButton variant="outline" size="sm" onClick={handleRunAudit}>
                          Run New Audit
                        </StandardButton>
                      </div>
                    ) : (
                      filteredIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="bg-[var(--color-bg-secondary)] rounded-xl p-5 border border-[var(--color-border)]"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${getSeverityColor(issue.severity)}`}>
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-[var(--color-text-primary)]">
                                  {issue.title}
                                </h4>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {issue.standard} •{' '}
                                  {new Date(issue.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`px-3 py-1 text-xs rounded-full ${getSeverityColor(issue.severity)}`}
                            >
                              {issue.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-primary)] mb-3">
                            {issue.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--color-text-muted)]">
                              Status: {issue.status}
                            </span>
                            {issue.status === 'open' && (
                              <StandardButton
                                variant="outline"
                                size="xs"
                                onClick={() => setSelectedIssue(issue.id)}
                              >
                                Resolve Issue
                              </StandardButton>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Blueprint Tab */}
              {activeTab === 'blueprint' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">
                      NCCPA PANCE Blueprint Adherence
                    </h3>
                    <StandardButton
                      variant="outline"
                      size="sm"
                      onClick={() => calculateBlueprintAdherence()}
                      icon={<RefreshCw className="w-4 h-4" />}
                    >
                      Recalculate
                    </StandardButton>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
                    <div className="text-center mb-6">
                      <div className="text-5xl font-bold text-[var(--color-text-primary)] mb-2">
                        {(dashboardData.blueprintAdherence * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        Overall Adherence to NCCPA Blueprint
                      </div>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(dashboardData.blueprintDistribution || {}).map(
                        ([system, target]) => {
                          const actual = dashboardData.actualDistribution?.[system] || 0;
                          const difference = actual - target;
                          const isWithinTolerance = Math.abs(difference) <= 2;

                          return (
                            <div key={system} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm text-[var(--color-text-primary)]">
                                  {system}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-[var(--color-text-muted)]">
                                    Target: {target}%
                                  </span>
                                  <span
                                    className={`text-sm font-medium ${
                                      isWithinTolerance ? 'text-data-pass' : 'text-data-fail'
                                    }`}
                                  >
                                    {difference > 0 ? '+' : ''}
                                    {difference.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${actual}%` }}
                                  className={`h-full ${
                                    isWithinTolerance ? 'bg-data-pass' : 'bg-data-fail'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Reports Tab */}
              {activeTab === 'reports' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">
                      Compliance Reports
                    </h3>
                    <StandardButton
                      variant="primary"
                      size="sm"
                      icon={<Download className="w-4 h-4" />}
                      onClick={() => {
                        const report = {
                          generatedAt: new Date().toISOString(),
                          complianceScore: dashboardData.complianceScore,
                          blueprintAdherence: dashboardData.blueprintAdherence,
                          totalIssues: complianceIssues.length,
                          standards: dashboardData.standards.length,
                          compliantStandards: dashboardData.standards.filter(
                            (s) => s.status === 'compliant'
                          ).length,
                        };

                        const blob = new Blob([JSON.stringify(report, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export Report
                    </StandardButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-4">
                        Report Types
                      </h4>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-[var(--color-category-practice)]" />
                            <div>
                              <h5 className="font-medium text-[var(--color-text-primary)]">
                                Summary Report
                              </h5>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                High-level compliance overview
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-data-pass" />
                            <div>
                              <h5 className="font-medium text-[var(--color-text-primary)]">
                                Detailed Analysis
                              </h5>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Comprehensive compliance metrics
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-data-fail" />
                            <div>
                              <h5 className="font-medium text-[var(--color-text-primary)]">
                                Issues Report
                              </h5>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Detailed issue tracking and resolution
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-4">
                        Recent Reports
                      </h4>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-[var(--color-text-primary)]">
                              Monthly Compliance Summary
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              Yesterday
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            95.2% compliance score
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-[var(--color-text-primary)]">
                              Blueprint Adherence Report
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              1 week ago
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            98.7% blueprint adherence
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-[var(--color-text-primary)]">
                              Standards Audit Report
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              2 weeks ago
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            12 standards reviewed
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
