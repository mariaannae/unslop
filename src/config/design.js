// Design configuration file for game modes and UI elements

// Import and re-export SCENE_CONFIG for backward compatibility
export { SCENE_CONFIG } from './sceneConfig.js';

/**
 * Base color palette with semantic naming
 */
const PALETTE = {
  // Dark theme colors
  BACKGROUND: {
    DARKEST: 0x00060f,    // Almost black
    DARKER: 0x03062D,     // Dark purple
    DARK: 0x170548,       // Less dark purple
    MID: 0x3d0364,        // Mid purple
    // Cool purple colors for BASIC mode (based on 0x101551)
    PURPLE_DARKEST: 0x050720,    // Very dark saturated purple
    PURPLE_DARKER: 0x0a0f3a,     // Deep saturated purple
    PURPLE_DARK: 0x121754,       // Dark saturated purple
    PURPLE_MID: 0x1a1f6e,        // Mid saturated purple
    PURPLE_LIGHT: 0x222788,      // Lighter saturated purple
    // Game colors (formerly Hard mode)
    HARD_DARKEST: 0x0c0020,    // Very deep saturated blue-magenta
    HARD_DARKER: 0x1a0045,     // Deep saturated blue-magenta
    HARD_DARK: 0x280068,       // Dark saturated blue-magenta
    HARD_MID: 0x360088,        // Mid saturated electric blue-magenta
  },
  // Accent colors
  ACCENT: {
    MAGENTA: 0x7a0782,
    PINK: 0x9e0e77,
    PINK_RED: 0xb91255,
    RED: 0xd71a27,
    ORANGE_DARK: 0xf35a23,
    ORANGE_LIGHT: 0xf8ac3a,
  },
  // Special colors
  TEAL: {
    MAIN: 0x00e5ff,
    DARK: 0x00292a,
    GLOW: 0x00ffff,
  },
  COOL_PURPLE: {
    MAIN: 0x5a6bc4,       // Cool purple accent (based on your color)
    DARK: 0x101551,       // Your chosen cool purple
    GLOW: 0x7986d3,       // Light cool purple glow
    ACCENT: 0x3f4ba3,     // Medium cool purple accent
  },
  MAGENTA: {              // Keep for hard mode
    MAIN: 0xff00ff,
    DARK: 0x800080,
    GLOW: 0xff40ff,
  },
  // Highlight colors
  HIGHLIGHT: {
    YELLOW: 0xfbf056,
    GREEN_LIGHT: 0xdaff77,
    GREEN_YELLOW: 0xbfff95,
    GREEN: 0xb4ffae,
    GREEN_LIGHTER: 0xcdffda,
    GREEN_LIGHTEST: 0xebfff7,
    BRIGHT_GREEN: 0x00cc00, // More vibrant green for progress bar success
  },
  BLACK: 0x000000
};



/**
 * Utility function to convert hex color to CSS string
 * Added null check to prevent "Cannot read properties of undefined" error
 */
const hexToString = (hex) => {
  if (hex === undefined || hex === null) {
    console.warn('Undefined or null color value passed to hexToString');
    return '#000000'; // Default to black when color is undefined
  }
  return '#' + hex.toString(16).padStart(6, '0');
};

/**
 * Common UI element dimensions and properties
 */
const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const width = typeof window !== "undefined" ? window.screen.width : 0;
  const height = typeof window !== "undefined" ? window.screen.height : 0;
  return (
    /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/.test(ua) ||
    Math.min(width, height) < 800
  );
};

const UI = {
  BUTTON: {
    WIDTH: isMobileDevice() ? 100 : 115,
    HEIGHT: isMobileDevice() ? 35 : 25,
    SPACING: 40,
    OUTLINE_WIDTH: 3,
    CORNER_RADIUS: 10,
    BELOW_TEXTBOX_GAP: 30
  },
  INPUT: {
    HORIZONTAL_PADDING: 30,
    VERTICAL_PADDING: 20
  },
  TEXTBOX_FONT_SIZE: 20,
  MONO_FONT_SIZE: 20,
  OUTLINE: {
    WIDTH: 4,
    CORNER_RADIUS: 40
  },
  TOGGLE: {
    WIDTH: 40,
    HEIGHT: isMobileDevice() ? 20 : 12
  },
  PROGRESS_BAR: {
    INITIAL: 50,
    INCREMENT: 4,
    DECREMENT: 4,
    COLORS: {
      SUCCESS: 0x009972,//PALETTE.HIGHLIGHT.BRIGHT_GREEN,
      WARNING: PALETTE.HIGHLIGHT.YELLOW,
      DANGER: PALETTE.ACCENT.RED
    }
  }
};

/**
 * Basic mode color configuration (kept for backwards compatibility)
 */
