import React, { Suspense, lazy, useEffect, useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ArrowRight, Check, LockKeyhole, Menu, ScanLine, X } from 'lucide-react';
import {
  MedicalGlassCard,
  MedicalGridBackground,
  PremiumCTAButton,
  SectionHeader,
} from '@/components/studypanacea';
import { SkipNavigation } from '@/components/shared/SkipNavigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ClinicalImageTraining } from './ClinicalImageTraining';
import { DiagnosticScrollStory } from './DiagnosticScrollStory';
import { Hero } from './Hero';
import { PlatformDifferentiators } from './PlatformDifferentiators';
import { TrainingModesDock } from './TrainingModesDock';
import { CTA_ASSURANCES, NAV_LINKS, WORKFLOW_STEPS } from './content';

type AuthMode = 'sign-in' | 'sign-up';

const DashboardPreview = lazy(() =>
  import('./DashboardPreview').then((module) => ({ default: module.DashboardPreview }))
);

const clerkAppearance = {
  elements: {
    rootBox: 'mx-auto w-full',
    card: 'bg-transparent shadow-none border-0',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
    socialButtonsBlockButton:
      'bg-atlas-glass border border-atlas-border text-atlas-white hover:bg-atlas-elevated transition',
    formButtonPrimary:
      'bg-atlas-cyan text-atlas-background hover:bg-atlas-white shadow-[0_18px_52px_-24px_var(--atlas-accent-cyan)]',
    formFieldLabel: 'text-atlas-muted',
    formFieldInput:
      'bg-atlas-background-soft border-atlas-border text-atlas-white placeholder:text-atlas-muted focus:border-atlas-cyan',
    footerActionLink: 'text-atlas-cyan hover:text-atlas-white',
  },
};

