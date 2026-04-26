import tailwindcssAnimate from 'tailwindcss-animate';

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
    'bg-data-success',
    'text-data-fail',
    'text-data-pass',
    'text-data-provisional',
    'text-data-neutral',
    'text-data-warning',
    'text-data-positive',
    'text-data-negative',
    // Opacity modifier variants for data colors (bg, border, text + /5..90)
    { pattern: /^bg-data-(fail|pass|provisional|warning|neutral|positive|negative|success)\/(5|10|15|20|25|30|40|50|60|70|80|90)$/ },
    { pattern: /^border-data-(fail|pass|provisional|warning|neutral|positive|negative)\/(5|10|15|20|25|30|40|50|60|70|80|90)$/ },
    { pattern: /^text-data-(fail|pass|provisional|warning|neutral|positive|negative)\/(5|10|15|20|25|30|40|50|60|70|80|90)$/ },
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
    'border-data-provisional',
    'border-data-warning',
    'border-data-positive',
    'border-data-negative',
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
    // Clinical semantic OKLCH color utilities
    'bg-clinical-semantic-normal', 'bg-clinical-semantic-warning', 'bg-clinical-semantic-critical', 'bg-clinical-semantic-info',
    'text-clinical-semantic-normal', 'text-clinical-semantic-warning', 'text-clinical-semantic-critical', 'text-clinical-semantic-info',
    'border-clinical-semantic-normal', 'border-clinical-semantic-warning', 'border-clinical-semantic-critical', 'border-clinical-semantic-info',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px -2px var(--glow-color, rgba(59, 130, 246, 0.15))' },
          '50%': { boxShadow: '0 0 28px -2px var(--glow-color, rgba(59, 130, 246, 0.25))' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        brand: '0 10px 40px -10px rgba(15, 23, 42, 0.5)',
        'brand-lg': '0 20px 50px -15px rgba(15, 23, 42, 0.55)',
        'glow-accent': '0 0 20px -2px rgba(14, 165, 233, 0.35)',
        // --- Cinematic shadow system (Linear/Stripe/Vercel inspired) ---
        'cinematic': '0 0 0 1px rgba(59, 130, 246, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.1)',
        'cinematic-hover': '0 0 0 1px rgba(59, 130, 246, 0.12), 0 16px 40px -8px rgba(0, 0, 0, 0.15)',
        'cinematic-dark': '0 0 0 1px rgba(59, 130, 246, 0.1), 0 8px 24px -4px rgba(0, 0, 0, 0.4)',
        'cinematic-dark-hover': '0 0 0 1px rgba(59, 130, 246, 0.18), 0 16px 40px -8px rgba(0, 0, 0, 0.5)',
        'glass': '0 4px 16px -2px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glass-dark': '0 4px 16px -2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'elevated': '0 1px 3px rgba(0, 0, 0, 0.04), 0 6px 16px -4px rgba(0, 0, 0, 0.08)',
        'elevated-dark': '0 1px 3px rgba(0, 0, 0, 0.2), 0 6px 16px -4px rgba(0, 0, 0, 0.3)',
        'inner-ring': 'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
        'stat-card': '0 0 0 1px rgba(0, 0, 0, 0.03), 0 2px 8px -2px rgba(0, 0, 0, 0.05)',
        'stat-card-hover': '0 0 0 1px rgba(59, 130, 246, 0.08), 0 8px 20px -4px rgba(0, 0, 0, 0.08)',
        'nav-rail': '1px 0 0 0 var(--color-border), 4px 0 12px -2px rgba(0, 0, 0, 0.03)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        poppins: ['Poppins', 'sans-serif'],
        teko: ['Teko', 'sans-serif'],
      },
      // --- Premium typography scale (Apple/Stripe/Linear inspired) ---
      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1.05', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display': ['3rem', { lineHeight: '1.08', letterSpacing: '-0.035em', fontWeight: '700' }],
        'display-sm': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.025em', fontWeight: '700' }],
        'h1': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'h2': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        'h3': ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.6', letterSpacing: '-0.005em' }],
        'body': ['0.9375rem', { lineHeight: '1.55', letterSpacing: '0' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0.005em' }],
        'caption': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.03em' }],
        'overline': ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.1em', fontWeight: '600' }],
        'label': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.06em', fontWeight: '500' }],
      },
      letterSpacing: {
        'display': '-0.03em',
        'heading': '-0.02em',
        'snug': '-0.01em',
        'label': '0.05em',
        'overline': '0.08em',
      },
      // --- Premium transition system ---
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-subtle': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '350': '350ms',
      },
      backdropBlur: {
        'xs': '2px',
        'premium': '20px',
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
          // Semantic aliases used across components
          positive: '#0a766c', // Alias for pass
          negative: '#ef4444', // Alias for fail
          success: '#0a766c', // Alias for pass
        },

        // ============================================
        // CLINICAL SEMANTIC COLORS (OKLCH)
        // Medical traffic-light conventions for clinical UI.
        // These supplement (not replace) the existing data-pass/fail/provisional tokens.
        // - clinical-semantic-normal  → green  (correct, mastered, safe)
        // - clinical-semantic-warning → amber  (borderline, needs review)
        // - clinical-semantic-critical→ red    (incorrect, failed, urgent)
        // - clinical-semantic-info    → blue   (neutral clinical data)
        // ============================================
        'clinical-semantic': {
          normal:   'oklch(0.72 0.19 142)',
          warning:  'oklch(0.80 0.16 84)',
          critical: 'oklch(0.63 0.26 29)',
          info:     'oklch(0.65 0.15 250)',
        },

        // Semantic Design System (shadcn/ui compatible)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        // PANaCEa semantic tokens. These map to CSS variables in index.css so
        // light and dark mode stay first-class without page-level overrides.
        'clinical-background': 'var(--color-background)',
        'clinical-surface': 'var(--color-surface)',
        'clinical-surface-elevated': 'var(--color-surface-elevated)',
        'clinical-border': 'var(--color-border)',
        'clinical-text-primary': 'var(--color-text-primary)',
        'clinical-text-secondary': 'var(--color-text-secondary)',
        'clinical-text-muted': 'var(--color-text-muted)',
        'clinical-accent': 'var(--color-accent)',
        'clinical-accent-hover': 'var(--color-accent-hover)',
        'clinical-success': 'var(--color-success)',
        'clinical-risk': 'var(--color-risk)',
        'clinical-danger': 'var(--color-danger)',

        // Legacy theme-aware colors (for backward compatibility)
        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'accent-hover': 'var(--color-accent-hover)',
        'gold-dark': 'var(--color-gold-dark)',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
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
