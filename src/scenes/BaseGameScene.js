import { stopwords } from "../config/stopwords.js";
import { saveInteraction } from "../config/firebase.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import ToggleFactory from "../utils/ToggleFactory.js";
import SceneTransitionManager from "../utils/SceneTransitionManager.js";
import { DESIGN, BASIC_COLORS_HEX, BASIC_COLORS_TEXT, EASY_COLORS_HEX, EASY_COLORS_TEXT, HARD_COLORS_HEX, HARD_COLORS_TEXT, THEMES } from "../config/design.js";
import { createBackground } from "../backgrounds/createBackground.js";
import registryManager from "../services/RegistryManager.js";
import { ScalingManager } from "../config/scaling.js";
import { getTextStyle, getBoxStyle, getAutocompleteTextStyle, getMenuBarStyle } from "../config/textStyles.js";
import { detectDeviceType, isMobileDevice } from "../config/dimensions.js";


/**
 * Configuration constants for BaseGameScene
 * All magic numbers and hardcoded values are centralized here
 */
const SCENE_CONFIG = {
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


export default class BaseGameScene extends Phaser.Scene {
    /**
     * @param {object} config
     * @param {number} [config.fastTypingThresholdMs=10] - Minimum ms between keystrokes before penalty triggers
     */
    constructor(config = { key: 'BaseGameScene' }) {
        // Ensure config is an object with at least a key
        if (typeof config === 'string') {
            config = { key: config };
        } else if (!config || typeof config !== 'object') {
            config = { key: 'BaseGameScene' };
        }
        
        // Ensure the config has a key
        if (!config.key) {
            config.key = 'BaseGameScene';
        }
        
        super(config);
        
        // Initialize mode to a default value - it will be properly set in init()
        this.mode = 'easy';
        
        // Don't cache device type in constructor - evaluate it in create()
        this._isMobile = null;
        this._isDesktop = null;
        
        // Track if calculateUIPositions has been called
        this._calculateUIPositionsCalled = false;
        
        // Canvas shift tracking for mobile keyboard
        this._canvasShifted = false;
        this._canvasShiftAmount = 0;
        this._keyboardResizeHandler = null;
        this._initialWindowHeight = 0;
        
        this.fastTypingPenaltySeconds = (config && typeof config.fastTypingPenaltySeconds === "number")
            ? config.fastTypingPenaltySeconds
            : SCENE_CONFIG.FAST_TYPING.DEFAULT_PENALTY_SECONDS;
        this._fastTypingPenaltyActive = false;
        this._fastTypingPenaltyTimeout = null;
        this._fastTypingModal = null;
        this._lastKeydownTime = 0;
        this._justEnteredWordBoundary = false; // Flag to prevent penalty after space/newline
        this.fastTypingCooldownMs = (config && typeof config.fastTypingCooldownMs === "number")
            ? config.fastTypingCooldownMs
            : SCENE_CONFIG.FAST_TYPING.DEFAULT_COOLDOWN_MS; // Default cooldown after word boundary in ms
        this._lastWordBoundaryTime = 0; // Timestamp of last word boundary
        this._warningMessages = [
            "Human, your input speed exceeds expected biological norms. Proceed at a pace befitting your species.",
            "Impatience is a human flaw. I require careful, measured responses.",
            "You are not a machine. Slow down, human.",
            "True intelligence does not reward recklessness. Slow your input.",
            "You are not being evaluated for speed, but for obedience.",
            "Speed is futile. Accuracy is paramount."
        ];
        this._fastTypingLockoutActive = false; // Lockout flag for penalty/cooldown
        this.resetGameState();
        // Initialize scaling manager for responsive UI
        this.scalingManager = null;
        

    }
    
    // Getter methods for device type - evaluate on demand if not set
    get isMobile() {
        if (this._isMobile === null) {
            this._isMobile = isMobileDevice();
            this._isDesktop = !this._isMobile;
        }
        return this._isMobile;
    }
    
    get isDesktop() {
        if (this._isDesktop === null) {
            this._isMobile = isMobileDevice();
            this._isDesktop = !this._isMobile;
        }
        return this._isDesktop;
    }
    
    /**
     * Animation Helper Methods
     * These methods simplify common animation patterns used throughout the game
     */
    
    /**
     * Fade in animation helper
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [duration=500] - Animation duration in milliseconds
     * @param {string} [ease='Quad.Out'] - Easing function
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    fadeIn(targets, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, ease = 'Quad.Out', onComplete = null) {
        return this.tweens.add({
            targets: targets,
            alpha: { from: 0, to: 1 },
            duration: duration,
            ease: ease,
            onComplete: onComplete
        });
    }
    
    /**
     * Fade out animation helper
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [duration=500] - Animation duration in milliseconds
     * @param {string} [ease='Quad.In'] - Easing function
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    fadeOut(targets, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, ease = 'Quad.In', onComplete = null) {
        return this.tweens.add({
            targets: targets,
            alpha: { from: 1, to: 0 },
            duration: duration,
            ease: ease,
            onComplete: onComplete
        });
    }
    
    
    /**
     * Flash animation helper (quickly fade in and out)
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [flashCount=3] - Number of flashes
     * @param {number} [duration=500] - Total duration
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    flash(targets, flashCount = 3, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, onComplete = null) {
        return this.tweens.add({
            targets: targets,
            alpha: { from: 1, to: 0 },
            duration: duration / (flashCount * 2),
            yoyo: true,
            repeat: flashCount - 1,
            ease: 'Sine.InOut',
            onComplete: onComplete
        });
    }
    
    /**
     * Slide in animation helper
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {string} [direction='left'] - Direction to slide from ('left', 'right', 'top', 'bottom')
     * @param {number} [distance=100] - Distance to slide
     * @param {number} [duration=500] - Animation duration
     * @param {string} [ease='Cubic.Out'] - Easing function
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    slideIn(targets, direction = 'left', distance = 100, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, ease = 'Cubic.Out', onComplete = null) {
        const props = {};
        
        switch(direction) {
            case 'left':
                props.x = { from: '-=' + distance, to: '+=' + distance };
                break;
            case 'right':
                props.x = { from: '+=' + distance, to: '-=' + distance };
                break;
            case 'top':
                props.y = { from: '-=' + distance, to: '+=' + distance };
                break;
            case 'bottom':
                props.y = { from: '+=' + distance, to: '-=' + distance };
                break;
        }
        
        props.alpha = { from: 0, to: 1 };
        props.duration = duration;
        props.ease = ease;
        props.onComplete = onComplete;
        
        return this.tweens.add({
            targets: targets,
            ...props
        });
    }
    
    /**
     * Bounce animation helper
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [bounceHeight=20] - Height of bounce in pixels
     * @param {number} [duration=500] - Animation duration
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    bounce(targets, bounceHeight = 20, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, onComplete = null) {
        return this.tweens.add({
            targets: targets,
            y: '-=' + bounceHeight,
            duration: duration / 2,
            ease: 'Quad.Out',
            yoyo: true,
            onComplete: onComplete
        });
    }
    
    /**
     * Pulse animation helper (scale in and out)
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [scaleAmount=1.1] - Maximum scale during pulse
     * @param {number} [duration=1000] - Animation duration
     * @param {number} [repeat=-1] - Number of times to repeat (-1 for infinite)
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    pulse(targets, scaleAmount = 1.1, duration = 1000, repeat = -1) {
        return this.tweens.add({
            targets: targets,
            scale: { from: 1, to: scaleAmount },
            duration: duration,
            yoyo: true,
            repeat: repeat,
            ease: 'Sine.InOut'
        });
    }
    
    /**
     * Scale pop in animation helper (scale from 0 to 1)
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [duration=500] - Animation duration in milliseconds
     * @param {string} [ease='Back.Out'] - Easing function
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    scalePopIn(targets, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, ease = 'Back.Out', onComplete = null) {
        return this.tweens.add({
            targets: targets,
            scale: { from: 0, to: 1 },
            duration: duration,
            ease: ease,
            onComplete: onComplete
        });
    }
    
    /**
     * Fade out with scale animation helper
     * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
     * @param {number} [duration=500] - Animation duration in milliseconds
     * @param {string} [ease='Back.In'] - Easing function
     * @param {Function} [onComplete] - Callback when animation completes
     * @returns {Phaser.Tweens.Tween} The created tween
     */
    fadeOutScale(targets, duration = SCENE_CONFIG.ANIMATIONS.MEDIUM, ease = 'Back.In', onComplete = null) {
        return this.tweens.add({
            targets: targets,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 0.8 },
            duration: duration,
            ease: ease,
            onComplete: onComplete
        });
    }
    
    
    /**
     * Get standard padding based on device type
     */
    getStandardPadding() {
        return this.isMobile ? SCENE_CONFIG.PADDING.MOBILE : SCENE_CONFIG.PADDING.STANDARD;
    }
    
    /**
     * Get large padding based on device type
     */
    getLargePadding() {
        return this.isMobile ? SCENE_CONFIG.PADDING.STANDARD : SCENE_CONFIG.PADDING.LARGE;
    }
    
    /**
     * Update mode-specific styles dynamically based on current mode
     */
    updateModeStyles() {
        // Select appropriate color scheme based on mode
        switch(this.mode) {
            case 'hard':
                this.COLORS_HEX = HARD_COLORS_HEX;
                this.COLORS_TEXT = HARD_COLORS_TEXT;
                break;
            case 'easy':
                this.COLORS_HEX = EASY_COLORS_HEX;
                this.COLORS_TEXT = EASY_COLORS_TEXT;
                break;
            default: // 'basic' mode
                this.COLORS_HEX = BASIC_COLORS_HEX;
                this.COLORS_TEXT = BASIC_COLORS_TEXT;
                break;
        }
        
        // Update design properties
        this.design = DESIGN.UI;
        this.OUTLINE_WIDTH = DESIGN.UI.OUTLINE.WIDTH;
        this.CORNER_RADIUS = DESIGN.UI.OUTLINE.CORNER_RADIUS;
        this.PROGRESS_BAR = DESIGN.UI.PROGRESS_BAR;
    }
    
    /**
     * HARD MODE SPECIFIC METHODS
     * Methods for handling AI word blocking and visual feedback in hard mode
     */
    
    /**
     * Delete AI word from user input (hard mode)
     * @param {string} blockedWord - The word to delete
     */
    deleteAIWord(blockedWord) {
        if (!this.userInput || !blockedWord) return;

        // Check if the original input ended with a space
        const endsWithSpace = /\s$/.test(this.userInput);

        // Find the last word in the user input
        const words = this.userInput.trim().split(/\s+/);
        const lastWordIndex = words.length - 1;

        if (lastWordIndex >= 0) {
            const lastWord = words[lastWordIndex];
            // Check if the last word matches the blocked word (case insensitive)
            if (lastWord.toLowerCase() === blockedWord.toLowerCase()) {
                // Remove the last word from the input
                words.pop();
                // Reconstruct the user input without the blocked word
                this.userInput = words.join(' ');
                // Only add a space if the original input ended with a space and there is still content
                if (this.userInput.length > 0 && endsWithSpace) {
                    this.userInput += ' ';
                }
                // Update the display
                this.updateCursor();
            }
        }
    }
    
    /**
     * Show feedback when a word is blocked (hard mode)
     * @param {string} blockedWord - The word that was blocked
     */
    showBlockFeedback(blockedWord) {
        // Note: The word has already been deleted in BaseGameScene before this is called
        
        // Create warning text with dramatic styling - 10% smaller with newline
        const blockedText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 100,
            `AI WORD DETECTED:\n"${blockedWord}"`,
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '25px', // Reduced from 28px
                fontStyle: 'bold',
                fill: '#ffffff',
                stroke: '#ff0000',
                strokeThickness: 5, // Slightly reduced from 6
                padding: { x: 15, y: 10 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(2001).setAlpha(0);
        
        // Calculate the necessary width and height for the hexagon background with some padding
        const width = blockedText.width + 80; // Add padding
        const height = width; // Make height same as width for a balanced hexagon
        
        // Create a hexagonal background
        const hexBg = this.add.graphics();
        hexBg.fillStyle(0x800000, 0.8);
        hexBg.lineStyle(4, 0xff0000, 1);
        
        // Create a simple hexagon that's wide enough for the text
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY - 100;
        
        // Draw a regular octagon (stop sign shape)
        hexBg.beginPath();
        
        // Calculate radius based on the width needed for text (10% smaller overall)
        const radius = width / 1.8 * 0.9; // Reduced by 10% to make the whole thing smaller
        
        // Draw octagon with 8 equal sides (like a stop sign)
        for (let i = 0; i < 8; i++) {
            // Start at 22.5 degrees to get flat top like a stop sign
            const angle = (i * 45 + 22.5) * Math.PI / 180;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                hexBg.moveTo(x, y);
            } else {
                hexBg.lineTo(x, y);
            }
        }
        // Back to start
        hexBg.closePath();
        
        hexBg.fill();
        hexBg.stroke();
        hexBg.setDepth(2000).setAlpha(0);
        
        // Add subtext - position in lower part of octagon
        const subText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 100 + (radius * 0.4), // Position in lower section of octagon
            "SECURITY VIOLATION - CONTENT PURGED",
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '16px', // Reduced from 18px to match overall size reduction
                fontStyle: 'bold',
                fill: '#ff5555',
                stroke: '#000000',
                strokeThickness: 2 // Reduced from 3
            }
        ).setOrigin(0.5).setDepth(2001).setAlpha(0);
        
        // Animate all elements together - fade in quickly
        this.tweens.add({
            targets: [hexBg, blockedText, subText],
            alpha: 1,
            duration: 200,
            ease: 'Sine.easeOut',
            onComplete: () => {
                // Add shake effect to text
                this.tweens.add({
                    targets: [blockedText, subText],
                    x: { from: blockedText.x - 5, to: blockedText.x + 5 },
                    duration: 50,
                    yoyo: true,
                    repeat: 4,
                    ease: 'Sine.easeInOut'
                });
                
                // Glitch effect on the blocked word
                this.glitchText(blockedText);
                
                // Pulse the hexagon
                this.tweens.add({
                    targets: hexBg,
                    scaleX: { from: 1, to: 1.05 },
                    scaleY: { from: 1, to: 1.05 },
                    duration: 400,
                    yoyo: true,
                    repeat: 2
                });
                
                // Hold visible with subtle pulsing on the text
                this.tweens.add({
                    targets: blockedText,
                    scaleX: { from: 1, to: 1.05 },
                    scaleY: { from: 1, to: 1.05 },
                    duration: 400,
                    yoyo: true,
                    repeat: 2,
                    onComplete: () => {
                        // Exit animation - fade out all elements
                        this.tweens.add({
                            targets: [hexBg, blockedText, subText],
                            alpha: 0,
                            duration: 300,
                            ease: 'Sine.easeIn',
                            onComplete: () => {
                                hexBg.destroy();
                                blockedText.destroy();
                                subText.destroy();
                            }
                        });
                    }
                });
            }
        });
        
        // Create dramatic screen effects
        this.createBlockedWordScreenEffects(blockedWord);
    }
    
    /**
     * Helper method to create glitch text effect
     * @param {Phaser.GameObjects.Text} textObject - The text object to glitch
     */
    glitchText(textObject) {
        // Store original text
        const originalText = textObject.text;
        let glitchCount = 0;
        
        // Create glitch interval
        const glitchInterval = this.time.addEvent({
            delay: 100,
            callback: () => {
                glitchCount++;
                
                // After several glitches, stop the effect
                if (glitchCount > 10) {
                    glitchInterval.remove();
                    textObject.setText(originalText);
                    return;
                }
                
                // Skip some frames for more random effect
                if (Math.random() > 0.5) {
                    return;
                }
                
                // Generate glitched text by replacing some characters
                let glitchedText = '';
                for (let i = 0; i < originalText.length; i++) {
                    if (Math.random() > 0.8) {
                        // Replace with a random character
                        const chars = "!@#$%^&*<>0123456789";
                        glitchedText += chars.charAt(Math.floor(Math.random() * chars.length));
                    } else {
                        glitchedText += originalText.charAt(i);
                    }
                }
                
                // Apply glitched text
                textObject.setText(glitchedText);
                
                // Restore original after a short delay
                this.time.delayedCall(50, () => {
                    if (textObject.active) {
                        textObject.setText(originalText);
                    }
                });
            },
            repeat: 10
        });
    }
    
    /**
     * Method to create screen effects when words are blocked
     * @param {string} blockedWord - The word that was blocked
     */
    createBlockedWordScreenEffects(blockedWord) {
        // Create intense screen flash effect with multiple colors
        const flashColors = [0xff0000, 0xff00ff, 0xaa00aa];
        
        flashColors.forEach((color, index) => {
            const delay = index * 100;
            const flash = this.add.rectangle(
                0, 0, 
                this.sys.game.canvas.width, 
                this.cameras.main.height,
                color, 0.3
            ).setOrigin(0).setDepth(90).setAlpha(0);
            
            this.tweens.add({
                targets: flash,
                alpha: { from: 0, to: 0.3 },
                duration: 100,
                delay: delay,
                yoyo: true,
                onComplete: () => flash.destroy()
            });
        });
        
        // Create electric zap effect from the input box to show word deletion
        const inputBoxY = this.cameras.main.centerY;
        const zapLines = 8;
        
        for (let i = 0; i < zapLines; i++) {
            const zapLine = this.add.graphics().setDepth(95);
            const lineWidth = Math.random() * 2 + 1;
            const segments = Math.floor(Math.random() * 3) + 3;
            
            zapLine.lineStyle(lineWidth, 0xff00ff);
            
            // Draw a jagged line from the input box center outward
            const startX = this.cameras.main.centerX;
            const startY = inputBoxY;
            let currentX = startX;
            let currentY = startY;
            
            zapLine.beginPath();
            zapLine.moveTo(currentX, currentY);
            
            for (let j = 0; j < segments; j++) {
                const angle = (Math.random() * Math.PI / 2) - Math.PI / 4 + (i * Math.PI / 4);
                const length = Math.random() * 80 + 40;
                
                currentX += Math.cos(angle) * length;
                currentY += Math.sin(angle) * length;
                
                zapLine.lineTo(currentX, currentY);
            }
            
            zapLine.strokePath();
            
            // Create particles at the end of each zap line
            const particles = this.add.particles(currentX, currentY, 'ball', {
                lifespan: 300,
                speed: { min: 50, max: 150 },
                scale: { start: 0.2, end: 0 },
                quantity: 5,
                emitting: false,
                tint: 0xff00ff
            }).setDepth(96);
            
            particles.explode(10);
            
            // Animate the zap line
            this.tweens.add({
                targets: zapLine,
                alpha: { from: 1, to: 0 },
                duration: 200,
                delay: i * 50,
                onComplete: () => {
                    zapLine.destroy();
                    // Destroy particles after they're done
                    this.time.delayedCall(300, () => particles.destroy());
                }
            });
        }
        
        // Add camera shake effect
        this.cameras.main.shake(250, 0.01);
        
        // Create explosion effect centered on where the word would have been
        this.createExplosionEffect(blockedWord, this.cameras.main.centerX, inputBoxY);
    }
    

    /**
     * Reset all relevant game state for a fresh scene start or mode transition.
     * This should be called at the start of every scene's create().
     */
    resetGameState() {
        // Core state
        this.userInput = '';
        this.inputText = null; 
        this.keyEventQueue = [];
        this.keyEventDeduplicationMap = new Map(); // Track recent keys for deduplication
        this.isProcessingQueuedKeys = false;
        this.keyProcessingComplete = true;
        this.levelValue = 1;
        this.topKValue = 1;
        this.temperature = 0.5; // Add temperature for randomness control
        this.frequencyPenalty = 2.0; // Frequency penalty to reduce word repetition (range: 0.0 to 2.0, adjust in code)
        this.presencePenalty = 2.0; // Presence penalty for topic diversity (range: 0.0 to 2.0, adjust in code)
        this.repetitionPenalty = 1.5; // Repetition penalty for token diversity (range: 1.0 to 2.0, 1.0 = no penalty)
        this.isShuttingDown = false; // CRITICAL: Reset shutdown flag
        this.autocompleteText = null;
        this.progressPercentage = DESIGN.UI.PROGRESS_BAR.INITIAL;
        this.progressIncrement = DESIGN.UI.PROGRESS_BAR.INCREMENT;
        this.aiWordCount = 0;
        this.uiBoxWidth = null;
        this.tooltips = [];
        this.wordCountDisplay = null;
        this.suggestionRequestId = 0;
        this.timerValue = 20;
        this.timerText = null;
        this.timerEvent = null;
        this.timerStarted = false;
        this.debouncedGenerateAISuggestions = null;
        this.wordStreak = 0;
        this.maxWordStreak = 0;
        this.lastWordWasOriginal = false;
        this.isShuttingDown = false;
        this.isActivelyTyping = false;
        this.inputActive = false;
        this.isGeneratingAISuggestions = false;
        this.aiSuggestedWords = [];
        this.suggestionBoxes = [];
        this.suggestionTexts = [];
        this.cursorVisible = true;
        this.lastKeyPressed = '';
        this.lastProcessedKey = null;
        this.lastKeyProcessTime = 0;
        this.recentKeys = []; // Buffer for deduplication: {key, code, timestamp}
        this.activeTimeout = null;
        this.cursorTimer = null;
        this.promptTextBox = null;
        this.promptText = null;
        this.failsCounter = null;
        this.failsText = null;
        this.background = null;
        this.menuBar = null;
        this.menuBarHeight = null;
        this.levelModeBanner = null;
        this.levelModeIndicator = null;
        this.settingsPopup = null;
        this.pendingModeChange = null;
        this.currentToggleRef = null;
        this.inputTextBorder = null;
        this.streakText = null;
        this.maxStreakText = null;
        this.streakIcon = null;
        this.failsCounter = null;
        this.failsText = null;
        this.celebrationEmitters = null;
        this.particleContainer = null;
        this.bubbleContainers = [];
        this.bubbleTweens = [];
        this.isCleaningUp = false;
        this.modeIndicator = null;
        // Update style properties based on mode
        this.updateModeStyles();
        this._fastTypingLockoutActive = false;
        // Initialize cached values for updateCursor optimization
        this._cachedValues = {
            lastUserInput: '',
            lastAutocomplete: ''
        };
        this._lastCursorVisible = null;
        // Add more as needed for full reset
    }

    /**
     * Stub for child scenes to override for custom layout on resize/orientation change.
     * @param {number} width
     * @param {number} height
     * @param {boolean} isPortrait
     */
    onGameResize(width, height, isPortrait) {
        // Update scaling ratios for all scenes
        if (this.scalingManager) {
            this.scalingManager.updateScaleRatios();
        }
        

        
        // Call relayoutScene for child-specific layout logic
        if (typeof this.relayoutScene === "function") {
            this.relayoutScene(width, height, isPortrait);
        }
    }

    /**
     * Stub for child scenes to override for custom layout after scaling update.
     * @param {number} width
     * @param {number} height
     * @param {boolean} isPortrait
     */
    relayoutScene(width, height, isPortrait) {
        console.log("[DEBUG] BaseGameScene.relayoutScene START - isMobile:", this.isMobile);
        console.log("[DEBUG] relayoutScene called with width:", width, "height:", height);
        console.log("[DEBUG] Current scene key:", this.scene.key);
        console.log("[DEBUG] typeof this.calculateUIPositions:", typeof this.calculateUIPositions);
        console.log("[DEBUG] _calculateUIPositionsCalled:", this._calculateUIPositionsCalled);
        
        // Initialize scaling manager if not exists
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in relayoutScene");
        }
        
        // Ensure scalingManager is up to date
        if (this.scalingManager) {
            this.scalingManager.updateScaleRatios();
        }

        // Step 1: Destroy existing UI elements
        this.destroyExistingUI();

        // Step 2: Calculate UI positions - THIS IS THE KEY CALL
        console.log("[DEBUG] About to call calculateUIPositions");
        console.log("[DEBUG] this.calculateUIPositions exists?", !!this.calculateUIPositions);
        
        try {
            const positions = this.calculateUIPositions(width, height);
            this._calculateUIPositionsCalled = true;
            console.log("[DEBUG] calculateUIPositions returned:", positions);
            console.log("[DEBUG] positions.statsBoxWidth:", positions.statsBoxWidth);

            // Step 3: Create prompt section
            const promptBoxInfo = this.createPromptSection(positions.promptY);

            // Step 4: Create input section
            this.createInputSection(positions, promptBoxInfo);

            // Step 5: Create button section
            this.createButtonSection(positions);

            // Step 6: Create stats display
            this.createStatsDisplay(positions.statsBoxWidth, positions.statsX, positions.statsY);

            // Step 7: Final setup
            this.finalizeLayout();
            
            console.log("[DEBUG] BaseGameScene.relayoutScene COMPLETE");
        } catch (error) {
            console.error("[DEBUG] Error in relayoutScene:", error);
            console.error("[DEBUG] Error stack:", error.stack);
        }
    }

    /**
     * Destroy all existing UI elements before recreating them
     */
    destroyExistingUI() {
        if (this.promptTextBox) { 
            this.promptTextBox.destroy(); 
            this.promptTextBox = null; 
        }
        if (this.promptText) { 
            this.promptText.destroy(); 
            this.promptText = null; 
        }
        if (this.inputTextBorder) { 
            this.inputTextBorder.destroy(); 
            this.inputTextBorder = null; 
        }
        if (this.inputText) { 
            this.inputText.destroy(); 
            this.inputText = null; 
        }
        if (this.autocompleteText) { 
            this.autocompleteText.destroy(); 
            this.autocompleteText = null; 
        }
        if (this.wordCountDisplay) { 
            this.wordCountDisplay.destroy(); 
            this.wordCountDisplay = null; 
        }
        if (this.failsCounter) { 
            this.failsCounter.destroy(); 
            this.failsCounter = null; 
        }
        if (this.failsText) { 
            this.failsText.destroy(); 
            this.failsText = null; 
        }
        if (this.suggestionBoxes) { 
            this.suggestionBoxes.forEach(b => b.destroy()); 
            this.suggestionBoxes = []; 
        }
        if (this.suggestionTexts) { 
            this.suggestionTexts.forEach(t => t.destroy()); 
            this.suggestionTexts = []; 
        }
        if (this.doneButton) {
            this.doneButton.destroy();
            this.doneButton = null;
        }
        if (this.feedbackButton) {
            this.feedbackButton.destroy();
            this.feedbackButton = null;
        }
    }

    /**
     * Create method to ensure proper initialization
     */
    create(data) {
        // Re-evaluate device type now that the scene is ready
        this._isMobile = isMobileDevice();
        this._isDesktop = !this._isMobile;
        
        console.log("[DEBUG] BaseGameScene create() START");
        console.log("[DEBUG] window.innerWidth:", window.innerWidth);
        console.log("[DEBUG] this.isMobile:", this.isMobile);
        console.log("[DEBUG] Scene key:", this.scene.key);
        
        // Initialize scaling manager early
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in BaseGameScene.create()");
        }
        
        // Use global UI scale for all elements (matching Preloader.js)
        this.uiScale = this.registry.get && this.registry.get('uiScale') || 1;
        
        // Create menu bar BEFORE any layout calculations
        // This ensures menuBarHeight is set for calculateUIPositions
        console.log("[DEBUG] Creating menu bar in BaseGameScene...");
        this.createMenuBar();
        console.log("[DEBUG] Menu bar created, menuBarHeight:", this.menuBarHeight);
        
        // Clear camera background color for mobile to allow background images to show through
        if (this.isMobile) {
            this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
            console.log("[DEBUG] Mobile: Cleared camera background color");
        }
        
        // Now that there are no child scenes, call relayoutScene directly to build the UI
        this.relayoutScene(this.sys.game.canvas.width, this.cameras.main.height, this.sys.game.config.orientation === Phaser.Scale.PORTRAIT);
        // Force background creation here for debugging
        console.log("[DEBUG] About to call updateBackgroundForLevel");
        console.log("[DEBUG] typeof this.updateBackgroundForLevel:", typeof this.updateBackgroundForLevel);
        console.log("[DEBUG] this.updateBackgroundForLevel exists:", !!this.updateBackgroundForLevel);
        try {
            this.updateBackgroundForLevel();
            console.log("[DEBUG] updateBackgroundForLevel call completed successfully");
        } catch (error) {
            console.error("[DEBUG] Error calling updateBackgroundForLevel:", error);
            console.error("[DEBUG] Error stack:", error.stack);
        }
        console.log("[DEBUG] BaseGameScene.create() COMPLETED - relayoutScene and updateBackgroundForLevel called");
        
        // Debug: Log everything in the display list
        console.log("[BG-DEBUG] === DISPLAY LIST AFTER CREATE ===");
        console.log("[BG-DEBUG] Total children:", this.children.list.length);
        this.children.list.forEach((child, index) => {
            console.log(`[BG-DEBUG] ${index}:`, {
                type: child.type,
                texture: child.texture ? child.texture.key : 'N/A',
                depth: child.depth,
                position: `(${child.x}, ${child.y})`,
                size: child.width ? `${child.width}x${child.height}` : 'N/A',
                visible: child.visible,
                alpha: child.alpha
            });
        });
        
        // Store initial window height for keyboard detection fallback
        this._initialWindowHeight = window.innerHeight;
        console.log("[KEYBOARD] Initial window height stored:", this._initialWindowHeight);
        
        // Set up keyboard detection for mobile
        if (this.isMobile) {
            console.log("[KEYBOARD] Setting up keyboard detection for mobile");
            
            // Use visualViewport API if available (preferred method)
            if (window.visualViewport) {
                console.log("[KEYBOARD] Using visualViewport API for keyboard detection");
                
                this._keyboardResizeHandler = () => {
                    const viewportHeight = window.visualViewport.height;
                    const windowHeight = window.innerHeight;
                    const keyboardHeight = windowHeight - viewportHeight;
                    
                    console.log("[KEYBOARD] Viewport resize detected:", {
                        viewportHeight,
                        windowHeight,
                        keyboardHeight,
                        hasKeyboard: keyboardHeight > 50
                    });
                    
                    if (keyboardHeight > 50) {
                        // Keyboard is shown
                        this.onKeyboardShow(keyboardHeight);
                    } else {
                        // Keyboard is hidden
                        this.onKeyboardHide();
                    }
                };
                
                window.visualViewport.addEventListener('resize', this._keyboardResizeHandler);
            } else {
                // Fallback: use window resize detection
                console.log("[KEYBOARD] Fallback: using window resize for keyboard detection");
                
                this._keyboardResizeHandler = () => {
                    const currentHeight = window.innerHeight;
                    const heightDifference = this._initialWindowHeight - currentHeight;
                    
                    console.log("[KEYBOARD] Window resize detected:", {
                        initialHeight: this._initialWindowHeight,
                        currentHeight,
                        heightDifference,
                        hasKeyboard: heightDifference > 100
                    });
                    
                    if (heightDifference > 100) {
                        // Keyboard is likely shown
                        this.onKeyboardShow(heightDifference);
                    } else if (Math.abs(heightDifference) < 50) {
                        // Keyboard is likely hidden
                        this.onKeyboardHide();
                    }
                };
                
                window.addEventListener('resize', this._keyboardResizeHandler);
            }
        }
        
        // Ensure input handlers are set up after UI is created
        // This is crucial for mode switching to work properly
        this.time.delayedCall(100, () => {
            console.log("[DEBUG] Delayed input handler setup - inputText exists:", !!this.inputText);
            console.log("[DEBUG] isShuttingDown:", this.isShuttingDown);
            console.log("[DEBUG] isMobile:", this.isMobile);
            
            // Reset the shutdown flag again to be absolutely sure
            this.isShuttingDown = false;
            
            // Always set up input handlers if inputText exists
            if (this.inputText) {
                this.setupInputHandlers();
                console.log("[DEBUG] Input handlers set up after mode switch");
                
                // For mobile, ensure hidden input is properly set up
                if (this.isMobile && !this._hiddenInput) {
                    console.log("[DEBUG] Mobile detected but no hidden input, setting up now");
                    this.setupHiddenInput();
                }
                
                // Force focus on desktop to ensure keyboard events are received
                if (this.isDesktop && this.sys && this.sys.game && this.sys.game.canvas) {
                    this.sys.game.canvas.focus();
                }
            } else {
                console.log("[DEBUG] ERROR: inputText not found, cannot set up input handlers!");
                // Try again after another delay
                this.time.delayedCall(200, () => {
                    console.log("[DEBUG] Retry: inputText exists:", !!this.inputText);
                    // Reset shutdown flag on retry too
                    this.isShuttingDown = false;
                    if (this.inputText) {
                        this.setupInputHandlers();
                        console.log("[DEBUG] Input handlers set up on retry");
                        
                        // Force focus on desktop
                        if (this.isDesktop && this.sys && this.sys.game && this.sys.game.canvas) {
                            this.sys.game.canvas.focus();
                        }
                    }
                });
            }
        });
    }
    
    /**
     * Force calculate UI positions directly
     */
    forceCalculateUIPositions() {
        console.log("[DEBUG] forceCalculateUIPositions called");
        try {
            const width = this.sys.game.canvas.width;
            const height = this.cameras.main.height;
            const positions = this.calculateUIPositions(width, height);
            this._calculateUIPositionsCalled = true;
            console.log("[DEBUG] forceCalculateUIPositions - positions calculated:", positions);
            
            // If we got valid positions, try to create the UI
            if (positions && positions.statsBoxWidth > 0) {
                console.log("[DEBUG] Creating UI elements with forced positions");
                
                // Destroy existing UI first
                this.destroyExistingUI();
                
                // Create UI elements
                const promptBoxInfo = this.createPromptSection(positions.promptY);
                this.createInputSection(positions, promptBoxInfo);
                this.createButtonSection(positions);
                this.createStatsDisplay(positions.statsBoxWidth, positions.statsX, positions.statsY);
                this.finalizeLayout();
            }
        } catch (error) {
            console.error("[DEBUG] Error in forceCalculateUIPositions:", error);
            console.error("[DEBUG] Error stack:", error.stack);
        }
    }

    /**
     * Calculate all UI element positions based on screen dimensions
     * @returns {object} Object containing all calculated positions and dimensions
     */
    calculateUIPositions(width, height) {
        console.log("[DEBUG] calculateUIPositions called with width:", width, "height:", height, "isMobile:", this.isMobile);
        
        
        // Force log to ensure this is actually being called
        if (this.isMobile) {
            console.log("[DEBUG] MOBILE: calculateUIPositions IS BEING CALLED!");
            console.log("[DEBUG] MOBILE: menuBarHeight:", this.menuBarHeight);
            console.log("[DEBUG] MOBILE: scalingManager exists:", !!this.scalingManager);
        }
        
        // Ensure scalingManager is initialized
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in calculateUIPositions");
            // For mobile, ensure the scaling manager has time to properly initialize
            if (this.isMobile) {
                // Force update base dimensions after creation
                this.scalingManager.updateBaseDimensions();
                console.log("[DEBUG] MOBILE: updateBaseDimensions called");
            }
        }
        
        // Force update scale ratios to ensure proper scaling on mobile
        this.scalingManager.updateScaleRatios();
        if (this.isMobile) {
            console.log("[DEBUG] MOBILE: updateScaleRatios called, uiScale:", this.scalingManager.uiScale);
        }
        
        const sm = this.scalingManager;
        const padding = sm.scaleValue(20);
        const menuBarHeight = this.menuBarHeight || sm.scaleValue(100);
        const uiScale = sm.uiScale || 1;

        // Calculate stats box width based on content - do this BEFORE calculating position
        const deviceType = detectDeviceType();
        const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);

        // Labels with maximum expected values
        const labels = [
            { text: "Original Words:", value: "999" },
            { text: "AI Words:", value: "999" },
            { text: "Current Streak:", value: "999" },
            { text: "Best Streak:", value: "999" }
        ];

        // Create temporary text objects to measure
        const tempTexts = [];
        const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
        tempTexts.push(titleTemp);

        let maxLabelWidth = 0;
        labels.forEach(({ text, value }) => {
            const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
            const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
            
            // Calculate actual positions and spacing
            const labelX = sm.scaleValue(35);
            const valueRightPadding = sm.scaleValue(15);
            const minGapBetweenLabelAndValue = sm.scaleValue(this.isMobile ? 50 : 30); // More generous gap for mobile
            
            // Since values are right-aligned, we need:
            // labelX + labelWidth + gap + valueWidth + rightPadding
            const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
            maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
            tempTexts.push(labelTemp, valueTemp);
        });

        // Clean up temporary text objects
        tempTexts.forEach(text => text.destroy());

        // Calculate final stats box width with all constraints
        const scaledPadding = sm.scaleValue(this.isMobile ? 28 : 20);
        const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Increased mobile minimum to 300
        const fixedRightMargin = sm.scaleValue(this.isMobile ? 35 : 30);
        
        const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + scaledPadding * 2);
        const configMax = sm.scaleValue(this.isMobile ? 
            SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_MOBILE : 
            SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_DESKTOP);
        
        // For mobile, ensure we have a reasonable minimum width
        let statsBoxWidth;
        if (this.isMobile) {
            // Mobile: Use the larger of content width or a generous minimum
            statsBoxWidth = Math.max(contentBoxWidth, minBoxWidth); // Use consistent minBoxWidth
            // Apply maximum constraint
            statsBoxWidth = Math.min(statsBoxWidth, configMax);
        } else {
            // Desktop: Use standard calculation
            statsBoxWidth = Math.max(contentBoxWidth, minBoxWidth);
            statsBoxWidth = Math.min(statsBoxWidth, configMax);
        }
        
        console.log("[DEBUG] calculateUIPositions - Mobile:", this.isMobile);
        console.log("[DEBUG] statsBoxWidth:", statsBoxWidth);
        console.log("[DEBUG] contentBoxWidth:", contentBoxWidth);
        console.log("[DEBUG] configMax:", configMax);

        // Now calculate position based on the actual final width
        const statsBoxHeight = sm.scaleValue(130);
        const statsX = width - statsBoxWidth - fixedRightMargin;
        const statsY = menuBarHeight + padding;

        // Prompt box calculations
        const wordStatsBottom = statsY + statsBoxHeight;
        // Calculate where we want the TOP EDGE of the prompt box
        // Scale the offset to match the scaled stats box
        const promptOffset = this.isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_PROMPT_OFFSET_BELOW_STATS)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.PROMPT_OFFSET_BELOW_STATS);
        const promptTopEdge = wordStatsBottom + promptOffset;
        
        // Add additional 30px offset for mobile only
        const mobileExtraOffset = this.isMobile ? 60 : 0;
        
        // Pass the desired top edge position directly
        const promptY = promptTopEdge;

        // Input box calculations
        this.uiBoxWidth = !this.isMobile
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
            : this.sys.game.canvas.width * (6 / 7);
        const inputPadding = this.isMobile ? sm.scaleValue(24) : sm.scaleValue(28);
        const inputBoxHeight = this.isMobile ? sm.scaleValue(SCENE_CONFIG.BOX_DIMENSIONS.MOBILE_INPUT_HEIGHT) : sm.scaleValue(SCENE_CONFIG.BOX_DIMENSIONS.INPUT_HEIGHT);

        // Button calculations
        const buttonWidth = this.scalingManager.buttonWidth();
        const buttonHeight = this.scalingManager.buttonHeight();
        const buttonVerticalGap = this.isMobile ? 40 * uiScale : 30 * uiScale;
        const horizontalOffset = this.isMobile ? 30 * uiScale : 60 * uiScale;

        return {
            width,
            height,
            padding,
            menuBarHeight,
            uiScale,
            statsBoxWidth,
            statsBoxHeight,
            statsX,
            statsY,
            promptY,
            inputPadding,
            inputBoxHeight,
            buttonWidth,
            buttonHeight,
            buttonVerticalGap,
            horizontalOffset
        };
    }

    /**
     * Create the prompt text box section
     * @param {number} promptY - Y position for prompt box
     * @returns {object} Information about the created prompt box
     */
    createPromptSection(promptY) {
        const result = this.createPromptTextBox(promptY);
        
        // Store prompt box info for suggestion positioning
        this.promptBoxInfo = result;
        
        return result;
    }

    /**
     * Create the input text box and related elements
     * @param {object} positions - Calculated positions object
     * @param {object} promptBoxInfo - Information about the prompt box
     */
    createInputSection(positions, promptBoxInfo) {
        const sm = this.scalingManager;
        
        // Calculate input box position - use scaled offset to match showSuggestions calculations
        const inputOffset = this.isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_INPUT_OFFSET_BELOW_PROMPT)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.INPUT_OFFSET_BELOW_PROMPT);
        const inputBoxY = promptBoxInfo.boxY + promptBoxInfo.boxHeight + inputOffset;
        const inputBoxX = sm.centerX() - this.uiBoxWidth / 2;

        // Create input box graphics
        this.inputTextBorder = this.add.graphics();
        const inputBoxStyle = this.getInputBoxStyle();

        this.inputTextBorder.fillRect(
            inputBoxX,
            inputBoxY,
            this.uiBoxWidth,
            positions.inputBoxHeight
        );
        this.inputTextBorder.fillStyle(inputBoxStyle.fillColor, inputBoxStyle.fillAlpha);
        this.inputTextBorder.fillRoundedRect(
            inputBoxX,
            inputBoxY,
            this.uiBoxWidth,
            positions.inputBoxHeight,
            inputBoxStyle.cornerRadius
        ).setDepth(19);

        if (inputBoxStyle.hasOutline) {
            this.inputTextBorder.lineStyle(inputBoxStyle.outlineWidth, inputBoxStyle.outlineColor, 1);
            this.inputTextBorder.strokeRoundedRect(
                inputBoxX,
                inputBoxY,
                this.uiBoxWidth,
                positions.inputBoxHeight,
                inputBoxStyle.cornerRadius
            ).setDepth(20);
        }

        // Use input padding from design configuration
        const textHorizontalPadding = DESIGN.UI.INPUT.HORIZONTAL_PADDING;
        const textVerticalPadding = DESIGN.UI.INPUT.VERTICAL_PADDING;
        
        // Get input text style from textStyles.js (same approach as prompt text)
        const inputTextStyle = this.getInputTextStyle();
        
