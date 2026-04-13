import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface FinalCTAProps {
  onSignUp: () => void;
  onSignIn: () => void;
  prefersReducedMotion: boolean;
}

export function FinalCTA({ onSignUp, onSignIn, prefersReducedMotion }: FinalCTAProps) {
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for scroll-triggered entrance (30% threshold)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  // Animation variants respecting prefers-reduced-motion
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  // Animated orbs (slow floating 12-24s)
  const orbVariants = {
    float: {
      y: [0, -30, 0],
      x: [0, 15, 0],
      opacity: [0.04, 0.08, 0.04],
      transition: {
        duration: prefersReducedMotion ? 0 : 20,
        ease: 'easeInOut',
        repeat: Infinity,
      },
    },
  };

  // Border pulse animation for secondary button
  const borderPulseVariants = {
    pulse: {
      borderColor: [
        'rgba(196, 183, 138, 0.2)',
        'rgba(196, 183, 138, 0.4)',
        'rgba(196, 183, 138, 0.2)',
      ],
      transition: {
        duration: prefersReducedMotion ? 0 : 3,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  // Gradient shimmer text animation
  const gradientVariants = {
    shimmer: {
      backgroundPosition: ['-1000% 0', '1000% 0'],
      transition: {
        duration: prefersReducedMotion ? 0 : 8,
        ease: 'linear',
        repeat: Infinity,
      },
    },
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0a0e1a 0%, #0f172a 40%, #141b2d 100%)',
      }}
    >
      {/* Decorative dot grid pattern (opacity 0.02) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.02 }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="dots" x="40" y="40" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="#c4b78a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Decorative perspective grid pattern (opacity 0.03) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.03 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4b78a" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <g stroke="url(#gridGradient)" strokeWidth="1">
          {[...Array(20)].map((_, i) => (
            <React.Fragment key={`grid-${i}`}>
              <line x1={i * 60} y1="0" x2={i * 60 + 400} y2="600" />
              <line x1="0" y1={i * 60} x2="400" y2={i * 60 + 400} />
            </React.Fragment>
          ))}
        </g>
      </svg>

      {/* Animated floating gradient orbs */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute top-1/4 left-1/4 w-[300px] h-[300px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(196, 183, 138, 0.08) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            variants={orbVariants}
            animate="float"
            aria-hidden="true"
          />
          <motion.div
            className="absolute top-1/3 right-1/4 w-[400px] h-[400px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(196, 183, 138, 0.06) 0%, transparent 70%)',
              filter: 'blur(100px)',
            }}
            variants={orbVariants}
            animate="float"
            transition={{ delay: 5, duration: 24 }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute bottom-1/4 left-1/3 w-[250px] h-[250px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(196, 183, 138, 0.04) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
            variants={orbVariants}
            animate="float"
            transition={{ delay: 10, duration: 18 }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Main central radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(196, 183, 138, 0.05) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          variants={prefersReducedMotion ? {} : staggerContainer}
          initial="hidden"
          animate={prefersReducedMotion || isInView ? 'visible' : 'hidden'}
          className="space-y-7"
        >
          {/* Gradient text heading */}
          <motion.div variants={prefersReducedMotion ? {} : fadeUpVariants}>
            <motion.h2
              className="font-bold"
              style={{
                fontSize: 'clamp(2rem, 8vw, 4rem)',
                letterSpacing: '-0.04em',
                background: 'linear-gradient(110deg, #f1f5f9 0%, #c4b78a 50%, #f1f5f9 100%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              variants={prefersReducedMotion ? {} : gradientVariants}
              animate={prefersReducedMotion || isInView ? 'shimmer' : 'initial'}
            >
              Ready to Own Your Exam Prep?
            </motion.h2>
          </motion.div>

          {/* Subtitle with fluid sizing */}
          <motion.p
            className="max-w-xl mx-auto"
            style={{
              fontSize: 'clamp(1rem, 3vw, 1.25rem)',
              color: '#94a3b8',
              lineHeight: '1.6',
            }}
            variants={prefersReducedMotion ? {} : fadeUpVariants}
          >
            Join the PA students using adaptive spaced repetition to study smarter — not harder.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center pt-2"
            variants={prefersReducedMotion ? {} : fadeUpVariants}
          >
            {/* Primary button */}
            <motion.button
              type="button"
              onClick={onSignUp}
              className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 font-bold text-lg rounded-full min-h-[56px] transition-all duration-300"
              style={{
                backgroundColor: '#c4b78a',
                color: '#0a0e1a',
                boxShadow: '0 8px 32px rgba(196, 183, 138, 0.3)',
              }}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: 1.03,
                      boxShadow: '0 12px 48px rgba(196, 183, 138, 0.5)',
                    }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              Sign Up Free
              <svg
                className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </motion.button>

            {/* Secondary button with pulse border */}
            <motion.button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 font-medium text-sm rounded-full min-h-[56px] transition-all duration-300"
              style={{
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                border: '1px solid rgba(148, 163, 184, 0.2)',
              }}
              variants={prefersReducedMotion ? {} : borderPulseVariants}
              animate={prefersReducedMotion || isInView ? 'pulse' : 'initial'}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: 1.02,
                      borderColor: 'rgba(196, 183, 138, 0.4)',
                      backgroundColor: 'rgba(196, 183, 138, 0.05)',
                    }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              Already have an account? Sign In
            </motion.button>
          </motion.div>

          {/* Trust line with check icons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4"
            style={{ color: '#475569', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}
            variants={prefersReducedMotion ? {} : fadeUpVariants}
          >
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Free to start</span>
            </div>
            <span className="hidden sm:inline">·</span>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>No credit card</span>
            </div>
            <span className="hidden sm:inline">·</span>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Works on any device</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
