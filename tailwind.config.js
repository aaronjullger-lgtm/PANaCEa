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
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Medical "Clinical" Palette
        'clinical-navy': '#0F172A', // Deep Royal Navy for dark mode backgrounds
        'clinical-white': '#F8FAFC', // Sanitarium White for light mode
        'clinical-blue': '#0284C7', // Cerulean Blue for primary actions
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
          secondary: '#1e293b', // Slate 800
          glass: 'rgba(30, 41, 59, 0.5)', // Slate 800 @ 50%
          elevated: 'rgba(51, 65, 85, 0.6)', // Slate 700 @ 60%
        },
        action: {
          primary: '#f8fafc', // Slate 50 (White - high contrast CTA)
          secondary: '#334155', // Slate 700
          'primary-hover': '#e2e8f0', // Slate 200
          'secondary-hover': '#475569', // Slate 600
        },
        data: {
          pass: '#14b8a6', // Teal 500 - success/passing
          fail: '#ef4444', // Red 500 - failure/errors
          provisional: '#f59e0b', // Amber 500 - building/uncertain
          neutral: '#64748b', // Slate 500 - baseline
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
      },
    },
  },
  plugins: [],
};
