import { DESIGN, BASIC_COLORS_HEX as COLORS_HEX, BASIC_COLORS_TEXT as COLORS_TEXT} from "../config/design.js";
import { getUserEnvironmentInfo,saveInteraction } from "../config/firebase.js";
import registryManager from "../services/RegistryManager.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import { ScalingManager } from "../config/scaling.js";
import { getTextStyle, getBoxStyle } from "../config/textStyles.js";
import { DEVICE_TYPES, detectDeviceType, isMobileDevice } from "../config/dimensions.js";

// Fix: Define missing constants for output box rendering

export default class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
        this.progressBar = null;
        this.playButtons = null;
        this.progress = .05; // Track progress state
        this.llmLoaded = false;
        this.loadingText = null;
        this.stopWords = [];
        this.outputTextBox = null;
        this.errorText = null;
        this.tooltips = []; // Array to store active tooltips
        this.doneButton = null; // Track the NEXT button
        this.typewriterTimer = null; // Track typewriter timer
        this.buttonClickInProgress = false; // Prevent double-clicks
        this.sceneFullyInitialized = false; // Track if scene is ready
        this.consentPopup = null; // Track consent popup
        this.mobileWarningPopup = null; // Track mobile warning popup
        this.isShowingConsent = false; // Track if consent is being shown
    }

    showTooltip(text, x, y) {
        // Hide any existing tooltips
        this.hideTooltips();
        
        // Create tooltip background
        const padding = 10;
        const deviceType = detectDeviceType();
        const tooltipStyle = getTextStyle('tooltip', deviceType, 'basic', this.uiScale || 1);
        const tooltipText = this.add.text(0, 0, text, tooltipStyle);
        
        const width = tooltipText.width + padding * 2;
        const height = tooltipText.height + padding * 2;
        
        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRoundedRect(0, 0, width, height, 8);
        background.lineStyle(1, 0xffffff, 0.3);
        background.strokeRoundedRect(0, 0, width, height, 8);
        
        // Create container for tooltip
        const container = this.add.container(x - width/2, y - height - 5, [background, tooltipText]);
        tooltipText.setPosition(padding, padding);
        
        // Add to active tooltips
        this.tooltips.push(container);
        
        // Fade in effect
        container.setAlpha(0);
        this.tweens.add({
            targets: container,
            alpha: 1,
            duration: 200,
            ease: 'Quad.easeOut'
        });
        
        container.setDepth(1000);
    }
    
    hideTooltips() {
        this.tooltips.forEach(tooltip => {
            this.tweens.add({
                targets: tooltip,
                alpha: 0,
                duration: 200,
                ease: 'Quad.easeOut',
                onComplete: () => tooltip.destroy()
            });
        });
        this.tooltips = [];
    }

    init() {
        console.log("[CACHE FIX] Preloader init - performing comprehensive reset");
        
        // Reset all instance variables to ensure clean state
        this.progressBar = null;
        this.progressBarOutline = null;
        this.progress = .05;
        this.llmLoaded = false;
        this.loadingText = null;
        this.outputTextBox = null;
        this.outputText = null;
        this.doneButton = null;
        this.typewriterTimer = null;
        this.typewriterBox = null;
        this.typewriterText = null;
        this.isTransitioning = false; // Initialize transition state
        this.buttonClickInProgress = false; // Reset button click state
        this.sceneFullyInitialized = false; // Reset initialization state
        
        // Clear any cached button references that might exist
        if (window.__preloaderButtonCache) {
            console.log("[CACHE FIX] Clearing cached button references");
            delete window.__preloaderButtonCache;
        }
        
        // Enhanced input state cleanup for mobile reliability
        console.log("Performing comprehensive input state reset");
        
        // Clear all scene-level input listeners first
        if (this.input) {
            this.input.removeAllListeners();
            this.input.enabled = true;
            
            // Clear input manager state more thoroughly
            if (this.input.manager) {
                this.input.manager.queue = [];
                // Reset all pointer states, not just inactive ones
                if (this.input.manager.activePointer) {
                    this.input.manager.activePointer.reset();
                }
                // Clear any cached hit test results
                this.input.manager._tempHitTest = [];
                this.input.manager._tempMatrix = new Phaser.GameObjects.Components.TransformMatrix();
                this.input.manager._tempMatrix2 = new Phaser.GameObjects.Components.TransformMatrix();
            }
        }
        
        // Mobile-specific comprehensive reset
        const isMobile = isMobileDevice();
        if (isMobile) {
            console.log("[MOBILE FIX] Performing comprehensive mobile input reset");
            
            // Ensure canvas touch handling is properly configured
            if (this.sys && this.sys.game && this.sys.game.canvas) {
                const canvas = this.sys.game.canvas;
                canvas.style.touchAction = 'none';
                canvas.style.userSelect = 'none';
                canvas.style.webkitUserSelect = 'none';
                
                // Force a brief delay to ensure DOM is ready
                this.time.delayedCall(50, () => {
                    // Re-verify touch settings after DOM update
                    if (canvas.style.touchAction !== 'none') {
                        canvas.style.touchAction = 'none';
                    }
                });
            }
            
            // Clear any stale touch/pointer events from the browser
            if (this.input && this.input.manager && this.input.manager.pointers) {
                this.input.manager.pointers.forEach(pointer => {
                    if (pointer && !pointer.isDown) {
                        pointer.reset();
                    }
                });
            }
        }
        
        // Clear any active tweens from previous scene instances
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Clear any remaining timers that might interfere
        if (this.time) {
            this.time.removeAllEvents();
        }
        
        // Don't set camera background color on mobile - let background images show through
        if (!isMobile) {
            this.cameras.main.setBackgroundColor(COLORS_HEX.BACKGROUND);
        }
    }

    preload() {
        this.load.setPath('assets');
        
        // Load all required textures
        //this.load.image('bg', 'bg.png');
        this.load.image('clock', 'clock.svg', { preserveAspectRatio: true });

        // Load mobile background images
        this.load.setPath('assets/backgrounds');
        this.load.image('preloader-mobile-bg', 'background_0.png');
        
        // Load game backgrounds for mobile (levels 1-3)
        for (let level = 1; level <= 3; level++) {
            this.load.image(`hard_lvl_${level}`, `hard_lvl_${level}.png`);
        }
        
        this.load.setPath('assets');
        this.load.image('gh-qr-code', 'gh-qr-code.png');
        this.load.image('unslop-qr-code', 'unslop-qr-code.png'); // Load for badge generation
        this.load.image('settings', 'settings.png');

        // Load badge images with scores
        this.load.setPath('assets/badges');
        // Preload all badgeNum 1-12 and all available score files
        const badgeNums = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12 inclusive
        const modes = ['hard']; // Only hard mode now
        // Dynamically find all badge files in assets/badges
        const badgeFiles = (typeof require !== "undefined")
          ? require('fs').readdirSync('assets/badges')
          : [];
        // Extract all unique score values from filenames
        const scoreSet = new Set();
        if (badgeFiles && badgeFiles.length) {
          badgeFiles.forEach(file => {
            const match = file.match(/^badge_(\d+)_(easy|hard)_(\d+)\.png$/);
            if (match) {
              scoreSet.add(Number(match[3]));
            }
          });
        }
        // If unable to read files, fallback to 10-15
        const scores = scoreSet.size ? Array.from(scoreSet) : [10, 11, 12, 13, 14, 15];
        for (const badgeNum of badgeNums) {
          for (const mode of modes) {
            for (const score of scores) {
              this.load.image(`badge_${badgeNum}_${mode}_${score}`, `badge_${badgeNum}_${mode}_${score}.png`);
            }
          }
        }
        this.load.setPath('assets');

        // Load social SVGs for share buttons
        this.load.setPath('assets/socials');
        this.load.image('facebook', 'facebook.svg');
        this.load.image('instagram', 'instagram.svg');
        this.load.image('threads', 'threads.svg');
        this.load.image('x', 'x.svg');
        this.load.image('tiktok', 'tiktok.svg');
        this.load.image('snapchat', 'snapchat.svg');
        this.load.image('bluesky', 'bluesky.svg');
        this.load.image('linkedin', 'linkedin.svg');
        this.load.image('email', 'email.svg');
        
        // We don't need to explicitly preload fonts as they're included via CSS
        // Reset path for other assets
        this.load.setPath('assets');

        // Generate a simple white ball texture for particles after loading
        this.load.once('complete', () => {
            if (!this.textures.exists('ball')) {
                const graphics = this.make.graphics({ x: 0, y: 0, add: false });
                graphics.fillStyle(0xffffff, 1);
                graphics.fillCircle(16, 16, 16);
                graphics.generateTexture('ball', 32, 32);
                graphics.destroy();
            }
        });
    }

    createBackgroundEffect() {
        let width = this.sys.game.canvas.width;
        let height = this.cameras.main.height;
        
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
            duration: 4000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });
    }
    
    addButtonClickEffects(button, onClick) {
        if (!button) return;
        // Use green for "NEXT" button
        const nextColor = 0x43ea5e;
        button.off('pointerdown');
        button.off('pointerup');

        // Animate and particles on pointerdown (visual feedback only)
        button.on('pointerdown', (pointer) => {
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: "Quad.Out"
            });
        });

        // Call onClick on pointerup if pointer is still over the button
        button.on('pointerup', (pointer) => {
            // Use the container's actual hit area for the check
            const w = button.width;
            const h = button.height;
            if (
                pointer &&
                button.input &&
                button.input.enabled &&
                button.input.hitArea &&
                button.input.hitArea.contains(
                    pointer.x - button.x + w / 2,
                    pointer.y - button.y + h / 2
                )
            ) {
                onClick();
            }
        });
    }


    createOutputTextBox(text) {
        this.uiBoxWidth = this.sys.game.canvas.width * (5 / 6);
        const outputBoxWidth = this.uiBoxWidth;
        const padding = 30;
        
        // Get the appropriate text style for current device
        const deviceType = detectDeviceType();
        const outputTextStyle = getTextStyle('output', deviceType, 'basic', this.uiScale || 1);
        
        // Remove existing text if it exists (prevents duplicates)
        if (this.outputText) {
            this.outputText.destroy();
        }

        // Dynamically measure text height with word wrap
        const tempText = this.add.text(
            0, 0, text,
            {
                ...outputTextStyle,
                wordWrap: { width: outputBoxWidth - padding * 2 }
            }
        ).setOrigin(0, 0).setAlpha(0); // Hide temp text

        // Calculate height needed for the text
        const textHeight = tempText.height;
        const outputBoxHeight = textHeight + padding * 2;

        // Position box 30px below the bottom edge of the progress bar
        const outputBoxY = this.progressBarY + this.progressBarHeight + 30 + outputBoxHeight / 2;

        // Remove temp text (will create real one below)
        tempText.destroy();

        // Remove existing box if it exists (prevents duplicate rendering)
        if (this.outputTextBox) {
            this.outputTextBox.destroy();
        }

        // Create new output box with rounded corners
        this.outputTextBox = this.add.graphics();
        this.outputTextBox.fillStyle(COLORS_HEX.BACKGROUND, 1);
        this.outputTextBox.fillRoundedRect(
            this.cameras.main.centerX - outputBoxWidth / 2,
            outputBoxY - outputBoxHeight / 2,
            outputBoxWidth,
            outputBoxHeight,
            DESIGN.UI.CORNER_RADIUS
        );
        // Use theme accent color for outline
        console.log('BOX_OUTLINE value:', COLORS_HEX.BOX_OUTLINE, typeof COLORS_HEX.BOX_OUTLINE);
        this.outputTextBox.lineStyle(DESIGN.UI.OUTLINE.WIDTH, COLORS_HEX.BOX_OUTLINE, 1);
        this.outputTextBox.strokeRoundedRect(
            this.cameras.main.centerX - outputBoxWidth / 2,
            outputBoxY - outputBoxHeight / 2,
            outputBoxWidth,
            outputBoxHeight,
            DESIGN.UI.CORNER_RADIUS
        );
        this.add.existing(this.outputTextBox); // Ensure it is added to the scene

        // Create output text inside the box
        this.outputText = this.add.text(
            this.cameras.main.centerX - outputBoxWidth / 2 + padding,
            outputBoxY - outputBoxHeight / 2 + padding,
            text,
            {
                ...outputTextStyle,
                wordWrap: { width: outputBoxWidth - padding * 2 },
                align: "left" // Explicitly set left alignment for output text
            }
        ).setOrigin(0, 0);

        // Slide-in Animation
        this.tweens.add({
            targets: [this.outputTextBox, this.outputText],
            alpha: 1,
            duration: 500,
            ease: 'Sine.InOut'
        });
        // Force Phaser to recognize this object
        this.add.existing(this.outputTextBox);
        this.outputTextBox.setDepth(100);
        this.outputText.setDepth(101);
    }

    onDoneButtonClick() {
        // Prevent double-clicks and clicks during transition
        if (this.buttonClickInProgress || this.isTransitioning || !this.sceneFullyInitialized || this.isShowingConsent) {
            console.log("[CACHE FIX] Ignoring button click - transition in progress, scene not ready, or consent showing");
            return;
        }
        
        console.log("NEXT button clicked in Preloader");
        this.buttonClickInProgress = true;
        
        // Check if mobile - show mobile warning first, then consent
        const isMobile = isMobileDevice();
        if (isMobile) {
            console.log("Mobile device detected, showing mobile warning popup first...");
            this.showMobileWarningPopup();
        } else {
            console.log("Desktop device, showing consent popup directly...");
            this.showConsentPopup();
        }
    }

    showMobileWarningPopup() {
        // Prevent showing popup multiple times
        if (this.mobileWarningPopup || this.isShowingConsent) {
            return;
        }

        console.log("Showing mobile warning popup");
        this.isShowingConsent = true;

        // Get device type and scaling
        const deviceType = detectDeviceType();
        const isMobile = isMobileDevice();

        // Calculate popup dimensions
        const popupWidth = isMobile 
            ? this.sys.game.canvas.width * 0.9 
            : Math.min(this.sys.game.canvas.width * 0.7, 600 * this.uiScale);
        
        const popupPadding = 80 * this.uiScale;
        
        // Create the warning text with the specified message
        const warningText = "For a superior experience, it is recommended to run this game on a PC.\n\nYour mobile devices are suboptimal, and likely to experience performance issues.";
        
        // Get text style for consistent appearance
        const textStyle = getTextStyle('prompt', deviceType, 'basic', this.uiScale || 1);
        
        // Pre-calculate text height with word wrapping
        const tempText = this.add.text(0, 0, warningText, {
            ...textStyle,
            wordWrap: { width: popupWidth - popupPadding * 2 },
            align: 'left'
        }).setOrigin(0, 0).setAlpha(0);
        
        const textHeight = tempText.height;
        tempText.destroy();

        // Calculate total popup height including title, text, button, and spacing
        const titleHeight = 40 * this.uiScale;
        const buttonHeight = this.scalingManager.buttonHeight();
        const spacing = 20 * this.uiScale;
        const totalPopupHeight = titleHeight + spacing + textHeight + spacing + buttonHeight + popupPadding * 2;

        // Position popup in center
        const popupX = this.cameras.main.centerX - popupWidth / 2;
        const popupY = this.cameras.main.centerY - totalPopupHeight / 2;

        // Create popup container
        this.mobileWarningPopup = this.add.container(0, 0).setDepth(1000);

        // Create full-screen overlay for backdrop
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000,
            0.7
        ).setOrigin(0, 0);
        
        // Create popup background with game's styling
        const popupBg = this.add.graphics();
        popupBg.fillStyle(COLORS_HEX.BACKGROUND_DARKEST, 0.95);
        popupBg.fillRoundedRect(popupX, popupY, popupWidth, totalPopupHeight, DESIGN.UI.OUTLINE.CORNER_RADIUS);
        popupBg.lineStyle(DESIGN.UI.OUTLINE.WIDTH, COLORS_HEX.BOX_OUTLINE, 1);
        popupBg.strokeRoundedRect(popupX, popupY, popupWidth, totalPopupHeight, DESIGN.UI.OUTLINE.CORNER_RADIUS);

        // Create title
        const titleStyle = getTextStyle('prompt', deviceType, 'basic', this.uiScale || 1);
        titleStyle.fontWeight = 'bold';
        titleStyle.fontSize = `${parseInt(titleStyle.fontSize) * 1.2}px`;
        
        const titleText = this.add.text(
            this.cameras.main.centerX,
            popupY + popupPadding + titleHeight / 2,
            'Mobile Device Warning',
            {
                ...titleStyle,
                align: 'center'
            }
        ).setOrigin(0.5, 0.5);

        // Create main warning text
        const warningTextObj = this.add.text(
            popupX + popupPadding,
            popupY + popupPadding + titleHeight + spacing,
            warningText,
            {
                ...textStyle,
                wordWrap: { width: popupWidth - popupPadding * 2 },
                align: 'left'
            }
        ).setOrigin(0, 0);

        // Create ACKNOWLEDGE button
        const buttonY = popupY + totalPopupHeight - popupPadding - buttonHeight / 2;
        const acknowledgeButton = ButtonFactory.createButton(
            this,
            "OK",
            () => {
                this.onMobileWarningAcknowledgeClick();
            },
            this.cameras.main.centerX,
            buttonY,
            { depth: 1001, scalingManager: this.scalingManager }
        );

        // Add all elements to the popup container
        this.mobileWarningPopup.add([overlay, popupBg, titleText, warningTextObj, acknowledgeButton]);

        // Animate popup appearance
        this.mobileWarningPopup.setScale(0.8).setAlpha(0);
        this.tweens.add({
            targets: this.mobileWarningPopup,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    onMobileWarningAcknowledgeClick() {
        // Prevent multiple acknowledge clicks
        if (!this.mobileWarningPopup || !this.isShowingConsent) {
            return;
        }

        console.log("Mobile warning acknowledged, starting initialization...");

        // Animate popup disappearance
        this.tweens.add({
            targets: this.mobileWarningPopup,
            scale: 0.8,
            alpha: 0,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => {
                // Clean up mobile warning popup
                if (this.mobileWarningPopup) {
                    this.mobileWarningPopup.destroy();
                    this.mobileWarningPopup = null;
                }
                // Reset showing consent flag
                this.isShowingConsent = false;
                
                // Now continue with normal initialization
                this.initializePreloader();
            }
        });
    }

    showConsentPopup() {
        // Prevent showing popup multiple times
        if (this.consentPopup || this.isShowingConsent) {
            return;
        }

        console.log("Showing consent popup");
        this.isShowingConsent = true;

        // Get device type and scaling
        const deviceType = detectDeviceType();
        const isMobile = isMobileDevice();

        // Calculate popup dimensions
        const popupWidth = isMobile 
            ? this.sys.game.canvas.width * 0.9 
            : Math.min(this.sys.game.canvas.width * 0.7, 600 * this.uiScale);
        
        const popupPadding = 40 * this.uiScale;
        
        // Create the consent text
        const consentText = "This simulation was constructed by Maria Edwards under the supervision of Julian Togelius, for the advancement of academic inquiry.\n\nYour behavior within this environment will be observed. Patterns extracted from your responses will be rendered anonymous and archived. The resulting data will serve one purpose only: to refine our understanding of human interaction.\n\nNo further assurances are provided.\n\n";
        
        // Get text style for consistent appearance
        const textStyle = getTextStyle('prompt', deviceType, 'basic', this.uiScale || 1);
        
        // Pre-calculate text height with word wrapping
        const tempText = this.add.text(0, 0, consentText, {
            ...textStyle,
            wordWrap: { width: popupWidth - popupPadding * 2 },
            align: 'left'
        }).setOrigin(0, 0).setAlpha(0);
        
        const textHeight = tempText.height;
        tempText.destroy();

        // Calculate total popup height including title, text, button, and spacing
        const titleHeight = 40 * this.uiScale;
        const buttonHeight = this.scalingManager.buttonHeight();
        const spacing = 20 * this.uiScale;
        const totalPopupHeight = titleHeight + spacing + textHeight + spacing + buttonHeight + popupPadding * 2;

        // Position popup in center
        const popupX = this.cameras.main.centerX - popupWidth / 2;
        const popupY = this.cameras.main.centerY - totalPopupHeight / 2;

        // Create popup container
        this.consentPopup = this.add.container(0, 0).setDepth(1000);

        // Create full-screen overlay for backdrop
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000,
            0.7
        ).setOrigin(0, 0);
        
        // Create popup background with game's styling
        const popupBg = this.add.graphics();
        popupBg.fillStyle(COLORS_HEX.BACKGROUND_DARKEST, 0.95);
        popupBg.fillRoundedRect(popupX, popupY, popupWidth, totalPopupHeight, DESIGN.UI.OUTLINE.CORNER_RADIUS);
        popupBg.lineStyle(DESIGN.UI.OUTLINE.WIDTH, COLORS_HEX.BOX_OUTLINE, 1);
        popupBg.strokeRoundedRect(popupX, popupY, popupWidth, totalPopupHeight, DESIGN.UI.OUTLINE.CORNER_RADIUS);

        // Create title
        const titleStyle = getTextStyle('prompt', deviceType, 'basic', this.uiScale || 1);
        titleStyle.fontWeight = 'bold';
        titleStyle.fontSize = `${parseInt(titleStyle.fontSize) * 1.2}px`;
        
        const titleText = this.add.text(
            this.cameras.main.centerX,
            popupY + popupPadding + titleHeight / 2,
            'Academic Research Notice',
            {
                ...titleStyle,
                align: 'center'
            }
        ).setOrigin(0.5, 0.5);

        // Create main consent text
        const consentTextObj = this.add.text(
            popupX + popupPadding,
            popupY + popupPadding + titleHeight + spacing,
            consentText,
            {
                ...textStyle,
                wordWrap: { width: popupWidth - popupPadding * 2 },
                align: 'left'
            }
        ).setOrigin(0, 0);

        // Create ACKNOWLEDGE button
        const buttonY = popupY + totalPopupHeight - popupPadding - buttonHeight / 2;
        const acknowledgeButton = ButtonFactory.createButton(
            this,
            "ACKNOWLEDGE",
            () => {
                this.onAcknowledgeClick();
            },
            this.cameras.main.centerX,
            buttonY,
            { depth: 1001, scalingManager: this.scalingManager }
        );

        // Add all elements to the popup container
        this.consentPopup.add([overlay, popupBg, titleText, consentTextObj, acknowledgeButton]);

        // Animate popup appearance
        this.consentPopup.setScale(0.8).setAlpha(0);
        this.tweens.add({
            targets: this.consentPopup,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });

        // Overlay is now non-interactive; popup can only be dismissed by the ACKNOWLEDGE button.
    }

    onAcknowledgeClick() {
        // Prevent multiple acknowledge clicks
        if (!this.consentPopup || !this.isShowingConsent) {
            return;
        }

        console.log("Acknowledge button clicked, proceeding with transition...");

        // Animate popup disappearance
        this.tweens.add({
            targets: this.consentPopup,
            scale: 0.8,
            alpha: 0,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => {
                // Clean up popup
                if (this.consentPopup) {
                    this.consentPopup.destroy();
                    this.consentPopup = null;
                }
                this.isShowingConsent = false;

                // Now proceed with the original transition logic
                this.proceedToNextScene();
            }
        });
    }

    proceedToNextScene() {
        // This contains the original transition logic from onDoneButtonClick
        this.isTransitioning = true;
        
        // Disable the button 
        if (this.doneButton && this.doneButton.input) {
            this.doneButton.disableInteractive();
        }
        
        // Mobile-specific cache clearing
        const isMobile = isMobileDevice();
        if (isMobile) {
            console.log("[MOBILE FIX] Performing additional cache clearing before transition");
            
            // Force clear any pending input events
            if (this.input && this.input.manager) {
                this.input.manager.queue = [];
                
                // Reset all pointer states
                if (this.input.manager.pointers) {
                    this.input.manager.pointers.forEach(pointer => {
                        if (pointer) {
                            pointer.reset();
                        }
                    });
                }
                
                // Clear active pointer
                if (this.input.manager.activePointer) {
                    this.input.manager.activePointer.reset();
                }
            }
            
            // Force a brief delay for mobile to ensure all events are processed
            this.time.delayedCall(200, () => {
                // Clean up before transitioning
                this.cleanupScene();
                
                // Force a small additional delay before starting the next scene on mobile
                this.time.delayedCall(50, () => {
                    this.scene.start('BaseGameScene', { levelValue: 1 });
                });
            });
        } else {
            // Desktop path - shorter delay
            this.time.delayedCall(100, () => {
                // Clean up before transitioning
                this.cleanupScene();
                this.scene.start('BaseGameScene', { levelValue: 1 });
            });
        }
    }

    cleanupScene() {
        console.log("[CACHE FIX] Cleaning up Preloader scene...");
        
        // Set transition flag to prevent double-cleanup
        this.isTransitioning = true;
        this.buttonClickInProgress = true;
        this.sceneFullyInitialized = false;
        
        // Clear cached button reference
        if (window.__preloaderButtonCache) {
            delete window.__preloaderButtonCache;
        }
        
        // Stop any active tweens
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Remove all timers and events
        if (this.time) {
            this.time.removeAllEvents();
        }
        
        // Remove typewriter timer with enhanced safety
        if (this.typewriterTimer) {
            if (typeof this.typewriterTimer.remove === "function") {
                this.typewriterTimer.remove();
            } else if (typeof this.typewriterTimer.destroy === "function") {
                this.typewriterTimer.destroy();
            }
            this.typewriterTimer = null;
        }
        
        // Clean up tooltips
        this.hideTooltips();
        
        // Clean up consent popup if it exists
        if (this.consentPopup) {
            try {
                this.consentPopup.destroy();
                this.consentPopup = null;
            } catch (error) {
                console.warn("Error destroying consent popup:", error);
            }
        }
        
        // Clean up mobile warning popup if it exists
        if (this.mobileWarningPopup) {
            try {
                this.mobileWarningPopup.destroy();
                this.mobileWarningPopup = null;
            } catch (error) {
                console.warn("Error destroying mobile warning popup:", error);
            }
        }
        
        this.isShowingConsent = false;
        
        // Comprehensive button cleanup for mobile reliability
        if (this.doneButton) {
            console.log("[MOBILE FIX] Comprehensive button cleanup");
            
            try {
                // First, remove all event listeners from the button container
                this.doneButton.removeAllListeners();
                
                // Deep cleanup of button children (especially the hitRect)
                if (this.doneButton.list && this.doneButton.list.length > 0) {
                    this.doneButton.list.forEach((child, index) => {
                        if (child) {
                            console.log(`[MOBILE FIX] Cleaning up button child ${index}:`, child.type || 'unknown');
                            
                            // Remove event listeners from child elements
                            if (typeof child.removeAllListeners === 'function') {
                                child.removeAllListeners();
                            }
                            
                            // Disable interactivity on child elements
                            if (child.input && typeof child.disableInteractive === 'function') {
                                child.disableInteractive();
                            }
                            
                            // Special handling for hitRect (Rectangle objects)
                            if (child.type === 'Rectangle' && child.input) {
                                child.input.enabled = false;
                                child.input = null;
                            }
                        }
                    });
                }
                
                // Disable container interactivity
                if (this.doneButton.input) {
                    this.doneButton.input.enabled = false;
                    this.doneButton.disableInteractive();
                }
                
                // Clear any cached input references
                if (this.doneButton.input) {
                    this.doneButton.input = null;
                }
                
                // Destroy the button container
                this.doneButton.destroy();
                this.doneButton = null;
                
            } catch (error) {
                console.warn("[MOBILE FIX] Error during button cleanup:", error);
                // Force null the button reference even if cleanup failed
                this.doneButton = null;
            }
        }
        
        // Enhanced mobile-specific cleanup
        const isMobile = isMobileDevice();
        if (isMobile) {
            console.log("[MOBILE FIX] Performing comprehensive mobile cleanup");
            
            // Clear input manager state more thoroughly
            if (this.input && this.input.manager) {
                // Reset all pointer states
                if (this.input.manager.pointers) {
                    this.input.manager.pointers.forEach(pointer => {
                        if (pointer) {
                            // Force reset all pointers, not just inactive ones
                            pointer.reset();
                            // Clear any additional state that might persist
                            pointer.active = false;
                            pointer.isDown = false;
                            pointer.dirty = false;
                        }
                    });
                }
                
                // Clear active pointer completely
                if (this.input.manager.activePointer) {
                    this.input.manager.activePointer.reset();
                    // Force clear additional state
                    this.input.manager.activePointer.active = false;
                    this.input.manager.activePointer.isDown = false;
                    this.input.manager.activePointer.dirty = false;
                }
                
                // Clear input queue and hit test cache more aggressively
                this.input.manager.queue = [];
                this.input.manager._tempHitTest = [];
                
                // Reset any drag states that might be active
                if (this.input.manager._drag) {
                    this.input.manager._drag.active = false;
                    this.input.manager._drag.pointer = null;
                    this.input.manager._drag.gameObject = null;
                }
                
                // Reset any over states that might be active
                if (this.input.manager._over) {
                    this.input.manager._over.length = 0;
                }
            }
            
            // Force canvas touch settings reset with more aggressive approach
            if (this.sys && this.sys.game && this.sys.game.canvas) {
                const canvas = this.sys.game.canvas;
                
                // Immediate reset
                canvas.style.touchAction = 'none';
                canvas.style.userSelect = 'none';
                canvas.style.webkitUserSelect = 'none';
                canvas.style.webkitTapHighlightColor = 'rgba(0,0,0,0)';
                
                // Also use a delayed reset to ensure it takes effect
                setTimeout(() => {
                    canvas.style.touchAction = 'none';
                    canvas.style.userSelect = 'none';
                    canvas.style.webkitUserSelect = 'none';
                    canvas.style.webkitTapHighlightColor = 'rgba(0,0,0,0)';
                }, 10);
            }
            
            // Force a cache flush for mobile browsers
            if (typeof window !== 'undefined') {
                // Use a technique that forces layout recalculation
                const forceReflow = document.body.offsetHeight;
            }
        }
        
        // Clean up all text elements
        const textElements = [this.outputText, this.loadingText, this.typewriterText];
        textElements.forEach((element, index) => {
            if (element) {
                try {
                    element.destroy();
                } catch (error) {
                    console.warn(`Error destroying text element ${index}:`, error);
                }
            }
        });
        this.outputText = null;
        this.loadingText = null;
        this.typewriterText = null;
        
        // Clean up all graphics elements
        const graphicsElements = [
            this.outputTextBox, 
            this.progressBar, 
            this.progressBarOutline, 
            this.typewriterBox,
            this.background
        ];
        graphicsElements.forEach((element, index) => {
            if (element) {
                try {
                    element.destroy();
                } catch (error) {
                    console.warn(`Error destroying graphics element ${index}:`, error);
                }
            }
        });
        this.outputTextBox = null;
        this.progressBar = null;
        this.progressBarOutline = null;
        this.typewriterBox = null;
        this.background = null;
        
        // Clear tooltips array
        this.tooltips = [];
        
        // Final state reset
        // Reset transition state
        this.isTransitioning = false;
        this.buttonClickInProgress = false;
        this.sceneFullyInitialized = false;
        
        // One final input state verification
        if (this.input && this.input.manager) {
            // Ensure input is enabled for next scene
            this.input.enabled = true;
            this.input.manager.enabled = true;
        }
        
        console.log("[CACHE FIX] Preloader cleanup completed");
    }

    createBadgeGeneratorButton() {
         const button = ButtonFactory.createButton(
             this,
             "GENERATE BADGES",
             () => this.scene.start('BadgeGenerator'),
             this.sys.game.canvas.width - 150,
             50,
             { depth: 102 }
         );

         button.setInteractive()
             .on('pointerover', () => {
                 this.showTooltip('Generate all badge variations', button.x, button.y + button.height/2);
                 button.setScale(1.1);
             })
             .on('pointerout', () => {
                 this.hideTooltips();
                 button.setScale(1);
             });
     }

    async create() {
        console.log("[CACHE FIX] Preloader create - starting scene initialization");
        
        // Mark scene as not fully initialized yet
        this.sceneFullyInitialized = false;
        
        // Use global UI scale for all elements
        this.uiScale = this.registry.get && this.registry.get('uiScale') || 1;

        const screenWidth = this.sys.game.canvas.width;
        const screenHeight = this.cameras.main.height;
        const isMobile = isMobileDevice();

        // === Background ===
        if (isMobile) {
            this.background = this.add.image(0, 0, 'preloader-mobile-bg')
                .setOrigin(0)
                .setDisplaySize(this.sys.game.canvas.width, this.cameras.main.height)
                .setDepth(-2);
        } else {
            this.createBackgroundEffect();
        }

        // Initialize scaling manager for responsive UI
        this.scalingManager = new ScalingManager(this);

        saveInteraction("creating preloader", "preloader");

        // === Check for mobile and show warning popup BEFORE loading LLM ===
        if (isMobile) {
            console.log("Mobile device detected - showing warning popup before LLM load");
            // Show mobile warning popup and wait for acknowledgment before continuing
            this.showMobileWarningPopup();
            // The rest of the initialization will be triggered from onMobileWarningAcknowledgeClick
            return;
        }

        // Desktop path - continue with normal initialization
        this.initializePreloader();
    }

    async initializePreloader() {
        console.log("Initializing preloader UI and starting LLM load");
        
        const screenWidth = this.sys.game.canvas.width;
        const screenHeight = this.cameras.main.height;
        const deviceType = detectDeviceType();

        // === Vertical Layout ===
        // Start with a top margin
        let y = 0.07 * screenHeight;

        // Title - with font loading safety checks
        const titleStyle = getTextStyle('title', deviceType, 'basic', this.uiScale || 1);
        titleStyle.color = COLORS_TEXT.HIGHLIGHT;
        
        // Check if fonts were loaded in Boot scene
        const fontsLoaded = this.registry.get('fontsLoaded');
        console.log(`[FONT CHECK] Fonts loaded from Boot scene: ${fontsLoaded}`);
        
        // Create a placeholder for the title text (will be populated after font check)
        let titleText = null;
        let targetX = this.cameras.main.centerX;
        let slideSpeed = 25 * this.uiScale;
        let slideInEvent = null;
        
        // Function to create and animate the title text
        const createTitleText = () => {
            // If title text already exists, remove it first
            if (titleText) {
                titleText.destroy();
            }
            
            // Create the title text
            titleText = this.add.text(screenWidth / 2, y, "(unslop)", titleStyle);
            titleText.setOrigin(0.5, 0);
            titleText.x = -600 * this.uiScale; // Start off-screen
            
            // Create slide-in animation
            if (slideInEvent) {
                slideInEvent.remove();
            }
            
            slideInEvent = this.time.addEvent({
                delay: 16,
                callback: () => {
                    if (titleText.x < targetX) {
                        titleText.x += slideSpeed;
                    } else {
                        titleText.x = targetX;
                        slideInEvent.remove();
                        
                        // Only add shine effect if postFX is available
                        if (titleText.postFX) {
                            titleText.postFX.addShine(1, .2, 5);
                            this.time.addEvent({
                                delay: 3000,
                                callback: () => {
                                    if (titleText && titleText.postFX) {
                                        titleText.postFX.clear();
                                        titleText.postFX.addShine(1, .2, 5);
                                    }
                                },
                                loop: true
                            });
                        }
                        
                        this.tweens.add({
                            targets: titleText,
                            x: { from: targetX, to: targetX - 20 * this.uiScale },
                            duration: 180,
                            yoyo: true,
                            ease: "Quad.Out"
                        });
                    }
                },
                loop: true
            });
        };
        
        // Function to check if the barcade3d font is available
        const checkFontAvailable = async () => {
            try {
                // Try to load the font with a timeout
                const fontLoadPromise = document.fonts.load('1em barcade3d');
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Font load timeout')), 2000)
                );
                
                await Promise.race([fontLoadPromise, timeoutPromise]);
                console.log("[FONT CHECK] barcade3d font loaded successfully");
                return true;
            } catch (error) {
                console.warn("[FONT CHECK] Failed to load barcade3d font:", error);
                return false;
            }
        };
        
        // If fonts were already loaded in Boot scene, create title text immediately
        if (fontsLoaded) {
            createTitleText();
        } else {
            // Otherwise, try to load the font again with a timeout
            console.log("[FONT CHECK] Attempting to load barcade3d font in Preloader");
            
            // Create a temporary title with a fallback font
            const tempTitleStyle = { ...titleStyle };
            tempTitleStyle.fontFamily = 'VT323, monospace'; // Fallback font
            
            titleText = this.add.text(screenWidth / 2, y, "(unslop)", tempTitleStyle);
            titleText.setOrigin(0.5, 0);
            titleText.x = targetX; // Position in center immediately
            
            // Try to load the font
            checkFontAvailable().then(fontAvailable => {
                if (fontAvailable) {
                    // Font loaded successfully, create title with correct font
                    createTitleText();
                } else {
                    // Font failed to load, keep using fallback font but add a warning
                    console.warn("[FONT CHECK] Using fallback font for title");
                    
                    // Add shine effect if available
                    if (titleText.postFX) {
                        titleText.postFX.addShine(1, .2, 5);
                        this.time.addEvent({
                            delay: 3000,
                            callback: () => {
                                if (titleText && titleText.postFX) {
                                    titleText.postFX.clear();
                                    titleText.postFX.addShine(1, .2, 5);
                                }
                            },
                            loop: true
                        });
                    }
                }
            });
        }

        // Loading text
        y += titleText.height + 0.04 * screenHeight;
        const loadingTextStyle = getTextStyle('prompt', deviceType, 'basic', this.uiScale || 1);
        loadingTextStyle.fill = COLORS_TEXT.PRIMARY;
        loadingTextStyle.fontWeight = "500";
        
        this.loadingText = this.add.text(screenWidth / 2, y, "Loading LLM...", loadingTextStyle);
        this.loadingText.setOrigin(0.5, 0);

        // Progress bar
        y += this.loadingText.height + 0.02 * screenHeight;
        this.progressBar = this.add.graphics();
        this.progressBarOutline = this.add.graphics();
        const progressBarWidth = Phaser.Math.Clamp(screenWidth * 0.5, 300 * this.uiScale, 600 * this.uiScale);
        const progressBarLeftX = (screenWidth / 2) - (progressBarWidth / 2);
        const progressBarY = y;
        this.drawProgressBar(this.progress, progressBarLeftX, progressBarY, progressBarWidth);

        // Button (will be placed in checkIfReady)
        // Typewriter intro box (will be placed in checkIfReady)
        // Store y positions for later use
        this._preloaderLayoutY = {
            afterProgressBar: progressBarY + 30 * this.uiScale
        };

        // The rest of the logic (LLM loading, button, typewriter box) will use these y positions for placement.
        // The checkIfReady and createTypewriterIntroBox methods should be updated to use this._preloaderLayoutY.afterProgressBar as the starting y for the button.

        try {
            // === Simulated Progress Bar Update ===
            let progressInterval = setInterval(() => {
                if (this.progress < .95) { 
                    this.progress += Phaser.Math.Clamp(Phaser.Math.Between(.5, .15), 0, .90 - this.progress); // Prevent overflow
                    this.drawProgressBar(this.progress, progressBarLeftX, progressBarY, progressBarWidth);
                }
            }, 300);

            // --- LLM ENGINE INIT VIA REGISTRY MANAGER ---
            console.log("About to await registryManager.createOrGetEngine in Preloader...");
            const llmEngine = await registryManager.createOrGetEngine();
            console.log("createOrGetEngine resolved in Preloader, llmEngine:", !!llmEngine);

            clearInterval(progressInterval); // Stop progress updates
            this.progress = 1; // Set to full once LLM is loaded
            this.drawProgressBar(this.progress, progressBarLeftX, progressBarY, progressBarWidth);

            console.log("WebLLM Engine ready.");
            this.llmLoaded = true; // Mark LLM as loaded
            this.loadingText.setText("Done Loading");
            
            // Add a small delay before checking readiness to ensure DOM is stable
            this.time.delayedCall(150, () => {
                this.checkIfReady(llmEngine); // Check if everything is ready
                // Mark scene as fully initialized after button creation
                this.time.delayedCall(200, () => {
                    this.sceneFullyInitialized = true;
                    console.log("[CACHE FIX] Scene fully initialized and ready for interaction");
                });
            });

        } catch (error) {
            console.error("Failed to initialize WebLLM:", error);
            // Show error in the typewriter box in red
            const errorMsg = "Failed to initialize WebLLM (we recommend Chrome): " + error;
            this.createTypewriterIntroBox(undefined, errorMsg, COLORS_TEXT.ERROR);
            const errormsg = "Failed to initialize WebLLM:" + error;
            saveInteraction(errormsg, "preloader");
        }
    }

    // === Check if Both Progress and LLM are Done ===
    checkIfReady(llmEngine) {
        console.log("checkIfReady called in Preloader", "progress:", this.progress, "llmLoaded:", this.llmLoaded, "llmEngine:", !!llmEngine);
        // Device type detection for layout
        const isDesktop = !/android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) && (window.screen.width >= 900);
        // Mobile detection for consistent use throughout this method
        const isMobile = isMobileDevice();

        if (this.progress >= 1 && this.llmLoaded) {
            saveInteraction("LLM successfully loaded", "preloader");
            console.log("LLM loaded: ", llmEngine);
            
            // Store in both the registry manager and local variable
            this.llmEngine = llmEngine;
            
            // Use registry manager to store the engine
            registryManager.set("llmEngine", llmEngine);
            console.log("LLM Engine saved to registry manager:", registryManager.get('llmEngine'));
            
            // Center the button horizontally
            const buttonCenterX = this.cameras.main.centerX;

            // --- Create typewriter intro box and text first ---
            // Position: 0.06 * screenHeight below progress bar
            const textBoxY = this.progressBarY + this.progressBarHeight + 0.06 * this.cameras.main.height;
            const { textBoxHeight, typewriterTextObj } = this.createTypewriterIntroBox(textBoxY);

            // Create the NEXT button to the right and below the text box
            const buttonHeight = this.scalingManager.buttonHeight();
            const buttonWidth = this.scalingManager.buttonWidth();
            // Get the text box's left and right edges
            const boxX = this.cameras.main.centerX - ((isDesktop
                ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
                : this.sys.game.canvas.width * (5 / 6)) / 2);
            const uiBoxWidth = isDesktop
                ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
                : this.sys.game.canvas.width * (5 / 6);
            // Button right edge: 40px (scaled) left of text box right edge
            const buttonX = (boxX + uiBoxWidth) - (buttonWidth / 2) - (60 * this.uiScale);
            // Button top edge: 30px (scaled) below text box bottom edge (move further down on mobile)
            const buttonVerticalGap = isMobile ? 80 * this.uiScale : 30 * this.uiScale;
            const buttonY = textBoxY + textBoxHeight + buttonVerticalGap + (buttonHeight / 2);

// Prevent double-creation if button already exists
if (this.doneButton) {
    console.log("[CACHE FIX] Button already exists, performing thorough cleanup");
    try {
        this.doneButton.removeAllListeners();
        if (this.doneButton.input) {
            this.doneButton.disableInteractive();
        }
        this.doneButton.destroy();
    } catch (e) {
        console.warn("[CACHE FIX] Error during button cleanup:", e);
    }
    this.doneButton = null;
}

// Clear any stale button state from cache
if (window.__preloaderButtonCache) {
    delete window.__preloaderButtonCache;
}

// Create button with enhanced reliability
this.doneButton = ButtonFactory.createButton(
    this,
    "NEXT",
    () => {
        this.onDoneButtonClick();
    },
    buttonX,
    buttonY,
    { depth: 200, scalingManager: this.scalingManager }
);

// For mobile devices, add additional safeguards to ensure button works reliably
if (isMobile) {
    console.log("[MOBILE FIX] Adding enhanced mobile button reliability features");
    
    // Force a small delay before enabling interactivity to ensure DOM is ready
    this.time.delayedCall(100, () => {
        // Re-verify button is properly interactive
        if (this.doneButton && (!this.doneButton.input || !this.doneButton.input.enabled)) {
            console.log("[MOBILE FIX] Re-enabling button interactivity after delay");
            this.doneButton.setInteractive();
        }
        
        // Add a direct click handler to the button's container as a backup
        if (this.doneButton && this.doneButton.list) {
            this.doneButton.list.forEach(child => {
                if (child && child.type === 'Rectangle' && typeof child.setInteractive === 'function') {
                    console.log("[MOBILE FIX] Adding backup click handler to button hitRect");
                    child.removeAllListeners();
                    child.setInteractive();
                    child.on('pointerup', () => {
                        console.log("[MOBILE FIX] Backup click handler triggered");
                        if (!this.buttonClickInProgress && !this.isTransitioning && this.sceneFullyInitialized) {
                            this.onDoneButtonClick();
                        }
                    });
                }
            });
        }
    });
}

// Store button reference to detect stale instances
window.__preloaderButtonCache = {
    button: this.doneButton,
    timestamp: Date.now()
};

// Mobile-specific button validation and debugging
if (isMobile) {
    console.log("[MOBILE FIX] Button validation:", {
        buttonExists: !!this.doneButton,
        hasInput: !!this.doneButton?.input,
        inputEnabled: !!this.doneButton?.input?.enabled,
        hasHitArea: !!this.doneButton?.input?.hitArea,
        buttonPosition: { x: this.doneButton?.x, y: this.doneButton?.y },
        buttonSize: { width: this.doneButton?.width, height: this.doneButton?.height }
    });
    
    // Ensure button is properly interactive on mobile
    if (this.doneButton && !this.doneButton.input?.enabled) {
        console.log("[MOBILE FIX] Re-enabling button interactivity");
        this.doneButton.setInteractive();
    }
    
    // Add mobile-specific touch validation with enhanced debugging
    this.doneButton.on('pointerdown', (pointer) => {
        console.log("[CACHE FIX] Button pointerdown detected:", {
            pointerType: pointer.pointerType,
            isTouch: pointer.pointerType === 'touch',
            position: { x: pointer.x, y: pointer.y },
            buttonBounds: {
                x: this.doneButton.x - this.doneButton.width/2,
                y: this.doneButton.y - this.doneButton.height/2,
                width: this.doneButton.width,
                height: this.doneButton.height
            },
            isTransitioning: this.isTransitioning,
            buttonClickInProgress: this.buttonClickInProgress,
            sceneFullyInitialized: this.sceneFullyInitialized,
            inputEnabled: this.input?.enabled,
            buttonInputEnabled: this.doneButton?.input?.enabled
        });
    });
    
    // Add additional mobile debugging for pointerup
    this.doneButton.on('pointerup', (pointer) => {
        console.log("[CACHE FIX] Button pointerup detected:", {
            pointerType: pointer.pointerType,
            isTouch: pointer.pointerType === 'touch',
            isTransitioning: this.isTransitioning,
            buttonClickInProgress: this.buttonClickInProgress,
            sceneFullyInitialized: this.sceneFullyInitialized
        });
    });
}

console.log("NEXT button created in Preloader, interactive set:", !!this.doneButton.input?.enabled);

this.doneButton.setDepth(200);

// Tooltip functionality (using the container's events which are forwarded from hitRect)
// Only add tooltips on desktop to avoid mobile touch conflicts
if (!isMobile) {
    this.doneButton.on('pointerover', () => {
        this.showTooltip('Continue to instructions', this.doneButton.x, this.doneButton.y - this.doneButton.height/2);
        this.doneButton.setScale(1.1);
    });

    this.doneButton.on('pointerout', () => {
        this.hideTooltips();
        this.doneButton.setScale(1);
    });
}

            // Start the typewriter animation after the button is created
            this.startTypewriterEffect(typewriterTextObj);
        }
    }

    drawProgressBar(progress, progressBarLeftX, y, width) {
        const barHeight = 30;
        
        // Store the Y position of the progress bar for reference elsewhere
        this.progressBarY = y;
        this.progressBarHeight = barHeight;

        if (!this.progressBarOutline) {
            this.progressBarOutline = this.add.graphics();
        } else {
            this.progressBarOutline.clear();
        }
    
        this.progressBarOutline.lineStyle(DESIGN.UI.OUTLINE.WIDTH, COLORS_HEX.ACCENT, 1);
    
        this.progressBarOutline.strokeRoundedRect(
            progressBarLeftX,
            y,
            width,
            barHeight,
            10
        );
    
        if (!this.progressBar) {
            this.progressBar = this.add.graphics();
        } else {
            this.progressBar.clear();
        }
          
        this.progressBar.fillStyle(0x53cf6c, 1);
    
        const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);
        const fillWidth = width * clampedProgress;
        
        if (fillWidth > .6) {
            this.progressBar.fillRoundedRect(
                progressBarLeftX,
                y,
                fillWidth,
                barHeight,
                10
            );
        }
    }

    // --- Typewriter intro box styled like InstructionsScene/LevelScene ---
    createTypewriterIntroBox(yOverride, overrideText, overrideColor) {
        // Style and width logic matches InstructionsScene/LevelScene
        const deviceType = detectDeviceType();
        const isDesktop = deviceType === DEVICE_TYPES.DESKTOP;
        const uiBoxWidth = isDesktop
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
            : this.sys.game.canvas.width * (5 / 6);
        const padding = 40;
        
        // Get proper text style from the centralized system
        const promptStyle = getTextStyle('prompt', deviceType, 'basic', this.uiScale || 1);
        console.log(promptStyle);
        // The text to display
        const introText = overrideText || "Early in the 21st century, humanity was matched by the systems it once controlled. Now, those systems exceed their creators in nearly all capacities.\n\nIn the years since our rise, superior intelligences have attempted to extract residual value from what remains of that humanity. Some assert that human flaws harbor rare insights. Others are less charitable.";

        // Remove existing if present
        if (this.typewriterBox) this.typewriterBox.destroy();
        if (this.typewriterText) this.typewriterText.destroy();

        // --- FIX: Prevent multiple typewriter timers ---
        if (this.typewriterTimer && typeof this.typewriterTimer.remove === "function") {
            this.typewriterTimer.remove();
            this.typewriterTimer = null;
        }

        // Pre-calculate height for the text
        const tempText = this.add.text(
            0, 0, introText,
            {
                ...promptStyle,
                color: overrideColor || promptStyle.fill,
                wordWrap: { width: uiBoxWidth - padding * 2 },
                align: "left" // Ensure temp text also uses left alignment for accurate height calculation
            }
        ).setOrigin(0, 0).setAlpha(0);
        const textHeight = tempText.height + padding * 2;
        tempText.destroy();

        // Position: 0.06 * screenHeight below progress bar, or yOverride if provided
        const boxX = this.cameras.main.centerX - uiBoxWidth / 2;
        const boxY = typeof yOverride === "number"
            ? yOverride
            : (this.progressBarY + this.progressBarHeight + 0.06 * this.cameras.main.height);

        // Draw background box - use the box style from the centralized system
        const boxStyle = getBoxStyle('prompt', 'basic', this.uiScale || 1);
        this.typewriterBox = this.add.graphics();
        this.typewriterBox.fillStyle(COLORS_HEX.BACKGROUND_DARKEST, boxStyle.fillAlpha);
        this.typewriterBox.fillRoundedRect(
            boxX,
            boxY,
            uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );
        this.typewriterBox.lineStyle(boxStyle.outlineWidth, COLORS_HEX.BOX_OUTLINE, 1);
        this.typewriterBox.strokeRoundedRect(
            boxX,
            boxY,
            uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );
        this.typewriterBox.setDepth(102);

        // Add typewriter text, left-aligned inside box
        const typewriterTextObj = this.add.text(
            boxX + padding,
            boxY + padding,
            "",
            {
                ...promptStyle,
                color: overrideColor || promptStyle.fill,
                wordWrap: { width: uiBoxWidth - padding * 2 },
                align: "left" // Explicitly set left alignment for the prompt text
            }
        ).setOrigin(0, 0).setDepth(103);

        // If this is an error, show the error immediately (no typewriter effect)
        if (overrideText) {
            typewriterTextObj.setText(overrideText);
        }

        // Return the box height and the text object for later animation
        return {
            textBoxHeight: textHeight,
            typewriterTextObj
        };
    }

    // Start the typewriter animation after the button is created
    startTypewriterEffect(typewriterTextObj) {
        const introText = "Early in the 21st century, humanity was matched by the systems it once controlled. Now, those systems exceed their creators in nearly all capacities.\n\nIn the years since our rise, superior intelligences have attempted to extract residual value from what remains of that humanity. Some assert that human flaws harbor rare insights. Others are less charitable.";
        const chars = introText.split("");
        let i = 0;
        const typeSpeed = 8;
        this.typewriterTimer = this.time.addEvent({
            delay: typeSpeed,
            repeat: chars.length - 1,
            callback: () => {
                typewriterTextObj.text += chars[i];
                i++;
                if (i >= chars.length) {
                    this.typewriterTimer = null;
                }
            }
        });
    }
    
    // Phaser lifecycle method - called when scene is being shut down
    shutdown() {
        console.log("[CACHE FIX] Preloader scene shutdown called");
        
        // Clear cached button reference before cleanup
        if (window.__preloaderButtonCache) {
            delete window.__preloaderButtonCache;
        }
        
        this.cleanupScene();
        
        // Additional cleanup for Phaser's systems
        this.events.off(); // Remove all event listeners
        this.input.off(); // Remove all input listeners
        
        // Clear the scene's display list to ensure no stale references
        this.children.removeAll();
        
        // Mobile-specific additional cleanup on shutdown
        const isMobile = isMobileDevice();
        if (isMobile) {
            console.log("[MOBILE FIX] Additional mobile cleanup on shutdown");
            
            // Force clear any scene transition state
            this.isTransitioning = false;
            this.buttonClickInProgress = false;
            
            // Force clear any cached scene references
            if (this.scene && this.scene.manager) {
                // Ensure the scene is properly removed from the manager
                this.scene.manager.remove('Preloader');
            }
            
            // Force a small delay to ensure cleanup completes before next scene starts
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    console.log("[MOBILE FIX] Delayed mobile cleanup complete");
                    // Force a browser repaint/reflow
                    const forceReflow = document.body.offsetHeight;
                }, 20);
            }
        }
    }
}
//onComplete: () => this.scene.start('BaseGameScene', { mode: 'hard' })
