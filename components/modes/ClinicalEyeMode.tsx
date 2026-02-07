/**
 * Clinical Eye Mode
 * 
 * Module 2: Interactive visual diagnostics with point-and-click pathology identification.
 * Uses spatial-understanding for AI-generated heatmaps and veo_cameos for physical findings.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, Eye, Maximize2, HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import type { InteractiveImage, PointAndClickDiagnostic } from '@/types/clinical-eye-system';
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';

interface ClinicalEyeModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'active' | 'results';

export function ClinicalEyeMode({ onExit }: ClinicalEyeModeProps) {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [diagnostic, setDiagnostic] = useState<PointAndClickDiagnostic | null>(null);
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const [clicks, setClicks] = useState<Array<{ x: number; y: number; timestamp: string }>>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [score, setScore] = useState(0);

  const { integration } = useSystemIntegration();

  // Handle image click for point-and-click diagnostic
  const handleImageClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (!diagnostic || diagnostic.currentAttempt >= diagnostic.maxAttempts) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      const newClick = { x, y, timestamp: new Date().toISOString() };
      setClicks([...clicks, newClick]);

      // Check if click is within any correct region
      const isCorrect = checkClickAccuracy(x, y, diagnostic.correctRegions);

      if (isCorrect) {
        setFeedback({
          correct: true,
          message: 'Excellent! You correctly identified the pathology.',
        });
        setScore(score + diagnostic.scoring.pointsPerFinding);
        
        // Emit success event
        integration.emit({
          type: 'MODULE_ENTERED',
          timestamp: new Date().toISOString(),
          sourceModule: 'clinical_eye',
          sessionId: diagnostic.questionId,
          payload: { findingIdentified: true, accuracy: 95 },
        });
      } else {
        const penalty = diagnostic.scoring.penaltyPerWrongClick;
        setScore(Math.max(0, score + penalty));
        setFeedback({
          correct: false,
          message: 'Not quite. Look more carefully at the image.',
        });
      }

      // Update diagnostic
      setDiagnostic({
        ...diagnostic,
        studentClicks: [...diagnostic.studentClicks, newClick],
        currentAttempt: diagnostic.currentAttempt + 1,
      });
    },
    [diagnostic, clicks, score, integration]
  );

  // Handle hover for heatmap reveal
  const handleMouseEnter = useCallback(() => {
    const timer = setTimeout(() => {
      setHeatmapVisible(true);
      // Apply penalty
      setScore((s) => Math.max(0, s - 20));
    }, 2000); // 2 seconds hover required

    setHoverTimer(timer);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
  }, [hoverTimer]);

  // Load sample diagnostic question
  const handleStartExercise = useCallback(() => {
    // Sample diagnostic (in production, fetch from /api/clinical-eye/question)
    // For demo: using data URL with simple gradient to show UI/interaction pattern
    const placeholderImageUrl = 'data:image/svg+xml;base64,' + btoa(`
      <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg)"/>
        <text x="512" y="450" font-family="Arial" font-size="24" fill="#94a3b8" text-anchor="middle">
          Demo: Chest X-Ray - Pneumothorax
        </text>
        <text x="512" y="490" font-family="Arial" font-size="18" fill="#64748b" text-anchor="middle">
          Click regions to identify findings
        </text>
        <text x="512" y="530" font-family="Arial" font-size="16" fill="#475569" text-anchor="middle">
          (Production uses real medical images from database)
        </text>
        <ellipse cx="700" cy="280" rx="80" ry="120" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="5,5"/>
        <text x="700" y="420" font-family="Arial" font-size="14" fill="#ef4444" text-anchor="middle">
          Target: Pneumothorax Line
        </text>
      </svg>
    `);
    
    const sampleDiagnostic: PointAndClickDiagnostic = {
      questionId: 'clinical-eye-001',
      image: {
        id: 'xray-pneumothorax-001',
        modality: 'chest_xray',
        imageUrl: placeholderImageUrl,
        dimensions: { width: 1024, height: 1024 },
        findings: [
          {
            id: 'ptx-line',
            name: 'Pneumothorax Line',
            description: 'Visible pleural line with absent lung markings',
            coordinates: {
              type: 'polygon',
              points: [
                { x: 0.65, y: 0.2 },
                { x: 0.7, y: 0.3 },
                { x: 0.68, y: 0.5 },
                { x: 0.63, y: 0.4 },
              ],
            },
            significance: 'critical',
            isPrimary: true,
          },
        ],
        heatmap: {
          imageUrl: '/sample-heatmap.png', // Generated by spatial-understanding
          model: 'gemini-pro-vision',
          threshold: 0.7,
        },
      },
      studentClicks: [],
      correctRegions: [
        {
          id: 'ptx-line',
          name: 'Pneumothorax Line',
          description: 'Visible pleural line',
          coordinates: {
            type: 'polygon',
            points: [
              { x: 0.65, y: 0.2 },
              { x: 0.7, y: 0.3 },
              { x: 0.68, y: 0.5 },
              { x: 0.63, y: 0.4 },
            ],
          },
          significance: 'critical',
          isPrimary: true,
        },
      ],
      scoring: {
        maxDistanceForCredit: 0.1,
        pointsPerFinding: 100,
        penaltyPerWrongClick: -10,
      },
      maxAttempts: 3,
      currentAttempt: 0,
      hints: {
        subtle: 'Look carefully at the lung fields. What should be present but is missing?',
        moderate: {
          text: 'Focus on the right upper lung field.',
          highlightRegion: 'upper_right',
        },
        explicit: {
          text: 'The pneumothorax line is visible in the right upper lung.',
          revealHeatmapOpacity: 0.4,
        },
      },
      currentHintLevel: 'none',
    };

    setDiagnostic(sampleDiagnostic);
    setViewState('active');
  }, []);

  // Landing view
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent)]/20 flex items-center justify-center mx-auto mb-6">
              <Eye className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Clinical Eye</h1>
            <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
              Master visual diagnostics with interactive point-and-click pathology identification.
              No more multiple choice - click exactly where you see the abnormality.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <h3 className="font-semibold mb-2">Point-and-Click</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Click directly on pathology instead of choosing A/B/C/D
              </p>
            </div>
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <h3 className="font-semibold mb-2">AI Heatmaps</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Hover to reveal AI-generated probability overlays
              </p>
            </div>
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <h3 className="font-semibold mb-2">Instant Feedback</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Get immediate feedback on accuracy with pixel-level precision
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleStartExercise}
              className="px-8 py-4 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Start Exercise
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-8 py-4 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active diagnostic view
  if (viewState === 'active' && diagnostic) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="sticky top-0 z-10 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-[var(--color-accent)]" />
              <div>
                <h1 className="text-lg font-bold">Clinical Eye: {diagnostic.image.modality}</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Click on the pathology
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-[var(--color-text-muted)]">Score:</span>
                <span className="font-bold ml-2">{score}</span>
              </div>
              <div className="text-sm">
                <span className="text-[var(--color-text-muted)]">Attempts:</span>
                <span className="font-bold ml-2">
                  {diagnostic.currentAttempt}/{diagnostic.maxAttempts}
                </span>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Main Image Area */}
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-6">
                <div className="relative">
                  <img
                    src={diagnostic.image.imageUrl}
                    alt={diagnostic.image.modality}
                    className="w-full cursor-crosshair rounded-lg"
                    onClick={handleImageClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  />

                  {/* Heatmap overlay */}
                  {heatmapVisible && diagnostic.image.heatmap && (
                    <img
                      src={diagnostic.image.heatmap.imageUrl}
                      alt="Heatmap"
                      className="absolute inset-0 w-full h-full pointer-events-none opacity-40 rounded-lg mix-blend-multiply"
                    />
                  )}

                  {/* Click markers */}
                  {clicks.map((click, i) => (
                    <div
                      key={i}
                      className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `${click.x * 100}%`,
                        top: `${click.y * 100}%`,
                      }}
                    />
                  ))}
                </div>

                {feedback && (
                  <div
                    className={`mt-4 p-4 rounded-lg border ${
                      feedback.correct
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {feedback.correct ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                      <span className="font-medium">{feedback.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {heatmapVisible && (
                <div className="text-sm text-amber-500 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  <span>Heatmap revealed (-20 points)</span>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Instructions */}
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
                <h3 className="font-semibold mb-2">Instructions</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Click directly on the pathological finding. You have {diagnostic.maxAttempts} attempts.
                </p>
                <div className="mt-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)] text-xs">
                  <strong>Hint:</strong> Hover over the image for 2 seconds to reveal AI heatmap
                  (penalty: -20 points)
                </div>
              </div>

              {/* Hints */}
              {diagnostic.currentHintLevel === 'none' && (
                <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
                  <h3 className="font-semibold mb-2">Need Help?</h3>
                  <button
                    onClick={() =>
                      setDiagnostic({ ...diagnostic, currentHintLevel: 'subtle' })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity text-sm"
                  >
                    Get Subtle Hint
                  </button>
                </div>
              )}

              {diagnostic.currentHintLevel !== 'none' && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
                  <h3 className="font-semibold text-amber-500 mb-2">Hint</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {diagnostic.hints.subtle}
                  </p>
                </div>
              )}

              {/* Attempts remaining */}
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
                <h3 className="font-semibold mb-2">Progress</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Attempts</span>
                    <span className="font-mono">
                      {diagnostic.currentAttempt}/{diagnostic.maxAttempts}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Score</span>
                    <span className="font-bold">{score}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Helper function to check click accuracy
function checkClickAccuracy(
  x: number,
  y: number,
  correctRegions: Array<{ coordinates: { type: string; points: Array<{ x: number; y: number }> } }>
): boolean {
  for (const region of correctRegions) {
    if (region.coordinates.type === 'polygon') {
      if (pointInPolygon({ x, y }, region.coordinates.points)) {
        return true;
      }
    }
  }
  return false;
}

// Point-in-polygon algorithm
function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    
    const xi = pi.x;
    const yi = pi.y;
    const xj = pj.x;
    const yj = pj.y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
