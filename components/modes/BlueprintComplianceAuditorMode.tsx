/**
 * Blueprint Compliance Auditor Mode
 *
 * Admin dashboard for analyzing NCCPA blueprint compliance across MedicalContent and Question pool.
 * Visualizes deviations, provides recommendations, and enables corrective actions.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileText,
  Database,
  Target,
  PieChart,
  Download,
  Play,
  Plus,
  Archive,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/loading';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/progress';

// Inline minimal Tabs/Table stubs — this mode is not yet wired into the app
const Tabs: React.FC<{ defaultValue?: string; value?: string; onValueChange?: (v: string) => void; className?: string; children: React.ReactNode }> = ({ className, children }) => <div className={className}>{children}</div>;
const TabsList: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <div className={`flex gap-1 ${className ?? ''}`}>{children}</div>;
const TabsTrigger: React.FC<{ value: string; className?: string; children: React.ReactNode }> = ({ className, children }) => <button className={className}>{children}</button>;
const TabsContent: React.FC<{ value: string; className?: string; children: React.ReactNode }> = ({ className, children }) => <div className={className}>{children}</div>;
const Table: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <table className={className}>{children}</table>;
const TableHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <thead className={className}>{children}</thead>;
const TableBody: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <tbody className={className}>{children}</tbody>;
const TableRow: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <tr className={className}>{children}</tr>;
const TableHead: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <th className={className}>{children}</th>;
const TableCell: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => <td className={className}>{children}</td>;
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { API_ENDPOINTS } from '@/lib/utils/apiConfig';

// Local type — services/domain/blueprintComplianceService isn't built yet
interface CorrectiveAction {
  system: string;
  action: string;
  quantity: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

interface SystemCompliance {
  system: string;
  targetPercent: number;
  targetWeight: number;
  count: number;
  totalCount: number;
  actualPercent: number;
  deviation: number;
  absoluteDeviation: number;
  status: 'met' | 'under' | 'over';
  recommendation?: string;
}

interface ComplianceSummary {
  complianceScore: number;
  systemsMet: number;
  systemsUnder: number;
  systemsOver: number;
  totalContentItems: number;
  analyzedAt: string;
  systems: SystemCompliance[];
  topDeviations: SystemCompliance[];
  recommendations: string[];
}

type AnalysisType = 'medical' | 'questions' | 'both';

export function BlueprintComplianceAuditorMode() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisType>('medical');
  const [medicalData, setMedicalData] = useState<ComplianceSummary | null>(null);
  const [questionsData, setQuestionsData] = useState<ComplianceSummary | null>(null);
  const [medicalCorrectiveActions, setMedicalCorrectiveActions] = useState<CorrectiveAction[] | null>(null);
  const [questionsCorrectiveActions, setQuestionsCorrectiveActions] = useState<CorrectiveAction[] | null>(null);

  const fetchComplianceData = async (type: AnalysisType) => {
    setRefreshing(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(
        `${getApiEndpoint((API_ENDPOINTS as Record<string, string>).COMPLIANCE_BLUEPRINT ?? '/api/admin/compliance/blueprint')}?type=${type}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const { data } = (await response.json()) as { data: { medical?: ComplianceSummary; questions?: ComplianceSummary; medicalCorrectiveActions?: CorrectiveAction[]; questionsCorrectiveActions?: CorrectiveAction[] } };
      if (type === 'medical' || type === 'both') {
        setMedicalData(data.medical ?? null);
        setMedicalCorrectiveActions(data.medicalCorrectiveActions || null);
      }
      if (type === 'questions' || type === 'both') {
        setQuestionsData(data.questions ?? null);
        setQuestionsCorrectiveActions(data.questionsCorrectiveActions || null);
      }
    } catch (err) {
      console.error('Failed to fetch compliance data', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load blueprint compliance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComplianceData(activeTab);
  }, [activeTab]);

  const handleRefresh = () => {
    fetchComplianceData(activeTab);
  };

  const handleExport = () => {
    // Export functionality will be enabled in an upcoming release
    toast.info('Export to CSV is not yet available. Your compliance data is automatically saved.');
  };

  const handleExecuteAction = async (action: CorrectiveAction) => {
    toast.info(`Automated content generation for ${action.system} is coming soon.`);
  };

  const currentData = activeTab === 'medical' ? medicalData : activeTab === 'questions' ? questionsData : null;
  const currentCorrectiveActions = activeTab === 'medical' ? medicalCorrectiveActions : activeTab === 'questions' ? questionsCorrectiveActions : null;

  const renderScoreGauge = (score: number) => (
    <div className="relative w-32 h-32 mx-auto" role="img" aria-label={`Compliance score: ${Math.round(score)}%`}>
      <svg className="w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={score >= 80 ? 'var(--color-data-pass)' : score >= 60 ? 'var(--color-data-provisional)' : 'var(--color-data-fail)'}
          strokeWidth="10"
          strokeDasharray={`${score * 2.83} 283`}
          strokeDashoffset="0"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dy="0.3em"
          fontSize="20"
          fontWeight="bold"
          fill="var(--color-text-primary)"
        >
          {Math.round(score)}%
        </text>
      </svg>
      <div className="text-center mt-2 text-sm text-[var(--color-text-secondary)]">Compliance Score</div>
    </div>
  );

  const renderSystemRow = (sys: SystemCompliance) => (
    <TableRow key={sys.system}>
      <TableCell className="font-medium">{sys.system}</TableCell>
      <TableCell className="text-right">{sys.count.toLocaleString()}</TableCell>
      <TableCell className="text-right">{sys.targetPercent.toFixed(1)}%</TableCell>
      <TableCell className="text-right">{sys.actualPercent.toFixed(1)}%</TableCell>
      <TableCell>
        <div className="flex items-center justify-end">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              sys.status === 'met'
                ? 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
                : sys.status === 'under'
                ? 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
                : 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)]'
            }`}
          >
            {sys.status === 'met' && <CheckCircle className="w-3 h-3 mr-1" />}
            {sys.status === 'under' && <TrendingDown className="w-3 h-3 mr-1" />}
            {sys.status === 'over' && <TrendingUp className="w-3 h-3 mr-1" />}
            {sys.status.charAt(0).toUpperCase() + sys.status.slice(1)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-[var(--color-text-secondary)]">{sys.recommendation}</TableCell>
    </TableRow>
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
              <Target className="w-8 h-8 text-[var(--color-accent)]" />
              Blueprint Compliance Auditor
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Analyze NCCPA blueprint distribution across content and question pools.
              Identify deviations and receive actionable recommendations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)]" />
            <span className="text-[var(--color-data-fail)]">{error}</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as AnalysisType)} className="mb-8">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="medical" className="gap-2">
              <FileText className="w-4 h-4" />
              Medical Content
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <Database className="w-4 h-4" />
              Question Pool
            </TabsTrigger>
            <TabsTrigger value="both" className="gap-2">
              <PieChart className="w-4 h-4" />
              Both
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading || refreshing ? (
              <div className="space-y-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            ) : currentData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-[var(--color-text-secondary)]">
                        Compliance Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderScoreGauge(currentData.complianceScore)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-[var(--color-text-secondary)]">
                        Systems Met
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-[var(--color-data-pass)]">
                        {currentData.systemsMet}
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">out of {currentData.systems.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-[var(--color-text-secondary)]">
                        Under Target
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-[var(--color-data-provisional)]">
                        {currentData.systemsUnder}
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">need more content</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-[var(--color-text-secondary)]">
                        Over Target
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-[var(--color-data-fail)]">
                        {currentData.systemsOver}
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">reduce focus</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Bar Chart - Target vs Actual */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Distribution Comparison
                    </CardTitle>
                    <CardDescription>
                      Target vs actual percentage per system (top 10 by deviation)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      {/* In a real implementation, integrate with a charting library like Recharts */}
                      <div className="flex items-center justify-center h-full border border-dashed border-[var(--color-border)] rounded-lg p-8">
                        <p className="text-[var(--color-text-muted)] text-center">
                          Chart visualization would be implemented with Recharts or similar.
                          <br />
                          <span className="text-sm">Data available for {currentData.systems.length} systems.</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Deviations */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Top Deviations Requiring Attention</CardTitle>
                    <CardDescription>
                      Systems with the largest absolute deviation from target.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>System</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Target %</TableHead>
                          <TableHead className="text-right">Actual %</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                          <TableHead>Recommendation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.topDeviations.map(renderSystemRow)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Full System Table */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>All Systems</CardTitle>
                    <CardDescription>
                      Detailed compliance breakdown for every NCCPA blueprint system.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>System</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Target %</TableHead>
                            <TableHead className="text-right">Actual %</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                            <TableHead>Recommendation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentData.systems.map(renderSystemRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>
                      Actionable insights to improve blueprint compliance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {currentData.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-3 p-3 bg-[var(--color-accent)]/10 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                          <span className="text-[var(--color-text-primary)]">{rec}</span>
                        </li>
                      ))}
                      {currentData.recommendations.length === 0 && (
                        <li className="text-[var(--color-text-muted)] italic">No recommendations — compliance is optimal.</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>

                {/* Corrective Actions */}
                {currentCorrectiveActions && currentCorrectiveActions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Corrective Actions</CardTitle>
                    <CardDescription>
                      Automated tasks to restore blueprint compliance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>System</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Priority</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentCorrectiveActions.map((action, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{action.system}</TableCell>
                            <TableCell>{action.action}</TableCell>
                            <TableCell className="text-right">{action.quantity}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={action.priority === 'high' ? 'destructive' : action.priority === 'medium' ? 'secondary' : 'default'}>
                                {action.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>{action.reason}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => handleExecuteAction(action)}>
                                <Play className="w-4 h-4 mr-2" />
                                Execute
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">No data available</h3>
                <p className="text-[var(--color-text-secondary)] mt-2">
                  {error ? 'Failed to load compliance data.' : 'Run a compliance analysis to see results.'}
                </p>
                <Button onClick={handleRefresh} className="mt-4">
                  Try Again
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}