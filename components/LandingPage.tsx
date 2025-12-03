/**
 * Landing Page Component
 * First page users see before signing in
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignIn } from '@clerk/clerk-react';
import { 
  BookOpen, 
  Brain, 
  Award, 
  TrendingUp, 
  Zap,
  CheckCircle2,
  ArrowRight,
  Activity,
  Target,
  Repeat
} from 'lucide-react';

export function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  const features = [
    {
      icon: Brain,
      title: 'AI-Generated Questions',
      description: 'Gemini AI creates PANCE-style questions on demand, targeting your weak areas with adaptive difficulty'
    },
    {
      icon: Activity,
      title: 'Visual Learning Drills',
      description: 'ECG interpretation, dermatology images, radiology studies, and photo-based clinical cases'
    },
    {
      icon: Target,
      title: 'Specialized Training Modes',
      description: '15+ drill formats including pharmacology, DDx comparisons, mini-labs, and patient encounters'
    },
    {
      icon: Repeat,
      title: 'SM-2 Spaced Repetition',
      description: 'Research-backed algorithm schedules reviews at optimal intervals based on your performance'
    }
  ];

  const benefits = [
    '1000+ curated conditions across all PANCE systems',
    'Real-time performance heatmaps showing strengths and weaknesses',
    'Rapid Recall drills for quick fact reinforcement',
    'First-line treatment and antibiotic selection training',
    'Detailed rationales with clinical pearls and mnemonics',
    'Cloud sync keeps your progress available anywhere'
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 rounded-lg flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-serif">
              PANaCEa
            </span>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowSignIn(true)}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign In
          </motion.button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="text-[var(--color-text-primary)]">PANCE Prep with </span>
              <span className="bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 bg-clip-text text-transparent">
                AI Intelligence
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed">
              A comprehensive study platform combining AI-generated questions, visual learning drills, 
              and evidence-based spaced repetition to help PA students pass the PANCE.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.button
              onClick={() => setShowSignIn(true)}
              className="group px-8 py-4 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Studying Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            <div className="text-sm text-[var(--color-text-muted)]">
              Free account • No credit card
            </div>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-3 justify-center mt-12"
          >
            {['Gemini AI', '15+ Drill Modes', 'SM-2 Algorithm', '1000+ Conditions'].map((pill, idx) => (
              <div
                key={idx}
                className="px-4 py-2 bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)]"
              >
                {pill}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-[var(--color-text-primary)] mb-4">
            Four Core Features That Work
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)]">
            Targeted tools designed for efficient PANCE preparation
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="group p-8 bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-2xl border border-[var(--color-border)] hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                {feature.title}
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 rounded-3xl p-12 text-white shadow-2xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                What You Actually Get
              </h2>
              <p className="text-xl text-emerald-50 mb-8">
                Specific features designed to help you identify weak areas and improve systematically.
              </p>
              <motion.button
                onClick={() => setShowSignIn(true)}
                className="px-8 py-4 bg-white text-emerald-600 rounded-lg font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Training Today
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              {benefits.map((benefit, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4"
                >
                  <CheckCircle2 className="w-6 h-6 text-emerald-200 flex-shrink-0 mt-0.5" />
                  <span className="text-lg font-medium leading-relaxed">{benefit}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-[var(--color-text-primary)]">
            Ready to Start Studying?
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Create a free account to access AI-generated questions, visual drills, 
            and performance tracking across all PANCE content areas.
          </p>
          <motion.button
            onClick={() => setShowSignIn(true)}
            className="px-10 py-5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Create Free Account
            <ArrowRight className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-[var(--color-text-muted)]">
          <p>© {new Date().getFullYear()} PANaCEa. PANCE preparation platform for physician assistant students.</p>
        </div>
      </footer>

      {/* Sign In Modal */}
      <AnimatePresence>
        {showSignIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setShowSignIn(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--color-border)]">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 px-6 py-4 text-white">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Welcome to PANaCEa</h3>
                    <button
                      onClick={() => setShowSignIn(false)}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-emerald-50 mt-1 text-sm">
                    Sign in to access your study dashboard
                  </p>
                </div>

                {/* Clerk Sign In Component */}
                <div className="p-6">
                  <SignIn 
                    appearance={{
                      elements: {
                        rootBox: 'mx-auto',
                        card: 'bg-transparent shadow-none',
                        headerTitle: 'hidden',
                        headerSubtitle: 'hidden',
                        socialButtonsBlockButton: 'hover:scale-105 transition-transform',
                        formButtonPrimary: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg',
                        footerActionLink: 'text-emerald-600 hover:text-teal-600 dark:text-emerald-400 dark:hover:text-teal-400',
                      },
                    }}
                    afterSignInUrl="/"
                    afterSignUpUrl="/"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
