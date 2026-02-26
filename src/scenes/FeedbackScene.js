import { BASIC_COLORS_HEX, EASY_COLORS_HEX, HARD_COLORS_HEX, BASIC_COLORS_TEXT, EASY_COLORS_TEXT, HARD_COLORS_TEXT, DESIGN, THEMES } from "../config/design.js";
import { saveInteraction } from "../config/firebase.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import { createBackground } from "../backgrounds/createBackground.js";
import { ScalingManager } from "../config/scaling.js";
import { getTextStyle, getBoxStyle } from "../config/textStyles.js";
import { detectDeviceType, DEVICE_TYPES } from "../config/dimensions.js";

// DESIGN.UI.OUTLINE.WIDTH, DESIGN.UI.OUTLINE.CORNER_RADIUS, DESIGN.UI.BUTTON.HEIGHT, DESIGN.UI.BUTTON.SPACING, DESIGN.UI.BUTTON.WIDTH

// Configuration constants for FeedbackScene layout
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
        INPUT_HEIGHT: 280,
        MOBILE_INPUT_HEIGHT: 440,
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
        TYPING_TIMEOUT: 500
    },
    
    // Layout - Optimized for FeedbackScene (no menu bar or stats box)
    LAYOUT: {
        // Prompt box positioning from top of screen
        PROMPT_TOP_MARGIN_DESKTOP: 80,
        PROMPT_TOP_MARGIN_MOBILE: 160,
        
        // Spacing between prompt and input boxes
        INPUT_OFFSET_BELOW_PROMPT: 60,
        MOBILE_INPUT_OFFSET_BELOW_PROMPT: 70,
        
        // Button positioning
        BUTTON_VERTICAL_GAP_DESKTOP: 30+ DESIGN.UI.BUTTON.HEIGHT/2,
        BUTTON_VERTICAL_GAP_MOBILE: 80 + DESIGN.UI.BUTTON.HEIGHT/2,
        BUTTON_HORIZONTAL_OFFSET_DESKTOP: 60,
        BUTTON_HORIZONTAL_OFFSET_MOBILE: 30
    }
};

