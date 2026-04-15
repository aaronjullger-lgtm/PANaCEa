'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence, useInView, useAnimation, type HTMLMotionProps } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const STATS = [
  { value: '1,000+', label: 'Conditions' },
  { value: '15+', label: 'Study Modes' },
  { value: 'FSRS v6', label: 'Spaced Repetition' },
  { value: 'Free', label: 'To Start' },
] as const;

const FEATURES = [
  { text: 'AI-Powered', delay: 0.3 },
  { text: 'FSRS v6', delay: 0.4 },
  { text: '15+ Modes', delay: 0.5 },
] as const;

interface HeroSectionProps {
  onSignUp: () => void;
  onSignIn: () => void;
  prefersReducedMotion: boolean;
}

// Animated Counter Component
function AnimatedCounter({
  value,
  label,
  prefersReducedMotion
}: {
  value: string;
  label: string;
  prefersReducedMotion: boolean;
}) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [displayValue, setDisplayValue] = React.useState(prefersReducedMotion ? value : '0');

  React.useEffect(() => {
    if (!isInView || prefersReducedMotion) return;

    // Extract numeric value
    const numStr = value.replace(/[^0-9]/g, '');
    const num = parseInt(numStr, 10);

    if (isNaN(num)) {
      setDisplayValue(value);
      return;
    }

    let current = 0;
    const increment = Math.max(1, Math.floor(num / 60));
    const timer = setInterval(() => {
      current += increment;
      if (current >= num) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        const suffix = value.replace(/[0-9]/g, '');
        setDisplayValue(`${current}${suffix}`);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isInView, value, prefersReducedMotion]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: '#c4b78a' }}>
        {displayValue}
      </div>
      <div className="text-overline mt-1 uppercase tracking-wider" style={{ color: '#64748b', letterSpacing: '0.1em', fontSize: '0.6875rem' }}>
        {label}
      </div>
    </div>
  );
}

