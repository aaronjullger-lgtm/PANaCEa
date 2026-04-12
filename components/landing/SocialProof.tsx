import React from 'react';
import { motion } from 'framer-motion';

const TRUST_STATS = [
  { value: '2M+', label: 'Questions Answered' },
  { value: '98%', label: 'Student Satisfaction' },
  { value: '15+', label: 'Study Modes' },
  { value: '100%', label: 'Free to Start' },
] as const;

interface SocialProofProps {
  prefersReducedMotion: boolean;
}

export function SocialProof({ prefersReducedMotion }: SocialProofProps) {
  const fadeUpView = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.2 },
          transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
        };

  return (
    <section
      className="py-16 sm:py-20"
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          {...fadeUpView(0)}
          className="text-overline font-semibold uppercase text-center mb-10"
          style={{
            color: 'var(--color-text-muted)',
            letterSpacing: '0.1em',
            fontSize: '0.6875rem',
          }}
        >
          Trusted by PA students preparing for the PANCE & PANRE
        </motion.p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {TRUST_STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              {...fadeUpView(idx * 0.08)}
              className="text-center"
            >
              <div
                className="text-3xl sm:text-4xl font-bold tabular-nums mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {stat.value}
              </div>
              <div
                className="text-label uppercase"
                style={{
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.06em',
                  fontSize: '0.6875rem',
                }}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