function LandingHeader({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-atlas-border bg-atlas-background/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#hero" className="atlas-focus-ring flex items-center gap-3 rounded-xl">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-atlas-border bg-atlas-glass shadow-atlas-glass">
            <img src="/favicondarkmodeTP.svg" alt="" className="size-7" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-poppins text-base font-semibold text-atlas-white">
              StudyPanacea
            </span>
            <span className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-atlas-cyan">
              PANCE Command Center
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="atlas-focus-ring rounded-lg text-sm font-medium text-atlas-muted transition-colors hover:text-atlas-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <button
            type="button"
            onClick={onSignIn}
            className="atlas-focus-ring rounded-xl px-3 py-2 text-sm font-semibold text-atlas-muted transition-colors hover:text-atlas-white"
          >
            Sign in
          </button>
          <PremiumCTAButton
            onClick={onSignUp}
            scannerAccent
            iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            Start readiness scan
          </PremiumCTAButton>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="atlas-focus-ring inline-flex size-11 items-center justify-center rounded-xl border border-atlas-border bg-atlas-glass text-atlas-white sm:hidden"
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-menu"
          aria-label="Toggle landing navigation"
        >
          {mobileOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileOpen ? (
        <div
          id="landing-mobile-menu"
          className="border-t border-atlas-border bg-atlas-background-soft px-4 py-4 sm:hidden"
        >
          <nav className="grid gap-2" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="atlas-focus-ring rounded-xl px-3 py-3 text-sm font-semibold text-atlas-muted hover:bg-atlas-glass hover:text-atlas-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 grid gap-3">
            <PremiumCTAButton
              onClick={() => {
                setMobileOpen(false);
                onSignUp();
              }}
              scannerAccent
              iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Start readiness scan
            </PremiumCTAButton>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onSignIn();
              }}
              className="atlas-focus-ring rounded-xl border border-atlas-border bg-atlas-glass px-4 py-3 text-sm font-semibold text-atlas-white"
            >
              Sign in
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function SectionShell({
  id,
  children,
  className,
  'aria-labelledby': ariaLabelledBy,
}: React.HTMLAttributes<HTMLElement> & { id: string }) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        'relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24',
        className
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

function StoryConnector({ from, to }: { from: string; to: string }) {
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-hidden="true">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="h-px bg-gradient-to-r from-transparent via-atlas-border-glow to-atlas-border" />
        <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-atlas-border bg-atlas-background/80 px-3 py-2 shadow-atlas-glass backdrop-blur-xl">
          <ScanLine className="size-3.5 text-atlas-cyan" aria-hidden="true" />
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-atlas-muted">
            {from}
          </span>
          <ArrowRight className="size-3.5 text-atlas-subtle" aria-hidden="true" />
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-atlas-white">
            {to}
          </span>
        </span>
        <span className="h-px bg-gradient-to-r from-atlas-border via-atlas-border-glow to-transparent" />
      </div>
    </div>
  );
}

function AuthDialog({ authMode, onClose }: { authMode: AuthMode; onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="theme-diagnostic-atlas w-[calc(100vw-2rem)] max-w-xl overflow-hidden border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-elevated)_94%,transparent)] p-0 text-atlas-white shadow-atlas-glass sm:rounded-2xl">
        <DialogHeader className="border-b border-atlas-border px-6 py-5 pr-14 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
            StudyPanacea access
          </p>
          <DialogTitle
            id="panacea-auth-title"
            className="mt-2 font-poppins text-2xl font-semibold leading-tight text-atlas-white"
          >
            {authMode === 'sign-up'
              ? 'Start your adaptive plan.'
              : 'Return to your study surface.'}
          </DialogTitle>
          <DialogDescription
            id="panacea-auth-description"
            className="mt-2 text-sm leading-6 text-atlas-muted"
          >
            {authMode === 'sign-up'
              ? 'Create an account to begin targeted questions, clinical image training, and readiness tracking.'
              : 'Sign in to resume your review queue, weak-area plan, and exam timeline.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-6 sm:px-6">
          {authMode === 'sign-up' ? (
            <SignUp appearance={clerkAppearance} fallbackRedirectUrl="/" />
          ) : (
            <SignIn appearance={clerkAppearance} fallbackRedirectUrl="/" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LandingFooter({ onSignUp }: { onSignUp: () => void }) {
  return (
    <footer className="border-t border-atlas-border px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-atlas-muted md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-poppins text-base font-semibold text-atlas-white">StudyPanacea</p>
          <p className="mt-2 max-w-xl">
            A premium PANCE prep command center for question practice, image training, weak-area
            targeting, and readiness analytics.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignUp}
          className="atlas-focus-ring inline-flex items-center gap-2 self-start rounded-xl border border-atlas-border bg-atlas-glass px-4 py-3 font-semibold text-atlas-white transition-colors hover:border-atlas-border-glow md:self-center"
        >
          <span className="inline-flex items-center gap-2">
            Begin readiness scan
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </button>
      </div>
    </footer>
  );
}

function DashboardPreviewFallback({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  return (
    <SectionShell id="analytics-preview" aria-labelledby="analytics-preview-title">
      <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <SectionHeader
          eyebrow="Readiness command preview"
          title="The dashboard should tell you what to study next."
          description="Readiness vitals, organ-system pressure, image accuracy, and today’s prescription stay connected so each metric points to a next action."
          titleId="analytics-preview-title"
        />
        <MedicalGlassCard scannerAccent className="min-h-[18rem] p-5 sm:p-6">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                Loading readiness command preview
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[72, 84, 58].map((width, index) => (
                  <div
                    key={`${width}-${index}`}
                    className="rounded-2xl border border-atlas-border bg-atlas-background-soft p-4"
                  >
                    <div className="h-3 w-24 rounded-full bg-atlas-border" />
                    <div
                      className="mt-5 h-8 rounded-full bg-atlas-border"
                      style={{ width: `${width}%` }}
                    />
                    <div className="mt-4 h-2 rounded-full bg-atlas-border" />
                  </div>
                ))}
              </div>
            </div>
            <PremiumCTAButton
              onClick={onOpenDashboard}
              scannerAccent
              className="self-start"
              iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Open your readiness dashboard
            </PremiumCTAButton>
          </div>
        </MedicalGlassCard>
      </div>
    </SectionShell>
  );
}

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('sign-up');
  const [showAuth, setShowAuth] = useState(false);

  const openSignUp = () => {
    setAuthMode('sign-up');
    setShowAuth(true);
  };

  const openSignIn = () => {
    setAuthMode('sign-in');
    setShowAuth(true);
  };

  useEffect(() => {
    if (!showAuth) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showAuth]);

  return (
    <div className="theme-diagnostic-atlas relative isolate min-h-screen overflow-hidden bg-atlas-background text-atlas-white">
      <MedicalGridBackground />
      <SkipNavigation mainContentId="landing-main" />
      <LandingHeader onSignIn={openSignIn} onSignUp={openSignUp} />

      <main id="landing-main">
        <Hero onStartStudying={openSignUp} />
        <StoryConnector from="Scan" to="Diagnose" />

        <DiagnosticScrollStory />
        <StoryConnector from="Diagnose" to="Train" />

        <TrainingModesDock />
        <StoryConnector from="Train" to="Interpret" />

        <ClinicalImageTraining />
        <StoryConnector from="Interpret" to="Measure" />

        <Suspense fallback={<DashboardPreviewFallback onOpenDashboard={openSignUp} />}>
          <DashboardPreview onOpenDashboard={openSignUp} />
          <StoryConnector from="Measure" to="Why" />

          <PlatformDifferentiators />
        </Suspense>
        <StoryConnector from="Why" to="Begin" />

        <SectionShell id="start" aria-labelledby="final-cta-title" className="pb-12 sm:pb-16">
          <MedicalGlassCard scannerAccent className="mx-auto max-w-6xl overflow-hidden p-0">
            <div className="grid gap-3 border-b border-atlas-border bg-atlas-background/55 p-4 text-left sm:grid-cols-3 sm:p-5">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.title}
                    className="rounded-2xl border border-atlas-border bg-atlas-glass p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-atlas-border bg-atlas-background-soft text-atlas-cyan">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-mono text-xs text-atlas-muted">0{index + 1}</p>
                        <h3 className="mt-1 font-poppins text-base font-semibold text-atlas-white">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-atlas-muted">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-atlas-border bg-atlas-cyan/10 text-atlas-cyan">
                <LockKeyhole className="size-6" aria-hidden="true" />
              </div>
              <h2
                id="final-cta-title"
                className="mx-auto mt-6 max-w-3xl font-poppins text-3xl font-semibold leading-tight text-atlas-white sm:text-4xl"
              >
                Start the next study block with a readiness scan, not a guess.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-atlas-muted sm:text-base">
                StudyPanacea turns today’s weak system, image-read confidence, and review debt into
                one focused PANCE study prescription.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PremiumCTAButton
                  onClick={openSignUp}
                  scannerAccent
                  className="w-full sm:w-auto"
                  iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
                >
                  Start readiness scan
                </PremiumCTAButton>
                <button
                  type="button"
                  onClick={openSignIn}
                  className="atlas-focus-ring inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-atlas-muted transition-colors hover:text-atlas-white"
                >
                  Returning learner? Sign in
                </button>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {CTA_ASSURANCES.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs font-semibold text-atlas-muted"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Check className="size-3.5 text-atlas-success" aria-hidden="true" />
                      {item}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </MedicalGlassCard>
        </SectionShell>
      </main>

      <LandingFooter onSignUp={openSignUp} />
      {showAuth ? <AuthDialog authMode={authMode} onClose={() => setShowAuth(false)} /> : null}
    </div>
  );
}
