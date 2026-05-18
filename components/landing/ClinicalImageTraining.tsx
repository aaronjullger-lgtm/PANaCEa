import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CircleDot, Eye, ScanLine, ShieldCheck } from 'lucide-react';
import {
  MedicalGlassCard,
  MetricVital,
  ScannerFrame,
  SectionHeader,
} from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import {
  CLINICAL_IMAGE_CASES,
  type ClinicalImageAnnotation,
  type ClinicalImageAnnotationTone,
  type ClinicalImageCase,
  type ClinicalImageCaseStatus,
} from './content';

const statusClasses: Record<ClinicalImageCaseStatus, string> = {
  new: 'border-atlas-blue/40 bg-atlas-blue/10 text-atlas-blue',
  'needs-review': 'border-atlas-warning/40 bg-atlas-warning/10 text-atlas-warning',
  strong: 'border-atlas-success/40 bg-atlas-success/10 text-atlas-success',
  weak: 'border-atlas-pulse/45 bg-atlas-pulse/10 text-atlas-pulse',
};

const annotationToneClasses: Record<ClinicalImageAnnotationTone, string> = {
  cyan: 'border-atlas-cyan bg-atlas-cyan/15 text-atlas-cyan shadow-[0_0_28px_-12px_var(--atlas-accent-cyan)]',
  blue: 'border-atlas-blue bg-atlas-blue/15 text-atlas-blue',
  violet: 'border-atlas-violet bg-atlas-violet/15 text-atlas-violet',
  pulse:
    'border-atlas-pulse bg-atlas-pulse/15 text-atlas-pulse shadow-[0_0_28px_-12px_var(--atlas-accent-pulse-pink)]',
  success: 'border-atlas-success bg-atlas-success/15 text-atlas-success',
  warning: 'border-atlas-warning bg-atlas-warning/15 text-atlas-warning',
};

function getNextCaseId(currentId: string, direction: 1 | -1) {
  const currentIndex = CLINICAL_IMAGE_CASES.findIndex((imageCase) => imageCase.id === currentId);
  const nextIndex =
    (currentIndex + direction + CLINICAL_IMAGE_CASES.length) % CLINICAL_IMAGE_CASES.length;
  return CLINICAL_IMAGE_CASES[nextIndex].id;
}

function statusLabel(status: ClinicalImageCaseStatus) {
  return status.replace('-', ' ');
}

function EcgMockGraphic() {
  return (
    <svg
      className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] text-atlas-cyan"
      viewBox="0 0 420 240"
      aria-hidden="true"
    >
      <defs key="ecg-defs">
        <pattern id="ecg-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path
            key="ecg-grid-path"
            d="M 28 0 L 0 0 0 28"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect key="ecg-grid-fill" width="420" height="240" fill="url(#ecg-grid)" opacity="0.8" />
      <path
        key="ecg-trace"
        d="M 14 132 L 70 132 L 84 116 L 98 150 L 114 72 L 132 168 L 150 132 L 202 132 L 216 120 L 228 144 L 244 82 L 260 166 L 278 132 L 334 132 L 348 119 L 360 145 L 376 88 L 392 164 L 410 132"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
    </svg>
  );
}

function ChestMockGraphic() {
  return (
    <div
      className="absolute inset-6 overflow-hidden rounded-[2rem] border border-atlas-blue/30"
      aria-hidden="true"
    >
      <div className="absolute inset-0 atlas-medical-grid opacity-30" />
      <div className="absolute left-[16%] top-[18%] h-[58%] w-[28%] rounded-[45%] border border-atlas-cyan/35 bg-atlas-cyan/5" />
      <div className="absolute right-[16%] top-[18%] h-[58%] w-[28%] rounded-[45%] border border-atlas-cyan/35 bg-atlas-cyan/5" />
      <div className="absolute left-1/2 top-[19%] h-[60%] w-px bg-atlas-blue/30" />
      <div className="absolute bottom-[14%] left-[20%] right-[20%] h-16 rounded-t-full border-t border-atlas-violet/30" />
      <div className="absolute left-[43%] top-[30%] h-[34%] w-[14%] rounded-full border border-atlas-border bg-atlas-background/50" />
    </div>
  );
}

