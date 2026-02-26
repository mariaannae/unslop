import { BASIC_COLORS_HEX as COLORS_HEX, BASIC_COLORS_TEXT as COLORS_TEXT, DESIGN } from "../config/design.js";
import { getTextStyle } from "../config/textStyles.js";


export default class ButtonFactory {
    /**
     * Creates a styled button with consistent appearance
     * @param {Phaser.Scene} scene - The scene to add the button to
     * @param {string} label - The text label for the button
     * @param {function} callback - The function to call when button is clicked
     * @param {number} centerX - X position (center) of the button
     * @param {number} centerY - Y position (center) of the button
     * @param {Object} options - Optional customization parameters
     * @returns {Phaser.GameObjects.Container} The button container
     */
    static createButton(scene, label, callback, centerX, centerY, options = {}) {
        // Accept optional scalingManager for responsive sizing
        const scalingManager = options.scalingManager || null;
        const cameraWidth = scene.cameras.main.width;

        // Use scalingManager if available, otherwise fallback to DESIGN
        // Always use scalingManager for both width and height if available
        let buttonWidth, buttonHeight;
        if (scalingManager) {
            buttonWidth = scalingManager.buttonWidth(cameraWidth);
            buttonHeight = scalingManager.buttonHeight(scalingManager.buttonWidth(cameraWidth));
        } else {
            buttonWidth = DESIGN.UI.BUTTON.WIDTH;
            buttonHeight = DESIGN.UI.BUTTON.HEIGHT;
        }
        // Reduce button height for desktop only (by 25% instead of 15%)
        const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        if (!isMobile) {
            buttonHeight = Math.round(buttonHeight * 0.75);
        }
        // Enforce minimum touch target size for accessibility
        const minTouchSize = isMobile ? 44 : 30; // Reduced min size by 10px for desktop
        buttonWidth = Math.max(buttonWidth, minTouchSize);
        buttonHeight = Math.max(buttonHeight, minTouchSize);
        const buttonCornerRadius = DESIGN.UI.BUTTON.CORNER_RADIUS;

        // Create button container
        const buttonContainer = scene.add.container(centerX, centerY);

        // Add an invisible rectangle as the hit area
        const hitRect = scene.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x000000, 0);
        hitRect.setOrigin(0.5, 0.5);
        hitRect.setInteractive();

        // Button Background
        const buttonBackground = scene.add.graphics();
        buttonBackground.fillStyle(COLORS_HEX.BUTTON.FILL, 1);
        buttonBackground.fillRoundedRect(
            -buttonWidth / 2, -buttonHeight / 2,
            buttonWidth, buttonHeight, buttonCornerRadius
        );
        buttonBackground.disableInteractive?.();

        // Button Outline
        const buttonOutline = scene.add.graphics();
        buttonOutline.lineStyle(DESIGN.UI.BUTTON.OUTLINE_WIDTH, 0xffffff, 1);
        buttonOutline.strokeRoundedRect(
            -buttonWidth / 2, -buttonHeight / 2,
            buttonWidth, buttonHeight, buttonCornerRadius
        );
        buttonOutline.disableInteractive?.();

        // Gradient Overlay (Lighter Top)
        const gradientOverlay = scene.add.graphics();
        gradientOverlay.fillStyle(COLORS_HEX.BUTTON.OVERLAY, 0.7);
        gradientOverlay.fillRoundedRect(
            -buttonWidth / 2, -buttonHeight / 2,
            buttonWidth, buttonHeight / 2, buttonCornerRadius
        );
        gradientOverlay.disableInteractive?.();

        // Highlight Effect (Shiny Reflection)
        const buttonHighlight = scene.add.graphics();
        buttonHighlight.fillStyle(0xffffff, 0.4);
        buttonHighlight.fillRoundedRect(
            -buttonWidth / 2 + 5, -buttonHeight / 2 + 2,
            buttonWidth - 10, buttonHeight / 3, buttonCornerRadius
        );
        buttonHighlight.disableInteractive?.();

        // Button Text
        const deviceType = isMobile ? 'phone' : 'desktop';
        const buttonTextStyle = getTextStyle('button', deviceType, 'basic', 1);
        
        // Override font size if scalingManager is available
        if (scalingManager) {
            buttonTextStyle.fontSize = `${scalingManager.scaleText(parseInt(buttonTextStyle.fontSize))}px`;
        }
        
        const buttonText = scene.add.text(0, 0, label, buttonTextStyle).setOrigin(0.5, 0.5);
        buttonText.disableInteractive?.();