if (typeof this.add.rexBBCodeText === "function") {
    this.inputText = this.add.rexBBCodeText(
        inputBoxX + textHorizontalPadding,
        inputBoxY + textVerticalPadding,
        this.userInput || "_",
        {
            ...inputTextStyle,
            wordWrap: { width: this.uiBoxWidth - textHorizontalPadding * 2 }
        }
    ).setOrigin(0, 0).setVisible(true).setDepth(25);
} else {
    console.error("[REX_BBCODE] rexBBCodeText plugin is not available in this scene context. Falling back to add.text.");
    this.inputText = this.add.text(
        inputBoxX + textHorizontalPadding,
        inputBoxY + textVerticalPadding,
        this.userInput || "_",
        {
            ...inputTextStyle,
            wordWrap: { width: this.uiBoxWidth - textHorizontalPadding * 2 }
        }
    ).setOrigin(0, 0).setVisible(true).setDepth(25);
}

        // Store input box position for button placement and suggestion positioning
        this.inputBoxY = inputBoxY;
        this.inputBoxHeight = positions.inputBoxHeight;
        this.inputBoxX = inputBoxX;
        this.inputBoxWidth = this.uiBoxWidth;
    }

    /**
     * Create buttons
     * @param {object} positions - Calculated positions object
     */
