/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Quiz button classes that may be conditionally applied
    'bg-primary',
    'bg-action-blue-600',
    'text-white',
    'hover:bg-action-blue-700',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
    // Conditional button states
    'opacity-50',
    'cursor-not-allowed',
    'pointer-events-none',
    // HUD and score display classes
    'text-muted-amber-600',
    'text-steel-blue-600',
    'bg-slate-800',
    'bg-slate-900',
    // Common conditional color classes
    'text-critical',
    'text-stable',
    'text-provisional',
    'bg-critical',
    'bg-stable',
    'bg-provisional',
    // Custom semantic color palette classes
    'bg-action-muted',
    'bg-data-fail',
    'bg-data-pass',
    'bg-data-provisional',
    'bg-data-neutral',
    'bg-data-warning',
    'bg-data-positive',
    'bg-data-negative',
    'bg-data-neutral-bg',
    'text-data-fail',
    'text-data-pass',
    'text-data-provisional',
    'text-data-neutral',
    'text-data-warning',
    // Custom palette colors
    'bg-deep-plum-50',
    'bg-deep-plum-400',
    'bg-deep-plum-900',
    'text-deep-plum-500',
    'border-deep-plum-200',
    'border-deep-plum-800',
    'bg-dusty-rose',
    'bg-dusty-rose-50',
    'bg-dusty-rose-100',
    'bg-dusty-rose-900',
    'text-dusty-rose-600',
    'border-dusty-rose-300',
    'bg-steel-blue-50',
    'bg-steel-blue-100',
    'border-steel-blue-300',
    'bg-muted-amber',
    'bg-muted-amber-500',
    'text-muted-amber-500',
    'border-muted-amber-300',
    'bg-sage-50',
    'bg-sage-100',
    'bg-sage-900',
    'border-sage-300',
    'bg-slate-teal-50',
    'bg-slate-teal-100',
    'border-slate-teal-300',
    // Border and spacing variants
    'border-transparent',
    'border-current',
    'border-dashed',
    'border-0',
    'border-2',
    'border-b',
    'border-b-2',
    'border-t',
    'border-action-primary',
    'border-data-fail',
    'border-data-neutral',
    'border-data-pass',
    // Status and error classes
    'bg-error',
    'bg-error-muted',
    'bg-success',
    'bg-success-muted',
    'bg-warning-muted',
    'text-error',
    'bg-black',
    'bg-white',
    'bg-transparent',
    'bg-card',
    'bg-bg-tertiary',
    'bg-border-subtle',
    'bg-elevated',
    'bg-surface-hover',
    'bg-secondary',
    'bg-tertiary',
    'text-secondary',
    'text-tertiary',
    'bg-gradient-to-r',
    'bg-gradient-to-br',
    'bg-opacity-10',
    // Purple/indigo gradient classes used in SmartReviewMode, AdvancedFeaturesPanel, etc.
    'from-purple-400', 'from-purple-50', 'from-purple-500', 'from-purple-600', 'from-purple-900',
    'from-indigo-500', 'from-indigo-600',
    'to-purple-500', 'to-purple-600',
    'to-indigo-50', 'to-indigo-500', 'to-indigo-600', 'to-indigo-700', 'to-indigo-900',
    'via-purple-500',
    'bg-purple-50', 'bg-purple-100', 'bg-purple-500', 'bg-purple-600', 'bg-purple-900',
    'bg-indigo-50', 'bg-indigo-500', 'bg-indigo-600',
    'text-purple-600', 'text-purple-700', 'text-purple-400', 'text-purple-300',
    'text-indigo-600', 'text-indigo-400',
    'border-purple-200', 'border-purple-500', 'border-indigo-200',
    'ring-purple-500', 'ring-indigo-500',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
      boxShadow: {
        brand: '0 10px 40px -10px rgba(15, 23, 42, 0.5)',
        'brand-lg': '0 20px 50px -15px rgba(15, 23, 42, 0.55)',
        'glow-accent': '0 0 20px -2px rgba(14, 165, 233, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        teko: ['Teko', 'sans-serif'],
      },
      colors: {
        // ============================================
        // ACTION BLUE - Primary Action Color System
        // ============================================
        'action-blue': {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB', // PRIMARY ACTION COLOR
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },

        // Medical "Clinical" Palette
        'clinical-navy': '#0F172A', // Deep Royal Navy for dark mode backgrounds
        'clinical-white': '#F8FAFC', // Sanitarium White for light mode
        'clinical-blue': '#0284C7', // Cerulean Blue for primary actions
        // Circadian theme: slate-950 for night shift (Medical/Night Shift vibe)
        'slate-950': '#020617',
        // Semantic colors for clinical clarity
        'clinical-pearl': '#F59E0B', // Amber/Gold - key takeaways, pearls
        critical: '#F43F5E', // Rose - urgent, critical findings
        stable: '#10B981', // Emerald - stable, reassuring
        'clinical-slate': {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },

        // ============================================
        // MUTED SEMANTIC PALETTE - Professional Tones
        // ============================================

        // Sage - Toolkit Hub (calming, medical green)
        sage: {
          50: '#F6F7F5',
          100: '#E8EBE5',
          200: '#D4DAD0',
          300: '#B5C0AD',
          400: '#96A78A',
          500: '#7A8F6E',
          600: '#627358',
          700: '#4D5A46',
          800: '#404A3B',
          900: '#363E33',
        },

        // Slate-Teal - Command Center (professional, trustworthy)
        'slate-teal': {
          50: '#F4F7F7',
          100: '#E4EBEB',
          200: '#CCDADA',
          300: '#A8C1C1',
          400: '#7DA3A3',
          500: '#5E8686',
          600: '#4D6E6E',
          700: '#425B5B',
          800: '#394D4D',
          900: '#324242',
        },

        // Dusty Rose - Visual Diagnostics (warm, approachable)
        'dusty-rose': {
          50: '#FAF7F7',
          100: '#F3EBEB',
          200: '#E8D9D9',
          300: '#D6BFBF',
          400: '#C09E9E',
          500: '#A67F7F',
          600: '#8C6666',
          700: '#745353',
          800: '#614747',
          900: '#533E3E',
        },

        // Steel Blue - Question Practice (focused, clinical)
        'steel-blue': {
          50: '#F5F7F9',
          100: '#E8ECF1',
          200: '#D5DCE5',
          300: '#B6C4D4',
          400: '#91A6BD',
          500: '#728BA6',
          600: '#5D738D',
          700: '#4E5F74',
          800: '#444F60',
          900: '#3B4452',
        },

        // Muted Amber - Specialty Drills (warm, engaging)
        'muted-amber': {
          50: '#FAF9F5',
          100: '#F3F0E5',
          200: '#E8E1CD',
          300: '#D8CCAD',
          400: '#C5B38A',
          500: '#B39B6C',
          600: '#9C835A',
          700: '#816B4B',
          800: '#6B5840',
          900: '#5A4A38',
        },

        // Deep Plum - Clinical Simulation (sophisticated, medical)
        'deep-plum': {
          50: '#F9F7F9',
          100: '#F1ECF1',
          200: '#E4DCE4',
          300: '#D0C2D0',
          400: '#B6A0B6',
          500: '#9A7F9A',
          600: '#806680',
          700: '#6A556A',
          800: '#594859',
          900: '#4C3E4C',
        },

        // ============================================
        // STORMY SLATE - Design System Tokens
        // ============================================
        surface: {
          primary: '#0f172a', // Slate 900 (Deep Navy)
          'primary-night': '#020617', // Slate 950 - Medical/Night Shift
          secondary: '#1e293b', // Slate 800
          glass: 'rgba(30, 41, 59, 0.5)', // Slate 800 @ 50%
          elevated: 'rgba(51, 65, 85, 0.6)', // Slate 700 @ 60%
          card: 'var(--color-surface-card)',
        },
        action: {
          primary: 'var(--color-action-primary)', // Accent (gold) for CTAs, icons
          secondary: 'var(--color-action-secondary)', // theme-aware secondary text
          'primary-hover': 'var(--color-action-primary-hover)',
          'secondary-hover': 'var(--color-action-secondary)',
        },
        data: {
          pass: '#0a766c', // Teal 700 - success/passing (improved contrast for light mode)
          fail: '#ef4444', // Red 500 - failure/errors
          provisional: '#f59e0b', // Amber 500 - building/uncertain
          warning: '#f97316', // Orange 500 - warning/caution (distinct from provisional)
          neutral: 'var(--color-data-neutral)', // Theme-aware: light #64748b, dark #94a3b8
          'neutral-bg': 'var(--color-data-neutral-bg)', // Theme-aware: light #f1f5f9, dark #334155
        },

        // Semantic Design System
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        // Legacy theme-aware colors (for backward compatibility)
        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'gold-dark': 'var(--color-gold-dark)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.exam-mode': {
          '--color-bg-primary': '#ffffff',
          '--color-bg-secondary': '#f8fafc',
          '--color-bg-tertiary': '#f1f5f9',
          '--color-text-primary': '#0f172a',
          '--color-text-secondary': '#334155',
          '--color-text-muted': '#64748b',
          '--color-border': '#e2e8f0',
          '--color-accent': 'var(--color-gold-dark)', // Updated to match new darker gold
          '--color-accent-hover': 'var(--color-gold-dark-hover)',
          filter: 'grayscale(100%) contrast(1.12)',
          colorScheme: 'light',
        },
        '.eor-accent': {
          '--color-accent': 'var(--color-gold-dark)',
          '--color-accent-hover': 'var(--color-gold-dark-hover)',
        },
      });
    },
  ],
};