        // Make button interactive
        buttonContainer.setSize(buttonWidth, buttonHeight);
        // Set the container itself as interactive with a rectangle hit area
        buttonContainer.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

        // Forward pointerover/pointerout from hitRect to container for tooltips
        hitRect.on("pointerover", (pointer, localX, localY, event) => {
            buttonContainer.emit("pointerover", pointer, localX, localY, event);
        });
        hitRect.on("pointerout", (pointer, event) => {
            buttonContainer.emit("pointerout", pointer, event);
        });

        // Attach pointer events to the invisible hitRect
        hitRect.on("pointerdown", (pointer) => {
            console.log("ButtonFactory: pointerdown", {label, pointer, isTouch: pointer.pointerType === "touch"});
            scene.tweens.add({
                targets: buttonContainer,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: "Quad.Out"
            });
        });

        hitRect.on("pointerup", (pointer) => {
            console.log("ButtonFactory: pointerup", {label, pointer, isTouch: pointer.pointerType === "touch"});
            if (typeof callback === "function") {
                callback();
            }
        });

        // Add to scene (hitRect must be first for proper layering)
        buttonContainer.add([hitRect, buttonOutline, buttonBackground, gradientOverlay, buttonHighlight, buttonText]);
        scene.add.existing(buttonContainer);

        // Set any optional depth
        if (options.depth !== undefined) {
            buttonContainer.setDepth(options.depth);
        }

