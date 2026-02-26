import { DESIGN, EASY_COLORS_HEX, EASY_COLORS_TEXT, HARD_COLORS_HEX, HARD_COLORS_TEXT, THEMES } from "../config/design.js";
import { saveHighScore } from "../config/firebase.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import SceneTransitionManager from "../utils/SceneTransitionManager.js";
import { createBackground } from "../backgrounds/createBackground.js";
import { ScalingManager } from "../config/scaling.js";
import { getTextStyle, getBoxStyle } from "../config/textStyles.js";
import { detectDeviceType } from "../config/dimensions.js";

export default class UsernameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UsernameScene' });
        this.username = '';
        this.scoreData = null;
        this.mode = 'easy';
        this.cursorVisible = true;
        this.cursorTimer = null;
    }

    init(data) {
        console.log("UsernameScene init called with data:", JSON.stringify(data));
        this.mode = data.mode || 'easy';
        this.scoreData = data.scoreData || null;
        this.username = data.username || '';
        this.levelValue = data.levelValue || 1;
        this.userResponse = data.userResponse || null;
        console.log("UsernameScene initialized with mode:", this.mode);
        console.log("UsernameScene score data:", this.scoreData);
        console.log("UsernameScene levelValue:", this.levelValue);

        // Set colors based on mode
        if (this.mode === "easy") {
            this.COLORS_HEX = EASY_COLORS_HEX;
            this.COLORS_TEXT = EASY_COLORS_TEXT;
        } else {
            this.COLORS_HEX = HARD_COLORS_HEX;
            this.COLORS_TEXT = HARD_COLORS_TEXT;
        }
    }

    create() {
        // Use global UI scale for all elements - ensure consistency
        this.uiScale = this.registry.get('uiScale') || 1;

        // Create background
        this.createBackgroundEffect();

        // Initialize scaling manager for responsive UI
        this.scalingManager = new ScalingManager(this);

        // Create title and explanation
        this.createTitle();

        // Create input field
        this.createInputField();

        // Create buttons
        this.createButtons();

        // Setup keyboard input
        this.setupKeyboardInput();

        // Show congratulations message
        this.showCongratulations();
    }

    createBackgroundEffect() {
        // Get the appropriate background configuration based on mode
        const themeConfig = this.mode === 'easy' ? THEMES.easy : THEMES.hard;
        
        // Ensure levelValue is properly set - fallback to 1 if not provided
        const levelValue = this.levelValue || 1;
        
        console.log("UsernameScene createBackgroundEffect - mode:", this.mode, "levelValue:", levelValue);
        
        // Use the createBackground function from the imported module
        // This will create the appropriate background based on mode and levelValue
        createBackground(this, themeConfig.background, levelValue);
    }

    createTitle() {
        // Create a title for entering username using centralized text styles
        const deviceType = detectDeviceType();
        const titleStyle = getTextStyle('title', deviceType, this.mode, this.uiScale);
        
        // Different title text and placement for desktop vs mobile
        let titleText;
        let titleY;
        let modifiedTitleStyle = { ...titleStyle };
        
        if (deviceType === 'phone' || deviceType === 'tablet') {
            // Mobile: multi-line title with center alignment
            titleText = '(NEW)\n(HIGH)\n(SCORE)';
            // Adjust Y position to account for multi-line text height
            // Move down from the original position to prevent extending past top edge
            titleY = this.scalingManager.scaleValue(250);
            // Center align the text for mobile
            modifiedTitleStyle.align = 'center';
        } else {
            // Desktop: single line title (stay as is)
            titleText = '(NEW HIGH SCORE)';
            titleY = this.scalingManager.scaleValue(80);
        }

        this.add.text(
            this.scalingManager.centerX(),
            titleY,
            titleText,
            modifiedTitleStyle
        ).setOrigin(0.5);

        // Add explanation text using centralized text styles
        const promptStyle = getTextStyle('prompt', deviceType, this.mode, this.uiScale);

        this.add.text(
            this.scalingManager.centerX(),
            this.scalingManager.centerY() - this.scalingManager.scaleValue(100),
            'Enter your name for the leaderboard:',
            promptStyle
        ).setOrigin(0.5);
    }

    createInputField() {
        // Get box style from centralized configuration - use consistent uiScale
        const boxStyle = getBoxStyle('input', this.mode, this.uiScale);
        
        // Scale dimensions properly using scalingManager methods
        const width = this.scalingManager.scaleValue(this.sys.game.canvas.width * 0.6);
        const height = this.scalingManager.scaleValue(60);
        const x = this.scalingManager.centerX() - width / 2;
        const y = this.scalingManager.centerY() - this.scalingManager.scaleValue(50);

        // Destroy existing input border if it exists
        if (this.inputBg) {
            this.inputBg.destroy();
        }

        // Create input field background using box style (exactly like FeedbackScene)
        this.inputBg = this.add.graphics();
        this.inputBg.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        
        // Use a reasonable corner radius for the input box size (not the large UI.OUTLINE.CORNER_RADIUS)
        const inputCornerRadius = Math.min(boxStyle.cornerRadius, height / 4, 15);
        
        this.inputBg.fillRoundedRect(x, y, width, height, inputCornerRadius);
        
        if (boxStyle.hasOutline) {
            this.inputBg.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
            this.inputBg.strokeRoundedRect(x, y, width, height, inputCornerRadius);
        }
        this.inputBg.setDepth(100).setVisible(true);

        // Make input field interactive (like FeedbackScene)
        this.inputBg.setInteractive(
            new Phaser.Geom.Rectangle(x, y, width, height),
            Phaser.Geom.Rectangle.Contains
        ).on('pointerdown', () => {
            this.focusHiddenInput();
        });

        // Get input text style from centralized configuration
        const deviceType = detectDeviceType();
        const inputStyle = getTextStyle('input', deviceType, this.mode, this.uiScale);
        
        // Use input padding from design configuration (like FeedbackScene)
        const textHorizontalPadding = DESIGN.UI.INPUT.HORIZONTAL_PADDING;
        const textVerticalPadding = DESIGN.UI.INPUT.VERTICAL_PADDING;
        
        // Create text field (like FeedbackScene)
        this.inputText = this.add.text(
            x + textHorizontalPadding,
            y + textVerticalPadding,
            this.username || '',
            inputStyle
        ).setOrigin(0, 0).setDepth(101).setVisible(true);

        // Create cursor with same style as input text
        this.cursor = this.add.text(
            this.inputText.x + this.inputText.width + this.scalingManager.scaleValue(2),
            y + height / 2,
            '_',
            inputStyle
        ).setOrigin(0, 0.5).setDepth(101);

        // Start cursor blinking
        this.cursorTimer = this.time.addEvent({
            delay: 500,
            callback: () => {
                this.cursorVisible = !this.cursorVisible;
                this.cursor.setVisible(this.cursorVisible);
            },
            loop: true
        });

        // Store box dimensions for focus state
        this.inputBoxDimensions = { x, y, width, height, boxStyle };

        // Set up hidden input for mobile typing
        this.setupHiddenInput();
    }

    updateInputText() {
        this.inputText.setText(this.username);
        
        // Force text bounds update to get accurate width measurement
        this.inputText.updateText();
        
        // Calculate cursor position more accurately by measuring the actual text bounds
        const textBounds = this.inputText.getBounds();
        this.cursor.setPosition(
            textBounds.right + this.scalingManager.scaleValue(2), 
            this.cursor.y
        );

        // Sync native input if present
        if (this.nativeInput) {
            this.nativeInput.value = this.username;
        }
        
        // Reset cursor blink
        this.cursorVisible = true;
        this.cursor.setVisible(true);
        
        if (this.cursorTimer) {
            this.cursorTimer.reset({
                delay: 500,
                callback: () => {
                    this.cursorVisible = !this.cursorVisible;
                    this.cursor.setVisible(this.cursorVisible);
                },
                loop: true
            });
        }
    }

    setupKeyboardInput() {
        // Store the handler reference so we can remove it later
        this._usernameKeydownHandler = (event) => {
            // Allow only letters, numbers, and spaces
            if (/^[a-zA-Z0-9 ]$/.test(event.key)) {
                if (this.username.length < 8) { // Limit username to 8 characters
                    this.username += event.key;
                    this.updateInputText();
                }
            }
            // Handle backspace
            else if (event.key === 'Backspace') {
                this.username = this.username.slice(0, -1);
                this.updateInputText();
            }
            // Handle enter key
            else if (event.key === 'Enter') {
                this.submitUsername();
            }
        };
        this.input.keyboard.on('keydown', this._usernameKeydownHandler);
    }

    // Hidden HTML input for mobile typing (keyboard only, no visible overlay)
    setupHiddenInput() {
        // Remove any previous input
        if (this._hiddenInput) {
            document.body.removeChild(this._hiddenInput);
            this._hiddenInput = null;
        }
        // Create hidden input
        const input = document.createElement('input');
        input.type = 'text';
        input.autocapitalize = 'none';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = 8;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.style.left = '-1000px';
        input.style.top = '0';
        input.style.width = '1px';
        input.style.height = '1px';
        input.value = this.username;

        // Sync input to Phaser text
        input.addEventListener('input', () => {
            this.username = input.value;
            this.updateInputText();
        });

        // On blur, keep value but do nothing else
        input.addEventListener('blur', () => {
            this.updateInputText();
        });

        // On Enter, submit username
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.submitUsername();
            }
        });

        document.body.appendChild(input);
        this._hiddenInput = input;
    }

    focusHiddenInput() {
        if (!this._hiddenInput) this.setupHiddenInput();
        this._hiddenInput.value = this.username;
        this._hiddenInput.focus();
        // Move cursor to end
        this._hiddenInput.setSelectionRange(this._hiddenInput.value.length, this._hiddenInput.value.length);
    }

    shutdown() {
        // Remove the keydown handler to prevent interference with other scenes
        if (this._usernameKeydownHandler) {
            this.input.keyboard.off('keydown', this._usernameKeydownHandler);
            this._usernameKeydownHandler = null;
        }
        // Call parent shutdown if needed
        if (super.shutdown) {
            super.shutdown();
        }
    }

    destroy() {
        // Also remove the keydown handler on destroy
        if (this._usernameKeydownHandler) {
            this.input.keyboard.off('keydown', this._usernameKeydownHandler);
            this._usernameKeydownHandler = null;
        }
        if (super.destroy) {
            super.destroy();
        }
    }

    createButtons() {
        // Input box layout with proper scaling
        const inputBoxY = this.scalingManager.centerY() - this.scalingManager.scaleValue(50);
        const inputBoxHeight = this.scalingManager.scaleValue(60);
        const inputBoxBottomEdge = inputBoxY + inputBoxHeight;
        const buttonGap = this.scalingManager.scaleValue(DESIGN.UI.BUTTON.BELOW_TEXTBOX_GAP);
        const buttonHeight = this.scalingManager.buttonHeight();

        // Submit button: scaled gap below input box
        const outlineWidth = this.scalingManager.scaleValue(DESIGN.UI.OUTLINE.WIDTH);
        const submitButtonY = inputBoxBottomEdge + outlineWidth / 2 + buttonGap + buttonHeight / 2;

        // Skip button: 2/3 * gap below submit button
        const skipButtonGap = this.scalingManager.scaleValue((2 / 3) * DESIGN.UI.BUTTON.BELOW_TEXTBOX_GAP);
        const skipButtonY = submitButtonY + buttonHeight + skipButtonGap + this.scalingManager.scaleValue(10);

        // Create submit button
        this.submitButton = this.createButton(
            "SUBMIT",
            () => this.submitUsername(),
            this.scalingManager.centerX(),
            submitButtonY
        );

        // Create skip button (anonymous)
        this.skipButton = this.createButton(
            "SKIP",
            () => this.skipUsername(),
            this.scalingManager.centerX(),
            skipButtonY
        );
        
        // Add hover and touch effects to buttons
        [this.submitButton, this.skipButton].forEach(button => {
            button.setInteractive();

            // Desktop: hover effects
            button.on('pointerover', () => button.setScale(1.1));
            button.on('pointerout', () => button.setScale(1));

            // Mobile: touch feedback
            button.on('pointerdown', () => button.setScale(1.15));
            button.on('pointerup', () => button.setScale(1.1));
            button.on('pointerout', () => button.setScale(1));
            button.on('pointercancel', () => button.setScale(1));
        });
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

    showCongratulations() {
        // Create celebration effects for high score
        this.createCelebrationEffect();
        
        // Show score value using centralized effect text style
        const deviceType = detectDeviceType();
        const effectStyle = getTextStyle('effect', deviceType, this.mode, this.uiScale);
        
        const scoreText = this.add.text(
            this.scalingManager.centerX(),
            this.scalingManager.centerY() - this.scalingManager.scaleValue(150),
            `Score: ${this.scoreData?.score || 0}`,
            effectStyle
        ).setOrigin(0.5);
        
        // Add glow effect to score
        this.tweens.add({
            targets: scoreText,
            scale: { from: 1, to: 1.1 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });
    }

    createCelebrationEffect() {
        // Create a star texture dynamically for particles
        this.createStarTexture();

        // Create particle emitters for celebration
        const width = this.sys.game.canvas.width;
        const height = this.cameras.main.height;

        // Define color palettes for different modes
        let particleTints;

        if (this.mode === 'easy') {
            // Purple/pink colors for easy mode
            particleTints = [
                0xff80ff,  // Light pink
                0xcc66cc,  // Medium pink
                0xaa55dd,  // Purple-pink
                0xdd44dd,  // Bright pink
                0xd020d0   // Deep pink
            ];
        } else {
            // Yellow/white spark colors for hard mode
            particleTints = [
                0xffffff,  // Pure white
                0xffffaa,  // Pale yellow
                0xffff80,  // Light yellow
                0xffdd55,  // Golden yellow
                0xffcc00   // Deep gold
            ];
        }

        // Mobile effect reduction
        const deviceType = this.scalingManager?.deviceType || "desktop";
        const isMobile = deviceType === "phone" || deviceType === "tablet";
        const mainQuantity = isMobile ? 15 : 30;
        const mainLifespan = isMobile ? { min: 1800, max: 3000 } : { min: 3000, max: 5000 };
        const secondaryQuantity = isMobile ? 10 : 20;
        const secondaryLifespan = isMobile ? { min: 1500, max: 2500 } : { min: 3000, max: 4500 };
        const thirdQuantity = isMobile ? 7 : 15;
        const thirdLifespan = isMobile ? { min: 1200, max: 2000 } : { min: 3000, max: 4000 };

        // Create a single central point for confetti throwing
        const centerX = width / 2;
        const centerY = height / 2 - 30;

        // Create the main thrown confetti effect
        const mainEmitter = this.add.particles(centerX, centerY, 'star', {
            speed: { min: 300, max: 500 },
            angle: { min: 230, max: 310 },
            lifespan: mainLifespan,
            gravityY: 300,
            quantity: mainQuantity,
            frequency: -1,
            scale: { min: 0.3, max: 0.6 },
            alpha: { min: 0.7, max: 1.0 },
            rotate: { start: 0, end: 600, ease: 'Sine.easeInOut' },
            tint: particleTints,
            blendMode: 'SCREEN',
            drag: { x: 20, y: 10 },
            accelerationX: { min: -50, max: 50 },
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Circle(0, 0, 15),
                quantity: mainQuantity
            }
        });

        // Explode all at once for thrown appearance
        mainEmitter.explode(isMobile ? 20 : 40, 0, 0);

        // Create a secondary delayed throw
        this.time.delayedCall(200, () => {
            const secondaryEmitter = this.add.particles(centerX + 20, centerY + 10, 'star', {
                speed: { min: 300, max: 450 },
                angle: { min: 220, max: 320 },
                lifespan: secondaryLifespan,
                gravityY: 300,
                quantity: secondaryQuantity,
                frequency: -1,
                scale: { min: 0.25, max: 0.5 },
                alpha: { min: 0.7, max: 1.0 },
                rotate: { start: 0, end: 600, ease: 'Sine.easeInOut' },
                tint: particleTints,
                blendMode: 'SCREEN',
                drag: { x: 20, y: 10 },
                accelerationX: { min: -30, max: 30 }
            });

            secondaryEmitter.explode(isMobile ? 12 : 25, 0, 0);
        });

        // Add a third burst for more volume
        this.time.delayedCall(400, () => {
            const thirdEmitter = this.add.particles(centerX - 15, centerY - 5, 'star', {
                speed: { min: 250, max: 400 },
                angle: { min: 210, max: 330 },
                lifespan: thirdLifespan,
                gravityY: 300,
                quantity: thirdQuantity,
                frequency: -1,
                scale: { min: 0.2, max: 0.5 },
                alpha: { min: 0.7, max: 1.0 },
                rotate: { start: 0, end: 500, ease: 'Sine.easeInOut' },
                tint: particleTints,
                blendMode: 'SCREEN',
                drag: { x: 20, y: 10 },
                accelerationX: { min: -40, max: 40 }
            });

            thirdEmitter.explode(isMobile ? 8 : 20, 0, 0);
        });

        // Add continuous emitters around the edges for sustained effect
        const positions = [
            { x: width / 4, y: height / 4 },
            { x: width * 3 / 4, y: height / 4 },
            { x: width / 4, y: height * 3 / 4 - 100 },
            { x: width * 3 / 4, y: height * 3 / 4 - 100 }
        ];

        positions.forEach(pos => {
            const emitter = this.add.particles(pos.x, pos.y, 'star', {
                angle: { min: 0, max: 360 },
                speed: { min: 50, max: 100 },
                lifespan: isMobile ? { min: 1000, max: 1800 } : { min: 2000, max: 3000 },
                gravityY: 40,
                quantity: 1,
                frequency: isMobile ? 900 : 500,
                scale: { min: 0.3, max: 0.5 },
                alpha: { min: 0.7, max: 0.9 },
                rotate: { min: 0, max: 360 },
                tint: particleTints,
                blendMode: 'SCREEN'
            });

            emitter.particleBringToTop = false;
        });
    }
    
    createStarTexture() {
        // Create a sharper glowing dot texture if it doesn't exist
        if (!this.textures.exists('star')) {
            const size = 48; // Slightly smaller for sharper dots
            const canvas = this.textures.createCanvas('star', size, size);
            const ctx = canvas.getContext('2d');
            
            // Clear the canvas
            ctx.clearRect(0, 0, size, size);
            
            const centerX = size / 2;
            const centerY = size / 2;
            const radius = size / 6; // Slightly larger core for sharper appearance
            
            // Create a radial gradient with more distinct steps for the glow effect
            const gradient = ctx.createRadialGradient(
                centerX, centerY, radius * 0.5,
                centerX, centerY, size / 2
            );
            
            if (this.mode === 'easy') {
                // Purple/pink gradient for easy mode
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');    // Bright white center
                gradient.addColorStop(0.1, 'rgba(255, 210, 255, 1)');  // Near-white pink
                gradient.addColorStop(0.3, 'rgba(240, 150, 255, 0.9)'); // Vibrant pink
                gradient.addColorStop(0.6, 'rgba(220, 100, 255, 0.6)'); // Purple-pink
                gradient.addColorStop(0.8, 'rgba(200, 70, 220, 0.2)');  // Faded edge
                gradient.addColorStop(1, 'rgba(180, 70, 220, 0)');      // Transparent edge
            } else {
                // Yellow/white spark gradient for hard mode
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');     // Bright white center
                gradient.addColorStop(0.1, 'rgba(255, 255, 230, 1)');   // Near-white yellow
                gradient.addColorStop(0.3, 'rgba(255, 255, 180, 0.9)'); // Pale yellow
                gradient.addColorStop(0.5, 'rgba(255, 230, 120, 0.7)'); // Yellow
                gradient.addColorStop(0.7, 'rgba(255, 200, 60, 0.4)');  // Golden yellow
                gradient.addColorStop(0.9, 'rgba(255, 180, 0, 0.2)');   // Deep gold
                gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');       // Transparent edge
            }
            
            // Draw the core (brighter center)
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw the glowing dot with gradient
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
            ctx.fill();
            
            canvas.refresh();
        }
    }

    async submitUsername() {
        // Show loading indicator
        this.showLoadingIndicator();

        // Make sure there's a valid username (or use "Anonymous Player")
        const username = this.username.trim() || "Anonymous Player";

        // Save the high score with the username
        if (this.scoreData) {
            try {
                console.log("[submitUsername] Step 1: Preparing score data", JSON.stringify(this.scoreData));
                this.scoreData.username = username;
                if (!this.scoreData.level && this.levelValue) {
                    this.scoreData.level = this.levelValue;
                }

                console.log("[submitUsername] Step 2: Calling saveHighScore");
                await saveHighScore(this.scoreData);
                console.log("[submitUsername] Step 3: saveHighScore complete");

                this.hideLoadingIndicator();

            console.log("[submitUsername] Step 4: Preparing transition snapshot");
            await SceneTransitionManager.prepareTransition(this);
            console.log("[submitUsername] Step 5: Snapshot ready, starting pixel dissolve transition");

            SceneTransitionManager.pixelDissolveTransition(this, 'LeaderboardScene',
                {
                    mode: this.mode,
                    levelValue: this.levelValue,
                    score: this.scoreData?.score,
                    userResponse: this.scoreData?.inputText || this.scoreData?.response
                },
                700,
                this.mode === 'hard' ? '#200025' : '#002435',
                'grid'
            );
            console.log("[submitUsername] Step 6: Transition triggered");
            } catch (error) {
                console.error("[submitUsername] ERROR:", error);
                this.hideLoadingIndicator();
                this.showErrorMessage("Error saving score or transitioning. Please check your connection and try again.");
            }
        } else {
            console.error("[submitUsername] ERROR: No score data found");
            this.hideLoadingIndicator();
            this.showErrorMessage("No score data found. Please try again.");
        }
    }
    
    async skipUsername() {
        try {
            this.hideLoadingIndicator();
            console.log("[skipUsername] Step 1: Preparing transition snapshot");
            await SceneTransitionManager.prepareTransition(this);
            console.log("[skipUsername] Step 2: Snapshot ready, starting pixel dissolve transition");

            SceneTransitionManager.pixelDissolveTransition(this, 'LeaderboardScene',
                {
                    mode: this.mode,
                    levelValue: this.levelValue,
                    score: this.scoreData?.score,
                    userResponse: this.scoreData?.inputText || this.scoreData?.response
                },
                700,
                this.mode === 'hard' ? '#200025' : '#002435',
                'grid'
            );
            console.log("[skipUsername] Step 3: Transition triggered");
        } catch (error) {
            console.error("[skipUsername] ERROR:", error);
            this.showErrorMessage("Error skipping to leaderboard. Please try again.");
        }
    }
    
    showLoadingIndicator() {
        // Disable buttons
        if (this.submitButton) this.submitButton.disableInteractive();
        if (this.skipButton) this.skipButton.disableInteractive();
        
        // Create loading spinner
        this.loadingContainer = this.add.container(this.scalingManager.centerX(), this.scalingManager.centerY());
        
        // Create a graphics object for the rounded rectangle background with proper scaling
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        const bgWidth = this.scalingManager.scaleValue(200);
        const bgHeight = this.scalingManager.scaleValue(100);
        bg.fillRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, this.scalingManager.scaleValue(10));
        
        // Use centralized text style with consistent uiScale
        const deviceType = detectDeviceType();
        const tooltipStyle = getTextStyle('tooltip', deviceType, this.mode, this.uiScale);
        const text = this.add.text(0, 0, 'Saving...', tooltipStyle).setOrigin(0.5);
        
        this.loadingContainer.add([bg, text]);
        this.loadingContainer.setDepth(100);
        
        // Add spinner animation with proper scaling
        const spinner = this.add.graphics();
        spinner.lineStyle(this.scalingManager.scaleValue(3), 0xffffff, 1);
        spinner.beginPath();
        const spinnerY = this.scalingManager.scaleValue(30);
        const spinnerRadius = this.scalingManager.scaleValue(20);
        spinner.arc(0, spinnerY, spinnerRadius, 0, Math.PI);
        spinner.strokePath();
        this.loadingContainer.add(spinner);
        
        this.tweens.add({
            targets: spinner,
            rotation: Math.PI * 2,
            duration: 1000,
            repeat: -1
        });
    }
    
    hideLoadingIndicator() {
        // Re-enable buttons
        if (this.submitButton) this.submitButton.setInteractive();
        if (this.skipButton) this.skipButton.setInteractive();
        
        // Remove loading spinner
        if (this.loadingContainer) {
            this.loadingContainer.destroy();
        }
    }
    
    showErrorMessage(message = "Error saving score") {
        const errorContainer = this.add.container(this.scalingManager.centerX(), this.scalingManager.centerY());

        // Create a graphics object for the rounded rectangle background with proper scaling
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        const bgWidth = this.scalingManager.scaleValue(400);
        const bgHeight = this.scalingManager.scaleValue(200);
        bg.fillRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, this.scalingManager.scaleValue(10));

        // Use centralized text styles with consistent uiScale
        const deviceType = detectDeviceType();
        const promptStyle = getTextStyle('prompt', deviceType, this.mode, this.uiScale);
        const tooltipStyle = getTextStyle('tooltip', deviceType, this.mode, this.uiScale);
        
        // Create error message text with red color override
        const text = this.add.text(
            0, 
            this.scalingManager.scaleValue(-30), 
            message, 
            {
                ...promptStyle,
                color: '#ff0000',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        const subtext = this.add.text(
            0, 
            this.scalingManager.scaleValue(10), 
            'Please try again or continue without saving.', 
            tooltipStyle
        ).setOrigin(0.5);

        const okButton = this.createButton(
            "OK",
            async () => {
                errorContainer.destroy();

                try {
                    await SceneTransitionManager.prepareTransition(this);
                    SceneTransitionManager.glitchTransition(this, 'LeaderboardScene',
                        {
                            mode: this.mode,
                            levelValue: this.levelValue,
                            previousScene: 'DoneScene',
                            userResponse: this.scoreData?.inputText || this.scoreData?.response || this.userResponse
                        },
                        600,
                        '#ff0000',
                        7
                    );
                } catch (error) {
                    console.error("[showErrorMessage] ERROR during glitch transition:", error);
                }
            },
            0, 
            this.scalingManager.scaleValue(60)
        );

        errorContainer.add([bg, text, subtext, okButton]);
        errorContainer.setDepth(100);
    }
}
