/**
 * Data Export Component (Phase 5: Self-Optimizing Engine)
 * 
 * Provides data sovereignty - exports complete review history
 * including behavioral telemetry for offline analysis.
 * 
 * Export Formats:
 * - CSV: Full review history with telemetry (for Excel/Python)
 * - PDF: "Cognitive Health Report" with memory profile and behavioral flags
 */

import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { Download, FileSpreadsheet, FileText, AlertCircle } from 'lucide-react';

interface ReviewExportData {
  id: string;
  questionId: string;
  wasCorrect: boolean;
  createdAt: string;
  durationMs?: number;
  answerChangedCount?: number;
  telemetryJson?: any;
  system?: string;
  conditionId?: string;
}

export const DataExport: React.FC = () => {
  const { userId } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  /**
   * Fetch complete review history from API
   */
  const fetchReviewHistory = async (): Promise<ReviewExportData[]> => {
    const response = await fetch(`/api/user/review-history?userId=${userId}&limit=10000`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch review history: ${response.statusText}`);
    }

    const data = await response.json();
    return data.reviews || [];
  };

  /**
   * Export reviews as CSV with telemetry breakdown
   */
  const exportCSV = async () => {
    try {
      setIsExporting(true);
      setExportStatus({ type: null, message: '' });

      const reviews = await fetchReviewHistory();

      if (reviews.length === 0) {
        setExportStatus({
          type: 'error',
          message: 'No review data available to export'
        });
        return;
      }

      // Transform data for CSV export
      const csvData = reviews.map(review => {
        const telemetry = review.telemetryJson || {};
        
        return {
          review_id: review.id,
          question_id: review.questionId,
          system: review.system || 'Unknown',
          condition_id: review.conditionId || '',
          was_correct: review.wasCorrect ? 'YES' : 'NO',
          timestamp: new Date(review.createdAt).toISOString(),
          date: new Date(review.createdAt).toLocaleDateString(),
          time: new Date(review.createdAt).toLocaleTimeString(),
          
          // Duration metrics
          duration_ms: review.durationMs || 0,
          duration_seconds: (review.durationMs || 0) / 1000,
          
          // Behavioral metrics
          answer_changes: review.answerChangedCount || 0,
          
          // CRPL telemetry (if available)
          time_to_first_interaction_ms: telemetry.time_to_first_interaction_ms || 0,
          mouse_efficiency_index: telemetry.mouse_efficiency_index || 0,
          hover_entropy: telemetry.hover_entropy || 0,
          total_mouse_distance_px: telemetry.total_mouse_distance || 0,
          
          // Pause analysis
          short_pauses_count: telemetry.short_pauses?.length || 0,
          medium_pauses_count: telemetry.medium_pauses?.length || 0,
          long_pauses_count: telemetry.long_pauses?.length || 0,
          
          // Flags
          is_rapid_guess: telemetry.behavioral_flags?.includes('RAPID_GUESS') ? 'YES' : 'NO',
          is_excessive_hesitation: telemetry.behavioral_flags?.includes('EXCESSIVE_HESITATION') ? 'YES' : 'NO',
          is_answer_oscillation: telemetry.behavioral_flags?.includes('ANSWER_OSCILLATION') ? 'YES' : 'NO'
        };
      });

      // Convert to CSV
      const csv = Papa.unparse(csvData);

      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `panacea-review-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportStatus({
        type: 'success',
        message: `Successfully exported ${reviews.length} review records to CSV`
      });

    } catch (error) {
      console.error('CSV export failed:', error);
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Generate "Cognitive Health Report" PDF
   */
  const exportPDF = async () => {
    try {
      setIsExporting(true);
      setExportStatus({ type: null, message: '' });

      const reviews = await fetchReviewHistory();

      if (reviews.length === 0) {
        setExportStatus({
          type: 'error',
          message: 'No review data available to export'
        });
        return;
      }

      const doc = new jsPDF();
      let yPosition = 20;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('PANaCEa Cognitive Health Report', 20, yPosition);
      yPosition += 10;

      // Metadata
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
      yPosition += 5;
      doc.text(`Total Reviews: ${reviews.length}`, 20, yPosition);
      yPosition += 15;

      // Memory Profile
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Memory Profile', 20, yPosition);
      yPosition += 8;

      const accuracy = (reviews.filter(r => r.wasCorrect).length / reviews.length) * 100;
      const avgDuration = reviews.reduce((sum, r) => sum + (r.durationMs || 0), 0) / reviews.length / 1000;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Overall Accuracy: ${accuracy.toFixed(1)}%`, 25, yPosition);
      yPosition += 6;
      doc.text(`Average Response Time: ${avgDuration.toFixed(1)} seconds`, 25, yPosition);
      yPosition += 6;
      doc.text(`Total Study Sessions: ${reviews.length}`, 25, yPosition);
      yPosition += 15;

      // Behavioral Flags
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Behavioral Flags', 20, yPosition);
      yPosition += 8;

      const rapidGuessCount = reviews.filter(r => 
        r.telemetryJson?.behavioral_flags?.includes('RAPID_GUESS')
      ).length;

      const hesitationCount = reviews.filter(r =>
        r.telemetryJson?.behavioral_flags?.includes('EXCESSIVE_HESITATION')
      ).length;

      const oscillationCount = reviews.filter(r =>
        r.telemetryJson?.behavioral_flags?.includes('ANSWER_OSCILLATION')
      ).length;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Rapid Guesses (<500ms): ${rapidGuessCount} (${(rapidGuessCount/reviews.length*100).toFixed(1)}%)`, 25, yPosition);
      yPosition += 6;
      doc.text(`Excessive Hesitation: ${hesitationCount} (${(hesitationCount/reviews.length*100).toFixed(1)}%)`, 25, yPosition);
      yPosition += 6;
      doc.text(`Answer Oscillation: ${oscillationCount} (${(oscillationCount/reviews.length*100).toFixed(1)}%)`, 25, yPosition);
      yPosition += 15;

      // Recommendations
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommendations', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (rapidGuessCount / reviews.length > 0.15) {
        doc.text('• Consider slowing down - high rate of rapid guessing detected', 25, yPosition);
        yPosition += 6;
      }
      
      if (accuracy < 70) {
        doc.text('• Focus on understanding over speed - accuracy below target', 25, yPosition);
        yPosition += 6;
      }
      
      if (hesitationCount / reviews.length > 0.20) {
        doc.text('• Review content fundamentals - high hesitation rate suggests knowledge gaps', 25, yPosition);
        yPosition += 6;
      }

      doc.text('• Continue daily practice to maintain momentum', 25, yPosition);

      // Save PDF
      doc.save(`panacea-cognitive-health-${new Date().toISOString().split('T')[0]}.pdf`);

      setExportStatus({
        type: 'success',
        message: 'Successfully generated Cognitive Health Report PDF'
      });

    } catch (error) {
      console.error('PDF export failed:', error);
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Data Export
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Export your complete review history and behavioral telemetry for offline analysis.
        </p>
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CSV Export */}
        <button
          onClick={exportCSV}
          disabled={isExporting}
          className="flex items-center justify-center gap-3 p-6 bg-[var(--color-bg-elevated)] 
                   hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] 
                   rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed
                   hover:scale-[1.02] active:scale-[0.98]"
        >
          <FileSpreadsheet className="w-8 h-8 text-green-500" />
          <div className="text-left">
            <div className="font-semibold text-[var(--color-text-primary)]">
              Export to CSV
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              Full review history with telemetry
            </div>
          </div>
        </button>

        {/* PDF Export */}
        <button
          onClick={exportPDF}
          disabled={isExporting}
          className="flex items-center justify-center gap-3 p-6 bg-[var(--color-bg-elevated)] 
                   hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] 
                   rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed
                   hover:scale-[1.02] active:scale-[0.98]"
        >
          <FileText className="w-8 h-8 text-blue-500" />
          <div className="text-left">
            <div className="font-semibold text-[var(--color-text-primary)]">
              Cognitive Health Report
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              PDF summary with insights
            </div>
          </div>
        </button>
      </div>

      {/* Status Message */}
      {exportStatus.type && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg ${
            exportStatus.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          {exportStatus.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          {exportStatus.type === 'success' && (
            <Download className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`text-sm font-medium ${
                exportStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {exportStatus.message}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isExporting && (
        <div className="flex items-center justify-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <p className="text-sm text-blue-400">Preparing export...</p>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          What's included in exports?
        </h4>
        <ul className="space-y-2 text-xs text-[var(--color-text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>Complete review history with timestamps and accuracy</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>Behavioral telemetry: response times, mouse tracking, pauses</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>Cognitive flags: rapid guesses, hesitation, answer changes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>System and condition metadata for granular analysis</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DataExport;
