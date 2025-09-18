// 2025 Modern Design System for Hsinchu Pass Guardian

export const theme = {
  // Modern Color Palette with Gradients
  colors: {
    // Primary colors with gradient support
    primary: '#6366F1', // Modern indigo
    primaryDark: '#4F46E5',
    primaryLight: '#818CF8',
    primaryGradient: ['#6366F1', '#8B5CF6'], // Indigo to purple

    // Secondary colors
    secondary: '#EC4899', // Modern pink
    secondaryDark: '#DB2777',
    secondaryLight: '#F472B6',

    // Accent colors for different features
    accent: {
      blue: '#3B82F6',
      cyan: '#06B6D4',
      teal: '#14B8A6',
      emerald: '#10B981',
      green: '#22C55E',
      lime: '#84CC16',
      yellow: '#EAB308',
      orange: '#F97316',
      red: '#EF4444',
      pink: '#EC4899',
      purple: '#A855F7',
      indigo: '#6366F1',
    },

    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',

    // Neutral colors
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#F9FAFB',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
    },

    // Glass morphism colors
    glass: {
      white: 'rgba(255, 255, 255, 0.7)',
      light: 'rgba(255, 255, 255, 0.9)',
      dark: 'rgba(0, 0, 0, 0.3)',
    },

    // Border colors
    border: {
      light: '#E5E7EB',
      default: '#D1D5DB',
      dark: '#9CA3AF',
    },
  },

  // Modern Typography
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 17,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
    },
    fontWeight: {
      regular: '400' as '400',
      medium: '500' as '500',
      semibold: '600' as '600',
      bold: '700' as '700',
      black: '800' as '800',
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },

  // Spacing system (8px base)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
    '4xl': 96,
  },

  // Border radius
  borderRadius: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    full: 999,
  },

  // Shadows for depth
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    '2xl': {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 16,
    },
  },

  // Animation durations
  animation: {
    duration: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500,
      slower: 700,
    },
    easing: {
      ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
  },

  // Breakpoints for responsive design
  breakpoints: {
    sm: 360,
    md: 414,
    lg: 768,
    xl: 1024,
  },

  // Z-index layers
  zIndex: {
    hide: -1,
    base: 0,
    elevated: 1,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1200,
    modal: 1300,
    popover: 1400,
    toast: 1500,
    tooltip: 1600,
  },
};

// Helper functions for consistent styling
export const createShadow = (elevation: number) => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: elevation * 0.5 },
  shadowOpacity: 0.05 + elevation * 0.01,
  shadowRadius: elevation * 1.5,
  elevation,
});

export const createGradient = (colors: string[]) => ({
  colors,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
});

export const glassMorphism = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
  },
  dark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
};

export default theme;