        return buttonContainer;
    }

    /**
     * Creates a fancy button with advanced styling and animations
     * @param {Phaser.Scene} scene - The scene to add the button to
     * @param {string} label - The text label for the button
     * @param {function} callback - The function to call when button is clicked
     * @param {number} centerX - X position (center point)
     * @param {number} offsetX - X offset from center point
     * @param {number} centerY - Y position (center point)
     * @param {Object} options - Optional customization parameters
     * @returns {Phaser.GameObjects.Container} The button container
     */
    static createFancyButton(scene, label, callback, centerX, offsetX, centerY, options = {}) {
        // Accept optional scalingManager for responsive sizing
        const scalingManager = options.scalingManager || null;
        const cameraWidth = scene.cameras.main.width;

        // Use scalingManager if available, otherwise fallback to DESIGN
        // Always use scalingManager for both width and height if available
        let buttonSize, buttonHeight;
        if (scalingManager) {
            buttonSize = scalingManager.buttonWidth(cameraWidth);
            buttonHeight = scalingManager.buttonHeight(scalingManager.buttonWidth(cameraWidth));
        } else {
            buttonSize = DESIGN.UI.BUTTON.WIDTH;
            buttonHeight = DESIGN.UI.BUTTON.HEIGHT;
        }
        // Reduce button height for desktop only (by 25% instead of 15%)
        const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        if (!isMobile) {
            buttonHeight = Math.round(buttonHeight * 0.75);
        }
        // Enforce minimum touch target size for accessibility
        const minTouchSize = isMobile ? 44 : 34; // Reduced min size by 10px for desktop
        buttonSize = Math.max(buttonSize, minTouchSize);
        buttonHeight = Math.max(buttonHeight, minTouchSize);
        const buttonCornerRadius = DESIGN.UI.BUTTON.CORNER_RADIUS;

        // Dynamic adjustments
        const outlineThickness = Phaser.Math.Clamp(buttonSize * 0.02, 1, 6);
        // Get uiScale from options or default to 1
        const uiScale = options.uiScale || 1;

        // Position calculation
        const x = centerX + offsetX;
        const y = centerY;

        // Add an invisible rectangle as the hit area
        const hitRect = scene.add.rectangle(0, 0, buttonSize, buttonHeight, 0x000000, 0);
        hitRect.setOrigin(0.5, 0.5);
        hitRect.setInteractive();

        // White Outline (Bolder)
        const buttonOutline = scene.add.graphics();
        buttonOutline.lineStyle(outlineThickness, 0xffffff, 1);
        buttonOutline.strokeRoundedRect(
            -buttonSize / 2 - outlineThickness / 2,
            -buttonHeight / 2 - outlineThickness / 2,
            buttonSize + outlineThickness,
            buttonHeight + outlineThickness,
            buttonCornerRadius + 2
        );
        buttonOutline.disableInteractive?.();

        // Button Background (Base Color - Darker)
        const buttonBackground = scene.add.graphics();
        buttonBackground.fillStyle(COLORS_HEX.BUTTON.FILL, 1);
        buttonBackground.fillRoundedRect(
            -buttonSize / 2, -buttonHeight / 2,
            buttonSize, buttonHeight, buttonCornerRadius
        );
        buttonBackground.disableInteractive?.();

        // Simulated Gradient Overlay (Lighter Top)
        const gradientOverlay = scene.add.graphics();
        gradientOverlay.fillStyle(COLORS_HEX.BUTTON.OVERLAY, 0.6);
        gradientOverlay.fillRoundedRect(
            -buttonSize / 2, -buttonHeight / 2,
            buttonSize, buttonHeight / 2, buttonCornerRadius
        );
        gradientOverlay.disableInteractive?.();

        // Highlight Effect
        const buttonHighlight = scene.add.graphics();
        buttonHighlight.fillStyle(0xffffff, 0.3);
        buttonHighlight.fillRoundedRect(
            -buttonSize / 2 + 5,
            -buttonHeight / 2 + 2,
            buttonSize - 10,
            buttonHeight / 3,
            buttonCornerRadius
        );
        buttonHighlight.disableInteractive?.();

        // Button Text
        const deviceType = isMobile ? 'phone' : 'desktop';
        const buttonTextStyle = getTextStyle('fancyButton', deviceType, 'basic', uiScale);
        const buttonText = scene.add.text(0, 0, `${label}`, buttonTextStyle).setOrigin(0.5, 0.5);
        buttonText.disableInteractive?.();

        // Group Button Elements
        const buttonContainer = scene.add.container(x, y, [hitRect, buttonOutline, buttonBackground, gradientOverlay, buttonHighlight, buttonText]);

        // Set size BEFORE adding children
        buttonContainer.setSize(buttonSize, buttonHeight);

        // Start invisible for fade-in if specified
        if (options.fadeIn) {
            buttonContainer.setAlpha(0);
            scene.tweens.add({
                targets: buttonContainer,
                alpha: 1,
                duration: 500,
                ease: 'Sine.InOut'
            });
        }

        // Forward pointerover/pointerout from hitRect to container for tooltips
        hitRect.on("pointerover", (pointer, localX, localY, event) => {
            buttonContainer.emit("pointerover", pointer, localX, localY, event);
        });
        hitRect.on("pointerout", (pointer, event) => {
            buttonContainer.emit("pointerout", pointer, event);
        });

        // Hover Effect (Subtle Scale Up)
        hitRect.on('pointerover', () => {
            scene.tweens.add({
                targets: buttonContainer,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 150,
                ease: 'Quad.Out'
            });
        });

        hitRect.on('pointerout', () => {
            scene.tweens.add({
                targets: buttonContainer,
                scaleX: 1,
                scaleY: 1,
                duration: 150,
                ease: 'Quad.Out'
            });
        });

        // Click Animation
        hitRect.on('pointerdown', () => {
            buttonContainer.y += 3;
            buttonText.y += 2;
            buttonContainer.x += 3;
            buttonText.x += 2;
        });

        hitRect.on('pointerup', () => {
            buttonContainer.y -= 3;
            buttonText.y -= 2;
            buttonContainer.x -= 3;
            buttonText.x -= 2;
            callback();
        });

        return buttonContainer;
    }

    /**
     * Creates and adds particles to a button click
     * @param {Phaser.Scene} scene - The scene to add particles to
     * @param {number} x - X coordinate of button center
     * @param {number} y - Y coordinate of button center
     * @param {number|number[]} [colorOrColors] - Optional color or array of colors for particles
     */
    static createClickParticles(scene, x, y, colorOrColors) {
        const particleCount = 12;
        let colors;
        if (Array.isArray(colorOrColors)) {
            colors = colorOrColors;
        } else if (typeof colorOrColors === "number") {
            colors = [colorOrColors];
        } else {
            colors = [0x90caf9, 0xffd700, 0xffb6c1]; // Default: Blue, gold, pink
        }

        for (let i = 0; i < particleCount; i++) {
            // Create a particle
            const particle = scene.add.circle(x, y, 3, 0xffffff, 0.8);

            // Random angle for particle direction
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 30;

            // Pick color
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.setFillStyle(color, 0.8);

            // Set particle depth above buttons
            particle.setDepth(20);

            // Animate the particle
            scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                scale: { from: 1, to: 0.1 },
                duration: 600 + Math.random() * 400,
                ease: 'Quad.Out',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }
}
