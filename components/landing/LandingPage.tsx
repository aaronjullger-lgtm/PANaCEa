import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SkipNavigation } from '../shared/SkipNavigation';
import {
  FEATURE_CARDS,
  HERO_SIGNALS,
  LANDING_PROOF_NOTE,
  NAV_LINKS,
  PROCESS_SIGNALS,
  PROCESS_STEPS,
  TESTIMONIALS,
  TRUST_METRICS,
} from './content';
import './landing.css';

const PREMIUM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function revealProps(prefersReducedMotion: boolean, delay = 0, amount = 0.2) {
  if (prefersReducedMotion) {
    return {};
  }

  return {
    initial: { opacity: 0, y: 28, filter: 'blur(8px)' },
    whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, amount },
    transition: {
      duration: 0.8,
      delay,
      ease: PREMIUM_EASE,
    },
  };
}

function accentStyle(accent: string): CSSProperties {
  return { '--landing-accent': accent } as CSSProperties;
}

function AnimatedMetricCard({
  metric,
  index,
  prefersReducedMotion,
}: {
  metric: (typeof TRUST_METRICS)[number];
  index: number;
  prefersReducedMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [currentValue, setCurrentValue] = useState(prefersReducedMotion ? metric.value : 0);

  useEffect(() => {
    if (!isInView) return;

    if (prefersReducedMotion) {
      setCurrentValue(metric.value);
      return;
    }

    let animationFrame = 0;
    const duration = 1200 + index * 180;
    const startTime = performance.now();

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrentValue(metric.value * eased);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      }
    };

    animationFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [index, isInView, metric.value, prefersReducedMotion]);

  return (
    <motion.article
      ref={ref}
      {...revealProps(prefersReducedMotion, index * 0.08)}
      className="panacea-glass panacea-card panacea-metric-card"
      style={accentStyle(metric.accent)}
    >
      <p className="panacea-card-label">{metric.label}</p>
      <div className="panacea-metric-value panacea-gold-shimmer">{metric.format(currentValue)}</div>
      <p className="panacea-card-copy">{metric.detail}</p>
    </motion.article>
  );
}

function FloatingSignal({
  children,
  className,
  prefersReducedMotion,
}: {
  children: React.ReactNode;
  className: string;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      className={className}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              y: [0, -14, 0],
            }
      }
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }
      }
    >
      {children}
    </motion.div>
  );
}

function ParallaxOrb({ className, y }: { className: string; y: MotionValue<number> }) {
  return <motion.div className={className} style={{ y }} aria-hidden="true" />;
}