export default class FeedbackScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FeedbackScene' });
        this.mode = null;
        this.userInput = '';
        this.levelValue = 1;
        this.COLORS_HEX = BASIC_COLORS_HEX;
        this.COLORS_TEXT = BASIC_COLORS_TEXT;
    }

    
    addButtonClickEffects() {
        // Apply to all buttons
        const buttons = [this.doneButton];
        
        buttons.forEach(button => {
          if (!button) return;
          
          // Add click listener for particle effect
          button.setInteractive();
          
          // Replace any existing click handlers with a new one that includes particles
          button.off('pointerdown');
          button.on('pointerdown', (pointer) => {
            // Create the particle effect
            // Use green for "NEXT", red for "feedback"
            const label = button.list?.find(obj => obj.text)?.text?.toUpperCase?.() || "";
            const color = label === "NEXT" ? 0x43ea5e : (label.includes("FEEDBACK") ? 0xff1744 : undefined);
            
            // Simulate button press animation
            this.tweens.add({
              targets: button,
              scaleX: 0.95,
              scaleY: 0.95,
              duration: 100,
              yoyo: true,
              ease: "Quad.Out",
              onComplete: () => {
                // Call the appropriate button function based on button type
                this.onDoneButtonClick();
              }
            });
          });
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
    
    onDoneButtonClick() {
        const interaction = this.userInput;
        saveInteraction(interaction, 'feedback');
        
        // Clean up resources before transitioning
        this.clearInputTextBox();
        if (this.cursorTimer) {
            this.cursorTimer.remove();
            this.cursorTimer = null;
        }
        
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = null;
        }
        
        // Add a small delay to ensure cleanup completes
        // Prepare reset data for game scene, preserving level and topK
        const resetData = {
            progressPercentage: 50, // Reset to initial value
            levelValue: this.levelValue, // Preserve current level
            topKValue: this.topKValue, // Preserve current topK
            wordCount: 0,
            originalWordCount: 0,
            aiWordCount: 0,
            totalWordCount: 0,
            requiresReset: true // Flag to indicate this is a reset from FeedbackScene
        };

        this.time.delayedCall(50, () => {
            // Use unified BaseGameScene with mode parameter
            this.scene.start('BaseGameScene', { ...resetData, mode: this.mode });
        });
    }

    // Get input text style using centralized text styles
    getInputTextStyle() {
        const deviceType = detectDeviceType();
        return getTextStyle('input', deviceType, this.mode || 'basic', this.uiScale);
    }

    // Get input box style using centralized box styles
    getInputBoxStyle() {
        return getBoxStyle('input', this.mode || 'basic', this.uiScale);
    }

    /**
     * Get standard padding based on device type (matching BaseGameScene)
     */
    getStandardPadding() {
        const deviceType = detectDeviceType();
        const isMobile = deviceType === DEVICE_TYPES.PHONE;
        return isMobile ? SCENE_CONFIG.PADDING.MOBILE : SCENE_CONFIG.PADDING.STANDARD;
    }

    /**
     * Get large padding based on device type (matching BaseGameScene)
     */
    getLargePadding() {
        const deviceType = detectDeviceType();
        const isMobile = deviceType === DEVICE_TYPES.PHONE;
        return isMobile ? SCENE_CONFIG.PADDING.STANDARD : SCENE_CONFIG.PADDING.LARGE;
    }
    
    createInputTextBox() {    
        // Use responsive box width matching Preloader's approach
        const deviceType = detectDeviceType();
        const isDesktop = deviceType === DEVICE_TYPES.DESKTOP;
        const isMobile = deviceType === DEVICE_TYPES.PHONE;
        const sm = this.scalingManager;
        
        const textBoxWidth = isDesktop
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)  // Narrower on desktop
            : this.sys.game.canvas.width * (6 / 7);           // Match BaseGameScene mobile width
        const textBoxHeight = isMobile ? sm.scaleValue(SCENE_CONFIG.BOX_DIMENSIONS.MOBILE_INPUT_HEIGHT) : sm.scaleValue(SCENE_CONFIG.BOX_DIMENSIONS.INPUT_HEIGHT);
        
        // Use input padding from design configuration
        const textHorizontalPadding = DESIGN.UI.INPUT.HORIZONTAL_PADDING;
        const textVerticalPadding = DESIGN.UI.INPUT.VERTICAL_PADDING;
        
        // Calculate input box Y position based on prompt box bottom (matching InstructionsScene.js approach)
        const gap = isMobile ? 80 * this.uiScale : 30 * this.uiScale;
        const inputBoxY = this.promptBoxBottomY + gap;
    
        // Input Text Border
        if (this.inputTextBorder) {
            this.inputTextBorder.destroy();
        }
        
        // Use centralized box style for input box
        const boxStyle = this.getInputBoxStyle();
        
        this.inputTextBorder = this.add.graphics();
        this.inputTextBorder.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.inputTextBorder.fillRoundedRect(
            this.cameras.main.centerX - textBoxWidth / 2,
            inputBoxY,
            textBoxWidth,
            textBoxHeight,
            boxStyle.cornerRadius
        );
        
        if (boxStyle.hasOutline) {
            this.inputTextBorder.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
            this.inputTextBorder.strokeRoundedRect(
                this.cameras.main.centerX - textBoxWidth / 2,
                inputBoxY,
                textBoxWidth,
                textBoxHeight,
                boxStyle.cornerRadius
            );
        }
        this.inputTextBorder.setDepth(100).setVisible(true);

        // Make input area interactive for mobile typing
        this.inputTextBorder.setInteractive(
            new Phaser.Geom.Rectangle(
                this.cameras.main.centerX - textBoxWidth / 2,
                inputBoxY,
                textBoxWidth,
                textBoxHeight
            ),
            Phaser.Geom.Rectangle.Contains
        ).on('pointerdown', () => {
            this.focusHiddenInput();
        });

        // Input Text
        if (this.inputText) {
            this.inputText.destroy();
        }
        this.userInput = "";
        this.cursorVisible = true;

        // Use centralized text style for input text
        const textStyle = {
            ...this.getInputTextStyle(),
            wordWrap: { width: textBoxWidth - textHorizontalPadding * 2 }
        };
        
        this.inputText = this.add.text(
            this.cameras.main.centerX - textBoxWidth / 2 + textHorizontalPadding,
            inputBoxY + textVerticalPadding,
            "_",
            textStyle
        )
        .setOrigin(0, 0)
        .setAlpha(1)
        .setVisible(true)
        .setDepth(101);  // highest depth clearly above input border

        this.inputText.updateText(); // Force redraw explicitly

        // Set up hidden input for mobile typing
        this.setupHiddenInput();

        // Cursor blinking timer
        if (this.cursorTimer) this.cursorTimer.remove();
        this.cursorTimer = this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                this.cursorVisible = !this.cursorVisible;
                this.updateCursor();
            }
        });

        // Final cursor update
        this.updateCursor();
        
        // Store input box dimensions for button positioning
        this.inputBoxY = inputBoxY;
        this.inputBoxHeight = textBoxHeight;
    }

    setupHiddenInput() {
        // Remove any previous input
        if (this._hiddenInput) {
            document.body.removeChild(this._hiddenInput);
            this._hiddenInput = null;
        }
        // Create hidden input
        const input = document.createElement('input');
        input.type = 'text';
        input.autocapitalize = 'sentences';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = 500;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.pointerEvents = 'auto';
        input.style.left = '0';
        input.style.top = '0';
        input.style.width = '1px';
        input.style.height = '1px';
        input.value = this.userInput;

        // Sync input to Phaser text
        input.addEventListener('input', () => {
            console.log('[FeedbackScene] Hidden input value:', input.value);
            this.userInput = input.value;
            this.updateCursor();
        });

        // On blur, set inputActive to false and update cursor
        input.addEventListener('blur', () => {
            this.inputActive = false;
            this.updateCursor();
        });

        document.body.appendChild(input);
        this._hiddenInput = input;
    }

    focusHiddenInput() {
        console.log('[FeedbackScene] focusHiddenInput called');
        if (!this._hiddenInput) this.setupHiddenInput();
        this._hiddenInput.value = this.userInput;
        this._hiddenInput.focus();
        this.inputActive = true;
        // Move cursor to end
        this._hiddenInput.setSelectionRange(this._hiddenInput.value.length, this._hiddenInput.value.length);
    }
    
    // Get prompt text style using centralized text styles
    getPromptTextStyle() {
        const deviceType = detectDeviceType();
        return getTextStyle('prompt', deviceType, this.mode || 'basic', this.uiScale);
    }

    // Get prompt box style using centralized box styles
    getPromptBoxStyle() {
        return getBoxStyle('prompt', this.mode || 'basic', this.uiScale);
    }

    createPromptTextBox() {
        // Scale prompt box Y position based on device type
        const deviceType = detectDeviceType();
        const isDesktop = deviceType === DEVICE_TYPES.DESKTOP;
        const isMobile = deviceType === DEVICE_TYPES.PHONE;
        const sm = this.scalingManager;
        
        // Simple positioning from top of screen (no menu bar or stats box in FeedbackScene)
        const topMargin = isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.PROMPT_TOP_MARGIN_MOBILE)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.PROMPT_TOP_MARGIN_DESKTOP);
        
        // Position prompt box from top of screen
        this.promptBoxY = topMargin;
    
        // Use responsive box width matching BaseGameScene
        const uiBoxWidth = isDesktop
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)  // Narrower on desktop
            : this.sys.game.canvas.width * (6 / 7);           // Match BaseGameScene mobile width
        const textPadding = sm.scaleValue(SCENE_CONFIG.PADDING.STANDARD);
    
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
    
        // ✅ Default text to calculate initial size
        const defaultText = "Thank you for playing! Please use the below space to provide all your gripes and helpful ideas, and hit 'DONE' to return to your game. Be honest. We won't be mad, we promise...";
        
        // Use centralized text style for prompt text
        const textStyle = {
            ...this.getPromptTextStyle(),
            wordWrap: { width: uiBoxWidth - textPadding * 2 },
            align: "center"
        };
        
        this.promptText = this.add.text(
            this.cameras.main.centerX, 
            0, // Y will be adjusted later
            defaultText,
            textStyle
        ).setOrigin(0.5, 0);
    
        // ✅ Ensure text box height dynamically adjusts
        const textHeight = this.promptText.height + textPadding * 2;
        
        // Store prompt box dimensions for input box positioning
        this.promptBoxHeight = textHeight;
        this.promptBoxBottomY = this.promptBoxY + textHeight;
    
        // ✅ Use centralized box style for prompt box
        const boxStyle = this.getPromptBoxStyle();
        
        // ✅ Create the Prompt Background Box
        this.promptTextBox.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.promptTextBox.fillRoundedRect(
            this.cameras.main.centerX - uiBoxWidth / 2, 
            this.promptBoxY,
            uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );
    
        // ✅ Add Outline to Match Output Box
        if (boxStyle.hasOutline) {
            this.promptTextBox.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
            this.promptTextBox.strokeRoundedRect(
                this.cameras.main.centerX - uiBoxWidth / 2, 
                this.promptBoxY,
                uiBoxWidth,
                textHeight,
                boxStyle.cornerRadius
            );
        }
    
        // ✅ Position the Text inside the Box
        this.promptText.setY(this.promptBoxY + textPadding);
    
        // ✅ Ensure Prompt Box Appears Above Other UI Elements
        this.promptTextBox.setDepth(102);
        this.promptText.setDepth(103);
    }
    
    // Fixed clearInputTextBox method
    clearInputTextBox() {
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
    }

    // === Helper Function to Update Text with Blinking Cursor ===
    updateCursor() {
        if (!this.inputText) return;
        
        // Update the main input text with cursor
        if (this.inputActive) {
            // Active state - block cursor
            this.inputText.setText(this.userInput + (this.cursorVisible ? "_" : " "));
        } else {
            // Default state - underscore cursor
            this.inputText.setText(this.userInput + (this.cursorVisible ? "_" : ""));
        }
        
        // Force a proper re-render of the text
        this.inputText.updateText();
        
        // Use the raw text width without the cursor for more accurate positioning
        const rawTextWidth = this.inputText.width - (this.cursorVisible ? 10 : 0);

        // Ensure both text objects are visible and at the correct depth
        this.inputText.setVisible(true)//.setDepth(101);
    }

    setupKeyboardInput() {
        this._feedbackKeydownHandler = (event) => {
            // Allow printable characters (letters, numbers, punctuation, space)
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                if (this.userInput.length < 500) {
                    this.userInput += event.key;
                    this.updateCursor();
                }
            } else if (event.key === 'Backspace') {
                this.userInput = this.userInput.slice(0, -1);
                this.updateCursor();
            } else if (event.key === 'Enter') {
                this.onDoneButtonClick();
            }
        };
        this.input.keyboard.on('keydown', this._feedbackKeydownHandler);
    }
   
    init(data) {
        if (!data.mode) {
            console.error("Error: No mode received in FeedbackScene.");
        } else {
            console.log("mode successfully received in FeedbackScene.");
        }
        this.mode = data.mode || null;
        this.levelValue = data.levelValue || 1;
        this.topKValue = data.topKValue || null;

        // Set colors based on the mode
        if (this.mode === "easy") {
            this.COLORS_HEX = EASY_COLORS_HEX;
            this.COLORS_TEXT = EASY_COLORS_TEXT;
        } else if (this.mode === "hard") {
            this.COLORS_HEX = HARD_COLORS_HEX;
            this.COLORS_TEXT = HARD_COLORS_TEXT;
        } else {
            this.COLORS_HEX = BASIC_COLORS_HEX;
            this.COLORS_TEXT = BASIC_COLORS_TEXT;
        }

        // Reset key scene elements to ensure proper initialization when returning from other scenes
        this.promptTextBox = null;
        this.promptText = null;
    }


    async create() {
        this.cameras.main.scrollY = 0;

        // Initialize scaling manager for responsive UI (matching Preloader.js approach)
        this.scalingManager = new ScalingManager(this);
        
        // Use global UI scale for all elements (matching Preloader.js)
        this.uiScale = this.registry.get && this.registry.get('uiScale') || 1;

        // Create the appropriate background based on mode
        let backgroundConfig;
        if (this.mode === "easy") {
            backgroundConfig = THEMES.easy.background;
        } else if (this.mode === "hard") {
            backgroundConfig = THEMES.hard.background;
        } else {
            backgroundConfig = THEMES.basic.background;
        }

        // Create background with the appropriate theme and level
        createBackground(this, backgroundConfig, this.levelValue);

        // Create prompt box first, then input box (order matters for positioning)
        this.createPromptTextBox();
        this.createInputTextBox();

        // Ensure visibility and layering explicitly
        this.inputTextBorder.setDepth(100).setAlpha(1).setVisible(true);
        this.inputText.setDepth(101).setAlpha(1).setVisible(true);

        // Button placement: to the right and below the text box, using scalingManager (matching InstructionsScene.js)
        // Use responsive box width matching the input box
        const deviceType = detectDeviceType();
        const isDesktop = deviceType === DEVICE_TYPES.DESKTOP;
        const isMobile = deviceType === DEVICE_TYPES.PHONE;
        const uiBoxWidth = isDesktop
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)  // Narrower on desktop
            : this.sys.game.canvas.width * (6 / 7);           // Match BaseGameScene mobile width
        
        // Use scalingManager for button dimensions (matching Preloader.js)
        const buttonWidth = this.scalingManager.buttonWidth();
        const buttonHeight = this.scalingManager.buttonHeight();
        
        // Button positioning matching InstructionsScene.js approach
        const boxX = this.cameras.main.centerX - uiBoxWidth / 2;
        // Button right edge: 60px (scaled) left of text box right edge (same as InstructionsScene.js)
        const buttonCenterX = (boxX + uiBoxWidth) - (buttonWidth / 2) - (60 * this.uiScale);
        // Button top edge: 30px (scaled) below text box bottom edge (move further down on mobile)
        const buttonVerticalGap = isMobile ? 80 * this.uiScale : 30 * this.uiScale;
        const buttonCenterY = this.inputBoxY + this.inputBoxHeight + buttonVerticalGap + (buttonHeight / 2);

        // Now create the button using ButtonFactory
        this.doneButton = this.createButton("DONE", () => this.onDoneButtonClick(), buttonCenterX, buttonCenterY, {
            depth: 102, // ensure button is visible
            scalingManager: this.scalingManager
        });

        this.addButtonClickEffects();
        this.inputActive = false;

        // Setup keyboard input for desktop typing
        this.setupKeyboardInput();

        // Update cursor explicitly at end
        this.updateCursor();
    }
}
