/**
 * Sim Lab Mode
 *
 * Module 3: Digital procedural simulation with equipment validation,
 * sterile field tracking, and geometry validation.
 */

import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { X, Wrench, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type {
  ProceduralWorkflow,
  EquipmentItem,
  SterileField,
} from '@/types/digital-sim-lab-system';
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';

interface SimLabModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'equipment' | 'simulation' | 'results';

export function SimLabMode({ onExit }: SimLabModeProps) {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [procedure, setProcedure] = useState<ProceduralWorkflow | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [sterileBreaches, setSterileBreaches] = useState(0);
  const [isInSterileZone, setIsInSterileZone] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { integration } = useSystemIntegration();

  // Sample procedure (in production, fetch from API)
  const sampleProcedure: ProceduralWorkflow = {
    id: 'central-line-001',
    name: 'Central Line Placement',
    category: 'vascular_access',
    description: 'Ultrasound-guided central venous catheter via internal jugular vein',
    indications: ['Central venous access', 'Vasopressor administration'],
    contraindications: ['Infection at site', 'Severe coagulopathy'],
    steps: [
      {
        stepNumber: 1,
        name: 'Equipment Setup',
        description: 'Gather all necessary equipment',
        instructions: 'Select all required items for the procedure',
        media: {},
        criticalActions: ['Central line kit', 'Ultrasound', 'Sterile gown'],
        commonMistakes: ['Forgetting sterile drape'],
        safetyConsiderations: ['Verify sterility of all items'],
        timeEstimate: 180,
        isOptional: false,
        dependencies: [],
      },
      {
        stepNumber: 2,
        name: 'Patient Positioning',
        description: 'Position patient appropriately',
        instructions: 'Trendelenburg with head turned away',
        media: {},
        criticalActions: ['Position patient', 'Ensure airway access'],
        commonMistakes: ['Excessive head rotation'],
        safetyConsiderations: ['Monitor airway'],
        timeEstimate: 60,
        isOptional: false,
        dependencies: [1],
      },
      {
        stepNumber: 3,
        name: 'Sterile Field',
        description: 'Maintain sterile technique throughout',
        instructions: 'Keep hands within sterile field',
        media: {},
        criticalActions: ['Maintain sterility'],
        commonMistakes: ['Touching non-sterile surfaces'],
        safetyConsiderations: ['Zero contamination tolerance'],
        timeEstimate: 300,
        isOptional: false,
        dependencies: [1, 2],
      },
    ],
    requiredEquipment: [
      {
        id: 'central-line-kit',
        name: 'Central Line Kit',
        category: 'supply',
        imageUrl: '/equipment/central-line-kit.jpg',
        isSterile: true,
        quantity: 1,
        description: 'Pre-packaged sterile kit',
      },
      {
        id: 'ultrasound',
        name: 'Ultrasound Machine',
        category: 'instrument',
        imageUrl: '/equipment/ultrasound.jpg',
        isSterile: false,
        quantity: 1,
        description: 'High-frequency linear probe',
      },
      {
        id: 'sterile-gown',
        name: 'Sterile Gown',
        category: 'protective_equipment',
        imageUrl: '/equipment/sterile-gown.jpg',
        isSterile: true,
        quantity: 1,
        description: 'Full-body sterile gown',
      },
      {
        id: 'sterile-gloves',
        name: 'Sterile Gloves',
        category: 'protective_equipment',
        imageUrl: '/equipment/sterile-gloves.jpg',
        isSterile: true,
        quantity: 1,
        description: 'Sterile surgical gloves',
      },
      {
        id: 'chlorhexidine',
        name: 'Chlorhexidine',
        category: 'supply',
        imageUrl: '/equipment/chlorhexidine.jpg',
        isSterile: false,
        quantity: 1,
        description: 'Skin prep solution',
      },
    ],
    complications: ['Arterial puncture', 'Pneumothorax', 'Infection'],
    totalTimeEstimate: 900,
    difficulty: 'advanced',
    panceRelevance: 85,
  };

  const handleStartProcedure = useCallback(() => {
    setProcedure(sampleProcedure);
    setViewState('equipment');
  }, []);

  const handleEquipmentSelect = useCallback(
    (itemId: string) => {
      if (selectedEquipment.includes(itemId)) {
        setSelectedEquipment(selectedEquipment.filter((id) => id !== itemId));
      } else {
        setSelectedEquipment([...selectedEquipment, itemId]);
      }
    },
    [selectedEquipment]
  );

  const handleEquipmentComplete = useCallback(() => {
    const required = procedure?.requiredEquipment.map((e) => e.id) || [];
    const missing = required.filter((id) => !selectedEquipment.includes(id));

    if (missing.length > 0) {
      toast.warning(`Missing required items: ${missing.join(', ')}`);
      return;
    }

    setViewState('simulation');
    setCurrentStep(0);
  }, [procedure, selectedEquipment]);

  // Track mouse position for sterile field
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current || viewState !== 'simulation' || currentStep !== 2) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      // Simple sterile zone: center 60% of canvas
      const inZone = x > 0.2 && x < 0.8 && y > 0.15 && y < 0.85;

      if (!inZone && isInSterileZone) {
        // Breach detected!
        setSterileBreaches((b) => b + 1);
        setIsInSterileZone(false);
        toast.error('CONTAMINATION! Sterile field breached.');

        integration.emit({
          type: 'MODULE_ENTERED',
          timestamp: new Date().toISOString(),
          sourceModule: 'sim_lab',
          sessionId: procedure?.id || 'unknown',
          payload: { contaminationEvent: true, breaches: sterileBreaches + 1 },
        });
      } else if (inZone && !isInSterileZone) {
        setIsInSterileZone(true);
      }
    },
    [viewState, currentStep, isInSterileZone, sterileBreaches, procedure, integration]
  );

  // Landing view
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent)]/20 flex items-center justify-center mx-auto mb-6">
              <Wrench className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Digital Sim Lab</h1>
            <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
              Practice procedures with equipment validation, sterile field tracking, and geometry
              validation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <h3 className="font-semibold mb-2">Equipment Tray</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Select correct instruments before starting procedure
              </p>
            </div>
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <h3 className="font-semibold mb-2">Sterile Field</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Track mouse position - contamination = restart
              </p>
            </div>
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <h3 className="font-semibold mb-2">Real-Time Feedback</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Instant validation of technique and safety
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleStartProcedure}
              className="px-8 py-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold hover:opacity-90 transition-opacity"
            >
              Start Procedure
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

  // Equipment selection view
  if (viewState === 'equipment' && procedure) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">{procedure.name}: Equipment Setup</h1>
            <p className="text-[var(--color-text-muted)]">
              Select all required equipment for the procedure
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Equipment Bank */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Available Equipment</h2>
              <div className="grid grid-cols-2 gap-3">
                {procedure.requiredEquipment.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleEquipmentSelect(item.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedEquipment.includes(item.id)
                        ? 'border-data-pass bg-data-pass/10'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">{item.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{item.category}</div>
                    {selectedEquipment.includes(item.id) && (
                      <CheckCircle className="w-4 h-4 text-data-pass mt-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Tray */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Your Tray</h2>
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-6 min-h-[300px]">
                {selectedEquipment.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
                    Select equipment from the left
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedEquipment.map((itemId) => {
                      const item = procedure.requiredEquipment.find((e) => e.id === itemId);
                      return (
                        <div
                          key={itemId}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]"
                        >
                          <span className="text-sm">{item?.name}</span>
                          <CheckCircle className="w-4 h-4 text-data-pass" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={handleEquipmentComplete}
                disabled={selectedEquipment.length === 0}
                className="w-full mt-4 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to Procedure
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Simulation view with sterile field
  if (viewState === 'simulation' && procedure) {
    const step = procedure.steps[currentStep];

    if (!step) {
      return null; // Safety check
    }

    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="sticky top-0 z-10 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{procedure.name}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Step {step.stepNumber}: {step.name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-[var(--color-text-muted)]">Breaches:</span>
                <span
                  className={`font-bold ml-2 ${sterileBreaches > 0 ? 'text-[var(--color-data-fail)]' : 'text-[var(--color-data-pass)]'}`}
                >
                  {sterileBreaches}
                </span>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Simulation Area */}
            <div className="md:col-span-2">
              <div
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                className="relative rounded-xl bg-[var(--color-bg-secondary)] border-2 border-dashed border-[var(--color-border)] p-12 min-h-[500px] cursor-crosshair"
              >
                {/* Sterile field indicator */}
                {currentStep === 2 && (
                  <div
                    className="absolute inset-0 m-12 border-2 border-data-pass/30 rounded-lg pointer-events-none"
                    style={{
                      boxShadow: isInSterileZone
                        ? '0 0 20px rgba(16, 185, 129, 0.3)'
                        : '0 0 20px rgba(239, 68, 68, 0.5)',
                    }}
                  >
                    <div className="absolute top-2 left-2 text-xs font-semibold">
                      {isInSterileZone ? (
                        <span className="text-data-pass">✓ Sterile Zone</span>
                      ) : (
                        <span className="text-[var(--color-data-fail)]">✗ Outside Sterile Field</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-center py-20">
                  <p className="text-[var(--color-text-muted)] mb-4">{step.instructions}</p>
                  {currentStep === 2 && (
                    <p className="text-sm text-data-provisional">Keep your cursor within the green zone</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className="px-6 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
                >
                  Previous Step
                </button>
                <button
                  onClick={() => {
                    if (currentStep < procedure.steps.length - 1) {
                      setCurrentStep(currentStep + 1);
                    } else {
                      setViewState('results');
                    }
                  }}
                  className="px-6 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity"
                >
                  {currentStep < procedure.steps.length - 1 ? 'Next Step' : 'Complete Procedure'}
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Step Info */}
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
                <h3 className="font-semibold mb-2">{step.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-3">{step.description}</p>

                <div className="space-y-2 text-xs">
                  <div>
                    <strong>Critical Actions:</strong>
                    <ul className="mt-1 space-y-1">
                      {step.criticalActions.map((action, i) => (
                        <li key={i} className="text-[var(--color-text-muted)]">
                          • {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-data-provisional">Common Mistakes:</strong>
                    <ul className="mt-1 space-y-1">
                      {step.commonMistakes.map((mistake, i) => (
                        <li key={i} className="text-[var(--color-text-muted)]">
                          • {mistake}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
                <h3 className="font-semibold mb-3">Progress</h3>
                <div className="space-y-2">
                  {procedure.steps.map((s, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg text-sm ${
                        i === currentStep
                          ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium'
                          : i < currentStep
                            ? 'bg-data-pass/10 text-data-pass'
                            : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      {i < currentStep && <CheckCircle className="w-4 h-4 inline mr-2" />}
                      Step {s.stepNumber}: {s.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  if (viewState === 'results' && procedure) {
    const score = sterileBreaches === 0 ? 100 : Math.max(0, 100 - sterileBreaches * 20);

    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Procedure Complete!</h1>
            <div className="text-5xl font-bold text-[var(--color-accent)] mb-2">{score}/100</div>
            <p className="text-[var(--color-text-muted)]">Final Score</p>
          </div>

          <div className="space-y-4">
            {sterileBreaches === 0 ? (
              <div className="p-6 rounded-xl bg-data-pass/10 border border-data-pass/30">
                <div className="flex items-center gap-2 text-data-pass mb-2">
                  <CheckCircle className="w-6 h-6" />
                  <h3 className="text-lg font-semibold">Perfect Sterile Technique!</h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  You maintained the sterile field throughout the entire procedure.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[var(--color-data-fail)]/100/10 border border-[var(--color-data-fail)]/30">
                <div className="flex items-center gap-2 text-[var(--color-data-fail)] mb-2">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-lg font-semibold">
                    Sterile Field Breaches: {sterileBreaches}
                  </h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Practice maintaining awareness of the sterile field boundaries.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-4 justify-center">
            <button
              onClick={() => {
                setViewState('landing');
                setSelectedEquipment([]);
                setSterileBreaches(0);
                setCurrentStep(0);
              }}
              className="px-6 py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold hover:opacity-90 transition-opacity"
            >
              Try Another Procedure
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-6 py-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                Exit to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