function LandingFooter({ onSignUp }: { onSignUp: () => void }) {
  return (
    <footer className="relative z-10 border-t border-white/8">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-3">
              <img src="/favicondarkmodeTP.svg" alt="PANaCEa" className="h-10 w-auto" />
              <span className="text-2xl font-semibold tracking-[-0.03em] text-white">PANaCEa</span>
            </div>
            <p className="max-w-lg text-sm leading-7 text-slate-400">
              Adaptive clinical education for Physician Assistant students who want exam prep to
              feel intelligent, calm, and clinically grounded.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="panacea-footer-link">
                {link.label}
              </a>
            ))}
            <button type="button" onClick={onSignUp} className="panacea-footer-link">
              Start Free
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/6 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} PANaCEa. Built for serious PANCE preparation.</p>
          <p>
            Not affiliated with NCCPA. {LANDING_PROOF_NOTE}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroGoldOrbY = useTransform(scrollY, [0, 1400], [0, -180]);
  const heroPlumOrbY = useTransform(scrollY, [0, 1400], [0, 130]);
  const heroSteelOrbY = useTransform(scrollY, [0, 1400], [0, -90]);
  const heroConsoleY = useTransform(scrollY, [0, 900], [0, 70]);

  useEffect(() => {
    const root = document.documentElement;
    const metaTheme = document.getElementById('meta-theme-color');
    const previousTheme = metaTheme?.getAttribute('content');

    root.classList.add('panacea-landing-scroll');
    metaTheme?.setAttribute('content', '#0a0e1a');

    return () => {
      root.classList.remove('panacea-landing-scroll');
      if (previousTheme) {
        metaTheme?.setAttribute('content', previousTheme);
      }
    };
  }, []);

  useEffect(() => {
    if (showAuth) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setShowAuth(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }

    document.body.style.overflow = '';
    return undefined;
  }, [showAuth]);

  const openSignUp = () => {
    setAuthMode('sign-up');
    setShowAuth(true);
  };

  const openSignIn = () => {
    setAuthMode('sign-in');
    setShowAuth(true);
  };

  return (
    <div className="panacea-landing min-h-screen text-slate-50">
      <SkipNavigation mainContentId="landing-main" />

      <div className="panacea-landing__noise" aria-hidden="true" />

      <header className="panacea-header">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#hero" className="flex items-center gap-3 text-white">
            <img src="/favicondarkmodeTP.svg" alt="PANaCEa" className="h-11 w-auto" />
            <span className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              PANaCEa
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-slate-300 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="panacea-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openSignIn}
              className="hidden text-sm font-medium text-slate-300 transition-colors duration-300 hover:text-white sm:inline-flex"
            >
              Sign In
            </button>
            <motion.button
              type="button"
              onClick={openSignUp}
              className="panacea-button panacea-button--primary"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              Start Free
            </motion.button>
          </div>
        </div>
      </header>

      <main id="landing-main" className="relative z-10">
        <section id="hero" className="panacea-section panacea-section--hero">
          <ParallaxOrb className="panacea-orb panacea-orb--gold" y={heroGoldOrbY} />
          <ParallaxOrb className="panacea-orb panacea-orb--plum" y={heroPlumOrbY} />
          <ParallaxOrb className="panacea-orb panacea-orb--steel" y={heroSteelOrbY} />

          <div className="mx-auto grid max-w-7xl gap-14 px-4 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pt-14">
            <div className="max-w-3xl space-y-8">
              <motion.div
                {...revealProps(prefersReducedMotion)}
                className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-200"
              >
                <span className="panacea-status-dot" />
                Adaptive clinical education for PA students
              </motion.div>

              <motion.div {...revealProps(prefersReducedMotion, 0.08)} className="space-y-6">
                <h1 className="panacea-display-title">
                  PANCE mastery
                  <span className="panacea-display-break panacea-gold-shimmer">
                    with clinical intelligence.
                  </span>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  PANaCEa turns exam prep into an adaptive clinical training loop, calibrating every
                  review, drill, and explanation around your blueprint gaps, recall decay, and
                  exam-day readiness.
                </p>
              </motion.div>

              <motion.div
                {...revealProps(prefersReducedMotion, 0.16)}
                className="flex flex-col items-start gap-4"
              >
                <motion.button
                  type="button"
                  onClick={openSignUp}
                  className="panacea-button panacea-button--hero"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -1 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  Start My Adaptive Plan
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </motion.button>

                <button
                  type="button"
                  onClick={openSignIn}
                  className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors duration-300 hover:text-white"
                >
                  Already studying in PANaCEa?
                  <span className="font-semibold text-[var(--landing-gold)]">Sign in</span>
                </button>
              </motion.div>

              <motion.div
                {...revealProps(prefersReducedMotion, 0.24)}
                className="grid gap-3 sm:grid-cols-3"
              >
                {HERO_SIGNALS.map((signal) => (
                  <div key={signal.label} className="panacea-signal-chip">
                    <p className="panacea-card-label">{signal.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-100">{signal.value}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="relative">
              <FloatingSignal
                prefersReducedMotion={prefersReducedMotion}
                className="hidden lg:block panacea-floating-chip panacea-floating-chip--left"
              >
                <CheckCircle2 className="h-4 w-4 text-[var(--landing-gold)]" />
                Blueprint synced
              </FloatingSignal>
              <FloatingSignal
                prefersReducedMotion={prefersReducedMotion}
                className="hidden lg:block panacea-floating-chip panacea-floating-chip--right"
              >
                <Sparkles className="h-4 w-4 text-[var(--landing-steel)]" />
                Review window recalculated
              </FloatingSignal>

              <motion.div
                {...revealProps(prefersReducedMotion, 0.16)}
                className="panacea-glass panacea-card panacea-hero-console"
                style={prefersReducedMotion ? undefined : { y: heroConsoleY }}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="panacea-card-label">Adaptive readiness engine</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                        Every session shifts toward your highest-risk misses.
                      </h2>
                    </div>
                    <div className="rounded-full border border-[var(--landing-gold)]/30 bg-[var(--landing-gold)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--landing-gold)]">
                      Live blueprint
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="panacea-console-stat">
                      <p className="panacea-card-label">Projected readiness lift</p>
                      <div className="panacea-console-stat__value">+18 pts</div>
                      <p className="panacea-card-copy">
                        Based on the next 14 days of targeted cardio, pulm, and pharm review.
                      </p>
                    </div>
                    <div className="panacea-console-stat">
                      <p className="panacea-card-label">Watchlist</p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {['PE vs pneumonia', 'thyroid pharm', 'OB triage'].map((item) => (
                          <span key={item} className="panacea-inline-pill">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="panacea-console-panel">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="panacea-card-label">Tonight&apos;s recommended block</p>
                        <p className="pt-1 text-lg font-semibold text-white">
                          High-yield cardiopulmonary calibration
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                        <Clock className="h-4 w-4 text-[var(--landing-gold)]" />
                        28 min
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {[
                        {
                          icon: Brain,
                          title: 'Retention drift detected',
                          copy: 'A resurfaced review window is opening for pulmonary embolism and ACS distractors.',
                        },
                        {
                          icon: Stethoscope,
                          title: 'Clinical reasoning drill queued',
                          copy: 'Next sequence blends imaging, differential narrowing, and first-line management.',
                        },
                        {
                          icon: BarChart3,
                          title: 'Calibration improving',
                          copy: 'Confidence alignment is trending upward after the last two guided sessions.',
                        },
                      ].map((item) => (
                        <div key={item.title} className="panacea-console-row">
                          <div className="panacea-console-row__icon">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{item.title}</p>
                            <p className="pt-1 text-sm leading-6 text-slate-400">{item.copy}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="features" className="panacea-section">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              {...revealProps(prefersReducedMotion)}
              className="mx-auto mb-14 max-w-3xl text-center"
            >
              <p className="panacea-section-eyebrow">Platform depth</p>
              <h2 className="panacea-section-title">
                A premium study surface built for serious clinical preparation.
              </h2>
              <p className="panacea-section-copy">
                Every capability is designed to feel cohesive: visually calm, clinically
                intelligent, and trustworthy enough to use daily through rotations and final review.
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {FEATURE_CARDS.map((feature, index) => (
                <motion.article
                  key={feature.title}
                  {...revealProps(prefersReducedMotion, index * 0.07)}
                  className="panacea-glass panacea-card panacea-feature-card"
                  style={accentStyle(feature.accent)}
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : {
                          scale: 1.02,
                          y: -8,
                          transition: { duration: 0.35, ease: PREMIUM_EASE },
                        }
                  }
                >
                  <div className="panacea-feature-topline" />
                  <div className="panacea-feature-icon">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <p className="panacea-card-label">{feature.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{feature.description}</p>
                  <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
                    <ArrowRight className="h-4 w-4 text-[var(--landing-accent)]" />
                    <span>{feature.detail}</span>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="proof" className="panacea-section panacea-section--proof">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div className="space-y-6">
              <motion.div {...revealProps(prefersReducedMotion)}>
                <p className="panacea-section-eyebrow">Trust and outcomes</p>
                <h2 className="panacea-section-title text-left">
                  The page feels premium because the product feels under control.
                </h2>
                <p className="panacea-section-copy text-left">
                  Trust comes from visibility. Students can see what is adapting, why it matters,
                  and how close they are to a truly stable exam window.
                </p>
              </motion.div>

              <div className="grid gap-4">
                {TRUST_METRICS.map((metric, index) => (
                  <AnimatedMetricCard
                    key={metric.label}
                    metric={metric}
                    index={index}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:pt-16">
              {TESTIMONIALS.map((testimonial, index) => (
                <motion.article
                  key={testimonial.name}
                  {...revealProps(prefersReducedMotion, index * 0.08)}
                  className="panacea-glass panacea-card panacea-testimonial"
                  style={accentStyle(testimonial.accent)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      <BadgeCheck className="h-4 w-4 text-[var(--landing-accent)]" />
                      Verified student feedback
                    </div>
                    <div className="flex items-center gap-1 text-[var(--landing-gold)]">
                      <Sparkles className="h-4 w-4" />
                      <Sparkles className="h-4 w-4" />
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-6 text-lg leading-8 text-slate-100">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/8 pt-5">
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="pt-1 text-sm text-slate-400">{testimonial.role}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                      PANCE prep
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="panacea-section">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              {...revealProps(prefersReducedMotion)}
              className="mx-auto mb-14 max-w-3xl text-center"
            >
              <p className="panacea-section-eyebrow">How it works</p>
              <h2 className="panacea-section-title">
                A three-step path from uncertainty to exam-day composure.
              </h2>
              <p className="panacea-section-copy">
                The workflow is intentionally simple on the surface while the adaptive system does
                the heavy lifting underneath.
              </p>
            </motion.div>

            <div className="panacea-process-line" aria-hidden="true" />

            <div className="grid gap-6 lg:grid-cols-3">
              {PROCESS_STEPS.map((step, index) => (
                <motion.article
                  key={step.step}
                  {...revealProps(prefersReducedMotion, index * 0.08)}
                  className="panacea-glass panacea-card panacea-step-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="panacea-step-badge">{step.step}</div>
                    <div className="panacea-feature-icon">
                      <step.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="mt-8 text-2xl font-semibold tracking-[-0.03em] text-white">
                    {step.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{step.description}</p>
                </motion.article>
              ))}
            </div>

            <motion.div
              {...revealProps(prefersReducedMotion, 0.22)}
              className="panacea-glass panacea-card mt-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="max-w-2xl">
                <p className="panacea-card-label">What adapts behind the scenes</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                  The platform is constantly recalibrating what matters next.
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Instead of treating all misses the same, PANaCEa weighs the timing, severity, and
                  clinical context of each pattern so your next block always feels purposeful.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-md lg:justify-end">
                {PROCESS_SIGNALS.map((signal) => (
                  <span key={signal} className="panacea-inline-pill">
                    <Check className="h-3.5 w-3.5 text-[var(--landing-gold)]" />
                    {signal}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="start" className="panacea-section panacea-section--final">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <motion.div
              {...revealProps(prefersReducedMotion)}
              className="panacea-glass panacea-card panacea-final-panel"
            >
              <p className="panacea-section-eyebrow">Final call</p>
              <h2 className="panacea-final-title">
                Walk into the PANCE
                <span className="panacea-display-break panacea-gold-shimmer">
                  calm, calibrated, and ready.
                </span>
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Build a plan that adapts to your clinical year, protects your study time, and keeps
                the highest-yield material in front of you until it sticks.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={openSignUp}
                  className="panacea-button panacea-button--hero"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -1 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  Create My Free Account
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </motion.button>

                <button
                  type="button"
                  onClick={openSignIn}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors duration-300 hover:text-white"
                >
                  Returning learner? Sign in
                </button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <LandingFooter onSignUp={openSignUp} />

      <AnimatePresence>
        {showAuth ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: PREMIUM_EASE }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#050814]/80 p-4 backdrop-blur-xl"
            onClick={() => setShowAuth(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panacea-auth-title"
          >
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: PREMIUM_EASE }}
              className="w-full max-w-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="panacea-glass panacea-auth-shell">
                <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
                  <div>
                    <p className="panacea-card-label">PANaCEa access</p>
                    <h3
                      id="panacea-auth-title"
                      className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white"
                    >
                      {authMode === 'sign-up'
                        ? 'Start your adaptive plan.'
                        : 'Return to your study surface.'}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {authMode === 'sign-up'
                        ? 'Create a free account to unlock adaptive drills, readiness tracking, and clinical review.'
                        : 'Sign in to resume your current rotations, review queue, and exam timeline.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAuth(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors duration-300 hover:text-white"
                    aria-label="Close authentication dialog"
                  >
                    <span aria-hidden="true" className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                </div>

                <div className="px-4 py-6 sm:px-6">
                  {authMode === 'sign-up' ? (
                    <SignUp
                      appearance={{
                        elements: {
                          rootBox: 'mx-auto',
                          card: 'bg-transparent shadow-none',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                          socialButtonsBlockButton:
                            'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-[1.01] transition',
                          formButtonPrimary:
                            'bg-[#c4b78a] text-[#0a0e1a] hover:bg-[#d7c99a] shadow-[0_16px_50px_rgba(196,183,138,0.28)]',
                          formFieldLabel: 'text-slate-200',
                          formFieldInput:
                            'bg-[#0a0e1a]/70 border-white/10 text-white placeholder:text-slate-500',
                          footerActionLink: 'text-[#c4b78a] hover:text-[#e2d6ad]',
                        },
                      }}
                      fallbackRedirectUrl="/"
                    />
                  ) : (
                    <SignIn
                      appearance={{
                        elements: {
                          rootBox: 'mx-auto',
                          card: 'bg-transparent shadow-none',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                          socialButtonsBlockButton:
                            'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-[1.01] transition',
                          formButtonPrimary:
                            'bg-[#c4b78a] text-[#0a0e1a] hover:bg-[#d7c99a] shadow-[0_16px_50px_rgba(196,183,138,0.28)]',
                          formFieldLabel: 'text-slate-200',
                          formFieldInput:
                            'bg-[#0a0e1a]/70 border-white/10 text-white placeholder:text-slate-500',
                          footerActionLink: 'text-[#c4b78a] hover:text-[#e2d6ad]',
                        },
                      }}
                      fallbackRedirectUrl="/"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
