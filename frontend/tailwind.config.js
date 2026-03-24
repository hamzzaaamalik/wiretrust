/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          light: '#A78BFA',
          dark: '#5B21B6',
          50: '#F5F3FF',
        },
        secondary: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
        },
        accent: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
        },
        dark: {
          bg: '#09090B',
          surface: '#0F0F13',
          surface2: '#18181B',
          surface3: '#27272A',
          border: '#27272A',
          hover: '#3F3F46',
        },
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'fade-in-down': 'fadeInDown 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'score-up': 'scoreUp 0.6s ease-out',
        'score-down': 'scoreDown 0.6s ease-out',
        'toast-in': 'toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-out': 'toastOut 0.3s ease-in forwards',
        'float': 'float 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'spin-slow': 'spin 3s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'counter': 'counter 0.4s ease-out',
        'scroll-x': 'scrollX 25s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(124, 58, 237, 0.15)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scoreUp: {
          '0%': { transform: 'translateY(0)', opacity: '1', color: '#10B981' },
          '100%': { transform: 'translateY(-20px)', opacity: '0' },
        },
        scoreDown: {
          '0%': { transform: 'translateY(0)', opacity: '1', color: '#EF4444' },
          '100%': { transform: 'translateY(20px)', opacity: '0' },
        },
        toastIn: {
          '0%': { transform: 'translateX(100%) scale(0.95)', opacity: '0' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        toastOut: {
          '0%': { transform: 'translateX(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateX(100%) scale(0.95)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        counter: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scrollX: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(124, 58, 237, 0.15)',
        'glow-primary': '0 0 24px rgba(124, 58, 237, 0.2), 0 0 48px rgba(124, 58, 237, 0.05)',
        'glow-success': '0 0 24px rgba(16, 185, 129, 0.2), 0 0 48px rgba(16, 185, 129, 0.05)',
        'glow-error': '0 0 24px rgba(239, 68, 68, 0.2), 0 0 48px rgba(239, 68, 68, 0.05)',
        'glow-accent': '0 0 24px rgba(245, 158, 11, 0.2), 0 0 48px rgba(245, 158, 11, 0.05)',
        'elevated': '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
        'card': '0 2px 8px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.05) inset',
        'card-hover': '0 8px 24px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.08) inset',
        'float': '0 16px 48px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1) inset',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
