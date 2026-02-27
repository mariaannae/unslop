// TooltipMixin.js - Reusable tooltip functionality
// Extracted from BaseGameScene and other scenes to eliminate duplication

import { fadeIn, fadeOut } from '../utils/AnimationHelpers.js';

/**
 * Tooltip Mixin - provides tooltip functionality to scenes
 * Usage: Object.assign(YourScene.prototype, TooltipMixin);
 * 
 * Or import and use the functions directly:
 * import { showTooltip, hideTooltips } from './components/TooltipMixin.js';
 */

/**
 * Show a tooltip at the specified position
 * @param {Phaser.Scene} scene - The scene instance
 * @param {string} text - The tooltip text to display
 * @param {number} x - X position (will be centered on this point)
 * @param {number} y - Y position (tooltip will appear above this point)
 * @returns {Phaser.GameObjects.Container} The tooltip container
 */
export function showTooltip(scene, text, x, y) {
    // Hide any existing tooltips first
    hideTooltips(scene);
    
    // Ensure tooltips array exists
    if (!scene.tooltips) {
        scene.tooltips = [];
    }
    
    const padding = 10;
    
    // Create tooltip text
    const tooltipText = scene.add.text(0, 0, text, {
        fontFamily: 'IBM Plex Mono',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center'
    });
    
    const width = tooltipText.width + padding * 2;
    const height = tooltipText.height + padding * 2;
    
    // Create background
    const background = scene.add.graphics();
    background.fillStyle(0x000000, 0.8);
    background.fillRoundedRect(0, 0, width, height, 8);
    background.lineStyle(1, 0xffffff, 0.3);
    background.strokeRoundedRect(0, 0, width, height, 8);
    
    // Calculate initial position
    let tooltipX = x - width / 2;
    let tooltipY = y - height - 5;
    
    // Clamp X so tooltip stays within screen horizontally
    tooltipX = Math.max(0, Math.min(tooltipX, scene.sys.game.canvas.width - width));
    // Clamp Y so tooltip stays within screen vertically
    tooltipY = Math.max(0, Math.min(tooltipY, scene.cameras.main.height - height));
    
    // Create container for tooltip
    const container = scene.add.container(tooltipX, tooltipY, [background, tooltipText]);
    tooltipText.setPosition(padding, padding);
    
    // Add to active tooltips
    scene.tooltips.push(container);
    
    // Fade in effect
    container.setAlpha(0);
    fadeIn(scene, container, 200, 'Quad.easeOut');
    
    container.setDepth(1000);
    
    return container;
}

/**
 * Hide all active tooltips
 * @param {Phaser.Scene} scene - The scene instance
 */
export function hideTooltips(scene) {
    if (!scene.tooltips) {
        scene.tooltips = [];
        return;
    }
    
    scene.tooltips.forEach(tooltip => {
        fadeOut(scene, tooltip, 200, 'Quad.easeOut', () => {
            if (tooltip && tooltip.active) {
                tooltip.destroy();
            }
        });
    });
    scene.tooltips = [];
}

/**
 * Initialize tooltip system for a scene
 * Call this in your scene's create() method
 * @param {Phaser.Scene} scene - The scene instance
 */
export function initTooltips(scene) {
    if (!scene.tooltips) {
        scene.tooltips = [];
    }
    
    // Clean up tooltips on scene shutdown
    scene.events.once('shutdown', () => {
        hideTooltips(scene);
    });
}

/**
 * Mixin object that can be applied to scene prototypes
 * Usage: Object.assign(YourScene.prototype, TooltipMixin);
 */
export const TooltipMixin = {
    /**
     * Show a tooltip
     * @param {string} text - The tooltip text
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Phaser.GameObjects.Container} The tooltip container
     */
    showTooltip(text, x, y) {
        return showTooltip(this, text, x, y);
    },
    
    /**
     * Hide all tooltips
     */
    hideTooltips() {
        hideTooltips(this);
    },
    
    /**
     * Initialize tooltip system
     */
    initTooltips() {
        initTooltips(this);
    }
};

/**
 * Helper function to add tooltip to an interactive game object
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject} gameObject - The interactive object
 * @param {string} tooltipText - The tooltip text to display
 * @param {number} [offsetY=-50] - Y offset for tooltip position
 */
export function addTooltipToGameObject(scene, gameObject, tooltipText, offsetY = -50) {
    if (!gameObject.input || !gameObject.input.enabled) {
        console.warn('addTooltipToGameObject: GameObject must be interactive');
        return;
    }
    
    const isMobile = scene.isMobile || false;
    
    if (isMobile) {
        // On mobile: show tooltip on tap
        gameObject.on('pointerdown', () => {
            showTooltip(scene, tooltipText, gameObject.x, gameObject.y + offsetY);
        });
        gameObject.on('pointerup', () => {
            hideTooltips(scene);
        });
        gameObject.on('pointerout', () => {
            hideTooltips(scene);
        });
    } else {
        // On desktop: show tooltip on hover
        gameObject.on('pointerover', () => {
            showTooltip(scene, tooltipText, gameObject.x, gameObject.y + offsetY);
        });
        gameObject.on('pointerout', () => {
            hideTooltips(scene);
        });
    }
}

export default TooltipMixin;
