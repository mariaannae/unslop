// textStyles.js - Centralized configuration for all text styles based on device and mode

import { DEVICE_TYPES, detectDeviceType } from './dimensions.js';
import { BASIC_COLORS_HEX, BASIC_COLORS_TEXT, COLORS_HEX, COLORS_TEXT, DESIGN } from './design.js';

// Device-aware font size clamp ranges
const CLAMP_RANGES = {
    [DEVICE_TYPES.DESKTOP]: {
        title: { min: 40, max: 100 },
        menuTitle: { min: 40, max: 80 },
        prompt: { min: 14, max: 20 },
        input: { min: 14, max: 20 },
        output: { min: 14, max: 20 },
        tooltip: { min: 14, max: 18 },
        effect: { min: 14, max: 28 },
        timer: { min: 21, max: 42 },  // 1.5x effect
        button: { min: 14, max: 20 },
        fancyButton: { min: 16, max: 20 },
        transitionText: { min: 30, max: 50 },
        settings: { min: 12, max: 20 }
    },
    [DEVICE_TYPES.TABLET]: {
        title: { min: 35, max: 120 },
        menuTitle: { min: 40, max: 75 },
        prompt: { min: 16, max: 28 },
        input: { min: 16, max: 28 },
        output: { min: 16, max: 28 },
        tooltip: { min: 14, max: 20 },
        effect: { min: 18, max: 32 },
        timer: { min: 27, max: 48 },  // 1.5x effect
        button: { min: 16, max: 28 },
        fancyButton: { min: 16, max: 28 },
        transitionText: { min: 24, max: 48 },
        settings: { min: 14, max: 28 },
    },
    [DEVICE_TYPES.PHONE]: {
        title: { min: 50, max: 300 },
        menuTitle: { min: 30, max: 120 },
        prompt: { min: 24, max: 40 },
        input: { min: 24, max: 40 },
        output: { min: 24, max: 40 },
        tooltip: { min: 20, max: 40 },
        effect: { min: 26, max: 48 },
        timer: { min: 39, max: 72 },  // 1.5x effect
        button: { min: 26, max: 44 },
        fancyButton: { min: 20, max: 36 },
        transitionText: { min: 36, max: 60 },
        settings: { min: 22, max: 28 },
    }
};

// Base font sizes for each device type
const BASE_FONT_SIZES = {
    [DEVICE_TYPES.DESKTOP]: {
        title: 70,
        menuTitle: 50,
        prompt: 20,
        input: 20,
        output: 20,
        tooltip: 16,
        effect: 20,
        timer: 50,  
        button: 20,
        fancyButton: 18,
        transitionText: 24,
        settings: 18,
    },
    [DEVICE_TYPES.TABLET]: {
        title: 50,
        menuTitle: 55,
        prompt: 18,
        input: 18,
        output: 18,
        tooltip: 16,
        effect: 20,
        timer: 50,  // 1.5x effect
        button: 18,
        fancyButton: 18,
        transitionText: 28,
        settings: 16
    },
    [DEVICE_TYPES.PHONE]: {
        title: 200,
        menuTitle: 70,
        prompt: 32,
        input: 32,
        output: 32,
        tooltip: 18,
        effect: 36,
        timer: 70,  // 1.5x effect
        button: 26,
        fancyButton: 24,
        transitionText: 36,
        settings: 26
    }
};

/**
 * Clamp a value between min and max
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Get text style for specific text type and device type
 * @param {string} textType - Type of text (title, input, output, prompt, tooltip, effect)
 * @param {string} deviceType - Device type (desktop, tablet, phone)
 * @param {string} mode - Game mode (deprecated, kept for backwards compatibility)
 * @param {number} uiScale - UI scaling factor (default: 1)
 * @returns {object} Text style object
 */
