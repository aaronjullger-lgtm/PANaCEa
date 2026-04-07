import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Move, Maximize2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MedicalImage {
  id: string;
  type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'ecg';
  bodyPart: string;
  url: string;
  findings: string[];
  normalFindings?: string[];
  interpretation: string;
  clinicalContext: string;
}

interface ImagingViewerProps {
  image: MedicalImage;
  onClose: () => void;
  onInterpret: (interpretation: string) => void;
  requireInterpretation: boolean;
}

export const ImagingViewer: React.FC<ImagingViewerProps> = ({
  image,
  onClose,
  onInterpret,
  requireInterpretation,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [userInterpretation, setUserInterpretation] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const getModalityLabel = (type: MedicalImage['type']) => {
    switch (type) {
      case 'xray':
        return 'X-Ray';
      case 'ct':
        return 'CT Scan';
      case 'mri':
        return 'MRI';
      case 'ultrasound':
        return 'Ultrasound';
      case 'ecg':
        return 'ECG/EKG';
      default:
        return 'Medical Image';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmitInterpretation = () => {
    if (userInterpretation.trim()) {
      onInterpret(userInterpretation);
      setShowAnswer(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4">
      <div role="dialog" aria-modal="true" aria-label={`${getModalityLabel(image.type)} viewer: ${image.bodyPart}`} className="bg-[var(--color-bg-secondary)] rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden shadow-[0_18px_42px_var(--color-shadow-soft)] flex flex-col border border-[var(--color-border)]">
        {/* Header */}
        <div className="bg-data-neutral border-b border-data-neutral p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-inverse)] flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-[var(--color-category-practice)] text-sm">
                {getModalityLabel(image.type)}
              </span>
              {image.bodyPart}
            </h2>
            <p className="text-sm text-data-neutral mt-1">{image.clinicalContext}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-data-neutral rounded-lg transition-colors text-[var(--color-text-inverse)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-sm text-data-neutral w-16 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-data-neutral rounded-lg transition-colors text-[var(--color-text-inverse)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="w-px h-6 bg-data-neutral mx-2" />
            <button
              onClick={handleRotate}
              className="p-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-data-neutral rounded-lg transition-colors text-[var(--color-text-inverse)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              aria-label="Rotate image"
            >
              <RotateCw className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={handleReset}
              className="p-2.5 min-h-[36px] hover:bg-data-neutral rounded-lg transition-colors text-[var(--color-text-inverse)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              aria-label="Reset view"
            >
              Reset
            </button>
            <div className="w-px h-6 bg-data-neutral mx-2" />
            <button
              onClick={onClose}
              className="p-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-data-neutral rounded-lg transition-colors text-[var(--color-text-inverse)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Image Viewer */}
          <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-primary)] p-8 overflow-auto">
            <div
              className="transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={image.url}
                alt={`${image.type} of ${image.bodyPart}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-[0_18px_42px_var(--color-shadow-soft)]"
              />
            </div>
          </div>

          {/* Interpretation Panel */}
          <div className="w-96 bg-data-neutral border-l border-data-neutral overflow-y-auto">
            <div className="p-6 space-y-6">
              {requireInterpretation && !showAnswer ? (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-inverse)] mb-2">Your Interpretation</h3>
                    <p className="text-sm text-data-neutral mb-4">
                      Describe the key findings you observe in this {image.type}.
                    </p>
                    <textarea
                      value={userInterpretation}
                      onChange={(e) => setUserInterpretation(e.target.value)}
                      placeholder="Describe findings, abnormalities, and your interpretation..."
                      className="w-full h-48 px-4 py-3 bg-data-neutral border border-data-neutral rounded-lg text-[var(--color-text-inverse)] placeholder-data-neutral focus:ring-2 focus:ring-[var(--color-category-practice)] focus:border-transparent resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmitInterpretation}
                    disabled={!userInterpretation.trim()}
                    className="w-full px-6 py-3 bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] disabled:bg-data-neutral disabled:cursor-not-allowed text-[var(--color-text-inverse)] font-semibold rounded-lg transition-colors"
                  >
                    Submit Interpretation
                  </button>

                  <div className="pt-4 border-t border-data-neutral">
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="text-sm text-[var(--color-category-practice)] hover:text-[var(--color-category-practice)] transition-colors"
                    >
                      Skip to answer →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {userInterpretation && (
                    <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                      <h4 className="text-sm font-semibold text-data-neutral mb-2">
                        Your Interpretation:
                      </h4>
                      <p className="text-[var(--color-text-inverse)] text-sm">{userInterpretation}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-inverse)] mb-3">Key Findings</h3>
                    <ul className="space-y-2">
                      {image.findings.map((finding, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral">
                          <span className="text-data-fail mt-0.5">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {image.normalFindings && image.normalFindings.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-data-neutral mb-2">Normal Findings</h3>
                      <ul className="space-y-1">
                        {image.normalFindings.map((finding, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral">
                            <Check className="w-4 h-4 text-data-pass mt-0.5 flex-shrink-0" />
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-[color-mix(in_srgb,var(--color-category-practice)_50%,transparent)] border border-[var(--color-category-practice)] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[var(--color-category-practice)] mb-2">
                      Clinical Interpretation
                    </h3>
                    <p className="text-sm text-[var(--color-category-practice)] leading-relaxed">{image.interpretation}</p>
                  </div>

                  {!requireInterpretation && (
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-3 bg-data-neutral hover:bg-data-neutral text-[var(--color-text-inverse)] font-semibold rounded-lg transition-colors"
                    >
                      Continue Encounter
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sample imaging data generator
export function generateSampleImaging(type: MedicalImage['type'], condition: string): MedicalImage {
  const sampleImages: Record<string, MedicalImage> = {
    pneumonia_xray: {
      id: 'xr-001',
      type: 'xray',
      bodyPart: 'Chest PA and Lateral',
      url: '/images/radiology/pneumonia-xray.png',
      clinicalContext: 'Patient with fever, productive cough, and hypoxia',
      findings: [
        'Right lower lobe consolidation',
        'Air bronchograms present',
        'Blunting of right costophrenic angle suggesting effusion',
        'Heart size normal',
      ],
      normalFindings: ['No pneumothorax', 'Left lung clear', 'Bony structures intact'],
      interpretation:
        'Findings consistent with right lower lobe pneumonia with small parapneumonic effusion. Clinical correlation recommended. Consider CBC, blood cultures, and appropriate antibiotic therapy.',
    },
    mi_ecg: {
      id: 'ecg-001',
      type: 'ecg',
      bodyPart: '12-Lead ECG',
      url: '/images/radiology/stemi-ecg.png',
      clinicalContext: 'Patient with acute chest pain radiating to left arm',
      findings: [
        'ST-segment elevation in leads II, III, aVF (>1mm)',
        'Reciprocal ST depression in leads I, aVL',
        'Q waves developing in inferior leads',
        'Heart rate 95 bpm, regular rhythm',
      ],
      normalFindings: [
        'No signs of old MI in other territories',
        'QRS duration normal',
        'No conduction abnormalities',
      ],
      interpretation:
        'Acute inferior STEMI. Immediate cardiology consultation and cardiac catheterization indicated. Start dual antiplatelet therapy, anticoagulation, and prepare for primary PCI.',
    },
  };

  // Intentional fallback when no sample exists: branded "No image" state (not misleading content).
  return (
    sampleImages[`${condition}_${type}`] || {
      id: 'placeholder',
      type,
      bodyPart: 'Medical Image',
      url: '/images/radiology/placeholder.png',
      clinicalContext: 'No image available for this case.',
      findings: ['Image not loaded'],
      interpretation: 'Select a case with an image or add assets via media pipeline.',
    }
  );
}
