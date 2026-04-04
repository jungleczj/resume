import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Legacy brand alias (keep for existing code)
        brand: {
          DEFAULT: '#4F46E5',
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA'
        },
        achievement: {
          tier1: '#16A34A',
          tier2: '#CA8A04',
          tier3: '#DC2626'
        },
        // Material Design 3 color tokens (matches Stitch design system)
        'primary': '#3525cd',
        'primary-container': '#4f46e5',
        'on-primary': '#ffffff',
        'on-primary-container': '#dad7ff',
        'primary-fixed': '#e2dfff',
        'primary-fixed-dim': '#c3c0ff',
        'on-primary-fixed': '#0f0069',
        'on-primary-fixed-variant': '#3323cc',
        'secondary': '#58579b',
        'secondary-container': '#b6b4ff',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#454386',
        'secondary-fixed': '#e2dfff',
        'secondary-fixed-dim': '#c3c0ff',
        'on-secondary-fixed': '#140f54',
        'on-secondary-fixed-variant': '#413f82',
        'tertiary': '#7e3000',
        'tertiary-container': '#a44100',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#ffd2be',
        'tertiary-fixed': '#ffdbcc',
        'tertiary-fixed-dim': '#ffb695',
        'on-tertiary-fixed': '#351000',
        'on-tertiary-fixed-variant': '#7b2f00',
        'surface': '#fcf8ff',
        'surface-dim': '#dcd8e5',
        'surface-bright': '#fcf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f5f2ff',
        'surface-container': '#f0ecf9',
        'surface-container-high': '#eae6f4',
        'surface-container-highest': '#e4e1ee',
        'surface-variant': '#e4e1ee',
        'surface-tint': '#4d44e3',
        'on-surface': '#1b1b24',
        'on-surface-variant': '#464555',
        'background': '#fcf8ff',
        'on-background': '#1b1b24',
        'outline': '#777587',
        'outline-variant': '#c7c4d8',
        'inverse-surface': '#302f39',
        'inverse-on-surface': '#f3effc',
        'inverse-primary': '#c3c0ff',
        'error': '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      }
    }
  },
  plugins: []
}

export default config