export function getTextStyle(textType, deviceType = null, mode = null, uiScale = 1) {
    // If device type not provided, detect it
    if (!deviceType) {
        deviceType = detectDeviceType();
    }

    // Always use game colors (mode parameter deprecated but kept for backwards compatibility)
    const TEXT_COLORS = COLORS_TEXT;

    // Get base font size for device and text type
    const baseFontSize = BASE_FONT_SIZES[deviceType][textType] || 
                         BASE_FONT_SIZES[DEVICE_TYPES.DESKTOP][textType];
    
    // Scale font size based on UI scale
    const scaledFontSize = baseFontSize * uiScale;
    
    // Get clamp range for current device and text type
    const clampRange = CLAMP_RANGES[deviceType]?.[textType] || 
                       CLAMP_RANGES[DEVICE_TYPES.DESKTOP]?.[textType] || 
                       { min: 12, max: 80 }; // Fallback range
    
    // Apply clamping to prevent extreme font sizes
    const fontSize = clamp(scaledFontSize, clampRange.min, clampRange.max);

    // Base styles for each text type
    const baseStyles = {
        title: {
            fontFamily: 'barcade3d',
            fontSize: `${fontSize}px`,
            color: TEXT_COLORS.TITLE || TEXT_COLORS.PRIMARY,
            shadow: {
                offsetX: 2 * uiScale,
                offsetY: 2 * uiScale,
                color: '#000',
                blur: 2 * uiScale,
                fill: true
            }
        },
        button: {
            fontFamily: 'VT323',
            fontSize: `${fontSize}px`,
            fontWeight: "700",
            color: TEXT_COLORS.PRIMARY,
            align: 'center',
            lineSpacing: 10 * uiScale
        },
        fancyButton: {
            fontFamily: 'VT323',
            fontSize: `${fontSize}px`,
            color: TEXT_COLORS.WHITE || '#ffffff',
            align: 'center'
        },
        menuTitle: {
            fontFamily: 'barcade3d',
            fontSize: `${fontSize}px`,
            color: TEXT_COLORS.TITLE || TEXT_COLORS.PRIMARY,
            shadow: {
                offsetX: 3 * uiScale,
                offsetY: 3 * uiScale,
                color: '#000',
                blur: 3 * uiScale,
                fill: true
            }
        },
        prompt: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            fill: TEXT_COLORS.PRIMARY,
            align: 'left',
            lineSpacing: 6 * uiScale
        },
        input: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            fill: TEXT_COLORS.BLACK,
            align: 'left',
            lineSpacing: 6 * uiScale
        },
        output: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            fill: TEXT_COLORS.PRIMARY,
            align: 'left',
            lineSpacing: 6 * uiScale
        },
        tooltip: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            color: '#ffffff',
            align: 'center'
        },
        effect: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            fontStyle: 'bold',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        },
        timer: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            fontStyle: 'bold',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        },
        settings: {
            fontFamily: 'IBM Plex Mono',
            fontSize: `${fontSize}px`,
            fill: '#ffffff',
            align: 'left'
        },
        transitionText: {
            fontFamily: 'VT323',
            fontSize: `${fontSize}px`,
            color: TEXT_COLORS.PRIMARY,
            align: 'center',
            shadow: {
                offsetX: 2 * uiScale,
                offsetY: 2 * uiScale,
                color: '#000',
                blur: 4 * uiScale,
                stroke: true,
                fill: true
            }
        }
    };

    // Add game-specific styling (formerly hard mode)
    if (textType === 'prompt') {
        baseStyles.prompt.shadow = {
            offsetX: 1 * uiScale,
            offsetY: 1 * uiScale,
            color: '#000',
            blur: 2 * uiScale,
            fill: true
        };
    }

    if (textType === 'input') {
        baseStyles.input.shadow = {
            offsetX: 0,
            offsetY: 1 * uiScale,
            color: '#fff',
            blur: 0,
            fill: true
        };
    }

    return baseStyles[textType] || baseStyles.prompt;
}

/**
 * Get box style for specific box type
 * @param {string} boxType - Type of box (prompt, input, output)
 * @param {string} mode - Game mode (deprecated, kept for backwards compatibility)
 * @param {number} uiScale - UI scaling factor (default: 1)
 * @returns {object} Box style object
 */
export function getBoxStyle(boxType, mode = null, uiScale = 1) {
    // Default styles based on UI configuration
    const outline = DESIGN.UI.OUTLINE;
    
    // Always use game colors (mode parameter deprecated but kept for backwards compatibility)
    const GAME_COLORS = COLORS_HEX;
    
    // Base styles for each box type
    const baseStyles = {
        prompt: {
            fillColor: GAME_COLORS.BOX_FILL || GAME_COLORS.BACKGROUND || 0x000000,
            fillAlpha: 0.8,
            hasOutline: true,
            outlineWidth: outline.WIDTH,
            outlineColor: GAME_COLORS.BOX_OUTLINE || GAME_COLORS.ACCENT || 0xffffff,
            cornerRadius: outline.CORNER_RADIUS
        },
        input: {
            fillColor: 0xFFFFFF,
            fillAlpha: 0.85,
            hasOutline: true,
            outlineWidth: outline.WIDTH,
            outlineColor: GAME_COLORS.ACCENT || 0x00ff00,
            cornerRadius: outline.CORNER_RADIUS
        },
        output: {
            fillColor: GAME_COLORS.BOX_FILL || GAME_COLORS.BACKGROUND || 0x000000,
            fillAlpha: 0.8,
            hasOutline: true,
            outlineWidth: outline.WIDTH,
            outlineColor: GAME_COLORS.BOX_OUTLINE || GAME_COLORS.ACCENT || 0xffffff,
            cornerRadius: outline.CORNER_RADIUS
        }
    };
    
    return baseStyles[boxType] || baseStyles.prompt;
}

