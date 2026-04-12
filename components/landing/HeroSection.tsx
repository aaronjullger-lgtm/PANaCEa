import React from 'react';
import { motion } from 'framer-motion';

const STATS = [
  { value: '1,000+', label: 'Conditions' },
  { value: '15+', label: 'Study Modes' },
  { value: 'FSRS v6', label: 'Spaced Repetition' },
  { value: 'Free', label: 'To Start' },
] as const;

interface HeroSectionProps {
  onSignUp: () => void;
  onSignIn: () => void;
  prefersReducedMotion: boolean;
}

export function HeroSection({ onSignUp, onSignIn, prefersReducedMotion }: HeroSectionProps) {
  const fadeUp = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
        };

  const fadeUpView = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.15 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        };

  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0a0e1a 0%, #0f172a 35%, #141b2d 70%, #0a0e1a 100%)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Ambient glow behind product preview ── */}
      <div
        className="absolute top-1/2 right-0 w-[700px] h-[700px] -translate-y-1/2 translate-x-1/4 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        aria-hidden="true"
      />

      {/* ── Main hero content ── */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-12 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[60vh]">
          {/* Left — Copy */}
          <div className="text-center lg:text-left space-y-7">
            <motion.div {...fadeUp(0)}>
              <span
                className="inline-block px-4 py-1.5 rounded-full text-overline font-semibold tracking-widest uppercase"
                style={{
                  backgroundColor: 'rgba(196, 183, 138, 0.1)',
                  color: '#c4b78a',
                  border: '1px solid rgba(196, 183, 138, 0.2)',
                  letterSpacing: '0.1em',
                  fontSize: '0.6875rem',
                }}
              >
                Built by a PA student, for PA students
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.08)}
              className="text-4xl sm:text-5xl lg:text-display-xl font-bold leading-[1.05]"
              style={{
                color: '#f1f5f9',
                letterSpacing: '-0.04em',
              }}
            >
              Study Smarter for the{' '}
              <span
                style={{
                  backgroundImage: 'linear-gradient(135deg, #c4b78a 0%, #e8e4d8 50%, #c4b78a 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                PANCE &amp; PANRE
              </span>
            </motion.h1>

            <motion.p
              {...fadeUp(0.16)}
              className="text-body-lg leading-relaxed max-w-lg mx-auto lg:mx-0"
              style={{ color: '#94a3b8' }}
            >
              Adaptive spaced repetition, 15+ clinical drill modes, a built-in
              medical database, and performance analytics — all aligned to the
              NCCPA blueprint.
            </motion.p>

            <motion.div {...fadeUp(0.24)} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <motion.button
                type="button"
                onClick={onSignUp}
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 font-semibold text-base rounded-xl min-h-[52px]"
                style={{
                  backgroundColor: '#c4b78a',
                  color: '#0a0e1a',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(196, 183, 138, 0.3)',
                }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03, boxShadow: '0 12px 40px rgba(196, 183, 138, 0.4)' }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                Get Started — It's Free
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </motion.button>

              <motion.button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 font-medium text-sm rounded-xl min-h-[52px]"
                style={{
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02, borderColor: 'rgba(196, 183, 138, 0.4)' }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                I have an account
              </motion.button>
            </motion.div>
          </div>

          {/* Right — Product Preview with 3D perspective */}
          <motion.div
            {...fadeUp(0.2)}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div
              style={{
                perspective: '1200px',
              }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 120px rgba(59, 130, 246, 0.04)',
                  background: 'linear-gradient(145deg, #1f2937, #111827)',
                  transform: 'rotateY(-5deg) rotateX(2deg)',
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  width: '100%',
                  maxWidth: '560px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotateY(-2deg) rotateX(1deg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotateY(-5deg) rotateX(2deg)'; }}
              >
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="ml-3 text-xs font-mono" style={{ color: '#475569' }}>studypanacea.com</span>
                </div>

                {/* Dashboard mockup */}
                <div className="p-6 space-y-4">
                  {/* Greeting */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-5 w-48 rounded" style={{ backgroundColor: 'rgba(241, 245, 249, 0.1)' }} />
                      <div className="h-3 w-32 rounded mt-2" style={{ backgroundColor: 'rgba(241, 245, 249, 0.05)' }} />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'rgba(196, 183, 138, 0.15)' }} />
                      <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'rgba(196, 183, 138, 0.1)' }} />
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Day Streak', val: '12', color: '#c4b78a' },
                      { label: 'To Review', val: '24', color: '#60a5fa' },
                      { label: 'Accuracy', val: '78%', color: '#34d399' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl p-3 text-center" style={{
                        backgroundColor: 'rgba(241, 245, 249, 0.03)',
                        border: '1px solid rgba(148, 163, 184, 0.06)',
                      }}>
                        <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
                        <div className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: '#475569', letterSpacing: '0.08em' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Start */}
                  <div className="rounded-xl p-4" style={{
                    backgroundColor: 'rgba(241, 245, 249, 0.03)',
                    border: '1px solid rgba(148, 163, 184, 0.06)',
                  }}>
                    <div className="h-3 w-24 rounded mb-3" style={{ backgroundColor: 'rgba(241, 245, 249, 0.08)' }} />
                    <div className="flex gap-2">
                      {['5 min', '10 min', '20 min'].map((t) => (
                        <div key={t} className="flex-1 rounded-lg py-2 text-center text-xs font-semibold" style={{
                          backgroundColor: 'rgba(196, 183, 138, 0.1)',
                          color: '#c4b78a',
                          border: '1px solid rgba(196, 183, 138, 0.15)',
                        }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System chips */}
                  <div className="flex flex-wrap gap-2">
                    {['Cardio', 'Neuro', 'GI', 'Pulm', 'MSK', 'Psych'].map((sys) => (
                      <span key={sys} className="px-3 py-1 rounded-full text-[10px] font-medium" style={{
                        backgroundColor: 'rgba(148, 163, 184, 0.06)',
                        color: '#64748b',
                        border: '1px solid rgba(148, 163, 184, 0.08)',
                      }}>
                        {sys}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Blue glow behind frame */}
            <div
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(ellipse at 60% 40%, rgba(59, 130, 246, 0.06) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
              aria-hidden="true"
            />
          </motion.div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <motion.div
        {...fadeUpView(0.4)}
        style={{
          backgroundColor: 'rgba(10, 14, 26, 0.6)',
          borderTop: '1px solid rgba(148, 163, 184, 0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: '#c4b78a' }}>
                  {stat.value}
                </div>
                <div className="text-overline mt-1 uppercase tracking-wider" style={{ color: '#64748b', letterSpacing: '0.1em', fontSize: '0.6875rem' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
