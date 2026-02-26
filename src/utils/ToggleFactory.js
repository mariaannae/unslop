import { BASIC_COLORS_HEX as COLORS_HEX, BASIC_COLORS_TEXT as COLORS_TEXT, DESIGN} from "../config/design.js";

export default class ToggleFactory {
    /**
     * Creates a styled toggle switch without labels
     * @param {Phaser.Scene} scene - The scene to add the toggle to
     * @param {string} mode - Current mode ('easy' or 'hard')
     * @param {function} callback - The function to call when toggle is flipped
     * @param {number} leftX - X position (left) of the toggle
     * @param {number} centerY - Y position (center) of the toggle
     * @param {Object} options - Optional customization parameters
     * @returns {Phaser.GameObjects.Container} The toggle container with added methods for state update
     */
    static createToggle(scene, mode, callback, leftX, centerY, options = {}) {
        // Store current mode in a variable that can be updated
        let currentMode = mode;

        // Use scalingManager if provided, otherwise fallback to DESIGN
        const scalingManager = options.scalingManager || scene.scalingManager;
        // Minimum touch target size for mobile
        const minTouchSize = 44;

        // Use fixed sizes for toggle (no scaling, no minTouchSize logic)
        const toggleWidth = DESIGN.UI.TOGGLE.WIDTH;
        const toggleHeight = DESIGN.UI.TOGGLE.HEIGHT;

        // Create toggle background with color based on mode
        const bgColor = currentMode === 'hard' ? COLORS_HEX.HIGHLIGHT : 0x333333; // Grey for easy mode
        const toggleBg = scene.add.rectangle(0, 0, toggleWidth, toggleHeight, bgColor)
            .setStrokeStyle(2, COLORS_HEX.HIGHLIGHT);

        // Make toggle knob diameter double the slider track height (20px in design)
        const knobRadius = 10;
        const toggleCircle = scene.add.circle(0, 0, knobRadius, COLORS_HEX.ACCENT)
            .setStrokeStyle(2, 0xffffff, 0.7);

        // Without labels, center is simpler
        const centerX = leftX + toggleWidth / 2;

        // Container for alignment
        const toggleContainer = scene.add.container(centerX, centerY, [toggleBg, toggleCircle]);

        // Add invisible hit area for accessibility (44x44 minimum)
        const hitArea = scene.add.rectangle(0, 0, Math.max(toggleWidth, minTouchSize), Math.max(toggleHeight, minTouchSize), 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        toggleContainer.addAt(hitArea, 0);

        // Position the toggle circle based on mode
        const updateTogglePosition = (mode) => {
            if (mode === 'hard') {
                toggleCircle.x = toggleWidth / 2 - toggleHeight / 2; // HARD mode position
                toggleBg.fillColor = COLORS_HEX.HIGHLIGHT;
            }
            else if (mode === 'easy') {
                toggleCircle.x = -toggleWidth / 2 + toggleHeight / 2; // EASY mode position
                toggleBg.fillColor = 0x333333; // Grey for easy mode
            }
            else {
                console.error('Invalid mode. Defaulting to EASY.');
                toggleCircle.x = -toggleWidth / 2 + toggleHeight / 2; // Default to EASY
                toggleBg.fillColor = 0x333333;
            }
        };

        // Initial position setup
        updateTogglePosition(currentMode);

        // Toggle function that can be called from any click
        const performToggle = () => {
            // Scale animation for touch feedback
            scene.tweens.add({
                targets: toggleBg,
                scaleX: 0.92,
                scaleY: 0.92,
                duration: 80,
                yoyo: true,
                ease: 'Quad.Out'
            });

            const newMode = currentMode === 'hard' ? 'easy' : 'hard';

            // Animate the toggle switch
            scene.tweens.add({
                targets: toggleCircle,
                x: newMode === 'hard'
                    ? toggleWidth / 2 - toggleHeight / 2
                    : -toggleWidth / 2 + toggleHeight / 2,
                duration: 100,
                ease: 'Power2',
                onUpdate: () => {
                    // Update color during animation
                    toggleBg.fillColor = newMode === 'hard'
                        ? COLORS_HEX.HIGHLIGHT
                        : 0x333333;
                },
                onComplete: () => {
                    // Update internal state and trigger callback
                    currentMode = newMode;
                    callback(newMode);
                }
            });
        };

        // Attach toggle function to the hit area for maximum click area
        hitArea.on('pointerdown', performToggle);
        
        // Also attach to toggleBg as backup
        toggleBg.on('pointerdown', performToggle);

        // Add method to update toggle state externally
        toggleContainer.updateState = (newMode) => {
            // Only update if the mode actually changed
            if (newMode !== currentMode) {
                currentMode = newMode;
                updateTogglePosition(currentMode);
            }
        };

        // (No need to set toggleBg.input.hitArea; hitArea handles all interaction)

        return toggleContainer;
    }
}