const BASIC = {
  COLORS: {
    BACKGROUND: PALETTE.BACKGROUND.PURPLE_DARKEST,
    BACKGROUND_DARKEST: PALETTE.BACKGROUND.DARKEST,
    BACKGROUND_LESS_DARK: PALETTE.BACKGROUND.PURPLE_DARKER,
    BOX_OUTLINE: PALETTE.TEAL.GLOW,
    BOX_FILL: PALETTE.BACKGROUND.DARKEST,
    BACKGROUND_MID: PALETTE.BACKGROUND.PURPLE_MID,
    BACKGROUND_ALT: PALETTE.TEAL.DARK,
    ACCENT: PALETTE.ACCENT.PINK,
    HIGHLIGHT: PALETTE.HIGHLIGHT.GREEN_LIGHT,
    TEXT: PALETTE.HIGHLIGHT.GREEN_LIGHTEST,
    GREEN: PALETTE.HIGHLIGHT.GREEN,
    BLACK: PALETTE.BLACK,
    BUTTON: {
      FILL: PALETTE.ACCENT.PINK,
      OVERLAY: PALETTE.ACCENT.PINK_RED
    }
  },
  TEXT_COLORS: {
    PRIMARY: hexToString(PALETTE.HIGHLIGHT.GREEN_LIGHTEST),
    SECONDARY: hexToString(PALETTE.TEAL.MAIN),
    HIGHLIGHT: hexToString(PALETTE.HIGHLIGHT.YELLOW),
    ACCENT: hexToString(PALETTE.ACCENT.ORANGE_LIGHT),
    SUCCESS: hexToString(PALETTE.HIGHLIGHT.GREEN_YELLOW),
    ERROR: hexToString(PALETTE.ACCENT.RED),
    DARKEST: hexToString(PALETTE.BACKGROUND.DARKEST),
    BLACK: hexToString(PALETTE.BLACK)
  }
};

/**
 * Main game color configuration (formerly Hard mode - now the default)
 */
const GAME = {
  COLORS: {
    BACKGROUND: PALETTE.BACKGROUND.HARD_DARKEST,
    BACKGROUND_ALT: PALETTE.BACKGROUND.HARD_DARKER,
    BACKGROUND_MID: PALETTE.BACKGROUND.HARD_MID,
    BOX_OUTLINE: PALETTE.TEAL.MAIN,
    BOX_FILL: PALETTE.BACKGROUND.DARKEST, 
    ACCENT: PALETTE.ACCENT.MAGENTA,
    HIGHLIGHT: PALETTE.BACKGROUND.HARD_DARK,
    ERROR: PALETTE.ACCENT.RED,
    TEXT: PALETTE.HIGHLIGHT.GREEN_LIGHTEST,
    WARNING: PALETTE.ACCENT.ORANGE_LIGHT,
    BLACK: PALETTE.BLACK,
    BUTTON: {
      FILL: PALETTE.ACCENT.PINK,
      OVERLAY: PALETTE.ACCENT.PINK_RED
    },
    SLIDER: {
      HANDLE: PALETTE.ACCENT.ORANGE_LIGHT
    }
  },
  TEXT_COLORS: {
    PRIMARY: hexToString(PALETTE.HIGHLIGHT.GREEN_LIGHTEST),
    SECONDARY: hexToString(PALETTE.BACKGROUND.DARKEST),
    ACCENT: hexToString(PALETTE.ACCENT.PINK),
    HIGHLIGHT: hexToString(PALETTE.HIGHLIGHT.GREEN_LIGHT),
    ERROR: hexToString(PALETTE.ACCENT.RED),
    BACKGROUND: hexToString(PALETTE.BACKGROUND.DARKER),
    ERROR: hexToString(PALETTE.ACCENT.RED),
    TITLE: hexToString(PALETTE.HIGHLIGHT.YELLOW),
    BLACK: hexToString(PALETTE.BLACK)
  }
};


// Export consolidated design objects
export const DESIGN = {
  UI,
  BASIC: { ...UI, ...BASIC },
  GAME: { ...UI, ...GAME },
  COLORS: {
    CURSOR: hexToString(PALETTE.BACKGROUND.DARKEST),
    AUTOCOMPLETE: hexToString(PALETTE.ACCENT.RED),
    INPUT: hexToString(PALETTE.BACKGROUND.DARKEST)
  }
};

// Export individual constants for backward compatibility
export const {
  BUTTON: { WIDTH: buttonWidth, HEIGHT: buttonHeight, SPACING: buttonSpacing },
  OUTLINE: { WIDTH: OUTLINE_WIDTH, CORNER_RADIUS },
  BUTTON: { OUTLINE_WIDTH: BUTTON_OUTLINE_WIDTH, CORNER_RADIUS: BUTTON_CORNER_RADIUS },
  TOGGLE: { WIDTH: toggleWidth, HEIGHT: toggleHeight },
  PROGRESS_BAR
} = UI;

// Export color configurations for direct imports
export const {
  COLORS: BASIC_COLORS_HEX,
  TEXT_COLORS: BASIC_COLORS_TEXT
} = BASIC;

// Main game colors (formerly HARD)
export const {
  COLORS: COLORS_HEX,
  TEXT_COLORS: COLORS_TEXT
} = GAME;

// Legacy exports for backwards compatibility
export const HARD_COLORS_HEX = COLORS_HEX;
export const HARD_COLORS_TEXT = COLORS_TEXT;

/**
 * Game theme configuration
 */
export const THEME = {
  ...GAME,
  background: {
    effect: "electric",
    color: PALETTE.BACKGROUND.HARD_DARKEST,
    params: { lightningFrequency: 0.2 }
  }
};

// Legacy THEMES object for backwards compatibility
export const THEMES = {
  game: THEME,
  // Aliases for backwards compatibility
  hard: THEME
};
