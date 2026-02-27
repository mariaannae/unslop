// BaseScene.js - Base scene class with common functionality
// All game scenes should extend from this class to inherit shared behavior

import { AnimationMixin } from '../utils/AnimationHelpers.js';
import { TooltipMixin } from '../components/TooltipMixin.js';
import { ScalingManager } from '../config/scaling.js';
import ButtonFactory from '../utils/ButtonFactory.js';
import { COLORS_HEX, COLORS_TEXT } from '../config/design.js';
import { isMobileDevice } from '../config/dimensions.js';

/**
 * Base Scene class - provides common functionality for all game scenes
 * 
 * Features:
 * - Automatic ScalingManager initialization
 * - Tooltip system setup
 * - Animation helpers (via AnimationMixin)
 * - Common button creation
 * - Color scheme access
 * - Mobile/desktop detection
 * - Standard cleanup on shutdown
 * 
 * Usage:
 * import { BaseScene } from './BaseScene.js';
 * 
 * export default class MyScene extends BaseScene {
 *     constructor() {
 *         super({ key: 'MyScene' });
 *     }
 *     
 *     create() {
 *         super.create(); // IMPORTANT: Call parent create() first
 *         // Your scene code here
 *     }
 * }
 */
export class BaseScene extends Phaser.Scene {
    constructor(config) {
        super(config);
        
        // Initialize tooltip array
        this.tooltips = [];
    }
    
    /**
     * Common scene initialization
     * IMPORTANT: Child scenes should call super.create() first
     */
    create() {
        // Initialize UI scale from registry
        this.uiScale = this.registry.get('uiScale') || 1;
        
        // Initialize scaling manager
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        
        // Initialize tooltip system
        this.initTooltips();
        
        // Set up color schemes for easy access
        this.COLORS_HEX = COLORS_HEX;
        this.COLORS_TEXT = COLORS_TEXT;
        
        // Cache mobile detection
        this._isMobile = isMobileDevice();
        this._isDesktop = !this._isMobile;
        
        // Set up cleanup on shutdown
        this.events.once('shutdown', () => this.onShutdown());
    }
    
    /**
     * Mobile device detection (cached for performance)
     */
    get isMobile() {
        if (this._isMobile === undefined) {
            this._isMobile = isMobileDevice();
        }
        return this._isMobile;
    }
    
    /**
     * Desktop device detection (cached for performance)
     */
    get isDesktop() {
        if (this._isDesktop === undefined) {
            this._isDesktop = !isMobileDevice();
        }
        return this._isDesktop;
    }
    
    /**
     * Create a button with consistent styling and optional tooltip
     * @param {string} label - Button text
     * @param {Function} callback - Click handler
     * @param {number} x - X position (center)
     * @param {number} y - Y position (center)
     * @param {string} [tooltipText] - Optional tooltip text
     * @param {Object} [options] - Additional button options
     * @returns {Phaser.GameObjects.Container} The button container
     */
    createButton(label, callback, x, y, tooltipText = null, options = {}) {
        // Create button using ButtonFactory
        const button = ButtonFactory.createButton(
            this,
            label,
            callback,
            x,
            y,
            { ...options, scalingManager: this.scalingManager }
        );
        
        // Add tooltip if provided
        if (tooltipText) {
            this.addButtonTooltip(button, tooltipText);
        }
        
        return button;
    }
    
    /**
     * Add tooltip to an existing button
     * @param {Phaser.GameObjects.Container} button - The button to add tooltip to
     * @param {string} tooltipText - The tooltip text
     */
    addButtonTooltip(button, tooltipText) {
        const buttonHeight = this.scalingManager.buttonHeight();
        
        if (this.isMobile) {
            // Mobile: show on tap
            button.on('pointerdown', () => {
                this.showTooltip(tooltipText, button.x, button.y - buttonHeight);
            });
            button.on('pointerup', () => {
                this.hideTooltips();
            });
            button.on('pointerout', () => {
                this.hideTooltips();
            });
        } else {
            // Desktop: show on hover
            button.on('pointerover', () => {
                this.showTooltip(tooltipText, button.x, button.y - buttonHeight);
            });
            button.on('pointerout', () => {
                this.hideTooltips();
            });
        }
    }
    
    /**
     * Get standard padding value based on device type
     * @returns {number} Padding in pixels
     */
    getStandardPadding() {
        return this.isMobile ? 10 : 20;
    }
    
    /**
     * Get large padding value based on device type
     * @returns {number} Padding in pixels
     */
    getLargePadding() {
        return this.isMobile ? 20 : 30;
    }
    
    /**
     * Add standard button click effects (scale animation)
     * @param {Phaser.GameObjects.Container} button - The button to add effects to
     * @param {Function} [callback] - Optional callback after animation
     */
    addButtonClickEffect(button, callback = null) {
        if (!button) return;
        
        // Find the interactive element (first child is usually the hit area)
        const hitRect = button.list && button.list[0];
        if (!hitRect || !hitRect.input) return;
        
        hitRect.on('pointerdown', () => {
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: 'Quad.Out',
                onComplete: () => {
                    if (callback) callback();
                }
            });
        });
    }
    
    /**
     * Create a loading indicator
     * @param {string} [text='Loading...'] - Loading text
     * @returns {Phaser.GameObjects.Text} The loading text object
     */
    createLoadingIndicator(text = 'Loading...') {
        const loading = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            text,
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '24px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5).setDepth(1000);
        
        // Add pulsing animation
        this.pulse(loading, 1.1, 1000, -1);
        
        return loading;
    }
    
    /**
     * Show an error message
     * @param {string} message - Error message
     * @param {number} [duration=3000] - How long to show the message
     */
    showErrorMessage(message, duration = 3000) {
        const errorText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            message,
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '20px',
                color: '#ff0000',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 },
                align: 'center',
                wordWrap: { width: this.cameras.main.width - 100 }
            }
        ).setOrigin(0.5).setDepth(1000);
        
        // Fade in
        this.fadeIn(errorText, 200);
        
        // Remove after duration
        this.time.delayedCall(duration, () => {
            this.fadeOut(errorText, 300, 'Quad.Out', () => {
                errorText.destroy();
            });
        });
        
        return errorText;
    }
    
    /**
     * Show a success message
     * @param {string} message - Success message
     * @param {number} [duration=2000] - How long to show the message
     */
    showSuccessMessage(message, duration = 2000) {
        const successText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            message,
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '20px',
                color: '#00ff00',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1000);
        
        this.fadeIn(successText, 200);
        
        this.time.delayedCall(duration, () => {
            this.fadeOut(successText, 300, 'Quad.Out', () => {
                successText.destroy();
            });
        });
        
        return successText;
    }
    
    /**
     * Common cleanup on scene shutdown
     * Override in child classes if needed, but call super.onShutdown()
     */
    onShutdown() {
        // Hide all tooltips
        this.hideTooltips();
        
        // Clean up scaling manager
        if (this.scalingManager) {
            this.scalingManager = null;
        }
        
        // Clean up any active tweens
        if (this.tweens) {
            this.tweens.killAll();
        }
    }
}

// Apply mixins to BaseScene prototype
Object.assign(BaseScene.prototype, AnimationMixin);
Object.assign(BaseScene.prototype, TooltipMixin);

export default BaseScene;
