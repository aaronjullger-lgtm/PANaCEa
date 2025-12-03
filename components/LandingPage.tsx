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
  ArrowRight
} from 'lucide-react';

export function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Learning',
      description: 'Adaptive questions tailored to your performance and growth areas'
    },
    {
      icon: TrendingUp,
      title: 'Track Your Progress',
      description: 'Comprehensive analytics and performance insights across all systems'
    },
    {
      icon: BookOpen,
      title: 'Comprehensive Content',
      description: 'Thousands of PANCE-style questions covering all medical systems'
    },
    {
      icon: Award,
      title: 'Spaced Repetition',
      description: 'Smart review system to reinforce learning at optimal intervals'
    }
  ];

  const benefits = [
    'Personalized study recommendations',
    'Interactive drill modes and patient encounters',
    'Detailed explanations with clinical pearls',
    'Cross-device sync and offline support',
    'Performance heatmaps by organ system',
    'Flagged questions and custom notes'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span 
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              PANaCEa
            </span>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowSignIn(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
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
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-6">
              Master the{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                PANCE
              </span>
              <br />
              with Confidence
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Your intelligent study companion for physician assistant certification. 
              AI-powered questions, personalized learning paths, and comprehensive analytics.
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
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all duration-300 flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No credit card required
            </div>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-3 justify-center mt-12"
          >
            {['Adaptive AI', 'Cloud Sync', 'Spaced Repetition', 'Detailed Analytics'].map((pill, idx) => (
              <div
                key={idx}
                className="px-4 py-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
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
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Built by PAs, for PAs preparing for certification
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
              className="group p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-12 text-white">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Powerful Features for Your Success
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                Join thousands of PA students who trust PANaCEa for their exam preparation.
              </p>
              <motion.button
                onClick={() => setShowSignIn(true)}
                className="px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Learning Now
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
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4"
                >
                  <CheckCircle2 className="w-6 h-6 text-blue-200 flex-shrink-0" />
                  <span className="text-lg font-medium">{benefit}</span>
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
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white">
            Ready to Begin Your Journey?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Sign in now to access personalized study sessions, track your progress, 
            and take control of your PANCE preparation.
          </p>
          <motion.button
            onClick={() => setShowSignIn(true)}
            className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign In to Get Started
            <ArrowRight className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-slate-600 dark:text-slate-400">
          <p>© 2024 PANaCEa. Your trusted partner in PANCE preparation.</p>
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
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
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
                  <p className="text-blue-100 mt-1 text-sm">
                    Sign in to access your personalized study dashboard
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
                        formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg',
                        footerActionLink: 'text-blue-600 hover:text-indigo-600',
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
