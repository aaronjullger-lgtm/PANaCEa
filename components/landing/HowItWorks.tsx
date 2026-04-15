import React, { useRef } from 'react';
import { motion, useInView, type HTMLMotionProps } from 'framer-motion';
import { Target, Activity, TrendingUp, Check, ArrowRight } from 'lucide-react';

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

const BENEFITS = [
  'NCCPA content blueprint alignment across all modes',
  'Implicit behavioral rating — no self-grading bias',
  'End-of-rotation scheduling for clinical year students',
  'Performance tracking by organ system and topic',
  'Rapid recall drills for time-constrained sessions',
  'Detailed rationales with clinical pearls & mnemonics',
];

interface HowItWorksProps {
  onSignUp: () => void;
  prefersReducedMotion: boolean;
}

export function HowItWorks({ onSignUp, prefersReducedMotion }: HowItWorksProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.1 });

  const fadeUpView = (delay = 0): Partial<HTMLMotionProps<'div'>> =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24, filter: 'blur(4px)' },
          whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
          viewport: { once: true, amount: 0.2 },
          transition: { type: 'spring' as const, stiffness: 350, damping: 26, delay, opacity: { duration: 0.35, delay } },
        };

  const pulseVariants: Partial<HTMLMotionProps<'div'>> = prefersReducedMotion
    ? {}
    : {
        initial: { scale: 1, opacity: 0.6 },
        animate: { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] },
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      };

  const glowLineVariants: Partial<HTMLMotionProps<'div'>> = prefersReducedMotion
    ? {}
    : {
        initial: { scaleY: 0 },
        animate: { scaleY: 1 },
        transition: { duration: 1.2, ease: 'easeOut' },
      };

  return (
    <section
      ref={containerRef}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0e1a 0%, #0f172a 50%, #0a0e1a 100%)',
      }}
    >
      {/* Animated background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-[0.08]"
          style={{ backgroundColor: '#c4b78a' }}
        />
      </div>

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
              backgroundColor: 'rgba(196, 183, 138, 0.12)',
              color: '#c4b78a',
              border: '1px solid rgba(196, 183, 138, 0.2)',
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

        {/* Steps with animated timeline */}
        <div className="relative max-w-4xl mx-auto">
          {/* Animated glow centerline (desktop only) */}
          <motion.div
            className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 origin-top"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(196, 183, 138, 0.3) 15%, rgba(196, 183, 138, 0.3) 85%, transparent)',
              boxShadow: '0 0 20px rgba(196, 183, 138, 0.15)',
            }}
            {...glowLineVariants}
            animate={isInView && !prefersReducedMotion ? 'animate' : 'initial'}
            aria-hidden="true"
          />

          <div className="space-y-16 md:space-y-24">
            {STEPS.map((item, idx) => (
              <motion.div
                key={item.step}
                {...fadeUpView(idx * 0.12)}
                className="relative md:grid md:grid-cols-2 md:gap-16 items-center"
              >
                {/* Animated node circle (centered on timeline) */}
                <motion.div
                  className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full items-center justify-center z-10"
                  style={{
                    backgroundColor: '#0f172a',
                    border: '2px solid rgba(196, 183, 138, 0.4)',
                    boxShadow: '0 0 0 6px #0a0e1a',
                  }}
                  {...pulseVariants}
                  animate={isInView && !prefersReducedMotion ? 'animate' : 'initial'}
                >
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#c4b78a' }}>
                    {item.step}
                  </span>
                </motion.div>

                {/* Glassmorphism step card */}
                <motion.div
                  className={`${idx % 2 === 0 ? 'md:text-right md:pr-12' : 'md:col-start-2 md:pl-12'} text-center`}
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : {
                          y: -4,
                          transition: { duration: 0.3 },
                        }
                  }
                >
                  <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 backdrop-blur-sm transition-all duration-300"
                    style={{
                      backgroundColor: 'rgba(196, 183, 138, 0.12)',
                      border: '1px solid rgba(196, 183, 138, 0.2)',
                      boxShadow: '0 8px 32px rgba(196, 183, 138, 0.08)',
                    }}
                  >
                    <item.icon className="w-6 h-6" style={{ color: '#c4b78a' }} />
                  </div>
                  <h3 className="text-h2 font-bold mb-3" style={{ color: '#f1f5f9' }}>
                    {item.title}
                  </h3>
                  <p className="text-body leading-relaxed max-w-sm mx-auto md:mx-0" style={{ color: '#94a3b8' }}>
                    {item.desc}
                  </p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Benefits grid (2-column) */}
        <motion.div {...fadeUpView(0.36)} className="mt-24 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BENEFITS.map((benefit, idx) => (
              <motion.div
                key={benefit}
                className="flex items-start gap-3 rounded-lg p-4 backdrop-blur-sm transition-all duration-300 hover:bg-opacity-10"
                style={{
                  backgroundColor: 'rgba(196, 183, 138, 0.06)',
                  border: '1px solid rgba(196, 183, 138, 0.12)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                }}
                whileHover={
                  prefersReducedMotion
                    ? undefined
                    : {
                        x: 4,
                        backgroundColor: 'rgba(196, 183, 138, 0.1)',
                        transition: { duration: 0.3 },
                      }
                }
              >
                <div className="flex-shrink-0 mt-0.5">
                  <Check className="w-5 h-5" style={{ color: '#c4b78a' }} />
                </div>
                <span className="text-body-sm font-medium" style={{ color: '#cbd5e1' }}>
                  {benefit}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Enhanced CTA button */}
          <div className="text-center mt-12">
            <motion.button
              type="button"
              onClick={onSignUp}
              className="group relative inline-flex items-center gap-2.5 px-8 py-4 font-semibold text-base rounded-xl min-h-[48px] overflow-hidden"
              style={{
                backgroundColor: '#c4b78a',
                color: '#0a0e1a',
                boxShadow: '0 8px 32px rgba(196, 183, 138, 0.3), 0 0 40px rgba(196, 183, 138, 0.15)',
              }}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: 1.03,
                      boxShadow: '0 12px 48px rgba(196, 183, 138, 0.4), 0 0 60px rgba(196, 183, 138, 0.2)',
                    }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            >
              {/* Animated glow background */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                }}
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        x: ['-100%', '100%'],
                      }
                }
                transition={
                  prefersReducedMotion
                    ? {}
                    : {
                        duration: 3,
                        repeat: Infinity,
                        ease: 'linear',
                      }
                }
              />
              <span className="relative">Start Studying Free</span>
              <ArrowRight className="w-4 h-4 relative group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
