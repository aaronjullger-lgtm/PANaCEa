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
  CheckCircle2,
  ArrowRight,
  Activity as ActivityIcon,
  Target,
  Repeat
} from 'lucide-react';

export function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  const features = [
    {
      icon: Brain,
      title: 'Intelligent Question Generation',
      description: 'Advanced AI analyzes your performance patterns and generates exam-level questions that target your specific knowledge gaps—no generic question banks'
    },
    {
      icon: ActivityIcon,
      title: 'Clinical Image Mastery',
      description: 'Master ECG interpretation, dermatological diagnosis, and radiological analysis with curated visual cases that mirror real exam conditions'
    },
    {
      icon: Target,
      title: '15+ Clinical Training Modes',
      description: "From pharmacology drills to differential diagnosis challenges—train with the same depth and variety you'll encounter on exam day"
    },
    {
      icon: Repeat,
      title: 'Scientific Spaced Repetition',
      description: 'Evidence-based SM-2 algorithm optimizes your review schedule, ensuring information moves from short-term to long-term memory efficiently'
    }
  ];

  const benefits = [
    'Comprehensive coverage: 1000+ conditions mapped to the NCCPA blueprint',
    'Performance analytics that reveal exactly where you need to focus',
    'Rapid Recall mode: Build reflexive knowledge for time-pressured scenarios',
    'Clinical decision training: First-line treatments and antibiotic selection',
    'Expert rationales featuring clinical pearls, mnemonics, and high-yield details',
    'Seamless cloud synchronization—study anywhere, pick up where you left off'
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
            <img 
              src="/PANaCEa.svg" 
              alt="PANaCEa Logo" 
              className="w-8 h-8"
            />
            <span className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight font-serif">
              PANaCEa
            </span>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowSignIn(true)}
            className="px-6 py-2.5 bg-[#1F283A] hover:bg-[#364154] dark:bg-[#E9ECF1] dark:hover:bg-white text-white dark:text-[#101729] rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
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
              <span className="text-[var(--color-text-primary)]">Master the PANCE with </span>
              <span className="bg-gradient-to-r from-[#1F283A] to-[#364154] dark:from-[#E9ECF1] dark:to-[#ffffff] bg-clip-text text-transparent">
                Precision AI
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed">
              An intelligent study platform that adapts to your learning patterns—combining AI-driven question generation, 
              clinical visual mastery, and evidence-based retention science to ensure you're exam-ready.
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
              className="group px-8 py-4 bg-[#1F283A] hover:bg-[#364154] dark:bg-[#E9ECF1] dark:hover:bg-white text-white dark:text-[#101729] rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Begin Your Preparation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            <div className="text-sm text-[var(--color-text-muted)]">
              Free to start • Full access
            </div>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-3 justify-center mt-12"
          >
            {['Adaptive AI', '15+ Training Modes', 'Spaced Repetition', '1000+ Conditions'].map((pill, idx) => (
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
            Study Smarter, Not Harder
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)]">
            Four intelligent systems working together to maximize your exam readiness
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
              <div className="w-14 h-14 bg-gradient-to-br from-[#1F283A] to-[#364154] dark:from-[#364154] dark:to-[#E9ECF1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <feature.icon className="w-7 h-7 text-white dark:text-[#101729]" />
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
        <div className="bg-gradient-to-br from-[#1F283A] to-[#364154] dark:from-[#364154] dark:to-[#1F283A] rounded-3xl p-12 text-white shadow-2xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Everything You Need to Succeed
              </h2>
              <p className="text-xl text-[#E9ECF1] mb-8">
                Precision tools and intelligent systems that identify gaps in your knowledge and systematically strengthen them—no guesswork, just results.
              </p>
              <motion.button
                onClick={() => setShowSignIn(true)}
                className="px-8 py-4 bg-white text-[#1F283A] rounded-lg font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Your Journey
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
                  <CheckCircle2 className="w-6 h-6 text-[#E9ECF1] flex-shrink-0 mt-0.5" />
                  <span className="text-lg font-medium leading-relaxed text-[#E9ECF1]">{benefit}</span>
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
            Transform Your Exam Preparation
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Join PA students who are preparing smarter with adaptive AI, clinical visual training, 
            and performance analytics that ensure you're ready for exam day.
          </p>
          <motion.button
            onClick={() => setShowSignIn(true)}
            className="px-10 py-5 bg-[#1F283A] hover:bg-[#364154] dark:bg-[#E9ECF1] dark:hover:bg-white text-white dark:text-[#101729] rounded-lg font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started Now
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
                <div className="bg-gradient-to-r from-[#1F283A] to-[#364154] dark:from-[#364154] dark:to-[#1F283A] px-6 py-4 text-white">
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
                  <p className="text-[#E9ECF1] mt-1 text-sm">
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
                        formButtonPrimary: 'bg-[#1F283A] hover:bg-[#364154] hover:shadow-lg',
                        footerActionLink: 'text-[#1F283A] hover:text-[#364154] dark:text-[#E9ECF1] dark:hover:text-white',
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