/**
 * Get autocomplete text style
 * @param {string} deviceType - Device type (desktop, tablet, phone)
 * @param {string} mode - Game mode (deprecated, kept for backwards compatibility)
 * @param {number} uiScale - UI scaling factor (default: 1)
 * @param {number} boxWidth - Width of containing box
 * @returns {object} Autocomplete text style
 */
export function getAutocompleteTextStyle(deviceType = null, mode = null, uiScale = 1, boxWidth = 0) {
    // If device type not provided, detect it
    if (!deviceType) {
        deviceType = detectDeviceType();
    }
    
    // Base font sizes for each device type
    const BASE_FONT_SIZES = {
        [DEVICE_TYPES.DESKTOP]: 14,
        [DEVICE_TYPES.TABLET]: 18,
        [DEVICE_TYPES.PHONE]: 24
    };
    
    // Clamp ranges for autocomplete text
    const AUTOCOMPLETE_CLAMP_RANGES = {
        [DEVICE_TYPES.DESKTOP]: { min: 12, max: 20 },
        [DEVICE_TYPES.TABLET]: { min: 14, max: 24 },
        [DEVICE_TYPES.PHONE]: { min: 18, max: 32 }
    };
    
    const baseFontSize = BASE_FONT_SIZES[deviceType] || BASE_FONT_SIZES[DEVICE_TYPES.DESKTOP];
    const scaledFontSize = baseFontSize * uiScale;
    
    // Get clamp range and apply clamping
    const clampRange = AUTOCOMPLETE_CLAMP_RANGES[deviceType] || AUTOCOMPLETE_CLAMP_RANGES[DEVICE_TYPES.DESKTOP];
    const fontSize = clamp(scaledFontSize, clampRange.min, clampRange.max);
    
    // Calculate word wrap width if box width is provided
    const wordWrapConfig = boxWidth > 0 ? { width: (boxWidth - 60) * uiScale } : null;
    
    return {
        fontFamily: "IBM Plex Mono",
        fontSize: `${fontSize}px`,
        fill: "#ff0000",
        align: "left",
        alpha: 0.7,
        wordWrap: wordWrapConfig
    };
}

/**
 * Get menu bar style
 * @param {string} mode - Game mode (deprecated, kept for backwards compatibility)
 * @param {number} uiScale - UI scaling factor (default: 1)
 * @returns {object} Menu bar style
 */
export function getMenuBarStyle(mode = null, uiScale = 1) {
    // Always use game colors (mode parameter deprecated but kept for backwards compatibility)
    const GAME_COLORS_HEX = COLORS_HEX;
    const GAME_COLORS_TEXT = COLORS_TEXT;
    
    // Get device type for responsive title size
    const deviceType = detectDeviceType();
    
    // Use the menuTitle font sizes from BASE_FONT_SIZES instead of defining separately
    const baseTitleFontSize = BASE_FONT_SIZES[deviceType]?.menuTitle || BASE_FONT_SIZES[DEVICE_TYPES.DESKTOP]?.menuTitle;
    const scaledTitleFontSize = baseTitleFontSize * uiScale;
    
    // Apply clamping to title font size using the menuTitle clamp ranges
    const titleClampRange = CLAMP_RANGES[deviceType]?.menuTitle || 
                           CLAMP_RANGES[DEVICE_TYPES.DESKTOP]?.menuTitle || 
                           { min: 28, max: 80 };
    const titleFontSize = clamp(scaledTitleFontSize, titleClampRange.min, titleClampRange.max);
    
    return {
        backgroundColor: GAME_COLORS_HEX.BACKGROUND || 0x000000,
        borderColor: GAME_COLORS_HEX.BOX_OUTLINE || GAME_COLORS_HEX.ACCENT || 0xffffff,
        borderWidth: DESIGN.UI.OUTLINE.WIDTH * uiScale,
        titleStyle: {
            fontFamily: 'barcade3d',
            fontSize: `${titleFontSize}px`,
            color: GAME_COLORS_TEXT.TITLE || GAME_COLORS_TEXT.PRIMARY || '#ffffff',
            shadow: {
                offsetX: 3 * uiScale,
                offsetY: 3 * uiScale,
                color: '#000',
                blur: 3 * uiScale,
                fill: true
            }
        }
    };
}