function DermMockGraphic() {
  const marks = [
    'left-[20%] top-[28%] size-16',
    'left-[44%] top-[34%] size-24',
    'right-[18%] top-[24%] size-14',
    'left-[30%] bottom-[20%] size-20',
    'right-[28%] bottom-[18%] size-16',
  ];

  return (
    <div
      className="absolute inset-6 overflow-hidden rounded-[2rem] border border-atlas-violet/30 bg-atlas-background-soft"
      aria-hidden="true"
    >
      <div className="absolute inset-0 atlas-medical-grid opacity-20" />
      {marks.map((mark, index) => (
        <span
          key={`${mark}-${index}`}
          className={cn(
            'absolute rounded-full border border-atlas-violet/35 bg-atlas-violet/10',
            mark
          )}
        />
      ))}
      <div className="absolute inset-x-10 top-1/2 h-px bg-atlas-cyan/25" />
      <div className="absolute inset-y-10 left-1/2 w-px bg-atlas-cyan/20" />
    </div>
  );
}

function FundoscopyMockGraphic() {
  return (
    <svg
      className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] text-atlas-success"
      viewBox="0 0 420 300"
      aria-hidden="true"
    >
      <circle
        cx="210"
        cy="150"
        r="116"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="2"
      />
      <circle
        cx="210"
        cy="150"
        r="72"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      <circle cx="170" cy="146" r="30" fill="currentColor" opacity="0.16" />
      <circle cx="170" cy="146" r="13" fill="currentColor" opacity="0.45" />
      <path
        d="M 174 146 C 220 118, 256 90, 308 72 M 174 146 C 228 160, 270 188, 318 228 M 174 146 C 128 130, 98 102, 72 72 M 174 146 C 132 168, 98 206, 66 238"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
        opacity="0.52"
      />
      <circle cx="242" cy="152" r="12" fill="currentColor" opacity="0.24" />
    </svg>
  );
}

function RadiologyMockGraphic() {
  return (
    <div
      className="absolute inset-6 overflow-hidden rounded-[2rem] border border-atlas-border bg-atlas-background-soft"
      aria-hidden="true"
    >
      <div className="absolute inset-0 atlas-medical-grid opacity-20" />
      <div className="absolute left-[14%] top-[18%] h-[64%] w-[72%] rounded-[42%] border border-atlas-blue/35 bg-atlas-blue/5" />
      <div className="absolute left-[28%] top-[28%] h-[44%] w-[42%] rounded-[40%] border border-atlas-violet/35 bg-atlas-violet/10" />
      <div className="absolute left-[45%] top-[34%] h-[30%] w-[18%] rounded-full border border-atlas-cyan/35 bg-atlas-cyan/10" />
      <div className="absolute inset-x-8 top-1/2 h-px bg-atlas-cyan/35" />
      <div className="absolute inset-y-8 left-1/2 w-px bg-atlas-cyan/25" />
    </div>
  );
}

function MockGraphic({ imageCase }: { imageCase: ClinicalImageCase }) {
  const graphicMap: Record<ClinicalImageCase['visualPattern'], React.ReactNode> = {
    ecg: <EcgMockGraphic />,
    chest: <ChestMockGraphic />,
    derm: <DermMockGraphic />,
    fundoscopy: <FundoscopyMockGraphic />,
    radiology: <RadiologyMockGraphic />,
  };

  return <>{graphicMap[imageCase.visualPattern]}</>;
}

