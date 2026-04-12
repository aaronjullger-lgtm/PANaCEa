import React from 'react';
import { motion } from 'framer-motion';

interface FinalCTAProps {
  onSignUp: () => void;
  onSignIn: () => void;
  prefersReducedMotion: boolean;
}

export function FinalCTA({ onSignUp, onSignIn, prefersReducedMotion }: FinalCTAProps) {
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
        background: 'linear-gradient(160deg, #0a0e1a 0%, #0f172a 40%, #141b2d 100%)',
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(196, 183, 138, 0.04) 0%, transparent 60%)',
          filter: 'blur(60px)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div {...fadeUpView(0)} className="space-y-7">
          <h2
            className="text-display sm:text-display-xl font-bold"
            style={{ color: '#f1f5f9', letterSpacing: '-0.04em' }}
          >
            Ready to Own Your Exam Prep?
          </h2>
          <p className="text-body-lg sm:text-h3 max-w-xl mx-auto" style={{ color: '#94a3b8' }}>
            Join the PA students using adaptive spaced repetition to study
            smarter — not harder.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <motion.button
              type="button"
              onClick={onSignUp}
              className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 font-bold text-lg rounded-full min-h-[56px]"
              style={{
                backgroundColor: '#c4b78a',
                color: '#0a0e1a',
                borderRadius: '9999px',
                boxShadow: '0 8px 32px rgba(196, 183, 138, 0.3)',
              }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.03, boxShadow: '0 12px 40px rgba(196, 183, 138, 0.4)' }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              Sign Up Free
              <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.button>

            <motion.button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 font-medium text-sm rounded-full min-h-[56px]"
              style={{
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '9999px',
              }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, borderColor: 'rgba(196, 183, 138, 0.3)' }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              Already have an account? Sign In
            </motion.button>
          </div>

          <p className="text-caption" style={{ color: '#475569' }}>
            Free to start · No credit card · Works on any device
          </p>
        </motion.div>
      </div>
    </section>
  );
}