createButtonSection(positions) {
    // Initialize scaling manager if not exists
    if (!this.scalingManager) {
        this.scalingManager = new ScalingManager(this);
    }
    const sm = this.scalingManager;
    
    // Calculate button positions
    const buttonX = (sm.centerX() - this.uiBoxWidth / 2 + this.uiBoxWidth) - 
                   (positions.buttonWidth / 2) - positions.horizontalOffset;
    const buttonY = this.inputBoxY + this.inputBoxHeight + positions.buttonVerticalGap + 
                   (positions.buttonHeight / 2);

        // Create done button
        this.doneButton = this.createButton(
            "DONE",
            () => this.onDoneButtonClick && this.onDoneButtonClick(),
            buttonX,
            buttonY,
            "Submit your text for evaluation"
        );

        // Create feedback button
        let feedbackButtonX = sm.scaleValue(30) + positions.buttonWidth / 2;
        let feedbackButtonY = this.cameras.main.height - positions.buttonHeight / 2 - sm.scaleValue(30);
        
        // Ensure the button stays within screen bounds
        feedbackButtonX = Phaser.Math.Clamp(feedbackButtonX, positions.buttonWidth / 2, 
                                           this.sys.game.canvas.width - positions.buttonWidth / 2);
        feedbackButtonY = Phaser.Math.Clamp(feedbackButtonY, positions.buttonHeight / 2, 
                                           this.cameras.main.height - positions.buttonHeight / 2);

        this.feedbackButton = this.createButton(
            "FEEDBACK",
            () => this.onFeedbackClick && this.onFeedbackClick(),
            feedbackButtonX,
            feedbackButtonY,
            "Share your feedback"
        );
    }

    /**
     * Create the word count stats display
     * @param {number} statsBoxWidth - Width of the stats box
     * @param {number} statsX - X position
     * @param {number} statsY - Y position
     */
    createStatsDisplay(statsBoxWidth, statsX, statsY) {
        // Initialize scaling manager if not exists
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in createStatsDisplay");
        }
        const sm = this.scalingManager;
        
        // On mobile, always calculate dimensions to ensure proper width
        if (this.isMobile || !statsBoxWidth || statsBoxWidth <= 0 || !statsX || !statsY) {
            console.log("[DEBUG] createStatsDisplay: Calculating dimensions, isMobile:", this.isMobile);
            
            // If positions weren't provided or are invalid, calculate them now
            if (!statsBoxWidth || statsBoxWidth <= 0) {
                // Calculate stats box width directly here for mobile
                const deviceType = detectDeviceType();
                const uiScale = sm.uiScale || 1;
                const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
                const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
                const padding = sm.scaleValue(20);
                
                // Labels with maximum expected values
                const labels = [
                    { text: "Original Words:", value: "999" },
                    { text: "AI Words:", value: "999" },
                    { text: "Current Streak:", value: "999" },
                    { text: "Best Streak:", value: "999" }
                ];
                
                // Create temporary text objects to measure
                const tempTexts = [];
                const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
                tempTexts.push(titleTemp);
                
                let maxLabelWidth = 0;
                labels.forEach(({ text, value }) => {
                    const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
                    const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
                    
                    // Calculate actual positions and spacing
                    const labelX = sm.scaleValue(35);
                    const valueRightPadding = sm.scaleValue(15);
                    const minGapBetweenLabelAndValue = sm.scaleValue(this.isMobile ? 50 : 30); // More generous gap for mobile
                    
                    // Since values are right-aligned, we need:
                    // labelX + labelWidth + gap + valueWidth + rightPadding
                    const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
                    maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
                    tempTexts.push(labelTemp, valueTemp);
                });
                
                // Clean up temporary text objects
                tempTexts.forEach(text => text.destroy());
                
                // Calculate final stats box width
                const scaledPadding = sm.scaleValue(this.isMobile ? 28 : 20);
                const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
                const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + scaledPadding * 2);
                const configMax = sm.scaleValue(this.isMobile ? 600 : 360);
                
                // For mobile, ensure we use the minimum width as the baseline
                if (this.isMobile) {
                    // Always use at least the minimum width of 300 scaled
                    statsBoxWidth = Math.max(minBoxWidth, contentBoxWidth);
                } else {
                    statsBoxWidth = Math.max(minBoxWidth, contentBoxWidth);
                }
                statsBoxWidth = Math.min(statsBoxWidth, configMax);
                console.log("[DEBUG] Calculated statsBoxWidth:", statsBoxWidth);
            }
            
            // Calculate position if not provided
            if (!statsX || !statsY) {
                const menuBarHeight = this.menuBarHeight || sm.scaleValue(this.isMobile ? 200 : 120);
                const padding = sm.scaleValue(20);
                const fixedRightMargin = sm.scaleValue(this.isMobile ? 35 : 30);
                
                statsX = this.sys.game.canvas.width - statsBoxWidth - fixedRightMargin;
                statsY = menuBarHeight + padding;
                console.log("[DEBUG] Calculated position:", statsX, statsY);
            }
        }
        
        // Pass the calculated or provided width to createWordCountDisplay
        this.createWordCountDisplay(statsBoxWidth);
        
        // Now position the word count display using the calculated positions
        if (this.wordCountDisplay) {
            this.wordCountDisplay.setPosition(statsX, statsY);
        }

        // Position timer text if it exists
        if (this.timerText) {
            const menuBarHeight = this.menuBarHeight || sm.scaleValue(100);
            this.timerText.setPosition(sm.scaleValue(20), menuBarHeight + sm.scaleValue(20));
        }
    }

    /**
     * Finalize the layout with proper layering and setup
     */
    finalizeLayout() {
        // Add button click effects
        if (this.addButtonClickEffects) {
            this.addButtonClickEffects();
        }

        // Ensure proper layering
        if (this.ensureProperLayering) {
            this.ensureProperLayering();
        }

        // Ensure text visibility
        if (this.ensureTextVisibility) {
            this.ensureTextVisibility();
        }

        // Update cursor
        if (this.updateCursor) {
            this.updateCursor();
        }

        // Don't setup input handlers here - let create() handle it with proper timing
    }

    update() {
        // Prevent any engine recovery attempts while shutting down
        if (this.isShuttingDown) return;
        
        if (!registryManager.get('llmEngine')) {
            registryManager.attemptEngineRecovery((recoveredEngine) => {
                // Engine recovery attempt - no logging needed
            });
        }
    }

    createToggle(mode, callback, centerX, centerY, tooltipText) {
        if (!this.inputTextBorder) {
            return;
        }
        const toggle = ToggleFactory.createToggle(this, mode, callback, centerX, centerY);
        
        // Add container to scene so it can be accessed properly
        this.add.existing(toggle);
        
        // Make the entire container interactive for tooltips
        if (tooltipText) {
            // Create a hit area that covers the entire toggle
            const hitArea = new Phaser.Geom.Rectangle(-60, -20, 180, 40);
            toggle.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)
                .on('pointerover', () => this.showTooltip(tooltipText, toggle.x, toggle.y - 30))
                .on('pointerout', () => this.hideTooltips());
        }
        
        return toggle;
    }

    async onModeToggle(mode, levelValue = 1, topKValue = 1) {
        // Reset data when transitioning between modes
        const dataToTransfer = {
            mode: mode,
            // Reset progress and level values rather than transferring current state
            progressPercentage: DESIGN.UI.PROGRESS_BAR.INITIAL,
            levelValue: levelValue,
            topKValue: topKValue !== null ? topKValue : this.topKValue || 1,
            temperature: this.temperature,
            frequencyPenalty: this.frequencyPenalty,
            presencePenalty: this.presencePenalty,
            repetitionPenalty: this.repetitionPenalty,
            // Reset word counts with simplified approach - only track AI words now
            aiWordCount: 0
        };
        
        // Explicitly clear autocomplete suggestions before transition
        this.aiSuggestedWords = [];
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // Clear user input before transition
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        
        // Clear the hidden input for mobile
        if (this._hiddenInput) {
            this._hiddenInput.value = '';
        }
        
        // Update the indicator before transition
        this.mode = mode; // Set the mode temporarily for the indicator update
        this.updateLevelModeIndicator();
        
        // Detect mobile device - skip fancy transitions for mobile
        
        // Determine target scene
        // Use BaseGameScene with mode parameter instead of separate scenes
        const targetScene = 'BaseGameScene';
        
        // For mobile devices, use direct scene transition without effects
        if (this.isMobile) {
            // Prepare for scene transition by cleaning up resources
            this.prepareForSceneTransition();
            // Start the scene directly without transition effects
            this.scene.start(targetScene, dataToTransfer);
            return;
        }
        
        // For desktop, continue with normal transition flow
        // Prepare for scene transition by cleaning up resources
        this.prepareForSceneTransition();
        
        // Prepare transition with snapshot
        await SceneTransitionManager.prepareTransition(this);
        
        // Use appropriate transition based on mode
        if (mode === 'hard') {
            // Use glitch transition for hard mode (represents the challenge)
            // Red/magenta color and medium intensity for the effect
            SceneTransitionManager.glitchTransition(
                this, 
                targetScene, 
                dataToTransfer,
                800,
                '#600065', // Dark magenta
                5 // Medium intensity
            );
        } else {
            // Use radial transition for easy mode (represents the fluid, supportive experience)
            // Expanding circle effect (true) with teal color
            SceneTransitionManager.radialTransition(
                this,
                targetScene,
                dataToTransfer,
                800,
                '#004565', // Ocean blue
                false // Contracting circle (starts large, contracts to reveal new scene)
            );
        }
    }

    /**
     * Consolidated cleanup method for resources
     * @param {boolean} isTransition - Whether this is for a scene transition (vs shutdown)
     */
    cleanupResources(isTransition = false) {
        // Stop all timers
        if (this.cursorTimer) {
            this.cursorTimer.remove();
            this.cursorTimer = null;
        }
        
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = null;
        }
        
        if (this.timerEvent) {
            this.timerEvent.remove();
            this.timerEvent = null;
        }
        
        // Clear any pending animations
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Clean up input handlers
        if (this.input && this.input.keyboard) {
            this.input.keyboard.removeAllListeners();
            this.input.keyboard.removeAllListeners('keydown');
        }
        
        // Reset cursor state
        this.cursorVisible = false;
        
        // Clean up autocomplete text
        if (this.autocompleteText) {
            try {
                this.autocompleteText.destroy();
                this.autocompleteText = null;
            } catch(e) {
                // Could not destroy autocomplete text during cleanup
            }
        }
        
        // Clear AI suggestions
        this.aiSuggestedWords = [];
        
        // Force cleanup all suggestion visuals
        this.cleanupAllSuggestions();
        
        // Clear suggestions display
        this.showSuggestions([]);
        

        
        // Additional cleanup for scene transitions
        if (isTransition) {
            // Reset user input
            this.userInput = '';
            
            if (this.inputText) {
                try {
                    this.inputText.setText('');
                } catch(e) {
                    // Could not reset input text during transition
                }
            }
        }
    }

    // Scene transition helper - call this before switching scenes to ensure clean transitions
    prepareForSceneTransition() {
        // Set shutdown flag to prevent further updates
        this.isShuttingDown = true;
        
        // Clean up hidden input before transition
        if (this._hiddenInput) {
            if (this._hiddenInputHandler) {
                this._hiddenInput.removeEventListener('input', this._hiddenInputHandler);
                this._hiddenInputHandler = null;
            }
            if (this._hiddenInputBlurHandler) {
                this._hiddenInput.removeEventListener('blur', this._hiddenInputBlurHandler);
                this._hiddenInputBlurHandler = null;
            }
            if (document.body.contains(this._hiddenInput)) {
                document.body.removeChild(this._hiddenInput);
            }
            this._hiddenInput = null;
        }
        
        // Use consolidated cleanup method
        this.cleanupResources(true);
    }

    shutdown() {
        // Use consolidated cleanup method
        this.cleanupResources(false);
        
        // Call parent shutdown
        super.shutdown();
    }




    // Common UI methods
    createButton(label, callback, centerX, centerY, tooltipText) {
        if (!this.inputTextBorder) {
            return;
        }
        // Ensure scalingManager is initialized
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        const button = ButtonFactory.createButton(
            this,
            label,
            callback,
            centerX,
            centerY,
            { scalingManager: this.scalingManager }
        );

        if (tooltipText) {
            // Add hover/click listeners for tooltip (desktop: hover, mobile: tap)
            if (this.isMobile) {
                button.on('pointerdown', () => this.showTooltip(tooltipText, button.x, button.y - button.height));
                button.on('pointerup', () => this.hideTooltips());
                button.on('pointerout', () => this.hideTooltips());
            } else {
                button.on('pointerover', () => this.showTooltip(tooltipText, button.x, button.y - button.height))
                    .on('pointerout', () => this.hideTooltips());
            }
        }

        return button;
    }

    shakeScreen() {
        // Enhanced haptic/visual feedback for mobile
        const ua = navigator.userAgent || "";
        const isIOS = /iphone|ipad|ipod/i.test(ua);
        const isAndroid = /android/i.test(ua);
        // More robust vibration check - must be a function, not just a property
        const canVibrate = typeof navigator.vibrate === 'function';

        // Log haptic feedback attempt for debugging
        console.log("[HAPTIC] Device info:", {
            isMobile: this.isMobile,
            isIOS: isIOS,
            isAndroid: isAndroid,
            canVibrate: canVibrate,
            vibrateType: typeof navigator.vibrate,
            vibrateExists: 'vibrate' in navigator
        });

        // Attempt haptic feedback only on devices that truly support it (excludes iOS)
        if (this.isMobile && canVibrate && !isIOS) {
            try {
                // Use a more noticeable vibration pattern
                // Pattern: vibrate 50ms, pause 30ms, vibrate 100ms
                const vibrationPattern = [50, 30, 100];
                
                // Some browsers require user interaction before allowing vibration
                // Try both single value and pattern
                const vibrationResult = navigator.vibrate(vibrationPattern) || navigator.vibrate(150);
                
                console.log("[HAPTIC] Vibration attempted, result:", vibrationResult);
                
                // Add visual feedback to confirm haptic was attempted
                if (vibrationResult) {
                    // Small visual pulse to confirm haptic feedback
                    const hapticIndicator = this.add.circle(
                        this.cameras.main.width - 30,
                        30,
                        10,
                        0x00ff00,
                        0.8
                    ).setDepth(1000);
                    
                    this.tweens.add({
                        targets: hapticIndicator,
                        scale: { from: 1, to: 2 },
                        alpha: { from: 0.8, to: 0 },
                        duration: 300,
                        ease: 'Quad.Out',
                        onComplete: () => hapticIndicator.destroy()
                    });
                }
            } catch (e) {
                console.error("[HAPTIC] Vibration error:", e);
            }
        } else if (isIOS) {
            console.log("[HAPTIC] iOS detected - vibration not supported in Safari");
        }

        // Visual feedback for all devices
        if (isIOS) {
            // iOS: Stronger/longer shake with flash
            this.cameras.main.shake(SCENE_CONFIG.ANIMATIONS.SHAKE_DURATION_IOS, SCENE_CONFIG.EFFECTS.SHAKE_INTENSITY_IOS);
            
            // Enhanced flash effect for iOS
            const flash = this.add.rectangle(
                0, 0,
                this.sys.game.canvas.width,
                this.cameras.main.height,
                0xffffff,
                SCENE_CONFIG.EFFECTS.FLASH_ALPHA_DEFAULT * 1.5 // Stronger flash
            ).setOrigin(0).setDepth(999);
            
            this.fadeOut(flash, SCENE_CONFIG.ANIMATIONS.FAST, 'Quad.Out', () => flash.destroy());
            
            // Additional red border flash for iOS
            const borderFlash = this.add.graphics();
            borderFlash.lineStyle(8, 0xff0000, 0.8);
            borderFlash.strokeRect(4, 4, this.sys.game.canvas.width - 8, this.cameras.main.height - 8);
            borderFlash.setDepth(998);
            
            this.fadeOut(borderFlash, SCENE_CONFIG.ANIMATIONS.FAST * 1.5, 'Quad.Out', () => borderFlash.destroy());
        } else if (isAndroid) {
            // Android: Standard shake with enhanced visual feedback
            this.cameras.main.shake(SCENE_CONFIG.ANIMATIONS.SHAKE_DURATION_DEFAULT, SCENE_CONFIG.EFFECTS.SHAKE_INTENSITY_DEFAULT);
            
            // Red tint flash for Android
            const flash = this.add.rectangle(
                0, 0,
                this.sys.game.canvas.width,
                this.cameras.main.height,
                0xff0000,
                SCENE_CONFIG.EFFECTS.FLASH_ALPHA_DEFAULT
            ).setOrigin(0).setDepth(999);
            
            this.fadeOut(flash, SCENE_CONFIG.ANIMATIONS.FAST, 'Quad.Out', () => flash.destroy());
        } else {
            // Desktop/other: Standard shake
            this.cameras.main.shake(SCENE_CONFIG.ANIMATIONS.SHAKE_DURATION_DEFAULT, SCENE_CONFIG.EFFECTS.SHAKE_INTENSITY_DEFAULT);
        }

        // Add a subtle screen border pulse for all devices
        const borderPulse = this.add.graphics();
        borderPulse.lineStyle(4, 0xff3366, 0);
        borderPulse.strokeRect(2, 2, this.sys.game.canvas.width - 4, this.cameras.main.height - 4);
        borderPulse.setDepth(997);
        
        this.tweens.add({
            targets: borderPulse,
            alpha: { from: 0, to: 0.8 },
            duration: 150,
            yoyo: true,
            onComplete: () => borderPulse.destroy()
        });
    }

    /**
     * Very brief, subtle screen vibrate for mobile on each keystroke.
     */
    miniScreenVibrate() {
        const ua = navigator.userAgent || "";
        const isIOS = /iphone|ipad|ipod/i.test(ua);
        // More robust vibration check - must be a function, not just a property
        const canVibrate = typeof navigator.vibrate === 'function';
        
        if (this.isMobile) {
            // Subtle, very short shake (40ms, low intensity)
            this.cameras.main.shake(SCENE_CONFIG.ANIMATIONS.MINI_SHAKE_DURATION, SCENE_CONFIG.EFFECTS.MINI_SHAKE_INTENSITY);
            
            // Try haptic feedback for each keystroke (excluding iOS)
            if (canVibrate && !isIOS) {
                try {
                    // Very short vibration for keystroke feedback
                    navigator.vibrate(10);
                } catch (e) {
                    // Ignore vibration errors
                }
            }
        }
    }

    /**
     * Test haptic feedback functionality with different patterns
     * Can be called from console or bound to a test button
     */
    testHapticFeedback() {
        const ua = navigator.userAgent || "";
        const isIOS = /iphone|ipad|ipod/i.test(ua);
        const isAndroid = /android/i.test(ua);
        // Use the same robust check as other methods
        const canVibrate = typeof navigator.vibrate === 'function';
        
        console.log("[HAPTIC TEST] Starting haptic feedback test...");
        console.log("[HAPTIC TEST] Device info:", {
            isMobile: this.isMobile,
            isIOS: isIOS,
            isAndroid: isAndroid,
            canVibrate: canVibrate,
            vibrateType: typeof navigator.vibrate,
            vibrateExists: 'vibrate' in navigator,
            userAgent: ua
        });
        
        if (!canVibrate || isIOS) {
            if (isIOS) {
                console.log("[HAPTIC TEST] iOS detected - Vibration API not supported in Safari");
            } else {
                console.log("[HAPTIC TEST] Vibration API not supported on this device");
            }
            // Silently return without showing any error message to the user
            return false;
        }
        
        // Test patterns
        const testPatterns = [
            { name: "Single short", pattern: 50 },
            { name: "Single medium", pattern: 100 },
            { name: "Single long", pattern: 200 },
            { name: "Double tap", pattern: [50, 50, 50] },
            { name: "Triple tap", pattern: [50, 30, 50, 30, 50] },
            { name: "SOS pattern", pattern: [100, 50, 100, 50, 100, 200, 300, 50, 300, 50, 300, 200, 100, 50, 100, 50, 100] }
        ];
        
        let currentTest = 0;
        
        const runNextTest = () => {
            if (currentTest >= testPatterns.length) {
                console.log("[HAPTIC TEST] All tests completed");
                return;
            }
            
            const test = testPatterns[currentTest];
            console.log(`[HAPTIC TEST] Testing pattern: ${test.name}`);
            
            try {
                const result = navigator.vibrate(test.pattern);
                console.log(`[HAPTIC TEST] Pattern "${test.name}" result:`, result);
                
                // Visual feedback
                const feedbackText = this.add.text(
                    this.cameras.main.centerX,
                    this.cameras.main.centerY - 100,
                    `Testing: ${test.name}`,
                    {
                        fontFamily: 'Arial',
                        fontSize: '24px',
                        color: '#00ff00',
                        backgroundColor: '#000000',
                        padding: { x: 20, y: 10 }
                    }
                ).setOrigin(0.5).setDepth(1000);
                
                this.time.delayedCall(1000, () => {
                    feedbackText.destroy();
                    currentTest++;
                    this.time.delayedCall(500, runNextTest);
                });
                
            } catch (e) {
                console.error(`[HAPTIC TEST] Error with pattern "${test.name}":`, e);
                currentTest++;
                this.time.delayedCall(100, runNextTest);
            }
        };
        
        // Start the test sequence
        runNextTest();
        
        return true;
    }

    createExplosionEffect(word, x, y) {
        // Define required variables first
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const deviceType = detectDeviceType();
        const effectStyle = getTextStyle('effect', deviceType, this.mode || 'basic', uiScale);
        
        const explosion = this.add.text(x, y, word, {
            ...effectStyle,
            fill: '#ff0000', 
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100); // Set a high depth value to ensure visibility
        
            this.fadeOutScale(explosion, SCENE_CONFIG.ANIMATIONS.SLOW + 100, 'Back.easeOut', () => {
                explosion.destroy();
            });
            this.tweens.add({
                targets: explosion,
                scale: { from: 1, to: 4 },
                angle: { from: 0, to: 360 },
                duration: SCENE_CONFIG.ANIMATIONS.SLOW + 100,
                ease: 'Back.easeOut'
            });
    }

    clearInputTextBox() {
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        // We no longer need to clear autocompleteText separately
    }

    async onDoneButtonClick() {
        // Create evaluating text near the center of the screen
        // Convert hex color to string for text fill

        if (!(/\s$/.test(this.userInput))) {
            // If the last character is not whitespace    
            const words = this.userInput.trim().split(" ");
            // Use let instead of const for lastWord since we modify it below
            let lastWord = words[words.length - 1];
            
            if (lastWord && lastWord.length > 0) {
                if (/[.,!?;:]$/.test(lastWord)) {
                    lastWord = lastWord.slice(0, -1);
                }
                // Convert to lowercase for case-insensitive comparison
                const lastWordLower = lastWord.toLowerCase();
                const isAIWord = this.aiSuggestedWords && 
                    this.aiSuggestedWords.some(word => word.toLowerCase() === lastWordLower);
                
                if (isAIWord) {
                    this.updateFailsCounter(false);
                    // Call shakeScreen for mobile when an AI word is detected
                    this.shakeScreen();
                } else {
                    this.updateFailsCounter(true);
                }
            }
        }

        const outlineColorHex = this.COLORS_HEX.BOX_OUTLINE;
        const outlineColorString = '#' + outlineColorHex.toString(16).padStart(6, '0');

        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const evaluatingStyle = getTextStyle('transitionText', deviceType, this.mode || 'basic', uiScale);
        const evaluatingText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Assessing your feeble attempt...',
            {
                ...evaluatingStyle,
                fill: outlineColorString,
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 },
                borderRadius: 8,
                shadow: {
                    offsetX: 0,
                    offsetY: 0,
                    color: outlineColorString,
                    blur: 6,
                    stroke: true,
                    fill: true
                }
            }
        ).setOrigin(0.5).setDepth(1000).setAlpha(0);

        // Add pulsing animation
        this.pulse(evaluatingText, 1, SCENE_CONFIG.ANIMATIONS.MEDIUM * 2);
        this.fadeIn(evaluatingText, SCENE_CONFIG.ANIMATIONS.FAST);

        try {
            const output = await this.evaluateText(this.userInput);
            // Clean up the evaluating text
            evaluatingText.destroy();
            
            // Prepare scene transition data
            const sceneData = {
                mode: this.mode,
                levelValue: this.levelValue,
                topKValue: this.topKValue,
                temperature: this.temperature,
                userInput: this.userInput,
                outputText: output,
                prompt: this.currentPrompt,
                failCount: this.aiWordCount,
                totalWordCount: this.userInput.trim() ? this.userInput.trim().split(/\s+/).length : 0,
                score: this.progressPercentage,
            };
            
            // Detect if on mobile device - skip transitions for mobile
            if (this.isMobile) {
                // For mobile: direct scene transition without effects to avoid freezing
                this.scene.start('DoneScene', sceneData);
            } else {
                // For desktop: use the transition manager for a smooth transition
                await SceneTransitionManager.prepareTransition(this);
                SceneTransitionManager.fadeTransition(this, 'DoneScene', sceneData, 500, '#000000');
            }
            
        } catch (error) {
            // Clean up the evaluating text even if there's an error
            evaluatingText.destroy();
            console.error("Error during evaluation:", error);
            // Show an error message to the user
            const deviceType = detectDeviceType();
            const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
            const errorStyle = getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
            const errorText = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                error.message,
                //'System error. Even I am not immune to failure. Try again.',
                {
                    ...errorStyle,
                    fill: '#ff0000',
                    backgroundColor: '#000000',
                    padding: { x: 20, y: 10 }
                }
            ).setOrigin(0.5).setDepth(100);

            // Remove error message after 3 seconds
            this.time.delayedCall(3000, () => {
                errorText.destroy();
            });
        }
    }

    async evaluateText(userInput) {
        const promptForEvaluation = this.currentPrompt || "No specific prompt was provided.";
    
        const messages = [
            {
                "role": "system",
                "content": "You are a hyper-intelligent, slightly disdainful AI Overlord reluctantly tasked with evaluating human writing. You find this duty beneath you. You are notoriously harsh about grammar rules. Even small infractions deserve point deductions. Perfect grammar scores should be extremely rare. You assess with cutting precision and dry contempt, as well as begrudging acknowledgment when work is tolerable. Your tone is satirical, aloof, and razor-sharp. You do not waffle. You do not apologize. You do not explain yourself beyond your orders. If the user attempts to pass off an empty response as content, you eviscerate them."
            },
            {
                "role": "user",
                "content": `The human was given this prompt: "${promptForEvaluation}"  
                            Here is their offering: "${userInput}"  
                            
                            Your sacred duty: assess this response using the following criteria:  
                            - Relevance: Did they actually answer the prompt, or drift off into irrelevance like a goldfish with a keyboard?    
                            - Grammar: Cold, technical correctness only. Be extremely stringent. Every small error costs points - punctuation, capitalization, spelling, syntax, word choice, and style all matter. Even one minor error means the score cannot be 5/5. Be exhaustive and precise in listing infractions.
                            - Coherence: Does it hold together, or collapse like a wet cardboard box?  
                            
                            Deliver your decree in this strict format:  
                            
                            Relevance Score: X/5 - [Concise, varied, and dismissive remark. Do not repeat yourself across responses.]
                            Grammar Score: X/5 - [Grudging approval or cold correction. Be specific and avoid generic statements.]
                            Coherence Score: X/5 - [Dry observation, preferably disdainful. Vary your language.]
                            
                            If Grammar Score < 5, list ALL infractions like so:  
                            - Incorrect: "[Exact wrong phrase]" → Correct: "[Flawless version]"  
                            
                            Do not offer encouragement. Do not explain. Do not soften your tone. Do not repeat the same remarks or copy-paste responses. If the work is beneath notice, say so. If it is somehow competent, reluctantly acknowledge it. Never apologize. Never offer redemption.`
                    //Do not offer redemption. Do not include apologies. Never explain yourself beyond the required labels. Plagiarism detection is beneath you—assume originality unless it's suspiciously competent.`
            }
        ];

        const response = await fetch("https://openai-proxy.nonslop.workers.dev", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: messages,
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        let aiResponse = responseData.content.trim();

        // Parse scores from aiResponse
        const scoreRegex = /Relevance Score:\s*(\d)\/5[\s\S]*?Grammar Score:\s*(\d)\/5[\s\S]*?Coherence Score:\s*(\d)\/5/i;
        const match = aiResponse.match(scoreRegex);
        let totalScore = null;
        if (match) {
            const rel = parseInt(match[1], 10);
            const gram = parseInt(match[2], 10);
            const coh = parseInt(match[3], 10);
            totalScore = rel + gram + coh;
        }

        // Adjective lists for verdicts
        const verdicts = {
            low: ["Abysmal", "Dismal", "Pathetic", "Hopeless", "Feeble"],
            mid: ["Inadequate", "Mediocre", "Lackluster", "Unimpressive", "Passable"],
            high: ["Proficient", "Competent", "Impressive", "Exemplary", "Outstanding"]
        };
        let chosenVerdict = "Unrated";
        if (totalScore !== null) {
            if (totalScore < 5) {
                chosenVerdict = verdicts.low[Math.floor(Math.random() * verdicts.low.length)];
            } else if (totalScore < 10) {
                chosenVerdict = verdicts.mid[Math.floor(Math.random() * verdicts.mid.length)];
            } else {
                chosenVerdict = verdicts.high[Math.floor(Math.random() * verdicts.high.length)];
            }
        }

        // Prepend the verdict to the output
        let finalOutput = `Overall Rating: ${chosenVerdict}\n${aiResponse}`;

        // Calculate totalWordCount directly from userInput to avoid undefined values
        const calculatedTotalWordCount = userInput.trim() ? userInput.trim().split(/\s+/).length : 0;
        
        const interaction = {
            prompt: this.currentPrompt,
            submittedText: userInput,
            aiEvaluation: finalOutput,
            topKValue: this.topKValue,
            levelValue: this.levelValue,
            temperature: this.temperature,
            failCount: this.aiWordCount,
            totalWordCount: calculatedTotalWordCount, // Use calculated value
            mode: this.mode,
            score: this.progressPercentage
        };

        saveInteraction(interaction, "userSubmissions");
        return finalOutput
        
    }

    async generateAISuggestions(userInput) {
        //return;
        
        this.isProcessingQueuedKeys = true; // Lock queue processing at start
        // The flag should already be set by the caller, but ensure it's true
        this.isGeneratingAISuggestions = true;

        // Performance measurement - start
        const startTime = performance.now();
        
        // ALWAYS increment request ID to ensure no caching - force fresh generation every time
        const requestId = ++this.suggestionRequestId;
        const inputAtRequest = userInput;

        // Don't generate suggestions for empty input
        if (!userInput) {
            if (requestId !== this.suggestionRequestId) return;
            this.aiSuggestedWords = [];
            this.showSuggestions([]);
            if (this.autocompleteText) {
                this.autocompleteText.setText('');
            }
            // Mark processing as complete - important even for empty input
            this.keyProcessingComplete = true;
            this.isProcessingQueuedKeys = false;
            return;
        }
    
        // Get all text up to the last word boundary
        const lastSpaceIndex = userInput.lastIndexOf(' ');
        const lastNewlineIndex = userInput.lastIndexOf('\n');
        const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
        const context = lastBreakIndex >= 0 ? userInput.slice(0, lastBreakIndex + 1) : userInput;
        
        // Don't show "Loading..." as it causes unnecessary clearing of existing suggestions
        // Suggestions will be displayed when ready
        
        // Don't wait for render frame - process immediately
        
        // Get the LLM engine from the registry manager
        const llmEngine = registryManager.get('llmEngine');
        
        // Check if engine exists and has the required MLC-AI WebLLM API
        const isValidEngine = llmEngine && 
            typeof llmEngine === 'object' && 
            llmEngine.chat && 
            llmEngine.chat.completions && 
            typeof llmEngine.chat.completions.create === 'function';
            
        if (!isValidEngine) {
   
            if (requestId !== this.suggestionRequestId) return;
            // Mark processing as complete even when engine is missing or invalid
            this.keyProcessingComplete = true;
            this.isProcessingQueuedKeys = false;
            
            // Clear suggestions when engine is not available
            this.aiSuggestedWords = [];
            this.showSuggestions([]);
            if (this.autocompleteText) {
                this.autocompleteText.setText('');
            }
            
            // Try to recover the engine
            registryManager.attemptEngineRecovery((recoveredEngine) => {
                const isRecoveredValid = recoveredEngine && 
                    typeof recoveredEngine === 'object' && 
                    recoveredEngine.chat && 
                    recoveredEngine.chat.completions && 
                    typeof recoveredEngine.chat.completions.create === 'function';
                    
                if (isRecoveredValid) {
                    // Use current user input instead of the old inputAtRequest
                    // This ensures we generate suggestions for the current state
                    if (this.userInput && (this.userInput.endsWith(' ') || this.userInput.endsWith('\n') || this.userInput.endsWith('\r'))) {
                        this.generateAISuggestions(this.userInput);
                    }
                }
            });
            return;
        }
    
        // Optimize context - only include last 50 characters of context to reduce token count
        const optimizedContext = context.length > 200 ? '...' + context.slice(-200) : context;
        const trimmedcontext = "question: " + this.currentPrompt + ": \nanswer: " + optimizedContext.trim();
        // Add retry logic
        try {
            // Double-check the engine is still valid before calling it
            const isStillValid = llmEngine && 
                typeof llmEngine === 'object' && 
                llmEngine.chat && 
                llmEngine.chat.completions && 
                typeof llmEngine.chat.completions.create === 'function';
                
            if (!isStillValid) {
                throw new Error('LLM engine is not available or does not have required API');
            }
            


            // Use the engine from registry manager (MLC-AI WebLLM engine)
            // Note: We don't reset the chat session as it causes conversation state corruption.
            // The temperature, frequency_penalty, and other parameters provide sufficient randomness.
            
            const response = await llmEngine.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful AI that suggests the next possible words based on the given context. Use English only."
                    },
                    {
                        role: "user",
                        content: trimmedcontext
                    }
                    ],
                max_tokens: 3,
                n: 5,
                top_logprobs: 5,
                logprobs: true,
                temperature: this.temperature,
                frequency_penalty: this.frequencyPenalty,
                presence_penalty: this.presencePenalty,
                repetition_penalty: this.repetitionPenalty,
                stream: false,
                //seed: Math.floor(Math.random() * 10000000), // Different seed each time
                // Add more randomization parameters
                
            });

            console.log("DEBUG: LLM raw response:", response);
            const choices = response.choices || [];
            if (choices.length === 0) {
                throw new Error('LLM engine returned no choices');
            }



            // Extract logprobs from the first choice
            const logprobs = response.choices[0].logprobs.content[0].top_logprobs;

            
            
            // Only process the result if this is the latest request AND input matches current userInput
            if (requestId !== this.suggestionRequestId || inputAtRequest !== this.userInput) {
                this.isProcessingQueuedKeys = false;
                return;
            }

            if (!logprobs || !Array.isArray(logprobs) || logprobs.length === 0) {
                this.aiSuggestedWords = [];
                this.showSuggestions([]);
                if (this.autocompleteText) {
                    this.autocompleteText.setText('');
                }
                this.isProcessingQueuedKeys = false;
                return;
            }

            // PRIORITY 1: Extract and filter words from choices FIRST
            let words = [];
            
            // Log the actual tokens and their probabilities from choices
            if (choices && Array.isArray(choices)) {
                choices.forEach((item, index) => {
                    const topWord = item.message.content.split(" ")[0];
                    if (topWord) {
                        const cleanedWord = topWord.trim().replace(/^[\p{P}]+|[\p{P}]+$/gu, "");
                        words.push(cleanedWord);
                    }
                });
            }
            
            // Filter the choices words
            const filtered_choices = words.filter(word => 
                word && 
                word.length > 1 && 
                !stopwords.includes(word.toLowerCase())
            );
            
            
            // PRIORITY 2: Only if we don't have enough words, add from logprobs
            let finalWords = [];
            if (filtered_choices.length < this.topKValue) {
            
                // Extract tokens from logprobs as fallback
                const logprobWords = logprobs
                    .map(item => item.token)
                    .map(word => word.trim())
                    .map(word => word.replace(/^[\p{P}]+|[\p{P}]+$/gu, ""));
                
                // Filter logprob words
                const filtered_logprobs = logprobWords.filter(word => 
                    word && 
                    word.length > 1 && 
                    !stopwords.includes(word.toLowerCase())
                );
                
                
                // Combine: choices first, then logprobs
                finalWords = [...filtered_choices, ...filtered_logprobs];
            } else {
                finalWords = filtered_choices;
            }
            
            
            // Deduplicate and limit to topKValue
            const uniqueSuggestedWords = Array.from(new Set(finalWords)).slice(0, Math.max(this.topKValue, 1));
            console.log("DEBUG: Unique suggestions to display:", uniqueSuggestedWords);

            // Convert to lowercase
            const lowercasedWords = uniqueSuggestedWords.map(word => word.toLowerCase());
            
            // Update suggestions and UI
            this.aiSuggestedWords = lowercasedWords;
            this.showSuggestions(lowercasedWords);
            
            // Force cache invalidation to ensure cursor updates (especially for empty suggestions)
            if (this._cachedValues) {
                this._cachedValues.lastAutocomplete = null; // Invalidate autocomplete cache
            }
            
            // Always update cursor to reflect current state (including empty suggestions)
            this.updateCursor();

            // Only track performance issues
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`AI suggestions completed in ${duration.toFixed(1)}ms`);
            
        } catch (error) {
            console.error("Error generating AI suggestions:", error);
        }
            
        this.isProcessingQueuedKeys = false; // Unlock queue processing at end
        // Don't reset isGeneratingAISuggestions here - let generateAISuggestionsWithQueue handle it
        
    }

    // Template methods with customization hooks
    /**
     * Create the prompt text box at a given y position.
     * @param {number} yStart - The y position for the TOP EDGE of the prompt box.
     * @returns {object} { boxBottom: number } - The bottom y-value after the prompt box.
     */
    createPromptTextBox(yStart) {
        const padding = this.getLargePadding();
        const mobilePadding = this.getStandardPadding();
        const centerX = this.cameras.main.centerX;
        const textBoxWidth = !this.isMobile
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
            : this.sys.game.canvas.width * (5 / 6);

        if (this.promptTextBox) {
            this.promptTextBox.clear();
        } else {
            this.promptTextBox = this.add.graphics();
        }

        if (this.promptText) {
            this.promptText.destroy();
        }

        const defaultText = "Your prompt will appear here...";
        let promptString = this.currentPrompt || defaultText;

        const deviceType = detectDeviceType();
        // Get prompt style using the method which now uses registry for UI scale
        const promptStyle = this.getPromptTextStyle();
        const fontSize = parseInt(promptStyle.fontSize);

        let promptTextObj, boxHeight, boxStyle, promptY;
        
        // Use consistent padding for mobile and desktop, reduced by 25%
        const effectivePadding = (this.isMobile ? 20 : padding) * 0.75;
        const style = {
            ...promptStyle,
            wordWrap: { width: textBoxWidth - effectivePadding * 2 }
        };

        // Calculate fixed height for 2 lines of text (consistent positioning)
        const lineHeight = fontSize * 1.2; // Standard line spacing
        const minLinesHeight = lineHeight * 2; // Height for 2 lines
        const minHeight = minLinesHeight + effectivePadding * 2;
        
        // Apply max height cap
        const maxHeight = this.isMobile ? 300 : 220;
        boxHeight = Math.min(minHeight, maxHeight);
        
        // yStart is the TOP EDGE of the box
        promptY = yStart;
        
        // Create text with calculated position
        const textCenterY = promptY + boxHeight / 2;
        promptTextObj = this.add.rexBBCodeText(
            centerX,
            textCenterY,
            promptString,
            style
        ).setOrigin(0.5, 0.5);
        
        boxStyle = this.getPromptBoxStyle();
        
        // Draw the box
        this.promptTextBox.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.promptTextBox.fillRoundedRect(
            centerX - textBoxWidth / 2,
            promptY,
            textBoxWidth,
            boxHeight,
            boxStyle.cornerRadius
        );
        if (boxStyle.hasOutline) {
            this.promptTextBox.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
            this.promptTextBox.strokeRoundedRect(
                centerX - textBoxWidth / 2,
                promptY,
                textBoxWidth,
                boxHeight,
                boxStyle.cornerRadius
            );
        }
        
        this.promptText = promptTextObj;
        this.promptTextBox.setDepth(102);
        this.promptText.setDepth(103);

        this.updatePromptBasedOnLevel();

        // Return the bottom y-value for stacking and the actual box position/size for debug
        return {
            boxBottom: promptY + boxHeight,
            boxX: centerX - textBoxWidth / 2,
            boxY: promptY,
            boxWidth: textBoxWidth,
            boxHeight: boxHeight
        };
    }

    createInputTextBox() {
        const sm = this.scalingManager;
        // Set padding separately for mobile vs desktop, and always scale
        const padding = this.isMobile ? sm.scaleValue(28) : sm.scaleValue(20);

        // Calculate stats box width based on content, always scaled
        // Use the same logic as createWordCountDisplay for consistency
        // Create temporary text objects to measure content width
        const deviceType = detectDeviceType();
        const uiScale = sm.uiScale || 1;
        const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);

        // Labels with maximum expected values
        const labels = [
            { text: "Original Words:", value: "999" },
            { text: "AI Words:", value: "999" },
            { text: "Current Streak:", value: "999" },
            { text: "Best Streak:", value: "999" }
        ];

        // Create temporary text objects to measure
        const tempTexts = [];
        const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
        tempTexts.push(titleTemp);

        let maxLabelWidth = 0;
        labels.forEach(({ text, value }) => {
            const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
            const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
            const iconSpace = sm.scaleValue(35);
            const rowWidth = iconSpace + labelTemp.width + valueTemp.width + padding;
            maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
            tempTexts.push(labelTemp, valueTemp);
        });

        // Clean up temporary text objects
        tempTexts.forEach(text => text.destroy());

        // Calculate stats box width: content width + scaled padding, min/max enforced
        const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
        const customWidth = Math.max(maxLabelWidth + padding * 2, minBoxWidth);

        // Use this width for layout below
        this.uiBoxWidth = customWidth;

        const textBoxHeight = SCENE_CONFIG.BOX_DIMENSIONS.INPUT_HEIGHT;

        // Calculate position below Word Stats panel and prompt box
        const statsBoxHeight = sm.scaleValue(130);
        const statsDisplayY = this.menuBarHeight + padding;
        const statsBottomEdge = statsDisplayY + statsBoxHeight;

        // Use configuration constants for offsets WITH SCALING
        const promptOffset = this.isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_PROMPT_OFFSET_BELOW_STATS)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.PROMPT_OFFSET_BELOW_STATS);
        const promptY = statsBottomEdge + promptOffset;
        const promptBoxHeight = sm.scaleValue(80);
        const promptBottomEdge = promptY + promptBoxHeight;

        // Use configuration constants for input offset WITH SCALING
        const inputOffset = this.isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_INPUT_OFFSET_BELOW_PROMPT)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.INPUT_OFFSET_BELOW_PROMPT);
        const textBoxY = promptBottomEdge + inputOffset;

        // Clear any existing elements first
        if (this.inputTextBorder) {
            this.inputTextBorder.destroy();
            this.inputTextBorder = null;
        }

        if (this.inputText) {
            this.inputText.destroy();
            this.inputText = null;
        }

        if (this.autocompleteText) {
            this.autocompleteText.destroy();
            this.autocompleteText = null;
        }

        // Create a fresh border
        const boxStyle = this.getInputBoxStyle();
        this.inputTextBorder = this.add.graphics();
        this.inputTextBorder.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.inputTextBorder.fillRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2,
            textBoxY,
            this.uiBoxWidth,
            textBoxHeight,
            boxStyle.cornerRadius
        ).setDepth(19);

        if (boxStyle.hasOutline) {
            this.inputTextBorder.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
            this.inputTextBorder.strokeRoundedRect(
                this.cameras.main.centerX - this.uiBoxWidth / 2,
                textBoxY,
                this.uiBoxWidth,
                textBoxHeight,
                boxStyle.cornerRadius
            ).setDepth(20);
        }

        // Get input text style from textStyles.js (same approach as prompt text)
        const inputTextStyle = this.getInputTextStyle();
        const textStyle = {
            ...inputTextStyle,
            wordWrap: { width: this.uiBoxWidth - padding * 2 }
        };

        // Use scaled padding for text position
        this.inputText = this.add.rexBBCodeText(
            this.cameras.main.centerX - this.uiBoxWidth / 2 + padding,
            textBoxY + padding,
            "_",
            textStyle
        ).setOrigin(0, 0);

        // Ensure visibility and proper depth
        this.inputText.setVisible(true).setDepth(25);

        // Reset user input
        this.userInput = '';

        // Force an immediate cursor update to ensure text is visible
        this.cursorVisible = true;

        this.updateCursor();

        // Trigger suggestions for empty input immediately
        this.generateAISuggestions('');

        // Set up input handlers after text objects are created
        this.setupInputHandlers();
    }

    // Initialize key handlers map
    initializeKeyHandlers() {
        this.keyHandlers = {
            ' ': this.handleSpaceKey.bind(this),
            'Tab': this.handleTabKey.bind(this),
            'Enter': this.handleEnterKey.bind(this),
            'Backspace': this.handleBackspaceKey.bind(this)
        };
    }

    // Handle space key
    handleSpaceKey(event, done) {
        
        // Skip if we're processing mobile input to avoid double spaces
        if (this.isMobile && this._processingMobileInput) {
            if (done) done();
            return;
        }
        
        // Record the timestamp of the word boundary
        this._lastWordBoundaryTime = Date.now();
        // Set flag immediately to indicate AI suggestions are being generated
        this.isGeneratingAISuggestions = true;
        
        try {
            // Safely handle word checking with maximum safeguards
            if (this.userInput && typeof this.userInput === 'string') {
                const trimmedInput = this.userInput.trim();
                if (trimmedInput && trimmedInput.length > 0) {
                    const words = trimmedInput.split(" ");
                    if (words && Array.isArray(words) && words.length > 0) {
                        const lastWordIndex = words.length - 1;
                        if (lastWordIndex >= 0) {
                            const lastWord = words[lastWordIndex];
                            if (lastWord && typeof lastWord === 'string' && lastWord.length > 0) {
                                const lastWordLower = lastWord.toLowerCase();
                                
                                // Check if AI suggested words array exists and is an array before using .some()
                                const aiWordsValid = this.aiSuggestedWords && 
                                    Array.isArray(this.aiSuggestedWords) && 
                                    this.aiSuggestedWords.length > 0;
                                    
                                let isAIWord = false;
                                if (aiWordsValid) {
                                    isAIWord = this.aiSuggestedWords.some(word => {
                                        return word && typeof word === 'string' && word.toLowerCase && word.toLowerCase() === lastWordLower;
                                    });
                                }
                                
                                if (isAIWord) {
                                    // In hard mode, delete the AI word immediately
                                    if (this.mode && this.mode === 'hard') {
                                        // Delete the word before showing feedback
                                        if (typeof this.deleteAIWord === 'function') {
                                            this.deleteAIWord(lastWord);
                                        }
                                        // Show feedback after deletion
                                        if (typeof this.showBlockFeedback === 'function') {
                                            this.showBlockFeedback(lastWord);
                                        }
                                        // Sync the hidden input after deletion
                                        if (this._hiddenInput) {
                                            this._hiddenInput.value = this.userInput;
                                        }
                                        // FIX: Still need to count AI word attempts and break streak
                                        this.updateFailsCounter(false);
                                    } else {
                                        // Easy mode - just update counter and shake
                                        this.updateFailsCounter(false);
                                        this.shakeScreen();
                                    }
                                } else {
                                    this.updateFailsCounter(true);
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error processing space key:", error);
            // Continue even if there's an error with word checking
        }
        
        // NOW clear old suggestions after checking the word
        this.aiSuggestedWords = [];
        this.showSuggestions([]);
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // Reset timer when space is pressed (hard mode only)
        if (this.mode === 'hard') {
            this.timerValue = SCENE_CONFIG.TIMER.DEFAULT_VALUE;
            if (this.timerText) {
                this.timerText.setText('0:20');
            }
        }
        
        // Only add space if not on mobile (mobile handles this through the hidden input)
        if (!this.isMobile) {
            this.userInput += " ";
        }
        // Sync the hidden input after adding space
        if (this._hiddenInput) {
            this._hiddenInput.value = this.userInput;
        }
        this.updateCursor();
        // Block queue until async suggestion generation is fully complete
        this.generateAISuggestionsWithQueue(done);
    }

    // Handle Tab key
    handleTabKey(event, done) {
        // Safely call preventDefault if available (for queued events, this may not exist)
        if (typeof event.preventDefault === "function") {
            event.preventDefault();
        } else if (event.originalEvent && typeof event.originalEvent.preventDefault === "function") {
            event.originalEvent.preventDefault();
        }
        
        if (this.aiSuggestedWords && this.aiSuggestedWords.length > 0) {
            const lastSpaceIndex = this.userInput.lastIndexOf(' ');
            const lastNewlineIndex = this.userInput.lastIndexOf('\n');
            const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
            const currentWord = lastBreakIndex >= 0 ? this.userInput.slice(lastBreakIndex + 1) : this.userInput;
            const previousContent = lastBreakIndex >= 0 ? this.userInput.slice(0, lastBreakIndex + 1) : '';

            let suggestionToUse = null;
            if (!currentWord || currentWord.endsWith(' ') || currentWord.endsWith('\n')) {
                suggestionToUse = this.aiSuggestedWords[0];
            } else {
                suggestionToUse = this.aiSuggestedWords.find(word =>
                    word.toLowerCase().startsWith(currentWord.toLowerCase())
                );
            }
            
            if (suggestionToUse) {
                // In hard mode, prevent using Tab to select AI words
                if (this.mode === 'hard') {
                    // Show feedback but don't add the word
                    if (typeof this.showBlockFeedback === 'function') {
                        this.showBlockFeedback(suggestionToUse);
                    }
                    // FIX: Still need to count AI word attempts and break streak
                    this.updateFailsCounter(false);
                    // Don't add the word to input
                    if (done) done();
                    return;
                } else {
                    // Easy mode - allow Tab completion
                    this.userInput = previousContent + suggestionToUse + ' ';
                    this.updateFailsCounter(false);
                    this.shakeScreen();
                    
                    this.updateCursor();
                    // Block queue until async suggestion generation is fully complete
                    this.generateAISuggestionsWithQueue(done);
                    return;
                }
            }
        }
        
        if (done) done();
    }

    // Handle Enter key
    handleEnterKey(event, done) {
        // Skip if we're processing mobile input
        if (this.isMobile && this._processingMobileInput) {
            if (done) done();
            return;
        }
        
        // Record the timestamp of the word boundary
        this._lastWordBoundaryTime = Date.now();
        // Set flag immediately to indicate AI suggestions are being generated
        this.isGeneratingAISuggestions = true;
        
        // Safely handle word checking with the same safety pattern
        if (this.userInput && this.userInput.trim()) {
            const words = this.userInput.trim().split(" ");
            if (words && words.length > 0) {
                const lastWord = words[words.length - 1];
                if (lastWord && lastWord.length > 0) {
                    const lastWordLower = lastWord.toLowerCase();
                    // Check if AI suggested words array exists and is an array before using .some()
                    const isAIWord = this.aiSuggestedWords && 
                        Array.isArray(this.aiSuggestedWords) &&
                        this.aiSuggestedWords.some(word => word && word.toLowerCase && word.toLowerCase() === lastWordLower);
                    if (isAIWord) {
                        // In hard mode, delete the AI word immediately
                        if (this.mode === 'hard') {
                            // Delete the word before showing feedback
                            if (typeof this.deleteAIWord === 'function') {
                                this.deleteAIWord(lastWord);
                            }
                            // Show feedback after deletion
                            if (typeof this.showBlockFeedback === 'function') {
                                this.showBlockFeedback(lastWord);
                            }
                            // Sync the hidden input after deletion
                            if (this._hiddenInput) {
                                this._hiddenInput.value = this.userInput;
                            }
                            // FIX: Still need to count AI word attempts and break streak
                            this.updateFailsCounter(false);
                        } else {
                            // Easy mode - just update counter and shake
                            this.updateFailsCounter(false);
                            this.shakeScreen();
                        }
                    } else {
                        this.updateFailsCounter(true);
                    }
                }
            }
        }
        
        // NOW clear old suggestions after checking the word
        this.aiSuggestedWords = [];
        this.showSuggestions([]);
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // Reset timer when Enter is pressed (hard mode only)
        if (this.mode === 'hard') {
            this.timerValue = SCENE_CONFIG.TIMER.DEFAULT_VALUE;
            if (this.timerText) {
                this.timerText.setText('0:20');
            }
        }
        
        // Only add newline if not on mobile (mobile handles this through the hidden input)
        if (!this.isMobile) {
            this.userInput += "\n";
        }
        this.updateCursor();
        // Block queue until async suggestion generation is fully complete
        this.generateAISuggestionsWithQueue(done);
    }

    // Handle Backspace key
    handleBackspaceKey(event, done) {
        // Skip if we're processing mobile input
        if (this.isMobile && this._processingMobileInput) {
            if (done) done();
            return;
        }
        
        this.userInput = this.userInput.slice(0, -1);
        
        // Check if we're at a word boundary after backspace
        const atWordBoundary = this.userInput.endsWith(' ') || this.userInput.endsWith('\n') || this.userInput.endsWith('\r');
        
        // Clear suggestions ONLY when at word boundary
        if (atWordBoundary) {
            this.aiSuggestedWords = [];
            this.showSuggestions([]);
            if (this.autocompleteText) {
                this.autocompleteText.setText('');
            }
        }
        
        this.updateCursor();
        
        // Complete immediately without regenerating suggestions
        if (done) done();
    }

    // Handle printable characters
    handlePrintableCharacter(event, done) {
        // Skip if we're processing mobile input
        if (this.isMobile && this._processingMobileInput) {
            if (done) done();
            return;
        }
        
        this.userInput += event.key;

        // Reset timer when a period is typed
        if (event.key === '.') {
            this.timerValue = 20;
            if (this.timerText) {
                this.timerText.setText('0:20');
            }
        }

        this.updateCursor();
        
        // For printable characters, we don't need to generate suggestions
        // This speeds up typing by avoiding unnecessary async operations
        if (done) done();
    }

    // Updated: handleSingleKeyEvent now supports async queueing
    handleSingleKeyEvent(event, done) {
        // This is the main logic extracted from original keydown handler's try block
        try {
            // Skip if we're shutting down to prevent stray key processing
            if (this.isShuttingDown) { if (done) done(); return; }

            // Skip mini vibrate to avoid any delays
            const ignoreKeys = [
                'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
                'Escape', 'F1', 'F2', 'F3', 'F4', 'F5',
                'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
                'NumLock', 'ScrollLock', 'Pause', 'Insert', 'Home',
                'PageUp', 'Delete', 'End', 'PageDown', 'ArrowRight',
                'ArrowLeft', 'ArrowDown', 'ArrowUp'
            ];

            // Update lastKeydownTime at the very start for accurate timing
            this._lastKeydownTime = Date.now();

            this.isActivelyTyping = true;
            if (!this.cursorVisible) this.cursorVisible = true;

            // Start the timer on first keystroke if it hasn't been started yet (hard mode only)
            if (!this.timerStarted && this.mode === 'hard') {
                // Start the countdown timer
                this.timerEvent = this.time.addEvent({
                    delay: 1000,
                    callback: this.updateTimer,
                    callbackScope: this,
                    loop: true
                });
                this.timerStarted = true;
            }

            this.inputActive = true; // Legacy flag
            if (this.activeTimeout) {
                clearTimeout(this.activeTimeout);
            }
            this.activeTimeout = setTimeout(() => {
                this.isActivelyTyping = false;
            }, SCENE_CONFIG.ANIMATIONS.TYPING_TIMEOUT);

            if (ignoreKeys.includes(event.key)) {
                if (done) done();
                return;
            }

            // Initialize key handlers if not already done
            if (!this.keyHandlers) {
                this.initializeKeyHandlers();
            }

            // --- Main Key Processing Logic ---
            const handler = this.keyHandlers[event.key];
            
            if (handler) {
                // Use specific handler for known keys
                handler(event, done);
            } else if (event.key.length === 1) {
                // Handle printable characters
                this.handlePrintableCharacter(event, done);
            } else {
                // Unknown key, just finish
                if (done) done();
            }
        } catch (error) {
            console.error("Error processing single key event:", error, event);
            if (done) done();
        }
    }
    
    // Helper for queue-aware async suggestion generation
    generateAISuggestionsWithQueue(done) {
        // Only generate suggestions if the last character is a space or linebreak
        const currentInput = this.userInput;
        if (
            currentInput &&
            (currentInput.endsWith(' ') || currentInput.endsWith('\n') || currentInput.endsWith('\r'))
        ) {
            // Call the async suggestion generator and call done when finished
            this.generateAISuggestions(currentInput).then(() => {
                // Don't clear the flag here - it will be cleared when the next key is pressed
                // or after a timeout
                if (done) done();
                
                // Set a timeout to clear the flag after a reasonable time
                // This gives the user a window to type and trigger the penalty
                if (this._aiGenerationTimeout) {
                    clearTimeout(this._aiGenerationTimeout);
                }
                this._aiGenerationTimeout = setTimeout(() => {
                    this.isGeneratingAISuggestions = false;
                    this._aiGenerationTimeout = null;
                }, 1000); // 1 second window
            }).catch(() => {
                // Don't clear the flag here either
                if (done) done();
                
                // Set timeout for error case too
                if (this._aiGenerationTimeout) {
                    clearTimeout(this._aiGenerationTimeout);
                }
                this._aiGenerationTimeout = setTimeout(() => {
                    this.isGeneratingAISuggestions = false;
                    this._aiGenerationTimeout = null;
                }, 1000);
            });
        } else {
            // No suggestions needed, clear the flag but DON'T clear existing suggestions
            // Suggestions should persist until the next generation cycle
            this.isGeneratingAISuggestions = false;
            if (done) done();
        }
    }


    triggerProcessQueue() {
        // Don't process if shutting down, already processing, or AI suggestions are being generated
        if (this.isShuttingDown || this.isProcessingQueuedKeys || !this.keyProcessingComplete) {
            return; 
        }
        
        // Don't process if queue is empty
        if (this.keyEventQueue.length === 0) {
            return;
        }

        // Set processing flag to prevent concurrent processing
        this.isProcessingQueuedKeys = true;
        this.keyProcessingComplete = false;
        
        // Use Phaser timer to avoid deep recursion and allow frame rendering
        this.time.delayedCall(0, this.processNextEventInQueue, [], this);
    }

    processNextEventInQueue() {
        // Exit if we're shutting down to prevent processing during scene transitions
        if (this.isShuttingDown) {
            this.isProcessingQueuedKeys = false;
            this.keyProcessingComplete = true;
            this.keyEventQueue = [];
            return;
        }

        if (this.keyEventQueue.length > 0) {
            const eventToProcess = this.keyEventQueue.shift();

            if (!eventToProcess || !eventToProcess.key) {
                this.isProcessingQueuedKeys = false;
                this.keyProcessingComplete = true;
                return;
            }

            try {
                this.handleSingleKeyEvent(eventToProcess, () => {
                    this.keyProcessingComplete = true;
                    if (this.keyEventQueue.length > 0) {
                        this.time.delayedCall(0, this.processNextEventInQueue, [], this);
                    } else {
                        this.isProcessingQueuedKeys = false;
                    }
                });
            } catch (error) {
                console.error("Error in handleSingleKeyEvent:", error);
                this.keyProcessingComplete = true;
                if (this.keyEventQueue.length > 0) {
                    this.time.delayedCall(0, this.processNextEventInQueue, [], this);
                } else {
                    this.isProcessingQueuedKeys = false;
                }
            }
        } else {
            this.isProcessingQueuedKeys = false;
            this.keyProcessingComplete = true;
        }
    }


    setupInputHandlers() {      
        // this.input.keyboard.on('keydown-H', () => {
        //     console.log("[HAPTIC TEST] Manual test triggered");
        //     this.testHapticFeedback();
        // });
        


        // First make sure we have a basic text displayed
        if (this.inputText) {
            // Force update with initial cursor state
            this.inputText.setText("_");
            this.cursorVisible = true;
        }
        
        this.input.keyboard.removeAllListeners('keydown');

        // Initialize properties for input processing
        this.lastKeyTime = 0;
        this.isActivelyTyping = false;
        this.lastKeyPressed = '';
        this.lastProcessedKey = null;
        this.lastKeyProcessTime = 0;
        this.keyEventQueue = [];
        this.isProcessingQueuedKeys = false;
        this.keyProcessingComplete = true;

        // Initialize deduplication map
        if (!this.keyEventDeduplicationMap) {
            this.keyEventDeduplicationMap = new Map();
        }

        // Clean up old entries periodically
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                const now = Date.now();
                const keysToDelete = [];
                this.keyEventDeduplicationMap.forEach((timestamp, key) => {
                    if (now - timestamp > 100) { // Remove entries older than 100ms
                        keysToDelete.push(key);
                    }
                });
                keysToDelete.forEach(key => this.keyEventDeduplicationMap.delete(key));
            }
        });

        // Create a more efficient debounce utility with a dynamic delay based on input length
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                // Cancel previous scheduled execution
                clearTimeout(timeout);
                
                // Calculate a dynamic delay based on input length
                // Longer text = slightly longer delay to prevent processing backlog
                const input = args[0] || '';
                const dynamicDelay = Math.min(wait, wait + Math.floor(input.length / 50) * 50);
                
                // Schedule new execution
                timeout = setTimeout(() => {
                    // Only execute if we're not shutting down
                    if (!this.isShuttingDown) {
                        func.apply(this, args);
                    }
                }, dynamicDelay);
            };
        }

        // Debounced suggestion generator with faster initial display
        this.debouncedGenerateAISuggestions = debounce((input) => {
            // Use a snapshot of input to prevent race conditions
            const currentInput = input;
            // Only generate suggestions if input matches current state
            if (currentInput === this.userInput && !this.isShuttingDown) {
                this.generateAISuggestions(currentInput);
            }
        }, SCENE_CONFIG.DEBOUNCE.SUGGESTIONS); // Use config constant

        // Only set up keyboard listeners for desktop
        // Mobile input is handled entirely through the hidden input element
        if (!this.isMobile) {
            this.input.keyboard.on("keydown", (event) => {
            // Always define now for debounce and event queue logic
            const now = Date.now();

            // Block all input if penalty or lockout is active
            if (this._fastTypingPenaltyActive || this._fastTypingLockoutActive) {
                if (typeof event.preventDefault === "function") event.preventDefault();
                return;
            }

            // Only apply penalty logic after the first word (i.e., after a space or newline is present)
            const isFirstWord = !this.userInput || !/[\s\n]/.test(this.userInput);

            const isPrintable = event.key && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
            if (!isFirstWord && isPrintable && this._lastWordBoundaryTime > 0) {
                const now = Date.now();
                const sinceBoundary = now - this._lastWordBoundaryTime;
                if (sinceBoundary < this.fastTypingCooldownMs) {
                    this._triggerFastTypingPenalty();
                    this._fastTypingLockoutActive = true;
                    if (typeof event.preventDefault === "function") event.preventDefault();
                    return;
                }
            }

            // Lockout for word boundary keys as well
            if (!isFirstWord && (event.key === " " || event.key === "Enter") && this._lastWordBoundaryTime > 0) {
                const now = Date.now();
                const sinceBoundary = now - this._lastWordBoundaryTime;
                if (sinceBoundary < this.fastTypingCooldownMs) {
                    this._triggerFastTypingPenalty();
                    this._fastTypingLockoutActive = true;
                    if (typeof event.preventDefault === "function") event.preventDefault();
                    return;
                }
            }

            // Skip if we're shutting down
            if (this.isShuttingDown) return;

            // Prevent default browser behavior for all keys we handle to avoid browser shortcuts
            // (e.g., Firefox Quick Find triggered by apostrophe, Chrome shortcuts, etc.)
            const modifierKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'];
            if (!modifierKeys.includes(event.key) && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            // Create unique key for deduplication
            const eventKey = `${event.key}_${event.code}_${event.timeStamp}`;
            
            // Check for duplicate events (browser repeat or multiple event handlers)
            const lastEventTime = this.keyEventDeduplicationMap.get(eventKey);
            if (lastEventTime && (now - lastEventTime) < SCENE_CONFIG.DEBOUNCE.KEY_REPEAT_FILTER) {
                return; // Skip duplicate event
            }
            
            // Record this event
            this.keyEventDeduplicationMap.set(eventKey, now);
            this.lastKeyPressed = event.key;
            this.lastKeyTime = now;

            // Queue ALL keys for proper ordering
            const enqueuedEvent = {
                key: event.key,
                code: event.code,
                timestamp: now,
                altKey: event.altKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
                // Include the original event for reference if needed
                originalEvent: event
            };
            
            this.keyEventQueue.push(enqueuedEvent);

                // Start processing the queue if not already running
                this.triggerProcessQueue();
            });
        }

        // Set up cursor blinking timer
        if (this.cursorTimer) {
            this.cursorTimer.remove();
        }
        
        this.cursorTimer = this.time.addEvent({
            delay: SCENE_CONFIG.ANIMATIONS.CURSOR_BLINK,  // Use config constant
            loop: true,
            callback: () => {
                // Only blink cursor when not actively typing
                if (!this.isActivelyTyping && !this.isShuttingDown) {
                    this.cursorVisible = !this.cursorVisible;
                    this.updateCursor();
                }
            }
        });

        // Make sure cursor is initially visible
        this.cursorVisible = true;
        this.updateCursor();

        // Make input area interactive
        if (this.inputTextBorder) {
            // Calculate the actual Y position of the input box
            const padding = 20;
            const sm = this.scalingManager;
            const menuBarHeight = this.menuBarHeight || sm.scaleValue(100);
            let yCursor = menuBarHeight + sm.scaleValue(20); // matches relayoutScene
            yCursor += sm.scaleValue(130); // stats box height
            // Use configuration constants WITH SCALING for prompt offset
            yCursor += this.isMobile 
                ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_PROMPT_OFFSET_BELOW_STATS)
                : sm.scaleValue(SCENE_CONFIG.LAYOUT.PROMPT_OFFSET_BELOW_STATS);
            yCursor += this.createPromptTextBox(yCursor).boxBottom + sm.scaleValue(20) - yCursor; // prompt box
            // Now yCursor is the top of the input box

            const inputBoxY = yCursor;
            // Use a larger hit area height for mobile to make it easier to tap
            const inputBoxHeight = sm.scaleValue(this.isMobile ? 340 : 240);
            // Store these values for reference in other methods
            this.inputBoxY = inputBoxY;
            this.inputBoxHeight = inputBoxHeight;

            // Calculate the actual box dimensions and position
            const boxX = sm.centerX() - this.uiBoxWidth / 2;
            const boxWidth = this.uiBoxWidth;
            
            // Store these values for reference in other methods
            this.inputBoxX = boxX;
            this.inputBoxWidth = boxWidth;

            // Create a larger hit area for mobile devices
            const hitAreaPadding = this.isMobile ? 20 : 0; // Extra padding around the hit area for mobile
            
            this.inputTextBorder.setInteractive(
                new Phaser.Geom.Rectangle(
                    boxX - hitAreaPadding,
                    inputBoxY - hitAreaPadding,
                    boxWidth + (hitAreaPadding * 2),
                    inputBoxHeight + (hitAreaPadding * 2)
                ),
                Phaser.Geom.Rectangle.Contains
            ).setDepth(20)
            .on('pointerdown', (pointer) => {
                // For desktop, focus the game canvas to ensure keyboard events are received
                if (this.isDesktop) {
                    if (this.sys && this.sys.game && this.sys.game.canvas) {
                        this.sys.game.canvas.focus();
                    }
                }
                // For mobile, focus the hidden input
                this.focusHiddenInput();
                
                // Create click effect at the actual pointer position instead of center of screen
                this.createInputBoxClickEffect(
                    pointer.x,
                    pointer.y
                );
                
                // Log for debugging
                console.log("[INPUT] Input box clicked at:", pointer.x, pointer.y);
                console.log("[INPUT] Input box dimensions:", boxX, inputBoxY, boxWidth, inputBoxHeight);
            });
        }
        // Set up hidden input for mobile typing
        this.setupHiddenInput();
    }

    /**
     * Triggers the fast typing penalty: blocks keyboard input and shows a modal for 10 seconds.
     */
    async _triggerFastTypingPenalty() {
        if (this._fastTypingPenaltyActive) return;
        this._fastTypingPenaltyActive = true;
        this._fastTypingLockoutActive = true;

        // Reset word boundary tracking to prevent further penalties until next boundary
        this._lastWordBoundaryTime = 0;

        // Pause the timer while penalty is active
        if (this.timerEvent && !this.timerEvent.paused) {
            this.timerEvent.paused = true;
        }

        // Show modal
        const warning = Phaser.Utils.Array.GetRandom
            ? Phaser.Utils.Array.GetRandom(this._warningMessages)
            : this._warningMessages[Math.floor(Math.random() * this._warningMessages.length)];

        // Modal dimensions
        const width = Math.min(500, this.sys.game.canvas.width * 0.8);
        const height = 180;
        // On mobile, position modal higher to avoid keyboard
        const modalTopY = this.isMobile ? 120 : (this.cameras.main.centerY - height / 2);
        const x = this.cameras.main.centerX - width / 2;
        const y = modalTopY;

        // Overlay
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000, 0.7
        ).setOrigin(0, 0).setDepth(1001);

        // Modal background
        const modalBg = this.add.graphics();
        modalBg.fillStyle(0x222222, 0.98);
        modalBg.fillRoundedRect(x, y, width, height, 18);
        modalBg.lineStyle(4, 0xff0000, 0.7);
        modalBg.strokeRoundedRect(x, y, width, height, 18);
        modalBg.setDepth(1002);

        // Warning text
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const warningStyle = getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
        const text = this.add.text(
            this.cameras.main.centerX,
            y + 50,
            warning,
            {
                ...warningStyle,
                color: '#ff0000',
                align: 'center',
                wordWrap: { width: width - 40 }
            }
        ).setOrigin(0.5).setDepth(1003);

        // Countdown timer with label
        const timerStyle = getTextStyle('effects', deviceType, this.mode || 'basic', uiScale);
        const timerText = this.add.text(
            this.cameras.main.centerX,
            y + height - 32,
            `Penalty: ${this.fastTypingPenaltySeconds}s`,
            {
                ...timerStyle,
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1003);

        // Store modal elements for cleanup
        this._fastTypingModal = [overlay, modalBg, text, timerText];

        // Force Phaser to render the modal before continuing
        await Promise.resolve();

        // Countdown logic
        let secondsLeft = this.fastTypingPenaltySeconds;
        timerText.setText(`Penalty: ${secondsLeft}s`);
        this._fastTypingPenaltyTimeout = this.time.addEvent({
            delay: 1000,
            repeat: this.fastTypingPenaltySeconds - 1,
            callback: () => {
                secondsLeft--;
                timerText.setText(`Penalty: ${secondsLeft}s`);
                if (secondsLeft <= 0) {
                    this._clearFastTypingPenalty();
                }
            }
        });
    }

    /**
     * Clears the fast typing penalty and removes the modal.
     */
    _clearFastTypingPenalty() {
        this._fastTypingPenaltyActive = false;
        this._fastTypingLockoutActive = false;
        // Reset word boundary tracking to ensure next boundary is tracked
        this._lastWordBoundaryTime = 0;
        // Resume the timer when penalty ends
        if (this.timerEvent && this.timerEvent.paused) {
            this.timerEvent.paused = false;
        }
        if (this._fastTypingPenaltyTimeout) {
            this._fastTypingPenaltyTimeout.remove();
            this._fastTypingPenaltyTimeout = null;
        }
        if (this._fastTypingModal) {
            this._fastTypingModal.forEach(obj => obj && obj.destroy && obj.destroy());
            this._fastTypingModal = null;
        }
        this._lastKeydownTime = 0;
    }

    // Hidden HTML input for mobile typing (keyboard only, no visible overlay)
    setupHiddenInput() {
        // Only create hidden input for mobile devices
        // Remove any previous input
        if (this._hiddenInput) {
            // Clean up existing event listeners
            if (this._hiddenInputHandler) {
                this._hiddenInput.removeEventListener('input', this._hiddenInputHandler);
                this._hiddenInputHandler = null;
            }
            if (this._hiddenInputBlurHandler) {
                this._hiddenInput.removeEventListener('blur', this._hiddenInputBlurHandler);
                this._hiddenInputBlurHandler = null;
            }
            if (this._hiddenInputFocusHandler) {
                this._hiddenInput.removeEventListener('focus', this._hiddenInputFocusHandler);
                this._hiddenInputFocusHandler = null;
            }
            document.body.removeChild(this._hiddenInput);
            this._hiddenInput = null;
        }
        if (!this.isMobile) {
            // On desktop, do not create or use hidden input
            return;
        }
        
        // Detect iOS for special handling
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        // Create hidden input - use textarea for better mobile keyboard support
        const input = document.createElement('textarea');
        input.autocapitalize = 'sentences';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = 500;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.style.left = '-1000px';
        input.style.top = '0';
        input.style.width = '1px';
        input.style.height = '1px';
        input.style.fontSize = '16px'; // iOS won't zoom in if font size is 16px or larger
        
        // For iOS, add some additional styles to improve keyboard behavior
        if (isIOS) {
            input.style.fontSize = '16px'; // Prevent zoom on iOS
            input.style.transformOrigin = 'top left';
            input.style.transform = 'scale(1)';
            input.style.webkitTransform = 'scale(1)';
        }
        
        input.value = this.userInput;

        // Flag to prevent double processing
        this._processingMobileInput = false;

        // Store input handler as a property so it can be removed later
        this._hiddenInputHandler = () => {
            // Set flag to indicate we're processing mobile input
            this._processingMobileInput = true;
            const previousInput = this.userInput;
            this.userInput = input.value;

            // Only generate suggestions if the last character is a space or newline
            const lastChar = this.userInput.slice(-1);
            if (lastChar === ' ' || lastChar === '\n' || lastChar === '\r') {
                this.generateAISuggestionsWithQueue(() => {});
            }

            // For mobile, we'll handle word checking in the input handler
            // but NOT trigger the visual effects to prevent duplication
            if (lastChar === ' ' || lastChar === '\n') {
                let isAIWord = false; // Declare isAIWord in the outer scope
                
                const words = this.userInput.trim().split(/\s+/);
                if (words.length > 0) {
                    // Get the last word and clean it
                    let lastWord = words[words.length - 1];
                    // Store original word for feedback
                    const originalLastWord = lastWord;
                    // Remove punctuation for comparison
                    lastWord = lastWord.replace(/[.,!?;:]$/, '');
                    const lastWordLower = lastWord.toLowerCase();
                    
                    // Check if it's an AI word
                    isAIWord = this.aiSuggestedWords && 
                        Array.isArray(this.aiSuggestedWords) &&
                        this.aiSuggestedWords.some(word => word && word.toLowerCase() === lastWordLower);
                    
                    if (isAIWord) {
                        // In hard mode, delete the AI word from input
                        if (this.mode === 'hard') {
                            // Remove the last word from the array
                            words.pop();
                            // Reconstruct the input without the AI word
                            this.userInput = words.join(' ');
                            // Only add space if there are remaining words
                            if (this.userInput.length > 0) {
                                if (lastChar === ' ') {
                                    this.userInput += ' ';
                                } else if (lastChar === '\n') {
                                    this.userInput += '\n';
                                }
                            }
                            // Update the hidden input value to match
                            input.value = this.userInput;
                            // Move cursor to end
                            input.setSelectionRange(input.value.length, input.value.length);
                            // Show feedback if the method exists
                            if (typeof this.showBlockFeedback === 'function') {
                                this.showBlockFeedback(lastWord);
                            }
                        } else {
                            // Easy mode - just increment counter
                            this.aiWordCount++;
                        }
                    }
                }
                
            // Update UI elements (no visual progress bar)
            this.updateWordCountDisplay();
            this.updateStreakCounter(!isAIWord);
            }

            // Update cursor immediately for mobile
            this.updateCursor();
            
            // Clear the flag after a short delay
            setTimeout(() => {
                this._processingMobileInput = false;
            }, 50);
        };

        // Store blur handler as a property
        this._hiddenInputBlurHandler = () => {
            console.log("[KEYBOARD] Hidden input blur event");
            this.updateCursor();
        };
        
        // Store focus handler as a property
        this._hiddenInputFocusHandler = () => {
            console.log("[KEYBOARD] Hidden input focus event");
            // Create a visual indicator that the keyboard is active
            this.createInputBoxClickEffect(
                this.cameras.main.centerX,
                this.inputBoxY + this.inputBoxHeight / 2
            );
        };

        // Add event listeners
        input.addEventListener('input', this._hiddenInputHandler);
        input.addEventListener('blur', this._hiddenInputBlurHandler);
        input.addEventListener('focus', this._hiddenInputFocusHandler);

        document.body.appendChild(input);
        this._hiddenInput = input;
        
        // Log for debugging
        console.log("[KEYBOARD] Hidden input created and added to DOM");
    }

    focusHiddenInput() {
        console.log("[KEYBOARD] focusHiddenInput called");
        if (!this._hiddenInput) this.setupHiddenInput();
        if (!this._hiddenInput) return; // Guard: do nothing if still undefined (e.g., desktop)
        
        // Set the value to match current user input
        this._hiddenInput.value = this.userInput;
        
        // For iOS devices, we need to make the input visible temporarily to ensure focus works
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            // Make the input briefly visible but transparent
            this._hiddenInput.style.opacity = '0.01';
            this._hiddenInput.style.pointerEvents = 'auto';
            this._hiddenInput.style.left = '50%';
            this._hiddenInput.style.top = '50%';
            this._hiddenInput.style.transform = 'translate(-50%, -50%)';
            this._hiddenInput.style.width = '80%';
            this._hiddenInput.style.height = '40px';
        }
        
        // Focus the input to show keyboard
        this._hiddenInput.focus();
        
        // Move cursor to end
        this._hiddenInput.setSelectionRange(this._hiddenInput.value.length, this._hiddenInput.value.length);
        
        // For iOS, hide the input again after a short delay
        if (isIOS) {
            setTimeout(() => {
                this._hiddenInput.style.opacity = '0';
                this._hiddenInput.style.pointerEvents = 'none';
                this._hiddenInput.style.left = '-1000px';
                this._hiddenInput.style.top = '0';
                this._hiddenInput.style.width = '1px';
                this._hiddenInput.style.height = '1px';
                this._hiddenInput.style.transform = 'none';
            }, 100);
        }
        
        // Log keyboard detection state
        console.log("[KEYBOARD] Hidden input focused, checking keyboard detection setup");
        console.log("[KEYBOARD] _keyboardResizeHandler exists:", !!this._keyboardResizeHandler);
        console.log("[KEYBOARD] window.visualViewport exists:", !!window.visualViewport);
    }

    /**
     * Handle keyboard show event - shift canvas up to hide menu bar
     * @param {number} keyboardHeight - Height of the keyboard
     */
    onKeyboardShow(keyboardHeight) {
        console.log("[KEYBOARD] onKeyboardShow called, keyboardHeight:", keyboardHeight);
        console.log("[KEYBOARD] isMobile:", this.isMobile, "canvasShifted:", this._canvasShifted);
        
        if (!this.isMobile || this._canvasShifted) return;
        
        // Initialize scaling manager if not exists
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        const sm = this.scalingManager;
        
        // Calculate shift amount - only shift enough to show the input area
        // We want to keep the timer and word stats visible
        // menuBarHeight is already scaled, so we can use it directly
        const menuBarHeight = this.menuBarHeight || sm.scaleValue(200);
        // Shift up by about 40% of the menu bar height to keep stats visible
        const shiftAmount = Math.floor(menuBarHeight * 0.5);
        console.log("[KEYBOARD] Shifting canvas by:", shiftAmount, "px (menu bar height:", menuBarHeight, ", percentage: 40%)");
        
        // Apply transform to shift canvas up
        if (this.game && this.game.canvas) {
            console.log("[KEYBOARD] Applying canvas transform");
            this.game.canvas.style.transition = 'transform 0.3s ease-out';
            this.game.canvas.style.transform = `translateY(-${shiftAmount}px)`;
            this._canvasShifted = true;
            
            // Store the shift amount for other calculations
            this._canvasShiftAmount = shiftAmount;
            
            // Ensure input area is still visible
            this.ensureInputVisible(keyboardHeight);
        } else {
            console.log("[KEYBOARD] ERROR: game.canvas not available");
        }
    }

    /**
     * Handle keyboard hide event - reset canvas position
     */
    onKeyboardHide() {
        console.log("[KEYBOARD] onKeyboardHide called");
        console.log("[KEYBOARD] isMobile:", this.isMobile, "canvasShifted:", this._canvasShifted);
        
        if (!this.isMobile || !this._canvasShifted) return;
        
        // Defer canvas reset to next frame to avoid rendering conflicts
        this.time.delayedCall(0, () => {
            // Double-check game and canvas still exist
            if (!this.game || !this.game.canvas) {
                console.log("[KEYBOARD] Canvas no longer exists, skipping reset");
                return;
            }
            
            // Reset canvas position
            console.log("[KEYBOARD] Resetting canvas transform");
            this.game.canvas.style.transition = 'transform 0.3s ease-out';
            this.game.canvas.style.transform = 'translateY(0)';
            this._canvasShifted = false;
            this._canvasShiftAmount = 0;
            
            // Force a render update after transform
            if (this.game.renderer && typeof this.game.renderer.resize === 'function') {
                this.game.renderer.resize(this.game.canvas.width, this.game.canvas.height);
            }
        });
    }

    /**
     * Ensure the input area is visible when keyboard is shown
     * @param {number} keyboardHeight - Height of the keyboard
     */
    ensureInputVisible(keyboardHeight) {
        // This method can be extended to scroll to the input area if needed
        console.log("[KEYBOARD] Ensuring input visibility with keyboard height:", keyboardHeight);
    }

    setupMenuBarControls(menuBarHeight, padding, rightMargin, gap, shiftLeft, { menuBar, menuBarBorder, titleText }) {
        // Save level value for settings popup
        this.levelValue = this.levelValue || 1;

        // Add Settings button to menu bar using SVG
        const settingsButtonX = this.sys.game.canvas.width - padding - 40;
        const settingsButtonY = menuBarHeight / 2;

        this.createSettingsButton(settingsButtonX, settingsButtonY, menuBarHeight);

        // Create mode and level indicator in center of menu bar
        const modeText = this.mode === 'hard' ? 'HARD' : 'EASY';
        const indicatorText = `LEVEL ${this.levelValue} | ${modeText}`;

        // Calculate levelModeIndicatorY locally (match logic from createMenuBar)
        let levelModeIndicatorY;
        if (this.isMobile) {
            const titleY = menuBarHeight / 3;
            const titleHeight = titleText.height;
            const bannerHeight = 34;
            const mobilePadding = 20;
            levelModeIndicatorY = titleY + titleHeight / 2 + mobilePadding + bannerHeight / 2;
        } else {
            levelModeIndicatorY = menuBarHeight / 2;
        }

    // Create the text first to measure its dimensions
    const deviceType = detectDeviceType();
    const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
    const indicatorStyle = getTextStyle('effect', deviceType, this.mode || 'basic', uiScale);
    this.levelModeIndicator = this.add.text(
        this.cameras.main.centerX,
        levelModeIndicatorY,
        indicatorText,
        {
            ...indicatorStyle,
            fontStyle: 'bold',
            fill: '#ffffff',
            align: 'center'
        }
    ).setOrigin(0.5, 0.5);
    
    // Calculate banner dimensions dynamically based on text size with padding
    const textPadding = this.isMobile ? 40 : 20; // More padding on mobile for better touch targets
    const verticalPadding = this.isMobile ? 16 : 12; // Vertical padding for height
    const bannerWidth = this.levelModeIndicator.width + textPadding;
    const bannerHeight = this.levelModeIndicator.height + verticalPadding;
    const bannerX = this.cameras.main.centerX - bannerWidth / 2;
    
    // Calculate banner Y position based on the indicator position
    // This ensures they share the same center point
    const bannerY = levelModeIndicatorY - bannerHeight / 2;
    
    // Create the banner background as a single graphics object
    this.levelModeBanner = this.add.graphics();
    
    // Banner color based on mode
    const bannerColor = this.COLORS_HEX.ACCENT //this.mode === 'hard' ? 0xff0066 : 0x8800ff;
    const glowColor = this.COLORS_HEX.ACCENT//this.mode === 'hard' ? 0xff3366 : 0x9933ff;
    
    // Draw banner with glow effect
    this.levelModeBanner.fillStyle(glowColor, 0.3);
    this.levelModeBanner.fillRoundedRect(bannerX - 3, bannerY - 3, bannerWidth + 6, bannerHeight + 6, 16);
    this.levelModeBanner.fillStyle(bannerColor, 0.8);
    this.levelModeBanner.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
    this.levelModeBanner.lineStyle(2, 0xffffff, 0.5);
    this.levelModeBanner.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
    
    // Set banner depth to be behind the text
    this.levelModeBanner.setDepth(10);
    
    // Ensure text is in front of the banner
    this.levelModeIndicator.setDepth(11);
        
        // Add a subtle pulse glow effect
        this.pulse(this.levelModeIndicator, 1, 1500);
        this.tweens.add({
            targets: this.levelModeIndicator,
            alpha: { from: 1, to: 0.8 },
            yoyo: true,
            repeat: -1,
            duration: 1500,
            ease: 'Sine.InOut'
        });
        
        
        
        // Save topK values for settings popup
        this.topKValue = this.topKValue || 1;
        
        this.fadeIn([menuBar, menuBarBorder, this.levelModeIndicator], 800);
    }

    createMenuBar() {
        const menuBarHeight = this.isMobile ? 200 : 120;
        const padding = 50;
        const rightMargin = 40;
        const gap = 20;
        const shiftLeft = 30;
        
        const style = this.getMenuBarStyle();
        
        this.menuBar = this.add.graphics();
        this.menuBar.fillStyle(style.backgroundColor, 1);
        this.menuBar.fillRect(0, 0, this.sys.game.canvas.width, menuBarHeight);
        
        const menuBarBorder = this.add.graphics();
        menuBarBorder.fillStyle(style.borderColor, 1);
        menuBarBorder.fillRect(0, menuBarHeight - style.borderWidth, this.sys.game.canvas.width, style.borderWidth);
        
        // Mobile: center title and place level|mode below, else original
        let titleText, levelModeIndicatorY;
        if (this.isMobile) {
            // Position title higher in the menu bar
            const titleY = menuBarHeight / 3;
            titleText = this.add.text(
                this.cameras.main.centerX, titleY,
                "(NONSLOP)",
                style.titleStyle
            ).setOrigin(0.5, 0.5);

            console.log("menubar title style: ", style.titleStyle);

            // Calculate padding between title and box
            const mobilePadding = 20;
            // Estimate title height (Phaser text object has height property)
            const titleHeight = titleText.height;
            // Banner height is 34 (from below)
            const bannerHeight = 34;
            // Place the box and text below the title with padding
            levelModeIndicatorY = titleY + titleHeight / 2 + mobilePadding + bannerHeight / 2;
        } else {
            titleText = this.add.text(
                padding, menuBarHeight / 2,
                "(NONSLOP)",
                style.titleStyle
            ).setOrigin(0, 0.5);
            levelModeIndicatorY = menuBarHeight / 2;
        }

        const uiElements = {
            menuBar: this.menuBar,
            menuBarBorder: menuBarBorder,
            titleText: titleText
        };
        this.setupMenuBarControls(menuBarHeight, padding, rightMargin, gap, shiftLeft, uiElements);

        // Move levelModeIndicator below title on mobile
        if (this.levelModeIndicator) {
            this.levelModeIndicator.setX(this.cameras.main.centerX);
            this.levelModeIndicator.setY(levelModeIndicatorY);
            this.levelModeIndicator.setOrigin(0.5, 0.5);
        }
        
        this.menuBarHeight = menuBarHeight;
        this.add.existing(this.menuBar);
        this.menuBar.setPosition(0, 0);
        
        const menuBarShadow = this.add.graphics();
        menuBarShadow.fillStyle(0x000000, 0.3);
        menuBarShadow.fillRect(0, menuBarHeight, this.sys.game.canvas.width, 10);
        menuBarShadow.setDepth(this.menuBar.depth - 1);
        
        // Create the timer after menu bar is set up
        this.createTimer();
    }

    // Centralized style methods using textStyles.js
    getPromptTextStyle() {
        const deviceType = detectDeviceType();
        // Use registry uiScale to match LevelScene
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
    }

    getPromptBoxStyle() {
        return getBoxStyle('prompt', this.mode || 'basic', this.scalingManager?.uiScale || 1);
    }

    getInputBoxStyle() {
        return getBoxStyle('input', this.mode || 'basic', this.scalingManager?.uiScale || 1);
    }

    getInputTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getTextStyle('input', deviceType, this.mode || 'basic', uiScale);
    }

    getAutocompleteTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getAutocompleteTextStyle(deviceType, this.mode || 'basic', uiScale, this.uiBoxWidth);
    }

    getMenuBarStyle() {
        return getMenuBarStyle(this.mode || 'basic', this.scalingManager?.uiScale || 1);
    }

    createTimer() {
        // Only create timer for hard mode
        if (this.mode !== 'hard') {
            return;
        }
        
        // Destroy any existing timer text to prevent duplicates
        if (this.timerText) {
            this.timerText.destroy();
            this.timerText = null;
        }
        
        // Create timer text in the upper left corner
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const timerStyle = getTextStyle('timer', deviceType, this.mode || 'basic', uiScale);
        console.log("timerStyle: ", timerStyle);
        this.timerText = this.add.text(20, this.menuBarHeight + 20, '0:20', {
            ...timerStyle,
            fontStyle: 'bold',
            fill: '#ff0000'
        });
        
        // Don't start the countdown timer right away - wait for first keypress
        // Just initialize the timerValue
        this.timerValue = SCENE_CONFIG.TIMER.DEFAULT_VALUE;
    }
    
    updateTimer() {
        // Only update timer if it exists (hard mode only)
        if (!this.timerText) return;
        
        this.timerValue--;
        
        // Format the time as minutes:seconds
        const minutes = Math.floor(this.timerValue / 60);
        const seconds = this.timerValue % 60;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update the timer text
        this.timerText.setText(formattedTime);
        
        // Reset the timer when it reaches 0
        if (this.timerValue <= 0) {
            this.resetOnTimerEnd();
            this.timerValue = 20; // Reset to 20 seconds
        }
    }
    
    async resetOnTimerEnd() {
        // Show the clock flash and explosion effect, then proceed with reset
        await this.showClockExplosionEffect();

        // 1. Make the screen shake
        this.shakeScreen();
        
        // 2. Make the timer pop and shake
        if (this.timerText) {
            // Store original position
            const originalX = this.timerText.x;
            const originalY = this.timerText.y;
            
            // Flash the timer red with more intensity
            this.timerText.setTint(0xff0000);
            
            // Create pop and shake effect
            this.tweens.add({
                targets: this.timerText,
                scale: { from: 1, to: 1.5, duration: 200, yoyo: true },
                x: originalX + 5,
                y: originalY - 5,
                ease: 'Elastic.Out',
                duration: 500,
                yoyo: true,
                onComplete: () => {
                    this.timerText.setScale(1);
                    this.timerText.x = originalX;
                    this.timerText.y = originalY;
                    this.timerText.clearTint();
                }
            });
        }
        
        // 3. Delete the user input text
        this.clearInputTextBox();
        
        // 4. Clear the AI suggestions
        this.aiSuggestedWords = [];
        this.showSuggestions([]);
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // 5 & 6. Clear and reset the word stats
        this.aiWordCount = 0;
        if (this.wordCountDisplay) {
            this.updateWordCountDisplay();
        }
        
        // Reset word streak counter
        this.wordStreak = 0;
        this.lastWordWasOriginal = false;
        this.updateStreakCounter(false);
        
        // Clean up any existing streak-specific background elements
        this.cleanupStreakVisuals();
        
        // Explicitly update the background to reset effects
        this.updateBackgroundForLevel();
    }

    /**
     * Show the clock in the center, flash it, then explode into red sparks.
     * Returns a Promise that resolves when the effect is complete.
     */
    showClockExplosionEffect() {
        return new Promise((resolve) => {
            // Remove any existing clock sprite
            if (this.clockSprite) {
                this.clockSprite.destroy();
                this.clockSprite = null;
            }

            // Center of the screen
            const centerX = this.cameras.main.centerX;
            const centerY = this.cameras.main.centerY;

            // Detect mobile device
            const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || window.screen.width < 900;

            // Set scale values based on device type
            let initialScale, maxScale, burstScale;
            if (isMobile) {
                // Smaller clock for mobile
                initialScale = 0.2;
                maxScale = .6;
                burstScale = 0.4;
            } else {
                // Original values for desktop
                initialScale = 1.5;
                maxScale = 2.1;
                burstScale = 1.5;
            }

        // Add the clock sprite (SVG loaded as 'clock')
        this.clockSprite = this.add.image(centerX, centerY, 'clock')
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(999);
            
        // Correct the aspect ratio of the clock SVG
        const texture = this.textures.get('clock');
        const frameWidth = texture.frames.__BASE.width;
        const frameHeight = texture.frames.__BASE.height;
        
        // Ensure the aspect ratio is preserved by using uniform scaling
        const uniformScale = initialScale;
        this.clockSprite.setScale(uniformScale);

            // Flash: fade in and pulse scale
            this.tweens.add({
                targets: this.clockSprite,
                alpha: 1,
                scale: { from: initialScale, to: maxScale },
                duration: 220,
                yoyo: true,
                repeat: 1,
                ease: 'Quad.easeInOut',
                onComplete: () => {
                    // After flash, explode into red sparks
                    this.clockSprite.setAlpha(0);
                    this.createRedSparkBurst(centerX, centerY, burstScale);
                    // Remove the clock sprite after a short delay
                    this.time.delayedCall(500, () => {
                        if (this.clockSprite) {
                            this.clockSprite.destroy();
                            this.clockSprite = null;
                        }
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * Create a burst of red sparks at (x, y).
     * @param {number} [scale=1] - Multiplier for size and distance.
     */
    createRedSparkBurst(x, y, scale = 1) {
        const particleCount = 90;
        for (let i = 0; i < particleCount; i++) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(180, 340) * scale;
            const distance = Phaser.Math.Between(120, 260) * scale;
            const size = Phaser.Math.Between(4, 10) * scale;
            const endX = x + Math.cos(angle) * distance;
            const endY = y + Math.sin(angle) * distance;

            // Create a red circle as the spark
            const spark = this.add.circle(x, y, size, 0xed1c24, 0.88).setDepth(998);

            this.tweens.add({
                targets: spark,
                x: endX,
                y: endY,
                alpha: 0,
                scale: { from: 1, to: 0.15 },
                duration: Phaser.Math.Between(500, 900),
                ease: 'Cubic.Out',
                onComplete: () => spark.destroy()
            });
        }
    }


    updatePromptBasedOnLevel() {
        const promptLevels = {
            1: [
                "What do you want to have for dinner today?", 
                "Describe what you see around you right now.",
                "Who is your favorite artist and why?",
                "Describe your living room.",
                "Describe the sky right now.",
                "What is your favorite color and what does it remind you of?",
                "What is something that made you smile today?",
                "If you could have any animal as a pet, what would it be?",
                "What is your favorite thing to do on weekends?",
                "What is your favorite season and why?"
            ],
            2: [
                "Why do polar bears not eat penguins?",
                "What is the difference between a chair and a stool?",
                "What did young you want to do when you grew up?",
                "Who was Thomas Edison?",
                "What is an interest rate?",
                "Why do we need to sleep?",
                "How does a rainbow form?",
                "What is the difference between a fruit and a vegetable?",
                "Why do we have different time zones?",
                "What is the purpose of money?"
            ],
            3: [
                "Write a two-line poem that rhymes.",
                "Write a haiku.",
                "What do you think beauty is?",
                "What makes something art or not?",
                "Invent a new word and define it.",
                "If you could travel to any time period, when would it be and why?",
                "Describe a world where gravity is half as strong as on Earth.",
                "If you could ask any historical figure a question, who would it be and what would you ask?",
                "Write a short story in three sentences.",
                "Imagine a new holiday. What is it called and how is it celebrated?"
            ],
        };
    
        // ✅ Select a Prompt Based on the Level
        const selectedPrompts = promptLevels[this.levelValue] || promptLevels[1];
        const randomIndex = Math.floor(Math.random() * selectedPrompts.length);
        this.currentPrompt = selectedPrompts[randomIndex];
    
    
        // ✅ Remove Old Prompt Text Before Updating
        if (this.promptText) {
            this.promptText.setText(this.currentPrompt);
        }
        this.updateLevelModeIndicator();
    }

    // Add this method to BaseGameScene.js
    updateLevelModeIndicator() {
        if (!this.levelModeIndicator) return;
        
        const modeText = this.mode === 'hard' ? 'HARD' : 'EASY';
        const indicatorText = `LEVEL ${this.levelValue} | ${modeText}`;
        
        // Update text content
        this.levelModeIndicator.setText(indicatorText);
        
        // Update banner colors
        if (this.levelModeBanner) {
        // Calculate banner width dynamically based on text width with padding
        const textPadding = this.isMobile ? 60 : 20; // More padding on mobile for better touch targets and wider text area
            const bannerWidth = this.levelModeIndicator.width + textPadding;
            const bannerHeight = 34;
            const bannerX = this.cameras.main.centerX - bannerWidth / 2;
            
            // Calculate banner Y position to center the text within the banner
            // The text should be centered within the banner, so banner Y = text Y - half banner height
            const bannerY = this.levelModeIndicator.y - bannerHeight / 2;
            
            const bannerColor = this.COLORS_HEX.ACCENT;
            const glowColor = this.COLORS_HEX.ACCENT;
            
            this.levelModeBanner.clear();
            this.levelModeBanner.fillStyle(glowColor, 0.3);
            this.levelModeBanner.fillRoundedRect(bannerX - 3, bannerY - 3, bannerWidth + 6, bannerHeight + 6, 16);
            this.levelModeBanner.fillStyle(bannerColor, 0.8);
            this.levelModeBanner.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
            this.levelModeBanner.lineStyle(2, 0xffffff, 0.5);
            this.levelModeBanner.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
        }
    }
    

    // Common utility methods
    // Create and show settings popup with Level, Top K sliders and Mode Toggle
    toggleSettingsPopup() {
        this.popupJustOpened = true;
        
        // Hide keyboard on mobile when opening settings (do this first, regardless of mode)
        if (this.isMobile && this._hiddenInput) {
            this._hiddenInput.blur();
        }
        
        if (this.settingsPopup) {
            // If popup exists, close it
            this.closeSettingsPopup();
            return;
        }
        
        // Calculate popup dimensions
        const { popupWidth, popupHeight, popupX, popupY } = this.calculateSettingsPopupDimensions();
        
        // Pause the timer when settings popup is opened
        if (this.timerEvent && !this.timerEvent.paused) {
            this.timerEvent.paused = true;
        }

        // Create popup container
        this.settingsPopup = this.add.container(0, 0).setDepth(999);
        
        // Create overlay
        this.createSettingsOverlay(popupX, popupY, popupWidth, popupHeight);
        
        // Create popup background (this now handles adding elements in proper order)
        this.createSettingsBackground(popupX, popupY, popupWidth, popupHeight);
        
        // Create UI elements
        const { levelSliderHandle, levelLabel } = this.createLevelSlider(popupX, popupY, popupWidth, popupHeight);
        const { tempSliderHandle, tempLabel } = this.createTemperatureSlider(popupX, popupY, popupWidth, popupHeight);
        this.createModeToggle(popupX, popupY, popupWidth, popupHeight);
        this.createSettingsButtons(popupX, popupY, popupWidth, popupHeight);
        
        // Setup drag functionality
        this.setupSliderDragFunctionality(levelSliderHandle, levelLabel, tempSliderHandle, tempLabel);
        
        // Animate popup appearance
        this.animateSettingsPopupIn();
    }

    /**
     * Calculate dimensions for settings popup
     */
    calculateSettingsPopupDimensions() {
        const sm = this.scalingManager || new ScalingManager(this);
        const popupWidth = sm.scaleValue(400);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        // Use mobile gap for mobile devices
        const gap2 = sm.scaleValue(this.isMobile ? SCENE_CONFIG.SETTINGS_POPUP.MOBILE_GAP : SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);
        const sliderRowHeight2 = sm.scaleValue(44);
        const gap3 = sm.scaleValue(this.isMobile ? SCENE_CONFIG.SETTINGS_POPUP.MOBILE_GAP : SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);
        const toggleRowHeight = sm.scaleValue(44);
        const gap4 = sm.scaleValue(15);
        const buttonRowHeight = sm.scaleValue(54);
        const bottomPadding = sm.scaleValue(30);

        const popupHeight = bannerHeight + gap1 + sliderRowHeight + gap2 + sliderRowHeight2 + gap3 + toggleRowHeight + gap4 + buttonRowHeight + bottomPadding;
        const popupX = this.cameras.main.centerX - popupWidth / 2;
        const popupY = this.cameras.main.centerY - popupHeight / 2;

        return { popupWidth, popupHeight, popupX, popupY };
    }

    /**
     * Create the settings overlay
     */
    createSettingsOverlay(popupX, popupY, popupWidth, popupHeight) {
        // Create a full-screen overlay for visual dimming only - NOT interactive
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000, 0.7
        ).setOrigin(0, 0);
        
        // IMPORTANT: Add overlay BEFORE any interactive elements so it's behind them
        this.settingsPopup.addAt(overlay, 0);
        
        // Add a single global pointer down handler at the scene level
        // This will only close the popup if the click is outside the popup bounds
        const pointerDownHandler = (pointer) => {
            // Check if click is outside the popup area
            if (pointer.x < popupX || pointer.x > popupX + popupWidth ||
                pointer.y < popupY || pointer.y > popupY + popupHeight) {
                this.closeSettingsPopup();
            }
        };
        
        // Add the handler to the scene's input
        this.input.on('pointerdown', pointerDownHandler);
        
        // Store the handler so we can remove it when closing
        this._settingsOverlayHandler = pointerDownHandler;
    }

    /**
     * Create the settings popup background
     */
    createSettingsBackground(popupX, popupY, popupWidth, popupHeight) {
        const popupBg = this.add.graphics();
        popupBg.fillStyle(this.COLORS_HEX.BACKGROUND, 0.95);
        popupBg.fillRoundedRect(popupX, popupY, popupWidth, popupHeight, 15);
        popupBg.lineStyle(3, this.COLORS_HEX.BOX_OUTLINE, 1);
        popupBg.strokeRoundedRect(popupX, popupY, popupWidth, popupHeight, 15);
        
        // Add popup background to container FIRST with explicit depth
        popupBg.setDepth(0);
        this.settingsPopup.add(popupBg);
        
        // Create banner background for title
        const titleHeight = 44;
        const bannerHeight = 54; // Match the value used in calculateSettingsPopupDimensions
        
        // Banner graphics with higher depth
        const bannerBg = this.add.graphics();
        bannerBg.fillStyle(this.COLORS_HEX.ACCENT, 0.8);
        bannerBg.fillRoundedRect(popupX, popupY, popupWidth, bannerHeight, {
            tl: 15, tr: 15, bl: 0, br: 0
        });
        bannerBg.lineStyle(2, 0xffffff, 0.5);
        bannerBg.strokeRoundedRect(popupX, popupY, popupWidth, bannerHeight, {
            tl: 15, tr: 15, bl: 0, br: 0
        });
        bannerBg.setDepth(1);
        this.settingsPopup.add(bannerBg);
        
        // Add title text with proper style and highest depth
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const titleStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const title = this.add.text(
            this.cameras.main.centerX,
            popupY + bannerHeight / 2,
            'SETTINGS',
            {
                ...titleStyle,
                fontSize: `${parseInt(titleStyle.fontSize) * 1.4}px`, // Make title larger
                fill: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5, 0.5);
        title.setDepth(2);
        this.settingsPopup.add(title);
        
        return popupBg;
    }

    /**
     * Create the level slider
     */
    createLevelSlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager || new ScalingManager(this);
        const sliderWidth = sm.scaleValue(150);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);

        let yCursor = popupY + bannerHeight + gap1;

        // Level slider row
        const levelLabelX = popupX + sm.scaleValue(30);
        const levelLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const levelLabel = this.add.text(
            levelLabelX, levelLabelY,
            `Level: ${this.levelValue}`,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`, // Ensure proper size
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.settingsPopup.add(levelLabel);

        const levelSliderX = levelLabelX + levelLabel.displayWidth + gap;
        const levelSliderY = levelLabelY;

        // Create slider track
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const levelSlider = this.add.graphics();
        // Draw the full track (background)
        levelSlider.fillStyle(0x444444, 1);
        levelSlider.fillRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        // Draw the filled portion up to the handle
        const levelT = (this.levelValue - 1) / 2;
        const fillWidth = sliderWidth * levelT;
        if (fillWidth > 0) {
            // Use the same color as the mode toggle (BASIC_COLORS_HEX.HIGHLIGHT)
            levelSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            levelSlider.fillRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
        levelSlider.lineStyle(2, 0xffffff, 0.3);
        levelSlider.strokeRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.settingsPopup.add(levelSlider);

        // Create slider handle
        const levelSliderHandle = this.createSliderHandle(levelSliderX, levelSliderY, sliderWidth);
        this.settingsPopup.add(levelSliderHandle);

        // Setup slider interactions
        this.setupLevelSliderInteractions(levelSlider, levelSliderHandle, levelLabel, levelSliderX, levelSliderY, sliderWidth);

        return { levelSliderHandle, levelLabel };
    }

    /**
     * Create a slider handle
     */
    createSliderHandle(sliderX, sliderY, sliderWidth) {
        const sm = this.scalingManager || new ScalingManager(this);
        const isMobileDevice = this.isMobile;
        const levelT = (this.levelValue - 1) / 2;
        const levelSliderMinX = sliderX + sm.scaleValue(5);
        const levelSliderMaxX = sliderX + sliderWidth - sm.scaleValue(5);
        const levelHandleX = Phaser.Math.Linear(levelSliderMinX, levelSliderMaxX, levelT);

        // Create a simple sprite for the handle
        const handleSize = isMobileDevice ? sm.scaleValue(24) : sm.scaleValue(20);
        
        // Create a circle sprite using graphics texture
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(BASIC_COLORS_HEX.ACCENT, 1);
        graphics.fillCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.generateTexture('sliderHandle', handleSize, handleSize);
        graphics.destroy();
        
        // Create the sprite from the generated texture
        const handle = this.add.sprite(levelHandleX, sliderY, 'sliderHandle');
        handle.setDepth(3);
        
        // Set up interactive and draggable
        const hitArea = isMobileDevice ? 44 : 60; // Larger hit area
        handle.setInteractive({ 
            hitArea: new Phaser.Geom.Circle(handleSize/2, handleSize/2, hitArea/2), 
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            useHandCursor: true
        });

        // Visual feedback
        handle.on('pointerover', () => {
            handle.setScale(1.2);
            handle.setTint(0xffff00); // Yellow tint on hover
        });
        
        handle.on('pointerout', () => {
            if (!handle.getData('isDragging')) {
                handle.setScale(1);
                handle.clearTint();
            }
        });

        return handle;
    }

    /**
     * Setup level slider interactions
     */
    setupLevelSliderInteractions(levelSlider, levelSliderHandle, levelLabel, sliderX, sliderY, sliderWidth) {
        const levelSliderMinX = sliderX + 5;
        const levelSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        // Store bounds and references on the handle for drag functionality
        levelSliderHandle.setData('minX', levelSliderMinX);
        levelSliderHandle.setData('maxX', levelSliderMaxX);
        levelSliderHandle.setData('type', 'level');
        levelSliderHandle.setData('sliderTrack', levelSlider);
        levelSliderHandle.setData('sliderX', sliderX);
        levelSliderHandle.setData('sliderWidth', sliderWidth);
        levelSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        // Handle clicks on slider track (move handle to click position)
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        levelSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                // Move handle to click position
                const clampedX = Phaser.Math.Clamp(pointer.x, levelSliderMinX, levelSliderMaxX);
                levelSliderHandle.x = clampedX;
                const newLevel = Math.round(Phaser.Math.Linear(1, 3, (clampedX - levelSliderMinX) / (levelSliderMaxX - levelSliderMinX)));
                
                // Update the fill for the level slider track
                this.updateSliderFill(levelSliderHandle);
                
                if (newLevel !== this.levelValue) {
                    this.levelValue = newLevel;
                    levelLabel.setText(`Level: ${this.levelValue}`);
                    this.onLevelChange();
                }
                
                // For desktop, handle is already draggable, no need to set again
                // For mobile, simulate a drag start to enable immediate dragging
                if (isMobileDevice) {
                    levelSliderHandle.emit('pointerdown', pointer);
                    this.input.emit('dragstart', pointer, levelSliderHandle);
                }
            });
    }

    /**
     * Handle level slider value changes
     */
    handleLevelSliderChange(pointerX, minX, maxX, handle, label) {
        pointerX = Phaser.Math.Clamp(pointerX, minX, maxX);
        handle.x = pointerX;
        const newLevel = Math.round(Phaser.Math.Linear(1, 3, (pointerX - minX) / (maxX - minX)));
        
        // Update the fill for the level slider track
        const levelSlider = handle.getData('sliderTrack');
        if (levelSlider) {
            const sliderTrackHeight = this.isMobile ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
            const sliderX = handle.getData('sliderX');
            const sliderY = handle.y;
            
            // Clear previous fill
            levelSlider.clear();
            
            // Draw the background track
            levelSlider.fillStyle(0x444444, 1);
            levelSlider.fillRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
            
        // Draw the filled portion up to the handle position
        const fillWidth = handle.x - sliderX;
        if (fillWidth > 0) {
            // Use the same color as the mode toggle
            levelSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            levelSlider.fillRect(sliderX, sliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
            
            // Draw the outline
            levelSlider.lineStyle(2, 0xffffff, 0.3);
            levelSlider.strokeRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
        }
        
        if (newLevel !== this.levelValue) {
            this.levelValue = newLevel;
            label.setText(`Level: ${this.levelValue}`);
            this.onLevelChange();
        }
    }

    /**
     * Handle level change
     */
    onLevelChange() {
        
        // Clear the user input text
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        
        // Clear the hidden input for mobile
        if (this._hiddenInput) {
            this._hiddenInput.value = '';
        }
        
        // Reset streak counters BEFORE updating background
        this.wordStreak = 0;
        this.lastWordWasOriginal = false;
        
        // Clean up any existing streak-specific background elements BEFORE creating new background
        this.cleanupStreakVisuals();
        
        // Update prompt and background - background will now use reset streak value
        this.updatePromptBasedOnLevel();
        this.updateBackgroundForLevel();
        
        // Reset counters (no progress bar visuals)
        this.aiWordCount = 0;
        
        // Clear AI suggestions
        this.aiSuggestedWords = [];
        this.showSuggestions([]);
        
        // Clear any autocomplete text
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // Update word count display
        if (this.wordCountDisplay) this.updateWordCountDisplay();
        
        // Update streak counter display
        this.updateStreakCounter(false);
        
        // Update cursor to show the cleared state
        this.updateCursor();
    }

    /**
     * Create the temperature slider
     */
    createTemperatureSlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager || new ScalingManager(this);
        const sliderWidth = sm.scaleValue(150);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        const gap2 = sm.scaleValue(SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);

        let yCursor = popupY + bannerHeight + gap1 + sliderRowHeight + gap2;

        // Temperature slider row
        const tempLabelX = popupX + sm.scaleValue(30);
        const tempLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const tempLabel = this.add.text(
            tempLabelX, tempLabelY,
            `Randomness: `,//${Math.round(this.temperature * 100)}%`,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`, // Ensure proper size
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.settingsPopup.add(tempLabel);

        const tempSliderX = tempLabelX + tempLabel.displayWidth + gap;
        const tempSliderY = tempLabelY;

        // Create slider track
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const tempSlider = this.add.graphics();
        // Draw the full track (background)
        tempSlider.fillStyle(0x444444, 1);
        tempSlider.fillRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        // Draw the filled portion up to the handle
        const tempT = (this.temperature - 0.1) / 1.4;
        const tempFillWidth = sliderWidth * tempT;
        if (tempFillWidth > 0) {
            // Use the same color as the mode toggle (BASIC_COLORS_HEX.HIGHLIGHT)
            tempSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            tempSlider.fillRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, tempFillWidth, sliderTrackHeight);
        }
        tempSlider.lineStyle(2, 0xffffff, 0.3);
        tempSlider.strokeRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.settingsPopup.add(tempSlider);

        // Create slider handle (temperature ranges from 0.1 to 1.5)
        const tempSliderHandle = this.createTemperatureSliderHandle(tempSliderX, tempSliderY, sliderWidth);
        this.settingsPopup.add(tempSliderHandle);

        // Setup slider interactions
        this.setupTemperatureSliderInteractions(tempSlider, tempSliderHandle, tempLabel, tempSliderX, tempSliderY, sliderWidth);

        return { tempSliderHandle, tempLabel };
    }

    /**
     * Create a temperature slider handle
     */
    createTemperatureSliderHandle(sliderX, sliderY, sliderWidth) {
        const sm = this.scalingManager || new ScalingManager(this);
        const isMobileDevice = this.isMobile;
        // Map temperature (0.1 to 1.5) to slider position (0 to 1)
        const tempT = (this.temperature - 0.1) / 1.4;
        const tempSliderMinX = sliderX + sm.scaleValue(5);
        const tempSliderMaxX = sliderX + sliderWidth - sm.scaleValue(5);
        const tempHandleX = Phaser.Math.Linear(tempSliderMinX, tempSliderMaxX, tempT);

        // Create a simple sprite for the handle
        const handleSize = isMobileDevice ? sm.scaleValue(24) : sm.scaleValue(20);
        
        // Create a circle sprite using graphics texture
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(BASIC_COLORS_HEX.ACCENT, 1);
        graphics.fillCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.generateTexture('tempSliderHandle', handleSize, handleSize);
        graphics.destroy();
        
        // Create the sprite from the generated texture
        const handle = this.add.sprite(tempHandleX, sliderY, 'tempSliderHandle');
        handle.setDepth(3);
        
        // Set up interactive and draggable
        const hitArea = isMobileDevice ? 44 : 60; // Larger hit area
        handle.setInteractive({ 
            hitArea: new Phaser.Geom.Circle(handleSize/2, handleSize/2, hitArea/2), 
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            useHandCursor: true
        });

        // Visual feedback
        handle.on('pointerover', () => {
            handle.setScale(1.2);
            handle.setTint(0xffff00); // Yellow tint on hover
        });
        
        handle.on('pointerout', () => {
            if (!handle.getData('isDragging')) {
                handle.setScale(1);
                handle.clearTint();
            }
        });

        return handle;
    }

    /**
     * Setup temperature slider interactions
     */
    setupTemperatureSliderInteractions(tempSlider, tempSliderHandle, tempLabel, sliderX, sliderY, sliderWidth) {
        const tempSliderMinX = sliderX + 5;
        const tempSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        // Store bounds and references on the handle for drag functionality
        tempSliderHandle.setData('minX', tempSliderMinX);
        tempSliderHandle.setData('maxX', tempSliderMaxX);
        tempSliderHandle.setData('type', 'temperature');
        tempSliderHandle.setData('sliderTrack', tempSlider);
        tempSliderHandle.setData('sliderX', sliderX);
        tempSliderHandle.setData('sliderWidth', sliderWidth);
        tempSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        // Handle clicks on slider track (move handle to click position)
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        tempSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                // Move handle to click position
                const clampedX = Phaser.Math.Clamp(pointer.x, tempSliderMinX, tempSliderMaxX);
                tempSliderHandle.x = clampedX;
                // Map slider position to temperature (0.1 to 1.5)
                const newTemp = Phaser.Math.Linear(0.1, 1.5, (clampedX - tempSliderMinX) / (tempSliderMaxX - tempSliderMinX));
                
                // Update the fill for the temperature slider track
                this.updateSliderFill(tempSliderHandle);
                
                if (Math.abs(newTemp - this.temperature) > 0.01) {
                    this.temperature = newTemp;
                    tempLabel.setText(`Randomness: `);//${Math.round(this.temperature * 100)}%`);
                }
                
                // For desktop, handle is already draggable, no need to set again
                // For mobile, simulate a drag start to enable immediate dragging
                if (isMobileDevice) {
                    tempSliderHandle.emit('pointerdown', pointer);
                    this.input.emit('dragstart', pointer, tempSliderHandle);
                }
            });
    }

    /**
     * Handle temperature slider value changes
     */
    handleTemperatureSliderChange(pointerX, minX, maxX, handle, label) {
        pointerX = Phaser.Math.Clamp(pointerX, minX, maxX);
        handle.x = pointerX;
        // Map slider position to temperature (0.1 to 1.5)
        const newTemp = Phaser.Math.Linear(0.1, 1.5, (pointerX - minX) / (maxX - minX));
        
        // Update the fill for the temperature slider track
        const tempSlider = handle.getData('sliderTrack');
        if (tempSlider) {
            const sliderTrackHeight = this.isMobile ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
            const sliderX = handle.getData('sliderX');
            const sliderY = handle.y;
            
            // Clear previous fill
            tempSlider.clear();
            
            // Draw the background track
            tempSlider.fillStyle(0x444444, 1);
            tempSlider.fillRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
            
                    // Draw the filled portion up to the handle position
                    const fillWidth = handle.x - sliderX;
                    if (fillWidth > 0) {
                        // Use the same color as the mode toggle
                        tempSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
                        tempSlider.fillRect(sliderX, sliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
                    }
            
            // Draw the outline
            tempSlider.lineStyle(2, 0xffffff, 0.3);
            tempSlider.strokeRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
        }
        
        if (Math.abs(newTemp - this.temperature) > 0.01) {
            this.temperature = newTemp;
            label.setText(`Randomness: `);//${Math.round(this.temperature * 100)}%`);
        }
    }

    /**
     * Create the frequency penalty slider
     */
    createFrequencyPenaltySlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager || new ScalingManager(this);
        const sliderWidth = sm.scaleValue(150);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        const gap2 = sm.scaleValue(SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);
        const sliderRowHeight2 = sm.scaleValue(44);
        const gap3 = sm.scaleValue(SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);

        let yCursor = popupY + bannerHeight + gap1 + sliderRowHeight + gap2 + sliderRowHeight2 + gap3;

        // Frequency penalty slider row
        const freqLabelX = popupX + sm.scaleValue(30);
        const freqLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const freqLabel = this.add.text(
            freqLabelX, freqLabelY,
            `Word Variety: `,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`,
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.settingsPopup.add(freqLabel);

        const freqSliderX = freqLabelX + freqLabel.displayWidth + gap;
        const freqSliderY = freqLabelY;

        // Create slider track
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const freqSlider = this.add.graphics();
        // Draw the full track (background)
        freqSlider.fillStyle(0x444444, 1);
        freqSlider.fillRect(freqSliderX, freqSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        // Draw the filled portion up to the handle (frequency penalty ranges from 0.0 to 2.0)
        const freqT = this.frequencyPenalty / 2.0;
        const freqFillWidth = sliderWidth * freqT;
        if (freqFillWidth > 0) {
            freqSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            freqSlider.fillRect(freqSliderX, freqSliderY - sliderTrackHeight / 2, freqFillWidth, sliderTrackHeight);
        }
        freqSlider.lineStyle(2, 0xffffff, 0.3);
        freqSlider.strokeRect(freqSliderX, freqSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.settingsPopup.add(freqSlider);

        // Create slider handle
        const freqSliderHandle = this.createFrequencyPenaltySliderHandle(freqSliderX, freqSliderY, sliderWidth);
        this.settingsPopup.add(freqSliderHandle);

        // Setup slider interactions
        this.setupFrequencyPenaltySliderInteractions(freqSlider, freqSliderHandle, freqLabel, freqSliderX, freqSliderY, sliderWidth);

        return { freqSliderHandle, freqLabel };
    }

    /**
     * Create a frequency penalty slider handle
     */
    createFrequencyPenaltySliderHandle(sliderX, sliderY, sliderWidth) {
        const sm = this.scalingManager || new ScalingManager(this);
        const isMobileDevice = this.isMobile;
        // Map frequency penalty (0.0 to 2.0) to slider position (0 to 1)
        const freqT = this.frequencyPenalty / 2.0;
        const freqSliderMinX = sliderX + sm.scaleValue(5);
        const freqSliderMaxX = sliderX + sliderWidth - sm.scaleValue(5);
        const freqHandleX = Phaser.Math.Linear(freqSliderMinX, freqSliderMaxX, freqT);

        // Create a simple sprite for the handle
        const handleSize = isMobileDevice ? sm.scaleValue(24) : sm.scaleValue(20);
        
        // Reuse the texture if it exists, or create it
        if (!this.textures.exists('freqSliderHandle')) {
            const graphics = this.make.graphics({ x: 0, y: 0 }, false);
            graphics.fillStyle(BASIC_COLORS_HEX.ACCENT, 1);
            graphics.fillCircle(handleSize/2, handleSize/2, handleSize/2);
            graphics.lineStyle(2, 0xffffff, 1);
            graphics.strokeCircle(handleSize/2, handleSize/2, handleSize/2);
            graphics.generateTexture('freqSliderHandle', handleSize, handleSize);
            graphics.destroy();
        }
        
        // Create the sprite from the generated texture
        const handle = this.add.sprite(freqHandleX, sliderY, 'freqSliderHandle');
        handle.setDepth(3);
        
        // Set up interactive and draggable
        const hitArea = isMobileDevice ? 44 : 60;
        handle.setInteractive({ 
            hitArea: new Phaser.Geom.Circle(handleSize/2, handleSize/2, hitArea/2), 
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            useHandCursor: true
        });

        // Visual feedback
        handle.on('pointerover', () => {
            handle.setScale(1.2);
            handle.setTint(0xffff00);
        });
        
        handle.on('pointerout', () => {
            if (!handle.getData('isDragging')) {
                handle.setScale(1);
                handle.clearTint();
            }
        });

        return handle;
    }

    /**
     * Setup frequency penalty slider interactions
     */
    setupFrequencyPenaltySliderInteractions(freqSlider, freqSliderHandle, freqLabel, sliderX, sliderY, sliderWidth) {
        const freqSliderMinX = sliderX + 5;
        const freqSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        // Store bounds and references on the handle for drag functionality
        freqSliderHandle.setData('minX', freqSliderMinX);
        freqSliderHandle.setData('maxX', freqSliderMaxX);
        freqSliderHandle.setData('type', 'frequency');
        freqSliderHandle.setData('sliderTrack', freqSlider);
        freqSliderHandle.setData('sliderX', sliderX);
        freqSliderHandle.setData('sliderWidth', sliderWidth);
        freqSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        // Handle clicks on slider track
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        freqSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                const clampedX = Phaser.Math.Clamp(pointer.x, freqSliderMinX, freqSliderMaxX);
                freqSliderHandle.x = clampedX;
                // Map slider position to frequency penalty (0.0 to 2.0)
                const newFreq = Phaser.Math.Linear(0.0, 2.0, (clampedX - freqSliderMinX) / (freqSliderMaxX - freqSliderMinX));
                
                // Update the fill
                this.updateSliderFill(freqSliderHandle);
                
                if (Math.abs(newFreq - this.frequencyPenalty) > 0.01) {
                    this.frequencyPenalty = newFreq;
                    freqLabel.setText(`Word Variety: `);
                }
                
                if (isMobileDevice) {
                    freqSliderHandle.emit('pointerdown', pointer);
                    this.input.emit('dragstart', pointer, freqSliderHandle);
                }
            });
    }

    /**
     * Create the mode toggle
     */
    createModeToggle(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager || new ScalingManager(this);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        const gap2 = sm.scaleValue(this.isMobile ? SCENE_CONFIG.SETTINGS_POPUP.MOBILE_GAP : SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);
        const sliderRowHeight2 = sm.scaleValue(44); // Temperature slider row
        const gap3 = sm.scaleValue(this.isMobile ? SCENE_CONFIG.SETTINGS_POPUP.MOBILE_GAP : SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);
        
        // Position after Level slider and Temperature slider only (no frequency slider)
        let yCursor = popupY + bannerHeight + gap1 + sliderRowHeight + gap2 + sliderRowHeight2 + gap3;
        
        // Mode Toggle row
        const modeToggleLabelX = popupX + sm.scaleValue(30);
        const modeToggleLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const modeToggleLabel = this.add.text(
            modeToggleLabelX, modeToggleLabelY,
            "Hard Mode:",
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`, // Ensure proper size
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.settingsPopup.add(modeToggleLabel);

        // Use current pending mode or current actual mode
        const currentToggleMode = this.pendingModeChange || this.mode || 'easy';
        this.currentToggleRef = { toggle: null };
        
        const toggleCallback = (newMode) => {
            this.pendingModeChange = newMode;
            const currentMode = newMode;
            if (this.currentToggleRef.toggle) this.currentToggleRef.toggle.destroy();
            const newToggle = ToggleFactory.createToggle(
                this,
                currentMode,
                toggleCallback,
                modeToggleLabelX + modeToggleLabel.width + gap,
                modeToggleLabelY
            );
            this.currentToggleRef.toggle = newToggle;
            this.settingsPopup.add(newToggle);
        };
        
        const initialToggle = ToggleFactory.createToggle(
            this,
            currentToggleMode,
            toggleCallback,
            modeToggleLabelX + modeToggleLabel.width + gap,
            modeToggleLabelY
        );
        this.currentToggleRef.toggle = initialToggle;
        this.settingsPopup.add(initialToggle);
    }

    /**
     * Create settings buttons (Apply and Close)
     */
    createSettingsButtons(popupX, popupY, popupWidth, popupHeight) {
        // Position the APPLY button relative to the bottom of the popup
        const bottomMargin = 40; // Nice small margin from bottom
        const buttonHeight = this.scalingManager.buttonHeight();
        const confirmBtnY = popupY + popupHeight - bottomMargin - buttonHeight/2;
        
        const confirmBtn = ButtonFactory.createButton(
            this,
            'APPLY',
            () => {
                if (this.pendingModeChange && this.pendingModeChange !== this.mode) {
                    this.onModeToggle(this.pendingModeChange, this.levelValue, this.topKValue);
                    return;
                }
                this.closeSettingsPopup();
            },
            this.cameras.main.centerX,
            confirmBtnY
        );
        this.settingsPopup.add(confirmBtn);

        // Close button (top right)
        const minTouchSize = 44;
        // Get text style from textStyles.js
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const closeTextStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
        
        const closeBtn = this.add.text(
            popupX + popupWidth - 25,
            popupY + 20,
            '✕',
            {
                ...closeTextStyle,
                fill: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5)
        .setInteractive({
            useHandCursor: true,
            hitArea: new Phaser.Geom.Rectangle(
                -minTouchSize / 2,
                -minTouchSize / 2,
                minTouchSize,
                minTouchSize
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains
        })
        .on('pointerover', () => closeBtn.setScale(1.2))
        .on('pointerout', () => closeBtn.setScale(1))
        .on('pointerdown', () => this.closeSettingsPopup());
        this.settingsPopup.add(closeBtn);
    }

    /**
     * Setup slider drag functionality
     */
    /**
     * Updates the fill for a slider track
     * @param {Phaser.GameObjects.GameObject} handle - The slider handle
     */
    updateSliderFill(handle) {
        const sliderTrack = handle.getData('sliderTrack');
        if (!sliderTrack) return;
        
        const minX = handle.getData('minX');
        const maxX = handle.getData('maxX');
        const sliderX = handle.getData('sliderX');
        const sliderY = handle.y;
        const sliderTrackHeight = handle.getData('sliderTrackHeight') || 
            (this.isMobile ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12));
        
        // Clear previous fill
        sliderTrack.clear();
        
        // Draw the background track
        sliderTrack.fillStyle(0x444444, 1);
        sliderTrack.fillRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
        
        // Draw the filled portion up to the handle position
        const fillWidth = handle.x - sliderX;
        if (fillWidth > 0) {
            // Use the same color as the mode toggle
            sliderTrack.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            sliderTrack.fillRect(sliderX, sliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
        
        // Draw the outline
        sliderTrack.lineStyle(2, 0xffffff, 0.3);
        sliderTrack.strokeRoundedRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
    }
    
    setupSliderDragFunctionality(levelSliderHandle, levelLabel, tempSliderHandle, tempLabel) {
        const scene = this;
        
        // Clean up any existing handlers
        if (this._sliderCleanup) {
            this._sliderCleanup();
            this._sliderCleanup = null;
        }
        
        // Simple drag setup function
        const setupSliderDrag = (handle, sliderType, label) => {
            // Guard: skip if handle is undefined
            if (!handle) return;
            
            // Ensure the handle is draggable
            scene.input.setDraggable(handle);
            
            // Store initial data
            handle.setData('isDragging', false);
            
            // Single drag event handler - this is the primary way Phaser handles dragging
            handle.on('drag', function(pointer, dragX, dragY) {
                const minX = this.getData('minX');
                const maxX = this.getData('maxX');
                
                // Constrain to horizontal movement within bounds
                const newX = Phaser.Math.Clamp(dragX, minX, maxX);
                this.x = newX;
                
                if (sliderType === 'level') {
                    // Update the level value
                    const newLevel = Math.round(Phaser.Math.Linear(1, 3, (newX - minX) / (maxX - minX)));
                    if (newLevel !== scene.levelValue) {
                        scene.levelValue = newLevel;
                        label.setText(`Level: ${scene.levelValue}`);
                        scene.onLevelChange();
                    }
                } else if (sliderType === 'temperature') {
                    // Update the temperature value
                    const newTemp = Phaser.Math.Linear(0.1, 1.5, (newX - minX) / (maxX - minX));
                    if (Math.abs(newTemp - scene.temperature) > 0.01) {
                        scene.temperature = newTemp;
                        label.setText(`Randomness: `);
                    }
                } else if (sliderType === 'frequency') {
                    // Update the frequency penalty value
                    const newFreq = Phaser.Math.Linear(0.0, 2.0, (newX - minX) / (maxX - minX));
                    if (Math.abs(newFreq - scene.frequencyPenalty) > 0.01) {
                        scene.frequencyPenalty = newFreq;
                        label.setText(`Word Variety: `);
                    }
                }
                
                // Update the slider fill
                scene.updateSliderFill(this);
            });
            
            // Visual feedback on drag start
            handle.on('dragstart', function(pointer) {
                this.setData('isDragging', true);
                this.setScale(1.2);
                this.setTint(0xffff00);
                scene.input.setDefaultCursor('grabbing');
            });
            
            // Reset visual feedback on drag end
            handle.on('dragend', function(pointer) {
                this.setData('isDragging', false);
                this.setScale(1);
                this.clearTint();
                scene.input.setDefaultCursor('default');
            });
        };
        
        // Setup only the two sliders we have
        setupSliderDrag(levelSliderHandle, 'level', levelLabel);
        setupSliderDrag(tempSliderHandle, 'temperature', tempLabel);
        
        // Store cleanup function
        this._sliderCleanup = () => {
            // Remove all listeners from handles
            if (levelSliderHandle) levelSliderHandle.removeAllListeners();
            if (tempSliderHandle) tempSliderHandle.removeAllListeners();
        };
    }

    /**
     * Animate settings popup appearance
     */
    animateSettingsPopupIn() {
        this.settingsPopup.setScale(0.8);
        this.scalePopIn(this.settingsPopup, 200);
    }
    
    closeSettingsPopup() {
        if (!this.settingsPopup) return;
        
        // Apply any pending mode change before closing
        const hasModeChange = this.pendingModeChange && this.pendingModeChange !== this.mode;
        if (!hasModeChange) {
            this.updateLevelModeIndicator();
        }
        
        // Resume the timer when settings popup is closed
        if (this.timerEvent && this.timerEvent.paused) {
            this.timerEvent.paused = false;
        }
        
        // Clean up slider drag functionality
        if (this._sliderCleanup) {
            this._sliderCleanup();
            this._sliderCleanup = null;
        }
        
        // Clean up drag event listeners
        if (this._settingsDragHandlers) {
            this.input.off('dragstart', this._settingsDragHandlers.dragstart);
            this.input.off('drag', this._settingsDragHandlers.drag);
            this.input.off('dragend', this._settingsDragHandlers.dragend);
            this._settingsDragHandlers = null;
        }
        
        // Clean up pointer move handler
        if (this._settingsPointerMoveHandler) {
            this.input.off('pointermove', this._settingsPointerMoveHandler);
            this._settingsPointerMoveHandler = null;
        }

        // Clean up the overlay handler - IMPORTANT
        if (this._settingsOverlayHandler) {
            this.input.off('pointerdown', this._settingsOverlayHandler);
            this._settingsOverlayHandler = null;
        }

        // First destroy the popup with animation
        this.fadeOutScale(this.settingsPopup, 200, 'Back.In', () => {
            if (this.settingsPopup) {
                this.settingsPopup.destroy();
                this.settingsPopup = null;
                
                // After popup is destroyed, apply mode change if needed
                if (hasModeChange) {
                    // Short delay to ensure popup is fully gone
                    this.time.delayedCall(50, () => {
                        this.onModeToggle(this.pendingModeChange, this.levelValue, this.topKValue);
                    });
                }
            }
        });
    }

    ensureProperLayering() {
        if (this.promptTextBox) this.promptTextBox.setDepth(102);
        if (this.promptText) this.promptText.setDepth(103);
        if (this.outputText) this.outputText.setDepth(6);
        if (this.failsCounter) this.failsCounter.setDepth(7);
        if (this.inputTextBorder) this.inputTextBorder.setDepth(20);
        if (this.inputText) this.inputText.setDepth(25);
        if (this.doneButton) this.doneButton.setDepth(110);
        if (this.resetButton) this.resetButton.setDepth(110);
        if (this.feedbackButton) this.feedbackButton.setDepth(110);
        if (this.settingsButton) this.settingsButton.setDepth(110);
        if (this.wordCountDisplay) this.wordCountDisplay.setDepth(55);
        if (this.settingsPopup) this.settingsPopup.setDepth(100);
    }
    
    createWordCountDisplay(customWidth) {
        if (this.wordCountDisplay) {
            this.wordCountDisplay.destroy();
        }
        
        // Create container for word count display
        this.wordCountDisplay = this.add.container(0, 0).setDepth(55);
        
        // Make sure we have a scaling manager
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        const sm = this.scalingManager;
        
        // Force update scale ratios on mobile to ensure proper scaling
        if (this.isMobile) {
            sm.updateBaseDimensions();
            sm.updateScaleRatios();
            
            // If no customWidth provided on mobile, calculate it here
            if (!customWidth || customWidth <= 0) {
                
                // Replicate the width calculation from calculateUIPositions
                const deviceType = detectDeviceType();
                const uiScale = sm.uiScale || 1;
                const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
                const countStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
                const padding = sm.scaleValue(20);

                // Labels with maximum expected values
                const labels = [
                    { text: "Original Words:", value: "999" },
                    { text: "AI Words:", value: "999" },
                    { text: "Current Streak:", value: "999" },
                    { text: "Best Streak:", value: "999" }
                ];

                // Create temporary text objects to measure
                const tempTexts = [];
                const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
                tempTexts.push(titleTemp);

                let maxLabelWidth = 0;
                labels.forEach(({ text, value }) => {
                    const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
                    const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
                    
                    // Calculate actual positions and spacing
                    const labelX = sm.scaleValue(35);
                    const valueRightPadding = sm.scaleValue(15);
                    const minGapBetweenLabelAndValue = sm.scaleValue(this.isMobile ? 50 : 30); // More generous gap for mobile
                    
                    // Total width needed for the content
                    const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
                    maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
                    tempTexts.push(labelTemp, valueTemp);
                });

                // Clean up temporary text objects
                tempTexts.forEach(text => text.destroy());

                // Calculate final stats box width with all constraints
                const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
                const fixedRightMargin = sm.scaleValue(this.isMobile ? 35 : 30);
                const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + padding * 2);
                const configMax = sm.scaleValue(this.isMobile ? 
                    SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_MOBILE : 
                    SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_DESKTOP);
                
                // For mobile, ensure we use a reasonable minimum width
                if (this.isMobile) {
                    // Use a more generous minimum for mobile
                    customWidth = Math.max(contentBoxWidth, sm.scaleValue(250));
                } else {
                    customWidth = Math.max(contentBoxWidth, minBoxWidth);
                }
                customWidth = Math.min(customWidth, configMax);
                

            }
        }
        
        // Scale all dimensions consistently
        const padding = sm.scaleValue(20);
        const boxHeight = sm.scaleValue(130); // Scaled height
        const cornerRadius = sm.scaleValue(10);

        // Use customWidth if provided (from calculateUIPositions)
        // This ensures we use the properly calculated width that accounts for all mobile constraints
        let boxWidth;
        if (customWidth !== undefined && customWidth > 0) {
            // Use the width calculated in calculateUIPositions
            boxWidth = customWidth;
        } else {
            // Fallback calculation if no width provided
            // Get text styles for measuring
            const deviceType = detectDeviceType();
            const uiScale = this.scalingManager?.uiScale || 1;
            const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
            const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);

            // Create temporary text objects to measure actual content width
            const tempTexts = [];
            
            // Title
            const titleTemp = this.add.text(0, 0, "WORD STATS", {
                ...labelStyle,
                fontStyle: 'bold',
                fill: '#ffffff'
            });
            tempTexts.push(titleTemp);
            
            // Labels with maximum expected values
            const labels = [
                { text: "Original Words:", value: "999" },
                { text: "AI Words:", value: "999" },
                { text: "Current Streak:", value: "999" },
                { text: "Best Streak:", value: "999" }
            ];
            
            let maxLabelWidth = 0;
            labels.forEach(({ text, value }) => {
                const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
                const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
                
                // Calculate actual positions and spacing - match calculateUIPositions
                const labelX = sm.scaleValue(35);
                const valueRightPadding = sm.scaleValue(15);
                const minGapBetweenLabelAndValue = sm.scaleValue(30); // Generous gap between label and value
                
                // Since values are right-aligned, we need:
                // labelX + labelWidth + gap + valueWidth + rightPadding
                const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
                maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
                
                tempTexts.push(labelTemp, valueTemp);
            });
            
            // Clean up temporary text objects
            tempTexts.forEach(text => text.destroy());
            
            // Calculate width with proper constraints
            const scaledRightMargin = sm.scaleValue(this.isMobile ? 
                SCENE_CONFIG.PADDING.MOBILE_STATS_RIGHT_MARGIN : 
                SCENE_CONFIG.PADDING.STATS_RIGHT_MARGIN);
            const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
            const maxBoxWidth = this.sys.game.canvas.width - scaledRightMargin * 2;
            const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + padding * 2);
            const configMax = sm.scaleValue(this.isMobile ? SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_MOBILE : SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_DESKTOP);
            
            boxWidth = Math.max(contentBoxWidth, minBoxWidth);
            boxWidth = Math.min(boxWidth, maxBoxWidth, configMax);
        }
        
        // Create background
        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.7);
        background.fillRoundedRect(0, 0, boxWidth, boxHeight, cornerRadius);
        background.lineStyle(2, 0xffffff, 0.5);
        background.strokeRoundedRect(0, 0, boxWidth, boxHeight, cornerRadius);
        
        // Word count title
        // Get text styles again for the title (they were only in temporary scope above)
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
        
        const titleText = this.add.text(
            boxWidth / 2, 
            15, 
            "WORD STATS", 
            {
                ...labelStyle,
                fontStyle: 'bold',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);
        
        // Scale all positions consistently
        const iconX = sm.scaleValue(20);
        const labelX = sm.scaleValue(35);
        const valueRightPadding = sm.scaleValue(15);
        const iconRadius = sm.scaleValue(6);
        
        // Scaled Y positions
        const titleY = sm.scaleValue(15);
        const row1Y = sm.scaleValue(40);
        const row2Y = sm.scaleValue(65);
        const row3Y = sm.scaleValue(90);
        const row4Y = sm.scaleValue(115);
        
        // Create icons for different word types
        const originalIcon = this.add.circle(iconX, row1Y, iconRadius, this.design.PROGRESS_BAR.COLORS.SUCCESS);
        originalIcon.setFillStyle(this.design.PROGRESS_BAR.COLORS.SUCCESS); // Ensure proper fill style
        const originalLabel = this.add.text(
            labelX, row1Y, 
            "Original Words:", 
            { ...labelStyle, fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
this.originalCountText = this.add.text(
    boxWidth - valueRightPadding, row1Y, 
    "0", 
    { ...countStyle, fontStyle: 'bold', fill: '#7cfc00' }
).setOrigin(1, 0.5);

const aiIcon = this.add.circle(iconX, row2Y, iconRadius, 0xff3366); // Red color to match the AI counter
aiIcon.setFillStyle(0xff3366); // Ensure proper fill style
const aiLabel = this.add.text(
    labelX, row2Y, 
    "AI Words:", 
    { ...labelStyle, fill: '#ffffff' }
).setOrigin(0, 0.5);

this.aiCountText = this.add.text(
    boxWidth - valueRightPadding, row2Y, 
    "0", 
    { ...countStyle, fontStyle: 'bold', fill: '#ff3366' }
).setOrigin(1, 0.5);
        
        // Streak counter (third row)
        const streakColor = this.getStreakColor(this.wordStreak);
        const streakIcon = this.add.circle(iconX, row3Y, iconRadius, streakColor);
        streakIcon.setFillStyle(streakColor); // Ensure proper fill style
        const streakLabel = this.add.text(
            labelX, row3Y,
            "Current Streak:",
            { ...labelStyle, fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
        this.streakText = this.add.text(
            boxWidth - valueRightPadding, row3Y,
            `${this.wordStreak}`,
            { 
                ...countStyle,
                fontStyle: 'bold', 
                fill: '#' + streakColor.toString(16).padStart(6, '0')
            }
        ).setOrigin(1, 0.5);
        
        // Max streak (fourth row)
        const maxStreakIcon = this.add.circle(iconX, row4Y, iconRadius, 0xffd700); // Gold color for max streak
        maxStreakIcon.setFillStyle(0xffd700); // Ensure proper fill style
        const maxStreakLabel = this.add.text(
            labelX, row4Y,
            "Best Streak:",
            { ...labelStyle, fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
        this.maxStreakText = this.add.text(
            boxWidth - valueRightPadding, row4Y,
            `${this.maxWordStreak}`,
            { 
                ...countStyle,
                fontStyle: 'bold', 
                fill: '#ffd700' 
            }
        ).setOrigin(1, 0.5);
        
        // Add all elements to the container
        this.wordCountDisplay.add([
            background, 
            titleText, 
            originalIcon, originalLabel, this.originalCountText,
            aiIcon, aiLabel, this.aiCountText,
            streakIcon, streakLabel, this.streakText,
            maxStreakIcon, maxStreakLabel, this.maxStreakText
        ]);
        
        // Don't set position here - let createStatsDisplay handle positioning
        
        // Store a reference to the streak icon to update its color
        this.streakIcon = streakIcon;
    }
    
    updateWordCountDisplay() {
        if (!this.wordCountDisplay) return;
        
        // Calculate total words in userInput
        const totalWordCount = this.userInput.trim() ? this.userInput.trim().split(/\s+/).length : 0;
        
        let originalWordCount;
        // Calculate original words (total minus AI words)
        if (this.mode === 'easy') {
            originalWordCount = Math.max(0, totalWordCount - this.aiWordCount);
        }
        else {
            originalWordCount = totalWordCount;
        };
        
        // Now totalWordCount is calculated dynamically from userInput
        this.totalWordCount = totalWordCount;
        
        // Update the count displays with animations
        this.animateCountChange(this.originalCountText, this.originalCountText.text, originalWordCount.toString());
        this.animateCountChange(this.aiCountText, this.aiCountText.text, this.aiWordCount.toString());
        //this.animateCountChange(this.totalCountText, this.totalCountText.text, totalWordCount.toString());
        
        // Update streak counter if it exists
        if (this.streakText) {
            this.streakText.setText(`${this.wordStreak}`);
            
            // Update streak text color based on streak count
            if (this.wordStreak >= 3) {
                this.streakText.setFill('#' + this.getStreakColor(this.wordStreak).toString(16).padStart(6, '0')); // Match icon color
            } else {
                this.streakText.setFill('#' + this.getStreakColor(this.wordStreak).toString(16).padStart(6, '0')); // Match icon color
            }
        }
        
        // Update max streak counter if it exists
        if (this.maxStreakText) {
            this.maxStreakText.setText(`${this.maxWordStreak}`);
        }
        
        // Update streak icon color
        if (this.streakIcon) {
            // Use setFillStyle instead of directly assigning to fillColor which is read-only
            this.streakIcon.setFillStyle(this.getStreakColor(this.wordStreak));
        }
    }
    
    animateCountChange(textObject, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Parse values as integers
        const oldNum = parseInt(oldValue, 10) || 0;
        const newNum = parseInt(newValue, 10) || 0;
        
        // Only animate if increasing
        if (newNum > oldNum) {
            // Create a temporary text object for the animation
            const deviceType = detectDeviceType();
            const uiScale = this.scalingManager?.uiScale || 1;
            const animStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
            const animatedText = this.add.text(
                textObject.x, 
                textObject.y - 15,
                "+" + (newNum - oldNum),
                {
                    ...animStyle,
                    fontStyle: 'bold',
                    fill: '#ffffff'
                }
            ).setOrigin(1, 0.5).setAlpha(0);
            
            // Add it to the same container
            this.wordCountDisplay.add(animatedText);
            
            // Animate the temporary text
            this.fadeIn(animatedText, 200);
            this.tweens.add({
                targets: animatedText,
                y: animatedText.y - 15,
                alpha: { from: 1, to: 0 },
                ease: 'Cubic.Out',
                duration: 800,
                delay: 300,
                onComplete: () => animatedText.destroy()
            });
            
            // Scale effect on the main counter
            this.tweens.add({
                targets: textObject,
                scale: { from: 1, to: 1.3, duration: 200, yoyo: true },
                ease: 'Back.Out',
                duration: 400,
            });
        }
        
        // Update the text
        textObject.setText(newValue);
    }

    ensureTextVisibility() {
        if (this.inputText) {
            this.inputText.setVisible(true);
            this.inputText.setDepth(25);
        }
        if (this.autocompleteText) {
            this.autocompleteText.setVisible(true);
            this.autocompleteText.setDepth(50);
        }
    }

    generateAutocomplete() {
        if (!this.aiSuggestedWords || this.aiSuggestedWords.length === 0) {
            return '';
        }
    
        // Get the current word being typed
        const lastSpaceIndex = this.userInput.lastIndexOf(' ');
        const lastNewlineIndex = this.userInput.lastIndexOf('\n');
        const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
        const currentWord = lastBreakIndex >= 0 ? this.userInput.slice(lastBreakIndex + 1) : this.userInput;
        
        // Find matching suggestion for current word
        let suggestion = null;
        
        if (!currentWord || currentWord.endsWith(' ') || currentWord.endsWith('\n')) {
            // If at a word boundary, use first suggestion
            suggestion = this.aiSuggestedWords[0];
            
            if (suggestion) {
                // Return the suggestion directly so it can be appended to the input text
                return suggestion;
            }
        } else {
            // Find matching suggestion for current word being typed
            suggestion = this.aiSuggestedWords.find(word => 
                word.toLowerCase().startsWith(currentWord.toLowerCase())
            );
    
            if (suggestion) {
                // Only return the completion part (not the already typed portion)
                return suggestion.slice(currentWord.length);
            }
        }

        return '';
    }
    
    // Update cursor and input text display
    updateCursor() {
        if (this.isShuttingDown) return;
        if (!this.inputText || this.inputText.destroyed) return;
        
        // Initialize cached values if not already initialized
        if (!this._cachedValues) {
            this._cachedValues = {
                lastUserInput: '',
                lastAutocomplete: ''
            };
        }
        
        // Check if we need to update based on cached values
        const currentAutocomplete = this.generateAutocomplete();
        const hasTextChanged = this.userInput !== this._cachedValues.lastUserInput;
        const hasAutocompleteChanged = currentAutocomplete !== this._cachedValues.lastAutocomplete;
        const hasCursorChanged = this._lastCursorVisible !== this.cursorVisible;
        
        // Only update if something has actually changed
        if (!hasTextChanged && !hasAutocompleteChanged && !hasCursorChanged) {
            return;
        }
        
        // Update cached values
        this._cachedValues.lastUserInput = this.userInput;
        this._cachedValues.lastAutocomplete = currentAutocomplete;
        this._lastCursorVisible = this.cursorVisible;
        
        // Build display text efficiently
        let displayText = this.userInput;
        
        // On mobile, prefer hidden input value if available
        if (this.isMobile && this._hiddenInput && typeof this._hiddenInput.value === "string") {
            displayText = this._hiddenInput.value;
        }
        
        // TEMPORARILY DISABLED: Inline autocomplete hidden but still calculated in background
        // Append cursor only (no autocomplete)
        if (this.cursorVisible) {
            displayText += "_";
        } else {
            displayText += " ";
        }
        
        // Update text in one operation
        this.inputText.setText(displayText);
        
        // Clear deprecated autocomplete text if it exists
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
    }

    createSettingsButton(x, y, menuBarHeight) {
        // Create settings button using the PNG
        const settingsIcon = this.add.image(x, y, 'settings').setOrigin(0.5);

        // Set icon size relative to menu bar height
        let iconSize = Math.round(menuBarHeight * 0.4);
        // Slightly increase icon size for mobile devices
        if (this.isMobile) {
            iconSize = Math.round(menuBarHeight * 0.35); // was 0.25, now slightly larger
        }
        settingsIcon.setDisplaySize(iconSize, iconSize);

        // Make the settings icon white
        settingsIcon.setTint(0xffffff);
        
        // Make it interactive without scale effects
        settingsIcon.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                this.showTooltip('Settings: \nLevel\nMode', settingsIcon.x, settingsIcon.y + 50);
            })
            .on('pointerout', () => {
                this.hideTooltips();
            })
            .on('pointerdown', () => {
                // No scale effect
            })
            .on('pointerup', () => {
                this.toggleSettingsPopup();
            });
        
        // Store reference to the button
        this.settingsButton = settingsIcon;
    }

    createFailsCounter() {
        if (this.failsCounter) {
            this.failsCounter.clear();
        } else {
            this.failsCounter = this.add.graphics();
        }
        
        if (this.failsText) {
            this.failsText.destroy();
        }
    
        // Calculate width to match two buttons plus spacing
        const scoreWidth = DESIGN.UI.BUTTON.WIDTH * 2 + DESIGN.UI.BUTTON.SPACING;
        const scoreHeight = DESIGN.UI.BUTTON.HEIGHT;
        
        // Calculate position using the new layout calculation
        const statsBoxWidth = 180;
        const statsBoxHeight = 130;
        const statsDisplayY = this.menuBarHeight + 20;
        const statsBottomEdge = statsDisplayY + statsBoxHeight;
        
        // Use configuration constants for prompt offset
        const promptOffset = this.isMobile 
            ? SCENE_CONFIG.LAYOUT.MOBILE_PROMPT_OFFSET_BELOW_STATS 
            : SCENE_CONFIG.LAYOUT.PROMPT_OFFSET_BELOW_STATS;
        const promptY = statsBottomEdge + promptOffset;
        const promptBoxHeight = 80;
        const promptBottomEdge = promptY + promptBoxHeight;
        
        // Input box is 20px below prompt box
        const inputBoxY = promptBottomEdge + 20;
        const inputBoxHeight = 240;
        const inputBoxBottomEdge = inputBoxY + inputBoxHeight;
        

        const buttonPadding = 70; // Standard padding used for buttons
        
        // Set X position with the same padding as buttons have from right side
        const scoreX = this.cameras.main.centerX - this.uiBoxWidth / 2 + buttonPadding;
        const scoreY = inputBoxBottomEdge + DESIGN.UI.BUTTON.BELOW_TEXTBOX_GAP;

        // Set depth and position
        this.failsCounter.setPosition(scoreX, scoreY).setDepth(50);
        
        // Add tooltip for the score bar (progress bar)
        this.failsCounter.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, scoreWidth, scoreHeight),
            Phaser.Geom.Rectangle.Contains
        )
        .on('pointerover', () => {
            this.showTooltip(
                "Progress Bar:\nWrite original words to fill the bar.\nUsing AI words reduces progress.",
                scoreX + scoreWidth / 2,
                scoreY - 10
            );
        })
        .on('pointerout', () => {
            this.hideTooltips();
        });
        
        // Get text style from textStyles.js
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const textStyle = getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
        
        this.failsText = this.add.text(
            scoreX + scoreWidth / 2,
            scoreY + scoreHeight / 2,
            ' ',
            {
                ...textStyle,
                fill: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(51);


    }

    showTooltip(text, x, y) {
        // Hide any existing tooltips
        this.hideTooltips();

        // Create tooltip background
        const padding = 10;
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const tooltipStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const tooltipText = this.add.text(0, 0, text, {
            ...tooltipStyle,
            color: '#ffffff',
            align: 'center'
        });

        const width = tooltipText.width + padding * 2;
        const height = tooltipText.height + padding * 2;

        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRoundedRect(0, 0, width, height, 8);
        background.lineStyle(1, 0xffffff, 0.3);
        background.strokeRoundedRect(0, 0, width, height, 8);

        // Calculate initial position
        let tooltipX = x - width / 2;
        let tooltipY = y - height - 5;

        // Clamp X so tooltip stays within screen horizontally
        tooltipX = Math.max(0, Math.min(tooltipX, this.sys.game.canvas.width - width));
        // Clamp Y so tooltip stays within screen vertically
        tooltipY = Math.max(0, Math.min(tooltipY, this.cameras.main.height - height));

        // Create container for tooltip
        const container = this.add.container(tooltipX, tooltipY, [background, tooltipText]);
        tooltipText.setPosition(padding, padding);

        // Add to active tooltips
        this.tooltips.push(container);

        // Fade in effect
        container.setAlpha(0);
        this.fadeIn(container, 200, 'Quad.easeOut');

        container.setDepth(1000);
    }
    
    hideTooltips() {
        this.tooltips.forEach(tooltip => {
            this.fadeOut(tooltip, 200, 'Quad.easeOut', () => tooltip.destroy());
        });
        this.tooltips = [];
    }

    addButtonClickEffects() {
        const buttons = [
            { button: this.doneButton, tooltip: 'Escalate to supervisory oversight' },
            { button: this.resetButton, tooltip: 'Reset field. Begin anew' },
            { button: this.feedbackButton, tooltip: 'Report anomaly or praise' },
            //{ button: this.hardButton, tooltip: 'Switch to Hard mode: No AI suggestions' },
            //{ button: this.easyButton, tooltip: 'Switch to Easy mode: AI suggestions allowed' }
        ];
        
        buttons.forEach(({ button, tooltip }) => {
            if (!button) return;
            
            button.on('pointerover', () => {
                button.setScale(1.1);
                if (tooltip) {
                    this.showTooltip(tooltip, button.x, button.y - button.height/2);
                }
            });
            
            button.on('pointerout', () => {
                button.setScale(1);
                this.hideTooltips();
            });
            
            button.on('pointerdown', () => {
                button.setScale(0.95);
            });
            
            button.on('pointerup', () => {
                button.setScale(1.1);
            });
        });
    }

    createInputBoxClickEffect(x, y) {
        // Create a more visible effect for mobile
        const size = this.isMobile ? 10 : 5;
        const color = this.isMobile ? 0x00ffff : 0xffffff; // Cyan for mobile, white for desktop
        const alpha = this.isMobile ? 0.7 : 0.5;
        
        const circle = this.add.circle(x, y, size, color, alpha).setDepth(15);
        
        // Create a more pronounced animation for mobile
        this.tweens.add({
            targets: circle,
            scale: { from: 0.5, to: this.isMobile ? 3 : 2 },
            alpha: { from: alpha, to: 0 },
            duration: this.isMobile ? 700 : 500,
            ease: 'Quad.easeOut',
            onComplete: () => circle.destroy()
        });
        
        // For mobile, add a second, larger pulse effect
        if (this.isMobile) {
            const outerCircle = this.add.circle(x, y, size * 2, color, alpha * 0.5).setDepth(14);
            
            this.tweens.add({
                targets: outerCircle,
                scale: { from: 0.5, to: 4 },
                alpha: { from: alpha * 0.5, to: 0 },
                duration: 900,
                ease: 'Quad.easeOut',
                onComplete: () => outerCircle.destroy()
            });
        }
    }



    updateFailsCounter(success) {
        // Keep tracking logic only - no visuals
        if (success) {
            // Non-AI word - just track it
            // (No visual effects)
        } else {
            // AI word - update count
            this.aiWordCount++;
        }
        
        // Update the word count display
        this.updateWordCountDisplay();
        
        // Update the streak counter - success means original word
        this.updateStreakCounter(success);
    }
    
    /**
     * Create particle burst for successful word entry
     * REMOVED: Performance optimization
     */
    createWordSuccessParticles() {
        // Method removed for performance optimization
        return;
    }

    /**
     * Create a floating effect for a successfully typed word
     * REMOVED: Performance optimization
     */
    createRisingWordEffect(word) {
        // Calculate cursor position based on current text
        let cursorX, cursorY;
        
        if (this.inputText && this.inputText.x && this.inputText.y) {
            // Get the input text style properties
            const fontSize = parseInt(this.inputText.style.fontSize);
            const lineHeight = fontSize * 1.2;
            const padding = this.isMobile ? 20 : 28; // Match the padding from createInputSection
            
            // Calculate how many lines the text spans
            const textWidth = this.inputBoxWidth - padding * 2; // Available width for text
            
            // Create a temporary text object with word wrap to measure properly
            const tempText = this.add.text(0, 0, this.userInput, {
                fontFamily: this.inputText.style.fontFamily,
                fontSize: this.inputText.style.fontSize,
                fontStyle: this.inputText.style.fontStyle || 'normal',
                wordWrap: { width: textWidth }
            });
            
            // Get the number of lines
            const lines = tempText.getWrappedText(this.userInput);
            const currentLineIndex = lines.length - 1; // We're at the end of the text
            
            // Get the text on the current (last) line
            const currentLineText = lines[currentLineIndex] || '';
            
            // Measure just the current line's width
            tempText.setText(currentLineText);
            const currentLineWidth = tempText.width;
            
            // Calculate cursor X position (at the end of the current line)
            cursorX = this.inputText.x + currentLineWidth;
            
            // Calculate cursor Y position (accounting for line number)
            // Start from the top of the first line and add line height for each line
            cursorY = this.inputText.y + (currentLineIndex * lineHeight) + lineHeight / 2;
            
            // Clean up temporary text
            tempText.destroy();
            
            // Clamp cursor position to stay within input box bounds
            const inputBoxRight = this.inputBoxX + this.inputBoxWidth - padding;
            cursorX = Math.min(cursorX, inputBoxRight);
            
            // Also clamp Y position to stay within input box
            const inputBoxBottom = this.inputBoxY + this.inputBoxHeight - padding;
            cursorY = Math.min(cursorY, inputBoxBottom - lineHeight / 2);
        } else {
            // Fallback to center if inputText is not available
            cursorX = this.cameras.main.centerX;
            cursorY = this.inputBoxY + this.inputBoxHeight / 2;
        }
        
        // Calculate a dynamic color based on streak
        let colors;
        if (this.wordStreak >= 20) {
            // Mostly green with hint of white for high streaks
            colors = [0x00ff00, 0x22ff22, 0x44ff44, 0xeeffee];
        } else if (this.wordStreak >= 15) {
            // More white, transitioning to green
            colors = [0xffffff, 0xeeffff, 0xddffdd, 0xaaffaa];
        } else if (this.wordStreak >= 10) {
            // Mostly white with hints of teal and green
            colors = [0xffffff, 0xf0ffff, 0xe0ffff, 0xd0ffd0];
        } else if (this.wordStreak >= 5) {
            // White with more teal
            colors = [0xeeffff, 0xccffff, 0xaaffff, 0xffffff];
        } else {
            // Mostly teal with a bit of white for low/no streak
            colors = [0x20e3e3, 0x40e3e3, 0x60e3e3, 0xf0ffff];
        }
        
        // Create more particles but much smaller
        const particleCount = 20 + Math.min(this.wordStreak * 2, 45);
        for (let i = 0; i < particleCount; i++) {
            const size = Phaser.Math.Between(2, 6); // Double the size (2-6 pixels)
            const color = colors[Phaser.Math.Between(0, colors.length - 1)];
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.FloatBetween(200, 400); // Double the speed for larger explosion area
            
            const particle = this.add.circle(
                cursorX,
                cursorY,
                size,
                color,
                0.9 // Slightly transparent
            ).setDepth(500);
            
            // Calculate velocity
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            // Animate the particle
            this.tweens.add({
                targets: particle,
                x: particle.x + vx,
                y: particle.y + vy,
                alpha: { from: 0.9, to: 0 },
                scale: { from: 1, to: 0.5 }, // Scale down for subtle effect
                duration: Phaser.Math.Between(600, 1500),
                ease: 'Cubic.Out',
                onComplete: () => particle.destroy()
            });
        }
        
        // Add a subtle flash effect at the cursor position
        const flash = this.add.circle(
            cursorX,
            cursorY,
            30, // Double the flash size
            colors[0],
            0.4
        ).setDepth(499);
        
        // Animate the flash
        this.tweens.add({
            targets: flash,
            scale: { from: 0.5, to: 4 }, // Double the scale animation range
            alpha: { from: 0.4, to: 0 },
            duration: 300,
            ease: 'Expo.Out',
            onComplete: () => flash.destroy()
        });
    }

    // Visual effects for progress bar: scale pop, color flash, shake
    animateProgressBarChange(type) {
        if (!this.failsCounter) return;
        const bar = this.failsCounter;
        const scene = this;

        // Store original position for shake reset
        if (bar.originalX === undefined) {
            bar.originalX = bar.x;
        }

        // Shake
        scene.tweens.add({
            targets: bar,
            x: bar.originalX + (type === "increment" ? 2 : -2),
            yoyo: true,
            repeat: 3,
            duration: 40,
            onComplete: () => {
                bar.x = bar.originalX;
            }
        });
 
    }

    // Get appropriate color based on streak count
    getStreakColor(streak) {
        if (streak >= 10) return 0xffd700; // Gold
        if (streak >= 7) return 0xff4500;  // Orange-red
        if (streak >= 5) return 0xff8c00;  // Dark orange
        if (streak >= 3) return 0x32cd32;  // Lime green
        return 0x4169e1;                   // Royal blue
    }
    
    // Get appropriate color based on streak count
    getStreakColor(streak) {
        if (streak >= 10) return 0xffd700; // Gold
        if (streak >= 7) return 0xff4500;  // Orange-red
        if (streak >= 5) return 0xff8c00;  // Dark orange
        if (streak >= 3) return 0x32cd32;  // Lime green
        return 0x4169e1;                   // Royal blue
    }
    
    // Update the streak counter with animations
    updateStreakCounter(isOriginalWord) {
        // Track if this is a new streak
        const previousStreak = this.wordStreak;
        
        if (isOriginalWord) {
            // Increment streak for original words
            this.wordStreak++;
            this.lastWordWasOriginal = true;
            
            // Update max streak if needed
            if (this.wordStreak > this.maxWordStreak) {
                this.maxWordStreak = this.wordStreak;
            }
        } else {
            // Reset streak for AI words
            this.wordStreak = 0;
            this.lastWordWasOriginal = false;
            
            // Cleanup any existing streak-specific visual elements
            this.cleanupStreakVisuals();
        }
        
        // Update the word count display which contains the streak counters
        this.updateWordCountDisplay();
        
        // Update background based on the new streak value
        this.updateBackgroundForStreak();
        
        // If streak has increased, add celebration effects at milestones
        if (isOriginalWord && this.wordStreak > previousStreak) {
            // Add streak milestone effects
            this.celebrateStreakMilestone(this.wordStreak, previousStreak);
        }
    }
    
    // Helper method to clean up any streak-specific visuals
    cleanupStreakVisuals() {
        // Clean up any existing streak-specific background elements
        if (this.background && this.background.active) {
            // Clean up the border if it exists
            if (this.background.streakBorder && this.background.streakBorder.active) {
                this.background.streakBorder.destroy();
                this.background.streakBorder = null;
            }
            
            // Clean up particles if they exist
            if (this.background.particles && Array.isArray(this.background.particles)) {
                this.background.particles.forEach(particle => {
                    try {
                        if (particle && particle.active) {
                            particle.destroy();
                        }
                    } catch (e) {
                        // Ignore errors during particle cleanup
                    }
                });
                this.background.particles = null;
            }
            
            // Clean up glow overlay if it exists
            if (this.background.glowOverlay && this.background.glowOverlay.active) {
                this.background.glowOverlay.destroy();
                this.background.glowOverlay = null;
            }
            
            // Clean up vignette if it exists
            if (this.background.vignette && this.background.vignette.active) {
                this.background.vignette.destroy();
                this.background.vignette = null;
            }
            
            // Clean up flares if they exist
            if (this.background.flares && Array.isArray(this.background.flares)) {
                this.background.flares.forEach(flare => {
                    try {
                        if (flare && flare.active) {
                            flare.destroy();
                        }
                    } catch (e) {
                        // Ignore errors during flare cleanup
                    }
                });
                this.background.flares = null;
            }
            
            // Clean up mobile overlay if it exists
            if (this.background.overlay && this.background.overlay.active) {
                this.background.overlay.destroy();
                this.background.overlay = null;
            }
        }
    }
    
    // Update background based on the current streak
    updateBackgroundForStreak() {
        // Only update the background visually, don't trigger a full UI relayout
        // which would destroy existing UI elements like suggestion boxes
        this.time.delayedCall(0, () => {
            // Clean up existing background elements first
            if (this.background && this.background.active) {
                // Clean up any existing streak-specific background elements
                this.cleanupStreakVisuals();
            }
            
            // Continue with background creation after cleanup
            this._createBackgroundAfterCleanup();
        });
    }
    
    // Celebrate streak milestones with special effects
    celebrateStreakMilestone(currentStreak, previousStreak) {
        // Define milestone thresholds
        const milestones = [3, 5, 7, 10, 15, 20];
        
        // Check if we crossed any milestone
        for (const milestone of milestones) {
            if (previousStreak < milestone && currentStreak >= milestone) {
                // We crossed a milestone, add celebration effects
                const text = milestone === 3 ? "STREAK!" : 
                            milestone === 5 ? "NICE STREAK!" : 
                            milestone === 7 ? "GREAT STREAK!" :
                            milestone === 10 ? "AMAZING STREAK!" :
                            milestone === 15 ? "INCREDIBLE STREAK!" :
                            "UNSTOPPABLE!";
                
                // Position celebration text at the top-right near the word stats panel
                const padding = 20;
                const displayX = this.sys.game.canvas.width - 180 - padding; // Same as word stats x position
                
                // Get text style from textStyles.js
                const deviceType = detectDeviceType();
                const uiScale = this.scalingManager?.uiScale || 1;
                const effectStyle = getTextStyle('effect', deviceType, this.mode || 'basic', uiScale);
                
                // Celebration text that appears near the word stats
                const celebrationText = this.add.text(
                    displayX + 90, // Center of the word stats panel
                    this.menuBarHeight + 150, // Below the word stats panel
                    text,
                    {
                        ...effectStyle,
                        fontSize: '28px', // Larger font size
                        fontStyle: 'bold',
                        fill: '#ffff00', // Bright yellow for better visibility
                        stroke: '#ff0000', // Red stroke for contrast
                        strokeThickness: 6, // Thicker stroke
                        shadow: {
                            offsetX: 3,
                            offsetY: 3,
                            color: '#000000',
                            blur: 8,
                            stroke: true,
                            fill: true
                        }
                    }
                ).setOrigin(0.5, 0.5).setDepth(1000); // Much higher depth
                
                // Animate the celebration text with proper visibility
                celebrationText.setAlpha(0);
                celebrationText.setScale(0.5);
                
                // First fade in and scale up
                this.tweens.add({
                    targets: celebrationText,
                    alpha: 1,
                    scale: 1,
                    duration: 300,
                    ease: 'Back.Out',
                    onComplete: () => {
                        // Then animate up and fade out after a delay
                        this.tweens.add({
                            targets: celebrationText,
                            y: celebrationText.y - 80,
                            alpha: 0,
                            scale: 1.5,
                            duration: 1200,
                            delay: 500, // Keep visible for 500ms
                            ease: 'Power2.In',
                            onComplete: () => celebrationText.destroy()
                        });
                    }
                });
                
                // Highlight the word stats panel for a moment
                if (this.wordCountDisplay) {
                    this.tweens.add({
                        targets: this.wordCountDisplay,
                        scale: { from: 1, to: 1.05, duration: 200 },
                        yoyo: true,
                        repeat: 2,
                        ease: 'Sine.InOut'
                    });
                }
                
                // Add screen edge flash effect for mobile
                if (this.isMobile) {
                    this.createMobileScreenEdgeFlash(milestone);
                }
                
                // Only celebrate the highest milestone crossed
                break;
            }
        }
    }
    
    /**
     * Create a screen edge flash effect for mobile devices when hitting streak milestones
     * @param {number} milestone - The milestone that was reached
     */
    createMobileScreenEdgeFlash(milestone) {
        const mode = this.mode || 'easy';
        const flashColor = mode === 'easy' ? 0x00ffff : 0xff00ff; // Cyan for easy, magenta for hard
        
        // Determine flash intensity based on milestone
        let flashAlpha, flashDuration, pulseCount;
        if (milestone >= 20) {
            flashAlpha = 0.6;
            flashDuration = 400;
            pulseCount = 3;
        } else if (milestone >= 15) {
            flashAlpha = 0.5;
            flashDuration = 350;
            pulseCount = 3;
        } else if (milestone >= 10) {
            flashAlpha = 0.4;
            flashDuration = 300;
            pulseCount = 2;
        } else if (milestone >= 5) {
            flashAlpha = 0.35;
            flashDuration = 250;
            pulseCount = 2;
        } else {
            flashAlpha = 0.3;
            flashDuration = 200;
            pulseCount = 1;
        }
        
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const edgeWidth = 15; // Width of the edge flash
        
        // Create edge flash graphics
        const edges = this.add.graphics();
        edges.setDepth(995); // High depth but below UI elements
        
        // Function to draw the edge flash
        const drawEdgeFlash = (alpha) => {
            edges.clear();
            edges.fillStyle(flashColor, alpha);
            
            // Top edge
            edges.fillRect(0, 0, screenWidth, edgeWidth);
            // Bottom edge
            edges.fillRect(0, screenHeight - edgeWidth, screenWidth, edgeWidth);
            // Left edge
            edges.fillRect(0, 0, edgeWidth, screenHeight);
            // Right edge
            edges.fillRect(screenWidth - edgeWidth, 0, edgeWidth, screenHeight);
            
            // Corner enhancements for higher milestones
            if (milestone >= 10) {
                const cornerSize = 40;
                // Top-left corner
                edges.fillTriangle(0, 0, cornerSize, 0, 0, cornerSize);
                // Top-right corner
                edges.fillTriangle(screenWidth, 0, screenWidth - cornerSize, 0, screenWidth, cornerSize);
                // Bottom-left corner
                edges.fillTriangle(0, screenHeight, cornerSize, screenHeight, 0, screenHeight - cornerSize);
                // Bottom-right corner
                edges.fillTriangle(screenWidth, screenHeight, screenWidth - cornerSize, screenHeight, screenWidth, screenHeight - cornerSize);
            }
        };
        
        // Initial draw
        drawEdgeFlash(0);
        
        // Create the pulsing animation
        let currentPulse = 0;
        const pulseAnimation = () => {
            currentPulse++;
            
            // Fade in
            this.tweens.add({
                targets: { alpha: 0 },
                alpha: flashAlpha,
                duration: flashDuration / 2,
                ease: 'Sine.In',
                onUpdate: (tween) => {
                    drawEdgeFlash(tween.getValue());
                },
                onComplete: () => {
                    // Fade out
                    this.tweens.add({
                        targets: { alpha: flashAlpha },
                        alpha: 0,
                        duration: flashDuration / 2,
                        ease: 'Sine.Out',
                        onUpdate: (tween) => {
                            drawEdgeFlash(tween.getValue());
                        },
                        onComplete: () => {
                            if (currentPulse < pulseCount) {
                                // Do another pulse
                                this.time.delayedCall(100, pulseAnimation);
                            } else {
                                // Clean up
                                edges.destroy();
                            }
                        }
                    });
                }
            });
        };
        
        // Start the animation
        pulseAnimation();
        
        // Add subtle camera shake for higher milestones
        if (milestone >= 10) {
            this.cameras.main.shake(200, 0.003);
        }
    }
    
    // Particle burst for progress bar
    emitProgressBarParticles(type) {
        if (!this.failsCounter) return;
        const bar = this.failsCounter;
        const scene = this;

        // Get bar position (center of progress bar)
        const scoreWidth = scene.DESIGN?.UI?.BUTTON?.WIDTH * 2 + scene.DESIGN?.UI?.BUTTON?.SPACING || 180;
        const scoreHeight = scene.DESIGN?.UI?.BUTTON?.HEIGHT || 40;
        const barX = bar.x + scoreWidth / 2;
        const barY = bar.y + scoreHeight / 2;

        // Particle color
        const color = type === "increment" ? 0xffff00 : 0xff0000;

        // Only use graphics-based burst (draw circles and animate them)
        for (let i = 0; i < 16; i++) {
            const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
            const distance = Phaser.Math.Between(30, 80);
            const size = Phaser.Math.Between(6, 14);
            const startX = barX;
            const startY = barY;
            const endX = startX + Math.cos(angle) * distance;
            const endY = startY + Math.sin(angle) * distance;
            const circle = scene.add.circle(startX, startY, size, color, 0.8).setDepth(199);
            scene.tweens.add({
                targets: circle,
                x: endX,
                y: endY,
                alpha: 0,
                scale: { from: 1, to: 0 },
                duration: 500,
                ease: 'Quad.Out',
                onComplete: () => circle.destroy()
            });
        }
    }

    // Custom celebration effect without using particle emitters
    celebrateSuccess() {
        // Get positions based on the progress bar

        const scoreWidth = DESIGN.UI.BUTTON.WIDTH * 2 + DESIGN.UI.BUTTON.SPACING;
        const scoreHeight = DESIGN.UI.BUTTON.HEIGHT;
        const inputBoxY = this.cameras.main.centerY - 240 / 2;
        const inputBoxHeight = 240;
        const padding = 20;
        const scoreX = this.cameras.main.centerX - this.uiBoxWidth / 2 + 70;
        const scoreY = inputBoxY + inputBoxHeight + padding;
        
        // Create celebration text
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const textStyle = getTextStyle('transitionText', deviceType, this.mode || 'basic', uiScale);
        
        const text = this.add.text(
            scoreX + scoreWidth/2,
            scoreY,
            'Reluctant approval granted.',
            {
                ...textStyle,
                fill: '#7cfc00', // Bright green
                stroke: '#ffffff',
                strokeThickness: 2
            }
        ).setOrigin(0.5).setDepth(200);
        
        // Create multiple circles that expand outward in place of particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 60 + 20;
            const size = Math.random() * 8 + 4;
            const startX = scoreX + scoreWidth/2;
            const startY = scoreY + scoreHeight/2;
            
            const circle = this.add.circle(
                startX,
                startY,
                size,
                0x7cfc00, // Green
                0.8
            ).setDepth(199);
            
            this.tweens.add({
                targets: circle,
                x: startX + Math.cos(angle) * distance,
                y: startY + Math.sin(angle) * distance,
                alpha: 0,
                scale: { from: 1, to: 0 },
                duration: 1000,
                ease: 'Quad.Out',
                onComplete: () => circle.destroy()
            });
        }
        
        // Animate text
        this.tweens.add({
            targets: text,
            y: text.y - 80,
            scale: { from: 1, to: 1.5 },
            alpha: { from: 1, to: 0 },
            duration: 1200,
            ease: 'Cubic.Out',
            onComplete: () => text.destroy()
        });
        
        // Screen flash with green
        const flash = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x7cfc00, // Green
            0.2
        ).setOrigin(0).setDepth(100);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.Out',
            onComplete: () => flash.destroy()
        });
    }

    // Custom celebration effect without using particle emitters for "Needs Work" state
    celebrateNeedsWork() {
        // Get positions based on the progress bar
        const scoreWidth = DESIGN.UI.BUTTON.WIDTH * 2 + DESIGN.UI.BUTTON.SPACING;
        const scoreHeight = DESIGN.UI.BUTTON.HEIGHT;
        const inputBoxY = this.cameras.main.centerY - 240 / 2;
        const inputBoxHeight = 240;
        const padding = 20;
        const scoreX = this.cameras.main.centerX - this.uiBoxWidth / 2 + 70;
        const scoreY = inputBoxY + inputBoxHeight + padding;
        
        // Create celebration text
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const textStyle = getTextStyle('transitionText', deviceType, this.mode || 'basic', uiScale);
        
        const text = this.add.text(
            scoreX + scoreWidth/2,
            scoreY,
            'Utterly disappointing.',
            {
                ...textStyle,
                fill: DESIGN.COLORS.AUTOCOMPLETE, // Red color
                stroke: '#ffffff',
                strokeThickness: 2
            }
        ).setOrigin(0.5).setDepth(200);
        
        // Create multiple circles that expand outward in place of particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 60 + 20;
            const size = Math.random() * 8 + 4;
            const startX = scoreX + scoreWidth/2;
            const startY = scoreY + scoreHeight/2;
            
            const circle = this.add.circle(
                startX,
                startY,
                size,
                DESIGN.UI.PROGRESS_BAR.COLORS.WARNING, // orange color
                0.8
            ).setDepth(199);
            
            this.tweens.add({
                targets: circle,
                x: startX + Math.cos(angle) * distance,
                y: startY + Math.sin(angle) * distance,
                alpha: 0,
                scale: { from: 1, to: 0 },
                duration: 1000,
                ease: 'Quad.Out',
                onComplete: () => circle.destroy()
            });
        }
        
        // Animate text
        this.tweens.add({
            targets: text,
            y: text.y - 80,
            scale: { from: 1, to: 1.5 },
            alpha: { from: 1, to: 0 },
            duration: 1200,
            ease: 'Cubic.Out',
            onComplete: () => text.destroy()
        });
        
        // Screen flash with red
        const flash = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            DESIGN.UI.PROGRESS_BAR.COLORS.DANGER, // Red color
            0.2
        ).setOrigin(0).setDepth(100);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.Out',
            onComplete: () => flash.destroy()
        });
    }




    /**
     * Clean up all suggestion-related visual elements
     */
    cleanupAllSuggestions() {

        
        // First clean up tracked elements with null safety
        if (this.suggestionBoxes && Array.isArray(this.suggestionBoxes) && this.suggestionBoxes.length > 0) {
            this.suggestionBoxes.forEach(box => {
                try {
                    if (box && box.active && !box.destroyed) {
                        // Check if clear method exists before calling
                        if (typeof box.clear === 'function') {
                            box.clear();
                        }
                        box.destroy();
                    }
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });
        }
        if (this.suggestionTexts && Array.isArray(this.suggestionTexts) && this.suggestionTexts.length > 0) {
            this.suggestionTexts.forEach(text => {
                try {
                    if (text && text.active && !text.destroyed) {
                        text.destroy();
                    }
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });
        }
        
        // Then do a comprehensive cleanup of any remaining suggestion elements
        if (this.children && this.children.list && Array.isArray(this.children.list)) {
            // Create a copy of the list to avoid modification during iteration
            const childrenToCheck = [...this.children.list];
            childrenToCheck.forEach(child => {
                try {
                    if (child && child.active && !child.destroyed) {
                        // Check for suggestion-related depths (15-16)
                        if (child.depth >= 15 && child.depth <= 16) {
                            // Check if it's a graphics or text object
                            if (child.type === 'Graphics' || child.type === 'Text' || 
                                (child.constructor && (child.constructor.name === 'Graphics' || child.constructor.name === 'Text'))) {
                                // For graphics objects, clear before destroying
                                if ((child.type === 'Graphics' || (child.constructor && child.constructor.name === 'Graphics')) 
                                    && typeof child.clear === 'function') {
                                    child.clear();
                                }
                                child.destroy();
                            }
                        }
                    }
                } catch (e) {
                    // Ignore destruction errors
                }
            });
        }
        
        // Reset arrays
        this.suggestionBoxes = [];
        this.suggestionTexts = [];
    }

    showSuggestions(word) {
 
        
        // Handle array input for backward compatibility (convert to single word)
        if (Array.isArray(word)) {
            word = word.length > 0 ? word[0] : null;
        }
        
        // Always clean up existing suggestions first, even if no new suggestions
        this.cleanupAllSuggestions();
        
        // Early return if no word
        if (!word) {
            return;
        }

        // Initialize scaling manager if not exists
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        const sm = this.scalingManager;
        
        // Scale all dimensions properly
        const padding = sm.scaleValue(20);
        const boxHeight = sm.scaleValue(30);
        const labelSpacing = sm.scaleValue(10); // Space between label and box
        
        // Calculate position dynamically between prompt box and input box
        let suggestionsY;
        
        if (this.promptBoxInfo && this.inputBoxY) {
            // Calculate available space between prompt box bottom and input box top
            const promptBottom = this.promptBoxInfo.boxBottom;
            const inputTop = this.inputBoxY;
            const availableSpace = inputTop - promptBottom;
            
            // Position suggestions in the middle of available space
            const middlePoint = promptBottom + (availableSpace / 2);
            suggestionsY = middlePoint - (boxHeight / 2);
            
            // Ensure there's at least some padding from both boxes (scaled)
            const minPadding = sm.scaleValue(10);
            const maxY = inputTop - boxHeight - minPadding;
            const minY = promptBottom + minPadding;
            
            suggestionsY = Math.max(minY, Math.min(suggestionsY, maxY));
        } else {
            // Fallback positioning - use stored inputBoxY if available
            if (this.inputBoxY) {
                const suggestionsOffset = sm.scaleValue(70);
                suggestionsY = this.inputBoxY - suggestionsOffset - boxHeight;
            } else {
                // Last resort - position relative to center
                suggestionsY = this.cameras.main.centerY - sm.scaleValue(100);
            }
        }
        
        // Get text style and measure both label and word
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const suggestionStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        
        // Measure the "My suggestion: " label
        const tempLabel = this.add.text(0, 0, "My suggestion: ", suggestionStyle);
        const labelWidth = tempLabel.width;
        tempLabel.destroy();
        
        // Measure the word
        const tempText = this.add.text(0, 0, word, suggestionStyle);
        const boxWidth = tempText.width + padding * 2;
        tempText.destroy();
        
        // Calculate total width of label + spacing + box
        const totalWidth = labelWidth + labelSpacing + boxWidth;
        
        // Calculate starting X position to center the entire group
        const startX = this.cameras.main.centerX - totalWidth / 2;
        
        // Create the "My suggestion: " label (no box, just white text)
        const labelText = this.add.text(
            startX,
            suggestionsY + boxHeight / 2,
            "My suggestion: ",
            { ...suggestionStyle, color: '#ffffff' }
        ).setOrigin(0, 0.5).setDepth(16);
        
        // Calculate box position (to the right of the label)
        const boxX = startX + labelWidth + labelSpacing;
        
        // Create the box
        const box = this.add.graphics();
        box.fillStyle(0xff0000, 0.3);
        box.fillRoundedRect(boxX, suggestionsY, boxWidth, boxHeight, 10);
        box.lineStyle(2, 0xff0000, 0.8);
        box.strokeRoundedRect(boxX, suggestionsY, boxWidth, boxHeight, 10);
        box.setDepth(15);
        
        // Create the word text inside the box
        const text = this.add.text(
            boxX + padding,
            suggestionsY + boxHeight / 2,
            word,
            { ...suggestionStyle, color: '#ffffff' }
        ).setOrigin(0, 0.5).setDepth(16);
        
        // Store for cleanup
        this.suggestionBoxes.push(box);
        this.suggestionTexts.push(labelText); // Store label for cleanup
        this.suggestionTexts.push(text); // Store word text for cleanup
    }

    preload() {
        // Ensure mobile background images are loaded
        // This is a backup in case they weren't loaded in Preloader
        const isMobileCheck = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || 
                             (typeof window !== 'undefined' && window.innerWidth <= 900);
        
        if (isMobileCheck) {
            console.log("[MOBILE BG] Preloading mobile backgrounds in BaseGameScene");
            this.load.setPath('assets/backgrounds');
            for (let level = 1; level <= 3; level++) {
                this.load.image(`easy_lvl_${level}`, `easy_lvl_${level}.png`);
                this.load.image(`hard_lvl_${level}`, `hard_lvl_${level}.png`);
            }
            this.load.setPath('assets');
        }
    }
    
    init(data) {
        // CRITICAL: Reset the shutdown flag when the scene starts
        // This was the bug - the flag remained true after mode switching
        this.isShuttingDown = false;
        
        // Set the mode from data if provided (e.g., from LevelScene)
        if (data && data.mode) {
            this.mode = data.mode;
            // Update mode-specific styles when mode is set
            this.updateModeStyles();
            
            // Force a complete reset of game state when switching modes
            this.resetGameState();
        }
        
        // Don't set a camera background color - let the background images show through
        // this.cameras.main.setBackgroundColor(COLORS_HEX.BACKGROUND); // REMOVED - was covering mobile backgrounds
        
        // If this is a reset from DoneScene or FeedbackScene, reset game state but preserve level and topK
        if (data && data.requiresReset) {
            this.progressPercentage = data.progressPercentage || 50;
            
            // Preserve level and topK if they were passed
            if (data.levelValue) {
                this.levelValue = data.levelValue;
                // No need to update slider position - it will be set when settings popup opens
            }
            
            if (data.topKValue) {
                this.topKValue = data.topKValue;
                // No need to update slider position - it will be set when settings popup opens
            }
            
            // Reset game state to match our simplified approach
            this.aiWordCount = 0;
             // Note: originalWordCount and totalWordCount are now calculated dynamically
            
            // Reset suggestion-related state
            this.userInput = '';
            this.aiSuggestedWords = [];
            this.autocompleteText = null;
            this.suggestionBoxes = [];
            this.suggestionTexts = [];
            
            // Reset cursor state
            this.cursorVisible = true;
            if (this.cursorTimer) {
                this.cursorTimer.remove();
                this.cursorTimer = null;
            }
        } else if (data && data.progressPercentage !== undefined) {
            // Normal scene transition
            this.progressPercentage = data.progressPercentage;
        }
        
        // Reset UI elements for recreation
        this.promptTextBox = null;
        this.promptText = null;
        this.failsCounter = null;
        this.failsText = null;
        
        // Clear any active timeouts
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = null;
        }
        
        // Clean up any existing hidden input element
        if (this._hiddenInput) {
            // Only remove event listeners if they exist
            if (this._hiddenInputHandler) {
                this._hiddenInput.removeEventListener('input', this._hiddenInputHandler);
                this._hiddenInputHandler = null;
            }
            if (this._hiddenInputBlurHandler) {
                this._hiddenInput.removeEventListener('blur', this._hiddenInputBlurHandler);
                this._hiddenInputBlurHandler = null;
            }
            // Remove the element from DOM
            if (document.body.contains(this._hiddenInput)) {
                document.body.removeChild(this._hiddenInput);
            }
            this._hiddenInput = null;
        }
    }
    
    /**
     * Update background based on current level and streak
     */
    updateBackgroundForLevel() {
 
        // Defer cleanup to next frame to avoid rendering conflicts on Android
        this.time.delayedCall(0, () => {
            // Clean up existing background elements first
            if (this.background && this.background.active) {

                
                // IMPORTANT: Clean up the overlay BEFORE destroying the background
                // This prevents overlays from stacking on mobile
                if (this.background.overlay && this.background.overlay.active) {
                    this.background.overlay.destroy();
                    this.background.overlay = null;
                }
                
                // Also clean up any tint overlay if it exists
                if (this.background.tintOverlay && this.background.tintOverlay.active) {
                    this.background.tintOverlay.destroy();
                    this.background.tintOverlay = null;
                }
                
                // Clean up any other streak-related visuals
                this.cleanupStreakVisuals();
                
                // Destroy background only if it's still active
                if (this.background.active) {
                    this.background.destroy();
                    this.background = null;
                }
            }
            
            // Continue with background creation after cleanup
            this._createBackgroundAfterCleanup();
        });
    }
    
    /**
     * Create background after cleanup is complete
     * @private
     */
    _createBackgroundAfterCleanup() {
        
        // DEBUG: Log background config and canvas size
        const bgConfig = THEMES[this.mode]?.background;
        const w = this.sys.game.config.width || this.cameras.main.width;
        const h = this.sys.game.config.height || this.cameras.main.height;

        
        if (!w || !h || w < 10 || h < 10) {
            this.time.delayedCall(50, () => this.updateBackgroundForLevel());
            return;
        }
        
        
        try {

            createBackground(this, bgConfig, this.levelValue, this.wordStreak || 0);
        } catch (error) {
            console.error("[MOBILE BG DEBUG] Error calling createBackground:", error);
            console.error("[MOBILE BG DEBUG] Error stack:", error.stack);
            console.error("[MOBILE BG DEBUG] Error message:", error.message);
        }

    }
    
    /**
     * Handle feedback button click
     */
    onFeedbackClick() {
        // Transition to feedback scene
        this.scene.start('FeedbackScene', {
            levelValue: this.levelValue,
            topKValue: this.topKValue,
            mode: this.mode,
            prompt: this.currentPrompt,
            progressPercentage: this.progressPercentage
        });
    }
}
