/**
 * DMC Encore Brand Configuration
 * Extracted from dmc-encore.co.uk website
 */
export const BRAND_CONFIG = {
  name: 'DMC Encore',
  tagline: 'Direct mail, fulfilment and logistics specialists since 1986',
  shortTagline: 'Fast, accurate print estimating',
  
  colors: {
    primary: '#274472',      // Dark blue from website
    accent: '#81599f',       // Purple/violet from website
    secondary: '#7EBEC5',    // Accent color from website
    dark: '#274472',         // Primary dark
    light: '#f0f0f0',        // Light background
  },
  
  fonts: {
    primary: "'Futura PT', Helvetica, Arial, sans-serif",
    light: "'Futura PT Light', Helvetica, Arial, sans-serif",
    // Fallback to system fonts if Futura PT not loaded
    fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  
  logo: {
    url: 'https://dmc-encore.co.uk/wp-content/uploads/2022/01/dmc-colour-logo.png',
    alt: 'DMC Encore',
    width: 200,
    height: 109,
  },
  
  contact: {
    fulfilment: '01604 790060',
    directMail: '0116 507 7860',
  },
  
  metadata: {
    title: 'DMC Encore | Print Estimating',
    description: 'Fast, accurate quoting for commercial print in one place. Direct mail, fulfilment and logistics specialists.',
  },
};