function AnnotationPin({
  annotation,
  active,
  onActivate,
}: {
  annotation: ClinicalImageAnnotation;
  active: boolean;
  onActivate: (annotationId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${annotation.label}: ${annotation.note}`}
      aria-describedby={`clinical-image-annotation-${annotation.id}`}
      onMouseEnter={() => onActivate(annotation.id)}
      onFocus={() => onActivate(annotation.id)}
      onClick={() => onActivate(annotation.id)}
      className={cn(
        'atlas-focus-ring absolute z-20 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur',
        'transition-[border-color,box-shadow,transform] duration-200 hover:scale-110 focus-visible:scale-110 motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100',
        annotationToneClasses[annotation.tone],
        active && 'scale-110'
      )}
      style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
    >
      <span className="contents">
        <span className="size-2 rounded-full bg-current" aria-hidden="true" />
        <span id={`clinical-image-annotation-${annotation.id}`} className="sr-only">
          {annotation.note}
        </span>
      </span>
    </button>
  );
}

function CaseSelector({
  activeCase,
  onSelect,
}: {
  activeCase: ClinicalImageCase;
  onSelect: (caseId: string) => void;
}) {
  const focusCase = (caseId: string) => {
    onSelect(caseId);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(`clinical-image-case-${caseId}`)?.focus();
      });
    }
  };

  return (
    <div
      role="group"
      className="-mx-4 mt-4 flex min-w-0 max-w-[100vw] snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:max-w-none sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5"
      aria-label="Mock clinical image training cases"
    >
      {CLINICAL_IMAGE_CASES.map((imageCase) => {
        const Icon = imageCase.icon;
        const isActive = imageCase.id === activeCase.id;

        return (
          <button
            key={imageCase.id}
            id={`clinical-image-case-${imageCase.id}`}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(imageCase.id)}
            onFocus={() => onSelect(imageCase.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                focusCase(getNextCaseId(imageCase.id, 1));
              }

              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                focusCase(getNextCaseId(imageCase.id, -1));
              }
            }}
            className={cn(
              'atlas-focus-ring min-w-[14.5rem] snap-start rounded-2xl border bg-atlas-glass p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:min-w-0',
              isActive
                ? 'atlas-border-glow atlas-scanner-line border-atlas-border-glow'
                : 'border-atlas-border'
            )}
          >
            <div key="case-summary" className="flex items-center justify-between gap-3">
              <span
                key="case-icon"
                className="flex size-10 items-center justify-center rounded-xl border border-atlas-border bg-atlas-background-soft text-atlas-cyan"
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span
                key="case-status"
                className={cn(
                  'rounded-full border px-2 py-1 text-[0.66rem] font-semibold',
                  statusClasses[imageCase.status]
                )}
              >
                {statusLabel(imageCase.status)}
              </span>
            </div>
            <p key="case-type" className="mt-3 text-sm font-semibold text-atlas-white">
              {imageCase.imageType}
            </p>
            <p key="case-trend" className="mt-1 font-mono text-xs text-atlas-muted">
              {imageCase.metricValue} trend
            </p>
          </button>
        );
      })}
    </div>
  );
}

function DiagnosticViewer({
  activeCase,
  activeAnnotation,
  reducedMotion,
  onAnnotationActivate,
}: {
  activeCase: ClinicalImageCase;
  activeAnnotation: ClinicalImageAnnotation;
  reducedMotion: boolean;
  onAnnotationActivate: (annotationId: string) => void;
}) {
  return (
    <ScannerFrame
      scanLine={!reducedMotion}
      label={`${activeCase.imageType} training viewer`}
      footer="Synthetic placeholder graphic. No real patient image or diagnostic claim is shown."
      aria-label={`Synthetic clinical image viewer for ${activeCase.title}`}
    >
      <div className="relative min-h-[30rem] overflow-hidden p-4 sm:min-h-[34rem] sm:p-5">
        <div className="absolute inset-0 atlas-medical-grid opacity-20" aria-hidden="true" />
        <div className="relative z-10 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-atlas-border bg-atlas-glass p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-atlas-border bg-atlas-background-soft text-atlas-cyan">
                <ScanLine className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
                  Mock case type
                </p>
                <p className="mt-1 font-poppins text-base font-semibold text-atlas-white">
                  {activeCase.imageType}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold',
                  statusClasses[activeCase.status]
                )}
              >
                {statusLabel(activeCase.status)}
              </span>
              <span className="rounded-full border border-atlas-border bg-atlas-background-soft px-3 py-1 font-mono text-xs text-atlas-muted">
                {activeCase.difficulty}
              </span>
            </div>
          </div>

          <div
            className={cn(
              'relative min-h-[20rem] overflow-hidden rounded-3xl border border-atlas-border bg-atlas-background-soft sm:min-h-[24rem]',
              !reducedMotion && 'atlas-scanner-line'
            )}
          >
            <MockGraphic imageCase={activeCase} />
            <div
              className="absolute inset-5 rounded-[2rem] border border-atlas-border"
              aria-hidden="true"
            />
            <div className="absolute inset-x-8 top-1/2 h-px bg-atlas-cyan/20" aria-hidden="true" />
            <div className="absolute inset-y-8 left-1/2 w-px bg-atlas-cyan/20" aria-hidden="true" />
            {activeCase.annotations.map((annotation) => (
              <AnnotationPin
                key={annotation.id}
                annotation={annotation}
                active={annotation.id === activeAnnotation.id}
                onActivate={onAnnotationActivate}
              />
            ))}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeAnnotation.id}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl border border-atlas-border bg-atlas-background/85 p-4 backdrop-blur-xl"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
                  {activeAnnotation.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-atlas-white">{activeAnnotation.note}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricVital
              compact
              label={activeCase.metricLabel}
              value={activeCase.metricValue}
              change={activeCase.accuracyTrend}
              status={
                activeCase.status === 'strong'
                  ? 'success'
                  : activeCase.status === 'weak'
                    ? 'danger'
                    : 'info'
              }
              accessibleText={`${activeCase.metricLabel}: ${activeCase.metricValue}. ${activeCase.accuracyTrend}.`}
            />
            <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
                  Confidence indicator
                </p>
                <span className="font-mono text-sm font-semibold tabular-nums text-atlas-white">
                  {activeCase.confidence}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-atlas-background-soft">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-atlas-cyan to-atlas-blue"
                  style={{ width: `${activeCase.confidence}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScannerFrame>
  );
}

function LearningPanel({ activeCase }: { activeCase: ClinicalImageCase }) {
  return (
    <MedicalGlassCard active scannerAccent className="p-0">
      <div className="grid gap-5 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
            Clinical image lab
          </p>
          <h3 className="mt-2 font-poppins text-3xl font-semibold text-atlas-white">
            {activeCase.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-atlas-muted">
            Synthetic panels keep the image-reading workflow focused on search order, confidence,
            and follow-up practice.
          </p>
        </div>

        <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
            <Eye className="size-4 text-atlas-cyan" aria-hidden="true" />
            Learning objective
          </div>
          <p className="mt-3 text-sm leading-6 text-atlas-white">{activeCase.learningObjective}</p>
        </div>

        <div className="rounded-2xl border border-atlas-border bg-atlas-background-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
            Question prompt
          </p>
          <p className="mt-3 text-base font-semibold leading-7 text-atlas-white">
            {activeCase.question}
          </p>
        </div>

        <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
            Explanation preview
          </p>
          <p className="mt-3 text-sm leading-6 text-atlas-white">{activeCase.explanation}</p>
        </div>

        <div className="rounded-2xl border border-atlas-success/40 bg-atlas-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-atlas-success">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Mock asset safety
          </div>
          <p className="mt-2 text-sm leading-6 text-atlas-white">
            This section uses synthetic visuals only. It should not be interpreted as medical advice
            or patient imaging.
          </p>
        </div>

        <a
          href="#analytics-preview"
          className="atlas-focus-ring inline-flex items-center gap-2 self-start rounded-xl border border-atlas-border bg-atlas-glass px-4 py-3 text-sm font-semibold text-atlas-white transition-colors hover:border-atlas-border-glow"
        >
          <span className="inline-flex items-center gap-2">
            Connect image reads to readiness
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </a>
      </div>
    </MedicalGlassCard>
  );
}

export function ClinicalImageTraining() {
  const [activeCaseId, setActiveCaseId] = useState(CLINICAL_IMAGE_CASES[0].id);
  const [activeAnnotationId, setActiveAnnotationId] = useState(
    CLINICAL_IMAGE_CASES[0].annotations[0].id
  );
  const reducedMotion = Boolean(useReducedMotion());
  const activeCase =
    CLINICAL_IMAGE_CASES.find((imageCase) => imageCase.id === activeCaseId) ??
    CLINICAL_IMAGE_CASES[0];
  const activeAnnotation = useMemo(
    () =>
      activeCase.annotations.find((annotation) => annotation.id === activeAnnotationId) ??
      activeCase.annotations[0],
    [activeAnnotationId, activeCase]
  );

  const selectCase = (caseId: string) => {
    const nextCase =
      CLINICAL_IMAGE_CASES.find((imageCase) => imageCase.id === caseId) ?? CLINICAL_IMAGE_CASES[0];
    setActiveCaseId(nextCase.id);
    setActiveAnnotationId(nextCase.annotations[0].id);
  };

  return (
    <section
      id="image-lab"
      aria-labelledby="image-lab-title"
      className="relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Clinical image training viewer"
          title="Train image-read discipline without real patient images."
          description="The image lab demonstrates search order, annotation review, confidence tagging, and follow-up practice with abstract ECG, chest imaging, dermatology, fundoscopy, and radiology-style panels."
          align="center"
          className="mx-auto"
          titleId="image-lab-title"
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="min-w-0">
            <DiagnosticViewer
              activeCase={activeCase}
              activeAnnotation={activeAnnotation}
              reducedMotion={reducedMotion}
              onAnnotationActivate={setActiveAnnotationId}
            />
            <CaseSelector activeCase={activeCase} onSelect={selectCase} />
          </div>

          <LearningPanel activeCase={activeCase} />
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-atlas-border bg-atlas-glass px-4 py-3 text-sm text-atlas-muted">
          <CircleDot className="size-4 shrink-0 text-atlas-cyan" aria-hidden="true" />
          <span>
            Each image read feeds a learning objective, confidence tag, and readiness signal without
            using real patient imagery.
          </span>
        </div>
      </div>
    </section>
  );
}
