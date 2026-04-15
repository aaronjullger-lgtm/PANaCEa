import React, { useState, useRef, useEffect } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Stethoscope,
  BarChart3,
  Zap,
  Shield,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Brain,
    title: 'Adaptive Spaced Repetition',
    desc: 'FSRS v6 algorithm with implicit behavioral rating — no manual "Easy/Hard" buttons. The system learns how well you know each card from your response patterns.',
    accent: '#c4b78a',
    accentBg: 'rgba(196, 183, 138, 0.08)',
    accentBorder: 'rgba(196, 183, 138, 0.12)',
  },
  {
    icon: Stethoscope,
    title: 'Clinical Drill Modes',
    desc: 'DDx, pharmacology, first-line treatment, ECG, imaging, anatomy, and more. 15+ specialized modes that go beyond basic Q&A.',
    accent: '#0ea5e9',
    accentBg: 'rgba(14, 165, 233, 0.08)',
    accentBorder: 'rgba(14, 165, 233, 0.12)',
  },
  {
    icon: BookOpen,
    title: 'Medical Database',
    desc: '1,000+ conditions with treatments, labs, clinical guidelines, and differential diagnoses — all searchable and cross-referenced.',
    accent: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.08)',
    accentBorder: 'rgba(16, 185, 129, 0.12)',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    desc: 'Track accuracy by system, identify weak areas, monitor your study streaks, and see predicted retention curves.',
    accent: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.08)',
    accentBorder: 'rgba(245, 158, 11, 0.12)',
  },
  {
    icon: Zap,
    title: 'AI-Powered Content',
    desc: 'Questions generated and graded by AI, with structured rationales, clinical pearls, and mnemonic aids built in.',
    accent: '#ef4444',
    accentBg: 'rgba(239, 68, 68, 0.08)',
    accentBorder: 'rgba(239, 68, 68, 0.12)',
  },
  {
    icon: Shield,
    title: 'Exam-Aligned Blueprint',
    desc: 'Strict NCCPA blueprint weighting for PANCE simulation. Every session mirrors the real exam distribution.',
    accent: '#8b5cf6',
    accentBg: 'rgba(139, 92, 246, 0.08)',
    accentBorder: 'rgba(139, 92, 246, 0.12)',
  },
] as const;

interface FeaturesGridProps {
  prefersReducedMotion: boolean;
}

