/**
 * PANaCEa Medical Education Compliance Hook
 *
 * React hook for monitoring and managing medical education compliance
 * Integrates with MedicalComplianceService for real-time compliance tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { MedicalComplianceService } from '@/services/medicalComplianceService';
import type {
  ComplianceStandard,
  ComplianceStatus,
  ContentComplianceCheck,
  ComplianceIssue,
} from '@/services/medicalComplianceService';

export interface ComplianceDashboardData {
  standards: ComplianceStandard[];
  overallCompliance: number;
  criticalIssues: number;
  pendingReviews: number;
  blueprintAdherence: number;
  recentChecks: ContentComplianceCheck[];
  upcomingReviews: { standard: string; date: Date }[];
  // Optional UI fields (used by unwired MedicalComplianceDashboard)
  complianceScore?: number;
  blueprintDistribution?: Record<string, number>;
  actualDistribution?: Record<string, number>;
}

export interface UseMedicalComplianceReturn {
  // State
  isLoading: boolean;
  dashboardData: ComplianceDashboardData | null;
  selectedStandard: ComplianceStandard | null;
  complianceIssues: ComplianceIssue[];

  // Actions
  refreshCompliance: () => Promise<void>;
  checkContentCompliance: (
    contentId: string,
    contentType: string
  ) => Promise<ContentComplianceCheck>;
  runComprehensiveAudit: () => Promise<void>;
  resolveIssue: (issueId: string, resolution: string) => Promise<void>;

  // Utilities
  getStandardById: (id: string) => ComplianceStandard | undefined;
  getComplianceStatus: (standardId: string, requirementId: string) => ComplianceStatus | undefined;
  calculateBlueprintAdherence: () => Promise<number>;
}

export function useMedicalCompliance(): UseMedicalComplianceReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<ComplianceDashboardData | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<ComplianceStandard | null>(null);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [complianceService] = useState(() => new MedicalComplianceService());

  // Load initial compliance data
  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get all compliance standards
      const standards = complianceService.getStandards();

      // Run comprehensive audit
      const auditResult = await complianceService.runComplianceAudit();

      // Get blueprint distribution analysis
      const blueprintAnalysis = await complianceService.getBlueprintDistribution();

      // Calculate overall compliance
      const overallCompliance = calculateOverallCompliance(auditResult);

      // Count critical issues
      const criticalIssues = auditResult.issues.filter(
        (issue) => issue.severity === 'critical' && issue.status === 'open'
      ).length;

      // Count pending reviews
      const pendingReviews = auditResult.issues.filter(
        (issue) => issue.status === 'open' || issue.status === 'in_progress'
      ).length;

      // Calculate blueprint adherence (derived from target/difference)
      const blueprintAdherence =
        blueprintAnalysis.length > 0
          ? blueprintAnalysis.reduce(
              (sum, item) =>
                sum + (item.target > 0 ? Math.max(0, 1 - item.difference / item.target) : 0),
              0
            ) / blueprintAnalysis.length
          : 0;

      // Get recent compliance checks (mock for now)
      const recentChecks: ContentComplianceCheck[] = [];

      // Get upcoming reviews
      const upcomingReviews = standards
        .filter((standard) => new Date(standard.reviewDate) > new Date())
        .map((standard) => ({
          standard: standard.name,
          date: standard.reviewDate,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5);

      setDashboardData({
        standards,
        overallCompliance,
        criticalIssues,
        pendingReviews,
        blueprintAdherence,
        recentChecks,
        upcomingReviews,
      });

      // Set compliance issues
      setComplianceIssues(auditResult.issues);
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [complianceService]);

  const calculateOverallCompliance = (auditResult: any): number => {
    if (!auditResult.standards || auditResult.standards.length === 0) return 0;

    const totalRequirements = auditResult.standards.reduce(
      (sum: number, standard: any) => sum + standard.requirements.length,
      0
    );

    const compliantRequirements = auditResult.standards.reduce((sum: number, standard: any) => {
      const compliantCount = standard.requirements.filter(
        (req: any) => req.status === 'compliant'
      ).length;
      return sum + compliantCount;
    }, 0);

    return totalRequirements > 0 ? (compliantRequirements / totalRequirements) * 100 : 0;
  };

  const refreshCompliance = useCallback(async () => {
    await loadComplianceData();
  }, [loadComplianceData]);

  const checkContentCompliance = useCallback(
    async (contentId: string, contentType: string): Promise<ContentComplianceCheck> => {
      return await complianceService.checkContentCompliance(contentId, contentType);
    },
    [complianceService]
  );

  const runComprehensiveAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const auditResult = await complianceService.runComplianceAudit();
      setComplianceIssues(auditResult.issues);
      await loadComplianceData(); // Refresh dashboard data
    } finally {
      setIsLoading(false);
    }
  }, [complianceService, loadComplianceData]);

  const resolveIssue = useCallback(
    async (issueId: string, resolution: string) => {
      // In a real implementation, this would call a method on complianceService
      // For now, we'll just update the local state
      setComplianceIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? { ...issue, status: 'resolved', remediation: resolution } : issue
        )
      );

      // Refresh compliance data
      await refreshCompliance();
    },
    [refreshCompliance]
  );

  const getStandardById = useCallback(
    (id: string) => {
      return dashboardData?.standards.find((standard) => standard.id === id);
    },
    [dashboardData]
  );

  const getComplianceStatus = useCallback((standardId: string, requirementId: string) => {
    // This would normally come from the compliance service
    // For now, return undefined
    return undefined;
  }, []);

  const calculateBlueprintAdherence = useCallback(async (): Promise<number> => {
    try {
      const analysis = await complianceService.getBlueprintDistribution();
      if (analysis.length === 0) return 0;

      return (
        analysis.reduce(
          (sum, item) =>
            sum + (item.target > 0 ? Math.max(0, 1 - item.difference / item.target) : 0),
          0
        ) / analysis.length
      );
    } catch (error) {
      console.error('Failed to calculate blueprint adherence:', error);
      return 0;
    }
  }, [complianceService]);

  return {
    // State
    isLoading,
    dashboardData,
    selectedStandard,
    complianceIssues,

    // Actions
    refreshCompliance,
    checkContentCompliance,
    runComprehensiveAudit,
    resolveIssue,

    // Utilities
    getStandardById,
    getComplianceStatus,
    calculateBlueprintAdherence,
  };
}
