/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#12101A',
        surface: '#1E1B2E',
        'surface-2': '#272438',
        text: '#F2EFF8',
        'text-2': '#9B93B8',
        'text-3': '#5C5478',
        intimate: '#CF8EE8',
        active: '#7DD47A',
        playful: '#F07868',
        explore: '#6DB8F0',
        recharge: '#82C9A0',
        savor: '#F0A84A',
        support: '#E89AA8',
        accent: '#CF8EE8',
      },
      fontFamily: {
        display: ['"Bagel Fat One"', 'cursive'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        card:          '0 4px 24px rgba(0,0,0,0.3)',
        glow:          '0 0 40px rgba(207,142,232,0.15)',
        e1:            '0 2px 8px rgba(0,0,0,0.25)',
        e2:            '0 4px 24px rgba(0,0,0,0.3)',
        e3:            '0 12px 40px rgba(0,0,0,0.45)',
        'gloss-gum':   'inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -8px 14px rgba(0,0,0,0.28)',
        'gloss-button':'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -3px 8px rgba(0,0,0,0.18)',
        'glow-accent': '0 8px 32px rgba(207,142,232,0.35)',
      },
    },
  },
}