function FeatureCard({
  feature,
  idx,
  isHero,
  prefersReducedMotion,
}: {
  feature: (typeof FEATURES)[number];
  idx: number;
  isHero?: boolean;
  prefersReducedMotion: boolean;
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const fadeUpView: Partial<HTMLMotionProps<'div'>> = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24, filter: 'blur(4px)' },
        whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
        viewport: { once: true, amount: 0.15 },
        transition: { type: 'spring', stiffness: 350, damping: 26, delay: idx * 0.06 },
      };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <motion.div
      {...fadeUpView}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={prefersReducedMotion ? undefined : { y: -4, transition: { duration: 0.3, ease: 'easeOut' } }}
      className={`group relative overflow-hidden rounded-2xl p-8 transition-all duration-300 cursor-pointer ${
        isHero ? 'lg:col-span-2' : ''
      }`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Background accent glow (follows mouse on hover) */}
      {mousePos.x !== 0 && mousePos.y !== 0 && !prefersReducedMotion && (
        <div
          className="pointer-events-none absolute w-96 h-96 rounded-full transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle, ${feature.accent}20 0%, transparent 70%)`,
            left: `${mousePos.x - 192}px`,
            top: `${mousePos.y - 192}px`,
            opacity: 0.06,
          }}
        />
      )}

      {/* Card glow on hover */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileHover={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 600, damping: 20 } }
        }
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at center, ${feature.accent}30 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />

      {/* Inner top-left accent glow */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${feature.accent}40 0%, transparent 70%)`,
          filter: 'blur(30px)',
        }}
      />

      {/* Border accent on hover */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, transition: { duration: 0.3 } }
        }
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          border: `1px solid ${feature.accent}`,
          opacity: 0,
        }}
      />

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Icon container with scale animation */}
        <motion.div
          initial={{ scale: 1 }}
          whileHover={
            prefersReducedMotion
              ? undefined
              : { scale: 1.1, transition: { duration: 0.3 } }
          }
          className={`flex items-center justify-center rounded-xl mb-6 transition-all duration-300 ${
            isHero ? 'w-16 h-16' : 'w-12 h-12'
          }`}
          style={{
            backgroundColor: feature.accentBg,
            border: `1px solid ${feature.accentBorder}`,
          }}
        >
          <feature.icon
            className={`transition-all duration-300 ${isHero ? 'w-7 h-7' : 'w-6 h-6'}`}
            style={{ color: feature.accent }}
          />
        </motion.div>

        {/* Title */}
        <h3
          className={`font-semibold mb-3 transition-colors duration-300 text-slate-50 ${
            isHero ? 'text-2xl' : 'text-lg'
          }`}
        >
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-slate-400 leading-relaxed text-sm group-hover:text-slate-300 transition-colors duration-300">
          {feature.desc}
        </p>

        {/* Hero card visualization (animated FSRS curve) */}
        {isHero && !prefersReducedMotion && (
          <motion.div
            className="mt-8 pt-8 border-t border-slate-700/50"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 + 0.3, duration: 0.6 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            {/* Simple animated retention curve visualization */}
            <svg viewBox="0 0 280 80" className="w-full h-24 opacity-60">
              {/* Grid lines */}
              <line x1="20" y1="70" x2="260" y2="70" stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1" />
              <line x1="20" y1="50" x2="260" y2="50" stroke="rgba(148, 163, 184, 0.05)" strokeWidth="1" />

              {/* Y-axis label */}
              <text x="8" y="35" fontSize="10" fill="rgba(148, 163, 184, 0.5)" textAnchor="end">
                100%
              </text>
              <text x="8" y="75" fontSize="10" fill="rgba(148, 163, 184, 0.5)" textAnchor="end">
                0%
              </text>

              {/* Decay curve (spaced repetition intervals) */}
              <motion.path
                d="M 20,30 Q 80,35 120,45 T 260,65"
                stroke="#c4b78a"
                strokeWidth="2.5"
                fill="none"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                transition={{ delay: idx * 0.06 + 0.4, duration: 1, ease: 'easeInOut' }}
                viewport={{ once: true, amount: 0.5 }}
              />

              {/* Animated dots at review intervals */}
              {[20, 80, 140, 200, 260].map((x, i) => (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={30 + i * 9}
                  r="2.5"
                  fill="#c4b78a"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: idx * 0.06 + 0.5 + i * 0.08,
                    duration: 0.4,
                  }}
                  viewport={{ once: true, amount: 0.5 }}
                />
              ))}
            </svg>
            <p className="text-xs text-slate-500 text-center mt-2">
              Retention curve across spaced review intervals
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function FeaturesGrid({ prefersReducedMotion }: FeaturesGridProps) {
  const fadeUpView: Partial<HTMLMotionProps<'div'>> = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24, filter: 'blur(4px)' },
        whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
        viewport: { once: true, amount: 0.15 },
        transition: { type: 'spring', stiffness: 350, damping: 26, delay: 0 },
      };

  const containerVariants = prefersReducedMotion
    ? {}
    : {
        initial: 'initial',
        whileInView: 'animate',
        viewport: { once: true, amount: 0.1 },
      };

  return (
    <section
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ backgroundColor: '#0a0e1a' }}
    >
      {/* Subtle background gradient + radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10, 14, 26, 0) 0%, rgba(10, 14, 26, 0.4) 100%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl"
          style={{
            background:
              'radial-gradient(ellipse 120% 60% at center, rgba(196, 183, 138, 0.08) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div {...fadeUpView} className="text-center mb-20">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase mb-5 transition-all duration-300"
            style={{
              backgroundColor: 'rgba(196, 183, 138, 0.08)',
              color: '#c4b78a',
              border: '1px solid rgba(196, 183, 138, 0.15)',
              letterSpacing: '0.1em',
            }}
          >
            Features
          </span>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-50 mb-4"
            style={{ letterSpacing: '-0.025em' }}
          >
            Everything You Need to Pass
          </h2>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Purpose-built for PA students. Every feature mapped to the NCCPA content blueprint.
          </p>
        </motion.div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, idx) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              idx={idx}
              isHero={idx === 0}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
