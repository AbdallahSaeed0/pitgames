export const theme = {

  background: {

    primary: '#040506',

    secondary: '#090b0d',

    elevated: '#101318',

    translucent: 'rgba(9, 11, 13, 0.72)',

  },

  text: {

    primary: '#ffffff',

    secondary: '#a0a0a0',

    muted: '#626d7a',

  },

  accent: {

    primary: '#174a43',

    hover: '#2a7d72',

    active: '#0f342f',

    gradient: 'linear-gradient(165deg, #3d9a8c 0%, #174a43 48%, #0c2a26 100%)',

    onFill: '#ecfdf8',

  },

  surface: {

    card: '#0a0c0e',

    hover: '#12151a',

    border: '#1a1e24',

    glass: 'rgba(20, 24, 31, 0.65)',

  },

  status: {

    success: '#10b981',

    warning: '#f59e0b',

    error: '#ef4444',

  },

  typography: {

    hero: { size: '64px', weight: 800, lineHeight: 1.1 },

    h1: { size: '36px', weight: 700, lineHeight: 1.2 },

    h2: { size: '28px', weight: 700, lineHeight: 1.3 },

    h3: { size: '20px', weight: 600, lineHeight: 1.4 },

    body: { size: '15px', weight: 400, lineHeight: 1.6 },

    small: { size: '13px', weight: 500, lineHeight: 1.5 },

  },

  spacing: {

    xs: '4px',

    sm: '8px',

    md: '16px',

    lg: '24px',

    xl: '32px',

    xxl: '64px',

  },

  borderRadius: {

    sm: '4px',

    md: '8px',

    lg: '12px',

    xl: '20px',

  },

  shadows: {

    low: '0 4px 12px rgba(0,0,0,0.3)',

    medium: '0 8px 24px rgba(0,0,0,0.5)',

    high: '0 16px 48px rgba(0,0,0,0.7)',

    accentGlow: '0 0 24px rgba(23, 74, 67, 0.4)',

  },

} as const;



export type Theme = typeof theme;

export default theme;

