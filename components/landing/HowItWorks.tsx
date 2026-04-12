import React from 'react';
import { motion } from 'framer-motion';
import { Target, Activity, TrendingUp } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Set Your Goal',
    desc: 'Pick your exam date, current rotation, and daily time budget. PANaCEa tailors everything from there.',
    icon: Target,
  },
  {
    step: '02',
    title: 'Study with Adaptive Drills',
    desc: 'Answer questions across 15+ modes. The FSRS algorithm tracks your memory strength and schedules reviews at the optimal moment.',
    icon: Activity,
  },
  {
    step: '03',
    title: 'Track & Improve',
    desc: 'Watch your accuracy climb, close knowledge gaps the analytics reveal, and walk into your exam confident.',
    icon: TrendingUp,
  },
] as const;

interface HowItWorksProps {
  onSignUp: () => void;
  prefersReducedMotion: boolean;
}

export function HowItWorks({ onSignUp, prefersReducedMotion }: HowItWorksProps) {
  const fadeUpView = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.2 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        };

  return (
    <section
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0e1a 0%, #0f172a 50%, #0a0e1a 100%)',
      }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.5) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div {...fadeUpView(0)} className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-overline font-semibold uppercase mb-5"
            style={{
              backgroundColor: 'rgba(196, 183, 138, 0.08)',
              color: '#c4b78a',
              border: '1px solid rgba(196, 183, 138, 0.15)',
              letterSpacing: '0.1em',
              fontSize: '0.6875rem',
            }}
          >
            How It Works
          </span>
          <h2
            className="text-display-sm sm:text-display font-bold mb-4"
            style={{ color: '#f1f5f9', letterSpacing: '-0.025em' }}
          >
            Three Steps to Exam Readiness
          </h2>
          <p className="text-body-lg max-w-2xl mx-auto" style={{ color: '#94a3b8' }}>
            No setup required. Sign up, start studying, and let the algorithm optimize your schedule.
          </p>
        </motion.div>

        {/* Steps with connected timeline */}
        <div className="relative max-w-4xl mx-auto">
          {/* Vertical connecting line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(196, 183, 138, 0.2) 15%, rgba(196, 183, 138, 0.2) 85%, transparent)',
            }}
            aria-hidden="true"
          />

          <div className="space-y-16 md:space-y-24">
            {STEPS.map((item, idx) => (
              <motion.div
                key={item.step}
                {...fadeUpView(idx * 0.12)}
                className="relative md:grid md:grid-cols-2 md:gap-16 items-center"
              >
                {/* Step number circle (centered on timeline) */}
                <div
                  className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full items-center justify-center z-10"
                  style={{
                    backgroundColor: '#0f172a',
                    border: '2px solid rgba(196, 183, 138, 0.3)',
                    boxShadow: '0 0 0 4px #0a0e1a',
                  }}
                >
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#c4b78a' }}>{item.step}</span>
                </div>

                {/* Content — alternating sides */}
                <div className={`${idx % 2 === 0 ? 'md:text-right md:pr-12' : 'md:col-start-2 md:pl-12'} text-center`}>
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 ${idx % 2 === 0 ? '' : ''}`}
                    style={{ backgroundColor: 'rgba(196, 183, 138, 0.1)', border: '1px solid rgba(196, 183, 138, 0.15)' }}
                  >
                    <item.icon className="w-6 h-6" style={{ color: '#c4b78a' }} />
                  </div>
                  <h3 className="text-h2 font-bold mb-3" style={{ color: '#f1f5f9' }}>{item.title}</h3>
                  <p className="text-body leading-relaxed max-w-sm mx-auto md:mx-0" style={{ color: '#94a3b8' }}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Benefits checklist */}
        <motion.div {...fadeUpView(0.4)} className="mt-24 max-w-2xl mx-auto">
          <div className="space-y-3">
            {[
              'NCCPA content blueprint alignment across all modes',
              'Implicit behavioral rating — no self-grading bias',
              'End-of-rotation scheduling for clinical year students',
              'Performance tracking by organ system and topic',
              'Rapid recall drills for time-constrained sessions',
              'Detailed rationales with clinical pearls & mnemonics',
            ].map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-3 rounded-xl p-3.5"
                style={{
                  backgroundColor: 'rgba(241, 245, 249, 0.03)',
                  border: '1px solid rgba(148, 163, 184, 0.06)',
                }}
              >
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#c4b78a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-body-sm font-medium" style={{ color: '#cbd5e1' }}>
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <motion.button
              type="button"
              onClick={onSignUp}
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 font-semibold text-base rounded-xl min-h-[48px]"
              style={{
                backgroundColor: '#c4b78a',
                color: '#0a0e1a',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(196, 183, 138, 0.2)',
              }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              Start Studying Free
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
