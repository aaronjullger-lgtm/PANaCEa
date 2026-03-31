/**
 * Landing Page Component
 * First page users see before signing in.
 * Designed for visual impact: hero with app preview, stats, dark section, strong CTAs.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  BookOpen,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Activity as ActivityIcon,
  Target,
  Brain,
  Stethoscope,
  BarChart3,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import ThemeToggleButton from '../components/ui/ThemeToggleButton';
import { AppBrand } from '../components/layout/AppBrand';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SkipNavigation } from '../components/shared/SkipNavigation';

/* ────────────── stat highlights ────────────── */
const STATS = [
  { value: '1,000+', label: 'Conditions' },
  { value: '15+', label: 'Study Modes' },
  { value: 'FSRS v6', label: 'Spaced Repetition' },
  { value: 'Free', label: 'To Start' },
] as const;

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (showAuth) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowAuth(false);
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
    document.body.style.overflow = 'unset';
    return undefined;
  }, [showAuth]);

  const openSignUp = () => { setAuthMode('sign-up'); setShowAuth(true); };
  const openSignIn = () => { setAuthMode('sign-in'); setShowAuth(true); };

  /* ── animation helpers ── */
  const fadeUp = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : { initial: { y: 24 }, animate: { y: 0 }, transition: { duration: 0.6, delay } };

  const fadeUpView = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : { initial: { y: 20 }, whileInView: { y: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.55, delay } };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      <SkipNavigation mainContentId="landing-main" />

      {/* ═══════════════ HEADER ═══════════════ */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--color-border)] transition-all duration-300"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <AppBrand size="lg" animate>
            <ThemeToggleButton />
            <motion.button
              type="button"
              onClick={openSignIn}
              className="px-5 py-2 rounded-lg font-semibold transition-all duration-200 hover:opacity-90 min-h-[44px] shadow-sm"
              style={{
                backgroundColor: 'var(--color-accent-button, #7a6f52)',
                color: '#fff',
                borderRadius: '0.5rem',
              }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              aria-label="Sign in to your account"
            >
              Sign In
            </motion.button>
          </AppBrand>
        </div>
      </header>

      <main id="landing-main">

        {/* ═══════════════ HERO ═══════════════ */}
        <section
          aria-label="Introduction"
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 40%, #1a1a2e 100%)',
          }}
        >
          {/* Decorative glow orbs */}
          <div
            className="absolute top-[-120px] right-[-80px] w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(154,143,114,0.25) 0%, transparent 65%)', filter: 'blur(60px)' }}
            aria-hidden="true"
          />
          <div
            className="absolute bottom-[-100px] left-[-60px] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(154,143,114,0.15) 0%, transparent 65%)', filter: 'blur(60px)' }}
            aria-hidden="true"
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-10 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — copy */}
              <div className="text-center lg:text-left space-y-8">
                <motion.div {...fadeUp(0)}>
                  <span
                    className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-6"
                    style={{
                      backgroundColor: 'rgba(154,143,114,0.2)',
                      color: '#c4b78a',
                      border: '1px solid rgba(154,143,114,0.3)',
                    }}
                  >
                    Built by a PA student, for PA students
                  </span>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]" style={{ color: '#f1f5f9' }}>
                    Study Smarter for the{' '}
                    <span style={{
                      backgroundImage: 'linear-gradient(135deg, #c4b78a, #e8e4d8, #c4b78a)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>
                      PANCE &amp; PANRE
                    </span>
                  </h1>
                </motion.div>

                <motion.p {...fadeUp(0.15)} className="text-lg sm:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0" style={{ color: '#94a3b8' }}>
                  Adaptive spaced repetition, 15+ clinical drill modes, a built-in
                  medical database, and performance analytics — all aligned to the
                  NCCPA blueprint.
                </motion.p>

                <motion.div {...fadeUp(0.25)} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <motion.button
                    type="button"
                    onClick={openSignUp}
                    className="group flex items-center justify-center gap-3 px-8 py-4 font-bold text-lg rounded-xl min-h-[52px]"
                    style={{
                      backgroundColor: '#c4b78a',
                      color: '#0f172a',
                      borderRadius: '0.75rem',
                      boxShadow: '0 8px 30px rgba(196,183,138,0.35)',
                    }}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.03, boxShadow: '0 12px 40px rgba(196,183,138,0.45)' }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    aria-label="Get started with a free account"
                  >
                    Get Started — It's Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={openSignIn}
                    className="flex items-center justify-center gap-2 px-6 py-4 font-semibold text-base rounded-xl min-h-[52px]"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#cbd5e1',
                      border: '1px solid rgba(148,163,184,0.3)',
                      borderRadius: '0.75rem',
                    }}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.02, borderColor: 'rgba(196,183,138,0.5)' }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    aria-label="Sign in to existing account"
                  >
                    I have an account
                  </motion.button>
                </motion.div>
              </div>

              {/* Right — dashboard mockup */}
              <motion.div
                {...fadeUp(0.3)}
                className="relative hidden lg:block"
              >
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: '1px solid rgba(148,163,184,0.15)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(148,163,184,0.1)',
                    background: 'linear-gradient(145deg, #1f2937, #111827)',
                  }}
                >
                  {/* Mock window chrome */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                    <span className="ml-3 text-xs font-mono" style={{ color: '#64748b' }}>studypanacea.com</span>
                  </div>

                  {/* Mock dashboard content */}
                  <div className="p-6 space-y-4">
                    {/* Greeting bar */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="h-5 w-48 rounded" style={{ backgroundColor: 'rgba(241,245,249,0.1)' }} />
                        <div className="h-3 w-32 rounded mt-2" style={{ backgroundColor: 'rgba(241,245,249,0.06)' }} />
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'rgba(196,183,138,0.2)' }} />
                        <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'rgba(196,183,138,0.15)' }} />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Day Streak', val: '12', color: '#c4b78a' },
                        { label: 'To Review', val: '24', color: '#60a5fa' },
                        { label: 'Accuracy', val: '78%', color: '#34d399' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(241,245,249,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                          <div className="text-xl font-bold" style={{ color: s.color }}>{s.val}</div>
                          <div className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: '#64748b' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Quick Start mock */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(241,245,249,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                      <div className="h-3 w-24 rounded mb-3" style={{ backgroundColor: 'rgba(241,245,249,0.1)' }} />
                      <div className="flex gap-2">
                        {['5 min', '10 min', '20 min'].map((t) => (
                          <div key={t} className="flex-1 rounded-lg py-2 text-center text-xs font-semibold" style={{ backgroundColor: 'rgba(196,183,138,0.15)', color: '#c4b78a', border: '1px solid rgba(196,183,138,0.2)' }}>
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* System chips mock */}
                    <div className="flex flex-wrap gap-2">
                      {['Cardio', 'Neuro', 'GI', 'Pulm', 'MSK', 'Psych'].map((sys) => (
                        <span key={sys} className="px-3 py-1 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.1)' }}>
                          {sys}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ backgroundColor: 'rgba(15,23,42,0.6)', borderTop: '1px solid rgba(148,163,184,0.1)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                {STATS.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    {...fadeUp(0.4 + i * 0.08)}
                    className="text-center"
                  >
                    <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#c4b78a' }}>{stat.value}</div>
                    <div className="text-xs sm:text-sm mt-1 uppercase tracking-wider" style={{ color: '#94a3b8' }}>{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ FEATURES GRID ═══════════════ */}
        <section className="py-20 sm:py-24" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div {...fadeUpView(0)} className="text-center mb-14 sm:mb-16">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
                style={{
                  backgroundColor: 'var(--color-accent-very-light, #f5f3ed)',
                  color: 'var(--color-accent, #7a6f52)',
                  border: '1px solid var(--color-accent-light, #e8e4d8)',
                }}
              >
                Features
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-3">
                Everything You Need to Pass
              </h2>
              <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto">
                Purpose-built for PA students. Every feature mapped to the NCCPA content blueprint.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Brain,
                  title: 'Adaptive Spaced Repetition',
                  desc: 'FSRS v6 algorithm with implicit behavioral rating — no manual "Easy/Hard" buttons. The system learns how well you know each card from your response patterns.',
                  accent: '#7c3aed',
                },
                {
                  icon: Stethoscope,
                  title: 'Clinical Drill Modes',
                  desc: 'DDx, pharmacology, first-line treatment, ECG, imaging, anatomy, and more. 15+ specialized modes that go beyond basic Q&A.',
                  accent: '#0ea5e9',
                },
                {
                  icon: BookOpen,
                  title: 'Medical Database',
                  desc: '1,000+ conditions with treatments, labs, clinical guidelines, and differential diagnoses — all searchable and cross-referenced.',
                  accent: '#10b981',
                },
                {
                  icon: BarChart3,
                  title: 'Performance Analytics',
                  desc: 'Track accuracy by system, identify weak areas, monitor your study streaks, and see predicted retention curves.',
                  accent: '#f59e0b',
                },
                {
                  icon: Zap,
                  title: 'AI-Powered Content',
                  desc: 'Questions generated and graded by AI, with structured rationales, clinical pearls, and mnemonic aids built in.',
                  accent: '#ef4444',
                },
                {
                  icon: Shield,
                  title: 'Exam-Aligned Blueprint',
                  desc: 'Strict NCCPA blueprint weighting for PANCE simulation. Every session mirrors the real exam distribution.',
                  accent: '#8b5cf6',
                },
              ].map((feature, idx) => (
                <motion.article
                  key={feature.title}
                  {...fadeUpView(idx * 0.06)}
                  className="group relative p-7 rounded-2xl border transition-all duration-300 hover:shadow-xl"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary, #fff)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '1rem',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${feature.accent}15`, border: `1px solid ${feature.accent}25` }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: feature.accent }} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {feature.desc}
                  </p>
                  {/* Hover accent line */}
                  <div
                    className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ backgroundColor: feature.accent }}
                    aria-hidden="true"
                  />
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ HOW IT WORKS (dark section) ═══════════════ */}
        <section
          className="py-20 sm:py-24"
          style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div {...fadeUpView(0)} className="text-center mb-14">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
                style={{ backgroundColor: 'rgba(196,183,138,0.15)', color: '#c4b78a', border: '1px solid rgba(196,183,138,0.25)' }}
              >
                How It Works
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#f1f5f9' }}>
                Three Steps to Exam Readiness
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: '#94a3b8' }}>
                No setup required. Sign up, start studying, and let the algorithm optimize your schedule.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Sign Up & Set Your Goal',
                  desc: 'Pick your exam date, current rotation, and daily time budget. PANaCEa tailors everything from there.',
                  icon: Target,
                },
                {
                  step: '02',
                  title: 'Study with Adaptive Drills',
                  desc: 'Answer questions across 15+ modes. The FSRS algorithm tracks your memory strength and schedules reviews at the optimal moment.',
                  icon: ActivityIcon,
                },
                {
                  step: '03',
                  title: 'Track & Improve',
                  desc: 'Watch your accuracy climb, close knowledge gaps the analytics reveal, and walk into your exam confident.',
                  icon: TrendingUp,
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.step}
                  {...fadeUpView(idx * 0.1)}
                  className="relative rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: 'rgba(241,245,249,0.04)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '1rem',
                  }}
                >
                  <div
                    className="text-5xl font-black mb-4"
                    style={{ color: 'rgba(196,183,138,0.15)' }}
                  >
                    {item.step}
                  </div>
                  <div
                    className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: 'rgba(196,183,138,0.15)', border: '1px solid rgba(196,183,138,0.25)' }}
                  >
                    <item.icon className="w-7 h-7" style={{ color: '#c4b78a' }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: '#f1f5f9' }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ BENEFITS CHECKLIST ═══════════════ */}
        <section className="py-20 sm:py-24" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div {...fadeUpView(0)}>
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
                  style={{
                    backgroundColor: 'var(--color-accent-very-light, #f5f3ed)',
                    color: 'var(--color-accent, #7a6f52)',
                    border: '1px solid var(--color-accent-light, #e8e4d8)',
                  }}
                >
                  Why PANaCEa
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-4">
                  Built for Clinical-Year Realities
                </h2>
                <p className="text-lg text-[var(--color-text-secondary)] mb-8 leading-relaxed">
                  Long shifts, short study windows. PANaCEa is designed to maximize
                  retention in minimal time — so you can study on the go between patients.
                </p>
                <motion.button
                  type="button"
                  onClick={openSignUp}
                  className="group flex items-center gap-3 px-8 py-3.5 font-bold text-base rounded-xl min-h-[48px]"
                  style={{
                    backgroundColor: 'var(--color-accent-button, #7a6f52)',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    boxShadow: '0 4px 16px rgba(122,111,82,0.25)',
                  }}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  aria-label="Start studying with a free account"
                >
                  Start Studying Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden />
                </motion.button>
              </motion.div>

              <motion.div {...fadeUpView(0.1)} className="space-y-3">
                {[
                  'NCCPA content blueprint alignment across all modes',
                  'Implicit behavioral rating — no self-grading bias',
                  'End-of-rotation scheduling for clinical year students',
                  'Performance tracking by organ system and topic',
                  'Rapid recall drills for time-constrained sessions',
                  'First-line treatment & antibiotic selection training',
                  'Clinical image training (ECG, derm, radiology)',
                  'Detailed rationales with clinical pearls & mnemonics',
                ].map((benefit, idx) => (
                  <motion.div
                    key={benefit}
                    {...fadeUpView(0.1 + idx * 0.03)}
                    className="flex items-start gap-3 rounded-xl p-3.5"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary, #f1f5f9)',
                      borderRadius: '0.75rem',
                    }}
                  >
                    <CheckCircle2
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: 'var(--color-accent, #7a6f52)' }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium leading-relaxed text-[var(--color-text-secondary)]">
                      {benefit}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section
          className="py-20 sm:py-24"
          style={{
            background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 50%, #1a1a2e 100%)',
          }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div {...fadeUpView(0)} className="space-y-8">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold" style={{ color: '#f1f5f9' }}>
                Ready to Own Your Exam Prep?
              </h2>
              <p className="text-lg sm:text-xl max-w-xl mx-auto" style={{ color: '#94a3b8' }}>
                Join the PA students using adaptive spaced repetition to study
                smarter — not harder.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.button
                  type="button"
                  onClick={openSignUp}
                  className="group flex items-center justify-center gap-3 px-10 py-4 font-bold text-lg rounded-xl min-h-[52px]"
                  style={{
                    backgroundColor: '#c4b78a',
                    color: '#0f172a',
                    borderRadius: '0.75rem',
                    boxShadow: '0 8px 30px rgba(196,183,138,0.35)',
                  }}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  aria-label="Sign up for free"
                >
                  Sign Up Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={openSignIn}
                  className="flex items-center justify-center gap-2 px-6 py-4 font-semibold text-base rounded-xl min-h-[52px]"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#cbd5e1',
                    border: '1px solid rgba(148,163,184,0.3)',
                    borderRadius: '0.75rem',
                  }}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  aria-label="Sign in to existing account"
                >
                  Already have an account? Sign In
                </motion.button>
              </div>
              <p className="text-sm" style={{ color: '#64748b' }}>
                Free to start · No credit card · Works on any device
              </p>
            </motion.div>
          </div>
        </section>

      </main>

      <SiteFooter />

      {/* ═══════════════ AUTH MODAL ═══════════════ */}
      {showAuth && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50,
            backgroundColor: 'rgba(15,23,42,0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowAuth(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '28rem', margin: '2rem 0' }}
          >
            <div
              className="overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '1rem',
                border: '1px solid var(--color-border)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              }}
            >
              {/* Modal Header */}
              <div style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 id="auth-modal-title" className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {authMode === 'sign-up' ? 'Join PANaCEa' : 'Welcome Back'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAuth(false)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      minHeight: '44px',
                      minWidth: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-primary)',
                    }}
                    aria-label="Close sign in"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }}>
                  {authMode === 'sign-up'
                    ? 'Create your free account to start studying'
                    : 'Sign in to access your personalized study dashboard'}
                </p>
              </div>

              <div className="p-6 [color-scheme:inherit]">
                {authMode === 'sign-up' ? (
                  <SignUp
                    appearance={{
                      elements: {
                        rootBox: 'mx-auto',
                        card: 'bg-transparent shadow-none',
                        headerTitle: 'hidden',
                        headerSubtitle: 'hidden',
                        socialButtonsBlockButton:
                          'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:scale-[1.02] transition-transform',
                        formButtonPrimary:
                          'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 hover:shadow-lg text-[var(--color-text-inverse)]',
                        formFieldLabel: 'text-[var(--color-text-primary)]',
                        formFieldInput:
                          'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
                        footerActionLink:
                          'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]',
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
                          'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:scale-[1.02] transition-transform',
                        formButtonPrimary:
                          'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 hover:shadow-lg text-[var(--color-text-inverse)]',
                        formFieldLabel: 'text-[var(--color-text-primary)]',
                        formFieldInput:
                          'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
                        footerActionLink:
                          'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]',
                      },
                    }}
                    fallbackRedirectUrl="/"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
