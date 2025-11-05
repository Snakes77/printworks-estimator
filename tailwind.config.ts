import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './server/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#274472',      // DMC Encore primary blue
          muted: '#1e3a5a',         // Darker shade
          light: '#3a5a7a',         // Lighter shade
          accent: '#81599f',        // DMC Encore purple/violet
          secondary: '#7EBEC5',    // DMC Encore teal accent
        }
      },
      fontFamily: {
        sans: [
          "'Futura PT'",
          'Helvetica',
          'Arial',
          'system-ui',
          '-apple-system',
          'sans-serif'
        ],
      },
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
