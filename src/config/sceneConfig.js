// sceneConfig.js - Centralized configuration constants for all scenes
// Extracted from BaseGameScene to make these values accessible throughout the app

/**
 * Configuration constants for all scenes
 * All magic numbers and hardcoded values are centralized here
 */
export const SCENE_CONFIG = {
    // Padding values
    PADDING: {
        STANDARD: 20,
        LARGE: 30,
        MOBILE: 10,
        INPUT_HORIZONTAL: 28,
        INPUT_VERTICAL_RATIO: 0.7,
        MOBILE_INPUT_VERTICAL_RATIO: 0.6,
        STATS_RIGHT_MARGIN: 30,
        MOBILE_STATS_RIGHT_MARGIN: 35
    },
    
    // Box dimensions
    BOX_DIMENSIONS: {
        STATS_HEIGHT: 130,
        INPUT_HEIGHT: 180,
        MOBILE_INPUT_HEIGHT: 340,
        PROMPT_MIN_HEIGHT: 60,
        PROMPT_MAX_HEIGHT_DESKTOP: 220,
        PROMPT_MAX_HEIGHT_MOBILE: 300,
        STATS_MAX_WIDTH_DESKTOP: 360,
        STATS_MAX_WIDTH_MOBILE: 600,
        SUGGESTION_HEIGHT: 30,
        SUGGESTION_SPACING: 10
    },
    
    // Animation durations (in milliseconds)
    ANIMATIONS: {
        FAST: 200,
        MEDIUM: 500,
        SLOW: 800,
        CURSOR_BLINK: 500,
        TYPING_TIMEOUT: 500,
        ERROR_MESSAGE_DURATION: 3000,
        CELEBRATION_DURATION: 1200,
        PARTICLE_DURATION_MIN: 600,
        PARTICLE_DURATION_MAX: 1000,
        CLOCK_FLASH_DURATION: 220,
        SHAKE_DURATION_DEFAULT: 250,
        SHAKE_DURATION_IOS: 400,
        MINI_SHAKE_DURATION: 40
    },
    
    // Timer configuration
    TIMER: {
        DEFAULT_VALUE: 20,
        UPDATE_INTERVAL: 1000 //ms
    },
    
    // Visual effects
    EFFECTS: {
        SHAKE_INTENSITY_DEFAULT: 0.02,
        SHAKE_INTENSITY_IOS: 0.04,
        MINI_SHAKE_INTENSITY: 0.005,
        FLASH_ALPHA_DEFAULT: 0.18,
        FLASH_ALPHA_MINI: 0.07,
        PARTICLE_COUNT: 90,
        PARTICLE_SPEED_MIN: 180,
        PARTICLE_SPEED_MAX: 340,
        PARTICLE_DISTANCE_MIN: 120,
        PARTICLE_DISTANCE_MAX: 260,
        PARTICLE_SIZE_MIN: 4,
        PARTICLE_SIZE_MAX: 10
    },
    
    // Offsets and gaps
    LAYOUT: {
        PROMPT_OFFSET_BELOW_STATS: 10,
        MOBILE_PROMPT_OFFSET_BELOW_STATS: 40,
        INPUT_OFFSET_BELOW_PROMPT: 60,
        MOBILE_INPUT_OFFSET_BELOW_PROMPT: 70,
        BUTTON_VERTICAL_GAP_DESKTOP: 50,
        BUTTON_VERTICAL_GAP_MOBILE: 40,
        BUTTON_HORIZONTAL_OFFSET_DESKTOP: 60,
        BUTTON_HORIZONTAL_OFFSET_MOBILE: 30,
        STATS_OFFSET_BELOW_MENU_DESKTOP: 50,
        STATS_OFFSET_BELOW_MENU_MOBILE: 60,
        MENU_BAR_HEIGHT_DESKTOP: 120,
        MENU_BAR_HEIGHT_MOBILE: 200,
        SETTINGS_ICON_SIZE_RATIO: 0.5,
        MOBILE_SETTINGS_ICON_SIZE_RATIO: 0.35
    },
    
    // Settings popup
    SETTINGS_POPUP: {
        WIDTH: 400,
        TITLE_HEIGHT: 44,
        MIN_GAP: 12,
        STANDARD_GAP: 30,  // Increased from 18
        MOBILE_GAP: 50,    // Reduced from 70 to make mobile settings menu shorter
        SLIDER_ROW_HEIGHT: 44,
        TOGGLE_ROW_HEIGHT: 44,
        BUTTON_ROW_HEIGHT: 54,
        BOTTOM_PADDING: 18,
        SLIDER_WIDTH: 150,
        SLIDER_HANDLE_WIDTH: 44,
        SLIDER_HANDLE_HEIGHT: 44,
        SLIDER_HANDLE_VISUAL_WIDTH_DESKTOP: 18,
        SLIDER_HANDLE_VISUAL_HEIGHT_DESKTOP: 14,
        SLIDER_HANDLE_VISUAL_WIDTH_MOBILE: 24,
        SLIDER_HANDLE_VISUAL_HEIGHT_MOBILE: 24,
        CLOSE_BUTTON_MIN_TOUCH_SIZE: 44
    },
    
    // Streak milestones
    STREAK_MILESTONES: [3, 5, 7, 10, 15, 20],
    
    // Debounce delays
    DEBOUNCE: {
        SUGGESTIONS: 250,
        MOBILE_CURSOR_UPDATE: 30,
        KEY_REPEAT_FILTER: 50
    },
    
    // Fast typing penalty
    FAST_TYPING: {
        DEFAULT_PENALTY_SECONDS: 3,
        DEFAULT_COOLDOWN_MS: 50,
        MODAL_WIDTH_RATIO: 0.8,
        MODAL_MAX_WIDTH: 500,
        MODAL_HEIGHT: 180,
        MODAL_TOP_Y_MOBILE: 120
    }
};

export default SCENE_CONFIG;
