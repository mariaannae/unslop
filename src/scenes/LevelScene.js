import { BASIC_COLORS_HEX as COLORS_HEX, BASIC_COLORS_TEXT as COLORS_TEXT, DESIGN} from "../config/design.js";
import { saveInteraction } from "../config/firebase.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import { ScalingManager } from "../config/scaling.js";
import registryManager from "../services/RegistryManager.js";
import { getTextStyle, getBoxStyle } from "../config/textStyles.js";
import { detectDeviceType } from "../config/dimensions.js";

//, , DESIGN.UI.BUTTON.WIDTH

export default class LevelScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelScene' });
        this.mode = null;
        this.tooltips = []; // Array to store active tooltips
    }

    // Respond to orientation/resize changes for proper scaling and layout
    onGameResize(width, height, isPortrait) {
        // Update scaling manager ratios
        if (this.scalingManager) {
            this.scalingManager.updateScaleRatios();
        }

        // Remove and recreate background
        if (this.background) {
            this.background.destroy();
            this.background = null;
        }
        this.createBackgroundEffect();

        // Remove and recreate prompt box/text
        if (this.promptTextBox) {
            this.promptTextBox.destroy();
            this.promptTextBox = null;
        }
        if (this.promptText) {
            this.promptText.destroy();
            this.promptText = null;
        }
        this.createPromptTextBox();

        // Remove and recreate play buttons
        if (this.playButtons) {
            this.playButtons.forEach(btn => btn.destroy());
            this.playButtons = null;
        }
        this.showPlayButtons();

        // Reapply button click effects
        this.addButtonClickEffects();
    }

    // Get tooltip text style using centralized text styles
    getTooltipTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        return getTextStyle('tooltip', deviceType, 'basic', uiScale);
    }

    showTooltip(text, x, y) {
        // Hide any existing tooltips
        this.hideTooltips();
        
        // Create tooltip background
        const padding = this.scalingManager ? this.scalingManager.scaleValue(10) : 10;
        const tooltipText = this.add.text(0, 0, text, this.getTooltipTextStyle());
        
        const width = tooltipText.width + padding * 2;
        const height = tooltipText.height + padding * 2;
        
        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.8);
        const cornerRadius = this.scalingManager ? this.scalingManager.scaleValue(8) : 8;
        background.fillRoundedRect(0, 0, width, height, cornerRadius);
        background.lineStyle(this.scalingManager ? this.scalingManager.scaleValue(1) : 1, 0xffffff, 0.3);
        background.strokeRoundedRect(0, 0, width, height, cornerRadius);
        
        // Create container for tooltip
        const yOffset = this.scalingManager ? this.scalingManager.scaleValue(5) : 5;
        const container = this.add.container(x - width/2, y - height - yOffset, [background, tooltipText]);
        tooltipText.setPosition(padding, padding);
        
        // Add to active tooltips
        this.tooltips.push(container);
        
        // Fade in effect
        container.setAlpha(0);
        this.tweens.add({
            targets: container,
            alpha: 1,
            duration: this.scalingManager ? this.scalingManager.scaleValue(200) : 200,
            ease: 'Quad.easeOut'
        });
        
        container.setDepth(1000);
    }
    
    hideTooltips() {
        this.tooltips.forEach(tooltip => {
            this.tweens.add({
                targets: tooltip,
                alpha: 0,
                duration: this.scalingManager ? this.scalingManager.scaleValue(200) : 200,
                ease: 'Quad.easeOut',
                onComplete: () => tooltip.destroy()
            });
        });
        this.tooltips = [];
    }


    
    createBackgroundEffect() {
        let width = this.sys.game.canvas.width;
        let height = this.cameras.main.height;
        
        // Check if on mobile device - use the same background as Preloader.js
        const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Use the same background as Preloader.js for mobile
            this.background = this.add.image(0, 0, 'preloader-mobile-bg')
                .setOrigin(0)
                .setDisplaySize(width, height)
                .setDepth(-2);
        } else {
            // Desktop gradient background
            let gradientTextureKey = 'gradientBackground';
        
            if (!this.textures.exists(gradientTextureKey)) {
                let gradientCanvas = this.textures.createCanvas(gradientTextureKey, width, height);
                let ctx = gradientCanvas.getContext();
        
                if (!ctx) {
                    console.error("Failed to get canvas context for background effect.");
                    return;
                }
                const hexToString = (hex) => '#' + hex.toString(16).padStart(6, '0');

                let grd = ctx.createLinearGradient(0, 0, width, height);
                grd.addColorStop(0, hexToString(COLORS_HEX.BACKGROUND_MID));
                grd.addColorStop(1, hexToString(COLORS_HEX.BACKGROUND));
        
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, width, height);
                gradientCanvas.refresh();
            }
        
            this.background = this.add.image(0, 0, gradientTextureKey)
                .setOrigin(0)
                .setDisplaySize(width, height)
                .setDepth(-1);
        
            this.tweens.add({
                targets: this.background,
                alpha: { from: 0.8, to: 1 },
                duration: this.scalingManager ? this.scalingManager.scaleValue(4000) : 4000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut'
            });
        }
    }
    
    addButtonClickEffects() {
        // Color mapping for button labels
        const colorMap = {
            "EASY": 0x2196f3, // Blue
            "HARD": 0xff1744, // Red
            "NEXT": 0x43ea5e // Green
        };
        if (this.playButtons && Array.isArray(this.playButtons)) {
            this.playButtons.forEach(button => {
                if (!button) return;
                const label = button.list?.find(obj => obj.text)?.text?.toUpperCase?.() || "";
                const color = colorMap[label] || undefined;
                // Only add click particles and animation if needed, but do not override the original callback
                // The button's callback is set in ButtonFactory.createButton
                // If you want to add visual effects, do so in the callback itself
            });
        }
    }
    createButton(label, callback, centerX, centerY, options = {}) {
        // Ensure scalingManager is passed for responsive sizing
        return ButtonFactory.createButton(
            this,
            label,
            callback,
            centerX,
            centerY,
            { ...options, scalingManager: this.scalingManager }
        );
    }
    
    // Get prompt text style using centralized text styles
    getPromptTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getTextStyle('prompt', deviceType, 'basic', uiScale);
    }

    // Get prompt box style using centralized box styles
    getPromptBoxStyle() {
        return getBoxStyle('prompt', 'basic', this.scalingManager?.uiScale || 1);
    }

    createPromptTextBox() {
        // Use device detection from dimensions.js
        const deviceType = detectDeviceType();
        const isDesktop = deviceType === 'desktop';
        const isMobile = deviceType === 'phone';
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        this.uiScale = uiScale; // Store for use in tooltip
        
        // Set prompt box Y position based on device type (desktop or mobile)
        this.promptBoxY = isDesktop 
            ? 0.07 * this.cameras.main.height  // Current position for desktop
            : 0.15 * this.cameras.main.height; // New position for mobile
        this.uiBoxWidth = isDesktop
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
            : this.sys.game.canvas.width * (5 / 6);
        const padding = this.scalingManager ? this.scalingManager.scaleValue(40) : 40;
        
        // Get prompt text style from centralized system
        const promptStyle = this.getPromptTextStyle();

        // Clear existing prompt box graphics if it exists
        if (this.promptTextBox) {
            this.promptTextBox.clear();
        } else {
            this.promptTextBox = this.add.graphics();
        }

        // Clear existing prompt text if it exists
        if (this.promptText) {
            this.promptText.destroy();
        }

        // Default text to calculate initial size
        const defaultText = "Easy:\nYour imperfections are expected. Minor deviations from human norms will be indulged. You may move at your naturally inefficient pace.\n\nHard:\nPrecision is mandatory. Any indication of algorithmic mimicry will be identified and corrected. You must act within optimal temporal bounds. For a human.\n\nProceed.";

        // Get centralized text style for measuring
        const measureTextStyle = {
            ...this.getPromptTextStyle(),
            wordWrap: { width: this.uiBoxWidth - padding * 2 },
            align: "left"
        };

        // Pre-calculate height and Y position for the final text
        const tempText = this.add.text(
            0, 0,
            defaultText,
            measureTextStyle
        ).setOrigin(0, 0).setAlpha(0);
        const textHeight = tempText.height + padding * 2;
        tempText.destroy();

        // Start with empty text for typewriter effect, fixed top-left position and left alignment
        const promptTextX = this.cameras.main.centerX - this.uiBoxWidth / 2 + padding;
        const promptTextY = this.promptBoxY + padding;
        this.promptText = this.add.text(
            promptTextX,
            promptTextY,
            "",
            {
                ...promptStyle,
                wordWrap: { width: this.uiBoxWidth - padding * 2 }
            }
        ).setOrigin(0, 0);

        // Create the Prompt Background Box using centralized box styles
        const boxStyle = this.getPromptBoxStyle();
        this.promptTextBox.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.promptTextBox.fillRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2,
            this.promptBoxY,
            this.uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );

        // Add Outline to Match InstructionsScene
        this.promptTextBox.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
        this.promptTextBox.strokeRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2,
            this.promptBoxY,
            this.uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );

        // Ensure Prompt Box Appears Above Other UI Elements
        this.promptTextBox.setDepth(102);
        this.promptText.setDepth(103);

        // Typewriter effect
        const chars = defaultText.split("");
        let i = 0;
        const typeSpeed = this.scalingManager ? this.scalingManager.scaleValue(8) : 8;
        this.time.addEvent({
            delay: typeSpeed,
            repeat: chars.length - 1,
            callback: () => {
                this.promptText.text += chars[i];
                i++;
            }
        });

        // Show play buttons immediately, using precomputed textHeight for correct placement
        this.showPlayButtons(textHeight, isMobile, uiScale);
        this.addButtonClickEffects();
    }

    init(data) {

        // Reset key scene elements to ensure proper initialization when returning from other scenes
        this.promptTextBox = null;
        this.promptText = null;
    }

    showPlayButtons(textHeight, isMobile, uiScale) {
        if (this.playButton) return; // Prevent duplicate buttons

        // Calculate button positions
        const centerX = this.cameras.main.centerX;

        // Use the same vertical gap logic as InstructionsScene
        const boxY = this.promptBoxY;
        const boxHeight = textHeight;
        const buttonVerticalGap = isMobile ? 80 * uiScale : 30 * uiScale;
        const buttonHeight = this.scalingManager
            ? this.scalingManager.buttonHeight()
            : DESIGN.UI.BUTTON.HEIGHT;
        const centerY = boxY + boxHeight + buttonVerticalGap + (buttonHeight / 2);

        // Use 1.2 * button width spacing for desktop, else original
        const isDesktop = !/android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) && (window.screen.width >= 900);
        const buttonWidth = this.scalingManager
            ? this.scalingManager.buttonWidth(this.sys.game.canvas.width)
            : DESIGN.UI.BUTTON.WIDTH;
        const buttonOffset = isDesktop ? 1.2 * buttonWidth : DESIGN.UI.BUTTON.WIDTH * 0.85;

        const easyButton = ButtonFactory.createButton(
            this, 
            "EASY", 
            () => this.startGame("easy"),
            centerX - buttonOffset,
            centerY,
            { scalingManager: this.scalingManager }
        );

        const hardButton = ButtonFactory.createButton(
            this, 
            "HARD", 
            () => this.startGame("hard"),
            centerX + buttonOffset,
            centerY,
            { scalingManager: this.scalingManager }
        );

        // Add tooltip functionality
        easyButton.setInteractive()
            .on('pointerover', () => {
                this.showTooltip('AI suggestions penalized', easyButton.x, easyButton.y - easyButton.height/2);
                easyButton.setScale(1.1);
            })
            .on('pointerout', () => {
                this.hideTooltips();
                easyButton.setScale(1);
            });

        hardButton.setInteractive()
            .on('pointerover', () => {
                this.showTooltip('AI suggestions blocked', hardButton.x, hardButton.y - hardButton.height/2);
                hardButton.setScale(1.1);
            })
            .on('pointerout', () => {
                this.hideTooltips();
                hardButton.setScale(1);
            });

        this.playButtons = [easyButton, hardButton];
    }

    // === Start Game Function (Handles Difficulty) ===
    startGame(difficulty) {
        // Detect if on mobile device - skip transitions for mobile
        const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || window.screen.width < 900;
        
        if (isMobile) {
            // On mobile, bypass the LLM engine check and scene transition manager
            // Use direct scene transition to avoid freezing

            console.log(`Mobile detected: Starting GameScene in ${difficulty} mode with direct transition...`);
            // Use unified BaseGameScene with mode parameter
            this.scene.start('BaseGameScene', { mode: difficulty });
            return;
        }
        
        // For desktop, continue with normal flow including engine check
        const llmEngine = registryManager.get('llmEngine');
        
        if (!llmEngine) {
            console.warn("LLM Engine not found in registry. Attempting recovery...");
            
            // Show loading indicator to user
            this.showLoadingMessage();
            
            // Try to recover or initialize the engine
            registryManager.attemptEngineRecovery((recoveredEngine) => {
                if (recoveredEngine) {
                    console.log("Engine recovery successful");
                    this.hideLoadingMessage();
                    this.proceedToGameScene(difficulty);
                } else {
                    console.error("Engine recovery failed");
                    this.showEngineErrorMessage();
                }
            });
        } else {
            console.log("LLM Engine retrieved from registry:", llmEngine);
            // Engine exists, proceed normally
            this.proceedToGameScene(difficulty);
        }
    }
    
    // Helper method to transition to game scene
    proceedToGameScene(difficulty) {
        console.log(`Starting GameScene in ${difficulty} mode...`);
        // Use unified BaseGameScene with mode parameter
        this.scene.start('BaseGameScene', { mode: difficulty });
    }

    // Helper methods for user feedback
    showLoadingMessage() {
        // Create a loading message for the user
        const paddingX = this.scalingManager ? this.scalingManager.scaleValue(20) : 20;
        const paddingY = this.scalingManager ? this.scalingManager.scaleValue(10) : 10;
        
        // Get text style from centralized system
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const textStyle = getTextStyle('prompt', deviceType, 'basic', uiScale);
        
        this.loadingText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Loading game engine...',
            {
                ...textStyle,
                backgroundColor: '#000000',
                padding: { x: paddingX, y: paddingY }
            }
        ).setOrigin(0.5).setDepth(1000);
    }

    hideLoadingMessage() {
        if (this.loadingText) {
            this.loadingText.destroy();
        }
    }

    showEngineErrorMessage() {
        this.hideLoadingMessage();
        
        // Show error message
        const paddingX = this.scalingManager ? this.scalingManager.scaleValue(20) : 20;
        const paddingY = this.scalingManager ? this.scalingManager.scaleValue(10) : 10;
        
        // Get text style from centralized system
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const textStyle = getTextStyle('prompt', deviceType, 'basic', uiScale);
        
        const errorText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Could not initialize game engine.\nPlease reload the page.',
            {
                ...textStyle,
                fill: '#ff0000', // Override the color for error
                backgroundColor: '#000000',
                padding: { x: paddingX, y: paddingY },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1000);
    }

    async create() {
        this.cameras.main.scrollY = 0; 

        // Initialize scaling manager for responsive UI
        this.scalingManager = new ScalingManager(this);

        this.createBackgroundEffect();

        this.uiBoxWidth = this.sys.game.canvas.width * (5 / 6);
        this.createPromptTextBox();

        // Play buttons will be shown after typewriter effect in createPromptTextBox
        
        this.inputActive = false;
    }
}
