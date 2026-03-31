/**
 * Landing Page Component
 * First page users see before signing in
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
} from 'lucide-react';
import ThemeToggleButton from '../components/ui/ThemeToggleButton';
import { AppBrand } from '../components/layout/AppBrand';
import { PageContainer } from '../components/layout/PageContainer';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SkipNavigation } from '../components/shared/SkipNavigation';

const FEATURE_PILLS = [
  'Performance Analytics',
  '15+ Training Modes',
  'Medical Database',
  '1000+ Conditions',
] as const;

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const prefersReducedMotion = useReducedMotion();

  // Disable body scroll when modal is open
  useEffect(() => {
    if (showAuth) {
      document.body.style.overflow = 'hidden';

      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowAuth(false);
        }
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

  const features = [
    {
      icon: TrendingUp,
      title: 'Performance Tracking & Stats',
      description:
        'Detailed analytics and insights into your progress, identifying weak areas and tracking improvement over time',
    },
    {
      icon: ActivityIcon,
      title: 'Clinical Image Training',
      description:
        'Practice with ECGs, dermatology images, and radiology cases to build diagnostic skills',
    },
    {
      icon: BookOpen,
      title: 'Comprehensive Medical Database',
      description:
        'Complete medical reference with 1000+ conditions, treatments, labs, and clinical guidelines built right in',
    },
    {
      icon: Target,
      title: '15+ Training Modes',
      description:
        'Pharmacology, differential diagnosis, first-line treatments, and more specialized practice modes',
    },
  ];

  const benefits = [
    '1000+ conditions aligned with NCCPA content blueprint',
    'Performance tracking to identify weak areas',
    'Rapid recall drills for time-sensitive practice',
    'First-line treatment and antibiotic selection training',
    'Detailed explanations with clinical pearls and mnemonics',
    'Cloud sync across devices',
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      <SkipNavigation mainContentId="landing-main" />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/90 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300" style={{ backgroundColor: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(16px)' }}>
        <PageContainer maxWidth="7xl" className="py-3 flex items-center justify-between">
          <AppBrand size="lg" animate>
            <ThemeToggleButton />
            <motion.button
              type="button"
              initial={{ x: 20 }}
              animate={{ x: 0 }}
              onClick={() => {
                setAuthMode('sign-in');
                setShowAuth(true);
              }}
              className="px-5 py-2 bg-[var(--color-accent-button)] text-[var(--color-text-inverse)] rounded-lg font-semibold transition-all duration-200 hover:opacity-90 min-h-[44px] min-w-[44px] shadow-sm"
              style={{ padding: '0.5rem 1.25rem', backgroundColor: 'var(--color-accent-button, #7a6f52)', color: '#fff', borderRadius: '0.5rem', minHeight: '44px', whiteSpace: 'nowrap' }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              aria-label="Sign in to your account"
            >
              Sign In
            </motion.button>
          </AppBrand>
        </PageContainer>
      </header>

      {/* Main content — required for WCAG landmark navigation */}
      <main id="landing-main">

      {/* Hero Section */}
      <section
        aria-label="Introduction"
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-accent-very-light, #f5f3ed) 50%, var(--color-bg-primary) 100%)',
        }}
      >
        {/* Subtle decorative elements */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--color-accent-border, #9a8f72) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          aria-hidden
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--color-accent-border, #9a8f72) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
          aria-hidden
        />

        <PageContainer maxWidth="7xl" className="pt-24 pb-20 relative z-10">
          <div className="text-center space-y-10">
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight">
                <span className="text-[var(--color-text-primary)]">Your Complete</span>
                <br />
                <span
                  className="bg-gradient-to-r from-[var(--color-accent,#7a6f52)] via-[var(--color-accent-border,#9a8f72)] to-[var(--color-text-secondary)] bg-clip-text text-transparent"
                  style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundImage: 'linear-gradient(to right, var(--color-accent, #7a6f52), var(--color-accent-border, #9a8f72), var(--color-text-secondary, #475569))' }}
                >
                  PA School Resource
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
                Medical database, performance tracking, clinical image training, and 15+
                specialized modes — aligned with the PANCE &amp; PANRE blueprint.
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.button
                type="button"
                onClick={() => {
                  setAuthMode('sign-up');
                  setShowAuth(true);
                }}
                className="group px-10 py-4 bg-[var(--color-accent-button)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 min-h-[48px]"
                style={{ backgroundColor: 'var(--color-accent-button, #7a6f52)', color: '#fff', borderRadius: '0.75rem', padding: '1rem 2.5rem', boxShadow: '0 10px 25px -5px rgba(122,111,82,0.3)' }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                aria-label="Get started with a free account"
              >
                Get Started
                <ArrowRight
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  aria-hidden
                />
              </motion.button>
              <p className="text-sm text-[var(--color-text-muted)]">
                Free to start · No credit card required
              </p>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3 justify-center pt-4"
            >
              {FEATURE_PILLS.map((pill) => (
                <span
                  key={pill}
                  className="px-4 py-2 bg-white/80 dark:bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] shadow-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '9999px', border: '1px solid var(--color-border)', padding: '0.5rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  {pill}
                </span>
              ))}
            </motion.div>
          </div>
        </PageContainer>
      </section>

      {/* Features Grid */}
      <PageContainer as="section" maxWidth="7xl" className="py-20">
        <motion.div
          initial={{ y: 20 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-3">Key Features</h2>
          <p className="text-lg text-[var(--color-text-secondary)]">
            Essential tools for PA school success and exam preparation
          </p>
        </motion.div>

        <div
          className="grid md:grid-cols-2 gap-6"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem' }}
        >
          {features.map((feature, idx) => (
            <motion.article
              key={feature.title}
              initial={{ y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="group p-7 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-accent-border)] hover:shadow-lg transition-all duration-300"
              style={{ padding: '1.75rem', borderRadius: '1rem', backgroundColor: 'var(--color-bg-secondary, #fff)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform"
                style={{ width: '3rem', height: '3rem', flexShrink: 0, backgroundColor: 'var(--color-accent-very-light, #f5f3ed)', border: '1px solid var(--color-accent-light, #e8e4d8)', borderRadius: '0.75rem' }}
                aria-hidden
              >
                <feature.icon className="w-6 h-6 text-[var(--color-accent)]" style={{ color: 'var(--color-accent, #7a6f52)' }} />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                {feature.title}
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm">
                {feature.description}
              </p>
            </motion.article>
          ))}
        </div>
      </PageContainer>

      {/* Benefits Section */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-accent-very-light, #f5f3ed) 100%)' }}
      >
        <PageContainer maxWidth="7xl" className="py-20">
          <div
            className="bg-[var(--color-bg-secondary)] rounded-2xl p-10 sm:p-12 border border-[var(--color-border)] shadow-md"
            style={{ backgroundColor: 'var(--color-bg-secondary, #fff)', borderRadius: '1rem', padding: '2.5rem', border: '1px solid var(--color-border)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
          >
            <div
              className="grid lg:grid-cols-2 gap-10 items-center"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2.5rem', alignItems: 'center' }}
            >
              <motion.div
                initial={{ x: -20 }}
                whileInView={{ x: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Comprehensive Study Tools</h2>
                <p className="text-lg text-[var(--color-text-secondary)] mb-8 leading-relaxed">
                  Track your performance, identify knowledge gaps, and focus your study time
                  effectively.
                </p>
                <motion.button
                  type="button"
                  onClick={() => {
                    setAuthMode('sign-up');
                    setShowAuth(true);
                  }}
                  className="px-8 py-3 bg-[var(--color-accent-button)] text-white rounded-xl font-bold text-base hover:opacity-90 transition-all duration-300 min-h-[48px] shadow-md"
                  style={{ backgroundColor: 'var(--color-accent-button, #7a6f52)', color: '#fff', borderRadius: '0.75rem', boxShadow: '0 4px 12px rgba(122,111,82,0.25)' }}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  aria-label="Start studying with a free account"
                >
                  Start Studying
                </motion.button>
              </motion.div>

              <motion.div
                initial={{ x: 20 }}
                whileInView={{ x: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.5 }}
                className="space-y-3"
              >
                {benefits.map((benefit, idx) => (
                  <motion.div
                    key={benefit}
                    initial={{ x: 20 }}
                    whileInView={{ x: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.35, delay: idx * 0.04 }}
                    className="flex items-start gap-3 rounded-lg p-3"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-tertiary, #f1f5f9)' }}
                  >
                    <CheckCircle2
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: 'var(--color-accent, #7a6f52)' }}
                      aria-hidden
                    />
                    <span className="text-base font-medium leading-relaxed text-[var(--color-text-secondary)]">
                      {benefit}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* CTA Section */}
      <PageContainer as="section" maxWidth="7xl" className="py-20 text-center">
        <motion.div
          initial={{ y: 20 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">
            Ready to Start?
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Access all study modes and features with a free account.
          </p>
          <motion.button
            type="button"
            onClick={() => {
              setAuthMode('sign-up');
              setShowAuth(true);
            }}
            className="px-10 py-4 bg-[var(--color-accent-button)] text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all duration-300 flex items-center gap-3 mx-auto min-h-[48px] shadow-lg"
            style={{ backgroundColor: 'var(--color-accent-button, #7a6f52)', color: '#fff', borderRadius: '0.75rem', boxShadow: '0 10px 25px -5px rgba(122,111,82,0.3)' }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            aria-label="Sign up for free"
          >
            Sign Up Free
            <ArrowRight className="w-5 h-5" aria-hidden />
          </motion.button>
        </motion.div>
      </PageContainer>

      </main>{/* end #landing-main */}

      {/* Footer */}
      <SiteFooter />

      {/* Auth Modal — uses CSS transitions instead of framer-motion to avoid
           reduced-motion bugs where AnimatePresence leaves elements at opacity:0 */}
      {showAuth && (
          <div
            className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}
            onClick={() => setShowAuth(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md my-8"
              style={{ width: '100%', maxWidth: '28rem', margin: '2rem 0' }}
            >
              <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden border border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                {/* Modal Header */}
                <div className="bg-[var(--color-bg-tertiary)] px-6 py-5 text-[var(--color-text-primary)]" style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '1.25rem 1.5rem' }}>
                  <div className="flex items-center justify-between mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 id="auth-modal-title" className="text-2xl font-bold">
                      {authMode === 'sign-up' ? 'Join PANaCEa' : 'Welcome Back'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAuth(false)}
                      className="p-2 hover:bg-[var(--color-bg-secondary)]/60 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      style={{ padding: '0.5rem', borderRadius: '0.5rem', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      aria-label="Close sign in"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-base">
                    {authMode === 'sign-up'
                      ? 'Create your free account to start studying'
                      : 'Sign in to access your personalized study dashboard'}
                  </p>
                </div>

                {/* Clerk Component – theme-aware via AuthProvider variables + index.css .dark overrides */}
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