export function HeroSection({ onSignUp, onSignIn, prefersReducedMotion }: HeroSectionProps) {
  const reduceMotion = prefersReducedMotion;

  const fadeUp = (delay = 0): Partial<HTMLMotionProps<'div'>> =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 28, filter: 'blur(6px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 24,
            delay,
            opacity: { duration: 0.4, delay },
            filter: { duration: 0.35, delay },
          },
        };

  const fadeUpView = (delay = 0): Partial<HTMLMotionProps<'div'>> =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20, filter: 'blur(4px)' },
          whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
          viewport: { once: true, amount: 0.15 },
          transition: {
            type: 'spring' as const,
            stiffness: 350,
            damping: 26,
            delay,
            opacity: { duration: 0.35, delay },
          },
        };

  const floatAnimation = useMemo<Partial<HTMLMotionProps<'div'>>>(
    () =>
      reduceMotion
        ? {}
        : {
            animate: { y: [0, -12, 0] },
            transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
          },
    [reduceMotion]
  );

  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0e1a',
      }}
    >
      {/* ── Animated Gradient Mesh Background ── */}
      <style>{`
        @keyframes gradient-mesh-1 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
          }
          33% {
            transform: translate(-30px, -40px) scale(1.05);
          }
          66% {
            transform: translate(40px, 20px) scale(0.98);
          }
        }

        @keyframes gradient-mesh-2 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
          }
          33% {
            transform: translate(50px, 30px) scale(0.95);
          }
          66% {
            transform: translate(-30px, -50px) scale(1.05);
          }
        }

        @keyframes gradient-mesh-3 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
          }
          33% {
            transform: translate(-40px, 60px) scale(1.02);
          }
          66% {
            transform: translate(30px, -30px) scale(0.98);
          }
        }

        @keyframes shimmer-gradient {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .gradient-mesh-1 {
          animation: ${reduceMotion ? 'none' : 'gradient-mesh-1 12s ease-in-out infinite'};
          will-change: transform;
        }

        .gradient-mesh-2 {
          animation: ${reduceMotion ? 'none' : 'gradient-mesh-2 14s ease-in-out infinite'};
          will-change: transform;
        }

        .gradient-mesh-3 {
          animation: ${reduceMotion ? 'none' : 'gradient-mesh-3 16s ease-in-out infinite'};
          will-change: transform;
        }

        .shimmer-text {
          background-image: linear-gradient(
            135deg,
            #c4b78a 0%,
            #e8e4d8 50%,
            #c4b78a 100%
          );
          background-size: 200% auto;
          animation: ${reduceMotion ? 'none' : 'shimmer-gradient 4s ease-in-out infinite'};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Background gradient mesh layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="gradient-mesh-1 absolute top-1/4 -left-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(79, 70, 229, 0.15) 0%, rgba(79, 70, 229, 0.05) 40%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          aria-hidden="true"
        />
        <div
          className="gradient-mesh-2 absolute top-1/2 right-0 w-[800px] h-[800px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 40%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          aria-hidden="true"
        />
        <div
          className="gradient-mesh-3 absolute bottom-0 left-1/3 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.02) 40%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Floating ambient orbs */}
      {!reduceMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ x: [0, 60, 0], y: [0, -80, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-1/3 -left-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(196, 183, 138, 0.1) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            aria-hidden="true"
          />
          <motion.div
            animate={{ x: [0, -50, 0], y: [0, 60, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute bottom-1/4 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            aria-hidden="true"
          />
          <motion.div
            animate={{ x: [0, 40, 0], y: [0, 50, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-1/2 left-1/4 w-[350px] h-[350px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.06) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Noise texture overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.03 }}
        aria-hidden="true"
      >
        <defs>
          <filter id="noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="4"
              result="noise"
              seed="2"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.5" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#noise)" fill="rgba(255, 255, 255, 1)" />
      </svg>

      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(196, 183, 138, 0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
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
                className="inline-block px-4 py-1.5 rounded-full text-overline font-semibold tracking-widest uppercase backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(196, 183, 138, 0.08)',
                  color: '#c4b78a',
                  border: '1px solid rgba(196, 183, 138, 0.25)',
                  letterSpacing: '0.1em',
                  fontSize: '0.6875rem',
                }}
              >
                Built by a PA student, for PA students
              </span>
            </motion.div>

            {/* Animated text reveal for heading */}
            <motion.h1
              {...fadeUp(0.08)}
              className="text-4xl sm:text-5xl lg:text-display-xl font-bold leading-[1.05]"
              style={{
                color: '#f1f5f9',
                letterSpacing: '-0.04em',
              }}
            >
              {!reduceMotion ? (
                <motion.div>
                  {'Study Smarter for the '.split('').map((char, i) => (
                    <motion.span
                      key={`text-${i}`}
                      initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 28,
                        delay: 0.1 + i * 0.018,
                        opacity: { duration: 0.3, delay: 0.1 + i * 0.018 },
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                  <br />
                  <span className="shimmer-text">PANCE &amp; PANRE</span>
                </motion.div>
              ) : (
                <>
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
                </>
              )}
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
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 font-semibold text-base rounded-xl min-h-[52px] relative"
                style={{
                  backgroundColor: '#c4b78a',
                  color: '#0a0e1a',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(196, 183, 138, 0.3), 0 0 20px rgba(196, 183, 138, 0.2)',
                }}
                whileHover={reduceMotion ? undefined : {
                  scale: 1.03,
                  boxShadow: '0 12px 40px rgba(196, 183, 138, 0.4), 0 0 30px rgba(196, 183, 138, 0.3)'
                }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                Get Started — It's Free
                <motion.svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                  animate={reduceMotion ? undefined : { x: [0, 4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </motion.svg>
              </motion.button>

              <motion.button
                type="button"
                onClick={onSignIn}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 font-medium text-sm rounded-xl min-h-[52px] relative overflow-hidden"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(8px)',
                }}
                whileHover={reduceMotion ? undefined : {
                  scale: 1.02,
                  borderColor: 'rgba(196, 183, 138, 0.5)',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
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
            <motion.div
              {...floatAnimation}
              style={{
                perspective: '1200px',
              }}
            >
              <div
                className="rounded-2xl overflow-hidden relative"
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 80px rgba(196, 183, 138, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  background: 'linear-gradient(145deg, #1f2937, #111827)',
                  transform: 'rotateY(-5deg) rotateX(2deg)',
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  width: '100%',
                  maxWidth: '560px',
                }}
                onMouseEnter={(e) => {
                  if (!reduceMotion) e.currentTarget.style.transform = 'rotateY(-2deg) rotateX(1deg)';
                }}
                onMouseLeave={(e) => {
                  if (!reduceMotion) e.currentTarget.style.transform = 'rotateY(-5deg) rotateX(2deg)';
                }}
              >
                {/* Glow ring around frame */}
                <div
                  className="absolute -inset-4 rounded-2xl pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(196, 183, 138, 0.1) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                    zIndex: -1,
                  }}
                  aria-hidden="true"
                />

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
            </motion.div>

            {/* Floating annotation badges */}
            {!reduceMotion && (
              <AnimatePresence>
                {FEATURES.map((feature) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, scale: 0.8, y: 20, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      type: 'spring',
                      stiffness: 600,
                      damping: 20,
                      delay: feature.delay,
                      opacity: { duration: 0.3, delay: feature.delay },
                    }}
                    className="absolute rounded-lg px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
                    style={{
                      backgroundColor: 'rgba(196, 183, 138, 0.12)',
                      color: '#c4b78a',
                      border: '1px solid rgba(196, 183, 138, 0.3)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    {feature.text === 'AI-Powered' && <span className="mr-1.5">✨</span>}
                    {feature.text === 'FSRS v6' && <span className="mr-1.5">🧠</span>}
                    {feature.text === '15+ Modes' && <span className="mr-1.5">🎯</span>}
                    {feature.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <motion.div
        {...fadeUpView(0.4)}
        style={{
          backgroundColor: 'rgba(10, 14, 26, 0.4)',
          borderTop: '1px solid rgba(148, 163, 184, 0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <AnimatedCounter
                key={stat.label}
                value={stat.value}
                label={stat.label}
                prefersReducedMotion={reduceMotion}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Scroll Indicator ── */}
      {!reduceMotion && (
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs uppercase tracking-widest" style={{ color: '#94a3b8' }}>Scroll</span>
          <ChevronDown className="w-5 h-5" style={{ color: '#c4b78a' }} />
        </motion.div>
      )}
    </section>
  );
}
