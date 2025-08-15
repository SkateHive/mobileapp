export const theme = {
  colors: {
    primary: '#32CD32',        // bright green
    secondary: '#666666',      // gray used for secondary text and icons
    background: '#000000',     // always black background
    text: '#32CD32',          // bright green text as main color
    card: '#000000',          // black cards
    secondaryCard: '#1a1a1a',  // slightly lighter black for secondary cards
    border: '#333333',        // dark border colors
    muted: '#999999',         // muted text color
    danger: '#FF3B30',        // red for errors
    disabled: '#B0B0B0',      // disabled state
    green: '#32CD32',         // explicit bright green
    lightGreen: '#90EE90',    // light green variant
    gray: '#666666',          // gray text
    lightGray: '#333333',     // dark gray for light backgrounds
    white: '#FFFFFF',         // white
    black: '#000000',         // black
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    xxxl: 64,
  },
  fontSizes: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  borderRadius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    full: 999,
  },
  fonts: {
    regular: 'FiraCode-Regular',
    bold: 'FiraCode-Bold',
    default: 'FiraCode-Regular', // Default font for all text
  },
  elevation: {
    none: 'none',
    sm: '0px 1px 2px rgba(0,0,0,0.05)',
    md: '0px 4px 8px rgba(0,0,0,0.1)',
    lg: '0px 8px 16px rgba(0,0,0,0.15)',
  },
  breakpoints: {
    mobile: 450,
    tablet: 850,
  },
};

export type Theme = typeof theme;
